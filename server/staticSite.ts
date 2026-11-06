import { createReadStream, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/** 빌드한 웹사이트를 그대로 내준다. 화면 이동은 # 주소라 없는 경로는 404로 둔다. */
export function createStaticSite(directory: string) {
  const root = resolve(directory)

  return (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return false
    let pathname: string
    try {
      pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    } catch {
      return false
    }
    const file = resolve(join(root, normalize(pathname === '/' ? 'index.html' : pathname)))
    if (file !== root && !file.startsWith(root + sep)) return false
    const type = TYPES[extname(file)]
    if (!type) return false
    try {
      if (!statSync(file).isFile()) return false
    } catch {
      return false
    }
    response.writeHead(200, {
      'Content-Type': type,
      // 빌드 파일 이름에 내용 해시가 붙으므로 오래 저장하고, 첫 화면만 매번 확인한다.
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    })
    if (request.method === 'HEAD') response.end()
    else createReadStream(file).on('error', () => response.destroy()).pipe(response)
    return true
  }
}
