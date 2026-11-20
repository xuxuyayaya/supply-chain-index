import { clearTraceMap, renderTraceMap, fitTraceMap } from "./trace-map.js";

const byId = (id) => document.getElementById(id);
const view = Object.fromEntries(
  [
    "city",
    "case",
    "period",
    "part",
    "tier",
    "search",
    "reset",
    "overview-content",
    "trade-content",
    "trace-status",
    "graph",
    "node-detail",
    "data-channel",
    "dimension-nav",
    "dimension-detail",
    "trace-map",
    "map-status",
  ].map((id) => [id, byId(id)]),
);
const production = location.hostname.endsWith(".github.io");
const api = production
  ? "https://supply-chain-index-xuxuyayaya.onrender.com"
  : "";
const state = {
  catalog: [],
  detail: null,
  trace: null,
  selected: null,
  dimension: "coverage",
  screen: "overview",
};
const dimensions = {
  coverage: {
    label: "环节覆盖",
    description: "看哪些关键环节具备供应能力，并沿部件查看供货关系。",
    evidence: "trace",
  },
  local: {
    label: "本地配套",
    description: "比较本地与外部采购规模，查看各品类的购销构成。",
    evidence: "trade",
  },
  cr5: {
    label: "供应商集中度",
    description: "对照主要供应商的采购额，查看前五家占采购总额的比例。",
    evidence: "trade",
  },
  leader: {
    label: "龙头依赖度",
    description: "查看链主营收在链上营收中的占比及反向计分结果。",
  },
};
let caseRequest, traceRequest, graphObserver;
const number = (value) => (value === null ? "—" : Number(value).toFixed(1));
const tierLabel = (tier) => (tier === 0 ? "整机端" : "Tier " + tier);

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function options(select, values, chosen) {
  select.replaceChildren(
    ...values.map(([value, label]) => new Option(label, value)),
  );
  if (values.some(([value]) => value === chosen)) select.value = chosen;
  select.disabled = values.length <= 1;
}

function errorBox(target, message, retry) {
  const box = el("div", undefined, "error");
  box.append(el("p", message));
  const button = el("button", "重试", "quiet");
  button.type = "button";
  button.addEventListener("click", retry);
  box.append(button);
  target.replaceChildren(box);
}

async function request(path, snapshot, signal) {
  const liveSignal = AbortSignal.any([
    signal,
    AbortSignal.timeout(production ? 3000 : 12000),
  ]);
  try {
    const response = await fetch(api + "/api/" + path, { signal: liveSignal });
    if (!response.ok) throw new Error("API " + response.status);
    return { data: await response.json(), cached: false };
  } catch (error) {
    if (!production || signal.aborted) throw error;
    const response = await fetch("./data/" + snapshot + ".json", { signal });
    if (!response.ok) throw error;
    return { data: await response.json(), cached: true };
  }
}

function updateChannel(cached) {
  view["data-channel"].textContent = cached
    ? "数据通道：已发布的月度快照。"
    : "数据通道：在线接口。";
}

