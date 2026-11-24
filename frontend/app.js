import { renderScoreTrend } from "./score-trend.js";
import {
  developmentDomain,
  scoreDomain,
  scorePoints,
} from "./score-trend-model.js";
import { el, number } from "./ui.js";
import { renderAnalysis } from "./analysis-views.js";
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
  entry: null,
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
let caseRequest, traceRequest, graphObserver, portraitObserver;
const tierLabel = (tier) => (tier === 0 ? "整机端" : "Tier " + tier);

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
    const response = await fetch("./data/" + snapshot + ".json?schema=5.2", {
      signal,
    });
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
    "button",
    data.index === null ? "暂不可计算" : number(data.index),
    "number score-open",
  );
  value.type = "button";
  value.disabled = data.index === null;
  value.setAttribute(
    "aria-label",
    "供应分 " + number(data.index) + "，查看计算过程",
  );
  value.setAttribute("aria-haspopup", "dialog");
  value.setAttribute("aria-controls", "calculation-dialog");
  value.onclick = () => openCalculation();
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
  const methodLink = el(
    "button",
    "查看计算过程",
    "text-link score-method-link",
  );
  methodLink.type = "button";
  methodLink.onclick = () => openCalculation();
  score.append(methodLink);
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
    action.onclick = () => openCalculation(priority.id);
    insight.append(action);
  } else {
    insight.append(
      el("h3", "四项指标已达优秀线"),
      el("p", "可继续查看各分项变化及供应企业的配套路径。"),
    );
  }
  grid.append(score, insight);
  const portrait = el("section", undefined, "supply-portrait");
  portrait.setAttribute("aria-label", "供应能力画像");
  const portraitHead = el("div", undefined, "portrait-heading");
  portraitHead.append(
    el("h3", "供应能力画像"),
    el("p", "点击指标，查看计算公式"),
  );
  const portraitBody = el("div", undefined, "portrait-body");
  const visual = el("figure", undefined, "portrait-visual");
  const canvas = el("canvas", undefined, "supply-radar");
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "四项标准化得分与优秀线对比。" +
      data.metrics
        .map((item) => item.name + "标准分 " + number(item.score))
        .join("，"),
  );
  const legend = el("figcaption", undefined, "portrait-legend");
  legend.append(
    el("span", "本期标准分", "current"),
    el("span", "优秀线", "goal"),
  );
  visual.append(canvas, legend);
  const indicators = el("div", undefined, "portrait-metrics");
  const metricDomain = scoreDomain(
    data.metrics.map((metric) =>
      scorePoints(data.analysis.development.history, "", {
        metricId: metric.id,
        endPeriod: data.period,
      }),
    ),
  );
  for (const item of data.metrics) {
    const button = el("button", undefined, "portrait-metric");
    button.type = "button";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "calculation-dialog");
    button.setAttribute(
      "aria-label",
      item.name + " " + number(item.value) + "%，查看计算公式",
    );
    const raw = el("strong", number(item.value));
    raw.append(el("small", "%"));
    button.append(
      el("span", item.name),
      raw,
      el(
        "small",
        item.grade + " · 权重 " + Math.round(item.weight * 100) + "%",
      ),
    );
    button.onclick = () => openCalculation(item.id);
    const card = el("article", undefined, "portrait-metric-card");
    card.append(
      button,
      el("p", "标准分月度走势", "portrait-trend-label"),
      renderScoreTrend(data.analysis.development.history, "", {
        metricId: item.id,
        title: item.name + "标准分月度走势",
        endPeriod: data.period,
        compact: true,
        domain: metricDomain,
        heading: false,
      }),
    );
    indicators.append(card);
  }
  portraitBody.append(visual, indicators);
  portrait.append(portraitHead, portraitBody);
  const facts = el("dl", undefined, "supply-volume");
  for (const [label, amount] of [
    ["本地采购", data.trade.origins[0].amount],
    ["购销规模", data.trade.total],
  ]) {
    const fact = el("div");
    const value = el("dd", number(amount));
    value.append(el("small", " 亿元"));
    fact.append(el("dt", label), value);
    facts.append(fact);
  }
  grid.classList.add("supply-overview-grid");
  score.classList.add("score-with-trend");
  const scoreSummary = score.querySelector(".score-summary");
  scoreSummary.remove();
  const copy = el("div", undefined, "score-current-copy");
  copy.append(...score.childNodes);
  score.replaceChildren(
    copy,
    renderScoreTrend(data.analysis.development.history, "supply", {
      title: "供应配套月度走势",
      endPeriod: data.period,
      domain: developmentDomain(data),
    }),
    scoreSummary,
  );
  grid.replaceChildren(score);
  const lower = el("div", undefined, "supply-insight-row");
  lower.append(insight, facts);
  view["overview-content"].className = "";
  view["overview-content"].replaceChildren(grid, lower, portrait);
  portraitObserver?.disconnect();
  portraitObserver = new ResizeObserver(() =>
    drawSupplyRadar(canvas, data.metrics),
  );
  portraitObserver.observe(canvas);
}

