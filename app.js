const byId = id => document.getElementById(id);
const view = Object.fromEntries(
  ['case', 'period', 'part', 'tier', 'search', 'reset', 'overview-content', 'trade-content',
    'trace-status', 'graph', 'node-detail', 'data-channel'].map(id => [id, byId(id)])
);
const production = location.hostname.endsWith('.github.io');
const api = production ? 'https://supply-chain-index-xuxuyayaya.onrender.com' : '';
const state = { catalog: [], detail: null, trace: null, selected: null };
let caseRequest, traceRequest, graphObserver;
const number = value => value === null ? '—' : Number(value).toFixed(1);
const tierLabel = tier => tier === 0 ? '整机端' : 'Tier ' + tier;

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function options(select, values, chosen) {
  select.replaceChildren(...values.map(([value, label]) => new Option(label, value)));
  if (values.some(([value]) => value === chosen)) select.value = chosen;
  select.disabled = values.length <= 1;
}

function errorBox(target, message, retry) {
  const box = el('div', undefined, 'error');
  box.append(el('p', message));
  const button = el('button', '重试', 'quiet');
  button.type = 'button';
  button.addEventListener('click', retry);
  box.append(button);
  target.replaceChildren(box);
}

async function request(path, snapshot, signal) {
  const liveSignal = AbortSignal.any([signal, AbortSignal.timeout(production ? 3000 : 12000)]);
  try {
    const response = await fetch(api + '/api/' + path, { signal: liveSignal });
    if (!response.ok) throw new Error('API ' + response.status);
    return { data: await response.json(), cached: false };
  } catch (error) {
    if (!production || signal.aborted) throw error;
    const response = await fetch('./data/' + snapshot + '.json', { signal });
    if (!response.ok) throw error;
    return { data: await response.json(), cached: true };
  }
}

function updateChannel(cached) {
  view['data-channel'].textContent = cached
    ? '数据通道：GitHub Pages 演示快照。在线 API 暂未响应。'
    : '数据通道：在线接口。';
}

function renderOverview(data) {
  const grid = el('div', undefined, 'overview-grid');
  const score = el('article', undefined, 'panel score');
  score.append(el('span', '示例数据 · 非真实统计', 'label'), el('h3', data.name));
  score.append(el('p', data.region + ' · ' + data.period + ' · 口径 V' + data.version, 'muted'));
  const value = el('p', data.index === null ? '暂不可计算' : number(data.index), 'number');
  if (data.index !== null) value.append(el('small', '/ 100 分'));
  score.append(value, el('p', data.description, 'muted'));
  const cards = el('div', undefined, 'metrics');
  for (const item of data.metrics) {
    const card = el('article', undefined, 'panel metric');
    card.append(el('h3', item.name), el('strong', item.value === null ? '暂无' : number(item.value) + '%'));
    card.append(el('p', '权重 ' + item.weight * 100 + '% · ' + (item.direction === 'positive' ? '正向' : '逆向'), 'muted'));
    const detail = el('details');
    detail.append(el('summary', '查看计算口径'), el('p', item.note));
    detail.append(el('p', '分子 ' + item.numerator + ' / 分母 ' + item.denominator));
    detail.append(el('p', '标准分 ' + number(item.score) + ' · 加权贡献 ' + number(item.contribution) + ' 分'));
    card.append(detail);
    cards.append(card);
  }
  grid.append(score, cards);
  view['overview-content'].className = '';
  view['overview-content'].replaceChildren(grid);
}

function bars(title, items, max) {
  const panel = el('article', undefined, 'panel');
  panel.append(el('h3', title));
  const rows = el('div', undefined, 'bars');
  for (const item of items) {
    const row = el('div', undefined, 'bar-row');
    if (item.traceId) {
      const link = el('button', item.label + ' ↗');
      link.type = 'button';
      link.addEventListener('click', () => {
        view.part.value = item.traceId;
        loadTrace();
        byId('trace').scrollIntoView();
        view.part.focus({ preventScroll: true });
      });
      row.append(link);
    } else {
      const label = el('span', item.label);
      if ('traceId' in item) label.title = '暂无对应追溯关系';
      row.append(label);
    }
    row.append(el('span', number(item.amount) + (item.percent === undefined ? '' : ' / ' + number(item.percent) + '%')));
    const meter = el('meter');
    meter.max = max || 1;
    meter.value = item.amount;
    meter.setAttribute('aria-label', item.label + '金额（亿元）');
    row.append(meter);
    rows.append(row);
  }
  panel.append(rows);
  return panel;
}

