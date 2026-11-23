const round = (value) => Number(value.toFixed(1));
const cityHubs = {
  kaifeng: ["开封经开区集货仓", "郑州国际陆港", "上海港"],
  suzhou: ["苏州工业园集货仓", "苏州西站", "太仓港"],
  nanchang: ["南昌经开区集货仓", "向塘国际陆港", "九江港"],
};
const industryInputs = {
  auto: {
    origins: [
      ["唐山", 31],
      ["青岛", 24],
      ["常州", 18],
      ["其他地区", 27],
    ],
    goods: [
      "动力电池",
      "电驱系统",
      "车用钢材",
      "线束总成",
      "座椅总成",
      "发动机总成",
      "车身冲压件",
      "内外饰件",
      "排气系统",
      "车桥总成",
      "热管理总成",
      "制动系统",
      "汽车玻璃",
      "轮胎",
      "车规级芯片",
      "连接器",
      "精密轴承",
      "功能膜材",
      "结构胶",
      "粉末冶金件",
    ],
    traceIds: ["electric", "electric", null, "harness", "seat"],
  },
  robot: {
    origins: [
      ["无锡", 38],
      ["常州", 34],
      ["深圳", 28],
    ],
    goods: [
      "伺服驱动",
      "精密减速器",
      "控制器",
      "传感器",
      "编码器",
      "工业电机",
      "精密齿轮",
      "本体铸件",
      "末端执行器",
      "线缆",
      "轴承",
      "视觉模组",
      "工业总线",
      "安全控制器",
      "散热模组",
      "连接器",
      "力矩芯片",
      "谐波柔轮",
    ],
    traceIds: ["drive", "gear", "control", "sensor"],
  },
  storage: {
    origins: [
      ["宜春", 37],
      ["常州", 36],
      ["合肥", 27],
    ],
    goods: [
      "电芯",
      "变流器",
      "温控组件",
      "电池箱体",
      "电池管理系统",
      "能量管理系统",
      "功率半导体",
      "铜排",
      "连接器",
      "消防组件",
      "高压传感器",
      "冷板",
      "绝缘材料",
      "线缆",
      "隔膜",
      "电解液",
    ],
    traceIds: ["battery", "power", "cooling", "housing"],
  },
};
const owners = {
  logistics: "交通物流专班",
  supply: "产业发展专班",
  resilience: "链主保供专班",
};
const labels = {
  logistics: "物流保障",
  supply: "供应配套",
  resilience: "供应韧性",
};
const actionLabels = {
  cost: "降低物流费用占比",
  ontime: "改善到货准时率",
  safety: "提升运输安全水平",
  coverage: "补齐关键生产环节",
  local: "扩大本地配套",
  cr5: "分散核心采购",
  leader: "降低链主依赖",
  bottleneck: "降低瓶颈品类占比",
};
const causes = {
  logistics: "核对干线班期、枢纽换装与到厂窗口的衔接，并复核费用及货损记录。",
  supply:
    "核对本地产能、产品认证和采购份额，区分供给不足与采购选择造成的差距。",
  resilience:
    "结合采购变化、到货异常与备选供方，核实订单调整、运输延误或供应受限的影响。",
};

export function coreMetrics(record) {
  const ev = record.evaluation;
  return [
    {
      id: "cost",
      name: "物流费用占比",
      view: "logistics",
      value: ev.cost,
      score: 100 - ev.cost,
      direction: "negative",
      weight: 0.4,
      viewWeight: 0.3,
      goal: 15,
      action: "核对高费用线路的干线与换装成本，评估集货和多式联运组织。",
    },
    {
      id: "ontime",
      name: "物流准时交付率",
      view: "logistics",
      value: ev.ontime,
      score: ev.ontime,
      direction: "positive",
      weight: 0.3,
      viewWeight: 0.3,
      goal: 90,
      action: "对照计划到货窗口和实际到达记录，优先协调重复延误的线路。",
    },
    {
      id: "safety",
      name: "运输安全标准分",
      view: "logistics",
      value: ev.safety,
      score: ev.safety,
      direction: "positive",
      weight: 0.3,
      viewWeight: 0.3,
      goal: 90,
      action: "核查货损、货差及包装装卸记录，明确承运和场站改进事项。",
    },
    ...record.metrics.map((item) => ({
      ...item,
      view: "supply",
      viewWeight: 0.4,
    })),
    {
      id: "bottleneck",
      name: "瓶颈品类占比",
      view: "resilience",
      value: (ev.bottlenecks / ev.keyGoods) * 100,
      score: ev.resilience,
      direction: "negative",
      weight: 1,
      viewWeight: 0.3,
      goal: 10,
      action: "对关键品类核实第二供应来源及备用线路，持续检查采购与到货异常。",
    },
  ];
}