function renderOverview(data) {
  byId("report-period").textContent = data.period.replace("-", " 年 ") + " 月";
  byId("report-city").textContent = data.city + " · " + data.industry;
  const previous = data.evaluation.previous;
  const delta =
    previous && data.index !== null ? data.index - previous.score : null;
  const band =
    data.index === null
      ? "缺数"
      : data.index >= 85
        ? "优秀"
        : data.index >= 70
          ? "良好"
          : data.index >= 60
            ? "中等"
            : "较差";
  const priority = [...data.metrics]
    .filter((item) => item.gap !== null)
    .sort((a, b) => b.gap * b.weight - a.gap * a.weight)[0];
  const grid = el("div", undefined, "overview-grid");
  const score = el("article", undefined, "score");
  score.append(el("p", "产业链供应分", "score-eyebrow"));
  const valueRow = el("div", undefined, "score-line");
  const value = el(
    "p",
    data.index === null ? "暂不可计算" : number(data.index),
    "number",
  );
  if (data.index !== null) value.append(el("small", "/ 100"));
  valueRow.append(value, el("span", band, "score-grade"));
  score.append(
    valueRow,
    el(
      "p",
      delta === null
        ? "首个统计期"
        : "较上月" +
            (delta >= 0 ? "提升 " : "下降 ") +
            number(Math.abs(delta)) +
            " 分",
      "score-change",
    ),
  );
  const missing = data.stages.filter((stage) => !stage.covered).length;
  score.append(
    el(
      "p",
      "已覆盖 " +
        data.metrics[0].numerator +
        " 个关键环节，" +
        missing +
        " 个环节仍需完善。" +
        (data.metrics[1].gap > 0
          ? "本地配套率距优秀线 " + number(data.metrics[1].gap) + " 个百分点。"
          : "本地配套率已达到优秀线。"),
      "score-summary",
    ),
  );
  const scale = el("div", undefined, "score-scale");
  scale.setAttribute(
    "aria-label",
    "供应分分档，60 分中等、70 分良好、85 分优秀",
  );
  for (const width of [60, 10, 15, 15]) {
    const part = el("span");
    part.style.flex = width;
    scale.append(part);
  }
  if (data.index !== null) {
    const cursor = el("i");
    cursor.style.left = data.index + "%";
    scale.append(cursor);
  }
  const labels = el("div", undefined, "scale-labels");
  for (const point of [0, 60, 70, 85, 100]) {
    const label = el("span", String(point));
    label.style.left = point + "%";
    labels.append(label);
  }
  score.append(scale, labels);
  const insight = el("article", undefined, "diagnosis");
  insight.append(el("span", "本期关注", "section-kicker"));
  if (priority?.gap > 0) {
    insight.append(
      el("h3", priority.name + "还有改善空间"),
      el(
        "p",
        "当前 " +
          number(priority.value) +
          "%，优秀线为 " +
          priority.goal +
          "%。" +
          priority.action,
      ),
    );
    const action = el("button", "查看" + priority.name, "text-link");
    action.type = "button";
    action.onclick = () => showScreen("dimensions", priority.id, true);
    insight.append(action);
  } else {
    insight.append(
      el("h3", "四项指标已达优秀线"),
      el("p", "可继续查看各分项变化及供应企业的配套路径。"),
    );
  }
  grid.append(score, insight);
  const bottom = el("div", undefined, "overview-bottom");
  const drivers = el("div");
  const heading = el("div", undefined, "block-head");
  heading.append(el("h3", "四个方面看供应能力"));
  const list = el("div", undefined, "driver-list");
  for (const item of data.metrics) {
    const button = el("button", undefined, "driver");
    button.type = "button";
    const track = el("span", undefined, "track");
    const fill = el("i");
    fill.style.width = (item.score ?? 0) + "%";
    track.append(fill);
    button.append(
      el("span", item.name),
      track,
      el("strong", number(item.score) + " 分"),
    );
    button.setAttribute(
      "aria-label",
      item.name + "标准分 " + number(item.score) + "，查看指标分析",
    );
    button.onclick = () => showScreen("dimensions", item.id, true);
    list.append(button);
  }
  drivers.append(heading, list);
  const context = el("div");
  context.append(el("h3", "供应规模"));
  const facts = el("dl", undefined, "overview-facts");
  for (const [label, amount, unit] of [
    ["本地采购", data.trade.origins[0].amount, "亿元"],
    ["购销规模", data.trade.total, "亿元"],
  ]) {
    const fact = el("div");
    const value = el("dd", number(amount));
    value.append(el("small", " " + unit));
    fact.append(el("dt", label), value);
    facts.append(fact);
  }
  const method = el("details", undefined, "score-method");
  method.append(el("summary", "供应分如何计算"));
  const equation = el("div", undefined, "score-equation");
  for (const item of data.metrics) {
    const term = el("div", undefined, "score-term");
    term.append(
      el("strong", number(item.score)),
      el("span", " × " + Math.round(item.weight * 100) + "%"),
      el("small", item.name),
    );
    equation.append(term);
  }
  method.append(
    equation,
    el(
      "p",
      "正向指标取百分数原值，逆向指标用 100 减原值。四项加权相加得到供应分。",
    ),
  );
  context.append(facts, method);
  bottom.append(drivers, context);
  view["overview-content"].className = "";
  view["overview-content"].replaceChildren(grid, bottom);
}

