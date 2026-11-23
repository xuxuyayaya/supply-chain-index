import { buildAnalysis } from './analysis.mjs';
import { assessSupply } from './assessment.mjs';
import kaifengTrace from './kaifeng-trace.json' with { type: 'json' };

const cases = [
  {
    id: 'advanced-manufacturing', cityId: 'suzhou', city: '苏州市', industryId: 'robot', industry: '工业机器人',
    name: '苏州 · 工业机器人',
    region: '江苏 · 苏州',
    description: '覆盖驱动、减速、控制及传感组件。',
    tags: ['工业机器人', '区域配套'],
    parts: [
      ['drive', '伺服驱动', 6.8], ['gear', '精密减速器', 4.6],
      ['control', '控制系统', 3.8], ['sensor', '传感组件', 2.8]
    ],
    periods: [
      ['2026-10', 19, 22, 18.6, 7.2, 3.4, [1.5, 1.2, 1, 0.9, 0.8], 0.26],
      ['2026-09', 18, 22, 17.9, 6.6, 3.1, [1.5, 1.3, 1, 0.9, 0.8], 0.28]
    ],
    nodes: ['精密材料厂', '核心组件厂', '模组配套厂', '工业机器人整机厂']
  },
  {
    id: 'energy-equipment', cityId: 'nanchang', city: '南昌市', industryId: 'storage', industry: '储能装备',
    name: '南昌 · 储能装备',
    region: '江西 · 南昌',
    description: '覆盖电池模组、功率转换、温控及结构件。',
    tags: ['储能装备', '关键组件'],
    parts: [
      ['battery', '电池模组', 9.6], ['power', '功率转换', 5.4],
      ['cooling', '温控组件', 3.4], ['housing', '结构件', 2.6]
    ],
    periods: [
      ['2026-10', 15, 18, 17.5, 6.8, 3.5, [2, 1.5, 1.1, 0.8, 0.7], 0.32],
      ['2026-09', 14, 18, 16.8, 6.2, 3.2, [2, 1.5, 1, 0.9, 0.7], 0.33]
    ],
    nodes: ['基材配套厂', '核心器件厂', '系统模组厂', '储能装备整机厂']
  },
  {
    id: 'kaifeng-auto', cityId: 'kaifeng', city: '开封市', industryId: 'auto', industry: '汽车及零部件',
    name: '开封 · 汽车及零部件',
    region: '河南 · 开封',
    description: '覆盖整车装配、关键总成、零部件及上游材料。',
    tags: ['汽车及零部件', '整车制造'],
    parts: [
      ['electric', '电芯及电池材料', 6.8], ['body', '车身冲压', 3.2],
      ['seat', '内饰及座椅', 2.6], ['steel', '车用钢材', 4.5], ['other', '其他零部件', 5.9]
    ],
    periods: [['2026-10', 17, 20, 20, 16.4, 3, [1.8, 1.4, 1, 0.8, 0.6], 0.30],
      ['2026-09', 16, 20, 19.4, 15.5, 2.82, [1.9, 1.4, 1.1, .9, .7], .32]],
    nodes: ['材料配套厂', '汽车部件厂', '总成配套厂', '汽车整车厂']
  }
];

