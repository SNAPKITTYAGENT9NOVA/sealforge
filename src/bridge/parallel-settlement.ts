import * as fs from 'fs'
import * as path from 'path'
import { ethers } from 'ethers'
import { WormLog, WormEntry } from '../storage/worm-log'
import { FORGE_ABI } from './abi'
import { toBytes32 } from './bytes32'

const STATE_FILE = path.join(process.env.DATA_DIR ?? './data', 'settlement-state.json')
const BATCH_SIZE = 10
const BASE_EMISSION = ethers.parseEther('0.01') // 0.01 FRG per entry on testnet

interface PendingTx {
  txHash: string
  wormHash: string
  entryId: string
  ts: string
  confirmed?: boolean
  reverted?: boolean
}

interface SettlementState {
  processed: Record<string, boolean>
  pending: PendingTx[]
}

function loadState(): SettlementState {
  if (!fs.existsSync(STATE_FILE)) return { processed: {}, pending: [] }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    const backup = STATE_FILE + '.corrupt.' + Date.now()
    fs.renameSync(STATE_FILE, backup)
    console.error(`[PARALLEL] State file corrupt — backed up to ${backup}, starting fresh`)
    return { processed: {}, pending: [] }
  }
}

function saveState(state: SettlementState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

// Shallow citation depth scoring — use enki-depth.ts for full DAG scoring
function scoreDepth(entry: WormEntry, allEntries: WormEntry[]): number {
  const citations = allEntries.filter(e =>
    e.payload && typeof e.payload === 'object' &&
    (e.payload as Record<string, unknown>)['refId'] === entry.id
  ).length
  if (citations >= 3) return 3.0  // ENKI resonance threshold
  if (citations >= 1) return 1.5
  return 1.0
}

function calcEmission(_entry: WormEntry, depthScore: number): bigint {
  return BASE_EMISSION * BigInt(Math.round(depthScore * 100)) / 100n
}

export class ParallelSettlementEngine {
  private worm: WormLog
  private provider: ethers.JsonRpcProvider
  private signer: ethers.Wallet
  private contract: ethers.Contract
  private pendingConfirmations: Map<string, PendingTx> = new Map()

  constructor(worm: WormLog) {
    this.worm = worm
    const rpc = process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org'
    const pk = process.env.TREASURY_PRIVATE_KEY
    if (!pk) throw new Error('TREASURY_PRIVATE_KEY not set')
    const addr = process.env.FORGE_CONTRACT_ADDRESS
    if (!addr) throw new Error('FORGE_CONTRACT_ADDRESS not set')
    const recipient = process.env.MINT_RECIPIENT
    if (!recipient) throw new Error('MINT_RECIPIENT not set')

    this.provider = new ethers.JsonRpcProvider(rpc)
    this.signer = new ethers.Wallet(pk, this.provider)
    this.contract = new ethers.Contract(addr, FORGE_ABI, this.signer)

    // Log signer address so operators can verify against on-chain MINTER_ROLE
    console.log(`[PARALLEL] Signer address: ${this.signer.address}`)
  }

  async runBatch(): Promise<{ dispatched: number; skipped: number; failed: number }> {
    const state = loadState()
    const { entries, chainValid } = this.worm.getAll(1000, 0)
    if (!chainValid) throw new Error('[PARALLEL] WORM chain integrity failure — aborting')

    const allEntries = entries
    const recipient = process.env.MINT_RECIPIENT!

    const unprocessed = allEntries.filter(e =>
      e.type === 'event' && !state.processed[e.id]
    )

    if (unprocessed.length === 0) {
      console.log('[PARALLEL] No unprocessed entries')
      return { dispatched: 0, skipped: 0, failed: 0 }
    }

    const batch = unprocessed.slice(0, BATCH_SIZE)
    console.log(`[PARALLEL] Batch: ${batch.length} entries`)

    // Get nonce once, increment per tx — critical for parallel EVM dispatch
    const baseNonce = await this.provider.getTransactionCount(this.signer.address, 'pending')
    const feeData = await this.provider.getFeeData()
    const maxFeePerGas = feeData.maxFeePerGas
      ? feeData.maxFeePerGas * 110n / 100n  // +10% tip
      : ethers.parseUnits('0.001', 'gwei')

    // Dispatch all in parallel — each gets unique nonce
    const results = await Promise.allSettled(
      batch.map(async (entry, i) => {
        const bytes32Hash = toBytes32(entry.chainHash)
        const depthScore = scoreDepth(entry, allEntries)
        const amount = calcEmission(entry, depthScore)
        const nonce = baseNonce + i

        const tx = await this.contract.wormMint(recipient, amount, bytes32Hash, {
          nonce,
          maxFeePerGas,
          maxPriorityFeePerGas: ethers.parseUnits('0.001', 'gwei'),
        })

        return { entry, txHash: tx.hash, amount }
      })
    )

    let dispatched = 0, skipped = 0, failed = 0

    results.forEach((result, i) => {
      const entry = batch[i]
      if (result.status === 'fulfilled') {
        const { txHash } = result.value
        // Mark processed only on successful dispatch; confirmPending() handles revert recovery
        state.processed[entry.id] = true
        const pendingRecord: PendingTx = { txHash, wormHash: entry.chainHash, entryId: entry.id, ts: new Date().toISOString() }
        state.pending.push(pendingRecord)
        this.pendingConfirmations.set(txHash, pendingRecord)
        // Save state incrementally — crash safety
        saveState(state)
        console.log(`[PARALLEL] ✓ ${entry.id.slice(0, 8)}... → ${txHash.slice(0, 18)}...`)
        dispatched++
      } else {
        const err = (result.reason as Error).message ?? 'unknown'
        if (err.includes('already redeemed') || err.includes('wormEntryMinted')) {
          state.processed[entry.id] = true
          saveState(state)
          skipped++
        } else {
          console.error(`[PARALLEL] ✗ ${entry.id.slice(0, 8)}... — ${err}`)
          failed++
        }
      }
    })

    return { dispatched, skipped, failed }
  }

  async confirmPending(): Promise<void> {
    if (this.pendingConfirmations.size === 0) return
    const state = loadState()
    const checks = Array.from(this.pendingConfirmations.entries())

    await Promise.allSettled(checks.map(async ([txHash, pending]) => {
      const receipt = await this.provider.getTransactionReceipt(txHash)
      if (!receipt) return

      if (receipt.status === 1) {
        console.log(`[CONFIRM] ✓ ${txHash.slice(0, 18)}... confirmed (block ${receipt.blockNumber})`)
        // Mark pending record as confirmed
        const rec = state.pending.find(p => p.txHash === txHash)
        if (rec) rec.confirmed = true
      } else {
        console.error(`[CONFIRM] ✗ ${txHash.slice(0, 18)}... REVERTED — will retry`)
        // Remove from processed so the entry is retried on next runBatch()
        delete state.processed[pending.entryId]
        const rec = state.pending.find(p => p.txHash === txHash)
        if (rec) rec.reverted = true
      }

      this.pendingConfirmations.delete(txHash)
      saveState(state)
    }))
  }
}
