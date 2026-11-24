import { getIndex, getTrace } from "./catalog.mjs";
import { recordGroups } from "../frontend/record-schema.js";
import { inputGroup, previewValues } from "./record-inputs.mjs";
import { currentRecords, publishRecord, RecordStoreError, recordWritesEnabled, syncRecords, withRecord } from "./record-store.mjs";
import { validateRecordGroup } from "./record-validation.mjs";

async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] ?? "")) {
    throw new RecordStoreError(415, "请求须使用 JSON 格式。");
  }
  let size = 0;
  const chunks = [];
  for await (const buf of req.iterator({ destroyOnReturn: false })) {
    size += buf.length;
    if (size > 512 * 1024) {
      req.resume();
      throw new RecordStoreError(413, "录入内容超出容量限制。");
    }
    chunks.push(buf);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new RecordStoreError(400, "无法解析录入内容。"); }
}

export async function recordApi(req, query, send) {
  const group = query.get("group"), id = query.get("case"), month = query.get("period"), part = query.get("part");
  if (!Object.hasOwn(recordGroups, group) || !/^[a-z0-9-]+$/.test(id ?? "") || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? "")) {
    return send(400, { error: "请选择有效的城市产业链、月份和录入类型。" });
  }
  const write = req.method === "PUT";
  if (write && !recordWritesEnabled()) return send(503, { error: "在线保存暂不可用。请保留已录入的数据并稍后重试。" });
  try {
    const ready = await syncRecords();
    const records = currentRecords();
    const key = group === "trace" ? "trace-" + part : group;
    const base = getIndex(id, month, group === "trace" ? part : null, records);
    if (!base || (group === "trace" && !base.traceParts.some(row => row.id === part))) {
      return send(404, { error: "评价月份或追溯部件不存在。" });
    }
    const saved = records[id]?.[month];
    if (req.method === "GET") {
      return send(200, {
        data: saved?.groups[key] ?? inputGroup(base, group, base.trace),
        sha: saved?.sha ?? null, updatedAt: saved?.updatedAt ?? null, ready,
        writable: ready && recordWritesEnabled(),
        parts: base.traceParts, published: Boolean(saved?.groups[key]),
        suggestions: group === "gap" ? base.analysis.gap.problems.map(({ id, title, action, owner, deadline, acceptance, priority }) => ({
          id, title, action, owner, deadline, acceptance, priority
        })) : [],
      });
    }
    const body = await readBody(req);
    if (!body || !Object.hasOwn(body, "data") || body.sha !== (saved?.sha ?? null)) {
      return send(409, { error: "本月记录已更新，请重新打开录入窗口后合并。" });
    }
    let normalized;
    try { normalized = validateRecordGroup(group, body.data, base.traceParts.map(item => item.id)); }
    catch (error) { return send(422, { error: error.message }); }
    const groups = { ...saved?.groups, [key]: normalized };
    const preview = getIndex(id, month, group === "trace" ? part : null, withRecord(id, month, { groups }));
    if (!write) return send(200, { before: previewValues(base, group), after: previewValues(preview, group) });
    if (!ready) return send(503, { error: "暂未连通 GitHub 记录，请稍后重试。" });
    return send(200, await publishRecord({ id, month, sha: saved?.sha, groups }));
  } catch (error) {
    if (error instanceof RecordStoreError) return send(error.status, { error: error.message });
    return send(502, { error: "录入服务暂未响应，请稍后重试。未确认保存时可重新打开记录查看版本。" });
  }
}
