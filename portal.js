const titles = [
  ['数字物流网络', '让货流、通道与产业协同', '从全国网络到区域节点，以通道组织、平台协同和产业分析支撑物流决策。'],
  ['平台产品', '让物流数据服务业务决策', '汇聚通道、节点与产业数据，支持运行观察和供应分析。'],
  ['SCENARIO', '在枢纽、口岸与多式联运场景中验证方案有效性', '连接货源、运输与产业配套，沿业务路径进入区域物流应用。']
];
const layers = [
  ['交通基础设施网', '按省域观察物流节点与跨区域联系。'],
  ['物流通道网', '查看主要节点间的跨区域通道组织示意。'],
  ['数字物流网', '从节点和通道延伸至面向区域的平台协同。']
];
const catalog = {
  plans: [
    ['江西物流一张网建设方案','串联省、市、枢纽三级节点，汇总干线和支线运力。','网络建设','汇总枢纽名录、干线班期和货源分布，形成省级通道清单。'],
    ['多式联运通道建设方案','衔接公铁水运输与口岸换装作业。','通道组织','将船期、班列时刻与车辆到站窗口配对，识别等待时间。'],
    ['数字物流网总体建设方案','将基础设施、物流通道和数字平台纳入区域规划。','网络建设','按层梳理存量设施、服务半径和数据接入责任。'],
    ['区域物流大数据平台建设方案','统一运单、企业及场站基础数据。','平台建设','建立数据目录、交换频次和质量检查规则。'],
    ['国家与区域平台协同方案','打通区域平台之间的单证与事件交换。','平台建设','对齐平台标识、节点编码、到发事件与回执。']
  ],
  products: [
    ['区域物流平台规划咨询服务','形成区域物流现状评估与平台建设路线。','平台规划','结合枢纽访谈和货流数据，输出需求、分期范围与验收指标。'],
    ['区域物流大数据平台','汇集区域货流、通道和运输节点信息。','平台建设','以统一地理标识查询节点能力、流量和通道负荷。'],
    ['物流数据治理与数据产品服务','把采购、运输、到货记录转成可比的业务指标。','数据产品','维护指标口径、数据来源和校验结果，可进入产业链供应分析。','./chain/'],
    ['物流 AI 智能应用','围绕运单、异常事件与路线形成查询和研判结果。','应用服务','按业务问题调取运单与异常记录，并保留原始记录入口。']
  ],
  scenarios: [
    ['产业链供应分析指数','评价城市产业链的供应能力，查看评分依据与上游企业。','产业链协同','','./chain/'],
    ['多式联运全链路可视','关联提单、铁路运单与公路短驳，逐段核对运输状态。','数字枢纽','按提箱、进站、发车、到港和签收的时间比对计划。'],
    ['物流运营分析决策','按节点比较货流、运力和拥堵时段。','数字枢纽','把高峰运量与仓储、装卸能力配对，定位积压环节。'],
    ['枢纽物流运行监测','观察到发货量、在场车辆与作业负荷。','数字枢纽','从枢纽下钻到场站，按时段查看到发差和等待情况。'],
    ['汽车零部件公铁水公联运协同','衔接汽车零部件集货、干线换装和到厂配送。','跨区域协同','按供应计划校对班列与船期，对临期到货安排接驳。'],
    ['进口铁矿石公铁水联运协同','把港口卸货、堆场存量与钢厂需求衔接起来。','跨区域协同','结合船舶到港、铁路运能和库存，编排疏港计划。'],
    ['整车出海一体协同','贯通整车出厂、口岸集港与装船交付。','跨区域协同','跟踪车架号对应的集港、查验及装船节点。'],
    ['关键部件供应追溯','从整机配套逐层查看总成、部件和材料企业。','产业链协同','','./chain/trace/?case=kaifeng-auto'],
    ['区域通道组织','查看省域枢纽与跨区域干线的连接。','跨区域协同','','#architecture']
  ]
};
let sector = '全部';
let openTab = 'scenarios';
const layerFacts = [
  ['基础节点','铁路货站、港区、公路货运枢纽','观察重点','节点区位与集疏运条件'],
  ['通道组织','干线运输、枢纽换装、末端接驳','观察重点','班期衔接与跨区域连接'],
  ['平台服务','运单交换、节点监测、产业评价','观察重点','城市产业链配套与供应风险']
];

const byId = id => document.getElementById(id);
let slide = 0;
let layer = 0;
let zoom = 1;
let data = [];
let hitAreas = [];
let panX = 0, panY = 0;
const touches = new Map();
let moved = false;
const canvas = byId('network-map');
const ctx = canvas.getContext('2d');

function toggle(selector, attr, value) {
  document.querySelectorAll(selector).forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset[attr] === String(value)));
  });
}

function showSlide(index) {
  slide = (index + titles.length) % titles.length;
  const [label, title, copy] = titles[slide];
  byId('hero-label').textContent = label;
  byId('hero-title').textContent = title;
  byId('hero-copy').textContent = copy;
  toggle('[data-slide]', 'slide', slide);
}

