import { renderScoreTrend } from "./score-trend.js";
import {
  developmentDomain,
  scoreDomain,
  scorePoints,
} from "./score-trend-model.js";
import { renderResilience } from "./resilience-view.js";
import { renderIndicatorWorkspace } from "./indicator-workspace.js";
import { el, number, recordButton, recordHeading } from "./ui.js";
import { simulateDevelopment } from "./analysis-model.js";

const byId = (id) => document.getElementById(id);
function button(text, click, className = "view-button") {
  const node = el("button", text, className);
  node.type = "button";
  node.onclick = click;
  return node;
}
function panel(title, className = "") {
  const node = el("article", undefined, "analysis-panel " + className);
  if (title) node.append(el("h3", title));
  return node;
}
function table(headings, rows) {
  const wrapper = el("div", undefined, "analysis-table-scroll");
  const grid = el("table", undefined, "analysis-table");
  const head = el("thead");
  const tr = el("tr");
  for (const text of headings) {
    const th = el("th", text);
    th.scope = "col";
    tr.append(th);
  }
  head.append(tr);
  const body = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    for (const cell of row) {
      const td = el("td");
      td.append(
        cell instanceof Node ? cell : document.createTextNode(String(cell)),
      );
      tr.append(td);
    }
    body.append(tr);
  }
  grid.append(head, body);
  wrapper.append(grid);
  return wrapper;
}
function stat(label, value, note) {
  const node = el("div", undefined, "analysis-stat");
  node.append(el("span", label), el("strong", value));
  if (note) node.append(el("small", note));
  return node;
}
function scoreLink(label, value, click) {
  const node = button("", click, "analysis-score-link");
  node.append(el("strong", number(value)), el("small", label));
  return node;
}

function renderDevelopment(data, actions) {
  const { development, gap } = data.analysis;
  byId("development-context").textContent =
    data.city + " · " + data.industry + " · " + data.period;
  const overview = panel("", "development-summary");
  const domain = developmentDomain(data);
  const total = el("div", undefined, "development-total");
  total.append(el("p", "产业链发展指数", "section-kicker"));
  const score = button("", () => actions.showMethod(), "development-score");
  score.setAttribute(
    "aria-label",
    "发展总指数 " + number(development.score) + "，查看计算过程",
  );
  score.append(el("strong", number(development.score)), el("small", "/ 100"));
  total.append(score);
  const change = development.previous
    ? development.score - development.previous.score
    : null;
  total.append(
    el(
      "p",
      change === null
        ? "首个评价月份"
        : "较上期" +
            (change >= 0 ? "提升 " : "下降 ") +
            number(Math.abs(change)) +
            " 分",
      "development-change",
    ),
  );
  total.append(button("查看计算方法", () => actions.showMethod(), "text-link"));
  const components = el("div", undefined, "development-components");
  for (const component of development.components) {
    const card = el("article");
    card.append(
      button(
        component.name,
        () => actions.navigate(component.id),
        "component-name",
      ),
    );
    card.append(
      scoreLink("分", component.score, () => actions.showMethod(component.id)),
      el("p", "总指数权重 " + Math.round(component.weight * 100) + "%"),
    );
    card.append(
      renderScoreTrend(development.history, component.id, {
        title: component.name + "月度走势",
        endPeriod: data.period,
        compact: true,
        domain,
        heading: false,
      }),
    );
    components.append(card);
  }
  const primary = el("div", undefined, "development-primary");
  primary.append(
    total,
    renderScoreTrend(development.history, "development", {
      title: "发展指数月度走势",
      endPeriod: data.period,
      domain,
    }),
  );
  overview.append(primary, components);
  byId("development-content").replaceChildren(overview);
  const loop = el("section", undefined, "mechanism-loop");
  loop.append(el("h3", "从判断走到行动与成效"));
  const items = el("div", undefined, "mechanism-items");
  for (const [title, value, copy, route] of [
    [
      "看健康",
      number(development.score) + " 分",
      "总指数与分项判断发展质量",
      "overview",
    ],
    [
      "查问题",
      gap.problems.length + " 项",
      "定位薄弱指标与核验因素",
      "gap-actions",
    ],
    [
      "定行动",
      new Set(gap.problems.map((item) => item.owner)).size + " 类责任岗位",
      "明确建议措施、牵头岗位与期限",
      "gap-actions",
    ],
    [
      "验成效",
      development.history.length + " 期观测",
      "按相同指标与权重复算",
      "gap-review",
    ],
  ]) {
    const item = button("", () => actions.navigate(route), "mechanism-item");
    item.append(el("span", title), el("strong", value), el("small", copy));
    items.append(item);
  }
  loop.append(items);
  byId("mechanism-content").replaceChildren(loop);
}

