import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getCase } from "./catalog.mjs";
import { validateRecordGroup } from "./record-validation.mjs";

export const repository = "xuxuyayaya/supply-chain-index";
export const branch = "data";
const remote = "https://github.com/" + repository + ".git";
const execute = promisify(execFile);
const pathFor = (id, month) => "records/" + id + "/" + month + ".json";
const limit = 512 * 1024;
let directory, commit, pending, fetchedAt = 0, generation = 0;
let records = {};

export function currentRecords() {
  return records;
}

export function withRecord(id, month, entry) {
  return { ...records, [id]: { ...records[id], [month]: entry } };
}

function parseRecord(id, month, sha, source) {
  const value = JSON.parse(source);
  const base = getCase(id, month);
  if (!base || value.caseId !== id || value.period !== month || value.schema !== 1) throw new Error("Invalid record");
  const parts = base.traceParts.map(row => row.id);
  const groups = Object.fromEntries(Object.entries(value.groups).map(([key, data]) => {
    const part = key.startsWith("trace-") ? key.slice(6) : null;
    if (part && !parts.includes(part)) throw new Error("Invalid trace part");
    return [key, validateRecordGroup(part ? "trace" : key, data, parts)];
  }));
  return { sha, groups, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null };
}

async function git(...args) {
  return (await execute("git", ["--git-dir", directory, ...args], {
    timeout: 12000, maxBuffer: 2 * limit, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  })).stdout;
}

async function fetchRecords() {
  if (!directory) {
    const target = await mkdtemp(join(tmpdir(), "supply-records-"));
    await execute("git", ["init", "--bare", "--quiet", target], { timeout: 5000 });
    directory = target;
  }
  const start = generation;
  await git("fetch", "--quiet", "--depth=1", "--no-tags", remote, "refs/heads/" + branch);
  const head = (await git("rev-parse", "FETCH_HEAD")).trim();
  if (head === commit) return;
  const next = {};
  const tree = await git("ls-tree", "-r", head, "--", "records/");
  for (const line of tree.split("\n")) {
    const match = /^100(?:644|755) blob ([a-f0-9]{40})\trecords\/([a-z0-9-]+)\/(\d{4}-\d{2})\.json$/.exec(line);
    if (!match) continue;
    const [, sha, id, month] = match;
    try {
      next[id] ??= {};
      next[id][month] = records[id]?.[month]?.sha === sha ? records[id][month]
        : parseRecord(id, month, sha, await git("cat-file", "blob", sha));
    } catch {
      console.warn("Invalid published input record:", id, month);
    }
  }
  if (start === generation) {
    records = next;
    commit = head;
  }
}

export function syncRecords({ fresh = false } = {}) {
  if (pending) return pending;
  if (!fresh && Date.now() - fetchedAt < 60_000) return Promise.resolve(Boolean(commit));
  pending = fetchRecords().then(() => true, () => false).finally(() => {
    fetchedAt = Date.now();
    pending = undefined;
  });
  return pending;
}

export class RecordStoreError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function publishRecord({ id, month, sha, groups, token }) {
  const path = pathFor(id, month);
  const updatedAt = new Date().toISOString();
  const body = { schema: 1, caseId: id, period: month, updatedAt, groups };
  const content = Buffer.from(JSON.stringify(body, null, 2) + "\n");
  if (content.length > limit) throw new RecordStoreError(413, "本月记录超过容量限制。");
  const result = await fetch("https://api.github.com/repos/" + repository + "/contents/" + path, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + token, Accept: "application/vnd.github+json",
      "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ branch, ...(sha ? { sha } : {}), content: content.toString("base64"),
      message: "Update monthly industry inputs: " + id + " " + month }),
    signal: AbortSignal.timeout(15000), redirect: "error",
  });
  if (result.status === 409 || result.status === 422) {
    // GitHub returns 422 as well when a new-file request races with a different editor.
    throw new RecordStoreError(409, "本月记录已更新。请复制暂未保存的数据，重新打开录入窗口后再合并。");
  }
  if ([401, 403, 404].includes(result.status)) {
    throw new RecordStoreError(403, "GitHub 拒绝写入。请检查令牌是否有效，以及该仓库的 Contents 读写权限。");
  }
  if (!result.ok) throw new RecordStoreError(502, "GitHub 暂未确认保存，请重新打开录入窗口查看版本。");
  const saved = await result.json();
  generation++;
  // Keep this revision visible immediately while also allowing other instances to catch up.
  records = withRecord(id, month, { sha: saved.content.sha, groups, updatedAt });
  fetchedAt = Date.now();
  return { updatedAt, sha: saved.content.sha, url: saved.commit.html_url };
}