function showScreen(screen, dimension = state.dimension, updateHash = false) {
  state.screen = screen;
  state.dimension = dimension || "coverage";
  for (const name of ["overview", "dimensions", "trade", "trace", "system"])
    byId(name).hidden = name !== screen;
  document.querySelectorAll("[data-screen]").forEach((link) => {
    if (link.dataset.screen === screen)
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (updateHash)
    history.replaceState(
      null,
      "",
      "#" + (screen === "dimensions" ? state.dimension : screen),
    );
  if (!state.detail) return;
  if (screen === "dimensions") showDimension(state.dimension);
  if (screen === "trade") renderTrade(state.detail.trade, state.dimension);
  if (screen === "trace") {
    if (state.trace) renderGraph();
    else if (!traceRequest) loadTrace();
  } else graphObserver?.disconnect();
}

function applyRoute() {
  const hash = location.hash.slice(1);
  if (Object.hasOwn(dimensions, hash)) return showScreen("dimensions", hash);
  showScreen(
    ["overview", "dimensions", "trade", "trace", "system"].includes(hash)
      ? hash
      : "overview",
  );
}

function showDimension(key) {
  state.dimension = key;
  if (!state.detail) return;
  const dimension = dimensions[key];
  const tabs = state.detail.metrics.map((item) => {
    const button = el("button", undefined, "dimension-card");
    button.type = "button";
    button.setAttribute("aria-pressed", String(item.id === key));
    button.append(
      el("span", item.name),
      el("strong", number(item.value) + "%"),
      el(
        "small",
        item.grade + " · 权重 " + Math.round(item.weight * 100) + "%",
      ),
    );
    button.onclick = () => showScreen("dimensions", item.id, true);
    return button;
  });
  view["dimension-nav"].replaceChildren(...tabs);
  const detail = view["dimension-detail"];
  detail.hidden = false;
  const item = state.detail.metrics.find((metric) => metric.id === key);
  const value = el("p", number(item.value) + "%", "metric-value");
  value.append(el("small", item.grade));
  const calculation = el("dl", undefined, "calculation-row");
  const ratio =
    item.numerator == null || !item.denominator
      ? "—"
      : Number(item.numerator.toFixed(2)) +
        " / " +
        Number(item.denominator.toFixed(2)) +
        (key === "coverage" ? " 环节" : " 亿元");
  for (const [label, value] of [
    ["分子 / 分母", ratio],
    ["标准化得分", number(item.score) + " 分"],
    ["加权贡献", number(item.contribution) + " 分"],
  ]) {
    const pair = el("div");
    pair.append(el("dt", label), el("dd", value));
    calculation.append(pair);
  }
  const [a, b, c] = item.limits;
  const bands =
    item.direction === "positive"
      ? [
          "低于 " + a + "%",
          a + "% 至不足 " + b + "%",
          b + "% 至不足 " + c + "%",
          c + "% 及以上",
        ]
      : [
          "高于 " + c + "%",
          "超过 " + b + "% 至 " + c + "%",
          "超过 " + a + "% 至 " + b + "%",
          a + "% 及以下",
        ];
  const scale = el("div", undefined, "grade-scale");
  for (const [i, name] of ["偏差", "关注", "正常", "优秀"].entries()) {
    const term = el("span", name + " · " + bands[i]);
    if (name === item.grade) term.className = "active";
    scale.append(term);
  }
  detail.replaceChildren(
    el("h3", item.name),
    el("p", dimension.description, "muted"),
    value,
    calculation,
    el("p", item.note, "muted"),
    scale,
  );
  if (key === "coverage") {
    const stages = el("details", undefined, "stage-list");
    const missing = state.detail.stages.filter((stage) => !stage.covered);
    stages.append(
      el("summary", "关键环节清单 · " + missing.length + " 个尚未稳定覆盖"),
    );
    for (const [label, items] of [
      ["尚未稳定覆盖", missing],
      ["已覆盖", state.detail.stages.filter((stage) => stage.covered)],
    ])
      stages.append(
        el("strong", label),
        el("p", items.map((stage) => stage.label).join("、") || "无"),
      );
    detail.append(stages);
  }
  if (key === "leader")
    detail.append(
      el(
        "p",
        "本期链主营收 " +
          number(item.numerator) +
          " 亿元，其他链上企业合计 " +
          number(item.denominator - item.numerator) +
          " 亿元。" +
          item.action,
        "business-reading",
      ),
    );
  const actions = el("div", undefined, "evidence-actions");
  if (dimension.evidence) {
    const link = el(
      "a",
      dimension.evidence === "trace" ? "查看部件与配套企业" : "查看采购构成",
    );
    link.href = "#" + dimension.evidence;
    actions.append(link);
  }
  if (key === "local" || key === "cr5") {
    const link = el("a", "追溯关键部件");
    link.href = "#trace";
    actions.append(link);
  }
  detail.append(actions);
}

function bars(title, items, max) {
  const panel = el("article", undefined, "panel");
  panel.append(el("h3", title));
  const rows = el("div", undefined, "bars");
  for (const item of items) {
    const row = el("div", undefined, "bar-row");
    if (item.traceId) {
      const link = el("button", item.label);
      link.type = "button";
      link.addEventListener("click", () => {
        showScreen("trace", "coverage", true);
        view.part.value = item.traceId;
        loadTrace();
        byId("trace").scrollIntoView();
        view.part.focus({ preventScroll: true });
      });
      row.append(link);
    } else {
      const label = el("span", item.label);
      if ("traceId" in item) label.title = "暂无对应追溯关系";
      row.append(label);
    }
    row.append(
      el(
        "span",
        number(item.amount) +
          (item.percent === undefined
            ? ""
            : " / " + number(item.percent) + "%"),
      ),
    );
    const meter = el("meter");
    meter.max = max || 1;
    meter.value = item.amount;
    meter.setAttribute("aria-label", item.label + "金额（亿元）");
    row.append(meter);
    rows.append(row);
  }
  panel.append(rows);
  return panel;
}

function renderTrade(trade, dimension) {
  const kpis = el("div", undefined, "trade-kpi");
  for (const [label, value] of [
    ["采购额", trade.purchase],
    ["销售额", trade.sales],
    ["购销合计", trade.total],
  ]) {
    const tile = el("article", undefined, "panel");
    tile.append(
      el("span", label, "muted"),
      el("strong", number(value) + " 亿元"),
    );
    kpis.append(tile);
  }
  const grid = el("div", undefined, "trade-grid");
  const summaries = [
    bars("品类购销额（亿元）", trade.categories, trade.categories[0]?.amount),
    bars("供应商采购额与占比", trade.suppliers, trade.suppliers[0]?.amount),
    bars("采购来源地（亿元）", trade.origins, trade.purchase),
  ];
  for (const i of dimension === "cr5" ? [1, 0, 2] : [2, 0, 1])
    grid.append(summaries[i]);
  view["trade-content"].replaceChildren(kpis, grid);
}

function renderSystem(data) {
  const ev = data.evaluation;
  const root = byId("system-content");
  const line = el(
    "p",
    "发展指数由物流、供应和韧性三项合成。差距分析用于安排改进任务。",
    "muted",
  );
  const details = (title, value, body) => {
    const panel = el("details", undefined, "research-row");
    const head = el("summary");
    head.append(el("strong", title), el("span", value), el("b", "＋"));
    panel.append(head, el("p", body));
    return panel;
  };
  const total = details(
    "产业链发展指数",
    number(ev.development) + " 分",
    "物流 " +
      number(ev.logistics) +
      " × 30% ＋ 供应 " +
      number(data.index) +
      " × 40% ＋ 韧性 " +
      number(ev.resilience) +
      " × 30% ＝ " +
      number(ev.development) +
      " 分。",
  );
  const logistics = details(
    "物流保障",
    number(ev.logistics) + " 分 · 权重 30%",
    "物流费用占产值 " +
      number(ev.cost) +
      "%，反向计分后占 40%。准时交付得分 " +
      number(ev.ontime) +
      "、运输安全得分 " +
      number(ev.safety) +
      "，各占 30%。",
  );
  const resilience = details(
    "供应韧性",
    number(ev.resilience) + " 分 · 权重 30%",
    "本期 " +
      ev.keyGoods +
      " 个关键品类中，" +
      ev.bottlenecks +
      " 个存在供应瓶颈。韧性分 = 100 ×（1 − 瓶颈品类数 ÷ 关键品类数）。",
  );
  const gap = details(
    "对标差距与改进",
    "同业基准 " + number(ev.peerIndex) + " 分",
    "同业发展指数基准 " +
      number(ev.peerIndex) +
      " 分，本市 " +
      number(ev.development) +
      " 分。链上增加值 " +
      number(ev.addedValue) +
      " 亿元，同业基准 " +
      number(ev.peerValue) +
      " 亿元，按基准计算差距率 " +
      number(((ev.peerValue - ev.addedValue) / ev.peerValue) * 100) +
      "%。",
  );
  const tasks = el("ol");
  for (const item of [...data.metrics]
    .sort((a, b) => b.gap * b.weight - a.gap * a.weight)
    .filter((item) => item.gap > 0)) {
    tasks.append(
      el(
        "li",
        item.name +
          "距优秀线 " +
          number(item.gap) +
          " 个百分点。" +
          item.action,
      ),
    );
  }
  gap.append(tasks);
  root.replaceChildren(line, total, logistics, resilience, gap);
}

function connected(trace, selected) {
  if (!selected) return null;
  const nodes = new Set([selected]);
  for (const [source, target] of [
    ["from", "to"],
    ["to", "from"],
  ]) {
    const todo = [selected];
    const seen = new Set(todo);
    while (todo.length) {
      const current = todo.pop();
      for (const edge of trace.edges.filter(
        (edge) => edge[source] === current,
      )) {
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
  canvas.style.width = bounds.width + "px";
  canvas.style.height = bounds.height + "px";
  const ctx = canvas.getContext("2d");
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
    ctx.globalAlpha =
      !active || (active.has(edge.from) && active.has(edge.to)) ? 1 : 0.22;
    ctx.strokeStyle = edge.status === "association" ? "#9d6f30" : "#8f2738";
    ctx.lineWidth = 1.7;
    ctx.setLineDash(edge.status === "association" ? [3, 3] : []);
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
  const hits = trace.nodes.filter(
    (node) =>
      (tier === "" || String(node.tier) === tier) &&
      (
        node.label +
        " " +
        node.place +
        " " +
        (node.city || "") +
        " " +
        (node.product || "")
      )
        .toLowerCase()
        .includes(keyword),
  );
  const hitIds = new Set(hits.map((node) => node.id));
  const active = connected(trace, selected);
  const visibleEdges = trace.edges.filter(
    (edge) => hitIds.has(edge.from) && hitIds.has(edge.to),
  );
  view["trace-status"].textContent =
    trace.label +
    " · " +
    hits.length +
    " 个节点 · " +
    visibleEdges.length +
    " 条可见关系";
  const board = el("div", undefined, "graph-board");
  const canvas = el("canvas");
  canvas.setAttribute("aria-hidden", "true");
  board.append(canvas);
  const buttons = new Map();
  for (const lane of [3, 2, 1, 0]) {
    const group = el("div", undefined, "tier-lane");
    group.append(el("h3", tierLabel(lane)));
    for (const node of hits.filter((node) => node.tier === lane)) {
      const button = el("button", node.label, "node");
      button.type = "button";
      button.setAttribute("aria-pressed", selected === node.id);
      if (active && !active.has(node.id)) button.classList.add("dim");
      button.addEventListener("click", () => {
        state.selected = state.selected === node.id ? null : node.id;
        renderGraph(node.id);
      });
      group.append(button);
      buttons.set(node.id, button);
    }
    board.append(group);
  }
  view.graph.replaceChildren(
    hits.length ? board : el("p", "当前范围未找到企业。", "loading"),
  );
  if (hits.length) {
    graphObserver = new ResizeObserver(() =>
      drawPaths(canvas, board, buttons, visibleEdges, active),
    );
    graphObserver.observe(board);
  }
  buttons.get(focusId)?.focus({ preventScroll: true });
  renderNode(trace, selected);
  if (state.screen === "trace" && !byId("workspace-content").hidden) {
    renderTraceMap({
      api,
      container: view["trace-map"],
      status: view["map-status"],
      graph: view.graph,
      nodes: hits,
      edges: visibleEdges,
      selected,
      onSelect: (id) => {
        state.selected = id;
        renderGraph(id);
      },
    });
  }
}

function renderNode(trace, selected) {
  const box = view["node-detail"];
  const node = trace.nodes.find((item) => item.id === selected);
  box.replaceChildren(el("h3", node?.label || "节点详情"));
  const references = el("details", undefined, "source-list");
  const sources = node?.sources || trace.sources || [];
  if (sources.length) {
    references.append(el("summary", "品类资料 · " + sources.length + " 项"));
    for (const source of sources) {
      const link = el("a", source.label);
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      references.append(link);
    }
  }
  if (!node) {
    box.append(
      el(
        "p",
        "选择地图点位或下方企业，查看供应产品、上游来源与下游客户。",
        "muted",
      ),
    );
    if (sources.length) box.append(references);
    return;
  }
  box.append(
    el(
      "p",
      (node.partLabel ? node.partLabel + " · " : "") +
        tierLabel(node.tier) +
        " · " +
        node.city,
      "muted",
    ),
  );
  if (node.product) box.append(el("p", node.product, "node-product"));
  const list = el("ul");
  for (const edge of trace.edges.filter(
    (edge) => edge.from === node.id || edge.to === node.id,
  )) {
    const upstream = edge.to === node.id;
    const related = trace.nodes.find(
      (item) => item.id === (upstream ? edge.from : edge.to),
    );
    list.append(
      el(
        "li",
        (upstream ? "上游：" : "供向：") +
          related.label +
          (edge.status === "association" ? "（关联口径）" : "") +
          (edge.share != null
            ? " · " + edge.year + " 年占" + edge.basis + " " + edge.share + "%"
            : ""),
      ),
    );
  }
  box.append(list, el("p", trace.source.note, "muted"));
  if (sources.length) box.append(references);
  if (node.position) {
    const link = el("a", "在高德查看" + node.city);
    const url = new URL("https://uri.amap.com/marker");
    url.search = new URLSearchParams({
      position: node.position.join(","),
      name: node.city,
      coordinate: "gaode",
      callnative: "0",
    });
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener";
    box.append(link);
  }
}

async function loadTrace() {
  traceRequest?.abort();
  graphObserver?.disconnect();
  clearTraceMap(view["trace-map"]);
  view["map-status"].textContent = "";
  const req = (traceRequest = new AbortController());
  const id = state.detail?.id;
  const part = view.part.value;
  state.trace = state.selected = null;
  view.tier.value = view.search.value = "";
  view.graph.replaceChildren();
  view["node-detail"].replaceChildren();
  if (!id || !part) {
    view["trace-status"].textContent = "当前案例暂无可追溯部件。";
    return;
  }
  view["trace-status"].textContent = "正在读取供货关系…";
  try {
    const result = await request(
      "cases/" + id + "/trace?part=" + part,
      id + "-" + part,
      req.signal,
    );
    if (req.signal.aborted) return;
    state.trace = result.data;
    renderGraph();
  } catch {
    if (req.signal.aborted) return;
    view["trace-status"].textContent = "供货关系加载失败。";
    errorBox(view.graph, "可重新加载当前部件。", loadTrace);
  } finally {
    if (traceRequest === req) traceRequest = undefined;
  }
}

async function loadCase() {
  caseRequest?.abort();
  traceRequest?.abort();
  traceRequest = undefined;
  graphObserver?.disconnect();
  clearTraceMap(view["trace-map"]);
  view["map-status"].textContent = "";
  const req = (caseRequest = new AbortController());
  const id = view.case.value;
  if (!id) return;
  const period = view.period.value;
  state.detail = state.trace = state.selected = null;
  byId("workspace-content").hidden = false;
  byId("empty-state").hidden = true;
  byId("selection-note").textContent = "正在更新评价";
  view["overview-content"].className = "loading";
  view["overview-content"].textContent = "正在读取城市指标…";
  view["trade-content"].replaceChildren();
  byId("system-content").replaceChildren();
  view["dimension-nav"].replaceChildren();
  view["dimension-detail"].hidden = true;
  view.graph.replaceChildren();
  view["node-detail"].replaceChildren();
  view["trace-status"].textContent = "等待城市指标加载…";
  options(view.part, []);
  try {
    const result = await request(
      "index?case=" + id + "&period=" + period,
      id + "-" + period,
      req.signal,
    );
    if (req.signal.aborted) return;
    state.detail = result.data;
    byId("workspace-content").hidden = false;
    byId("empty-state").hidden = true;
    byId("selection-note").textContent =
      result.data.city + " · " + result.data.industry;
    const url = new URL(location.href);
    url.searchParams.set("city", result.data.cityId);
    url.searchParams.set("case", id);
    url.searchParams.set("period", period);
    history.replaceState(null, "", url);
    updateChannel(result.cached);
    renderOverview(result.data);
    renderSystem(result.data);
    const parts = result.data.traceParts.map((part) => [part.id, part.label]);
    if (id === "kaifeng-auto") parts.push(["all", "全品类 · 按层级查找"]);
    options(view.part, parts, result.data.trace?.partId);
    state.trace = result.data.trace || null;
    view.tier.value = view.search.value = "";
    applyRoute();
  } catch {
    if (req.signal.aborted) return;
    view["trace-status"].textContent = "当前案例无法加载。";
    showScreen("overview");
    byId("selection-note").textContent = "评价加载失败";
    errorBox(view["overview-content"], "评价加载失败。", loadCase);
  }
}

function clearSelection() {
  caseRequest?.abort();
  traceRequest?.abort();
  traceRequest = undefined;
  graphObserver?.disconnect();
  clearTraceMap(view["trace-map"]);
  state.detail = state.trace = state.selected = null;
  byId("workspace-content").hidden = true;
  byId("empty-state").hidden = false;
}

function selectCity(cityId, preferredCase, preferredPeriod) {
  clearSelection();
  if (!preferredCase) {
    state.screen = "overview";
    state.dimension = "coverage";
  }
  view.city.value = cityId;
  const entries = state.catalog.filter((item) => item.cityId === cityId);
  const prompt = cityId ? "请选择产业链" : "请先选择城市";
  options(
    view.case,
    [["", prompt], ...entries.map((item) => [item.id, item.industry])],
    preferredCase,
  );
  options(view.period, [["", "请选择产业链"]]);
  const city = entries[0]?.city;
  byId("empty-state").querySelector("h2").textContent = city
    ? "选择" + city + "的产业链"
    : "从一座城市开始";
  byId("empty-state").querySelector("p:not(.section-kicker)").textContent = city
    ? entries.map((item) => item.industry).join("、") +
      "，按同一口径评价供应能力。"
    : "选择城市，查看当地产业链的配套能力与供应资源。";
  byId("city-shortcuts").hidden = Boolean(cityId);
  byId("selection-note").textContent = city
    ? city + " · 请选择产业链"
    : "先选城市，再选产业链";
  const url = new URL(location.href);
  url.searchParams.delete("case");
  url.searchParams.delete("period");
  if (!preferredCase) url.hash = "";
  if (cityId) url.searchParams.set("city", cityId);
  else url.searchParams.delete("city");
  history.replaceState(null, "", url);
  if (view.case.value) configurePeriods(preferredPeriod);
}

function configurePeriods(preferred) {
  const selected = state.catalog.find((item) => item.id === view.case.value);
  if (!selected) {
    selectCity(view.city.value);
    return;
  }
  options(
    view.period,
    selected.periods.map((period) => [
      period,
      period.replace("-", " 年 ") + " 月",
    ]),
    preferred,
  );
  loadCase();
}

async function init() {
  try {
    const result = await request(
      "cases",
      "cases",
      new AbortController().signal,
    );
    state.catalog = result.data;
    const cities = Array.from(
      new Map(state.catalog.map((item) => [item.cityId, item.city])).entries(),
    );
    options(view.city, [["", "请选择城市"], ...cities]);
    const shortcuts = cities.map(([id, label]) => {
      const button = el("button", label);
      button.type = "button";
      button.onclick = () => {
        selectCity(id);
        view.case.focus();
      };
      return button;
    });
    byId("city-shortcuts").replaceChildren(...shortcuts);
    const query = new URLSearchParams(location.search);
    const selected = state.catalog.find(
      (item) => item.id === query.get("case"),
    );
    const cityId = selected?.cityId || query.get("city");
    selectCity(
      cities.some(([id]) => id === cityId) ? cityId : "",
      selected?.id,
      query.get("period"),
    );
  } catch {
    byId("city-shortcuts").hidden = false;
    errorBox(byId("city-shortcuts"), "城市目录加载失败。", init);
  }
}

view.city.addEventListener("change", () => selectCity(view.city.value));
view.case.addEventListener("change", () => configurePeriods(view.period.value));
view.period.addEventListener("change", loadCase);
view.part.addEventListener("change", loadTrace);
for (const id of ["tier", "search"])
  view[id].addEventListener("input", () => {
    state.selected = null;
    renderGraph();
  });
view.reset.addEventListener("click", () => {
  view.tier.value = view.search.value = "";
  state.selected = null;
  view.graph.scrollLeft = 0;
  fitTraceMap();
  renderGraph();
});
document.querySelectorAll("[data-screen]").forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showScreen(link.dataset.screen, state.dimension, true);
  }),
);
window.addEventListener("hashchange", applyRoute);
init();
