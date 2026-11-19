let sdk;
let map;
let mapOverlays = [];
let revision = 0;
let outlines;
let extentId;
let controls;
let gestures;
const toolbar = document.getElementById('map-controls');
const zoomOutput = document.getElementById('map-zoom');
const fallback = { zoom: 1, x: 0, y: 0 };
function resetFallback() { Object.assign(fallback, { zoom: 1, x: 0, y: 0 }); }
export function fitTraceMap() { controls?.fit(); }
document.getElementById('trace-zoom-in').onclick = () => controls?.zoom(1);
document.getElementById('trace-zoom-out').onclick = () => controls?.zoom(-1);
document.getElementById('trace-fit').onclick = fitTraceMap;
function cities(nodes, selected) {
  const grouped = new Map();
  for (const node of nodes) {
    const key = node.position.join(',');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(node);
  }
  return Array.from(grouped.values(), items => {
    const index = items.findIndex(node => node.id === selected);
    return { node: items[Math.max(0,index)], next: items[(index+1)%items.length].id, count: items.length };
  });
}
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

function markerLabel(node, count, next) {
  const content = document.createElement('button');
  content.type = 'button';
  content.dataset.node = next;
  content.setAttribute('aria-label', '查看' + node.city + '供应节点');
  content.className = 'amap-trace-pin';
  content.style.background = tierColors[node.tier];
  content.textContent = node.city + ' · ' + (count > 1 ? count + ' 个节点' : node.tier ? 'T' + node.tier : '整机');
  return content;
}

export function clearTraceMap(container) {
  revision++;
  gestures?.abort();
  extentId = undefined;
  controls = null; toolbar.hidden = true;
  resetFallback();
  if (map && mapOverlays.length) map.remove(mapOverlays);
  mapOverlays = [];
  container.hidden = true;
  if (!map && !mapOpening) container.replaceChildren();
}

export async function renderTraceMap({ api, container, status, graph, nodes, edges, selected, onSelect }) {
  const current = ++revision;
  const key = JSON.stringify(nodes.filter(n => n.position).map(n => [n.id,n.position]));
  const changed = key !== extentId;
  if (changed) resetFallback();
  extentId = key;
  if (!nodes.length || !nodes.some(node => node.position)) {
    gestures?.abort(); controls = null; toolbar.hidden = true;
    container.hidden = true;
    graph.hidden = false;
    status.textContent = nodes.length ? '当前筛选范围内的企业未披露城市点位。' : '';
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
        mapStyle: 'amap://styles/whitesmoke', scrollWheel: true, zoomEnable: true, touchZoom: true, dragEnable: true, zooms: [3,18]
      });
      mapOpening = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('高德底图加载超时')), 8000);
        initialMap.on('complete', () => { clearTimeout(timer); resolve(); });
        initialMap.on('error', () => { clearTimeout(timer); reject(new Error('高德地图服务返回错误')); });
      }).then(() => {
        map = initialMap;
        map.on('zoomchange', () => { zoomOutput.value = Number(map.getZoom()).toFixed(1) + ' 级'; });
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
    const markers = cities(indexed.values(), selected).map(({node, next, count}) => {
      const marker = new AMap.Marker({
        position: node.position, content: markerLabel(node, count, next),
        anchor: 'center', zIndex: node.id === selected ? 120 : 100
      });
      return marker;
    });
    mapOverlays = [...lines, ...markers];
    map.add(mapOverlays);
    const fit = () => map.setFitView(mapOverlays, true, [48,60,48,60], 10);
    controls = { fit, zoom: steps => map.setZoom(Math.max(3, Math.min(18, map.getZoom()+steps)), true) };
    bindMapInteractions(container, onSelect);
    toolbar.hidden = false;
    if (changed || !container.dataset.loaded) fit();
    container.dataset.loaded = 'yes';
    zoomOutput.value = Number(map.getZoom()).toFixed(1) + ' 级';
    graph.hidden = false;
    graph.classList.add('map-index');
    status.textContent = '高德底图 · 滚轮或双指缩放，拖动平移。同城多个节点可连续点选。';
  } catch (error) {
    if (current !== revision) return;
    graph.hidden = false;
    status.textContent = error.message + '。可从节点详情在高德查看城市。';
    const draw = () => drawCityOverview(container, nodes, edges, selected, onSelect, current);
    const drawn = await draw();
    if (current !== revision) return;
    container.hidden = !drawn;
    graph.classList.toggle('map-index', drawn);
    toolbar.hidden = !drawn;
    if (drawn) {
      status.textContent = '城市分布底图 · 可缩放、平移和点选企业。';
      bindFallback(container, draw);
    }
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
  const scale = fallback.zoom * Math.min((width - 90) / Math.max(2, Math.max(...xs) - Math.min(...xs)),
    (height - 78) / Math.max(2, Math.max(...ys) - Math.min(...ys)));
  const project = ([lng, lat]) => [(lng-midpoint[0])*scale+width/2+fallback.x, (midpoint[1]-lat)*scale+height/2+fallback.y];
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
  const labels = cities(located, selected).map(({node, next, count}) => {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'city-map-pin';
    marker.style.background = tierColors[node.tier];
    const [x,y] = points.get(node.id);
    marker.style.left = (x/width*100) + '%';
    marker.style.top = (y/height*100) + '%';
    marker.textContent = node.city + (count > 1 ? ' · ' + count : '');
    marker.setAttribute('aria-label', node.city + ' · ' + node.label);
    marker.setAttribute('aria-pressed', String(node.id === selected));
    marker.addEventListener('click', () => onSelect(next));
    return marker;
  });
  zoomOutput.value = Math.round(fallback.zoom*100) + '%';
  container.replaceChildren(canvas, ...labels);
  return true;
}

function bindMapInteractions(container, onSelect) {
  gestures?.abort();
  gestures = new AbortController();
  const frame = container.parentElement;
  const options = { signal: gestures.signal, capture: true };
  let pressed;
  let wheelDelta = 0;
  const pin = e => e.target.closest?.('.amap-trace-pin');
  frame.addEventListener('pointerdown', e => {
    const target = pin(e);
    pressed = target ? { id:target.dataset.node, x:e.clientX, y:e.clientY } : null;
  }, options);
  frame.addEventListener('pointerup', e => {
    if (pressed && pin(e)?.dataset.node === pressed.id && Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)<7) {
      const id = pressed.id;
      pressed = null;
      onSelect(id);
    }
  }, options);
  frame.addEventListener('click', e => {
    const target = pin(e);
    if (target && e.detail===0) onSelect(target.dataset.node);
  }, options);
  frame.addEventListener('wheel', e => {
    if (!container.contains(e.target) || !e.deltaY) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY * (e.deltaMode===1 ? 16 : e.deltaMode===2 ? container.clientHeight : 1);
    wheelDelta = Math.sign(delta) === Math.sign(wheelDelta) ? wheelDelta + delta : delta;
    if (Math.abs(wheelDelta) >= 35) {
      controls.zoom(-Math.sign(wheelDelta));
      wheelDelta = 0;
    }
  }, { ...options, passive:false });
}

