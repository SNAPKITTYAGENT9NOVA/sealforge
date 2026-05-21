/**
 * Settlement Runner — WORM-Proof-of-Productive-Work bridge
 *
 * Runs on a configurable interval.  On each tick it calls the settlement
 * engine which reads WORM entries and mints FORGE tokens for any un-settled
 * events.  Errors are logged and swallowed — the loop never crashes.
 *
 * Start with:
 *   ts-node src/bridge/index.ts
 *
 * NEXUS — Orchestration Agent (connecting SEALFORGE Node 1 → FORGE Node 2)
 */

import { WormLog } from '../storage/worm-log'
import { ForgeContract } from './forge-contract'
import { runSettlement, SettlementRunResult } from './settlement'

const INTERVAL_MS = parseInt(
  process.env.SETTLEMENT_INTERVAL_MS ?? '30000',
  10,
)

const worm = new WormLog(process.env.DATA_DIR ?? './data')

let forge: ForgeContract | null = null

function getForge(): ForgeContract {
  if (!forge) forge = new ForgeContract()
  return forge
}

async function tick(): Promise<void> {
  const startedAt = new Date().toISOString()
  console.log(`[NEXUS:BRIDGE] Settlement tick — ${startedAt}`)

  try {
    const result: SettlementRunResult = await runSettlement(worm, getForge())
    console.log(
      `[NEXUS:BRIDGE] Done — checked: ${result.checked}, minted: ${result.minted}, ` +
        `skipped: ${result.skipped}, errors: ${result.errors}`,
    )
    if (result.txHashes.length > 0) {
      console.log(`[NEXUS:BRIDGE] TX hashes this run:`)
      result.txHashes.forEach(h => console.log(`  ${h}`))
    }
  } catch (err: unknown) {
    // Top-level guard — should never reach here because runSettlement handles
    // per-entry errors, but belt-and-suspenders for config/init failures.
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[NEXUS:BRIDGE] Fatal tick error (loop continues): ${msg}`)
  }
}

console.log(
  `[NEXUS:BRIDGE] WORM Settlement Bridge starting — interval: ${INTERVAL_MS}ms`,
)
console.log(
  `[NEXUS:BRIDGE] FORGE contract: ${process.env.FORGE_CONTRACT_ADDRESS ?? '(not set)'}`,
)
console.log(
  `[NEXUS:BRIDGE] Recipient: ${process.env.MINT_RECIPIENT ?? '(default dead address)'}`,
)

// Run immediately on startup, then on interval
tick()
setInterval(tick, INTERVAL_MS)