function renderTrade(trade) {
  const kpis = el('div', undefined, 'trade-kpi');
  for (const [label, value] of [['采购额', trade.purchase], ['销售额', trade.sales], ['购销合计', trade.total]]) {
    const tile = el('article', undefined, 'panel');
    tile.append(el('span', label, 'muted'), el('strong', number(value) + ' 亿元'));
    kpis.append(tile);
  }
  const grid = el('div', undefined, 'trade-grid');
  grid.append(
    bars('品类购销额（亿元）', trade.categories, trade.categories[0]?.amount),
    bars('供应商采购额与占比', trade.suppliers, trade.suppliers[0]?.amount),
    bars('采购来源地（亿元）', trade.origins, trade.purchase)
  );
  view['trade-content'].replaceChildren(kpis, grid);
}

function connected(trace, selected) {
  if (!selected) return null;
  const nodes = new Set([selected]);
  for (const [source, target] of [['from', 'to'], ['to', 'from']]) {
    const todo = [selected];
    const seen = new Set(todo);
    while (todo.length) {
      const current = todo.pop();
      for (const edge of trace.edges.filter(edge => edge[source] === current)) {
        if (!seen.has(edge[target])) {
          seen.add(edge[target]);
          nodes.add(edge[target]);
          todo.push(edge[target]);
        }
      }
    }
  }
  return nodes;
}

function drawPaths(canvas, board, buttons, edges, active) {
  const bounds = board.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  canvas.style.width = bounds.width + 'px';
  canvas.style.height = bounds.height + 'px';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  for (const edge of edges) {
    if (!buttons.has(edge.from) || !buttons.has(edge.to)) continue;
    const from = buttons.get(edge.from).getBoundingClientRect();
    const to = buttons.get(edge.to).getBoundingClientRect();
    const x1 = from.right - bounds.left;
    const y1 = from.top + from.height / 2 - bounds.top;
    const x2 = to.left - bounds.left - 2;
    const y2 = to.top + to.height / 2 - bounds.top;
    const mid = (x1 + x2) / 2;
    ctx.globalAlpha = !active || (active.has(edge.from) && active.has(edge.to)) ? 1 : .22;
    ctx.strokeStyle = edge.status === 'association' ? '#9d6f30' : '#39745d';
    ctx.lineWidth = 1.7;
    ctx.setLineDash(edge.status === 'association' ? [3, 3] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(mid, y1, mid, y2, x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2 - 4, y2 - 3);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - 4, y2 + 3);
    ctx.stroke();
  }
}