function bindFallback(container, draw) {
  gestures?.abort();
  gestures = new AbortController();
  const signal = gestures.signal;
  const pointers = new Map();
  const rescale = (factor, x=0, y=0) => {
    const zoom = Math.max(.5, Math.min(12, fallback.zoom*factor));
    const ratio = zoom/fallback.zoom;
    fallback.x = x-(x-fallback.x)*ratio;
    fallback.y = y-(y-fallback.y)*ratio;
    fallback.zoom = zoom;
    draw();
  };
  const relative = (x,y) => {
    const r = container.getBoundingClientRect();
    return [x-r.left-r.width/2,y-r.top-r.height/2];
  };
  controls = { zoom: steps => rescale(1.3 ** steps), fit: () => { resetFallback(); draw(); } };
  container.addEventListener('wheel', e => {
    e.preventDefault();
    rescale(e.deltaY<0 ? 1.15 : 1/1.15, ...relative(e.clientX,e.clientY));
  }, { passive:false, signal });
  container.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    container.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,[e.clientX,e.clientY]);
  }, { signal });
  container.addEventListener('pointermove', e => {
    const prev=pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId,[e.clientX,e.clientY]);
    if (pointers.size===1) {
      fallback.x += e.clientX-prev[0]; fallback.y += e.clientY-prev[1]; draw();
    } else if (pointers.size===2) {
      const [,other]=Array.from(pointers).find(([id])=>id!==e.pointerId);
      const before=Math.hypot(prev[0]-other[0],prev[1]-other[1]);
      if (before>0) rescale(Math.hypot(e.clientX-other[0],e.clientY-other[1])/before,
        ...relative((e.clientX+other[0])/2,(e.clientY+other[1])/2));
    }
  }, { signal });
  for (const type of ['pointerup','pointercancel','lostpointercapture'])
    container.addEventListener(type,e=>pointers.delete(e.pointerId),{signal});
}