function renderLogistics(data, actions) {
  const model = data.analysis.logistics;
  const summary = panel("", "score-trend-panel logistics-score-panel");
  const current = el("div", undefined, "score-trend-current");
  current.append(
    el("p", "物流保障分", "section-kicker"),
    scoreLink("分", model.score, () => actions.showMethod("logistics")),
  );
  const prior = data.analysis.development.history.find(
    (point) => point.period < data.period,
  );
  current.append(
    el(
      "p",
      prior
        ? "较上月 " +
            (model.score - prior.logistics >= 0 ? "+" : "") +
            number(model.score - prior.logistics) +
            " 分"
        : "首个统计月份",
      "score-trend-change",
    ),
  );
  const facts = el("div", undefined, "score-trend-facts");
  facts.append(
    stat("月度货流", number(model.volume) + " 万吨"),
    stat("准时交付", number(data.evaluation.ontime) + "%"),
    stat("单证互通", number(model.documentConnectivity) + "%"),
  );
  summary.append(
    current,
    renderScoreTrend(data.analysis.development.history, "logistics", {
      title: "物流保障月度走势",
      endPeriod: data.period,
      domain: developmentDomain(data),
    }),
    facts,
  );
  const routes = panel("", "logistics-routes");
  const enterRoutes = recordButton("录入原料进货", () =>
    actions.openRecord("routes", { panel: "routes", direction: routes.dataset.direction }));
  routes.append(recordHeading(el("h3", "原料进货与成品发运"), enterRoutes));
  const filter = el("div", undefined, "analysis-segmented");
  const content = el("div");
  const showRoutes = (direction) => {
    routes.dataset.direction = direction;
    enterRoutes.textContent = "录入" + direction;
    enterRoutes.setAttribute("aria-label", enterRoutes.textContent);
    filter
      .querySelectorAll("button")
      .forEach((node) =>
        node.setAttribute(
          "aria-pressed",
          String(node.textContent === direction),
        ),
      );
    content.replaceChildren(
      table(
        ["品类", "途经节点", "运输方式", "运量（万吨）"],
        model.routes
          .filter((row) => row.direction === direction)
          .map((row) => [
            row.goods,
            row.path.join(" → "),
            row.mode,
            number(row.volume),
          ]),
      ),
    );
  };
  for (const direction of ["原料进货", "成品发运"])
    filter.append(button(direction, () => showRoutes(direction)));
  routes.append(filter, content);
  showRoutes("原料进货");
  const grid = el("div", undefined, "analysis-two-column");
  const modes = panel("运输方式结构");
  const stack = el("div", undefined, "transport-stack");
  const legend = el("div", undefined, "transport-legend");
  model.modes.forEach((item, i) => {
    const block = el("span");
    block.style.flex = item.share;
    block.dataset.mode = String(i);
    block.title = item.label + " " + number(item.share) + "%";
    stack.append(block);
    legend.append(stat(item.label, number(item.share) + "%"));
  });
  modes.append(
    stack,
    legend,
    el(
      "p",
      (model.modes.find(item => item.label === "公路")?.share ?? 0) > 70
        ? "公路占比较高，可结合节点条件评估铁路或水运衔接。"
        : "运输方式结构较均衡，可继续核对换装时间和干线班期。",
      "analysis-reading",
    ),
  );
  const nodes = panel("");
  nodes.append(recordHeading(el("h3", "关键物流节点"),
    recordButton("录入节点", () => actions.openRecord("logistics", { panel: "nodes" }))));
  const path = el("div", undefined, "logistics-nodes");
  for (const item of model.nodes) {
    const node = el("div");
    node.append(el("strong", item.name), el("span", item.role));
    path.append(node);
  }
  nodes.append(path);
  grid.append(modes, nodes);
  const indicators = el("div");
  indicators.id = "logistics-indicators";
  renderIndicatorWorkspace(indicators, data, "logistics", actions);
  const indicatorCount = data.analysis.indicators.filter(item => item.view === "logistics").length;
  const viewIndicators = button(
    "查看 " + indicatorCount + " 项指标",
    () => {
      indicators.scrollIntoView({ block: "start" });
      const selector = indicators.querySelector(".indicator-selector");
      const control = selector.getClientRects().length
        ? selector.querySelector('[aria-pressed="true"]')
        : indicators.querySelector("select");
      control?.focus({ preventScroll: true });
    },
    "text-link indicator-section-link",
  );
  current.append(viewIndicators);
  byId("logistics-content").replaceChildren(
    summary,
    routes,
    grid,
    indicators,
  );
}

