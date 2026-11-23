// One category record connects the five resilience perspectives.
export function assembleResilienceCategories(model) {
  return (model.supplyGaps ?? []).map((supply, index) => {
    const suppliers = (model.supplierRisks ?? []).filter(
      (row) => row.goods === supply.label,
    );
    const regions = (model.regionalRisks ?? []).filter(
      (row) => row.goods === supply.label,
    );
    const alerts = (model.alerts ?? []).filter(
      (row) => row.goods === supply.label,
    );
    const observation =
      model.risks?.find((row) => row.label === supply.label) ?? null;
    const bottleneck = supply.gap > 0;
    const supplierAbnormal = suppliers.some(
      (row) => row.late > 0 || row.stoppedDays > 0,
    );
    const regionAbnormal = regions.some((row) => row.alert);
    const attention =
      bottleneck || supplierAbnormal || regionAbnormal || alerts.length > 0;
    return {
      id: "category-" + index,
      label: supply.label,
      supply,
      suppliers,
      regions,
      alerts,
      observation,
      bottleneck,
      attention,
      supplierAbnormal,
      regionAbnormal,
      traceId: supply.traceId ?? observation?.traceId ?? null,
      priority: alerts.some((row) => row.level === "高")
        ? 3
        : alerts.length
          ? 2
          : attention
            ? 1
            : 0,
    };
  });
}

export function selectResilienceCategories(
  categories,
  { scope = "all", query = "", page = 1, pageSize = 10 } = {},
) {
  const keyword = query.trim().toLocaleLowerCase();
  const filtered = categories
    .filter(
      (row) =>
        (scope === "attention"
          ? row.attention
          : scope === "alerts"
            ? row.alerts.length > 0
            : true) &&
        (!keyword ||
          [
            row.label,
            ...row.suppliers.map((s) => s.label),
            ...row.regions.map((r) => r.city),
          ].some((value) => value.toLocaleLowerCase().includes(keyword))),
    )
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        categories.indexOf(a) - categories.indexOf(b),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pages);
  return {
    rows: filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    total: filtered.length,
    pages,
    page: currentPage,
  };
}
