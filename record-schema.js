const field = (key, label, type = "text", extra = {}) => ({ key, label, type, ...extra });
const amount = (key, label, extra) => field(key, label, "number", extra);
const count = (key, label, extra) => field(key, label, "integer", extra);
const choice = (key, label, options) => field(key, label, "select", { options });
const list = (key, label, fields) => ({ key, label, fields, list: true });
const optional = { optional: true };
const percent = { max: 100 };
const positive = { positive: true };
const direction = ["原料进货", "成品发运"];

export const recordGroups = {
  routes: {
    view: "logistics", title: "货流与线路",
    note: "每行是一条分品类的运输线路。运量更新后会重新汇总进货与发运、品类流向、运输方式和线路集中度。",
    sections: [
      list("routes", "本月线路", [
        choice("direction", "运输方向", direction),
        field("goods", "货物品类"),
        field("origin", "起点"), field("via", "途经节点（用 / 分隔）", "text", optional), field("destination", "终点"),
        choice("mode", "运输方式", ["公路", "铁路", "水运", "航空", "铁公联运", "水公联运", "多式联运"]),
        amount("volume", "运量（万吨）", positive), amount("distance", "运距（公里）", positive),
        amount("freight", "运费（万元）"),
      ]),
      list("lastYear", "上年同月运量", [
        field("goods", "货物品类"), amount("volume", "运量（万吨）"),
      ]),
    ],
  },
  logistics: {
    view: "logistics", title: "节点与履约",
    note: "录入原始分子和分母。费用、准时及安全数据会重算物流分。",
    fields: [
      amount("output", "产业产值（亿元）", positive), amount("cost", "物流总费用（亿元）"),
      count("tickets", "运单总数（票）", positive), count("onTime", "准时交付（票）"),
      count("loss", "货损货差运单（票）"), amount("hours", "运输总时长（小时）"),
      count("documents", "应互通单证（份）", positive), count("connected", "已互通单证（份）"),
    ],
    sections: [list("nodes", "核心物流节点", [
      field("name", "节点名称"), field("role", "节点职能"),
      field("reachable", "当前可达", "boolean"), amount("hours", "计划时效（小时）"),
    ])],
  },
  supply: {
    view: "supply", title: "采购与配套",
    note: "采购总额由三类来源相加。各品类购销额须合计为采购额加销售额；其余供应商金额会自动补齐。",
    fields: [
      amount("local", "本地采购（亿元）"), amount("domestic", "国内其他地区采购（亿元）"),
      amount("imports", "进口采购（亿元）"), amount("sales", "销售额（亿元）"),
      amount("leader", "链主营收（亿元）"), amount("revenue", "链上营收（亿元）", positive),
    ],
    sections: [
      list("categories", "品类购销", [field("label", "品类"), amount("amount", "购销额（亿元）"), field("traceId", "追溯部件", "part", optional)]),
      list("suppliers", "主要供应商", [field("label", "供应商"), amount("amount", "采购额（亿元）")]),
      list("stages", "关键环节", [field("label", "环节名称"), field("covered", "已覆盖", "boolean")]),
    ],
  },
  resilience: {
    view: "resilience", title: "保供与预警",
    note: "同一品类录入一次。系统据此计算缺口、供应商异常、区域集中变化及预警，并重算瓶颈品类占比。",
    sections: [list("categories", "关键品类观测", [
      field("label", "关键品类"), count("demand", "需求（批）"), count("delivered", "到货（批）"),
      field("supplier", "跟踪供应商", "text", optional),
      count("scheduled", "供方应到（批）"), count("late", "供方延误（批）"), count("stoppedDays", "停供天数", { max: 31 }),
      field("region", "主要来源地", "text", optional), amount("previousShare", "上期来源占比（%）", percent),
      amount("currentShare", "本期来源占比（%）", percent),
      amount("previousPurchase", "上期采购量"), amount("currentPurchase", "本期采购量（同单位）"),
      count("alternatives", "备选供方（家）"), field("alternativeCity", "备选来源地", "text", optional),
      field("route", "备用线路（用 / 分隔）", "text", optional),
      field("traceId", "追溯部件", "part", optional),
      field("owner", "预警核验岗位", "text", optional),
      choice("status", "核验状态", ["待核验", "核验中", "已核验", "已处理"]),
    ])],
  },
  gap: {
    view: "gap", title: "对标与改进任务",
    note: "对标指数由同产业各城市的月度数据计算。切换城市可更新对标方；这里可维护本市增加值和任务。",
    fields: [amount("addedValue", "本市产业增加值（亿元）", positive)],
    sections: [list("tasks", "任务补充与修订", [
      choice("id", "关联指标", ["cost", "ontime", "safety", "coverage", "local", "cr5", "leader", "bottleneck"]),
      field("title", "任务名称"), field("action", "改进措施"), field("owner", "牵头岗位"),
      field("deadline", "计划期限", "date"), field("acceptance", "验收口径"),
      choice("priority", "优先级", ["高", "中", "低"]),
    ])],
  },
  trace: {
    view: "supply", title: "供应链追溯",
    note: "按部件维护当月节点和关系。经纬度使用高德 GCJ-02 坐标。补录关系前请核验来源。",
    fields: [field("note", "资料及口径说明")],
    sections: [
      list("nodes", "追溯节点", [
        field("id", "节点编号"), field("label", "企业或环节名称"), count("tier", "层级（0 为整机端）", { max: 8 }),
        field("place", "所在地", "text", optional), field("city", "城市", "text", optional),
        field("product", "供应产品", "text", optional),
        field("sourceLabel", "补充资料标题", "text", optional), field("sourceUrl", "补充资料链接", "url", optional),
        amount("lng", "经度", { min: -180, max: 180, optional: true }),
        amount("lat", "纬度", { min: -90, max: 90, optional: true }),
      ]),
      list("edges", "供货关系", [
        field("from", "上游节点编号"), field("to", "下游节点编号"),
        choice("status", "关系类型", ["供货", "关联"]),
        amount("share", "披露占比（%）", { ...optional, ...percent }),
        amount("year", "披露年份", { ...optional, min: 1900, max: 2100 }),
        field("basis", "占比统计口径", "text", optional),
      ]),
    ],
  },
};

export const metricLabels = {
  cost: "物流费用占比", ontime: "物流准时交付率", safety: "物流安全性",
  coverage: "环节覆盖率", local: "本地配套率", cr5: "供应商集中度",
  leader: "龙头依赖度", bottleneck: "瓶颈品类占比",
  "供货": "供货或已核验", "关联": "关联或待核验",
};
