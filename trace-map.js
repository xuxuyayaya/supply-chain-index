let sdk;
let map;
let mapOverlays = [];
let revision = 0;
let outlines;
let mapOpening;
const tierColors = ['#222a35', '#a32a3b', '#b47831', '#527064'];

async function getSdk(api) {
  if (!sdk) {
    sdk = (async () => {
      const response = await fetch(api + '/api/map-config', { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error('无法读取地图配置');
      const config = await response.json();
      if (!config.key) throw new Error('高德 JS API 尚未配置');
      window._AMapSecurityConfig = {
        serviceHost: new URL(api + config.servicePath, location.href).href
      };
      const script = document.createElement('script');
      const url = new URL('https://webapi.amap.com/maps');
      url.searchParams.set('v', '2.0');
      url.searchParams.set('key', config.key);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          script.remove();
          reject(new Error('高德地图脚本加载超时'));
        }, 7000);
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => { clearTimeout(timer); reject(new Error('高德地图脚本加载失败')); };
        script.src = url.href;
        document.head.append(script);
      });
      if (!window.AMap?.Map) throw new Error('高德地图不可用');
      return window.AMap;
    })().catch(error => {
      if (error.message !== '高德 JS API 尚未配置') sdk = undefined;
      throw error;
    });
  }
  return sdk;
}

function markerLabel(node) {
  const content = document.createElement('span');
  content.className = 'amap-trace-pin';
  content.style.background = tierColors[node.tier];
  content.textContent = node.city + ' · ' + (node.tier ? 'T' + node.tier : '整机');
  return content;
}

export function clearTraceMap(container) {
  revision++;
  if (map && mapOverlays.length) map.remove(mapOverlays);
  mapOverlays = [];
  container.hidden = true;
  if (!map && !mapOpening) container.replaceChildren();
}

export async function renderTraceMap({ api, container, status, graph, nodes, edges, selected, onSelect }) {
  const current = ++revision;
  if (!nodes.length) {
    container.hidden = true;
    graph.hidden = false;
    status.textContent = '';
    if (map && mapOverlays.length) map.remove(mapOverlays);
    mapOverlays = [];
    return;
  }
  if (!map) status.textContent = '正在读取地图服务…';
  try {
    const AMap = await getSdk(api);
    if (current !== revision) return;
    const indexed = new Map(nodes.filter(node => node.position).map(node => [node.id, node]));
    if (!indexed.size) throw new Error('当前节点没有已定位城市');
    container.hidden = false;
    if (!map && !mapOpening) {
      container.replaceChildren();
      const initialMap = new AMap.Map(container, {
        center: indexed.values().next().value.position, zoom: 6, viewMode: '2D',
        mapStyle: 'amap://styles/whitesmoke', scrollWheel: false
      });
      mapOpening = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('高德底图加载超时')), 8000);
        initialMap.on('complete', () => { clearTimeout(timer); resolve(); });
        initialMap.on('error', () => { clearTimeout(timer); reject(new Error('高德地图服务返回错误')); });
      }).then(() => {
        map = initialMap;
      }).catch(error => {
        initialMap.destroy();
        throw error;
      }).finally(() => {
        mapOpening = undefined;
      });
    }
    if (mapOpening) await mapOpening;
    if (current !== revision) return;
    if (mapOverlays.length) map.remove(mapOverlays);
    const lines = edges.filter(edge => indexed.has(edge.from) && indexed.has(edge.to)).map(edge =>
      new AMap.Polyline({
        path: [indexed.get(edge.from).position, indexed.get(edge.to).position],
        strokeColor: edge.status === 'association' ? '#b37a38' : '#8f2738',
        strokeWeight: selected && ![edge.from, edge.to].includes(selected) ? 2 : 4,
        strokeOpacity: selected && ![edge.from, edge.to].includes(selected) ? .35 : .88,
        strokeStyle: edge.status === 'association' ? 'dashed' : 'solid', showDir: true
      }));
    const markers = Array.from(indexed.values(), node => {
      const marker = new AMap.Marker({
        position: node.position, content: markerLabel(node),
        anchor: 'center', zIndex: node.id === selected ? 120 : 100
      });
      marker.on('click', () => onSelect(node.id));
      return marker;
    });
    mapOverlays = [...lines, ...markers];
    map.add(mapOverlays);
    if (!selected) map.setFitView(mapOverlays, false, [45,55,45,55], 10);
    graph.hidden = false;
    graph.classList.add('map-index');
    status.textContent = '高德底图 · 城市点位与供货关系示意。';
  } catch (error) {
    if (current !== revision) return;
    graph.hidden = false;
    status.textContent = error.message + '。可从节点详情在高德查看城市。';
    const drawn = await drawCityOverview(container, nodes, edges, selected, onSelect, current);
    if (current !== revision) return;
    container.hidden = !drawn;
    graph.classList.toggle('map-index', drawn);
    if (drawn) status.textContent += ' 当前为城市分布示意。';
  }
}

async function drawCityOverview(container, nodes, edges, selected, onSelect, current) {
  const located = nodes.filter(node => node.position);
  if (!located.length) return false;
  if (!outlines) outlines = fetch('./regions.json').then(response => response.ok ? response.json() : []).catch(() => []);
  const boundaries = await outlines;
  if (current !== revision) return false;
  container.hidden = false;
  const width = container.clientWidth || 650;
  const height = container.clientHeight || 330;
  const xs = located.map(node => node.position[0]);
  const ys = located.map(node => node.position[1]);
  const midpoint = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const scale = Math.min((width - 90) / Math.max(2, Math.max(...xs) - Math.min(...xs)),
    (height - 78) / Math.max(2, Math.max(...ys) - Math.min(...ys)));
  const project = ([lng, lat]) => [(lng-midpoint[0])*scale+width/2, (midpoint[1]-lat)*scale+height/2];
  const canvas = document.createElement('canvas');
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.scale(ratio, ratio);
  ctx.fillStyle = '#ebe5db';
  ctx.strokeStyle = '#cfbda9';
  for (const [, rings] of boundaries) {
    ctx.beginPath();
    for (const ring of rings) {
      ring.forEach((point, i) => i ? ctx.lineTo(...project(point)) : ctx.moveTo(...project(point)));
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }
  const points = new Map(located.map(node => [node.id, project(node.position)]));
  for (const edge of edges) {
    const from = points.get(edge.from);
    const to = points.get(edge.to);
    if (!from || !to) continue;
    ctx.beginPath();
    ctx.setLineDash(edge.status === 'association' ? [5,4] : []);
    ctx.strokeStyle = edge.status === 'association' ? '#ab7a3c' : '#9b3443';
    ctx.lineWidth = 2;
    ctx.moveTo(...from);
    ctx.lineTo(...to);
    ctx.stroke();
  }
  const labels = located.map(node => {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'city-map-pin';
    marker.style.background = tierColors[node.tier];
    const [x,y] = points.get(node.id);
    marker.style.left = (x/width*100) + '%';
    marker.style.top = (y/height*100) + '%';
    marker.textContent = node.city;
    marker.setAttribute('aria-label', node.city + ' · ' + node.label);
    marker.setAttribute('aria-pressed', String(node.id === selected));
    marker.addEventListener('click', () => onSelect(node.id));
    return marker;
  });
  container.replaceChildren(canvas, ...labels);
  return true;
}
