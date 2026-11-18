const titles = [
  ['数字物流网络', '让货流、通道与产业协同', '从全国网络到区域节点，以通道组织、平台协同和产业分析支撑物流决策。'],
  ['平台产品', '让物流数据服务业务决策', '汇聚通道、节点与产业数据，支持运行观察和供应分析。'],
  ['业务场景', '在真实业务场景中验证方案', '围绕交通枢纽、多式联运与产业链协同，查看数据如何支撑决策。']
];
const layers = [
  ['交通基础设施网', '按省域观察物流节点与跨区域联系。'],
  ['物流通道网', '查看主要节点间的跨区域通道组织示意。'],
  ['数字物流网', '从节点和通道延伸至面向区域的平台协同。']
];
const catalog = {
  plans: [
    ['区域物流网络建设', '梳理通道、枢纽与产业联系，明确区域网络建设重点。'],
    ['多式联运组织', '从货源、节点、运力和换装条件评估通道组织。'],
    ['物流数据治理', '统一来源、数据口径和共享机制，支撑跨主体协同。']
  ],
  products: [
    ['区域物流数据平台', '汇聚节点、通道与运行数据，形成统一的区域视图。'],
    ['物流网络运行分析', '按区域和层级理解物流网络的连接关系。'],
    ['产业链分析看板', '查看供应指数、贸易结构和关键部件的供货关系。', './supply-index.html']
  ],
  scenarios: [
    ['产业链供应分析指数', '查看供应能力与贸易构成，沿关键部件追溯上游供货关系。', './supply-index.html'],
    ['汽车零部件上游追溯', '以开封汽车为参考案例，查看部件和供应层级的关系示意。', './supply-index.html?case=kaifeng-auto#trace'],
    ['跨区域通道观察', '通过三层网络示意查看枢纽、通道与数字平台的关系。', '#architecture']
  ]
};

const byId = id => document.getElementById(id);
let slide = 0;
let layer = 0;
let zoom = 1;
let data = [];
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
  const cards = catalog[key].map(([title, copy, url], index) => {
    const card = document.createElement('article');
    card.className = 'catalog-card';
    const visual = document.createElement('div');
    visual.className = 'catalog-art art-' + index;
    visual.setAttribute('aria-hidden', 'true');
    const content = document.createElement('div');
    content.className = 'catalog-body';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const description = document.createElement('p');
    description.textContent = copy;
    content.append(heading, description);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.textContent = url.startsWith('#') ? '查看网络 ↗' : '进入场景 ↗';
      link.setAttribute('aria-label', link.textContent + ' ' + title);
      content.append(link);
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
  all: [103.5,36.5,1],
  Henan: [113.8,34.2,2.15],
  Jiangxi: [115.7,27.4,2.15],
  Zhejiang: [120.1,29.4,2.25]
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
  const unit = Math.min(width / 71, height / 57) * zoom * factor;
  for (let i = 2; i >= 0; i--) {
    const color = colors[i];
    const y = height * .22 + i * height * .265;
    const selected = i === layer;
    const project = ([a,b], depth = 0) => [width * .52 + (a - lng) * unit + (b - lat) * unit * .31, y - (b - lat) * unit * .54 + depth];
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
    data.forEach(([,rings]) => drawRegion(rings, 8, color.shade));
    data.forEach(([name,rings]) => {
      const province = name.split(' ')[0];
      const featured = region === 'all' ? ['Henan','Jiangxi','Zhejiang','Guangzhou','Shandong'].includes(province) : province === region;
      drawRegion(rings, 0, featured ? color.feature : color.fill, '#fbf5e7');
    });
    if (i === 1) {
      ctx.lineWidth = 1.45;
      ctx.strokeStyle = color.line;
      for (const [a,b] of links) {
        const [ax,ay] = project(nodes[a]);
        const [bx,by] = project(nodes[b]);
        ctx.beginPath();ctx.moveTo(ax,ay);ctx.quadraticCurveTo((ax+bx)/2, Math.min(ay,by)-15,bx,by);ctx.stroke();
      }
    }
    if (i !== 1) nodes.forEach(node => {
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
  zoom = 1;
  byId('region-note').textContent = '当前范围：' + event.target.selectedOptions[0].textContent;
  drawMap();
});
byId('zoom-in').addEventListener('click', () => { zoom = Math.min(1.7, zoom + .15); drawMap(); });
byId('zoom-out').addEventListener('click', () => { zoom = Math.max(.65, zoom - .15); drawMap(); });
byId('reset-map').addEventListener('click', () => { zoom = 1; drawMap(); });
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
