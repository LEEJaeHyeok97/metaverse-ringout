import { createServer } from 'node:http'
import { attachRealtime } from './realtime.ts'
import { createStaticSite } from './staticSite.ts'

const port = Number(process.env.PORT ?? 8787)
const maxPlayers = Number(process.env.MAX_PLAYERS ?? 100)
// 사이트 도메인을 쉼표로 구분해 넣는다. 비어 있으면 브라우저 접속을 모두 거절한다.
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

const isOriginAllowed = (origin: string | undefined) => origin !== undefined && allowedOrigins.has(origin)

// SITE_DIR가 있으면 웹사이트도 이 서버가 함께 내준다.
const serveSite = process.env.SITE_DIR ? createStaticSite(process.env.SITE_DIR) : null

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ ok: true, players: realtime.playerCount(), rooms: realtime.roomCount() }))
    return
  }
  if (serveSite?.(request, response)) return
  response.writeHead(404).end()
})

const realtime = attachRealtime(server, { path: '/ws', maxPlayers, isOriginAllowed, gardenFile: process.env.GARDEN_FILE })

server.on('upgrade', (request, socket) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost')
  if (pathname !== '/ws') socket.destroy()
})

// 재배포 때 새 접속을 멈추고, 접속자에게 재접속 신호를 보낸 뒤 끝낸다.
const SHUTDOWN_TIMEOUT_MS = 10_000
let shuttingDown = false
const shutdown = () => {
  if (shuttingDown) return
  shuttingDown = true
  setTimeout(() => process.exit(0), SHUTDOWN_TIMEOUT_MS).unref()
  realtime.close()
  server.close(() => process.exit(0))
  server.closeIdleConnections()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

server.listen(port, () => {
  console.log(`ringout world on :${port}, max ${maxPlayers} players, origins: ${[...allowedOrigins].join(', ') || '(none)'}, garden: ${process.env.GARDEN_FILE ?? '(memory)'}`)
})