function showCatalog(key) {
  openTab = key;
  const filters = byId('sector-filters');
  filters.replaceChildren();
  if (key === 'scenarios') {
    for (const label of ['全部', '数字枢纽', '产业链协同', '跨区域协同']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label + ' ' + catalog[key].filter(row => label === '全部' || row[2] === label).length;
      button.setAttribute('aria-pressed', String(sector === label));
      button.onclick = () => { sector = label; showCatalog(key); };
      filters.append(button);
    }
  }
  const cards = catalog[key].filter(row => key !== 'scenarios' || sector === '全部' || row[2] === sector)
    .map(([title, copy, group, task, url], index) => {
    const card = document.createElement('article');
    card.className = 'catalog-card';
    const visual = document.createElement('div');
    visual.className = 'catalog-art art-' + key;
    visual.setAttribute('aria-hidden', 'true');
    const content = document.createElement('div');
    content.className = 'catalog-body';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const description = document.createElement('p');
    description.textContent = copy;
    const kind = document.createElement('small');
    kind.textContent = group;
    content.append(kind, heading, description);
    if (url) {
      const link = document.createElement('a');
      const area = byId('region').value;
      const cities = { Henan: 'kaifeng', Jiangxi: 'nanchang', Jiangsu: 'suzhou' };
      link.href = url === './chain/' && cities[area] ? url + '?city=' + cities[area] : url;
      link.textContent = url.startsWith('#') ? '查看网络 ↗' : '进入场景 ↗';
      link.setAttribute('aria-label', link.textContent + ' ' + title);
      content.append(link);
    } else {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'detail-link';
      more.textContent = '查看详情 ↗';
      more.onclick = () => {
        byId('dialog-type').textContent = group;
        byId('dialog-title').textContent = title;
        byId('dialog-copy').textContent = copy;
        byId('dialog-task').textContent = task;
        byId('catalog-dialog').showModal();
      };
      content.append(more);
    }
    card.append(visual, content);
    return card;
  });
  byId('catalog-content').replaceChildren(...cards);
  toggle('[data-catalog]', 'catalog', key);
}

const colors = [
  { fill: '#d2ad59', shade: '#aa8438', feature: '#c4953c', line: '#aa742e' },
  { fill: '#e8cd98', shade: '#bc9d66', feature: '#ddaa66', line: '#ad572c' },
  { fill: '#dab0ac', shade: '#ac8886', feature: '#a44247', line: '#9d4147' }
];
const nodes = [[113.6,34.8],[116.3,39.9],[121.5,31.2],[113.3,23.1],[104.1,30.7],[115.9,28.6],[120.2,30.3],[108.9,34.3]];
const links = [[0,1],[0,2],[0,7],[2,5],[2,6],[5,3],[4,7],[4,3]];
const regions = {
  Jiangsu: [119.4,32.6,3],
  all: [103.5,36.5,1],
  Henan: [113.8,34.2,4.6],
  Jiangxi: [115.7,27.4,4.6],
  Zhejiang: [120.1,29.4,5]
};

function drawMap() {
  if (!ctx || !data.length) return;
  const {width, height} = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.scale(ratio, ratio);
  const region = byId('region').value;
  const [lng, lat, factor] = regions[region];
  hitAreas = [];
  const unit = Math.min(width / 71, height / 57) * zoom * factor;
  for (let i = 0; i <= 2; i++) {
    const color = colors[2-i];
    const y = height * .22 + (2-i) * height * .265;
    const selected = i === layer;
    const project = ([a,b], depth = 0) => [width * .52 + panX + (a - lng) * unit + (b - lat) * unit * .31, y + panY - (b - lat) * unit * .54 + depth];
    const drawRegion = (rings, depth, fill, stroke) => {
      ctx.beginPath();
      for (const ring of rings) {
        ring.forEach((p,j) => j === 0 ? ctx.moveTo(...project(p,depth)) : ctx.lineTo(...project(p,depth)));
        ctx.closePath();
      }
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .65; ctx.stroke(); }
    };
    ctx.globalAlpha = selected ? .98 : .50;
    const visible = region === 'all' ? data : data.filter(([name]) => name.split(' ')[0] === region);
    visible.forEach(([,rings]) => drawRegion(rings, 8, color.shade));
    visible.forEach(([name,rings]) => {
      const province = name.split(' ')[0];
      const featured = region === 'all' ? ['Henan','Jiangxi','Zhejiang','Guangzhou','Shandong'].includes(province) : province === region;
      drawRegion(rings, 0, featured ? color.feature : color.fill, '#fbf5e7');
      if (region === 'all' && Object.hasOwn(regions, province)) {
        const outline = new Path2D();
        rings.forEach(ring => {
          ring.forEach((p,j) => j ? outline.lineTo(...project(p)) : outline.moveTo(...project(p)));
          outline.closePath();
        });
        hitAreas.push({ province, outline });
      }
    });
    if (i === 1 && region === 'all') {
      ctx.lineWidth = 1.45;
      ctx.strokeStyle = color.line;
      for (const [a,b] of links) {
        const [ax,ay] = project(nodes[a]);
        const [bx,by] = project(nodes[b]);
        ctx.beginPath();ctx.moveTo(ax,ay);ctx.quadraticCurveTo((ax+bx)/2, Math.min(ay,by)-15,bx,by);ctx.stroke();
      }
    }
    if (i !== 1) nodes.filter(([x,y]) => region === 'all' || Math.abs(x-lng) < 2 && Math.abs(y-lat) < 3).forEach(node => {
      const [x,y] = project(node);
      ctx.beginPath();ctx.arc(x,y,i === 2 ? 3 : 2.5,0,Math.PI*2);
      ctx.fillStyle = selected ? '#8e2636' : '#fffdf6';ctx.fill();
    });
  }
  ctx.globalAlpha = 1;
}

