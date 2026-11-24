const round = (value) => Number(value.toFixed(8));

export function inputGroup(index, group, trace) {
  const { analysis, trade, metrics } = index;
  const raw = id => analysis.indicators.find(item => item.id === id).raw;
  const parts = index.traceParts.map(item => item.id);
  if (group === "routes") {
    return {
      routes: analysis.logistics.routes.map((row, i) => ({
        direction: row.direction, goods: row.goods, mode: row.mode,
        origin: row.path[0], via: row.path.slice(1, -1).join(" / "), destination: row.path.at(-1),
        volume: row.volume, distance: row.distance ?? 360 + i * 175,
        freight: row.freight ?? Number(analysis.indicators.find(item => item.id === "cost").rows[i][3].replaceAll(",", "")),
      })).filter(row => row.volume > 0),
      lastYear: raw("category-volume").categories.map(row => ({ goods: row.label, volume: row.lastYear })),
    };
  }
  if (group === "logistics") {
    const cost = raw("cost"), ontime = raw("ontime"), loss = raw("logistics-safety"), documents = raw("data-connectivity");
    return {
      output: cost.denominator, cost: round(cost.numerator),
      tickets: ontime.denominator, onTime: Math.round(ontime.numerator),
      loss: Math.round(loss.numerator), hours: round(ontime.averageHours * ontime.denominator),
      documents: documents.denominator, connected: Math.round(documents.numerator),
      nodes: raw("node-access").nodes,
    };
  }
  if (group === "supply") {
    const leader = metrics.find(item => item.id === "leader");
    const categories = trade.categories.map(({ label, amount, traceId }) => ({
      label, amount: Number(amount.toFixed(4)), traceId: parts.includes(traceId) ? traceId : "",
    }));
    categories[0].amount = round(trade.total - categories.slice(1).reduce((sum, row) => sum + row.amount, 0));
    return {
      local: trade.origins[0].amount, domestic: round(trade.origins[1].amount), imports: trade.origins[2].amount,
      sales: trade.sales, leader: leader.numerator, revenue: leader.denominator,
      categories, suppliers: trade.suppliers.map(({ label, amount }) => ({ label, amount })), stages: index.stages,
    };
  }
  if (group === "resilience") {
    return { categories: analysis.resilience.categories.map(({ supply, suppliers, regions, alerts, observation, traceId }) => ({
      label: supply.label, demand: supply.demand, delivered: supply.delivered,
      supplier: suppliers[0]?.label ?? "", scheduled: suppliers[0]?.scheduled ?? 0,
      late: suppliers[0]?.late ?? 0, stoppedDays: suppliers[0]?.stoppedDays ?? 0,
      region: regions[0]?.city ?? "", previousShare: regions[0]?.previous ?? 0, currentShare: regions[0]?.current ?? 0,
      previousPurchase: observation ? 100 : 0, currentPurchase: observation ? 100 - observation.purchaseDrop : 0,
      alternatives: observation?.alternatives ?? 0, alternativeCity: observation?.alternativeCity ?? "",
      route: observation?.route.join(" / ") ?? "", traceId: parts.includes(traceId) ? traceId : "",
      owner: alerts[0]?.owner ?? "", status: alerts[0]?.status ?? "待核验",
    })) };
  }
  if (group === "gap") return { addedValue: index.evaluation.addedValue, tasks: [] };
  return {
    note: trace.source.note,
    nodes: trace.nodes.map(({ id, label, tier, place, city, product, position, supplement }) => ({
      id, label, tier, place: place ?? "", city: city ?? "", product: product ?? "",
      sourceLabel: supplement?.label ?? "", sourceUrl: supplement?.url ?? "",
      lng: position?.[0] ?? null, lat: position?.[1] ?? null,
    })),
    edges: trace.edges.map(({ from, to, status, share, year, basis }) => ({
      from, to, status: status === "association" ? "关联" : "供货",
      share: share ?? null, year: year ?? null, basis: basis ?? "",
    })),
  };
}

export function previewValues(index, group) {
  const score = (label, value, unit = "分") => ({ label, value, unit });
  const cards = [
    score("发展总指数", index.evaluation.development), score("物流分", index.evaluation.logistics),
    score("供应分", index.index), score("韧性分", index.evaluation.resilience),
  ];
  const { logistics, gap } = index.analysis;
  if (group === "routes") cards.push(
    score("总运量", logistics.volume, "万吨"),
    score("原料进货", logistics.inboundVolume, "万吨"),
    score("原料进货占比", logistics.inboundVolume / logistics.volume * 100, "%"),
  );
  const views = { routes: "logistics", logistics: "logistics", supply: "supply", resilience: "resilience", gap: "gap" };
  if (group === "trace") cards.push(score("追溯节点", index.trace.nodes.length, "个"), score("供货关系", index.trace.edges.length, "条"));
  if (group === "gap") cards.push(score("产业增加值", gap.current.addedValue, "亿元"));
  return {
    cards, indicators: index.analysis.indicators.filter(item => item.view === views[group])
      .map(({ name, value, unit, calculation }) => ({ label: name, value, unit, calculation })),
  };
}
