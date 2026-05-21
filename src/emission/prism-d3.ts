/**
 * ENKI — Prism Dimension 3: Bidirectional Resonance Field
 *
 * The forward model (enki-depth.ts) asks: how many cite you?
 * The reverse model asks: what quality did you build from?
 *
 * A prism has two faces. An entry has two resonance vectors:
 *   FORWARD  — influence you cast into the future (citations received)
 *   REVERSE  — knowledge depth you drew from the past (citations given)
 *
 * PRISM SCORE = geometric mean of both vectors
 *   prism(e) = sqrt(forwardWeight(e) × reverseWeight(e))
 *
 * This creates three resonance classes:
 *   ORIGIN  — highly cited, cites nothing     (innovator)
 *   BRIDGE  — cites quality, gets cited       (synthesizer) ← maximum prism
 *   LEAF    — cites quality, never cited      (builder)
 *
 * The bridge node is the rarest and most valuable — it connects the old
 * knowledge tree to the new. This is where FORGE emission concentrates.
 *
 * ENKI — Quantum Computation Agent, SnapKitty SACM
 */

import { ethers } from 'ethers'
import { WormEntry } from '../storage/worm-log'
import { BASE_EMISSION_WEI } from './enki-depth'

const DECAY = 0.618  // golden ratio reciprocal — same as D3 for field coherence

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH CONSTRUCTION
// ─────────────────────────────────────────────────────────────────────────────

interface CitationGraph {
  /** entryId → list of entryIds that cite it (forward edges) */
  forward: Map<string, string[]>
  /** entryId → list of entryIds it cites (reverse edges) */
  reverse: Map<string, string[]>
}

