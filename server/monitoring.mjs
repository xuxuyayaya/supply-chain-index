const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const pct = (part, total) => (total ? (part / total) * 100 : 0);
const round = (value, digits = 2) => Number(value.toFixed(digits));
const n = (value) =>
  Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const delta = (value) => (value > 0 ? "+" : "") + n(value);
const groupSum = (rows, key, field) =>
  [...new Set(rows.map((row) => row[key]))].map((label) => ({
    label,
    value: rows
      .filter((row) => row[key] === label)
      .reduce((total, row) => total + row[field], 0),
  }));

export function buildMonitoring(record, model, goods) {
  const { logistics, resilience, gap } = model;
  const ev = record.evaluation;
  const items = [];
  const add = (
    ordinal,
    view,
    id,
    name,
    value,
    unit,
    definition,
    formula,
    calculation,
    summary,
    columns,
    rows,
    extra = {},
  ) => {
    const core = gap.metrics.find(
      (metric) => metric.id === (extra.coreId ?? id),
    );
    const item = {
      ordinal,
      view,
      id,
      name,
      value,
      unit,
      definition,
      formula,
      calculation,
      summary,
      columns,
      rows,
      ...extra,
    };
    if (core)
      item.scoring = {
        score: core.score,
        weight: core.weight,
        viewWeight: core.viewWeight,
      };
    items.push(item);
    return item;
  };
  const routes = logistics.routes.map((row, i) => ({
    ...row,
    origin: row.path[0],
    destination: row.path.at(-1),
    distance: 360 + i * 175,
    tonnes: Math.round(row.volume * 10000),
  }));
  const topFive = [...routes]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5)
    .reduce((total, row) => total + row.volume, 0);
  const routeCr5 = pct(topFive, logistics.volume);
  logistics.routeCr5 = routeCr5;
  add(
    1,
    "logistics",
    "route-flow",
    "线路流量",
    logistics.volume,
    "万吨",
    "按起点—终点识别主力线路，观察货流规模及运力集中程度。",
    "OD对＝起点×终点；线路CR5＝前五条线路运量÷总运量×100%",
    `${n(topFive)} ÷ ${n(logistics.volume)} × 100% ＝ ${n(routeCr5)}%`,
    `${routes.length} 条OD线路，前五条承担 ${n(routeCr5)}% 的货流。`,
    ["起点", "终点", "途经节点", "月运量（万吨）", "占总运量"],
    routes.map((r) => [
      r.origin,
      r.destination,
      r.path.slice(1, -1).join("、"),
      n(r.volume),
      n(pct(r.volume, logistics.volume)) + "%",
    ]),
    {
      secondary: "线路 CR5 " + n(routeCr5) + "%",
      bars: routes.map((r) => ({
        label: r.origin + "—" + r.destination,
        value: r.volume,
      })),
    },
  );
  const cargo = groupSum(routes, "goods", "volume").map((row, i) => ({
    ...row,
    lastYear: round(row.value / (1.04 + i * 0.025)),
    trips: Math.round((row.value * 10000) / 20),
    capacity: 20,
  }));
  const lastYearVolume = sum(cargo, "lastYear");
  const flows = cargo.flatMap((c) =>
    routes
      .filter((r) => r.goods === c.label)
      .map((r) => [
        c.label,
        r.direction,
        r.direction === "原料进货" ? r.origin : r.destination,
        n(r.volume),
        n(pct(r.volume, c.value)) + "%",
      ]),
  );
  add(
    2,
    "logistics",
    "category-direction",
    "品类流向",
    cargo.length,
    "类",
    "分品类追踪原材料从哪里来、产成品到哪里去，按各自品类运量计算来源和目的地占比。",
    "品类占比＝品类运量÷总运量；流向占比＝该品类分来源或目的地运量÷该品类运量",
    `本期 ${cargo.length} 类货物，品类运量合计 ${n(logistics.volume)} 万吨。`,
    "按原料进货与成品发运分别核查货源和销地。",
    ["品类", "方向", "来源／目的地", "运量（万吨）", "占本品类"],
    flows,
    {
      bars: cargo.map((c) => ({ label: c.label, value: c.value })),
      link: "trace",
    },
  );
  add(
    3,
    "logistics",
    "category-volume",
    "品类流量",
    logistics.volume,
    "万吨",
    "按品类观察当期运量规模，并与上年同月比较放量和收缩。",
    "月运量＝Σ车次×实载；同比＝（本月运量−上年同月运量）÷上年同月运量×100%",
    `${n(logistics.volume)} 万吨 ÷ ${n(lastYearVolume)} 万吨 − 1 ＝ ${n((logistics.volume / lastYearVolume - 1) * 100)}%`,
    `${record.period} 对比 ${Number(record.period.slice(0, 4)) - 1}${record.period.slice(4)}；折算车次统一按20吨实载统计。`,
    [
      "品类",
      "本月（万吨）",
      "上年同月（万吨）",
      "同比",
      "折算车次",
      "实载（吨）",
    ],
    cargo.map((c) => [
      c.label,
      n(c.value),
      n(c.lastYear),
      delta((c.value / c.lastYear - 1) * 100) + "%",
      n(c.trips),
      "20",
    ]),
    {
      secondary:
        "同比 " + delta((logistics.volume / lastYearVolume - 1) * 100) + "%",
      bars: cargo.map((c) => ({
        label: c.label,
        value: c.value,
        other: c.lastYear,
      })),
      barLabels: ["本月", "上年同月"],
      raw: {
        current: logistics.volume,
        lastYear: lastYearVolume,
        categories: cargo,
      },
    },
  );
  const nodes = logistics.nodes.map((node, i) => ({
    ...node,
    reachable: !(i === 1 && ev.ontime < 85),
    hours: 12 + i * 6,
  }));
  const reachable = nodes.filter((row) => row.reachable).length;
  add(
    4,
    "logistics",
    "node-access",
    "核心物流节点通达情况",
    pct(reachable, nodes.length),
    "%",
    "核查重点枢纽、口岸和园区能否按约定通道正常到达。",
    "节点通达率＝可达重点节点数÷重点节点总数×100%",
    `${reachable} ÷ ${nodes.length} × 100% ＝ ${n(pct(reachable, nodes.length))}%`,
    `${reachable}/${nodes.length} 个重点节点可达，按节点核查通道卡点与恢复安排。`,
    ["重点节点", "职能", "通达状态", "计划时效", "跟踪事项"],
    nodes.map((row) => [
      row.name,
      row.role,
      row.reachable ? "可达" : "待恢复",
      row.hours + " 小时",
      row.reachable ? "保持班期衔接" : "协调备用线路并复核恢复时间",
    ]),
    { raw: { reachable, total: nodes.length } },
  );
  const modeLabels = ["公路", "铁路", "水运", "航空", "多式联运"];
  const modes = modeLabels.map((label) => ({
    label,
    volume: routes
      .filter((r) => (r.mode.includes("联运") ? "多式联运" : r.mode) === label)
      .reduce((total, r) => total + r.volume, 0),
  }));
  add(
    5,
    "logistics",
    "transport-mix",
    "运输方式结构",
    pct(modes.at(-1).volume, logistics.volume),
    "%",
    "覆盖公路、铁路、水运、航空及多式联运，观察结构与降本空间。",
    "各运输方式占比＝该方式运量÷总运量×100%",
    `多式联运 ${n(modes.at(-1).volume)} ÷ ${n(logistics.volume)} × 100% ＝ ${n(pct(modes.at(-1).volume, logistics.volume))}%`,
    "联运全程按一次运输计入，避免把不同运输段重复加总。",
    ["运输方式", "月运量（万吨）", "占比"],
    modes.map((row) => [
      row.label,
      n(row.volume),
      n(pct(row.volume, logistics.volume)) + "%",
    ]),
    {
      secondary: "多式联运份额",
      bars: modes.map((row) => ({ label: row.label, value: row.volume })),
      raw: { modes, total: logistics.volume },
    },
  );
  const output = round(
    record.metrics.find((m) => m.id === "leader").denominator * 1.08,
  );
  const cost = (output * ev.cost) / 100;
  const turnover = routes.reduce(
    (total, r) => total + r.tonnes * r.distance,
    0,
  );
  add(
    6,
    "logistics",
    "cost",
    "物流费用占比",
    ev.cost,
    "%",
    "物流总费用占同期产业产值的比例，同时核对线路运价。",
    "物流费用占比＝物流总费用÷产值×100%；线路运价＝运费÷周转量（吨公里）",
    `${n(cost)} ÷ ${n(output)} × 100% ＝ ${n(ev.cost)}%；标准分＝100−${n(ev.cost)}＝${n(100 - ev.cost)}`,
    "费用覆盖运输、仓储和物流管理；线路运费按物流费用的35%归集。",
    [
      "线路",
      "运距（公里）",
      "周转量（万吨公里）",
      "运费（万元）",
      "运价（元／吨公里）",
    ],
    routes.map((r) => {
      const t = r.tonnes * r.distance;
      const freight = (cost * 1e8 * 0.35 * t) / turnover;
      return [
        r.origin + "—" + r.destination,
        n(r.distance),
        n(t / 10000),
        n(freight / 10000),
        n(freight / t),
      ];
    }),
    { raw: { numerator: cost, denominator: output } },
  );
  const tickets = 10000,
    onTime = (tickets * ev.ontime) / 100,
    averageHours = round(24 + (100 - ev.ontime) * 0.6);
  add(
    7,
    "logistics",
    "ontime",
    "物流准时交付率",
    ev.ontime,
    "%",
    "按承诺时间送达的票数占比，结合平均运输时效判断履约确定性。",
    "准时率＝准时交付票数÷总票数×100%；平均时效＝Σ运输时长÷票数",
    `${n(onTime)} ÷ ${n(tickets)} × 100% ＝ ${n(ev.ontime)}%；平均时效＝${n(tickets * averageHours)} ÷ ${n(tickets)}＝${n(averageHours)} 小时`,
    `${n(tickets - onTime)} 票未在承诺时间内到达，优先核查重复延误线路。`,
    ["观测项", "本期数值", "统计口径"],
    [
      ["准时交付", n(onTime) + " 票", "实际签收时间不晚于承诺时间"],
      ["延误交付", n(tickets - onTime) + " 票", "超过承诺送达窗口"],
      [
        "运输总时长",
        n(tickets * averageHours) + " 小时",
        "逐票汇总发运至签收时长",
      ],
      ["平均时效", n(averageHours) + " 小时", "运输总时长÷总票数"],
    ],
    { raw: { numerator: onTime, denominator: tickets, averageHours } },
  );
  const lossRate = (100 - ev.safety) / 20,
    lossTickets = round((tickets * lossRate) / 100);
  add(
    8,
    "logistics",
    "logistics-safety",
    "物流安全性",
    lossRate,
    "%",
    "以发生货损或货差的运单占比衡量交付质量，同一运单不重复计数。",
    "货损货差率＝异常运单数÷总运单数×100%；安全标准分＝max(0,100−20×货损货差率百分数)",
    `${n(lossTickets)} ÷ ${n(tickets)} × 100% ＝ ${n(lossRate)}%；100−20×${n(lossRate)}＝${n(ev.safety)} 分`,
    "原始货损货差率越低越好。安全标准分按统一评分曲线换算后进入物流分。",
    ["运单分类", "票数", "占比"],
    [
      ["货损或货差运单", n(lossTickets), n(lossRate) + "%"],
      ["无货损货差运单", n(tickets - lossTickets), n(100 - lossRate) + "%"],
      ["合计", n(tickets), "100%"],
    ],
    {
      coreId: "safety",
      secondary: "货损货差率",
      raw: { numerator: lossTickets, denominator: tickets, lossRate },
    },
  );
  const connected = (tickets * logistics.documentConnectivity) / 100;
  add(
    9,
    "logistics",
    "data-connectivity",
    "物流数据联通性",
    logistics.documentConnectivity,
    "%",
    "上下游应互通单证中已完成关联互通的比例。",
    "单证互通率＝已互通单证数÷应互通单证数×100%",
    `${n(connected)} ÷ ${n(tickets)} × 100% ＝ ${n(logistics.documentConnectivity)}%`,
    `${n(tickets - connected)} 份单证仍待互通，重点补齐订单、运单、签收单的关联。`,
    ["单证状态", "数量（份）", "占比"],
    [
      ["已互通", n(connected), n(logistics.documentConnectivity) + "%"],
      [
        "待互通",
        n(tickets - connected),
        n(100 - logistics.documentConnectivity) + "%",
      ],
      ["应互通合计", n(tickets), "100%"],
    ],
    { raw: { numerator: connected, denominator: tickets } },
  );
  add(
    10,
    "supply",
    "category-trade",
    "品类贸易额",
    record.trade.total,
    "亿元",
    "分品类统计采购与销售的贸易规模，观察市场体量及活跃度。",
    "品类贸易额＝同品类采购额＋销售额；全品类合计＝采购总额＋销售总额",
    `${n(record.trade.purchase)} ＋ ${n(record.trade.sales)} ＝ ${n(record.trade.total)} 亿元`,
    "按购销总额归集品类，与采购来源地金额分别使用各自分母。",
    ["品类", "购销额（亿元）", "占购销总额"],
    record.trade.categories.map((row) => [
      row.label,
      n(row.amount),
      n(pct(row.amount, record.trade.total)) + "%",
    ]),
    {
      bars: record.trade.categories.map((row) => ({
        label: row.label,
        value: row.amount,
      })),
      link: "trade",
      raw: { categories: record.trade.categories, total: record.trade.total },
    },
  );
  const suppliers = [
    ...record.trade.suppliers,
    {
      label: "其他供应商合计",
      amount: record.trade.purchase - record.trade.topFive,
    },
  ];
  add(
    11,
    "supply",
    "supplier-trade",
    "供应商贸易额",
    record.trade.purchase,
    "亿元",
    "按供方向链主供货形成的采购交易金额统计供应商规模。",
    "供应商贸易额＝该供应商供货交易额；供方金额合计＝本期采购总额",
    `${n(record.trade.topFive)} ＋ ${n(record.trade.purchase - record.trade.topFive)} ＝ ${n(record.trade.purchase)} 亿元`,
    "前五家逐一呈现，其他供应商合并列示并与采购总额核对。",
    ["供应商", "供货额（亿元）", "占采购总额"],
    suppliers.map((row) => [
      row.label,
      n(row.amount),
      n(pct(row.amount, record.trade.purchase)) + "%",
    ]),
    {
      bars: suppliers.map((row) => ({ label: row.label, value: row.amount })),
      link: "trade",
      raw: { suppliers, total: record.trade.purchase },
    },
  );
  for (const [ordinal, id, name, rows, columns, link] of [
    [
      12,
      "coverage",
      "环节覆盖率",
      record.stages.map((row) => [
        row.label,
        row.covered ? "已覆盖" : "尚未稳定覆盖",
      ]),
      ["关键环节", "供应状态"],
      "trace",
    ],
    [
      13,
      "local",
      "本地配套率",
      record.trade.origins.map((row) => [
        row.label,
        n(row.amount),
        n(pct(row.amount, record.trade.purchase)) + "%",
      ]),
      ["采购来源", "金额（亿元）", "占采购总额"],
      "trade",
    ],
    [
      14,
      "cr5",
      "供应商集中度",
      suppliers.map((row) => [
        row.label,
        n(row.amount),
        n(pct(row.amount, record.trade.purchase)) + "%",
      ]),
      ["供方", "采购额（亿元）", "占采购总额"],
      "trade",
    ],
    [
      15,
      "leader",
      "龙头依赖度",
      [],
      ["企业范围", "营收（亿元）", "占链上营收"],
      null,
    ],
  ]) {
    const m = record.metrics.find((row) => row.id === id);
    const details =
      id === "leader"
        ? [
            ["链主企业", n(m.numerator), n(m.value) + "%"],
            [
              "其他链上企业",
              n(m.denominator - m.numerator),
              n(100 - m.value) + "%",
            ],
          ]
        : rows;
    add(
      ordinal,
      "supply",
      id,
      name,
      m.value,
      "%",
      m.note,
      m.formula ??
        {
          coverage: "可满足环节数÷关键环节总数",
          local: "链主本地采购÷采购总额",
          cr5: "前五家采购额÷采购总额",
          leader: "链主营收÷链上企业营收总额",
        }[id] + "×100%",
      `${n(m.numerator)} ÷ ${n(m.denominator)} × 100% ＝ ${n(m.value)}%；${m.direction === "negative" ? "100−" + n(m.value) : n(m.value)} ＝ ${n(m.score)} 标准分`,
      m.action,
      columns,
      details,
      { link, raw: { numerator: m.numerator, denominator: m.denominator } },
    );
  }
  const supplyGaps = goods.map((label, i) => {
    const demand = 100 + i * 20;
    const delivered =
      i < resilience.bottleneckCount
        ? Math.floor(demand * (0.92 - i * 0.01))
        : demand;
    return {
      label,
      demand,
      delivered,
      gap: demand - delivered,
      traceId: resilience.risks[i]?.traceId ?? null,
    };
  });
  const supplierRisks = resilience.risks.map((risk, i) => ({
    label: risk.supplier,
    goods: risk.label,
    scheduled: 100 + i * 20,
    late: Math.round(((100 + i * 20) * (100 - risk.arrivalRate)) / 100),
    stoppedDays: i === 0 ? 2 : 0,
    traceId: risk.traceId,
  }));
  const regionalRisks = resilience.risks.map((risk, i) => ({
    goods: risk.label,
    city: logistics.origins[i % logistics.origins.length].city,
    previous: risk.regionShare - (i + 1) * 4,
    current: risk.regionShare,
    increase: (i + 1) * 4,
    alert: risk.regionShare >= 60 && (i + 1) * 4 >= 10,
  }));
  const alerts = resilience.risks
    .map((risk, i) => ({
      id: record.id + "-" + record.period + "-" + i,
      goods: risk.label,
      drop: risk.purchaseDrop,
      region: regionalRisks[i],
      traceId: risk.traceId,
      level: risk.purchaseDrop >= 25 && regionalRisks[i].alert ? "高" : "中",
      status: "待核验",
      owner: "链主保供专班",
      time: record.period + "-28 09:" + String(i * 7).padStart(2, "0"),
    }))
    .filter((row) => row.drop >= 20 || row.region.alert);
  Object.assign(resilience, {
    supplyGaps,
    supplierRisks,
    regionalRisks,
    alerts,
  });
  const shortages = sum(supplyGaps, "gap"),
    demand = sum(supplyGaps, "demand");
  add(
    16,
    "resilience",
    "category-risk",
    "品类断供风险",
    shortages,
    "批",
    "在本统计周期按需求与实际到货识别关键品类的供货缺口。",
    "品类供货缺口＝max(需求批次−到货批次,0)；缺口率＝供货缺口÷需求批次×100%",
    `总需求 ${n(demand)} 批，实际到货 ${n(demand - shortages)} 批，缺口 ${n(shortages)} 批，占 ${n(pct(shortages, demand))}%`,
    `${resilience.bottleneckCount} 类出现缺口，核查订单调整、发运与库存覆盖。`,
    ["关键品类", "需求（批）", "到货（批）", "缺口（批）", "缺口率"],
    supplyGaps.map((row) => [
      row.label,
      n(row.demand),
      n(row.delivered),
      n(row.gap),
      n(pct(row.gap, row.demand)) + "%",
    ]),
    { link: "trace", raw: { shortages, demand, categories: supplyGaps } },
  );
  add(
    17,
    "resilience",
    "supplier-risk",
    "供应商断供风险",
    supplierRisks.length,
    "家",
    "按供应商观察计划到货、延误和停供，区分到货异常与明确停供。",
    "到货异常率＝异常到货批次÷应到货批次×100%；停供天数单独跟踪",
    `${supplierRisks.length} 家存在到货异常，其中 ${supplierRisks.filter((row) => row.stoppedDays > 0).length} 家出现停供记录。`,
    "同周期核查异常批次与停供记录，避免把到货延迟直接等同于断供。",
    ["供应商", "供货品类", "应到货（批）", "延误（批）", "异常率", "停供天数"],
    supplierRisks.map((row) => [
      row.label,
      row.goods,
      n(row.scheduled),
      n(row.late),
      n(pct(row.late, row.scheduled)) + "%",
      row.stoppedDays,
    ]),
    { link: "trace", raw: { suppliers: supplierRisks } },
  );
  const regionAlerts = regionalRisks.filter((row) => row.alert).length;
  add(
    18,
    "resilience",
    "region-risk",
    "区域断供风险",
    regionAlerts,
    "项",
    "在同一品类内比较主要来源地份额，识别来源集中度的突升。",
    "份额变化＝本期来源占比−上期来源占比；本期占比≥60%且上升≥10个百分点时重点核验",
    `${regionAlerts} 项达到来源集中变化阈值，逐品类计算，不能将不同品类份额相加。`,
    "主要来源集中且变化较快时，优先核对区域保供与第二来源。",
    ["品类", "主要来源", "上期占比", "本期占比", "变化", "判读"],
    regionalRisks.map((row) => [
      row.goods,
      row.city,
      n(row.previous) + "%",
      n(row.current) + "%",
      delta(row.increase) + " 个百分点",
      row.alert ? "集中度突升" : "继续跟踪",
    ]),
    { raw: { regions: regionalRisks } },
  );
  add(
    19,
    "resilience",
    "chain-alert",
    "断链预警",
    alerts.length,
    "条",
    "按采购骤降或来源突集规则形成预警，保留触发证据和核验责任。",
    "采购量下降≥20%，或来源占比≥60%且上升≥10个百分点，触发预警；两项同时明显异常优先核查",
    `${alerts.length} 条预警，其中 ${alerts.filter((row) => row.level === "高").length} 条为高关注。`,
    "预警是本期监测线索，核验订单、到货与替代来源后再安排处置。",
    ["时间", "品类", "触发证据", "级别", "核验岗位", "状态"],
    alerts.map((row) => [
      row.time,
      row.goods,
      "采购下降" +
        row.drop +
        "%；来源份额" +
        row.region.current +
        "%（+" +
        row.region.increase +
        "个百分点）",
      row.level,
      row.owner,
      row.status,
    ]),
    { link: "trace", raw: { alerts } },
  );
  add(
    20,
    "resilience",
    "bottleneck",
    "瓶颈品类占比",
    pct(resilience.bottleneckCount, resilience.criticalCount),
    "%",
    "关键品类中存在供应瓶颈的品类比例，衡量瓶颈覆盖面。",
    "瓶颈品类占比＝瓶颈关键品类数÷关键品类总数×100%；韧性分＝100−瓶颈品类占比",
    `${resilience.bottleneckCount} ÷ ${resilience.criticalCount} × 100% ＝ ${n(pct(resilience.bottleneckCount, resilience.criticalCount))}%；韧性分 ${n(ev.resilience)}`,
    "优先验证第二供应来源、认证产能与备用通道。",
    ["关键品类", "本期供给状态"],
    supplyGaps.map((row) => [row.label, row.gap > 0 ? "存在瓶颈" : "供应稳定"]),
    {
      raw: {
        numerator: resilience.bottleneckCount,
        denominator: resilience.criticalCount,
      },
    },
  );
  const comparisons = gap.peers.map((peer) => ({
    peerId: peer.id,
    city: peer.city,
    gdpGap: pct(peer.addedValue - gap.current.addedValue, peer.addedValue),
    indexGap: peer.development - gap.current.development,
    addedValue: peer.addedValue,
    development: peer.development,
  }));
  const defaultPeer = comparisons[0];
  const gdpComparisons = comparisons.map((peer) => ({
    peerId: peer.peerId,
    value: peer.gdpGap,
    calculation: `（${n(peer.addedValue)}−${n(gap.current.addedValue)}）÷${n(peer.addedValue)}×100%＝${n(peer.gdpGap)}%`,
    rows: [
      [record.city, n(gap.current.addedValue)],
      [peer.city, n(peer.addedValue)],
    ],
    bars: [
      { label: record.city, value: gap.current.addedValue },
      { label: peer.city, value: peer.addedValue },
    ],
  }));
  add(
    21,
    "gap",
    "gdp-gap",
    "产业GDP差距",
    defaultPeer?.gdpGap ?? 0,
    "%",
    "使用同城产业链同月份增加值，与同类型产业链城市比较经济贡献。",
    "增加值差距率＝（对标城市链上增加值−本市链上增加值）÷对标城市链上增加值×100%",
    gdpComparisons[0]?.calculation ?? "本期暂无同类城市记录",
    "正值表示低于对标城市，负值表示高于对标城市；增加值与营收分别统计。",
    ["城市", "链上增加值（亿元）"],
    gdpComparisons[0]?.rows ?? [],
    {
      comparisons: gdpComparisons,
      bars: gdpComparisons[0]?.bars,
      raw: { current: gap.current.addedValue, comparisons },
    },
  );
  const indexComparisons = gap.peers.map((peer) => ({
    peerId: peer.id,
    value: peer.development - gap.current.development,
    calculation: `${n(peer.development)}−${n(gap.current.development)}＝${n(peer.development - gap.current.development)} 分`,
    rows: model.development.components
      .map((c) => [
        c.name,
        n(gap.current[c.id]),
        n(peer[c.id]),
        delta(peer[c.id] - gap.current[c.id]),
      ])
      .concat(
        gap.metrics.map((m) => {
          const other = peer.metrics.find((row) => row.id === m.id);
          return [
            m.name + "（标准分）",
            n(m.score),
            n(other.score),
            delta(other.score - m.score),
          ];
        }),
      ),
  }));
  add(
    22,
    "gap",
    "index-gap",
    "发展指数差距",
    defaultPeer?.indexGap ?? 0,
    "分",
    "比较同口径发展总指数，再下钻物流、供应和韧性及八项计分指标。",
    "发展指数差距＝对标城市发展指数−本市发展指数",
    indexComparisons[0]?.calculation ?? "本期暂无同类城市记录",
    "总分定位整体差距，分项定位改进方向。",
    ["方面", "本市得分", "对标得分", "差值"],
    indexComparisons[0]?.rows ?? [],
    { comparisons: indexComparisons },
  );
  const highRisk = alerts.filter((row) => row.level === "高").length;
  gap.problems.forEach((problem) => {
    problem.priority = problem.view === "resilience" && highRisk ? "高" : "中";
    problem.riskCount = problem.view === "resilience" ? alerts.length : 0;
    problem.acceptance =
      problem.metric.name +
      " 达到 " +
      problem.metric.goal +
      (problem.id === "safety" ? "分" : "%") +
      "，按相同口径复算。";
  });
  gap.problems.sort(
    (a, b) =>
      (b.priority === "高") - (a.priority === "高") || b.impact - a.impact,
  );
  model.assessment.actions = gap.problems.slice(0, 3).map((row) => ({
    title: row.title,
    text: row.action,
    route: "gap-actions",
    dimension: row.id,
  }));
  add(
    23,
    "gap",
    "improvement-tasks",
    "改进任务清单",
    gap.problems.length,
    "项",
    "将综合差距、影响与可行性转为改进清单，重大风险优先，后续按同口径复算。",
    "优先顺序＝重大风险优先，再按到目标的标准分差×指标权重×视图权重排序",
    `${highRisk} 条高关注风险关联优先核验事项，共形成 ${gap.problems.length} 项建议任务。`,
    "列明建议措施、牵头岗位、期限与验收口径；建议清单不等于已完成任务。",
    ["优先级", "事项", "建议牵头", "期限", "潜在提分", "验收口径"],
    gap.problems.map((row) => [
      row.priority,
      row.title,
      row.owner,
      row.deadline,
      n(row.impact) + " 分",
      row.acceptance,
    ]),
    { link: "gap-actions", raw: { tasks: gap.problems } },
  );
  return items;
}
