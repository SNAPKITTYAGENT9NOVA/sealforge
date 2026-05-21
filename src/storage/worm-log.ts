import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface WormEntry {
  id: string
  receivedAt: string
  type: string
  payload: unknown
  chainHash: string
}

export class WormLog {
  private filePath: string
  private secret: string
  private chainTip: string = 'GENESIS'

  constructor(dataDir: string = './data') {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    this.filePath = path.join(dataDir, 'sealforge.worm.jsonl')
    const secret = process.env.WORM_SECRET
    if (!secret || secret.length < 32) throw new Error('[WORM] WORM_SECRET must be set and at least 32 characters')
    this.secret = secret
    this.loadChainTip()
  }

  private loadChainTip(): void {
    if (!fs.existsSync(this.filePath)) return
    const lines = fs.readFileSync(this.filePath, 'utf8').trim().split('\n').filter(Boolean)
    if (lines.length > 0) {
      const last = JSON.parse(lines[lines.length - 1]) as WormEntry
      this.chainTip = last.chainHash
      console.log(`[WORM] Chain loaded — ${lines.length} entries — tip: ${this.chainTip.slice(0, 16)}...`)
    }
  }

  private computeHash(id: string, receivedAt: string, bodyRaw: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(`${this.chainTip}:${id}:${receivedAt}:${bodyRaw}`)
      .digest('hex')
  }

  append(type: string, payload: unknown): WormEntry {
    const id = uuidv4()
    const receivedAt = new Date().toISOString()
    const bodyRaw = JSON.stringify(payload)
    const chainHash = this.computeHash(id, receivedAt, bodyRaw)
    const entry: WormEntry = { id, receivedAt, type, payload, chainHash }
    fs.appendFileSync(this.filePath, JSON.stringify(entry) + '\n')
    this.chainTip = chainHash
    return entry
  }

  getAll(limit = 100, offset = 0): { entries: WormEntry[]; chainValid: boolean } {
    if (!fs.existsSync(this.filePath)) return { entries: [], chainValid: true }
    const lines = fs.readFileSync(this.filePath, 'utf8').trim().split('\n').filter(Boolean)
    const entries = lines.slice(offset, offset + limit).map(l => JSON.parse(l) as WormEntry)
    return { entries, chainValid: this.verifyChain() }
  }

  getById(id: string): WormEntry | null {
    if (!fs.existsSync(this.filePath)) return null
    const lines = fs.readFileSync(this.filePath, 'utf8').trim().split('\n').filter(Boolean)
    for (const line of lines) {
      const entry = JSON.parse(line) as WormEntry
      if (entry.id === id) return entry
    }
    return null
  }

  verifyChain(): boolean {
    if (!fs.existsSync(this.filePath)) return true
    const lines = fs.readFileSync(this.filePath, 'utf8').trim().split('\n').filter(Boolean)
    let prev = 'GENESIS'
    for (const line of lines) {
      const entry = JSON.parse(line) as WormEntry
      const expected = crypto
        .createHmac('sha256', this.secret)
        .update(`${prev}:${entry.id}:${entry.receivedAt}:${JSON.stringify(entry.payload)}`)
        .digest('hex')
      if (expected !== entry.chainHash) return false
      prev = entry.chainHash
    }
    return true
  }

  tip(): string {
    return this.chainTip
  }
}