const regionalIndustries = [
  { id:'suzhou-auto',template:'kaifeng-auto',cityId:'suzhou',city:'苏州市',industryId:'auto',industry:'汽车及零部件',name:'苏州 · 汽车及零部件',region:'江苏 · 苏州',periods:[['2026-10',18,20,35.6,24.9,5.4,[2.8,2.4,1.8,1.4,1.2],.26],['2026-09',17,20,34.2,23.1,5.1,[2.9,2.5,1.9,1.5,1.2],.28]],context:{revenue:92,procurement:['动力电池','线束总成','座椅总成','车身冲压件','车用钢材'],months:[[14,91,88,3,20,.05,11.5,12.4,85],[15,89,87,4,20,.06,11.1,12.2,84]]}},
  { id:'nanchang-auto',template:'kaifeng-auto',cityId:'nanchang',city:'南昌市',industryId:'auto',industry:'汽车及零部件',name:'南昌 · 汽车及零部件',region:'江西 · 南昌',periods:[['2026-10',16,20,18.2,12.1,2.8,[1.8,1.4,1.1,.8,.6],.31],['2026-09',15,20,17.5,11.2,2.6,[1.9,1.5,1.1,.9,.7],.33]],context:{revenue:49,procurement:['动力电池','线束总成','座椅总成','车身冲压件','车用钢材'],months:[[17,86,83,6,20,.06,6.8,8.2,82],[18,84,82,7,20,.07,6.5,8,81]]}},
  {
    id: 'suzhou-storage', template: 'energy-equipment', cityId: 'suzhou', city: '苏州市',
    industryId: 'storage', industry: '储能装备', name: '苏州 · 储能装备', region: '江苏 · 苏州',
    periods: [
      ['2026-10',16,18,23.6,16.8,4.2,[1.9,1.6,1.3,1,.8],.24],
      ['2026-09',15,18,22.4,15.4,4,[2,1.7,1.4,1,.8],.26]
    ],
    context: {revenue:72, procurement:['电芯','变流器','温控系统','箱体','连接器'], months:[
      [12,94,91,2,16,.05,8.6,9.4,84], [13,92,90,3,16,.06,8.2,9.2,83]
    ]}
  },
  {
    id: 'nanchang-robot', template: 'advanced-manufacturing', cityId: 'nanchang', city: '南昌市',
    industryId: 'robot', industry: '工业机器人', name: '南昌 · 工业机器人', region: '江西 · 南昌',
    periods: [
      ['2026-10',17,22,12.8,7.8,2.2,[1.2,1,.9,.7,.6],.29],
      ['2026-09',16,22,12.2,7.2,2,[1.2,1.1,.9,.8,.6],.31]
    ],
    context: {revenue:38, procurement:['伺服驱动','精密减速器','工业控制器','传感器','编码器'], months:[
      [16,87,85,4,18,.07,4.8,5.6,81], [17,85,84,5,18,.08,4.5,5.5,80]
    ]}
  },
  {
    id: 'kaifeng-storage', template: 'energy-equipment', cityId: 'kaifeng', city: '开封市',
    industryId: 'storage', industry: '储能装备', name: '开封 · 储能装备', region: '河南 · 开封',
    periods: [
      ['2026-10',13,18,9.6,5.8,1.4,[1.1,.9,.7,.5,.4],.34],
      ['2026-09',12,18,9.2,5.3,1.3,[1.2,.9,.7,.6,.4],.36]
    ],
    context: {revenue:26, procurement:['电芯','变流器','温控系统','箱体','连接器'], months:[
      [18,82,80,5,16,.05,3.1,4.2,80], [19,80,79,6,16,.06,2.9,4.1,79]
    ]}
  }
];
for (const {template, ...entry} of regionalIndustries) {
  const base = cases.find(item => item.id === template);
  cases.push({...base, ...entry, template});
}

const source = {
  label: '城市产业链月度测算',
  note: '城市得分、购销额和对标值按月度模型测算。'
};

// Monthly model inputs in the same order as each city's reporting periods.
const contexts = {
  'advanced-manufacturing': { revenue: 68, procurement: ['伺服驱动', '精密减速器', '工业控制器', '传感器', '编码器'], months: [
    [13,93,89,3,18,.06,7.6,8.4,83], [14,91,88,4,18,.065,7.3,8.3,82]
  ] },
  'energy-equipment': { revenue: 52, procurement: ['电芯', '变流器', '温控系统', '箱体', '连接器'], months: [
    [16,87,84,4,16,.08,5.7,6.8,81], [17,85,82,5,16,.09,5.5,6.7,80]
  ] },
  'kaifeng-auto': { revenue: 60, procurement: ['动力电池', '线束总成', '座椅总成', '车身冲压件', '车用钢材'], months: [
    [18,80,78,5,20,.06,8.1,9.2,82], [19,78,77,6,20,.07,7.8,9.0,81]
  ] }
};
const stagesByCity = {
  'kaifeng-auto': ['整车装配','冲压成形','车身焊接','涂装','发动机装配','车桥装配','线束加工','座椅装配','内外饰注塑','燃油箱成形','排气总成','电池集成','热管理','制动系统','轮胎配套','玻璃加工','模具维护','车规级芯片供给','高性能功能膜供应','精密轴承制造'],
  'advanced-manufacturing': ['本体装配','结构件铸造','机身加工','关节装配','电机绕组','电机装配','驱动器集成','控制柜','控制软件','工业总线','视觉检测','编码器集成','线缆加工','末端执行器','动力配线','精密齿轮','散热装配','安全控制','传感标定','谐波柔轮制造','力矩芯片供给','高精轴承制造'],
  'energy-equipment': ['电芯分选','模组装配','电池簇装配','箱体制造','铜排加工','连接器装配','电气配线','电池管理','消防联动','能量管理','变流器装配','逆变控制','系统集成','冷板加工','温控装配','功率半导体供给','隔膜制造','高压传感器制造']
};
const criteria = {
  coverage: { limits: [70,80,90], goal: 90, action: '按缺失环节核实本地产能、周边供应商与替代交期。' },
  local: { limits: [60,70,85], goal: 85, action: '从外采金额较大的部件筛选本市可承接的供应商。' },
  cr5: { limits: [25,35,45], goal: 25, action: '优先核查采购额居首的品类，评估第二供应来源。' },
  leader: { limits: [20,35,50], goal: 20, action: '跟踪链主营收占比，并培育具有独立订单的配套企业。' }
};