function renderGap(data, actions) {
  const model = data.analysis.gap;
  const root = byId("gap-content");
  const tabs = el("nav", undefined, "gap-nav");
  tabs.setAttribute("aria-label", "从对标到改进与复算");
  const sections = {
    compare: el("section"),
    actions: el("section"),
    review: el("section"),
  };
  const showTab = (key) => {
    for (const [id, node] of Object.entries(sections)) node.hidden = id !== key;
    tabs
      .querySelectorAll("button")
      .forEach((node) =>
        node.setAttribute("aria-pressed", String(node.dataset.tab === key)),
      );
  };
  for (const [key, label] of [
    ["compare", "同类城市对标"],
    ["actions", "问题与行动"],
    ["review", "成效复算"],
  ]) {
    const tab = button(label, () => showTab(key));
    tab.dataset.tab = key;
    tab.id = "gap-tab-" + key;
    tabs.append(tab);
  }
  const peers = el("select");
  peers.id = "benchmark-city";
  peers.setAttribute("aria-label", "同类产业对标城市");
  for (const [sameProvince, label] of [[true, "省内城市"], [false, "跨省城市"]]) {
    const candidates = model.peers.filter(peer => Boolean(peer.sameProvince) === sameProvince);
    if (!candidates.length) continue;
    const group = el("optgroup");
    group.label = label;
    for (const peer of candidates) group.append(new Option(
      peer.city + (peer.cityGDPGapRate == null ? "" : " · GDP 相差 " + number(peer.cityGDPGapRate) + "%"), peer.id
    ));
    peers.append(group);
  }
  const comparison = panel("与同类产业链比较");
  const selectLabel = el("label", "对标城市");
  selectLabel.append(peers);
  comparison.append(selectLabel);
  const comparisonBody = el("div");
  comparison.append(comparisonBody);
  const gapIndicators = el("div");
  const showPeer = () => {
    const peer = model.peers.find((item) => item.id === peers.value);
    if (!peer) {
      comparisonBody.replaceChildren(
        el("p", "本期同类城市数据尚未齐备。", "analysis-reading"),
      );
      return;
    }
    const delta = peer.development - model.current.development;
    const gdpGap =
      ((peer.addedValue - model.current.addedValue) / peer.addedValue) * 100;
    const stage = el("div", undefined, "city-versus-stage");
    const cityHistories = [
      data.analysis.development.history,
      model.peerHistory?.[peer.id] ?? [],
    ];
    const comparisonDomain = scoreDomain(
      cityHistories.map((history) =>
        scorePoints(history, "development", { endPeriod: data.period }),
      ),
    );
    const cityCard = (city, role, tone) => {
      const card = el("article", undefined, "city-versus-card " + tone);
      const menu = el("details", undefined, "city-record-menu");
      const trigger = el("summary", "录入数据", "record-link");
      trigger.setAttribute("aria-label", "录入" + city.city + "数据");
      const menuItems = el("div", undefined, "city-record-options");
      for (const [group, label, panel] of [
        ["gap", "产业增加值", "base"],
        ["routes", "货流与线路", "routes"],
        ["logistics", "节点与履约", "cost"],
        ["supply", "采购与配套", "trade"],
        ["resilience", "保供与预警", "supply"],
      ]) {
        menuItems.append(recordButton(label, () => {
          menu.open = false;
          actions.openRecord(group, { panel }, city);
        }, city.city + " · " + label));
      }
      menu.append(trigger, menuItems);
      menu.addEventListener("focusout", event => {
        if (!menu.contains(event.relatedTarget)) menu.open = false;
      });
      menu.addEventListener("keydown", event => {
        if (event.key === "Escape") {
          menu.open = false;
          trigger.focus();
        }
      });
      card.append(
        recordHeading(el("p", role, "section-kicker"), menu),
        el("h3", city.city),
        el("p", city.industry + " · " + city.period, "city-versus-context"),
      );
      const total = el("div", undefined, "city-versus-total");
      total.append(
        el("span", "产业链发展指数"),
        el("strong", number(city.development)),
        el("small", "/ 100"),
      );
      const numberBox = el("div", undefined, "city-total-number");
      numberBox.append(...[...total.children].slice(1));
      total.append(
        numberBox,
        renderScoreTrend(
          city.id === data.id
            ? data.analysis.development.history
            : (model.peerHistory?.[city.id] ?? []),
          "development",
          {
            title: city.city + "发展指数月度走势",
            endPeriod: data.period,
            compact: true,
            domain: comparisonDomain,
            heading: false,
          },
        ),
      );
      total.classList.add("with-trend");
      card.append(total);
      const dimensions = el("div", undefined, "city-versus-dimensions");
      for (const component of data.analysis.development.components) {
        const row = el("div");
        const meter = el("meter");
        meter.min = 0;
        meter.max = 100;
        meter.value = city[component.id];
        meter.setAttribute("aria-label", city.city + component.name + "得分");
        row.append(
          el("span", component.name),
          el("strong", number(city[component.id])),
          meter,
        );
        dimensions.append(row);
      }
      card.append(
        dimensions,
        stat("产业链增加值", number(city.addedValue) + " 亿元"),
      );
      return card;
    };
    stage.append(
      cityCard(model.current, "本市产业链", "current"),
      el("span", "VS", "city-versus-divider"),
      cityCard(peer, "对标产业链", "peer"),
    );
    const verdict = el("div", undefined, "city-versus-verdict");
    verdict.append(
      stat(
        delta >= 0 ? "发展指数差距" : "发展指数领先",
        number(Math.abs(delta)) + " 分",
      ),
      stat(
        gdpGap >= 0 ? "产业增加值差距率" : "产业增加值领先幅度",
        number(Math.abs(gdpGap)) + "%",
      ),
    );
    const gaps = data.analysis.development.components
      .map((item) => ({
        name: item.name,
        gap: peer[item.id] - model.current[item.id],
      }))
      .sort((a, b) => b.gap - a.gap);
    const reading = el(
      "p",
      gaps[0].gap > 0
        ? gaps[0].name +
            "差距最大，低于" +
            peer.city +
            " " +
            number(gaps[0].gap) +
            " 分。继续下钻指标，定位改进事项。"
        : "三项分指数均达到或超过所选城市，继续跟踪关键环节与供应连续性。",
      "benchmark-reading",
    );
    const basis = el("p", peer.year
      ? peer.year + " 年城市 GDP · " + model.current.city + " " + number(peer.currentGDP) + " 亿元 / " +
        peer.city + " " + number(peer.cityGDP) + " 亿元 · 相差 " + number(peer.cityGDPGap) + " 亿元"
      : "同产业城市对比", "benchmark-basis");
    if (peer.source) {
      for (const [label, href] of [["本市 GDP 来源", peer.currentSource], ["对标 GDP 来源", peer.source]]) {
        const source = el("a", label);
        source.href = href;
        source.target = "_blank";
        source.rel = "noopener";
        basis.append(source);
      }
      const entry = el("a", "查看对标城市数据");
      const url = new URL(location.href);
      url.searchParams.set("city", peer.cityId);
      url.searchParams.set("case", peer.id);
      url.hash = "#gap";
      entry.href = url;
      basis.append(entry);
    }
    comparisonBody.replaceChildren(basis, stage, verdict, reading);
    renderIndicatorWorkspace(gapIndicators, data, "gap", actions, peer.id);
  };
  peers.onchange = showPeer;
  showPeer();
  sections.compare.append(
    comparison,
    button("定位问题并安排改进", () => showTab("actions"), "primary-button"),
    gapIndicators,
  );
  const problemPanel = panel("");
  problemPanel.append(recordHeading(el("h3", "指标差距形成的问题清单"),
    recordButton("录入改进任务", () => actions.openRecord("gap", { panel: "tasks" }))));
  const detail = panel("", "problem-detail");
  const gotoMetric = (metric) =>
    actions.navigate(
      metric.view === "supply" ? "dimensions" : metric.view,
      metric.id,
    );
  const problemButton = (problem) => {
    const link = button(
      problem.title,
      () => chooseProblem(problem),
      "table-link",
    );
    link.dataset.problem = problem.id;
    return link;
  };
  const chooseProblem = (problem) => {
    detail.dataset.problem = problem.id;
    detail.replaceChildren(
      el("p", "根因核验", "section-kicker"),
      recordHeading(el("h3", problem.title), recordButton("编辑本任务", () =>
        actions.openRecord("gap", { panel: "tasks", match: { id: problem.id }, field: "title" }))),
      el("p", problem.evidence, "analysis-reading"),
      el("h4", "需核验的因素"),
      el("p", problem.cause),
      el("h4", "建议措施"),
      el("p", problem.action),
      el("h4", "验收口径"),
      el("p", problem.acceptance),
      el(
        "p",
        "建议牵头 " + problem.owner + " · 计划期限 " + problem.deadline,
        "problem-owner",
      ),
      button("查看关联分析", () => gotoMetric(problem.metric), "text-link"),
    );
  };
  problemPanel.append(
    table(
      ["优先级", "改进事项", "现状与目标", "建议牵头", "计划期限"],
      model.problems.map((problem) => [
        problem.priority,
        problemButton(problem),
        problem.evidence,
        problem.owner,
        problem.deadline,
      ]),
    ),
  );
  if (model.problems.length) chooseProblem(model.problems[0]);
  else
    detail.append(
      el("p", "本期核心指标均达到目标，继续复核交付和供应连续性。"),
    );
  sections.actions.append(
    problemPanel,
    detail,
    button("目标测算与成效复算", () => showTab("review"), "primary-button"),
  );
  const forecast = panel("改进目标测算");
  forecast.append(
    el(
      "p",
      "调整一个指标目标，查看相同权重下的预期发展指数。",
      "analysis-reading",
    ),
  );
  const selector = el("select");
  selector.id = "forecast-metric";
  selector.setAttribute("aria-label", "拟改进指标");
  for (const metric of model.metrics)
    selector.append(new Option(metric.name, metric.id));
  selector.value = model.problems[0]?.id ?? model.metrics[0].id;
  const input = el("input");
  input.id = "forecast-value";
  input.type = "number";
  input.min = "0";
  input.max = "100";
  input.step = ".1";
  input.setAttribute("aria-label", "指标目标值");
  const result = el("div", undefined, "forecast-result");
  result.setAttribute("aria-live", "polite");
  const update = () => {
    try {
      const projection = simulateDevelopment(
        data.analysis,
        selector.value,
        input.value,
      );
      result.replaceChildren(
        stat("本期发展指数", number(projection.current) + " 分"),
        stat("达到目标后", number(projection.projected) + " 分"),
        stat(
          "预计变化",
          (projection.change >= 0 ? "+" : "") +
            number(projection.change) +
            " 分",
        ),
      );
    } catch (error) {
      result.replaceChildren(el("p", error.message, "analysis-reading"));
    }
  };
  const selectMetric = () => {
    input.value = model.metrics.find((item) => item.id === selector.value).goal;
    update();
  };
  selector.onchange = selectMetric;
  input.oninput = update;
  const form = el("div", undefined, "forecast-controls");
  const metricLabel = el("label", "拟改进指标");
  metricLabel.append(selector);
  const targetLabel = el("label", "目标值（百分比或标准分）");
  targetLabel.append(input);
  form.append(metricLabel, targetLabel);
  forecast.append(form, result);
  selectMetric();
  const review = panel("同口径成效复算");
  if (model.previous) {
    review.append(
      el(
        "p",
        model.previous.period +
          " 与 " +
          data.period +
          " 使用相同指标和权重，比较已观测到的变化。",
        "analysis-reading",
      ),
      table(
        ["评价方面", model.previous.period, data.period, "变化"],
        [
          [
            "发展总指数",
            number(model.previous.development),
            number(model.current.development),
            number(model.current.development - model.previous.development),
          ],
          ...data.analysis.development.components.map((item) => [
            item.name,
            number(model.previous[item.id]),
            number(model.current[item.id]),
            number(model.current[item.id] - model.previous[item.id]),
          ]),
        ],
      ),
      el(
        "p",
        "月度变化还需结合任务落实记录判断。目标测算用于安排改进，同口径复算用于检查实际指标变化。",
        "analysis-reading",
      ),
    );
  } else
    review.append(
      el(
        "p",
        "本期为首个观测月份，后续发布同口径记录后可进行成效复算。",
        "analysis-reading",
      ),
    );
  sections.review.append(forecast, review);
  root.replaceChildren(tabs, ...Object.values(sections));
  showTab("compare");
}

export function renderAnalysis(data, actions) {
  if (!data.analysis) return;
  renderDevelopment(data, actions);
  renderLogistics(data, actions);
  renderResilience(data, actions);
  renderGap(data, actions);
  renderIndicatorWorkspace(
    byId("supply-indicators-content"),
    data,
    "supply",
    actions,
  );
}
