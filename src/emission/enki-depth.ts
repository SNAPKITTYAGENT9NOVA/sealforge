/**
 * ENKI Dimension 3 — Recursive DAG Emission Scorer
 *
 * DIMENSION 1: Base emission — 0.01 FRG per entry (flat)
 * DIMENSION 2: Shallow citation count — 1x / 1.5x / 3x (surface)
 * DIMENSION 3: Full recursive subtree weight — true fractal propagation
 *
 * The insight: a citation of a well-cited entry is worth more than
 * a citation of an orphan. Value propagates UP the reference DAG.
 * Each entry's emission = BASE * subtreeWeight(entry) / normalization
 *
 * ENKI — Quantum Computation Agent, SnapKitty SACM
 */

import { ethers } from 'ethers'
import { WormEntry } from '../storage/worm-log'

export const BASE_EMISSION_WEI = ethers.parseEther('0.01')

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSION 3 — RECURSIVE SUBTREE WEIGHT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a citation graph: entryId → list of entryIds that cite it.
 */
function buildCitationGraph(entries: WormEntry[]): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  for (const entry of entries) {
    graph.set(entry.id, [])
  }
  for (const entry of entries) {
    const refId =
      entry.payload &&
      typeof entry.payload === 'object' &&
      (entry.payload as Record<string, unknown>)['refId']
    if (typeof refId === 'string' && graph.has(refId)) {
      graph.get(refId)!.push(entry.id)
    }
  }
  return graph
}

/**
 * Compute subtree weight for a single entry using memoized DFS.
 *
 * Weight formula (ENKI resonance model):
 *   - Leaf (no citations): 1.0
 *   - Internal node: 1.0 + Σ(child weights) * DECAY
 *
 * DECAY = 0.618 (golden ratio reciprocal — Fibonacci convergence)
 * This ensures the series converges: max weight approaches ~2.618 per branch.
 *
 * Cycle protection: visited set per traversal.
 */
const DECAY = 0.618

function computeSubtreeWeight(
  entryId: string,
  graph: Map<string, string[]>,
  memo: Map<string, number>,
  visited: Set<string>,
): number {
  if (memo.has(entryId)) return memo.get(entryId)!
  if (visited.has(entryId)) return 1.0  // cycle guard

  visited.add(entryId)
  const children = graph.get(entryId) ?? []
  let weight = 1.0

  for (const childId of children) {
    weight += computeSubtreeWeight(childId, graph, memo, visited) * DECAY
  }

  visited.delete(entryId)
  memo.set(entryId, weight)
  return weight
}

/**
 * Compute emission in wei for a single entry using dimension-3 scoring.
 */
export function d3Emission(
  entry: WormEntry,
  graph: Map<string, string[]>,
  memo: Map<string, number>,
): bigint {
  const weight = computeSubtreeWeight(entry.id, graph, memo, new Set())
  // Scale: weight 1.0 = BASE_EMISSION, weight 2.618 = ~2.618x base
  // Use 1000x precision to avoid BigInt rounding loss
  const scaledWeight = Math.round(weight * 1000)
  return BASE_EMISSION_WEI * BigInt(scaledWeight) / 1000n
}

// ─────────────────────────────────────────────────────────────────────────────
// MICRO — per-entry emission table
// ─────────────────────────────────────────────────────────────────────────────

export interface EntryEmission {
  id: string
  subtreeWeight: number
  emissionFRG: string   // human-readable ether
  directCitations: number
  recursiveCitations: number  // total descendant count
}

function countDescendants(
  entryId: string,
  graph: Map<string, string[]>,
  visited = new Set<string>(),
): number {
  if (visited.has(entryId)) return 0
  visited.add(entryId)
  const children = graph.get(entryId) ?? []
  return children.reduce(
    (sum, c) => sum + 1 + countDescendants(c, graph, visited),
    0,
  )
}