export function listCases() {
  return cases.map(({ id, cityId, city, industryId, industry, name, region, description, tags, periods }) => ({
    id, cityId, city, industryId, industry, name, region, description, tags, periods: periods.map(([period]) => period)
  }));
}

function indicator(id, name, numerator, denominator, direction, weight, note) {
  const raw = Number.isFinite(numerator) && denominator > 0 ? numerator / denominator * 100 : null;
  const value = raw !== null && raw >= 0 && raw <= 100 ? raw : null;
  const score = value === null ? null : direction === 'positive' ? value : 100 - value;
  return {
    id, name, numerator, denominator, direction, weight, note,
    value, score, contribution: score === null ? null : score * weight
  };
}

export function getCase(id, period) {
  const entry = cases.find(item => item.id === id);
  const row = entry?.periods.find(([name]) => name === period) ?? (period ? undefined : entry?.periods[0]);
  if (!entry || !row) return null;
  const [date, covered, stages, purchase, local, sales, rank, leader] = row;
  const context = entry.context ?? contexts[id];
  const rowIndex = entry.periods.indexOf(row);
  const [cost, ontime, safety, bottlenecks, keyGoods, importRate, addedValue, peerValue, peerIndex] = context.months[rowIndex];
  const total = purchase + sales;
  const topFive = rank.reduce((sum, value) => sum + value, 0);
  const metrics = [
    indicator('coverage', '环节覆盖率', covered, stages, 'positive', .3, '本地具备产能或周边可稳定供货的环节数 ÷ 全部关键环节数。部件目录用于查证路径，同一环节可包含多个部件。'),
    indicator('local', '本地配套率', local, purchase, 'positive', .3, '链主向本市供应商采购金额 ÷ 当月链主采购总额，金额单位为亿元。'),
    indicator('cr5', '供应商集中度', topFive, purchase, 'negative', .2, '按采购额排序的前五家供应商采购金额 ÷ 当月采购总额，金额单位为亿元。'),
    indicator('leader', '龙头依赖度', Number((leader * context.revenue).toFixed(2)), context.revenue, 'negative', .2, '链主营收 ÷ 同地区、同产业、同月度链上企业营收总额。金额单位为亿元。')
  ];
  for (const item of metrics) {
    const { limits, goal, action } = criteria[item.id];
    const positive = item.direction === 'positive';
    const band = limits.filter(limit => positive ? item.value >= limit : item.value > limit).length;
    Object.assign(item, { limits, goal, action, grade: item.value === null ? '缺数' :
      (positive ? ['偏差','关注','正常','优秀'] : ['优秀','正常','关注','偏差'])[band],
      gap: item.value === null ? null : Math.max(0, positive ? goal-item.value : item.value-goal) });
  }
  const index = metrics.some(item => item.contribution === null)
    ? null : metrics.reduce((sum, item) => sum + item.contribution, 0);
  const logistics = (100-cost)*.4 + ontime*.3 + safety*.3;
  const resilience = 100 * (1-bottlenecks/keyGoods);
  const development = index === null ? null : logistics*.3 + index*.4 + resilience*.3;
  const previousRow = entry.periods[rowIndex+1];
  const previous = previousRow ? getCase(id, previousRow[0]) : null;
  const imports = Number((purchase*importRate).toFixed(2));
  const partTotal = entry.parts.reduce((sum, part) => sum + part[2], 0);
  const categories = entry.parts.map(([partId, label, amount]) => ({
    id: partId, label, amount: amount / partTotal * total,
    traceId: ['steel', 'other'].includes(partId) ? null : partId
  })).sort((a, b) => b.amount - a.amount);
  const record = {
    ...listCases().find(item => item.id === id),
    period: date, mode: 'modelled', version: '3.1', source, index, metrics,
    evaluation: { previous: previous ? { period: previous.period, score: previous.index } : null,
      logistics, cost, ontime, safety, resilience, bottlenecks, keyGoods, development,
      addedValue, peerValue, peerIndex },
    stages: stagesByCity[entry.template ?? id].map((label,i) => ({ label, covered: i < covered })),
    trade: {
      purchase, sales, total, categories, topFive,
      suppliers: rank.map((amount, i) => ({ label: context.procurement[i] + '供应商', amount, percent: amount / purchase * 100 })),
      origins: [{ label: '本地', amount: local }, { label: '国内其他地区', amount: purchase - local - imports }, { label: '进口', amount: imports }]
    },
    traceParts: id === 'kaifeng-auto' ? Object.values(kaifengTrace).map(({partId, label}) => ({id: partId, label})) : entry.parts.filter(([partId]) => !['steel', 'other'].includes(partId)).map(([partId, label]) => ({ id: partId, label }))
  };
  return { ...record, assessment: assessSupply(record) };
}


