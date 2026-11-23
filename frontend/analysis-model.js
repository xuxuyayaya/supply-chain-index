export function simulateDevelopment(analysis, metricId, rawValue) {
  const metric = analysis.gap.metrics.find((item) => item.id === metricId);
  const value = Number(rawValue);
  if (
    !metric ||
    rawValue === "" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  )
    throw new RangeError("请输入 0 至 100 之间的有效数值");
  const score = metric.direction === "positive" ? value : 100 - value;
  const change = (score - metric.score) * metric.weight * metric.viewWeight;
  return {
    current: analysis.development.score,
    projected: analysis.development.score + change,
    change,
    score,
  };
}
