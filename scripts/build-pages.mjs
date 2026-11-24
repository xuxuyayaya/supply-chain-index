import { mkdir, readFile, writeFile } from "node:fs/promises";
import { scenePages, mainRoutes, supplyRoutes, gapRoutes } from "../frontend/scene-routes.js";

const frontend = new URL("../frontend/", import.meta.url);
const templates = new URL("../templates/scene/", import.meta.url);
const read = name => readFile(new URL(name + ".html", templates), "utf8");
const revision = "20261124-benchmark-workspace";

const [layout, selection, notes, dialogs] = await Promise.all(
  ["layout", "selection", "notes", "dialogs"].map(read),
);
for (const [id, page] of Object.entries(scenePages)) {
  const root = "../".repeat(page.path.split("/").filter(Boolean).length);
  const section = page.section ?? id;
  const links = (routes, type, label) => `<nav class="${type}" aria-label="${label}"${type === "gap-nav" ? ' id="benchmark-navigation"' : ""}>` +
    routes.map(route => {
      const entry = scenePages[route];
      const current = (type === "scene-nav" ? section : id) === route ? ' aria-current="page"' : "";
      const emphasis = route === "trace" ? ' class="supply-trace-entry"' : "";
      const arrow = route === "trace" ? ' <span aria-hidden="true">→</span>' : "";
      const title = type === "scene-nav" ? entry.tab ?? entry.title : entry.subtab;
      const purpose = type === "gap-nav" ? `<small aria-hidden="true">${entry.purpose}</small>` : "";
      return `<a href="${root + entry.path}" data-route="${route}"${current}${emphasis}>${title}${arrow}${purpose}</a>`;
    }).join("\n") + "</nav>";
  const title = id === "intro" ? page.title : page.title + " · 产业链供应分析指数";
  const content = id === "intro" ? await read("intro") : await read(section === "gap" ? "gap" : id);
  const main = id === "intro" ? `${content}<div class="scene-selection">${selection}</div>` :
    `<header class="scene-page-heading">
      <nav class="breadcrumb" aria-label="面包屑">
        <a href="${root}">平台首页</a><span>/</span>
        <a href="${root}chain/" data-route="intro">产业链供应分析指数</a>
      </nav>
      <h1>${page.title}</h1>
      <div class="scene-purpose"><strong>${page.purpose}</strong><p>${page.description}</p></div>
    </header>
    ${selection}
    ${links(mainRoutes, "scene-nav", "产业链分析导航")}
    ${section === "supply" ? links(supplyRoutes, "supply-nav", "供应分析下钻") : ""}
    ${section === "gap" ? links(gapRoutes, "gap-nav", "差距分析导航") : ""}
    <div id="view-loading" class="scene-view-status" role="status" hidden></div>
    <div id="workspace-content" hidden>${content}</div>
    ${notes}`;
  const html = layout.replace("@title@", title).replace("@scene@", id)
    .replace("@main@", main).replace("@dialogs@", id === "intro" ? "" : dialogs)
    .replaceAll("@root@", root).replaceAll("@revision@", revision)
    .replace(/@([a-z-]+)@/g, (match, route) => Object.hasOwn(scenePages, route) ? root + scenePages[route].path : match);
  await mkdir(new URL(page.path, frontend), { recursive: true });
  await writeFile(new URL(page.path + "index.html", frontend), html);
}
console.log("Built " + Object.keys(scenePages).length + " independent analysis pages.");
