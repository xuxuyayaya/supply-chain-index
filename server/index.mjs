import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { listCases, getCase, getTrace } from './catalog.mjs';

const files = new Map([
  ['/', ['index.html', 'text/html;charset=utf-8']],
  ['/index.html', ['index.html', 'text/html;charset=utf-8']],
  ['/supply-index.html', ['supply-index.html', 'text/html;charset=utf-8']],
  ['/portal.css', ['portal.css', 'text/css;charset=utf-8']],
  ['/portal.js', ['portal.js', 'text/javascript;charset=utf-8']],
  ['/scene.css', ['scene.css', 'text/css;charset=utf-8']],
  ['/regions.json', ['regions.json', 'application/json;charset=utf-8']],
  ['/logistics-hero.webp', ['logistics-hero.webp', 'image/webp']],
  ['/style.css', ['style.css', 'text/css;charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript;charset=utf-8']]
]);

export const server = createServer(async (req, res) => {
  const pathname = req.url?.split('?')[0] ?? '/';
  const origin = req.headers.origin;
  if (origin === 'https://xuxuyayaya.github.io') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json;charset=utf-8' });
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(405, { error: '仅支持 GET' });
  }
  try {
    const query = new URLSearchParams(req.url?.split('?')[1]);
    if (pathname === '/api/health') return send(200, { status: 'ok' });
    if (pathname === '/api/cases') return send(200, listCases());
    const route = /^\/api\/cases\/([a-z0-9-]+)(?:\/trace)?$/.exec(pathname);
    if (route) {
      const value = pathname.endsWith('/trace')
        ? getTrace(route[1], query.get('part'))
        : getCase(route[1], query.get('period'));
      return value ? send(200, value) : send(404, { error: '案例、期次或部件不存在' });
    }
    const file = files.get(pathname);
    if (!file) return send(404, { error: '页面不存在' });
    const body = await readFile(new URL('../frontend/' + file[0], import.meta.url));
    res.writeHead(200, { 'Content-Type': file[1] });
    res.end(body);
  } catch {
    send(500, { error: '服务暂不可用' });
  }
});

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => console.log('Listening on ' + port));
  process.on('SIGTERM', () => server.close());
}
