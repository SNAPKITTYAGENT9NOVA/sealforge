import * as crypto from 'crypto'

export interface AgentWorkSeal {
  agent: string
  timestamp: string
  signature: string
}

export interface SealedOutput<T> {
  payload: T
  seal: AgentWorkSeal
}

function requireSecret(): string {
  const s = process.env.WORM_SECRET
  if (!s || s.length < 32) throw new Error('[SEAL] WORM_SECRET must be set and at least 32 characters')
  return s
}

export function sealWork(agentName: string, payload: unknown): AgentWorkSeal {
  const timestamp = new Date().toISOString()
  const secret = requireSecret()
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${agentName}:${timestamp}:${JSON.stringify(payload)}`)
    .digest('hex')
  return { agent: agentName, timestamp, signature }
}

export function sealOutput<T>(agentName: string, payload: T): SealedOutput<T> {
  return { payload, seal: sealWork(agentName, payload) }
}

export function verifySeal(seal: AgentWorkSeal, payload: unknown, maxAgeMs = 300_000): boolean {
  const secret = requireSecret()
  const age = Date.now() - new Date(seal.timestamp).getTime()
  if (age > maxAgeMs) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${seal.agent}:${seal.timestamp}:${JSON.stringify(payload)}`)
    .digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(seal.signature, 'hex')
  if (expectedBuf.length !== actualBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}
