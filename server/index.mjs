import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { recordApi } from './record-api.mjs';
import { currentRecords, syncRecords } from './record-store.mjs';
import { listCases, getCase, getIndex, getTrace } from './catalog.mjs';
import { scenePages } from '../frontend/scene-routes.js';

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
  ['/trace-map.js', ['trace-map.js', 'text/javascript;charset=utf-8']],
  ['/PRD.docx', ['../docs/PRD.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
  ['/ui.js', ['ui.js', 'text/javascript;charset=utf-8']],
  ['/analysis-views.js', ['analysis-views.js', 'text/javascript;charset=utf-8']],
  ['/analysis-model.js', ['analysis-model.js', 'text/javascript;charset=utf-8']],
  ['/unidata-logo-color.jpg', ['unidata-logo-color.jpg', 'image/jpeg']],
  ['/unidata-logo-white.png', ['unidata-logo-white.png', 'image/png']],
  ['/score-trend-model.js', ['score-trend-model.js', 'text/javascript;charset=utf-8']],
  ['/score-trend.js', ['score-trend.js', 'text/javascript;charset=utf-8']],
  ['/resilience-model.js', ['resilience-model.js', 'text/javascript;charset=utf-8']],
  ['/resilience-view.js', ['resilience-view.js', 'text/javascript;charset=utf-8']],
  ['/indicator-workspace.js', ['indicator-workspace.js', 'text/javascript;charset=utf-8']],
  ['/record-editor.js', ['record-editor.js', 'text/javascript;charset=utf-8']],
  ['/record-schema.js', ['record-schema.js', 'text/javascript;charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript;charset=utf-8']],
  ['/scene-app.js', ['scene-app.js', 'text/javascript;charset=utf-8']],
  ['/scene-routes.js', ['scene-routes.js', 'text/javascript;charset=utf-8']],
  ['/legacy-scene.js', ['legacy-scene.js', 'text/javascript;charset=utf-8']]
]);

const directoryPaths = new Set();
for (const { path } of Object.values(scenePages)) {
  directoryPaths.add('/' + path);
  const index = [path + 'index.html', 'text/html;charset=utf-8'];
  files.set('/' + path, index);
  files.set('/' + path + 'index.html', index);
}

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
  if (pathname === '/api/records' && req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '600'
    });
    return res.end();
  }
  if (pathname === '/api/records' && ['GET', 'POST', 'PUT'].includes(req.method)) {
    res.setHeader('Cache-Control', 'no-store');
    return recordApi(req, new URLSearchParams(req.url?.split('?')[1]), send);
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(405, { error: '仅支持 GET' });
  }
  try {
    const query = new URLSearchParams(req.url?.split('?')[1]);
    if (pathname === '/api/health') return send(200, { status: 'ok' });
    if (pathname === '/api/map-config') {
      // The JS key is public. Its security code stays on the proxy.
      const key = process.env.AMAP_WEB_KEY;
      const configured = Boolean(key && process.env.AMAP_SECURITY_CODE);
      return send(200, configured ? { key, servicePath: '/_AMapService' } : { key: null });
    }
    if (pathname === '/api/index') {
      await syncRecords();
      const value = getIndex(query.get('case'), query.get('period'), query.get('part'), currentRecords());
      return value ? send(200, value) : send(404, { error: '案例、期次或部件不存在' });
    }
    if (pathname.startsWith('/_AMapService/')) {
      const securityCode = process.env.AMAP_SECURITY_CODE;
      if (!securityCode || !process.env.AMAP_WEB_KEY) return send(503, { error: '地图尚未配置' });
      const path = pathname.slice('/_AMapService'.length);
      if (path !== '/v3/vst' && path !== '/v4/map/styles') {
        return send(404, { error: '地图服务不存在' });
      }
      const host = path === '/v4/map/styles' ? 'webapi.amap.com' : 'restapi.amap.com';
      const target = new URL('https://' + host + path);
      target.search = query.toString();
      target.searchParams.set('key', process.env.AMAP_WEB_KEY);
      target.searchParams.set('jscode', securityCode);
      const result = await fetch(target, { signal: AbortSignal.timeout(6500), redirect: 'error' });
      res.writeHead(result.status, { 'Content-Type': result.headers.get('content-type') || 'application/json' });
      return res.end(Buffer.from(await result.arrayBuffer()));
    }
    if (pathname === '/api/cases') return send(200, listCases());
    const route = /^\/api\/cases\/([a-z0-9-]+)(?:\/trace)?$/.exec(pathname);
    if (route) {
      await syncRecords();
      const value = pathname.endsWith('/trace')
        ? getTrace(route[1], query.get('part'), query.get('period'), currentRecords())
        : getCase(route[1], query.get('period'), currentRecords());
      return value ? send(200, value) : send(404, { error: '案例、期次或部件不存在' });
    }
    if (directoryPaths.has(pathname + '/')) {
      res.writeHead(308, { Location: pathname + '/' + (query.size ? '?' + query : '') });
      return res.end();
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