function drawSupplyRadar(canvas, metrics) {
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  if (metrics.some((item) => item.score === null)) {
    ctx.fillStyle = "#6d747c";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("部分指标暂无有效值", width / 2, height / 2);
    return;
  }
  const center = [width / 2, height / 2];
  const radius = Math.min(width / 2 - 83, height / 2 - 33);
  const point = (i, value) => {
    const angle = (i * Math.PI) / 2 - Math.PI / 2;
    return [
      center[0] + (Math.cos(angle) * radius * value) / 100,
      center[1] + (Math.sin(angle) * radius * value) / 100,
    ];
  };
  const polygon = (values) => {
    ctx.beginPath();
    values.forEach((v, i) =>
      i ? ctx.lineTo(...point(i, v)) : ctx.moveTo(...point(i, v)),
    );
    ctx.closePath();
  };
  for (const level of [25, 50, 75, 100]) {
    polygon(metrics.map(() => level));
    ctx.strokeStyle = "#e6eaed";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  metrics.forEach((item, i) => {
    ctx.beginPath();
    ctx.moveTo(...center);
    ctx.lineTo(...point(i, 100));
    ctx.strokeStyle = "#eef1f3";
    ctx.stroke();
  });
  polygon(
    metrics.map((item) =>
      item.direction === "positive" ? item.goal : 100 - item.goal,
    ),
  );
  ctx.strokeStyle = "#929da7";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.setLineDash([]);
  polygon(metrics.map((item) => item.score ?? 0));
  ctx.fillStyle = "rgba(171,35,58,.12)";
  ctx.fill();
  ctx.strokeStyle = "#a92d43";
  ctx.lineWidth = 2;
  ctx.stroke();
  metrics.forEach((item, i) => {
    const [x, y] = point(i, item.score ?? 0);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#a92d43";
    ctx.fill();
    const [lx, ly] = point(i, 100);
    ctx.font = '13px "Microsoft YaHei", system-ui, sans-serif';
    ctx.fillStyle = "#65707a";
    ctx.textAlign = i === 1 ? "left" : i === 3 ? "right" : "center";
    ctx.textBaseline = i === 0 ? "bottom" : i === 2 ? "top" : "middle";
    ctx.fillText(
      item.name,
      lx + (i === 1 ? 14 : i === 3 ? -14 : 0),
      ly + (i === 0 ? -13 : i === 2 ? 13 : 0),
    );
  });
}

function openCalculation(metricId) {
  const data = state.detail;
  if (!data) return;
  const dialog = byId("calculation-dialog");
  const body = byId("calculation-content");
  const footer = byId("calculation-actions");
  byId("calculation-context").textContent =
    data.city + " · " + data.industry + " · " + data.period;
  body.replaceChildren();
  footer.replaceChildren();
  if (metricId) {
    const item = data.metrics.find((metric) => metric.id === metricId);
    const numeratorLabels = {
      coverage: "稳定供应环节数",
      local: "本地采购额",
      cr5: "前五家供应商采购额",
      leader: "链主营收",
    };
    const denominatorLabels = {
      coverage: "关键环节总数",
      local: "链主采购总额",
      cr5: "采购总额",
      leader: "链上营收总额",
    };
    byId("calculation-title").textContent = item.name + "如何计算";
    if (item.value === null) {
      body.append(
        el("p", "当前分子或分母缺失，暂无有效计算结果。", "formula-note"),
      );
      if (!dialog.open) dialog.showModal();
      return;
    }
    const raw = el("div", undefined, "formula-raw");
    const ring = el("div", undefined, "formula-ring");
    ring.style.setProperty("--share", (item.value ?? 0) + "%");
    ring.setAttribute("aria-hidden", "true");
    ring.append(el("strong", number(item.value) + "%"));
    const formula = el("div", undefined, "formula-fraction");
    formula.append(
      el("span", numeratorLabels[metricId]),
      el("span", denominatorLabels[metricId]),
    );
    const fraction = el("div", undefined, "formula-expression");
    fraction.append(formula, el("span", "× 100%"));
    const unit = metricId === "coverage" ? "个" : "亿元";
    const rawText = el(
      "p",
      Number(item.numerator.toFixed(2)) +
        " ÷ " +
        Number(item.denominator.toFixed(2)) +
        " × 100% = " +
        number(item.value) +
        "%",
      "substitution",
    );
    const definition = el("div");
    definition.append(
      fraction,
      rawText,
      el("p", "数据单位为" + unit + "。", "formula-note"),
    );
    raw.append(ring, definition);
    const steps = el("div", undefined, "formula-steps");
    const scoring =
      item.direction === "positive"
        ? number(item.value) + " = " + number(item.score) + " 分"
        : "100 − " + number(item.value) + " = " + number(item.score) + " 分";
    for (const [label, value] of [
      [item.direction === "positive" ? "正向计分" : "逆向计分", scoring],
      [
        "计入供应分",
        number(item.score) +
          " × " +
          Math.round(item.weight * 100) +
          "% = " +
          number(item.contribution) +
          " 分",
      ],
    ]) {
      const step = el("div");
      step.append(el("span", label), el("strong", value));
      steps.append(step);
    }
    body.append(raw, el("p", item.note, "formula-note"), steps);
    const back = el("button", "返回供应分", "quiet");
    back.type = "button";
    back.onclick = () => openCalculation();
    const detail = el("button", "查看指标分析", "primary-button");
    detail.type = "button";
    detail.onclick = () => {
      dialog.close();
      showScreen("dimensions", metricId, true);
    };
    footer.append(back, detail);
  } else {
    byId("calculation-title").textContent = "供应分的计算过程";
    body.append(
      el("p", "四项指标折算为同一计分方向，再按权重相加。", "formula-note"),
    );
    const terms = el("div", undefined, "calculation-terms");
    for (const item of data.metrics) {
      const term = el("button", undefined, "calculation-term");
      term.type = "button";
      term.append(
        el("span", item.name),
        el(
          "strong",
          number(item.score) + " × " + Math.round(item.weight * 100) + "%",
        ),
        el("small", "贡献 " + number(item.contribution) + " 分"),
      );
      term.onclick = () => openCalculation(item.id);
      terms.append(term);
    }
    const total = el("p", undefined, "calculation-total");
    total.append(
      el(
        "span",
        data.metrics.map((item) => number(item.contribution)).join(" ＋ ") +
          " ＝ ",
      ),
      el("strong", number(data.index)),
      el("small", " 分"),
    );
    body.append(
      terms,
      total,
      el(
        "p",
        "按原始精度计算，展示时保留一位小数。点击指标可继续查看分子、分母及计分方向。",
        "formula-note",
      ),
    );
  }
  if (!dialog.open) dialog.showModal();
}

function showScreen(
  screen,
  dimension = state.dimension,
  updateHash = false,
  focusProblem = false,
) {
  const gapTab = screen.startsWith("gap-") ? screen.slice(4) : null;
  const requested = screen;
  if (gapTab) screen = "gap";
  if (screen === "system") screen = "overview";
  state.screen = screen;
  state.dimension = dimension || "coverage";
  const supplyScreens = [
    "supply",
    "supply-indicators",
    "dimensions",
    "trade",
    "trace",
  ];
  const outer = supplyScreens.includes(screen) ? "supply" : screen;
  for (const name of ["overview", "logistics", "supply", "resilience", "gap"])
    byId(name).hidden = name !== outer;
  for (const name of [
    "supply-overview",
    "supply-indicators",
    "dimensions",
    "trade",
    "trace",
  ])
    byId(name).hidden =
      name !== (screen === "supply" ? "supply-overview" : screen);
  document.querySelectorAll(".scene-nav [data-screen]").forEach((link) => {
    if (link.dataset.screen === outer)
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelectorAll(".supply-nav [data-screen]").forEach((link) => {
    if (link.dataset.screen === screen)
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (updateHash)
    history.replaceState(
      null,
      "",
      "#" + (screen === "dimensions" ? state.dimension : requested),
    );
  document.body.classList.add("analysis-mode");
  byId("view-directory").hidden = true;
  byId("workspace-content").hidden = false;
  byId("empty-state").hidden = true;
  byId("selection-required").hidden = Boolean(state.detail);
  byId("workspace-content").classList.toggle("context-required", !state.detail);
  if (!state.detail) {
    state.entry = requested;
    byId("selection-required-title").textContent = {
      overview: "产业链发展总览",
      logistics: "产业链物流分析",
      supply: "产业链供应分析",
      resilience: "产业链韧性分析",
      gap: "产业链差距分析",
    }[outer];
    if (updateHash)
      byId("evaluation-selection").scrollIntoView({ block: "start" });
    return;
  }
  if (gapTab) byId("gap-tab-" + gapTab)?.click();
  if (gapTab === "actions" && focusProblem)
    document.querySelector('[data-problem="' + dimension + '"]')?.click();
  if (screen === "dimensions") showDimension(state.dimension);
  if (screen === "trade") renderTrade(state.detail.trade, state.dimension);
  if (screen === "trace") {
    if (state.trace) renderGraph();
    else if (!traceRequest) loadTrace();
  } else graphObserver?.disconnect();
  if (updateHash)
    document.querySelector(".scene-nav").scrollIntoView({ block: "start" });
}

function applyRoute() {
  const hash = location.hash.slice(1);
  if (hash === "intro") return showIntro();
  if (hash === "evaluation-selection") return;
  if (Object.hasOwn(dimensions, hash)) return showScreen("dimensions", hash);
  const destinations = [
    "overview",
    "logistics",
    "supply",
    "resilience",
    "gap",
    "dimensions",
    "supply-indicators",
    "trade",
    "trace",
    "system",
    "gap-actions",
    "gap-review",
  ];
  showScreen(destinations.includes(hash) ? hash : "overview");
  if (hash === "system" && state.detail) byId("system").scrollIntoView();
}

function openTracePart(partId) {
  if (!state.detail) return;
  showScreen("trace", "coverage", true);
  if (partId && [...view.part.options].some((item) => item.value === partId)) {
    view.part.value = partId;
    loadTrace();
  }
  byId("trace").scrollIntoView();
}

function openDevelopmentMethod(viewId) {
  const data = state.detail;
  if (!data?.analysis) return;
  const dialog = byId("calculation-dialog");
  byId("calculation-context").textContent =
    data.city + " · " + data.industry + " · " + data.period;
  byId("calculation-actions").replaceChildren();
  const body = byId("calculation-content");
  const components = data.analysis.development.components;
  const terms = viewId
    ? data.analysis.gap.metrics.filter((item) => item.view === viewId)
    : components;
  byId("calculation-title").textContent = viewId
    ? components.find((item) => item.id === viewId).name + "如何计算"
    : "产业链发展指数如何计算";
  const values = el("div", undefined, "calculation-terms");
  for (const term of terms) {
    const row = el("div", undefined, "calculation-term");
    row.append(
      el("span", term.name),
      el(
        "strong",
        number(term.score) + " × " + Math.round(term.weight * 100) + "%",
      ),
      el("small", "贡献 " + number(term.score * term.weight) + " 分"),
    );
    values.append(row);
  }
  const total = viewId
    ? components.find((item) => item.id === viewId).score
    : data.analysis.development.score;
  const answer = el("p", undefined, "calculation-total");
  answer.append(
    el("span", "合计 "),
    el("strong", number(total)),
    el("small", " 分"),
  );
  body.replaceChildren(
    el(
      "p",
      viewId
        ? "各项指标按同一计分方向标准化后合成。"
        : "物流、供应、韧性按 30%、40%、30% 合成总指数。差距视图用于对标、改进和成效复算。",
      "formula-note",
    ),
    values,
    answer,
  );
  if (!dialog.open) dialog.showModal();
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
  const value = el("button", number(item.value) + "%", "metric-value");
  value.type = "button";
  value.setAttribute("aria-label", "查看" + item.name + "计算公式");
  value.onclick = () => openCalculation(item.id);
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
  detail.append(
    renderScoreTrend(state.detail.analysis.development.history, "", {
      metricId: key,
      title: "标准分月度走势",
      endPeriod: state.detail.period,
    }),
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

function renderTradeOrigins(trade) {
  const panel = el("article", undefined, "trade-origins trade-card");
  panel.append(el("h3", "采购来源地"));
  const figure = el("figure", undefined, "origins-figure");
  const localShare =
    trade.purchase > 0
      ? (trade.origins[0].amount / trade.purchase) * 100
      : null;
  const donut = el("button", undefined, "origins-donut");
  donut.type = "button";
  donut.disabled = localShare === null;
  donut.setAttribute(
    "aria-label",
    "本地配套率 " + number(localShare) + "%，查看计算公式",
  );
  donut.setAttribute("aria-haspopup", "dialog");
  donut.onclick = () => openCalculation("local");
  const colors = ["#ab3a50", "#c4a9b0", "#e2e7ec"];
  let cursor = 0;
  const segments = trade.origins.map((origin, i) => {
    const start = cursor;
    cursor += trade.purchase > 0 ? (origin.amount / trade.purchase) * 100 : 0;
    return colors[i] + " " + start + "% " + cursor + "%";
  });
  donut.style.background =
    trade.purchase > 0
      ? "conic-gradient(" + segments.join(",") + ")"
      : "#e2e7ec";
  const center = el("span", undefined, "origins-center");
  const value = el("strong", number(localShare));
  value.append(el("small", "%"));
  center.append(value, el("span", "本地配套"));
  donut.append(center);
  const legend = el("dl", undefined, "origins-legend");
  for (const [i, origin] of trade.origins.entries()) {
    const row = el("div");
    const label = el("dt", origin.label);
    label.style.setProperty("--origin-color", colors[i]);
    const amount = el("dd", number(origin.amount));
    amount.append(
      el("small", "亿元"),
      el(
        "span",
        trade.purchase > 0
          ? number((origin.amount / trade.purchase) * 100) + "%"
          : "—",
      ),
    );
    row.append(label, amount);
    legend.append(row);
  }
  figure.append(donut, legend);
  panel.append(figure);
  return panel;
}

function renderTradeCategories(trade) {
  const panel = el("article", undefined, "trade-categories trade-card");
  const heading = el("div", undefined, "trade-chart-heading");
  heading.append(el("h3", "品类购销额"), el("span", "亿元"));
  panel.append(heading);
  const rows = el("div", undefined, "trade-category-chart");
  const max = Math.max(1, ...trade.categories.map((item) => item.amount));
  for (const item of trade.categories) {
    const row = el(
      item.traceId ? "button" : "div",
      undefined,
      "trade-category-row",
    );
    if (item.traceId) {
      row.type = "button";
      row.setAttribute(
        "aria-label",
        item.label + " " + number(item.amount) + "亿元，查看供应关系",
      );
      row.onclick = () => {
        showScreen("trace", "coverage", true);
        view.part.value = item.traceId;
        loadTrace();
        byId("trace").scrollIntoView();
        view.part.focus({ preventScroll: true });
      };
    }
    const label = el("span", item.label, "trade-category-label");
    const amount = el("strong", number(item.amount));
    const bar = el("meter");
    bar.max = max;
    bar.value = item.amount;
    bar.setAttribute("aria-label", item.label + "购销额（亿元）");
    row.append(label, amount, bar);
    rows.append(row);
  }
  panel.append(rows);
  return panel;
}

function renderTradeSuppliers(trade) {
  const panel = el("article", undefined, "trade-suppliers trade-card");
  const summary = el("div", undefined, "supplier-summary");
  summary.append(el("h3", "前五家供应商"));
  const score = el("button", undefined, "supplier-concentration");
  score.type = "button";
  const share =
    trade.purchase > 0 ? (trade.topFive / trade.purchase) * 100 : null;
  score.setAttribute(
    "aria-label",
    "供应商集中度 " + number(share) + "%，查看计算公式",
  );
  score.setAttribute("aria-haspopup", "dialog");
  score.onclick = () => openCalculation("cr5");
  score.append(el("strong", number(share)), el("small", "%"));
  summary.append(score, el("p", "占采购总额", "supplier-share-label"));
  const total = el(
    "p",
    "合计采购 " + number(trade.topFive) + " 亿元",
    "supplier-total",
  );
  const remainder = el(
    "p",
    "其余供应商 " + number(trade.purchase - trade.topFive) + " 亿元",
    "supplier-remainder",
  );
  summary.append(total, remainder);
  const figure = el("figure", undefined, "supplier-figure");
  figure.append(el("figcaption", "采购额（亿元） · 占采购总额的比例"));
  const graph = el("div", undefined, "supplier-graph");
  const scale =
    Math.ceil(Math.max(1, ...trade.suppliers.map((item) => item.amount)) * 2) /
    2;
  const axis = el("div", undefined, "supplier-axis");
  axis.setAttribute("aria-hidden", "true");
  for (const value of [scale, scale / 2, 0])
    axis.append(el("span", number(value)));
  const columns = el("div", undefined, "supplier-columns");
  for (const item of trade.suppliers) {
    const column = el("div", undefined, "supplier-column");
    const plot = el("div", undefined, "supplier-bar-plot");
    plot.style.setProperty("--bar-height", (item.amount / scale) * 150 + "px");
    const reading = el("div", undefined, "supplier-reading");
    reading.append(
      el("strong", number(item.amount)),
      el("span", number(item.percent) + "%"),
    );
    const bar = el("div", undefined, "supplier-bar");
    bar.setAttribute("aria-hidden", "true");
    plot.append(reading, bar);
    column.append(plot, el("p", item.label));
    columns.append(column);
  }
  graph.append(axis, columns);
  figure.append(graph);
  panel.append(summary, figure);
  return panel;
}

function renderTrade(trade, dimension) {
  const kpis = el("dl", undefined, "trade-kpi");
  for (const [label, value] of [
    ["采购额", trade.purchase],
    ["销售额", trade.sales],
    ["购销合计", trade.total],
  ]) {
    const tile = el("div", undefined, "trade-stat");
    const amount = el("dd", number(value));
    amount.append(el("small", "亿元"));
    tile.append(el("dt", label), amount);
    kpis.append(tile);
  }
  const distribution = el("div", undefined, "trade-distribution");
  distribution.append(renderTradeOrigins(trade), renderTradeCategories(trade));
  const suppliers = renderTradeSuppliers(trade);
  view["trade-content"].replaceChildren(
    kpis,
    ...(dimension === "cr5"
      ? [suppliers, distribution]
      : [distribution, suppliers]),
  );
}

function renderSystem(data) {
  const root = byId("system-content");
  const assessment = data.analysis?.assessment ?? data.assessment;
  if (!assessment) {
    root.replaceChildren(el("p", "当前数据尚不足以形成完整研判。", "muted"));
    return;
  }
  const conclusion = el("article", undefined, "assessment-conclusion");
  conclusion.append(
    el("p", "本期结论", "section-kicker"),
    el("h3", assessment.headline),
    el("p", assessment.summary),
  );
  const evidence = el("div", undefined, "assessment-evidence");
  for (const finding of assessment.findings) {
    const article = el("article");
    const title = el("button", finding.title, "evidence-title");
    title.type = "button";
    title.onclick = () =>
      finding.route
        ? showScreen(finding.route, state.dimension, true)
        : showScreen("dimensions", finding.dimension, true);
    article.append(title, el("p", finding.text));
    evidence.append(article);
  }
  const context = el("article", undefined, "assessment-context");
  context.append(
    el("h3", assessment.development.title),
    el("p", assessment.development.text),
  );
  const actions = el("section", undefined, "assessment-actions");
  actions.append(el("h3", "本期建议"));
  const list = el("div", undefined, "assessment-action-list");
  for (const action of assessment.actions) {
    const article = el("article");
    const heading = el("button", action.title, "text-link");
    heading.type = "button";
    heading.onclick = () =>
      action.route
        ? showScreen(
            action.route,
            action.dimension || state.dimension,
            true,
            Boolean(action.dimension),
          )
        : showScreen("dimensions", action.dimension, true);
    article.append(heading, el("p", action.text));
    list.append(article);
  }
  if (!assessment.actions.length)
    list.append(el("p", "持续跟踪关键供应商交付与采购份额，巩固现有配套。"));
  actions.append(list);
  root.replaceChildren(conclusion, evidence, context, actions);
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
  portraitObserver?.disconnect();
  if (byId("calculation-dialog").open) byId("calculation-dialog").close();
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
  byId("development-content").replaceChildren(
    el("p", "正在汇总物流、供应与韧性数据…", "loading"),
  );
  for (const id of [
    "logistics-content",
    "resilience-content",
    "gap-content",
    "mechanism-content",
  ])
    byId(id).replaceChildren();
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
    byId("selection-note").textContent = "";
    const url = new URL(location.href);
    url.searchParams.set("city", result.data.cityId);
    url.searchParams.set("case", id);
    url.searchParams.set("period", period);
    history.replaceState(null, "", url);
    updateChannel(result.cached);
    byId("view-directory").hidden = true;
    renderOverview(result.data);
    renderAnalysis(result.data, {
      navigate: (route, metricId) =>
        showScreen(route, metricId || state.dimension, true, Boolean(metricId)),
      openTrace: openTracePart,
      showMethod: openDevelopmentMethod,
    });
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
    errorBox(byId("development-content"), "评价加载失败。", loadCase);
  }
}

function clearSelection() {
  portraitObserver?.disconnect();
  if (byId("calculation-dialog").open) byId("calculation-dialog").close();
  caseRequest?.abort();
  traceRequest?.abort();
  traceRequest = undefined;
  graphObserver?.disconnect();
  clearTraceMap(view["trace-map"]);
  state.detail = state.trace = state.selected = null;
  byId("workspace-content").hidden = true;
  byId("empty-state").hidden = false;
  byId("view-directory").hidden = false;
}

function selectCity(cityId, preferredCase, preferredPeriod) {
  if (state.detail && document.body.classList.contains("analysis-mode"))
    state.entry = location.hash.slice(1) || state.screen;
  clearSelection();
  if (!preferredCase && !state.entry) {
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
  if (!preferredCase && !state.entry) url.hash = "";
  if (cityId) url.searchParams.set("city", cityId);
  else url.searchParams.delete("city");
  history.replaceState(null, "", url);
  if (view.case.value) configurePeriods(preferredPeriod);
  else if (state.entry) showScreen(state.entry, state.dimension, true);
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
    const entryHash = location.hash.slice(1);
    if (
      [
        "overview",
        "logistics",
        "supply",
        "resilience",
        "gap",
        "trace",
        "supply-indicators",
        "gap-actions",
        "gap-review",
      ].includes(entryHash)
    )
      state.entry = entryHash;
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
byId("calculation-close").addEventListener("click", () =>
  byId("calculation-dialog").close(),
);
byId("calculation-dialog").addEventListener("click", (event) => {
  if (event.target === byId("calculation-dialog"))
    byId("calculation-dialog").close();
});
function showIntro() {
  state.entry = null;
  document.body.classList.remove("analysis-mode");
  byId("workspace-content").hidden = true;
  byId("view-directory").hidden = false;
  byId("empty-state").hidden = Boolean(state.detail);
  history.replaceState(null, "", "#intro");
  document.querySelector(".purpose-hero").scrollIntoView({ block: "start" });
}
byId("back-intro").onclick = showIntro;
document.querySelectorAll("[data-entry]").forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    state.entry = link.dataset.entry;
    showScreen(state.entry, state.dimension, true);
  }),
);
init();
