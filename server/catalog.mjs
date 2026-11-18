const cases = [
  {
    id: 'advanced-manufacturing',
    name: '先进制造产业链',
    region: '海川示范区（虚构）',
    description: '以工业机器人为例，查看关键部件配套、采购集中度和上游供货路径。',
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
    id: 'energy-equipment',
    name: '新能源装备产业链',
    region: '临汐示范区（虚构）',
    description: '以储能装备为例，分析关键环节覆盖程度和多层级供货关系。',
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
    id: 'kaifeng-auto',
    name: '开封汽车及零部件',
    region: '河南 · 开封',
    description: '参考原需求文档的汽车产业链示例，复现 78.5 分演示及部件上行追溯。',
    tags: ['汽车及零部件', '参考案例'],
    parts: [
      ['electric', '动力电池与电驱', 6.8], ['body', '车身冲压', 3.2],
      ['seat', '座椅', 2.6], ['steel', '车用钢材', 4.5], ['other', '其他零部件', 5.9]
    ],
    periods: [['2026-10', 17, 20, 20, 16.4, 3, [1.8, 1.4, 1, 0.8, 0.6], 0.30]],
    nodes: ['材料配套厂', '汽车部件厂', '总成配套厂', '汽车整车厂']
  }
];

const source = {
  label: '产品演示数据',
  note: '统计数值、企业节点和供货关系均为演示。开封评分数值引用原交流材料的示例。'
};

export function listCases() {
  return cases.map(({ id, name, region, description, tags, periods }) => ({
    id, name, region, description, tags, periods: periods.map(([period]) => period)
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
  const total = purchase + sales;
  const topFive = rank.reduce((sum, value) => sum + value, 0);
  const metrics = [
    indicator('coverage', '环节覆盖率', covered, stages, 'positive', .3, '满足供应条件的关键环节数 ÷ 关键环节总数。'),
    indicator('local', '本地配套率', local, purchase, 'positive', .3, '本地供应商采购额 ÷ 样本采购总额。'),
    indicator('cr5', '供应商集中度', topFive, purchase, 'negative', .2, '前五家供应商采购额 ÷ 样本采购总额。'),
    indicator('leader', '龙头依赖度', leader * 100, 100, 'negative', .2, '演示采用链主营收 ÷ 同范围链上营收。分子分母为归一化演示值。')
  ];
  const index = metrics.some(item => item.contribution === null)
    ? null : metrics.reduce((sum, item) => sum + item.contribution, 0);
  const partTotal = entry.parts.reduce((sum, part) => sum + part[2], 0);
  const categories = entry.parts.map(([partId, label, amount]) => ({
    id: partId, label, amount: amount / partTotal * total,
    traceId: ['steel', 'other'].includes(partId) ? null : partId
  })).sort((a, b) => b.amount - a.amount);
  return {
    ...listCases().find(item => item.id === id),
    period: date, mode: 'demo', version: '1.0', source, index, metrics,
    trade: {
      purchase, sales, total, categories, topFive,
      suppliers: rank.map((amount, i) => ({ label: '示例供应商 ' + (i + 1), amount, percent: amount / purchase * 100 })),
      origins: [{ label: '本地', amount: local }, { label: '国内其他地区', amount: purchase - local }]
    },
    traceParts: entry.parts.filter(([partId]) => !['steel', 'other'].includes(partId)).map(([partId, label]) => ({ id: partId, label }))
  };
}


// City-center GCJ-02 demonstration coordinates. No supplier facility is implied.
const traceLocations = {
  'advanced-manufacturing': [['苏州',120.59,31.30],['无锡',120.31,31.49],['常州',119.97,31.81],['南京',118.80,32.06],['杭州',120.15,30.28]],
  'energy-equipment': [['宜春',114.39,27.80],['吉安',114.99,27.11],['新余',114.92,27.82],['南昌',115.86,28.68],['赣州',114.93,25.83]],
  'kaifeng-auto': [['武汉',114.31,30.59],['芜湖',118.38,31.33],['郑州',113.63,34.75],['开封',114.31,34.80],['合肥',117.23,31.82]]
};

export function getIndex(id, period, partId) {
  const record = getCase(id, period);
  if (!record) return null;
  const part = partId ?? record.traceParts[0]?.id;
  const trace = part ? getTrace(id, part) : null;
  return part && !trace ? null : { ...record, trace };
}

export function getTrace(id, partId) {
  const entry = cases.find(item => item.id === id);
  const part = entry?.parts.find(([key]) => key === partId && !['steel', 'other'].includes(key));
  if (!part) return null;
  const nodes = entry.nodes.map((label, i) => ({
    id: 'tier-' + i, label: i < 3 ? part[1] + ' · ' + label : label,
    tier: 3 - i, place: ['上游材料区', '组件制造区', '区域配套区', entry.region][i]
  }));
  nodes.push({ id: 'tier-1b', label: part[1] + ' · 备选组件厂', tier: 2, place: '跨区配套区' });
  nodes.forEach((node, i) => {
    const [city, lng, lat] = traceLocations[id][i];
    Object.assign(node, { city, position: [lng, lat] });
  });
  const edges = [
    ...nodes.slice(0, 3).map((node, i) => ({ from: node.id, to: nodes[i + 1].id, status: 'demo' })),
    { from: 'tier-1b', to: 'tier-2', status: 'association' }
  ];
  return { partId, label: part[1], nodes, edges, source };
}
