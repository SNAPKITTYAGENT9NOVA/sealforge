/**
 * Settlement Engine — SEALFORGE → FORGE token
 *
 * Reads ALL WORM entries, filters to type === 'event', derives a bytes32
 * wormHash from each chainHash, checks the contract for prior consumption,
 * and calls wormMint for any un-minted entries.
 *
 * Settlement state is persisted to ./data/settlement-state.json as an
 * append-only record.  Processed entries are NEVER modified or deleted.
 *
 * NEXUS — Orchestration Agent (connecting SEALFORGE Node 1 → FORGE Node 2)
 */

import * as fs from 'fs'
import * as path from 'path'
import { ethers } from 'ethers'
import { WormLog, WormEntry } from '../storage/worm-log'
import { ForgeContract } from './forge-contract'
import { toBytes32 } from './bytes32'

// 0.01 FRG per settled WORM event (testnet rate)
const BASE_EMISSION = ethers.parseEther('0.01')
const BASE_EMISSION_STR = '0.01'

/** A record of a successful (or attempted) settlement. */
export interface SettlementRecord {
  wormEntryId: string
  wormHash: string
  txHash: string
  recipient: string
  amountEther: string
  settledAt: string
}

/** Loaded at startup; keyed by wormEntryId for O(1) de-dupe. */
export interface SettlementState {
  processed: Record<string, SettlementRecord>
}

function getStateFilePath(): string {
  const dataDir = process.env.DATA_DIR ?? './data'
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  return path.join(dataDir, 'settlement-state.json')
}

function loadState(): SettlementState {
  const fp = getStateFilePath()
  if (!fs.existsSync(fp)) return { processed: {} }
  try {
    const raw = fs.readFileSync(fp, 'utf8')
    return JSON.parse(raw) as SettlementState
  } catch {
    console.error('[NEXUS:SETTLEMENT] Could not parse settlement-state.json — starting fresh')
    return { processed: {} }
  }
}

function saveState(state: SettlementState): void {
  const fp = getStateFilePath()
  fs.writeFileSync(fp, JSON.stringify(state, null, 2), 'utf8')
}


export interface SettlementRunResult {
  checked: number
  minted: number
  skipped: number
  errors: number
  txHashes: string[]
}

/**
 * Run one pass of the settlement engine.
 * Returns a summary of the run.
 */
export async function runSettlement(
  worm: WormLog,
  forge: ForgeContract,
): Promise<SettlementRunResult> {
  const state = loadState()
  const recipient = process.env.MINT_RECIPIENT
  if (!recipient) throw new Error('[NEXUS:SETTLEMENT] MINT_RECIPIENT env var is required')

  // Pull all entries — use a large limit; production should paginate if needed
  const { entries, chainValid } = worm.getAll(100_000, 0)
  if (!chainValid) throw new Error('[NEXUS:SETTLEMENT] WORM chain integrity failure — aborting')

  // Only settle 'event' type entries — skip lifecycle noise
  const events: WormEntry[] = entries.filter(e => e.type === 'event')

  const result: SettlementRunResult = {
    checked: events.length,
    minted: 0,
    skipped: 0,
    errors: 0,
    txHashes: [],
  }

  for (const entry of events) {
    // Already settled locally — skip without hitting the RPC
    if (state.processed[entry.id]) {
      result.skipped++
      continue
    }

    const wormHash = toBytes32(entry.chainHash)

    try {
      // Check on-chain — skip if already consumed
      const consumed = await forge.isConsumed(wormHash)
      if (consumed) {
        console.log(`[NEXUS:SETTLEMENT] SKIP (on-chain consumed) — entry ${entry.id}`)
        // Record locally so we don't re-check next cycle
        const record: SettlementRecord = {
          wormEntryId: entry.id,
          wormHash,
          txHash: 'ALREADY_CONSUMED',
          recipient,
          amountEther: BASE_EMISSION_STR,
          settledAt: new Date().toISOString(),
        }
        state.processed[entry.id] = record
        result.skipped++
        continue
      }

      console.log(`[NEXUS:SETTLEMENT] MINT — entry ${entry.id} → ${recipient}`)
      const txHash = await forge.mint(recipient, BASE_EMISSION_STR, wormHash)
      console.log(`[NEXUS:SETTLEMENT] TX ${txHash} confirmed`)

      const record: SettlementRecord = {
        wormEntryId: entry.id,
        wormHash,
        txHash,
        recipient,
        amountEther: BASE_EMISSION_STR,
        settledAt: new Date().toISOString(),
      }

      // Append-only — write after each successful mint so a crash mid-run
      // doesn't lose prior confirmations
      state.processed[entry.id] = record
      saveState(state)

      result.minted++
      result.txHashes.push(txHash)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[NEXUS:SETTLEMENT] ERROR on entry ${entry.id}: ${msg}`)
      result.errors++
      // Continue to next entry — never let one failure stop the run
    }
  }

  // Persist final state (covers the skipped-but-recorded entries)
  saveState(state)

  return result
}