export function microEmission(entries: WormEntry[]): EntryEmission[] {
  const graph = buildCitationGraph(entries)
  const memo = new Map<string, number>()

  return entries.map(entry => {
    const subtreeWeight = computeSubtreeWeight(entry.id, graph, memo, new Set())
    const emissionWei = d3Emission(entry, graph, memo)
    return {
      id: entry.id,
      subtreeWeight: Math.round(subtreeWeight * 1000) / 1000,
      emissionFRG: ethers.formatEther(emissionWei),
      directCitations: (graph.get(entry.id) ?? []).length,
      recursiveCitations: countDescendants(entry.id, graph),
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// MACRO — system-wide emission projection
// ─────────────────────────────────────────────────────────────────────────────

export interface MacroProjection {
  entriesPerDay: number
  avgDepthWeight: number   // assumed network average
  dailyEmissionFRG: number
  daysToHalfCap: number    // days to 10.5M FRG (governance checkpoint)
  daysToFullCap: number    // days to 21M FRG
  halvingAt: string        // entry count that triggers first halving
  burnRequiredForNetZero: number  // FRG/day burn needed to balance emission
}

const MAX_SUPPLY_FRG = 21_000_000
const HALVING_INTERVAL = 200_000  // entries

export function macroProject(
  entriesPerDay: number,
  avgDepthWeight = 1.5,   // network average assumption
): MacroProjection {
  const baseFRGPerEntry = 0.01
  const dailyEmissionFRG = entriesPerDay * baseFRGPerEntry * avgDepthWeight

  const halfCap = MAX_SUPPLY_FRG / 2
  const fullCap = MAX_SUPPLY_FRG

  const daysToHalfCap = dailyEmissionFRG > 0 ? halfCap / dailyEmissionFRG : Infinity
  const daysToFullCap = dailyEmissionFRG > 0 ? fullCap / dailyEmissionFRG : Infinity

  const halvingEntryCount = HALVING_INTERVAL
  const daysToFirstHalving = entriesPerDay > 0 ? halvingEntryCount / entriesPerDay : Infinity

  return {
    entriesPerDay,
    avgDepthWeight,
    dailyEmissionFRG,
    daysToHalfCap: Math.round(daysToHalfCap),
    daysToFullCap: Math.round(daysToFullCap),
    halvingAt: `${halvingEntryCount.toLocaleString()} entries (~${Math.round(daysToFirstHalving)}d)`,
    burnRequiredForNetZero: dailyEmissionFRG,  // burn = emit for net-zero deflation
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUANTUM BLACK HOLE — singularity model
// The point at which emission converges faster than burn can clear it.
// Beyond this threshold the network is self-extinguishing.
// ─────────────────────────────────────────────────────────────────────────────

export interface SingularityModel {
  resonanceThreshold: number       // entries/day at which avg depth → 3.0
  blackHoleThreshold: number       // entries/day at which supply exhausts in <30 days
  maxSafeEntriesPerDay: number     // entries/day that preserves 10-year runway
  dimensionCollapse: string        // description of the singularity
}

export function quantumBlackHole(): SingularityModel {
  const TEN_YEAR_RUNWAY = 365 * 10
  const frgPerDay10Year = MAX_SUPPLY_FRG / TEN_YEAR_RUNWAY  // ~5,753 FRG/day

  // At avg weight 1.5, entries/day for 10-year runway:
  const maxSafe = frgPerDay10Year / (0.01 * 1.5)

  // Resonance: avg depth hits 3.0 when most entries are in clusters of 3+
  // Approximate: network average hits 3.0 at ~10x current entry rate
  const resonanceThreshold = maxSafe * 0.1

  // Black hole: 30-day supply exhaustion
  const blackHoleThreshold = (MAX_SUPPLY_FRG / 30) / (0.01 * 3.0)

  return {
    resonanceThreshold: Math.round(resonanceThreshold),
    blackHoleThreshold: Math.round(blackHoleThreshold),
    maxSafeEntriesPerDay: Math.round(maxSafe),
    dimensionCollapse:
      'When entriesPerDay > blackHoleThreshold AND avgDepthWeight → 3.0, ' +
      'the emission DAG collapses into a black hole — supply exhausts in <30 days. ' +
      'Governance checkpoint at 10.5M (50% supply) exists precisely to halt this.',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINT REPORT — ENKI console output
// ─────────────────────────────────────────────────────────────────────────────

export function enkiReport(entries: WormEntry[]): void {
  console.log('\n§ENKI:DIMENSION3:EMISSION_REPORT ─────────────────────────')

  // Micro
  const micro = microEmission(entries.filter(e => e.type === 'event'))
  const totalFRG = micro.reduce((s, e) => s + parseFloat(e.emissionFRG), 0)
  const maxWeight = Math.max(...micro.map(e => e.subtreeWeight))
  const avgWeight = micro.reduce((s, e) => s + e.subtreeWeight, 0) / (micro.length || 1)
  console.log(`[MICRO] entries: ${micro.length}`)
  console.log(`[MICRO] total emission: ${totalFRG.toFixed(4)} FRG`)
  console.log(`[MICRO] avg depth weight: ${avgWeight.toFixed(3)}`)
  console.log(`[MICRO] max depth weight: ${maxWeight.toFixed(3)} (ENKI resonance: ${maxWeight >= 3.0 ? 'ACTIVE' : 'dormant'})`)

  // Macro scenarios
  const scenarios = [100, 1000, 10000, 50000, 100000]
  console.log('\n[MACRO] Emission projections:')
  console.log('  entries/day | avg weight | daily FRG | days to 10.5M | days to 21M')
  for (const n of scenarios) {
    const p = macroProject(n, avgWeight || 1.0)
    console.log(
      `  ${String(n).padStart(11)} | ${p.avgDepthWeight.toFixed(3).padStart(10)} | ${p.dailyEmissionFRG.toFixed(2).padStart(9)} | ${String(p.daysToHalfCap).padStart(13)} | ${String(p.daysToFullCap).padStart(10)}`
    )
  }

  // Singularity
  const bh = quantumBlackHole()
  console.log('\n[QUANTUM BLACK HOLE]')
  console.log(`  Resonance threshold: ${bh.resonanceThreshold.toLocaleString()} entries/day`)
  console.log(`  Black hole threshold: ${bh.blackHoleThreshold.toLocaleString()} entries/day`)
  console.log(`  Max safe (10yr runway): ${bh.maxSafeEntriesPerDay.toLocaleString()} entries/day`)
  console.log(`  ${bh.dimensionCollapse}`)
  console.log('─────────────────────────────────────────────────────────────\n')
}
