import { renderScoreTrend } from "./score-trend.js";
import { developmentDomain } from "./score-trend-model.js";
import { el, number, recordButton, recordHeading } from "./ui.js?v=20261124-records";
import { indicatorInputs } from "./record-schema.js?v=20261124-records";
import {
  assembleResilienceCategories,
  selectResilienceCategories,
} from "./resilience-model.js";

const button = (label, click, className = "") => {
  const node = el("button", label, className);
  node.type = "button";
  node.onclick = click;
  return node;
};
const amount = (value) =>
  value === null || value === undefined
    ? "—"
    : Number.isInteger(value)
      ? String(value)
      : number(value);
const percent = (part, total) =>
  total ? number((part / total) * 100) + "%" : "—";
const addCell = (row, value) => {
  const cell = el("td");
  cell.append(
    value instanceof Node ? value : document.createTextNode(String(value)),
  );
  row.append(cell);
};
function categoryStatus(category) {
  if (category.alerts.some((row) => row.level === "高")) return "高关注预警";
  if (category.alerts.length) return "预警待核验";
  if (category.bottleneck) return "存在供货缺口";
  if (category.attention) return "存在异常线索";
  return "未见供货缺口";
}
function supplierTotals(category) {
  if (!category.suppliers.length) return null;
  return {
    scheduled: category.suppliers.reduce((sum, s) => sum + s.scheduled, 0),
    late: category.suppliers.reduce((sum, s) => sum + s.late, 0),
    stopped: Math.max(...category.suppliers.map((s) => s.stoppedDays)),
  };
}
function primaryRegion(category) {
  return [...category.regions].sort((a, b) => b.current - a.current)[0];
}
function rowValues(category, lens) {
  const s = category.supply;
  const supplier = supplierTotals(category);
  const region = primaryRegion(category);
  const latest = category.alerts.at(-1);
  if (lens === "supplier-risk")
    return [
      category.suppliers.map((s) => s.label).join("、") || "—",
      amount(supplier?.scheduled),
      amount(supplier?.late),
      supplier ? amount(supplier.stopped) + " 天" : "—",
      supplier
        ? category.supplierAbnormal
          ? "到货异常"
          : "未见到货异常"
        : "未收录异常记录",
    ];
  if (lens === "region-risk")
    return [
      region?.city ?? "—",
      region ? number(region.previous) + "%" : "—",
      region ? number(region.current) + "%" : "—",
      region ? (region.increase > 0 ? "+" : "") + number(region.increase) + " 个百分点" : "—",
      region
        ? category.regionAbnormal
          ? "集中度突升"
          : "继续跟踪"
        : "未收录集中突升记录",
    ];
  if (lens === "chain-alert")
    return [
      latest ? latest.level + "关注" : "无预警记录",
      latest
        ? "采购变化 " + number(-latest.drop) + "%" +
          (latest.region ? "；来源份额 " + number(latest.region.current) + "%" : "")
        : "—",
      latest?.time ?? "—",
      latest?.status ?? "本期未触发预警",
    ];
  if (lens === "bottleneck")
    return [
      s.gap > 0 ? "存在瓶颈" : "未见供货缺口",
      amount(s.gap) + " 批",
      category.alerts.length ? category.alerts.length + " 条" : "无预警记录",
      s.gap > 0 ? "核验替代供方与备用线路" : "持续跟踪供货完成情况",
    ];
  return [
    categoryStatus(category),
    amount(s.demand),
    amount(s.delivered),
    amount(s.gap),
    percent(s.gap, s.demand),
  ];
}
const columnLabels = {
  "category-risk": [
    "品类状态",
    "需求（批）",
    "到货（批）",
    "缺口（批）",
    "缺口率",
  ],
  "supplier-risk": ["供应商", "应到货（批）", "延误（批）", "停供时长", "判读"],
  "region-risk": ["主要来源", "上期份额", "本期份额", "份额变化", "判读"],
  "chain-alert": ["预警等级", "触发证据", "触发时间", "核验状态"],
  bottleneck: ["供给状态", "供货缺口", "关联预警", "跟踪重点"],
};
function categoryDetail(category, actions, lens) {
  const detail = el("div", undefined, "resilience-category-detail");
  const heading = el("div", undefined, "resilience-detail-heading");
  heading.append(
    el("h4", category.label + " · 风险核验"),
    el("span", categoryStatus(category), "resilience-state"),
  );
  const entry = indicatorInputs[lens];
  const editCategory = recordButton("编辑本品类", () => actions.openRecord("resilience", {
    panel: entry.panel, field: entry.field, match: { label: category.label },
  }), "编辑" + category.label + "风险数据");
  const intro = el(
    "p",
    category.observation?.finding ??
      "本期供货需求已满足，继续跟踪交付与来源变化。",
    "analysis-reading",
  );
  const evidence = el("div", undefined, "resilience-evidence");
  const supply = el("section");
  supply.append(
    el("h5", "供货情况"),
    el(
      "p",
      "需求 " +
        amount(category.supply.demand) +
        " 批，到货 " +
        amount(category.supply.delivered) +
        " 批，缺口 " +
        amount(category.supply.gap) +
        " 批（" +
        percent(category.supply.gap, category.supply.demand) +
        "）。",
    ),
  );
  const suppliers = el("section");
  suppliers.append(el("h5", "供应商与到货"));
  if (category.suppliers.length)
    for (const supplier of category.suppliers)
      suppliers.append(
        el(
          "p",
          supplier.label +
            "：应到 " +
            amount(supplier.scheduled) +
            " 批，延误 " +
            amount(supplier.late) +
            " 批，停供 " +
            supplier.stoppedDays +
            " 天。",
        ),
      );
  else suppliers.append(el("p", "本期未收录供应商异常明细。"));
  const regions = el("section");
  regions.append(el("h5", "来源地区"));
  if (category.regions.length)
    for (const region of category.regions)
      regions.append(
        el(
          "p",
          region.city +
            "：份额由 " +
            number(region.previous) +
            "% 变为 " +
            number(region.current) +
            "%，增加 " +
            number(region.increase) +
            " 个百分点。",
        ),
      );
  else regions.append(el("p", "本期未收录来源集中突升明细。"));
  const alerts = el("section");
  alerts.append(el("h5", "关联预警"));
  if (category.alerts.length) {
    for (const alert of category.alerts)
      alerts.append(
        el(
          "p",
          alert.level +
            "关注 · " +
            alert.time +
            " · " +
            alert.status +
            "；采购量变化 " +
            number(-alert.drop) +
            "%，由" +
            alert.owner +
            "核验。",
        ),
      );
    alerts.append(recordButton("更新核验状态", () => actions.openRecord("resilience", {
      panel: "review", field: "status", match: { label: category.label },
    })));
  } else alerts.append(el("p", "本期未触发断链预警。"));
  evidence.append(supply, suppliers, regions, alerts);
  detail.append(recordHeading(heading, editCategory), intro, evidence);
  if (category.observation) {
    const observation = category.observation;
    detail.append(
      el(
        "p",
        "备选来源 " +
          (observation.alternativeCity || "待核实") +
          " · 已纳入备选 " +
          observation.alternatives +
          " 家；核对认证、产能与交期。",
        "resilience-follow-up",
      ),
      el(
        "p",
        "备用路径：" + (observation.route.join(" → ") || "待核实"),
        "resilience-follow-up",
      ),
    );
  }
  const links = el("div", undefined, "analysis-actions");
  if (category.traceId)
    links.append(
      button(
        "查看该品类供应链追溯",
        () => actions.openTrace(category.traceId),
        "primary-button",
      ),
    );
  else
    links.append(
      button("查看产业链供应资源", () => actions.navigate("trace"), "quiet"),
    );
  if (category.attention)
    links.append(
      button(
        "查看相关改进事项",
        () => actions.navigate("gap-actions", "bottleneck"),
        "text-link",
      ),
    );
  detail.append(links);
  return detail;
}