// City-center GCJ-02 demonstration coordinates. No supplier facility is implied.
const traceLocations = {
  'suzhou': [['南京',118.80,32.06],['无锡',120.31,31.49],['常州',119.97,31.81],['苏州',120.59,31.30],['杭州',120.15,30.28]],
  'nanchang': [['宜春',114.39,27.80],['吉安',114.99,27.11],['新余',114.92,27.82],['南昌',115.86,28.68],['赣州',114.93,25.83]],
  'kaifeng': [['武汉',114.31,30.59],['芜湖',118.38,31.33],['郑州',113.63,34.75],['开封',114.31,34.80],['合肥',117.23,31.82]]
};

export function getIndex(id, period, partId) {
  const record = getCase(id, period);
  if (!record) return null;
  const part = partId ?? record.traceParts[0]?.id;
  const trace = part ? getTrace(id, part) : null;
  if (part && !trace) return null;
  const peers = listCases().filter(item=>item.industryId===record.industryId && item.id!==id).map(item=>getCase(item.id,record.period)).filter(Boolean);
  const history = record.periods.filter(month=>month<=record.period).map(month=>getCase(id,month));
  return { ...record, trace, analysis: buildAnalysis(record,peers,history) };
}

export function getTrace(id, partId) {
  if (id === 'kaifeng-auto') {
    if (partId === 'all') return allKaifengParts();
    return Object.hasOwn(kaifengTrace, partId) ? kaifengTrace[partId] : null;
  }
  const entry = cases.find(item => item.id === id);
  const part = entry?.parts.find(([key]) => key === partId && !['steel', 'other'].includes(key));
  if (!part) return null;
  const nodes = entry.nodes.map((label, i) => ({
    id: 'tier-' + i, label: i < 3 ? part[1] + ' · ' + label : label,
    tier: 3 - i, place: ['上游材料区', '组件制造区', '区域配套区', entry.region][i]
  }));
  nodes.push({ id: 'tier-1b', label: part[1] + ' · 备选组件厂', tier: 2, place: '跨区配套区' });
  nodes.forEach((node, i) => {
    const [city, lng, lat] = traceLocations[entry.cityId][i];
    Object.assign(node, { city, position: [lng, lat] });
  });
  const edges = [
    ...nodes.slice(0, 3).map((node, i) => ({ from: node.id, to: nodes[i + 1].id, status: 'modelled' })),
    { from: 'tier-1b', to: 'tier-2', status: 'association' }
  ];
  return { partId, label: part[1], nodes, edges, source: { note: '企业以产业角色标识，供货路径随城市评价模型配置。' } };
}

// Retain the part on every node and edge so a role in one chain cannot imply an order in another.
function allKaifengParts() {
  const trace = { partId: 'all', label: '全品类', nodes: [], edges: [], source: { note: '各路径按原部件范围归集。点选企业可查看该品类的披露资料。' } };
  for (const part of Object.values(kaifengTrace)) {
    const key = id => part.partId + '/' + id;
    for (const node of part.nodes) trace.nodes.push({ ...node, id:key(node.id), partLabel:part.label, sources:part.sources });
    for (const edge of part.edges) trace.edges.push({ ...edge, from:key(edge.from), to:key(edge.to) });
  }
  return trace;
}
