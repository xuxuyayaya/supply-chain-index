const ordinal = (period) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period ?? "")) return null;
  const [year, month] = period.split("-").map(Number);
  return year * 12 + month - 1;
};
const periodAt = (index) =>
  Math.floor(index / 12) + "-" + String((index % 12) + 1).padStart(2, "0");

export function scorePoints(
  history,
  field,
  { metricId, endPeriod, limit = 12 } = {},
) {
  const records = new Map();
  const cutoff = ordinal(endPeriod) ?? Infinity;
  for (const record of history ?? []) {
    const index = ordinal(record.period);
    if (index === null || index > cutoff || records.has(index)) continue;
    const raw = metricId
      ? record.metrics?.find((row) => row.id === metricId)?.score
      : record[field];
    records.set(
      index,
      typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 100
        ? raw
        : null,
    );
  }
  if (!records.size) return [];
  const end = Math.max(...records.keys()),
    start = Math.max(Math.min(...records.keys()), end - limit + 1);
  const points = [];
  for (let index = start; index <= end; index++) {
    const score = records.get(index) ?? null;
    const previous = records.get(index - 1);
    points.push({
      period: periodAt(index),
      score,
      change:
        score !== null && typeof previous === "number"
          ? score - previous
          : null,
    });
  }
  return points;
}
export function scoreDomain(series) {
  const values = series
    .flat()
    .map((point) => point.score)
    .filter((value) => value !== null && Number.isFinite(value));
  if (!values.length) return [0, 100];
  let min = Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10);
  let max = Math.min(100, Math.ceil((Math.max(...values) + 5) / 10) * 10);
  if (max - min < 20) {
    min = Math.max(0, min - 10);
    max = Math.min(100, min + 20);
    min = Math.max(0, max - 20);
  }
  return [min, max];
}
export function scoreSegments(points) {
  const groups = [];
  let segment = [];
  for (let index = 0; index < points.length; index++) {
    if (points[index].score === null) {
      if (segment.length) groups.push(segment);
      segment = [];
    } else segment.push({ ...points[index], index });
  }
  if (segment.length) groups.push(segment);
  return groups;
}
export function developmentDomain(data) {
  return scoreDomain(
    ["development", "logistics", "supply", "resilience"].map((field) =>
      scorePoints(data.analysis.development.history, field, {
        endPeriod: data.period,
      }),
    ),
  );
}