export function renderResilience(data, actions) {
  const model = data.analysis.resilience;
  const categories = model.categories ?? assembleResilienceCategories(model);
  const metrics = data.analysis.indicators.filter(
    (metric) => metric.view === "resilience",
  );
  const counts = {
    all: categories.length,
    attention: categories.filter((row) => row.attention).length,
    alerts: categories.filter((row) => row.alerts.length).length,
  };
  const previousView = actions.resume?.resilience;
  const requested = previousView?.indicator ?? actions.query.get("metric");
  const state = {
    lens: metrics.some(metric => metric.id === requested) ? requested : metrics[0].id,
    scope: previousView?.scope || "all",
    query: previousView?.query || "",
    page: Number(previousView?.page) || 1,
    selected: previousView?.selected || null,
  };
  const summary = el("article", undefined, "analysis-panel resilience-summary");
  const score = el("div", undefined, "resilience-score");
  score.append(el("p", "供应韧性分", "section-kicker"));
  const value = button(
    "",
    () => actions.showMethod("resilience"),
    "development-score",
  );
  value.setAttribute(
    "aria-label",
    "供应韧性分 " + number(model.score) + "，查看计算过程",
  );
  value.append(el("strong", number(model.score)), el("small", "/ 100"));
  score.append(
    value,
    el(
      "p",
      "瓶颈品类占比 " +
        number((model.bottleneckCount / model.criticalCount) * 100) +
        "%",
      "resilience-score-note",
    ),
  );
  const judgment = el("div", undefined, "resilience-judgment");
  judgment.append(
    el(
      "h3",
      model.bottleneckCount
        ? "重点核验 " + model.bottleneckCount + " 类供货瓶颈与关联风险"
        : "持续跟踪关键品类供货与来源变化",
    ),
    el(
      "p",
      "全部 " +
        model.criticalCount +
        " 类关键品类已纳入清单，其中 " +
        model.bottleneckCount +
        " 类存在供货缺口，" +
        model.alerts.length +
        " 条预警待核验。",
    ),
    el(
      "p",
      "在同一份清单中切换五项指标，按品类集中查看供货、供应商、来源地区与预警。",
      "muted",
    ),
  );
  const currentCopy = el("div", undefined, "resilience-current-copy");
  judgment.querySelector(".muted")?.remove();
  currentCopy.append(score, judgment);
  summary.append(
    currentCopy,
    renderScoreTrend(data.analysis.development.history, "resilience", {
      title: "供应韧性月度走势",
      endPeriod: data.period,
      domain: developmentDomain(data),
    }),
  );
  const console = el("section", undefined, "analysis-panel resilience-console");
  const heading = el("div", undefined, "resilience-console-heading");
  const addCategory = recordButton("录入需求与到货", () => {
    const entry = indicatorInputs[state.lens];
    actions.openRecord("resilience", entry);
  });
  heading.append(
    el("h3", "关键品类统一清单"),
    addCategory,
  );
  const tabs = el("nav", undefined, "resilience-metric-tabs");
  tabs.setAttribute("aria-label", "韧性分析五项指标");
  const metricNote = el("p", undefined, "resilience-metric-note");
  const formula = el(
    "details",
    undefined,
    "indicator-formula resilience-formula",
  );
  const tools = el("div", undefined, "resilience-tools");
  const scopes = el("div", undefined, "resilience-scopes");
  scopes.setAttribute("aria-label", "品类查看范围");
  const label = el("label", "查找品类、供方或地区");
  const search = el("input");
  search.id = "resilience-search";
  search.type = "search";
  search.placeholder = "输入名称";
  search.value = state.query;
  label.append(search);
  tools.append(scopes, label);
  const caption = el("p", undefined, "resilience-result-count");
  caption.id = "resilience-result-count";
  caption.setAttribute("aria-live", "polite");
  const tableWrap = el(
    "div",
    undefined,
    "analysis-table-scroll resilience-table-wrap",
  );
  const grid = el(
    "table",
    undefined,
    "analysis-table resilience-category-table",
  );
  grid.setAttribute("aria-label", "关键品类韧性风险清单");
  grid.setAttribute("aria-describedby", caption.id);
  const head = el("thead"),
    body = el("tbody");
  grid.append(head, body);
  tableWrap.append(grid);
  const footer = el("div", undefined, "resilience-table-footer");
  const pageLabel = el("span");
  const previous = button(
    "上一页",
    () => {
      state.page--;
      state.selected = null;
      renderRows();
    },
    "view-button",
  );
  const next = button(
    "下一页",
    () => {
      state.page++;
      state.selected = null;
      renderRows();
    },
    "view-button",
  );
  const pagination = el("div", undefined, "resilience-pagination");
  pagination.append(previous, pageLabel, next);
  footer.append(
    el("span", "筛选不改变本期指标值；“—”表示未收录该项明细。"),
    pagination,
  );
  const renderRows = () => {
    const result = selectResilienceCategories(categories, state);
    state.page = result.page;
    console.dataset.page = state.page;
    console.dataset.scope = state.scope;
    console.dataset.selected = state.selected ?? "";
    const columns = ["关键品类", ...columnLabels[state.lens]];
    const header = el("tr");
    for (const text of columns) {
      const th = el("th", text);
      th.scope = "col";
      header.append(th);
    }
    head.replaceChildren(header);
    const rows = [];
    for (const category of result.rows) {
      const row = el("tr");
      row.dataset.category = category.id;
      row.className = category.attention ? "requires-attention" : "";
      const categoryButton = button(
        category.label,
        () => {
          state.selected = state.selected === category.id ? null : category.id;
          renderRows();
          body
            .querySelector('[data-category-button="' + category.id + '"]')
            .focus({ preventScroll: true });
        },
        "table-link resilience-category-button",
      );
      categoryButton.dataset.categoryButton = category.id;
      categoryButton.setAttribute(
        "aria-expanded",
        String(state.selected === category.id),
      );
      categoryButton.setAttribute(
        "aria-controls",
        "resilience-detail-" + category.id,
      );
      addCell(row, categoryButton);
      for (const value of rowValues(category, state.lens)) addCell(row, value);
      rows.push(row);
      if (state.selected === category.id) {
        const detailRow = el("tr", undefined, "resilience-expanded-row");
        const cell = el("td");
        cell.colSpan = columns.length;
        cell.id = "resilience-detail-" + category.id;
        cell.append(categoryDetail(category, actions, state.lens));
        detailRow.append(cell);
        rows.push(detailRow);
      }
    }
    if (!rows.length) {
      const row = el("tr");
      const cell = el("td");
      cell.colSpan = columns.length;
      cell.append(
        el("p", "当前条件下没有匹配品类。"),
        button(
          "显示全部品类",
          () => {
            state.scope = "all";
            state.query = "";
            state.page = 1;
            search.value = "";
            renderRows();
          },
          "text-link",
        ),
      );
      row.append(cell);
      rows.push(row);
    }
    body.replaceChildren(...rows);
    scopes
      .querySelectorAll("button")
      .forEach((node) =>
        node.setAttribute(
          "aria-pressed",
          String(node.dataset.scope === state.scope),
        ),
      );
    const start = result.total ? (result.page - 1) * 10 + 1 : 0,
      end = Math.min(result.page * 10, result.total);
    caption.textContent =
      "全部 " +
      counts.all +
      " 类 · 当前范围 " +
      result.total +
      " 类 · 显示 " +
      start +
      "–" +
      end +
      " 类";
    pageLabel.textContent = "第 " + result.page + " / " + result.pages + " 页";
    previous.disabled = result.page === 1;
    next.disabled = result.page === result.pages;
  };
  const renderMetric = () => {
    const metric = metrics.find((row) => row.id === state.lens);
    console.dataset.indicator = metric.id;
    addCategory.textContent = indicatorInputs[metric.id].label;
    addCategory.setAttribute("aria-label", addCategory.textContent);
    tabs
      .querySelectorAll("button")
      .forEach((node) =>
        node.setAttribute(
          "aria-pressed",
          String(node.dataset.indicator === metric.id),
        ),
      );
    metricNote.textContent = metric.summary;
    formula.replaceChildren(
      el("summary", metric.name + " · 计算口径"),
      el("p", metric.definition),
      el("p", metric.formula),
      el("p", metric.calculation, "indicator-substitution"),
    );
    if (metric.scoring)
      formula.append(
        el(
          "p",
          "韧性标准分 " +
            number(metric.scoring.score) +
            "，占发展总指数权重 " +
            Math.round(metric.scoring.viewWeight * 100) +
            "%。",
        ),
      );
    renderRows();
  };
  for (const metric of metrics) {
    const tab = button(
      "",
      () => {
        state.lens = metric.id;
        actions.setQuery("metric", metric.id);
        renderMetric();
      },
      "indicator-selector-item resilience-metric-tab",
    );
    tab.dataset.indicator = metric.id;
    tab.append(
      el("span", metric.name),
      el(
        "strong",
        amount(metric.value) + (metric.unit === "%" ? "%" : " " + metric.unit),
      ),
    );
    tabs.append(tab);
  }
  for (const [scope, label] of [
    ["all", "全部品类"],
    ["attention", "需关注"],
    ["alerts", "预警品类"],
  ]) {
    const filter = button(
      label + " " + counts[scope],
      () => {
        state.scope = scope;
        state.page = 1;
        state.selected = null;
        renderRows();
      },
      "view-button",
    );
    filter.dataset.scope = scope;
    scopes.append(filter);
  }
  search.oninput = () => {
    state.query = search.value;
    state.page = 1;
    state.selected = null;
    renderRows();
  };
  console.append(
    heading,
    tabs,
    metricNote,
    formula,
    tools,
    caption,
    tableWrap,
    footer,
  );
  document
    .getElementById("resilience-content")
    .replaceChildren(summary, console);
  renderMetric();
}