function renderGraph(focusId) {
  const { trace, selected } = state;
  graphObserver?.disconnect();
  if (!trace) return;
  const keyword = view.search.value.trim().toLowerCase();
  const tier = view.tier.value;
  const hits = trace.nodes.filter(node => (tier === '' || String(node.tier) === tier)
    && (node.label + ' ' + node.place).toLowerCase().includes(keyword));
  const hitIds = new Set(hits.map(node => node.id));
  const active = connected(trace, selected);
  const visibleEdges = trace.edges.filter(edge => hitIds.has(edge.from) && hitIds.has(edge.to));
  view['trace-status'].textContent = trace.label + ' · ' + hits.length + ' 个节点 · ' + visibleEdges.length + ' 条可见关系';
  const board = el('div', undefined, 'graph-board');
  const canvas = el('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  board.append(canvas);
  const buttons = new Map();
  for (const lane of [3, 2, 1, 0]) {
    const group = el('div', undefined, 'tier-lane');
    group.append(el('h3', tierLabel(lane)));
    for (const node of hits.filter(node => node.tier === lane)) {
      const button = el('button', node.label, 'node');
      button.type = 'button';
      button.setAttribute('aria-pressed', selected === node.id);
      if (active && !active.has(node.id)) button.classList.add('dim');
      button.addEventListener('click', () => {
        state.selected = state.selected === node.id ? null : node.id;
        renderGraph(node.id);
      });
      group.append(button);
      buttons.set(node.id, button);
    }
    board.append(group);
  }
  view.graph.replaceChildren(hits.length ? board : el('p', '当前范围未找到企业。', 'loading'));
  if (hits.length) {
    graphObserver = new ResizeObserver(() => drawPaths(canvas, board, buttons, visibleEdges, active));
    graphObserver.observe(board);
  }
  buttons.get(focusId)?.focus({ preventScroll: true });
  renderNode(trace, selected);
}

function renderNode(trace, selected) {
  const box = view['node-detail'];
  const node = trace.nodes.find(item => item.id === selected);
  box.replaceChildren(el('h3', node?.label || '节点详情'));
  if (!node) {
    box.append(el('p', '选择一个企业，查看供货对象与资料说明。', 'muted'));
    return;
  }
  box.append(el('p', tierLabel(node.tier) + ' · ' + node.place, 'muted'));
  const list = el('ul');
  for (const edge of trace.edges.filter(edge => edge.from === node.id || edge.to === node.id)) {
    const upstream = edge.to === node.id;
    const related = trace.nodes.find(item => item.id === (upstream ? edge.from : edge.to));
    list.append(el('li', (upstream ? '上游：' : '供向：') + related.label
      + (edge.status === 'association' ? '（关联示意）' : '')));
  }
  box.append(list, el('p', trace.source.note, 'muted'));
}

async function loadTrace() {
  traceRequest?.abort();
  graphObserver?.disconnect();
  const req = traceRequest = new AbortController();
  const id = state.detail?.id;
  const part = view.part.value;
  state.trace = state.selected = null;
  view.tier.value = view.search.value = '';
  view.graph.replaceChildren();
  view['node-detail'].replaceChildren();
  if (!id || !part) {
    view['trace-status'].textContent = '当前案例暂无可追溯部件。';
    return;
  }
  view['trace-status'].textContent = '正在读取供货关系…';
  try {
    const result = await request('cases/' + id + '/trace?part=' + part, id + '-' + part, req.signal);
    if (req.signal.aborted) return;
    state.trace = result.data;
    renderGraph();
  } catch {
    if (req.signal.aborted) return;
    view['trace-status'].textContent = '供货关系加载失败。';
    errorBox(view.graph, '可重新加载当前部件。', loadTrace);
  }
}

async function loadCase() {
  caseRequest?.abort();
  traceRequest?.abort();
  graphObserver?.disconnect();
  const req = caseRequest = new AbortController();
  const id = view.case.value;
  const period = view.period.value;
  state.detail = state.trace = state.selected = null;
  view['overview-content'].className = 'loading';
  view['overview-content'].textContent = '正在读取案例指标…';
  view['trade-content'].replaceChildren();
  view.graph.replaceChildren();
  view['node-detail'].replaceChildren();
  view['trace-status'].textContent = '等待案例加载…';
  options(view.part, []);
  try {
    const result = await request('cases/' + id + '?period=' + period, id + '-' + period, req.signal);
    if (req.signal.aborted) return;
    state.detail = result.data;
    updateChannel(result.cached);
    renderOverview(result.data);
    renderTrade(result.data.trade);
    options(view.part, result.data.traceParts.map(part => [part.id, part.label]));
    loadTrace();
  } catch {
    if (req.signal.aborted) return;
    view['trace-status'].textContent = '当前案例无法加载。';
    errorBox(view['overview-content'], '案例加载失败。', loadCase);
  }
}

function configurePeriods() {
  const selected = state.catalog.find(item => item.id === view.case.value);
  options(view.period, selected.periods.map(period => [period, period]));
  loadCase();
}

async function init() {
  try {
    const result = await request('cases', 'cases', new AbortController().signal);
    state.catalog = result.data;
    const initialCase = new URLSearchParams(location.search).get('case');
    options(view.case, state.catalog.map(item => [item.id, item.name]), initialCase);
    configurePeriods();
  } catch {
    errorBox(view['overview-content'], '案例列表加载失败。', init);
  }
}

view.case.addEventListener('change', configurePeriods);
view.period.addEventListener('change', loadCase);
view.part.addEventListener('change', loadTrace);
for (const id of ['tier', 'search']) {
  view[id].addEventListener('input', () => {
    state.selected = null;
    renderGraph();
  });
}
view.reset.addEventListener('click', () => {
  view.tier.value = view.search.value = '';
  state.selected = null;
  view.graph.scrollLeft = 0;
  renderGraph();
});
init();
