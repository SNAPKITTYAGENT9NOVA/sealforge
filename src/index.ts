import { startServer, worm } from './server'

startServer()

worm.append('lifecycle', { event: 'server_start', version: '0.1.0', ts: new Date().toISOString() })

function shutdown(signal: string): void {
  console.log(`[SEALFORGE] ${signal} received — sealing shutdown`)
  worm.append('lifecycle', { event: 'server_stop', signal, ts: new Date().toISOString() })
  const timer = setTimeout(() => process.exit(1), 10_000)
  timer.unref()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
