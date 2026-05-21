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

export function sealWork(agentName: string, payload: unknown): AgentWorkSeal {
  const timestamp = new Date().toISOString()
  const secret = process.env.WORM_SECRET ?? 'dev-worm-key'
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${agentName}:${timestamp}:${JSON.stringify(payload)}`)
    .digest('hex')
  return { agent: agentName, timestamp, signature }
}

export function sealOutput<T>(agentName: string, payload: T): SealedOutput<T> {
  return { payload, seal: sealWork(agentName, payload) }
}

export function verifySeal(seal: AgentWorkSeal, payload: unknown): boolean {
  const secret = process.env.WORM_SECRET ?? 'dev-worm-key'
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${seal.agent}:${seal.timestamp}:${JSON.stringify(payload)}`)
    .digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(seal.signature, 'hex')
  if (expectedBuf.length !== actualBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}
