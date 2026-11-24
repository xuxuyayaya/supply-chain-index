import { renderScoreTrend } from "./score-trend.js?v=20261124-chart-labels";
import { el, number, priorityBadge, recordButton, recordHeading } from "./ui.js?v=20261124-task-priority";
import { indicatorInputs } from "./record-schema.js?v=20261124-records";

const labels = {
  logistics: "物流分析",
  supply: "供应分析",
  resilience: "韧性分析",
  gap: "差距分析",
};
function button(text, click, className) {
  const node = el("button", text, className);
  node.type = "button";
  node.onclick = click;
  return node;
}
// A chart can show a different measure from the indicator it supports.
const chartLabels = {
  "route-flow": ["各线路月运量", "运量", "万吨"],
  "category-direction": ["各品类月运量", "运量", "万吨"],
  "category-volume": ["分品类运量同比对比", "运量", "万吨"],
  "transport-mix": ["各运输方式月运量", "运量", "万吨"],
  "category-trade": ["各品类采购与销售合计", "购销额", "亿元"],
  "supplier-trade": ["各供应商供货金额", "供货额", "亿元"],
  "gdp-gap": ["本市与对标城市产业链增加值", "增加值", "亿元"],
};
const monthText = (year, month) => year + " 年 " + month + " 月";

function chart(metric, period) {
  const labels = chartLabels[metric.id];
  if (!labels || !metric.bars?.length) return null;
  const [title, measure, unit] = labels;
  const [year, month] = period.split("-").map(Number);
  const compared = metric.bars.some(row => Object.hasOwn(row, "other"));
  const series = [
    { key: "value", tone: "current", label: compared ? "本月" : "本期", date: monthText(year, month) },
    ...(compared ? [{ key: "other", tone: "previous", label: "上年同月", date: monthText(year - 1, month) }] : []),
  ];
  const figure = el("figure", undefined, "indicator-chart");
  const caption = el("figcaption");
  const heading = el("div", undefined, "chart-caption-heading");
  heading.append(el("strong", title), el("span", "右侧数值：" + measure + "（" + unit + "）"));
  const legend = el("div", undefined, "indicator-chart-legend");
  for (const entry of series) {
    const key = el("span", undefined, "indicator-chart-key " + entry.tone);
    key.append(el("i"), el("span", entry.label + " · " + entry.date));
    legend.append(key);
  }
  caption.append(heading, legend);
  figure.append(caption);
  const max = Math.max(1, ...metric.bars.flatMap(row => series.map(entry => row[entry.key] ?? 0)));
  let missing = false;
  for (const row of metric.bars) {
    const item = el("div", undefined, "indicator-chart-row");
    item.append(el("span", row.label));
    const values = el("div", undefined, "indicator-chart-values");
    for (const entry of series) {
      const raw = row[entry.key];
      const known = Number.isFinite(raw);
      const line = el("div", undefined, "indicator-chart-line " + entry.tone);
      const track = el("span");
      track.setAttribute("aria-hidden", "true");
      if (known) {
        const fill = el("i");
        fill.style.width = (raw / max) * 100 + "%";
        track.append(fill);
      } else missing = true;
      const reading = el("strong");
      reading.append(
        el("span", entry.label + measure + " ", "chart-reader-label"),
        document.createTextNode(known ? number(raw) : "—"),
      );
      if (known) reading.append(el("span", " " + unit, "chart-reader-label"));
      reading.title = entry.date + " " + measure + (known ? " " + number(raw) + " " + unit : "暂无记录");
      line.append(track, reading);
      values.append(line);
    }
    item.append(values);
    figure.append(item);
  }
  if (missing) figure.append(el("p", "“—” 表示未收录该期数据。", "chart-note"));
  return figure;
}
function detailTable(metric, period) {
  const wrapper = el("div", undefined, "analysis-table-scroll indicator-data");
  const table = el("table", undefined, "analysis-table");
  table.append(el("caption", metric.name + "明细 · " + period, "statistics-table-caption"));
  const head = el("thead");
  const header = el("tr");
  for (const [index, text] of metric.columns.entries()) {
    const label = metric.id === "index-gap" && index > 0 ? text + "（分）" : text;
    const cell = el("th", label);
    cell.scope = "col";
    header.append(cell);
  }
  head.append(header);
  const body = el("tbody");
  const priorityColumn = metric.id === "improvement-tasks" ? metric.columns.indexOf("优先级") : -1;
  for (const row of metric.rows) {
    const tr = el("tr");
    for (const [index, text] of row.entries()) {
      const cell = el("td");
      if (index === priorityColumn) cell.append(priorityBadge(text));
      else cell.textContent = String(text);
      tr.append(cell);
    }
    body.append(tr);
  }
  if (!metric.rows.length) {
    const row = el("tr");
    const cell = el("td", "本期暂无可用明细");
    cell.colSpan = metric.columns.length;
    row.append(cell);
    body.append(row);
  }
  table.append(head, body);
  wrapper.append(table);
  return wrapper;
}

