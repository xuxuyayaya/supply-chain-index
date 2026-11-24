import { recordGroups, metricLabels } from "./record-schema.js?v=20261124-records";
import { changeBadge, el } from "./ui.js?v=20261124-change-colors";

const valueText = (value, unit) => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value) + " " + unit;
const repository = "https://github.com/xuxuyayaya/supply-chain-index";
const makeButton = (label, action, className = "quiet") => {
  const button = el("button", label, className);
  button.type = "button";
  button.onclick = action;
  return button;
};

function input(field, value, parts, update) {
  let control;
  if (["select", "part", "boolean"].includes(field.type)) {
    control = el("select");
    if (field.type === "boolean") control.append(new Option("是", "true"), new Option("否", "false"));
    else if (field.type === "part") control.append(new Option("未关联", ""),
      ...parts.map(item => new Option(item.label, item.id)));
    else control.append(...field.options.map(option => new Option(metricLabels[option] ?? option, option)));
  } else {
    control = el("input");
    const numeric = ["number", "integer"].includes(field.type);
    control.type = numeric ? "number" : field.type;
    if (numeric) {
      control.step = field.type === "integer" ? "1" : "any";
      control.min = field.min ?? 0;
      if (field.max !== undefined) control.max = field.max;
    } else if (field.type === "text") control.maxLength = 500;
  }
  control.value = value ?? "";
  control.dataset.recordField = field.key;
  control.setAttribute("aria-label", field.label);
  control.oninput = () => update(
    control.type === "number" ? (control.value === "" ? null : control.valueAsNumber)
      : field.type === "boolean" ? control.value === "true" : control.value,
  );
  return control;
}

const resiliencePanels = [
  ["supply", "需求与到货", ["label", "demand", "delivered", "traceId"]],
  ["delivery", "供应商交付", ["label", "supplier", "scheduled", "late", "stoppedDays"]],
  ["source", "区域与采购", ["label", "region", "previousShare", "currentShare", "previousPurchase", "currentPurchase"]],
  ["review", "备选与核验", ["label", "alternatives", "alternativeCity", "route", "owner", "status"]],
];
const basePanels = {
  logistics: [
    ["cost", "产值与物流费用", ["output", "cost"]],
    ["delivery", "交付与货损", ["tickets", "onTime", "loss", "hours"]],
    ["documents", "单证互通", ["documents", "connected"]],
  ],
  supply: [
    ["trade", "采购与销售", ["local", "domestic", "imports", "sales"]],
    ["revenue", "链上营收", ["leader", "revenue"]],
  ],
  gap: [["base", "产业增加值", ["addedValue"]]],
  trace: [["base", "口径说明", ["note"]]],
};

function panelsFor(group, schema) {
  const chooseFields = (fields, keys) => keys.map(key => fields.find(field => field.key === key));
  if (group === "resilience") {
    const section = schema.sections[0];
    return resiliencePanels.map(([id, label, keys], i) => ({
      ...section, id, label, fields: chooseFields(section.fields, keys),
      allFields: section.fields, editableRows: i === 0,
    }));
  }
  return [
    ...(basePanels[group] ?? []).map(([id, label, keys]) => ({
      id, label, fields: chooseFields(schema.fields, keys),
    })),
    ...schema.sections.map(section => ({ ...section, id: section.key, editableRows: true })),
  ];
}

function emptyRow(fields) {
  return Object.fromEntries(fields.map(field => [field.key,
    field.type === "boolean" ? false
      : field.type === "select" ? field.options[0]
        : ["number", "integer"].includes(field.type) && !field.positive && !field.optional ? 0 : null,
  ]));
}

