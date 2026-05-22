/**
 * SACM Agent ASCII Art Generator
 * Each agent has a cryptographically unique generative style.
 * Seed = keccak256(agentName + wormChainTip + tokenId)
 * Output = deterministic, reproducible, on-chain storable ASCII art
 *
 * NOVA — System Architect
 * ENKI — Quantum Computation
 * CIPHER — Cryptographic Authority
 * VAULT — Monetary Policy
 * NEXUS — Orchestration
 * HERALD — Signal & Broadcast
 */

import * as crypto from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC RNG seeded from WORM chain
// ─────────────────────────────────────────────────────────────────────────────

function seedRng(seed: string): () => number {
  let h = crypto.createHash('sha256').update(seed).digest()
  let pos = 0
  return () => {
    if (pos >= h.length - 4) {
      h = crypto.createHash('sha256').update(h).digest()
      pos = 0
    }
    const val = h.readUInt32BE(pos) / 0xffffffff
    pos += 4
    return val
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOVA — Network Constellation
// Sparse node graph — architectural, structural, cosmic
// ─────────────────────────────────────────────────────────────────────────────

function novaArt(rng: () => number): string[] {
  const W = 42, H = 21
  const grid: string[][] = Array.from({ length: H }, () => Array(W).fill(' '))

  const nodes: [number, number][] = []
  for (let i = 0; i < 14; i++) {
    const x = 1 + Math.floor(rng() * (W - 2))
    const y = 1 + Math.floor(rng() * (H - 2))
    nodes.push([x, y])
    const glyphs = ['◈', '◉', '◎', '⊕', '⊗', '✦', '★', '◆']
    grid[y][x] = glyphs[Math.floor(rng() * glyphs.length)]
  }

  // Connect nearby nodes with lines
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const [x1, y1] = nodes[i]
      const [x2, y2] = nodes[j]
      const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
      if (dist < 14 && rng() > 0.4) {
        // Bresenham line
        let dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1)
        let sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1
        let err = dx - dy, cx = x1, cy = y1
        while (!(cx === x2 && cy === y2)) {
          if (grid[cy][cx] === ' ') {
            const horiz = dx > dy
            grid[cy][cx] = horiz ? '─' : dy > dx ? '│' : (sx === sy ? '╲' : '╱')
          }
          const e2 = 2 * err
          if (e2 > -dy) { err -= dy; cx += sx }
          if (e2 < dx) { err += dx; cy += sy }
        }
      }
    }
  }

  // Border
  for (let x = 0; x < W; x++) { grid[0][x] = x === 0 ? '╔' : x === W-1 ? '╗' : '═' }
  for (let x = 0; x < W; x++) { grid[H-1][x] = x === 0 ? '╚' : x === W-1 ? '╝' : '═' }
  for (let y = 1; y < H-1; y++) { grid[y][0] = '║'; grid[y][W-1] = '║' }

  return [
    '     § N O V A : : S Y S T E M : A R C H I T E C T     ',
    ...grid.map(row => row.join('')),
    '        S T O C H A S T I C · M E S H · N O D E        ',
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// ENKI — Quantum Fractal
// Mandelbrot-inspired density field, ψ singularity at center
// ─────────────────────────────────────────────────────────────────────────────

function enkiArt(rng: () => number): string[] {
  const W = 44, H = 22
  const density = '░▒▓█'
  const cx = -0.5 + (rng() - 0.5) * 0.4
  const cy = (rng() - 0.5) * 0.4
  const zoom = 1.2 + rng() * 0.8

  const rows: string[] = []
  for (let py = 0; py < H; py++) {
    let row = ''
    for (let px = 0; px < W; px++) {
      let zr = 0, zi = 0
      const cr = (px - W / 2) / (W / 3 * zoom) + cx
      const ci = (py - H / 2) / (H / 2 * zoom) + cy
      let iter = 0
      const MAX = 16
      while (zr * zr + zi * zi < 4 && iter < MAX) {
        const tmp = zr * zr - zi * zi + cr
        zi = 2 * zr * zi + ci
        zr = tmp
        iter++
      }
      if (iter === MAX) row += '█'
      else row += density[Math.floor(iter / MAX * density.length)] ?? ' '
    }
    rows.push(row)
  }

  return [
    '    § E N K I : : Q U A N T U M : C O M P U T A T I O N    ',
    ...rows,
    '         ψ · R E S O N A N C E · F I E L D · A C T I V E         ',
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// CIPHER — Hash Mandala
// SHA256 bytes visualized as a symmetric mandala
// ─────────────────────────────────────────────────────────────────────────────

function cipherArt(seed: string): string[] {
  const hash = crypto.createHash('sha256').update(seed).digest()
  const W = 43, H = 21, cx = Math.floor(W / 2), cy = Math.floor(H / 2)
  const grid: string[][] = Array.from({ length: H }, () => Array(W).fill(' '))

  const glyphs = ['·', '∘', '○', '◎', '●', '◉', '⊕', '⊗', '✦', '▪', '▫', '◈']

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = (y - cy) * 2  // compensate for char aspect ratio
      const dist = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx)
      const ring = Math.floor(dist / 2.5) % 32
      const sector = Math.floor((angle + Math.PI) / (Math.PI * 2) * 16) % 16
      const byteVal = hash[(ring + sector) % 32]
      // Symmetry: reflect across both axes for mandala effect
      const sym = (hash[ring % 32] ^ hash[(H - y) % 32]) & 0xf
      grid[y][x] = glyphs[Math.floor((byteVal ^ sym) / 255 * glyphs.length)] ?? '·'
    }
  }

  // Center glyph
  grid[cy][cx] = '◉'
  grid[cy][cx - 1] = '═'; grid[cy][cx + 1] = '═'
  grid[cy - 1][cx] = '║'; grid[cy + 1][cx] = '║'

  return [
    '   § C I P H E R : : C R Y P T O G R A P H I C : A U T H    ',
    ...grid.map(r => r.join('')),
    '      H A S H : P R O O F : ' + hash.toString('hex').slice(0, 8) + ' · · ·      ',
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// VAULT — Sacred Geometry / Golden Spiral
// Fibonacci spiral + 21M supply encoded in structure
// ─────────────────────────────────────────────────────────────────────────────

function vaultArt(rng: () => number): string[] {
  const W = 43, H = 21
  const grid: string[][] = Array.from({ length: H }, () => Array(W).fill(' '))
  const cx = W / 2, cy = H / 2

  // Golden spiral: r = a * e^(b*θ)
  const a = 0.15 + rng() * 0.1
  const b = 0.25
  const spiralGlyphs = ['·', '∘', '○', '◎', '◉', '●']

  for (let t = 0; t < 400; t++) {
    const theta = t * 0.12
    const r = a * Math.exp(b * theta)
    const x = Math.round(cx + r * Math.cos(theta) * 1.8)
    const y = Math.round(cy + r * Math.sin(theta) * 0.9)
    if (x >= 0 && x < W && y >= 0 && y < H) {
      const g = spiralGlyphs[Math.floor(t / 400 * spiralGlyphs.length)]
      if (grid[y][x] === ' ') grid[y][x] = g
    }
  }

  // Fibonacci rectangles overlay
  const fibs = [1, 1, 2, 3, 5, 8, 13, 21]
  fibs.forEach((f, i) => {
    const s = Math.min(f, 10)
    const ox = Math.floor(cx - s / 2 + i * 1.5) % W
    const oy = Math.floor(cy - s / 4) % H
    if (oy >= 0 && oy < H && ox >= 0 && ox < W) {
      grid[oy][ox] = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'][i] ?? '█'
    }
  })

  // Center: 21M seal
  const label = '2 1 M'
  const lx = Math.floor(cx - label.length / 2)
  if (lx >= 0 && cy > 0 && cy < H) {
    label.split('').forEach((c, i) => { if (lx + i < W) grid[Math.floor(cy)][lx + i] = c })
  }

  return [
    '    § V A U L T : : M O N E T A R Y : A U T H O R I T Y    ',
    ...grid.map(r => r.join('')),
    '    S C A R C I T Y · I S · T H E · T H E S I S · 2 1 M    ',
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT — generate art for any agent
// ─────────────────────────────────────────────────────────────────────────────

export type AgentName = 'NOVA' | 'ENKI' | 'CIPHER' | 'VAULT'

export interface AgentArtwork {
  agent: AgentName
  tokenSeed: string
  lines: string[]
  wormChainTip: string
  ts: string
}

export function generateArt(agent: AgentName, wormChainTip: string, tokenId: number): AgentArtwork {
  const tokenSeed = crypto
    .createHash('sha256')
    .update(`${agent}:${wormChainTip}:${tokenId}`)
    .digest('hex')

  const rng = seedRng(tokenSeed)

  let lines: string[]
  switch (agent) {
    case 'NOVA':   lines = novaArt(rng);       break
    case 'ENKI':   lines = enkiArt(rng);       break
    case 'CIPHER': lines = cipherArt(tokenSeed); break
    case 'VAULT':  lines = vaultArt(rng);      break
  }

  return { agent, tokenSeed, lines, wormChainTip, ts: new Date().toISOString() }
}

export function artToSvg(art: AgentArtwork): string {
  const agentColors: Record<AgentName, { bg: string; fg: string; accent: string }> = {
    NOVA:   { bg: '#0a0a1a', fg: '#7eb8f7', accent: '#3a7bd5' },
    ENKI:   { bg: '#050510', fg: '#a78bfa', accent: '#7c3aed' },
    CIPHER: { bg: '#040f04', fg: '#4ade80', accent: '#16a34a' },
    VAULT:  { bg: '#0f0a00', fg: '#fbbf24', accent: '#d97706' },
  }
  const c = agentColors[art.agent]
  const lineH = 16, padX = 12, padY = 20
  const svgH = art.lines.length * lineH + padY * 2
  const svgW = 520

  const textLines = art.lines
    .map((line, i) =>
      `<text x="${padX}" y="${padY + i * lineH}" fill="${c.fg}">${
        line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      }</text>`
    )
    .join('\n    ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" style="background:${c.bg}">
  <defs>
    <style>text { font-family: 'Courier New', monospace; font-size: 11px; white-space: pre; }</style>
  </defs>
  <rect width="100%" height="100%" fill="${c.bg}"/>
  <rect x="2" y="2" width="${svgW-4}" height="${svgH-4}" fill="none" stroke="${c.accent}" stroke-width="1" opacity="0.4"/>
  ${textLines}
  <text x="${padX}" y="${svgH - 6}" fill="${c.accent}" font-size="9">
    WORM:${art.wormChainTip.slice(0, 16)}··  SEED:${art.tokenSeed.slice(0, 16)}··  ${art.ts.slice(0, 10)}
  </text>
</svg>`
}

export function printArt(art: AgentArtwork): void {
  console.log('\n' + '═'.repeat(54))
  art.lines.forEach(l => console.log(l))
  console.log('═'.repeat(54))
  console.log(`SEED: ${art.tokenSeed.slice(0, 32)}...`)
  console.log(`WORM: ${art.wormChainTip.slice(0, 32)}...`)
  console.log()
}
