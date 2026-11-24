export const scenePages = {
  intro: { path: "chain/", title: "产业链供应分析指数" },
  overview: { path: "chain/overview/", title: "产业链发展总览", tab: "发展总览", purpose: "看全局", description: "看总指数和月度走势，判断产业链的发展质量与当前短板。" },
  logistics: { path: "chain/logistics/", title: "产业链物流分析", purpose: "摸流向", description: "看原料从哪里进、成品往哪里运，找出主要线路和交付瓶颈。" },
  supply: { path: "chain/supply/", title: "产业链供应分析", subtab: "配套能力", purpose: "数供应", description: "看本地能配套多少、哪些环节仍有缺口，以及供应配套能力如何变化。" },
  dimensions: { path: "chain/supply/dimensions/", title: "供应指标拆解", section: "supply", subtab: "指标拆解", purpose: "看分项", description: "逐项核对原始比例、标准分、目标与供应分贡献。" },
  "supply-indicators": { path: "chain/supply/indicators/", title: "供应分析指标", section: "supply", subtab: "全部指标 · 6项", purpose: "查指标", description: "查看供应分析的全部六项指标，以及本期数值、计算口径和原始明细。" },
  trade: { path: "chain/supply/procurement/", title: "产业链采购结构", section: "supply", subtab: "采购结构", purpose: "看采购", description: "比较采购来源、各品类购销规模和主要供应商占比。" },
  trace: { path: "chain/trace/", title: "供应链追溯", section: "supply", subtab: "供应链追溯", purpose: "找上游", description: "从关键部件查供货企业、所在城市和上下游关系。" },
  resilience: { path: "chain/resilience/", title: "产业链韧性分析", purpose: "判韧性", description: "看哪些品类可能断供、风险出在哪里，以及有哪些备选供方和线路。" },
  gap: { path: "chain/benchmark/", title: "产业链差距分析", subtab: "同类城市对标", purpose: "量差距", description: "与同省产业相近城市比较增加值、总指数和分项能力。" },
  "gap-actions": { path: "chain/benchmark/actions/", title: "产业链问题与行动", section: "gap", subtab: "问题与行动", purpose: "定行动", description: "查看薄弱指标、核验因素、牵头岗位和改进措施。" },
  "gap-review": { path: "chain/benchmark/review/", title: "产业链成效复算", section: "gap", subtab: "成效复算", purpose: "验成效", description: "用相同口径比较前后变化，并测算改进目标对指数的影响。" },
};
export const mainRoutes = ["overview", "logistics", "supply", "resilience", "gap"];
export const supplyRoutes = ["supply", "dimensions", "supply-indicators", "trade", "trace"];
export const gapRoutes = ["gap", "gap-actions", "gap-review"];
export const supplyMetrics = ["coverage", "local", "cr5", "leader"];

export function sceneUrl(root, route, context = {}, detail = {}) {
  const page = scenePages[route === "system" ? "overview" : route];
  const url = new URL(page.path, root);
  for (const key of ["city", "case", "period"]) {
    if (context[key]) url.searchParams.set(key, context[key]);
  }
  for (const key of ["metric", "part", "peer", "problem"]) {
    if (detail[key]) url.searchParams.set(key, detail[key]);
  }
  if (route === "system") url.hash = "system";
  return url;
}

export function legacySceneUrl(root, current) {
  const hash = current.hash.slice(1);
  const context = Object.fromEntries(current.searchParams);
  const detail = Object.fromEntries(["metric", "part", "peer", "problem"].map(key => [key, context[key]]));
  let route = context.case ? "overview" : "intro";
  if (Object.hasOwn(scenePages, hash) || hash === "system") route = hash;
  if (supplyMetrics.includes(hash)) {
    route = "dimensions";
    detail.metric = hash;
  }
  if (hash === "intro" || hash === "evaluation-selection") route = "intro";
  const url = sceneUrl(root, route, context, detail);
  if (hash === "evaluation-selection") url.hash = hash;
  return url;
}