export function createRecordEditor(dialog, api, refresh) {
  const title = dialog.querySelector("h2");
  const context = dialog.querySelector(".record-context");
  const body = dialog.querySelector(".record-body");
  const footer = dialog.querySelector(".record-footer");
  const message = dialog.querySelector(".record-message");
  let session;
  let busy = false;

  const request = async (url, init = {}) => {
    const res = await fetch(api + "/api/records?" + url, {
      ...init, signal: AbortSignal.timeout(init.method === "PUT" ? 40000 : 25000), cache: "no-store",
    });
    const value = await res.json();
    if (!res.ok) throw new Error(value.error ?? "录入请求失败。");
    return value;
  };

  function close() {
    if (busy) return;
    if (session?.dirty && !window.confirm("关闭后将清除暂未保存的修改。确认关闭？")) return;
    dialog.close();
  }

  dialog.querySelector(".record-close").onclick = close;
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("close", () => {
    session = null;
    footer.replaceChildren();
    body.replaceChildren();
  });

  function draw(session) {
    const { schema, group, data, parts, options } = session;
    const matches = (row) => options.match && Object.entries(options.match).every(([key, value]) => row[key] === value);
    let direction = group === "routes" ? options.direction : null;
    const panels = panelsFor(group, schema);
    const tabs = el("div", undefined, "record-tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "录入项目");
    const content = el("section");
    const results = el("section", undefined, "record-preview");
    const version = el("p", session.published ? "正在编辑已保存的月度记录。" : "表单已带入当前测算值，可直接补充或修正。", "record-meta");

    const note = el("p", session.writable ? "保存后数据将公开，并更新相关指标。" : "在线保存暂不可用，可以先试算。", "record-meta");
    const preview = makeButton("试算并查看变化", () => submit("POST"));
    const save = makeButton("保存并更新指标", () => submit("PUT"), "primary-button");
    save.disabled = !session.writable;
    footer.replaceChildren(makeButton("关闭", close), preview, save);

    function changed() {
      session.dirty = true;
      results.replaceChildren();
      message.textContent = "";
    }

    function showPanel(index = 0, focus = null) {
      tabs.querySelectorAll("button").forEach((item, i) => item.setAttribute("aria-pressed", String(i === index)));
      const panel = panels[index];
      content.replaceChildren();
      if (!panel.list) {
        const grid = el("div", undefined, "record-fields");
        for (const field of panel.fields) {
          const label = el("label", field.label);
          label.append(input(field, data[field.key], parts, value => { data[field.key] = value; changed(); }));
          grid.append(label);
        }
        content.append(grid);
        if (focus === "entry" && options.field) grid.querySelector('[data-record-field="' + options.field + '"]')?.focus();
        return;
      }
      const rows = data[panel.key];
      const isRoutePanel = group === "routes" && panel.id === "routes";
      const scroller = el("div", undefined, "record-table-wrap");
      scroller.tabIndex = 0;
      scroller.setAttribute("aria-label", panel.label);
      const table = el("table");
      const tableTitle = isRoutePanel && direction ? panel.label + " · " + direction : panel.label;
      table.append(el("caption", tableTitle, "statistics-table-caption"));
      const head = el("tr");
      for (const field of panel.fields) {
        const cell = el("th", field.label);
        cell.scope = "col";
        head.append(cell);
      }
      if (panel.editableRows) head.append(el("th", "操作"));
      table.createTHead().append(head);
      const tbody = table.createTBody();
      const visible = rows.map((row, i) => ({ row, i })).filter(({ row }) => !isRoutePanel || !direction || row.direction === direction);
      let target;
      for (const { row, i } of visible) {
        const tr = tbody.insertRow();
        if ((focus === "entry" && matches(row)) || focus === i) {
          tr.className = "record-target-row";
          target = tr;
        }
        for (const field of panel.fields) {
          const td = tr.insertCell();
          if (group === "resilience" && !panel.editableRows && field.key === "label") td.textContent = row.label || "未填写品类";
          else td.append(input(field, row[field.key], parts, value => { row[field.key] = value; changed(); }));
        }
        if (panel.editableRows) {
          const remove = makeButton("删除", () => { rows.splice(i, 1); changed(); showPanel(index); }, "record-remove");
          remove.setAttribute("aria-label", "删除第 " + (i + 1) + " 行");
          tr.insertCell().append(remove);
        }
      }
      if (!visible.length) {
        const cell = tbody.insertRow().insertCell();
        cell.colSpan = panel.fields.length + Number(panel.editableRows);
        cell.textContent = "暂无记录，可新增一行。";
      }
      scroller.append(table);
      const tools = el("div", undefined, "record-list-tools");
      const counts = el("span", "共 " + visible.length + " 行");
      if (isRoutePanel) {
        const filter = el("select");
        filter.setAttribute("aria-label", "线路方向");
        filter.append(new Option("全部线路", ""), new Option("原料进货", "原料进货"), new Option("成品发运", "成品发运"));
        filter.value = direction || "";
        filter.onchange = () => { direction = filter.value; showPanel(index); };
        tools.append(filter);
      }
      tools.append(counts);
      if (panel.editableRows)
        tools.append(makeButton("＋ 新增一行", () => {
          const row = emptyRow(panel.allFields ?? panel.fields);
          if (isRoutePanel && direction) row.direction = direction;
          rows.push(row);
          changed();
          showPanel(index, rows.length - 1);
        }));
      if (group === "gap" && session.suggestions.some(item => !rows.some(row => row.id === item.id))) {
        tools.append(makeButton("带入本期建议任务", () => {
          rows.push(...session.suggestions.filter(item => !rows.some(row => row.id === item.id)).map(item => ({ ...item })));
          changed();
          showPanel(index);
        }));
      }
      content.append(tools, scroller);
      if (target || (focus === "entry" && options.field && !options.match)) {
        const focusRow = target ?? tbody.rows[0];
        const field = options.field && focusRow?.querySelector('[data-record-field="' + options.field + '"]');
        (field || focusRow?.querySelector("input, select"))?.focus();
      }
    }

    const initialPanel = Math.max(0, panels.findIndex(panel => panel.id === options.panel));
    if (options.match && group === "gap" && options.panel === "tasks" && !data.tasks.some(matches)) {
      const proposal = session.suggestions.find(matches);
      if (proposal) data.tasks.push({ ...proposal });
    }
    panels.forEach((panel, i) => tabs.append(makeButton(panel.label, () => showPanel(i), "record-tab")));
    body.replaceChildren(el("p", schema.note), version, tabs, content, results, note);
    showPanel(initialPanel, "entry");

    async function submit(method) {
      busy = true;
      // Disable every editing control while the submitted revision is in flight.
      const controls = [...dialog.querySelectorAll("input, select, button")].filter(node => !node.disabled);
      controls.forEach(node => { node.disabled = true; });
      message.textContent = method === "POST" ? "正在试算…" : "正在提交到 GitHub…";
      try {
        const result = await request(session.url, {
          method, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sha: session.sha, data }),
        });
        if (method === "POST") {
          drawPreview(results, result);
          message.textContent = session.writable ? "试算完成，可以保存。" : "试算完成。在线保存暂不可用。";
          results.scrollIntoView({ block: "start" });
        } else {
          session.dirty = false;
          const commit = el("a", "查看 GitHub 提交");
          commit.href = result.url.startsWith(repository + "/commit/") ? result.url : repository + "/tree/data";
          commit.target = "_blank";
          commit.rel = "noopener";
          body.replaceChildren(el("p", "本月数据已保存，正在刷新分析结果。"), commit);
          footer.replaceChildren(makeButton("完成", close, "primary-button"));
          message.textContent = "保存成功";
          await refresh();
        }
      } catch (error) {
        message.textContent = error.name === "TimeoutError" ? "请求超时。若刚提交，请重开窗口确认记录版本。" : error.message;
      } finally {
        busy = false;
        controls.forEach(node => { node.disabled = false; });
      }
    }
  }

  async function openSession(group, record, options) {
    const schema = recordGroups[group];
    title.textContent = schema.title + "录入";
    context.textContent = record.city + " · " + record.industry + " · " + record.period;
    const url = new URLSearchParams({ case: record.id, period: record.period, group });
    if (group === "trace") {
      url.set("part", options.part);
      context.textContent += " · " + record.traceParts.find(item => item.id === options.part).label;
    }
    footer.replaceChildren(makeButton("关闭", close));
    body.replaceChildren(el("p", "正在读取当期数据…", "loading"));
    busy = true;
    try {
      const result = await request(url);
      session = { ...result, schema, group, url, options, dirty: false };
      draw(session);
    } catch {
      body.replaceChildren(el("p", "录入接口暂未响应。请关闭窗口后重试。", "error"));
    } finally {
      busy = false;
    }
  }

  return (group, record, options = {}) => {
    if (!record || dialog.open) return;
    message.textContent = "";
    const choosePart = group === "trace" && !record.traceParts.some(item => item.id === options.part);
    if (choosePart) {
      title.textContent = "选择要维护的部件";
      context.textContent = record.city + " · " + record.industry + " · " + record.period;
      const dropdown = el("select");
      dropdown.setAttribute("aria-label", "追溯部件");
      dropdown.append(new Option("请选择部件", ""), ...record.traceParts.map(part => new Option(part.label, part.id)));
      const proceed = makeButton("继续录入", () => openSession(group, record, { ...options, part: dropdown.value }), "primary-button");
      proceed.disabled = true;
      dropdown.onchange = () => { proceed.disabled = !dropdown.value; };
      body.replaceChildren(dropdown);
      footer.replaceChildren(makeButton("关闭", close), proceed);
      dialog.showModal();
      return;
    }
    dialog.showModal();
    openSession(group, record, options);
  };
}

function drawPreview(target, { before, after }) {
  const cards = el("div", undefined, "record-result-grid");
  after.cards.forEach((item, i) => {
    const card = el("div");
    const prior = before.cards[i].value;
    const change = item.value - prior;
    const changed = Math.abs(change) >= 0.000001;
    const range = changed ? valueText(prior, item.unit) + " → " + valueText(item.value, item.unit)
      : valueText(item.value, item.unit);
    card.append(el("span", item.label), el("strong", range));
    if (changed) card.append(changeBadge(valueText(change, item.unit === "%" ? "个百分点" : item.unit)));
    cards.append(card);
  });
  const details = el("details");
  details.append(el("summary", "查看指标重算明细"));
  for (const item of after.indicators) {
    const row = el("div", undefined, "record-result-detail");
    row.append(el("strong", item.label + " · " + valueText(item.value, item.unit)), el("p", item.calculation));
    details.append(row);
  }
  target.replaceChildren(el("h3", "试算结果"), cards);
  if (after.indicators.length) target.append(details);
}
