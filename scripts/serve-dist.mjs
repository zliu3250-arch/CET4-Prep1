import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const HOST = '127.0.0.1';
const BASE_PORT = 4173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.error('[错误] 未找到 dist/index.html，请先在项目目录执行 npm run build。');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const rawUrl = req.url || '/';

  // 透明代理真题在线听力 HLS 音频流，解决浏览器 CORS 限制
  if (rawUrl.startsWith('/hls-proxy/')) {
    const rawPath = rawUrl.slice('/hls-proxy'.length).split('?')[0];
    const normalizedPath = path.posix.normalize(rawPath);
    if (!normalizedPath.startsWith('/cet4/') || normalizedPath.includes('..')) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden proxy path');
      return;
    }
    const targetUrl = `https://listening.lazynote.cn${normalizedPath}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const upstream = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://english-exam.lazynote.cn/',
        },
      });
      if (!upstream.ok) {
        res.writeHead(upstream.status, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Upstream HTTP ${upstream.status}`);
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      const contentType =
        upstream.headers.get('content-type') ||
        (normalizedPath.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t');
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': normalizedPath.endsWith('.ts') ? 'public, max-age=86400' : 'public, max-age=600',
      });
      res.end(buf);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Audio proxy error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }
    return;
  }

  let urlPath = '/';
  try {
    urlPath = decodeURIComponent(rawUrl.split('?')[0]);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }
  const safeRelative = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  let filePath = path.join(DIST_DIR, safeRelative || 'index.html');

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const noCache =
    ext === '.html' || ext === '.json' || baseName === 'sw.js' || baseName === 'registerSW.js';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': noCache ? 'no-store, no-cache, must-revalidate' : 'public, max-age=3600',
  });
  fs.createReadStream(filePath).pipe(res);
});

function startListening(port) {
  const onError = (err) => {
    server.removeListener('listening', onListening);
    if (err && err.code === 'EADDRINUSE' && port < BASE_PORT + 20) {
      startListening(port + 1);
      return;
    }
    console.error('[错误] 本地服务启动失败：', err.message);
    process.exit(1);
  };

  const onListening = () => {
    server.removeListener('error', onError);
    const url = `http://${HOST}:${port}/`;
    console.log(`  CET4-Prep 已就绪：${url}`);
    console.log('  正在自动打开浏览器...（关闭本窗口即可停止服务）\n');
    if (process.platform === 'win32' && !process.env.NO_OPEN) {
      exec(`start "" "${url}"`);
    }
  };

  server.once('error', onError);
  server.once('listening', onListening);
  server.listen({ port, host: HOST, exclusive: true });
}

startListening(BASE_PORT);
