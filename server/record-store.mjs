import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getCase } from "./catalog.mjs";
import { validateRecordGroup } from "./record-validation.mjs";

export const repository = "xuxuyayaya/supply-chain-index";
export const branch = "data";
const remote = "https://github.com/" + repository + ".git";
const writeRemote = "ssh://git@ssh.github.com:443/" + repository + ".git";
const branchRef = "refs/heads/" + branch;
const githubHost = "[ssh.github.com]:443 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl\n";
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

async function gitIn(target, args, env = {}) {
  return (await execute("git", ["--git-dir", target, ...args], {
    timeout: 12000, maxBuffer: 2 * limit, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...env },
  })).stdout;
}

const git = (...args) => gitIn(directory, args);

async function fetchRecords() {
  if (!directory) {
    const target = await mkdtemp(join(tmpdir(), "supply-records-"));
    await execute("git", ["init", "--bare", "--quiet", target], { timeout: 5000 });
    directory = target;
  }
  const start = generation;
  await git("fetch", "--quiet", "--depth=1", "--no-tags", remote, branchRef);
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

export function recordWritesEnabled() {
  return Boolean(process.env.GITHUB_RECORDS_DEPLOY_KEY?.trim());
}

const quoteForShell = value => "'" + value.replaceAll("'", "'\\''") + "'";
const changedRecord = () => new RecordStoreError(409, "本月记录已更新。请保留已录入的数据，重新打开录入窗口后合并。");

async function writeToDataBranch(path, sha, content, message) {
  const work = await mkdtemp(join(tmpdir(), "supply-record-write-"));
  try {
    const repo = join(work, "repo.git");
    const key = join(work, "deploy-key");
    const hosts = join(work, "known-hosts");
    const file = join(work, "record.json");
    await Promise.all([
      execute("git", ["init", "--bare", "--quiet", repo], { timeout: 5000 }),
      writeFile(key, process.env.GITHUB_RECORDS_DEPLOY_KEY.trim() + "\n", { mode: 0o600 }),
      writeFile(hosts, githubHost),
      writeFile(file, content),
    ]);
    const run = (...args) => gitIn(repo, args);
    await run("fetch", "--quiet", "--depth=1", "--no-tags", remote, branchRef);
    const head = (await run("rev-parse", "FETCH_HEAD")).trim();
    const entry = (await run("ls-tree", head, "--", path)).trim();
    const original = /^100(?:644|755) blob ([a-f0-9]{40})\t/.exec(entry)?.[1];
    if ((entry && !original) || original !== sha) throw changedRecord();

    // Update one indexed file against the fetched head, preserving all other data and modes.
    const blob = (await run("hash-object", "-w", "--", file)).trim();
    await run("read-tree", head);
    await run("update-index", "--add", "--cacheinfo", `100644,${blob},${path}`);
    const tree = (await run("write-tree")).trim();
    const revision = (await run("-c", "user.name=Supply Chain Records", "-c", "user.email=records@supply-chain-index.local",
      "commit-tree", tree, "-p", head, "-m", message)).trim();
    const ssh = "ssh -F /dev/null -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes" +
      " -o GlobalKnownHostsFile=/dev/null -o HostKeyAlgorithms=ssh-ed25519 -o ConnectTimeout=8" +
      " -o " + quoteForShell("UserKnownHostsFile=" + hosts) + " -i " + quoteForShell(key);
    try {
      await gitIn(repo, ["push", "--porcelain", writeRemote, `${revision}:${branchRef}`], { GIT_SSH_COMMAND: ssh });
    } catch (error) {
      if (/\[rejected\] \((?:fetch first|non-fast-forward)\)/.test(error.stdout ?? "")) throw changedRecord();
      throw new RecordStoreError(502, "GitHub 暂未确认保存。可以重新打开录入窗口查看最新版本。");
    }
    return { blob, revision };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export async function publishRecord({ id, month, sha, groups }) {
  const path = pathFor(id, month);
  const updatedAt = new Date().toISOString();
  const body = { schema: 1, caseId: id, period: month, updatedAt, groups };
  const content = Buffer.from(JSON.stringify(body, null, 2) + "\n");
  if (content.length > limit) throw new RecordStoreError(413, "本月记录超过容量限制。");
  const saved = await writeToDataBranch(path, sha, content, "Update monthly industry inputs: " + id + " " + month);
  generation++;
  // Keep this revision visible immediately while also allowing other instances to catch up.
  records = withRecord(id, month, { sha: saved.blob, groups, updatedAt });
  fetchedAt = Date.now();
  return { updatedAt, sha: saved.blob, url: "https://github.com/" + repository + "/commit/" + saved.revision };
}