function comparison(record) {
  return {
    id: record.id,
    city: record.city,
    industry: record.industry,
    period: record.period,
    development: record.evaluation.development,
    logistics: record.evaluation.logistics,
    supply: record.index,
    resilience: record.evaluation.resilience,
    addedValue: record.evaluation.addedValue,
    metrics: coreMetrics(record),
  };
}

export function buildAnalysis(record, peers, history) {
  const ev = record.evaluation;
  const inputs = industryInputs[record.industryId];
  const hubs = cityHubs[record.cityId];
  const metrics = coreMetrics(record);
  const components = [
    {
      id: "logistics",
      name: labels.logistics,
      score: ev.logistics,
      weight: 0.3,
    },
    { id: "supply", name: labels.supply, score: record.index, weight: 0.4 },
    {
      id: "resilience",
      name: labels.resilience,
      score: ev.resilience,
      weight: 0.3,
    },
  ];
  const volume = round(record.trade.purchase * 0.63);
  const previous = history.find((item) => item.period < record.period);
  const quarter = Math.ceil(Number(record.period.slice(5)) / 3);
  const deadline = new Date(
    Date.UTC(Number(record.period.slice(0, 4)), quarter * 3, 0),
  )
    .toISOString()
    .slice(0, 10);
  const problems = metrics
    .map((item) => {
      const gap = Math.max(
        0,
        item.direction === "positive"
          ? item.goal - item.value
          : item.value - item.goal,
      );
      return {
        id: item.id,
        view: item.view,
        title: actionLabels[item.id],
        evidence:
          item.name +
          " " +
          round(item.value) +
          (item.id === "safety" ? " 分" : "%") +
          "，目标 " +
          item.goal +
          (item.id === "safety" ? " 分" : "%"),
        gap,
        impact: gap * item.weight * item.viewWeight,
        action: item.action,
        cause: causes[item.view],
        owner: owners[item.view],
        deadline,
        metric: item,
      };
    })
    .filter((item) => item.gap > 0)
    .sort((a, b) => b.impact - a.impact);
  const risks = inputs.goods.slice(0, ev.bottlenecks).map((label, i) => {
    const purchaseDrop = 18 + i * 3;
    const arrivalRate = Math.max(55, ev.ontime - i * 2);
    const regionShare = 50 + i * 4;
    const alternatives = i % 2;
    return {
      id: "risk-" + i,
      label,
      purchaseDrop,
      arrivalRate,
      regionShare,
      alternatives,
      traceId: inputs.traceIds[i] ?? null,
      supplier: record.trade.suppliers[i % record.trade.suppliers.length].label,
      signals: [
        purchaseDrop >= 20 ? "采购回落" : "采购变化",
        arrivalRate < 85 ? "到货偏慢" : "到货待跟踪",
        regionShare > 60 ? "来源集中" : "来源待核",
      ],
      finding:
        arrivalRate < 85
          ? "采购变化与到货迟延同时出现，需要核对订单调整和供应异常。"
          : "采购出现回落，需要结合到货和库存记录核查影响。",
      alternativeCity: inputs.origins[(i + 1) % inputs.origins.length][0],
      route: [
        inputs.origins[(i + 1) % inputs.origins.length][0],
        hubs[0],
        record.city,
      ],
    };
  });
  const inboundVolume = round(volume * 0.6);
  const outboundVolume = round(volume - inboundVolume);
  const split = (total, shares) => {
    let allocated = 0;
    return shares.map((share, i) => {
      const amount =
        i === shares.length - 1
          ? round(total - allocated)
          : round((total * share) / 100);
      allocated += amount;
      return amount;
    });
  };
  const inboundAmounts = split(
    inboundVolume,
    inputs.origins.map((item) => item[1]),
  );
  const outboundAmounts = split(outboundVolume, [42, 33, 25]);
  const inbound = inputs.origins.map(([city, share], i) => ({
    id: "in-" + i,
    direction: "原料进货",
    goods:
      record.industryId === "auto"
        ? ["车用钢材", "车身冲压件", "动力电池", "其他零部件"][i]
        : record.trade.categories[i % record.trade.categories.length].label,
    path: [city, hubs[1], hubs[0]],
    mode: ["公路", "铁路", "水运", "公路"][i],
    volume: inboundAmounts[i],
  }));
  const outbound = [
    ["上海", 42],
    ["深圳", 33],
    ["重庆", 25],
  ].map(([city, share], i) => ({
    id: "out-" + i,
    direction: "成品发运",
    goods: record.industry + "成品",
    path: [hubs[0], i === 0 ? hubs[2] : hubs[1], city],
    mode: ["水运", "公路", "多式联运"][i],
    volume: outboundAmounts[i],
  }));
  const routes = [...inbound, ...outbound];
  let shareAllocated = 0;
  const modes = ["公路", "铁路", "水运", "多式联运"].map((label, i) => {
    const share =
      i === 3
        ? round(100 - shareAllocated)
        : round(
            (routes
              .filter((row) => row.mode === label)
              .reduce((sum, row) => sum + row.volume, 0) /
              volume) *
              100,
          );
    shareAllocated += share;
    return { label, share };
  });
  const weakest = [...components].sort((a, b) => a.score - b.score)[0];
  const change = previous
    ? ev.development - previous.evaluation.development
    : null;
  return {
    version: "4.0",
    development: {
      score: ev.development,
      components,
      previous: previous
        ? { period: previous.period, score: previous.evaluation.development }
        : null,
      history: history.map(comparison),
    },
    logistics: {
      score: ev.logistics,
      volume,
      modes,
      origins: inputs.origins.map(([city, share]) => ({ city, share })),
      routes,
      inboundVolume,
      outboundVolume,
      metrics: metrics.filter((item) => item.view === "logistics"),
      documentConnectivity: Math.max(50, Math.min(95, ev.ontime - 8)),
      nodes: [
        { name: hubs[0], role: "集货与配送" },
        { name: hubs[1], role: "铁路干线衔接" },
        { name: hubs[2], role: "港口集疏运" },
      ],
    },
    resilience: {
      score: ev.resilience,
      criticalCount: ev.keyGoods,
      bottleneckCount: ev.bottlenecks,
      risks,
      rule: "采购量回落、准时率低于85%或单一来源占比超过60%时形成核验线索，结合备选供方判断影响。",
    },
    gap: {
      current: comparison(record),
      peers: peers
        .map(comparison)
        .sort((a, b) => b.development - a.development),
      problems,
      metrics,
      previous: previous ? comparison(previous) : null,
    },
    assessment: {
      headline:
        (ev.development >= 85
          ? "产业链发展质量较高"
          : ev.development >= 70
            ? "产业链发展基础较好"
            : "产业链发展仍需补强") +
        "，" +
        weakest.name +
        "是当前提升重点",
      summary:
        record.city +
        record.industry +
        "本期发展指数 " +
        round(ev.development) +
        " 分" +
        (change === null
          ? "，本期为首个评价月份。"
          : "，较上月" +
            (change >= 0 ? "提升 " : "下降 ") +
            round(Math.abs(change)) +
            " 分。") +
        "需要结合物流交付、供给结构和关键品类瓶颈安排工作。",
      findings: [
        {
          title: "物流保障 " + round(ev.logistics) + " 分",
          text:
            "准时交付率 " +
            ev.ontime +
            "%，物流费用占比 " +
            ev.cost +
            "%。可从线路、节点与运输方式查找改进机会。",
          route: "logistics",
        },
        {
          title: "供应配套 " + round(record.index) + " 分",
          text:
            "已覆盖 " +
            record.metrics[0].numerator +
            "/" +
            record.metrics[0].denominator +
            " 个环节，本地采购占比 " +
            round(record.metrics[1].value) +
            "%。可沿部件追溯到供方和资料。",
          route: "supply",
        },
        {
          title: "供应韧性 " + round(ev.resilience) + " 分",
          text:
            ev.keyGoods +
            " 个关键品类中有 " +
            ev.bottlenecks +
            " 个存在供应瓶颈，需要核实替代来源与备用线路。",
          route: "resilience",
        },
      ],
      development: {
        title: "将差距转成具体工作",
        text:
          "围绕 " +
          problems
            .slice(0, 2)
            .map((item) => item.title)
            .join("、") +
          "安排责任岗位和计划期限，再以同口径复算检查指标变化。",
      },
      actions: problems
        .slice(0, 3)
        .map((item) => ({
          title: item.title,
          text: item.action,
          route: "gap",
          dimension: item.id,
        })),
    },
  };
}
