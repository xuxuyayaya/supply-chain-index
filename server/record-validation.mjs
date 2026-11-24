import { recordGroups } from "../frontend/record-schema.js";

const has = (value, key) => Object.hasOwn(value, key);
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const unique = (rows, key, label) =>
  check(new Set(rows.map((row) => row[key])).size === rows.length, label + "不能重复。");

function fields(data, schema, parts, context) {
  check(data && typeof data === "object" && !Array.isArray(data), context + "格式有误。");
  return Object.fromEntries(schema.map((field) => {
    const value = has(data, field.key) ? data[field.key] : null;
    const name = context + field.label;
    if (field.optional && (value === null || value === "")) {
      return [field.key, field.type === "number" ? null : ""];
    }
    if (field.type === "number" || field.type === "integer") {
      check(Number.isFinite(value) && value >= (field.min ?? 0) && value <= (field.max ?? 1e12)
        && (!field.positive || value > 0)
        && (field.type !== "integer" || Number.isSafeInteger(value)), name + "的数值无效。");
      return [field.key, value];
    }
    if (field.type === "boolean") {
      check(typeof value === "boolean", name + "需选择是或否。");
      return [field.key, value];
    }
    const text = typeof value === "string" ? value.trim() : "";
    check(text && text.length <= 500, name + "不能为空，最多 500 字。");
    if (field.type === "select") check(field.options.includes(text), name + "的选项无效。");
    if (field.type === "part") check(parts.includes(text), name + "不存在。");
    if (field.type === "url") check(/^https?:\/\/[^\s]+$/i.test(text) && URL.canParse(text), name + "须为有效的网页链接。");
    if (field.type === "date") {
      const date = new Date(text);
      check(/^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(date.getTime())
        && date.toISOString().slice(0, 10) === text, name + "无效。");
    }
    return [field.key, text];
  }));
}

export function validateRecordGroup(group, data, parts) {
  check(has(recordGroups, group), "数据类型不存在。");
  const schema = recordGroups[group];
  const result = fields(data, schema.fields ?? [], parts, "");
  for (const { key, fields: columns, label } of schema.sections ?? []) {
    check(Array.isArray(data[key]) && data[key].length <= 200, label + "须为列表，每组最多 200 行。");
    result[key] = data[key].map((row, i) => fields(row, columns, parts, label + "第 " + (i + 1) + " 行："));
  }
  if (group === "routes") {
    check(result.routes.length > 0, "至少保留一条线路。");
    unique(result.lastYear, "goods", "上年同期品类");
  }
  if (group === "logistics") {
    check(result.cost <= result.output, "物流费用不能超过产业产值。");
    check(result.onTime <= result.tickets && result.loss <= result.tickets, "准时交付或货损票数不能超过总票数。");
    check(result.connected <= result.documents, "已互通单证数不能超过应互通数。");
    unique(result.nodes, "name", "节点名称");
  }
  if (group === "supply") {
    const purchase = result.local + result.domestic + result.imports;
    const total = purchase + result.sales;
    check(purchase > 0, "采购总额须大于 0。");
    check(result.leader <= result.revenue, "链主营收不能超过链上营收。");
    check(sum(result.suppliers, "amount") <= purchase + 0.000001, "已录入供应商采购额不能超过采购总额。");
    check(Math.abs(sum(result.categories, "amount") - total) < 0.000001, "品类购销额合计须等于采购总额加销售额。");
    check(result.stages.length > 0, "至少保留一个关键环节。");
    for (const key of ["categories", "suppliers", "stages"]) unique(result[key], "label", "名称");
  }
  if (group === "resilience") {
    check(result.categories.length > 0, "至少保留一个关键品类。");
    unique(result.categories, "label", "品类名称");
    for (const row of result.categories) {
      check(row.late <= row.scheduled, row.label + "的延误批次不能超过应到批次。");
      check((!row.late && !row.stoppedDays && !row.scheduled) || row.supplier, row.label + "的供方记录需要供应商名称。");
      check((!row.previousShare && !row.currentShare) || row.region, row.label + "的来源占比需要标明来源地。");
    }
  }
  if (group === "gap") unique(result.tasks, "id", "任务关联指标");
  if (group === "trace") {
    unique(result.nodes, "id", "节点编号");
    const ids = new Set(result.nodes.map((row) => row.id));
    for (const row of result.nodes) {
      check(/^[\w.-]+$/.test(row.id), "节点编号只能使用字母、数字、下划线、点或短横线。");
      check((row.lng === null) === (row.lat === null), "经纬度须同时填写。");
      check(!row.sourceLabel || row.sourceUrl, "填写资料标题时须一起填写链接。");
    }
    const pairs = new Set();
    for (const row of result.edges) {
      check(row.from !== row.to && ids.has(row.from) && ids.has(row.to), "供货关系须关联两个不同的现有节点。");
      check(row.share === null || (Number.isInteger(row.year) && row.basis), "填写披露占比时须同时填写年份与统计口径。");
      const pair = row.from + "/" + row.to;
      check(!pairs.has(pair), "供货关系不能重复。");
      pairs.add(pair);
    }
  }
  return result;
}
