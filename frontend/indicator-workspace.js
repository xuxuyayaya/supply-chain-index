import { renderScoreTrend } from "./score-trend.js";
import { el, number } from "./ui.js";

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
function chart(metric) {
  if (!metric.bars?.length) return null;
  const figure = el("figure", undefined, "indicator-chart");
  figure.append(
    el("figcaption", (metric.barLabels ?? ["本期数值"]).join(" / ")),
  );
  const max = Math.max(
    ...metric.bars.flatMap((row) => [row.value, row.other ?? 0]),
    1,
  );
  for (const row of metric.bars) {
    const item = el("div", undefined, "indicator-chart-row");
    item.append(el("span", row.label));
    const values = el("div", undefined, "indicator-chart-values");
    for (const [value, tone] of [
      [row.value, "current"],
      ...(row.other === undefined ? [] : [[row.other, "previous"]]),
    ]) {
      const line = el("div", undefined, "indicator-chart-line " + tone);
      const track = el("span");
      const fill = el("i");
      fill.style.width = (value / max) * 100 + "%";
      track.append(fill);
      line.append(track, el("strong", number(value)));
      values.append(line);
    }
    item.append(values);
    figure.append(item);
  }
  return figure;
}
function detailTable(metric) {
  const wrapper = el("div", undefined, "analysis-table-scroll indicator-data");
  const table = el("table", undefined, "analysis-table");
  table.setAttribute("aria-label", metric.name + "分析明细");
  const head = el("thead");
  const header = el("tr");
  for (const text of metric.columns) {
    const cell = el("th", text);
    cell.scope = "col";
    header.append(cell);
  }
  head.append(header);
  const body = el("tbody");
  for (const row of metric.rows) {
    const tr = el("tr");
    for (const text of row) tr.append(el("td", String(text)));
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
  const scoringCount = metrics.filter((m) => m.scoring).length;
  heading.append(
    el("h3", labels[view] + "指标全景"),
    el(
      "span",
      metrics.length +
        " 项指标 · " +
        (scoringCount ? scoringCount + " 项参与总指数计分" : "对标与改进"),
    ),
  );
  const layout = el("div", undefined, "indicator-workspace-layout");
  const nav = el("nav", undefined, "indicator-selector");
  nav.setAttribute("aria-label", labels[view] + "完整指标");
  const mobile = el("select");
  mobile.setAttribute("aria-label", labels[view] + "指标选择");
  mobile.className = "indicator-mobile-select";
  const detail = el("article", undefined, "indicator-detail");
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
    const title = el("div", undefined, "indicator-detail-heading");
    title.append(el("h4", metric.name));
    if (metric.scoring)
      title.append(el("span", "参与发展指数", "indicator-scoring"));
    const value = button(
      "",
      () => {
        formula.open = !formula.open;
      },
      "indicator-value",
    );
    value.setAttribute("aria-label", "查看" + metric.name + "计算口径");
    const displayValue = ["项", "类", "条", "批", "家"].includes(metric.unit)
      ? String(Math.round(metric.value))
      : number(metric.value);
    value.append(el("strong", displayValue), el("small", metric.unit));
    if (metric.secondary) value.append(el("span", metric.secondary));
    const formula = el("details", undefined, "indicator-formula");
    formula.append(
      el("summary", "查看计算口径"),
      el("p", metric.formula),
      el("p", metric.calculation, "indicator-substitution"),
    );
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
    detail.replaceChildren(
      title,
      el("p", metric.definition, "indicator-definition"),
      value,
      reading,
      formula,
    );
    if (metric.scoring)
      detail.append(
        renderScoreTrend(data.analysis.development.history, "", {
          metricId: metric.coreId ?? metric.id,
          title: "标准分月度走势",
          endPeriod: data.period,
        }),
      );
    const plot = chart(metric);
    if (plot) detail.append(plot);
    detail.append(detailTable(metric));
    const links = {
      trace: ["进入供应链追溯", () => actions.openTrace()],
      trade: ["查看采购结构", () => actions.navigate("trade")],
      "gap-actions": ["进入问题与行动", () => actions.navigate("gap-actions")],
    };
    if (links[metric.link]) {
      const [label, click] = links[metric.link];
      detail.append(button(label, click, "text-link indicator-next"));
    }
  };
  for (const metric of metrics) {
    const tab = button("", () => show(metric.id), "indicator-selector-item");
    tab.dataset.indicator = metric.id;
    tab.append(
      el("span", metric.name),
      el("small", metric.scoring ? "计分指标" : "分析指标"),
    );
    nav.append(tab);
    mobile.append(new Option(metric.name, metric.id));
  }
  mobile.onchange = () => show(mobile.value);
  layout.append(nav, detail);
  root.replaceChildren(heading, mobile, layout);
  show(selected);
}
