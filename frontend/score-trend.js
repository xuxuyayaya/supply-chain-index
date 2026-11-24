import { el, number } from "./ui.js";
import {
  scorePoints,
  scoreDomain,
  scoreSegments,
} from "./score-trend-model.js";
const svgNode = (tag, attrs = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, String(value));
  return node;
};
const monthLabel = (period) => period.replace("-", ".");

export function renderScoreTrend(
  history,
  field,
  {
    metricId,
    endPeriod,
    title = "月度得分走势",
    compact = false,
    heading = true,
    domain,
  } = {},
) {
  const points = scorePoints(history, field, { metricId, endPeriod });
  const figure = el(
    "figure",
    undefined,
    "score-trend" + (compact ? " compact" : ""),
  );
  figure.dataset.scoreTrend = metricId ?? field;
  figure.dataset.monthCount = String(points.length);
  figure.setAttribute("aria-label", title);
  if (heading) {
    const header = el("div", undefined, "score-trend-heading");
    header.append(el("span", title));
    if (points.length)
      header.append(
        el(
          "small",
          monthLabel(points[0].period) + "–" + monthLabel(points.at(-1).period),
        ),
      );
    figure.append(header);
  }
  if (!points.some((point) => point.score !== null)) {
    figure.append(el("p", "暂无同口径月度得分", "score-trend-empty"));
    return figure;
  }
  const [min, max] = domain ?? scoreDomain([points]);
  const stage = el("div", undefined, "score-trend-stage");
  const yAxis = el("div", undefined, "score-trend-y-axis");
  yAxis.setAttribute("aria-hidden", "true");
  for (const [value, top] of [
    [max, 0],
    [(max + min) / 2, 50],
    [min, 100],
  ]) {
    const label = el(
      "span",
      Number.isInteger(value) ? String(value) : number(value),
    );
    label.style.top = top + "%";
    if (top === 50) label.className = "middle";
    yAxis.append(label);
  }
  const plot = el("div", undefined, "score-trend-plot");
  const svg = svgNode("svg", {
    viewBox: "0 0 1000 1000",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
  });
  for (const y of [0, 500, 1000])
    svg.append(
      svgNode("line", {
        x1: 0,
        x2: 1000,
        y1: y,
        y2: y,
        class: "score-trend-grid",
        "vector-effect": "non-scaling-stroke",
      }),
    );
  const x = (index) =>
    points.length === 1 ? 500 : (index / (points.length - 1)) * 1000;
  const y = (score) => ((max - score) / (max - min)) * 1000;
  for (const group of scoreSegments(points)) {
    const path = group
      .map(
        (point, i) => (i ? "L" : "M") + x(point.index) + "," + y(point.score),
      )
      .join(" ");
    if (group.length > 1)
      svg.append(
        svgNode("path", {
          d:
            path +
            " L" +
            x(group.at(-1).index) +
            ",1000 L" +
            x(group[0].index) +
            ",1000 Z",
          class: "score-trend-area",
        }),
      );
    svg.append(
      svgNode("path", {
        d: path,
        class: "score-trend-line",
        "vector-effect": "non-scaling-stroke",
      }),
    );
  }
  const guide = el("div", undefined, "score-trend-guide");
  guide.setAttribute("aria-hidden", "true");
  plot.append(svg, guide);
  const caption = el("figcaption", undefined, "score-trend-caption");
  caption.setAttribute("aria-live", "polite");
  const buttons = [];
  let selected = points.length - 1;
  const describe = (point) =>
    point.period.replace("-", "年") +
    "月，" +
    (point.score === null ? "暂无得分" : number(point.score) + "分") +
    (point.change === null
      ? ""
      : "，较上月" +
        (point.change >= 0 ? "提升" : "下降") +
        number(Math.abs(point.change)) +
        "分");
  const activate = (index) => {
    selected = index;
    const point = points[index];
    buttons.forEach((button, i) => {
      button.tabIndex = i === index ? 0 : -1;
      button.classList.toggle("is-active", i === index);
    });
    guide.style.left = x(index) / 10 + "%";
    const value =
      point.score === null ? "暂无得分" : number(point.score) + " 分";
    caption.replaceChildren(
      el("span", monthLabel(point.period)),
      el("strong", value),
    );
    if (!compact && point.change !== null)
      caption.append(
        el(
          "small",
          "环比 " +
            (point.change >= 0 ? "+" : "") +
            number(point.change) +
            " 分",
          point.change >= 0 ? "increase" : "decrease",
        ),
      );
    if (points.length === 1 && !compact)
      caption.append(el("small", "当前仅1个月记录"));
  };
  points.forEach((point, index) => {
    const button = el("button", undefined, "score-trend-month");
    button.type = "button";
    button.setAttribute("aria-label", describe(point));
    button.title = describe(point);
    button.dataset.period = point.period;
    button.style.left = x(index) / 10 + "%";
    button.style.width = "clamp(12px," + 100 / points.length + "%,36px)";
    if (point.score !== null) {
      const marker = el("i", undefined, "score-trend-dot");
      marker.style.top = y(point.score) / 10 + "%";
      button.append(marker);
    }
    button.onmouseenter = () => activate(index);
    button.onfocus = () => activate(index);
    button.onclick = () => activate(index);
    button.onkeydown = (event) => {
      let next = selected;
      if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
      else if (event.key === "ArrowRight")
        next = Math.min(points.length - 1, index + 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = points.length - 1;
      else return;
      event.preventDefault();
      activate(next);
      buttons[next].focus({ preventScroll: true });
    };
    buttons.push(button);
    plot.append(button);
  });
  const xAxis = el("div", undefined, "score-trend-x-axis");
  xAxis.setAttribute("aria-hidden", "true");
  points.forEach((point, index) => {
    if (
      compact &&
      ![0, Math.floor((points.length - 1) / 2), points.length - 1].includes(
        index,
      )
    )
      return;
    const label = el("span", String(Number(point.period.slice(5))) + "月");
    label.style.left = x(index) / 10 + "%";
    if (points.length > 1 && index === 0) label.classList.add("first");
    if (points.length > 1 && index === points.length - 1)
      label.classList.add("last");
    label.dataset.minor = String(
      index !== 0 && index !== points.length - 1 && index % 3 !== 0,
    );
    xAxis.append(label);
  });
  stage.append(yAxis, plot, xAxis);
  figure.append(stage, caption);
  activate(selected);
  return figure;
}
