import * as http from 'http'
import { WormLog } from './storage/worm-log'
import { sealOutput } from './agent/seal'

export const worm = new WormLog(process.env.DATA_DIR ?? './data')

const PORT = parseInt(process.env.PORT ?? '3000', 10)

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(payload)
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { status: 'ok', tip: worm.tip(), ts: new Date().toISOString() })
  }

  if (req.method === 'GET' && url.pathname === '/chain/verify') {
    const valid = worm.verifyChain()
    return json(res, 200, sealOutput('SEALFORGE_CORE', { chainValid: valid, tip: worm.tip() }))
  }

  if (req.method === 'POST' && url.pathname === '/events') {
    try {
      const raw = await readBody(req)
      const payload = raw ? JSON.parse(raw) : {}
      const entry = worm.append('event', payload)
      return json(res, 201, entry)
    } catch {
      return json(res, 400, { error: 'invalid_json' })
    }
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    const limit = parseInt(url.searchParams.get('limit') ?? '100', 10)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)
    return json(res, 200, worm.getAll(limit, offset))
  }

  json(res, 404, { error: 'not_found' })
})

export function startServer(): void {
  server.listen(PORT, () => {
    console.log(`[SEALFORGE] Running on port ${PORT}`)
  })
}