function showLayer(index) {
  layer = index;
  byId('layer-title').textContent = layers[index][0];
  byId('layer-copy').textContent = layers[index][1];
  const facts = layerFacts[index];
  byId('layer-details').replaceChildren(...facts.map((v,i) => {
    const tag = document.createElement(i % 2 ? 'dd' : 'dt'); tag.textContent = v; return tag;
  }));
  toggle('[data-layer]', 'layer', index);
  drawMap();
}

document.querySelector('.hero-prev').addEventListener('click', () => showSlide(slide - 1));
document.querySelector('.hero-next').addEventListener('click', () => showSlide(slide + 1));
document.querySelectorAll('[data-slide]').forEach(button => button.addEventListener('click', () => {
  const index = Number(button.dataset.slide);
  showSlide(index);
  showCatalog(['plans', 'products', 'scenarios'][index]);
}));
document.querySelectorAll('[data-catalog]').forEach(button => button.addEventListener('click', () => showCatalog(button.dataset.catalog)));
document.querySelectorAll('[data-layer]').forEach(button => button.addEventListener('click', () => showLayer(Number(button.dataset.layer))));
byId('region').addEventListener('change', event => {
  zoom = 1; panX = 0; panY = 0;
  const title = event.target.selectedOptions[0].textContent;
  byId('region-note').textContent = '当前范围：' + title;
  byId('network-title').textContent = title + '物流网络';
  showCatalog(openTab);
  drawMap();
});
byId('zoom-in').addEventListener('click', () => { zoom = Math.min(3, zoom * 1.2); drawMap(); });
byId('zoom-out').addEventListener('click', () => { zoom = Math.max(.5, zoom/1.2); drawMap(); });
byId('reset-map').addEventListener('click', () => { zoom = 1; panX = 0; panY = 0; drawMap(); });
byId('layer-link').onclick = () => { sector = ['数字枢纽','跨区域协同','产业链协同'][layer]; showCatalog('scenarios'); };
canvas.addEventListener('pointerdown', e => {
  moved = false; canvas.setPointerCapture(e.pointerId);
  touches.set(e.pointerId, {x:e.clientX, y:e.clientY, startX:e.clientX, startY:e.clientY});
});
canvas.addEventListener('pointermove', e => {
  const point = touches.get(e.pointerId); if (!point) return;
  const dx=e.clientX-point.x, dy=e.clientY-point.y;
  if (touches.size===2) {
    const other=Array.from(touches.entries()).find(([id]) => id!==e.pointerId)[1];
    const old=Math.hypot(point.x-other.x,point.y-other.y);
    if (old>0) zoom=Math.min(3,Math.max(.5,zoom*Math.hypot(e.clientX-other.x,e.clientY-other.y)/old));
    moved = true;
  } else {
    if (Math.hypot(e.clientX-point.startX,e.clientY-point.startY)>4) moved = true;
    panX+=dx; panY+=dy;
  }
  point.x=e.clientX; point.y=e.clientY; drawMap();
});
canvas.addEventListener('pointerup', e => {
  touches.delete(e.pointerId);
  if (moved || byId('region').value!=='all') return;
  const rect=canvas.getBoundingClientRect();
  const ratio=window.devicePixelRatio||1;
  const hit=hitAreas.findLast(area => ctx.isPointInPath(area.outline,(e.clientX-rect.left)*ratio,(e.clientY-rect.top)*ratio));
  if (hit) { byId('region').value=hit.province; byId('region').dispatchEvent(new Event('change')); }
});
canvas.addEventListener('pointercancel', e=>touches.delete(e.pointerId));
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  zoom = Math.min(3, Math.max(.5, zoom * (event.deltaY < 0 ? 1.15 : 1/1.15)));
  drawMap();
}, { passive: false });
showLayer(2);
showSlide(2);
showCatalog('scenarios');
fetch('./regions.json').then(response => {
  if (!response.ok) throw new Error('Map unavailable');
  return response.json();
}).then(value => {
  data = value;
  new ResizeObserver(drawMap).observe(canvas);
}).catch(() => {
  byId('region-note').textContent = '底图暂不可用。仍可浏览图层说明和场景。';
});
