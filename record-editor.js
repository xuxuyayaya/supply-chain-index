import { recordGroups, metricLabels } from "./record-schema.js";
import { el } from "./ui.js";

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
  control.setAttribute("aria-label", field.label);
  control.oninput = () => update(
    control.type === "number" ? (control.value === "" ? null : control.valueAsNumber)
      : field.type === "boolean" ? control.value === "true" : control.value,
  );
  return control;
}

const resiliencePanels = [
  ["需求与到货", ["label", "demand", "delivered", "traceId"]],
  ["供应商交付", ["label", "supplier", "scheduled", "late", "stoppedDays"]],
  ["区域与采购", ["label", "region", "previousShare", "currentShare", "previousPurchase", "currentPurchase"]],
  ["备选与核验", ["label", "alternatives", "alternativeCity", "route", "owner", "status"]],
];

function panelsFor(group, schema) {
  if (group === "resilience") {
    const section = schema.sections[0];
    return resiliencePanels.map(([label, keys], i) => ({
      ...section, label, fields: keys.map(key => section.fields.find(field => field.key === key)),
      allFields: section.fields, editableRows: i === 0,
    }));
  }
  return [
    ...(schema.fields ? [{ label: group === "gap" ? "产业增加值" : "基础数据", fields: schema.fields }] : []),
    ...schema.sections.map(section => ({ ...section, editableRows: true })),
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
      ...init, signal: AbortSignal.timeout(25000), cache: "no-store",
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
    const { schema, group, data, parts } = session;
    const panels = panelsFor(group, schema);
    const tabs = el("div", undefined, "record-tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "录入项目");
    const content = el("section");
    const results = el("section", undefined, "record-preview");
    const version = el("p", session.published ? "正在编辑已保存的月度记录。" : "表单已带入当前测算值，可直接补充或修正。", "record-meta");

    const credential = el("label", "GitHub 写入令牌", "record-token");
    const password = el("input");
    password.type = "password";
    password.autocomplete = "off";
    password.spellcheck = false;
    password.placeholder = "粘贴具有仓库 Contents 读写权限的令牌";
    credential.append(password);
    const tokenLink = el("a", "创建令牌", "view-text-link");
    tokenLink.href = "https://github.com/settings/personal-access-tokens/new?name=Supply+chain+records&target_name=xuxuyayaya&contents=write";
    tokenLink.target = "_blank";
    tokenLink.rel = "noopener";
    const access = el("div", undefined, "record-access");
    access.append(credential, tokenLink, el("p", "保存会提交到公开仓库。只录入可公开的数据。令牌仅用于本次提交。", "record-meta"));
    access.hidden = true;

    const preview = makeButton("试算并查看变化", () => submit("POST"), "primary-button");
    const save = makeButton("保存到 GitHub", () => submit("PUT"), "primary-button");
    save.hidden = true;
    footer.replaceChildren(makeButton("关闭", close), preview, save);

    function changed() {
      session.dirty = true;
      results.replaceChildren();
      message.textContent = "";
      save.hidden = access.hidden = true;
    }

    function showPanel(index = 0) {
      session.panel = index;
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
        return;
      }
      const rows = data[panel.key];
      const scroller = el("div", undefined, "record-table-wrap");
      scroller.tabIndex = 0;
      scroller.setAttribute("aria-label", panel.label);
      const table = el("table");
      const head = el("tr");
      for (const field of panel.fields) {
        const cell = el("th", field.label);
        cell.scope = "col";
        head.append(cell);
      }
      if (panel.editableRows) head.append(el("th", "操作"));
      table.createTHead().append(head);
      const tbody = table.createTBody();
      rows.forEach((row, i) => {
        const tr = tbody.insertRow();
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
      });
      scroller.append(table);
      const tools = el("div", undefined, "record-list-tools");
      tools.append(el("span", "共 " + rows.length + " 行"));
      if (panel.editableRows)
        tools.append(makeButton("＋ 新增一行", () => {
          rows.push(emptyRow(panel.allFields ?? panel.fields));
          changed();
          showPanel(index);
          content.querySelector("tbody tr:last-child input, tbody tr:last-child select")?.focus();
        }));
      if (group === "gap" && session.suggestions.some(item => !rows.some(row => row.id === item.id))) {
        tools.append(makeButton("带入本期建议任务", () => {
          rows.push(...session.suggestions.filter(item => !rows.some(row => row.id === item.id)).map(item => ({ ...item })));
          changed();
          showPanel(index);
        }));
      }
      content.append(tools, scroller);
    }

    panels.forEach((panel, i) => tabs.append(makeButton(panel.label, () => showPanel(i), "record-tab")));
    showPanel();
    body.replaceChildren(el("p", schema.note), version, tabs, content, results, access);

    async function submit(method) {
      const token = password.value.trim();
      if (method === "PUT" && !token) {
        message.textContent = "请输入 GitHub 写入令牌。";
        password.focus();
        return;
      }
      if (method === "PUT") password.value = "";
      busy = true;
      // Disable every editing control while the submitted revision is in flight.
      const controls = [...dialog.querySelectorAll("input, select, button")].filter(node => !node.disabled);
      controls.forEach(node => { node.disabled = true; });
      message.textContent = method === "POST" ? "正在试算…" : "正在提交到 GitHub…";
      try {
        const result = await request(session.url, {
          method, headers: {
            "Content-Type": "application/json",
            ...(method === "PUT" ? { Authorization: "Bearer " + token } : {}),
          },
          body: JSON.stringify({ sha: session.sha, data }),
        });
        if (method === "POST") {
          drawPreview(results, result);
          save.hidden = access.hidden = !session.ready;
          message.textContent = session.ready ? "试算完成。确认结果后可保存。" : "试算完成。GitHub 记录暂未连通，请稍后重开窗口保存。";
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

  return async (group, record, part) => {
    if (!record || dialog.open) return;
    const schema = recordGroups[group];
    title.textContent = schema.title + "录入";
    context.textContent = record.city + " · " + record.industry + " · " + record.period;
    const url = new URLSearchParams({ case: record.id, period: record.period, group });
    if (group === "trace") url.set("part", part);
    if (group === "trace") context.textContent += " · " + record.traceParts.find(item => item.id === part).label;
    message.textContent = "";
    footer.replaceChildren(makeButton("关闭", close));
    body.replaceChildren(el("p", "正在读取当期数据…", "loading"));
    dialog.showModal();
    busy = true;
    try {
      const result = await request(url);
      session = { ...result, schema, group, url, dirty: false };
      draw(session);
    } catch (error) {
      body.replaceChildren(el("p", "录入接口暂未响应。请关闭窗口后重试。", "error"));
    } finally {
      busy = false;
    }
  };
}

function drawPreview(target, { before, after }) {
  const cards = el("div", undefined, "record-result-grid");
  after.cards.forEach((item, i) => {
    const card = el("div");
    const prior = before.cards[i].value;
    const range = Math.abs(prior - item.value) < 0.000001 ? valueText(item.value, item.unit)
      : valueText(prior, item.unit) + " → " + valueText(item.value, item.unit);
    card.append(el("span", item.label), el("strong", range));
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