export function renderIndicatorWorkspace(root, data, view, actions, peerId) {
  const selected = root.dataset.indicator;
  const detailId = view + "-indicator-detail";
  const formulaId = view + "-indicator-formula";
  const metrics = (data.analysis.indicators ?? [])
    .filter((metric) => metric.view === view)
    .map((metric) => ({
      ...metric,
      ...metric.comparisons?.find((row) => row.peerId === peerId),
    }));
  if (!metrics.length) {
    root.replaceChildren();
    return;
  }
  root.className = "indicator-workspace";
  const heading = el("div", undefined, "indicator-workspace-heading");
  const scoring = metrics.filter(metric => metric.scoring);
  const observed = metrics.filter(metric => !metric.scoring);
  const groups = scoring.length
    ? [{ label: "计分指标", metrics: scoring }, { label: "观测指标", metrics: observed }]
    : [{ metrics }];
  heading.append(
    el("h3", labels[view] + "指标"),
    el("span", "共 " + metrics.length + " 项"),
  );
  const layout = el("div", undefined, "indicator-workspace-layout");
  const nav = el("nav", undefined, "indicator-selector");
  nav.setAttribute("aria-label", labels[view] + "指标列表");
  const mobilePicker = el("label", "切换指标", "indicator-mobile-picker");
  const mobile = el("select");
  mobile.setAttribute("aria-controls", detailId);
  mobilePicker.append(mobile);
  const detail = el("article", undefined, "indicator-detail");
  detail.id = detailId;
  detail.setAttribute("aria-labelledby", detailId + "-title");
  const show = (id) => {
    const metric = metrics.find((row) => row.id === id) ?? metrics[0];
    root.dataset.indicator = metric.id;
    mobile.value = metric.id;
    nav
      .querySelectorAll("button")
      .forEach((node) =>
        node.setAttribute(
          "aria-pressed",
          String(node.dataset.indicator === metric.id),
        ),
      );
    const top = el("header", undefined, "indicator-detail-heading");
    const title = el("div");
    const name = el("h4", metric.name);
    name.id = detailId + "-title";
    title.append(name, el("p", metric.definition, "indicator-definition"));

    const formula = el("details", undefined, "indicator-formula");
    formula.id = formulaId;
    formula.append(
      el("summary", "计算口径"),
      el("p", metric.formula),
      el("p", metric.calculation, "indicator-substitution"),
    );
    const value = button("", () => { formula.open = !formula.open; }, "indicator-value");
    value.setAttribute("aria-controls", formulaId);
    value.setAttribute("aria-expanded", "false");
    formula.addEventListener("toggle", () => value.setAttribute("aria-expanded", String(formula.open)));
    const displayValue = ["项", "类", "条", "批", "家"].includes(metric.unit)
      ? String(Math.round(metric.value))
      : number(metric.value);
    value.setAttribute("aria-label", metric.name + " " + displayValue + " " + metric.unit + "，查看计算口径");
    const readingValue = el("span", undefined, "indicator-number");
    readingValue.append(el("strong", displayValue), el("small", metric.unit));
    value.append(readingValue);
    if (metric.secondary) value.append(el("span", metric.secondary, "indicator-secondary"));
    top.append(title, value);
    if (metric.scoring)
      formula.append(
        el(
          "p",
          "标准分 " +
            number(metric.scoring.score) +
            " × 视图内权重 " +
            Math.round(metric.scoring.weight * 100) +
            "% × 视图权重 " +
            Math.round(metric.scoring.viewWeight * 100) +
            "% ＝ 总指数贡献 " +
            number(
              metric.scoring.score *
                metric.scoring.weight *
                metric.scoring.viewWeight,
            ) +
            " 分",
        ),
      );
    const reading = el("p", metric.summary, "indicator-reading");
    const entry = indicatorInputs[metric.id];
    const tools = entry ? recordHeading(formula, recordButton(entry.label, () => actions.openRecord(entry.group, entry))) : formula;
    if (entry) tools.classList.add("indicator-record-tools");
    detail.replaceChildren(top, reading, tools);
    if (metric.scoring)
      detail.append(
        renderScoreTrend(data.analysis.development.history, "", {
          metricId: metric.coreId ?? metric.id,
          title: "标准分月度走势",
          endPeriod: data.period,
        }),
      );
    const plot = chart(metric, data.period);
    if (plot) {
      const evidence = el("details", undefined, "indicator-evidence");
      evidence.append(el("summary", "查看明细数据"), detailTable(metric, data.period));
      detail.append(plot, evidence);
    } else detail.append(detailTable(metric, data.period));
    const links = {
      trace: ["进入供应链追溯", () => actions.openTrace()],
      trade: ["查看采购结构", () => actions.navigate("trade")],
      "gap-actions": ["进入问题与行动", () => actions.navigate("gap-actions")],
    };
    if (links[metric.link]) {
      const [label, click] = links[metric.link];
      detail.append(button(label, click, "text-link indicator-next"));
    } else if (view === "logistics" && metric.scoring) {
      detail.append(button("查看关联改进", () => actions.navigate("gap-actions", metric.id), "text-link indicator-next"));
    }
  };
  for (const group of groups) {
    if (!group.metrics.length) continue;
    const list = el("div", undefined, "indicator-selector-group");
    if (group.label) {
      const caption = el("p", group.label, "indicator-group-label");
      caption.id = detailId + (group.metrics === scoring ? "-scoring" : "-observed");
      list.setAttribute("role", "group");
      list.setAttribute("aria-labelledby", caption.id);
      list.append(caption);
    }
    const options = group.label ? el("optgroup") : mobile;
    if (group.label) {
      options.label = group.label;
      mobile.append(options);
    }
    for (const metric of group.metrics) {
      const tab = button(metric.name, () => show(metric.id), "indicator-selector-item");
      tab.dataset.indicator = metric.id;
      tab.setAttribute("aria-controls", detailId);
      list.append(tab);
      options.append(new Option(metric.name, metric.id));
    }
    nav.append(list);
  }
  mobile.onchange = () => show(mobile.value);
  layout.append(nav, detail);
  root.replaceChildren(heading, mobilePicker, layout);
  show(selected);
}
