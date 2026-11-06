import type { Server } from 'node:http'
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { attachRealtime, isLocalOrigin } from './server/realtime.ts'

/** `npm run dev`와 `npm run preview` 하나로 실시간 서버까지 함께 띄운다. */
function realtimePlugin(): Plugin {
  const attach = (server: PreviewServer | ViteDevServer) => {
    if (!server.httpServer) return
    attachRealtime(server.httpServer as Server, { path: '/ws', maxPlayers: 100, isOriginAllowed: isLocalOrigin, gardenFile: '.data/garden.json' })
  }
  return {
    name: 'ringout-realtime',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), realtimePlugin()],
  server: {
    port: 5175,
    strictPort: true,
  },
})