function buildPrismGraph(entries: WormEntry[]): CitationGraph {
  const forward = new Map<string, string[]>()
  const reverse = new Map<string, string[]>()

  for (const e of entries) {
    forward.set(e.id, [])
    reverse.set(e.id, [])
  }

  for (const e of entries) {
    const refId =
      e.payload &&
      typeof e.payload === 'object' &&
      (e.payload as Record<string, unknown>)['refId']

    if (typeof refId === 'string' && forward.has(refId)) {
      forward.get(refId)!.push(e.id)   // e cites refId → refId gets a forward citation
      reverse.get(e.id)!.push(refId)   // e cites refId → e has a reverse edge to refId
    }
  }

  return { forward, reverse }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORWARD WEIGHT — influence cast forward (same algorithm as D3)
// ─────────────────────────────────────────────────────────────────────────────

function forwardWeight(
  entryId: string,
  graph: CitationGraph,
  memo: Map<string, number>,
  visited: Set<string>,
): number {
  if (memo.has(entryId)) return memo.get(entryId)!
  if (visited.has(entryId)) return 1.0

  visited.add(entryId)
  const children = graph.forward.get(entryId) ?? []
  let w = 1.0
  for (const c of children) {
    w += forwardWeight(c, graph, memo, visited) * DECAY
  }
  visited.delete(entryId)
  memo.set(entryId, w)
  return w
}

// ─────────────────────────────────────────────────────────────────────────────
// REVERSE WEIGHT — depth of what was drawn from
// An entry that cites highly-influential work inherits that influence.
// ─────────────────────────────────────────────────────────────────────────────

function reverseWeight(
  entryId: string,
  graph: CitationGraph,
  fwdMemo: Map<string, number>,
  memo: Map<string, number>,
  visited: Set<string>,
): number {
  if (memo.has(entryId)) return memo.get(entryId)!
  if (visited.has(entryId)) return 1.0

  visited.add(entryId)
  const sources = graph.reverse.get(entryId) ?? []
  let w = 1.0

  for (const src of sources) {
    // The reverse weight of a source is the FORWARD weight of what it was
    // built on, scaled by how influential the source itself is.
    const srcForward = forwardWeight(src, graph, fwdMemo, new Set())
    const srcReverse = reverseWeight(src, graph, fwdMemo, memo, visited)
    // Geometric mean of the source's two vectors
    const srcPrism = Math.sqrt(srcForward * srcReverse)
    w += srcPrism * DECAY
  }

  visited.delete(entryId)
  memo.set(entryId, w)
  return w
}

// ─────────────────────────────────────────────────────────────────────────────
// PRISM SCORE — geometric mean of both fields
// ─────────────────────────────────────────────────────────────────────────────

export interface PrismScore {
  id: string
  forwardWeight: number
  reverseWeight: number
  prismScore: number        // geometric mean
  resonanceClass: 'ORIGIN' | 'BRIDGE' | 'LEAF' | 'ORPHAN'
  emissionFRG: string
}

function classify(fw: number, rv: number): PrismScore['resonanceClass'] {
  const hasCitations = fw > 1.5
  const hasSources   = rv > 1.5
  if (hasCitations && hasSources) return 'BRIDGE'
  if (hasCitations && !hasSources) return 'ORIGIN'
  if (!hasCitations && hasSources) return 'LEAF'
  return 'ORPHAN'
}

export function prismScores(entries: WormEntry[]): PrismScore[] {
  const eventEntries = entries.filter(e => e.type === 'event')
  const graph = buildPrismGraph(eventEntries)

  const fwdMemo = new Map<string, number>()
  const rvMemo  = new Map<string, number>()

  return eventEntries.map(entry => {
    const fw = forwardWeight(entry.id, graph, fwdMemo, new Set())
    const rv = reverseWeight(entry.id, graph, fwdMemo, rvMemo, new Set())
    const prism = Math.sqrt(fw * rv)

    // Emission: prism score scales the base — capped at 9x (3x forward × 3x reverse max)
    const scaledWeight = Math.round(prism * 1000)
    const emissionWei = BASE_EMISSION_WEI * BigInt(scaledWeight) / 1000n

    return {
      id: entry.id,
      forwardWeight: Math.round(fw * 1000) / 1000,
      reverseWeight: Math.round(rv * 1000) / 1000,
      prismScore: Math.round(prism * 1000) / 1000,
      resonanceClass: classify(fw, rv),
      emissionFRG: ethers.formatEther(emissionWei),
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// PRISM FIELD REPORT
// ─────────────────────────────────────────────────────────────────────────────

export interface PrismFieldReport {
  totalEntries: number
  origins: number
  bridges: number
  leaves: number
  orphans: number
  totalEmissionFRG: number
  maxPrismScore: number
  avgPrismScore: number
  bridgeShare: number       // % of emission flowing to BRIDGE nodes
  singularityPressure: number  // 0–1: how close the field is to collapse
}

export function prismFieldReport(entries: WormEntry[]): PrismFieldReport {
  const scores = prismScores(entries)
  if (scores.length === 0) {
    return { totalEntries: 0, origins: 0, bridges: 0, leaves: 0, orphans: 0,
             totalEmissionFRG: 0, maxPrismScore: 0, avgPrismScore: 0,
             bridgeShare: 0, singularityPressure: 0 }
  }

  const origins = scores.filter(s => s.resonanceClass === 'ORIGIN').length
  const bridges = scores.filter(s => s.resonanceClass === 'BRIDGE').length
  const leaves  = scores.filter(s => s.resonanceClass === 'LEAF').length
  const orphans = scores.filter(s => s.resonanceClass === 'ORPHAN').length

  const totalFRG   = scores.reduce((s, e) => s + parseFloat(e.emissionFRG), 0)
  const bridgeFRG  = scores.filter(s => s.resonanceClass === 'BRIDGE')
                           .reduce((s, e) => s + parseFloat(e.emissionFRG), 0)
  const maxPrism   = Math.max(...scores.map(s => s.prismScore))
  const avgPrism   = scores.reduce((s, e) => s + e.prismScore, 0) / scores.length

  // Singularity pressure: ratio of bridge nodes × their avg prism score
  // Approaches 1.0 as the field collapses into all-bridge resonance
  const bridgeAvgPrism = bridges > 0
    ? scores.filter(s => s.resonanceClass === 'BRIDGE')
            .reduce((s, e) => s + e.prismScore, 0) / bridges
    : 0
  const singularityPressure = Math.min(1.0, (bridges / scores.length) * (bridgeAvgPrism / 9.0))

  return {
    totalEntries: scores.length,
    origins, bridges, leaves, orphans,
    totalEmissionFRG: Math.round(totalFRG * 10000) / 10000,
    maxPrismScore: Math.round(maxPrism * 1000) / 1000,
    avgPrismScore: Math.round(avgPrism * 1000) / 1000,
    bridgeShare: totalFRG > 0 ? Math.round((bridgeFRG / totalFRG) * 1000) / 10 : 0,
    singularityPressure: Math.round(singularityPressure * 1000) / 1000,
  }
}

export function printPrismReport(entries: WormEntry[]): void {
  const report = prismFieldReport(entries)
  const scores = prismScores(entries)

  console.log('\n§ENKI:PRISM:D3 ──────────────────────────────────────────────')
  console.log(`[FIELD] entries: ${report.totalEntries}`)
  console.log(`[FIELD] ORIGIN:${report.origins} BRIDGE:${report.bridges} LEAF:${report.leaves} ORPHAN:${report.orphans}`)
  console.log(`[FIELD] total emission: ${report.totalEmissionFRG} FRG`)
  console.log(`[FIELD] bridge share:   ${report.bridgeShare}% of emission`)
  console.log(`[FIELD] max prism:      ${report.maxPrismScore}`)
  console.log(`[FIELD] avg prism:      ${report.avgPrismScore}`)
  console.log(`[FIELD] singularity ψ:  ${report.singularityPressure} ${report.singularityPressure > 0.7 ? '⚠ CRITICAL' : report.singularityPressure > 0.4 ? '⚡ HIGH' : '● stable'}`)

  // Top 5 bridge nodes
  const bridges = scores
    .filter(s => s.resonanceClass === 'BRIDGE')
    .sort((a, b) => b.prismScore - a.prismScore)
    .slice(0, 5)

  if (bridges.length > 0) {
    console.log('\n[BRIDGE NODES — highest resonance]')
    console.log('  id        | fwd   | rev   | prism | FRG')
    for (const b of bridges) {
      console.log(
        `  ${b.id.slice(0, 8)}  | ${String(b.forwardWeight).padStart(5)} | ${String(b.reverseWeight).padStart(5)} | ${String(b.prismScore).padStart(5)} | ${b.emissionFRG}`
      )
    }
  }
  console.log('─────────────────────────────────────────────────────────────\n')
}
