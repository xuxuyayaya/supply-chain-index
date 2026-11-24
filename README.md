# 产业链供应分析指数

全国物流网门户与城市产业链供应评价。先选择城市，再从本市目录选择产业链。覆盖九座城市、24 条城市产业链，按月查看得分、同业差距和部件供货路径。

- [产品需求文档](docs/PRD.md)
- [Word 版 PRD](docs/PRD.docx)
- [GitHub Pages](https://xuxuyayaya.github.io/supply-chain-index/)
- [后端健康检查](https://supply-chain-index-xuxuyayaya.onrender.com/api/health)

## 本地使用

需要 Node.js 22 或更新版本以及 Git 命令行，无须安装第三方依赖。

```sh
npm start
npm test
```

打开 http://localhost:3000 查看门户首页，从「方案 · 产品 · 场景」进入指数分析。也可直接访问 http://localhost:3000/chain/。后端负责案例查询、指数计算、贸易汇总和追溯图。案例数据在 `server/catalog.mjs`。

## 部署

`main` 分支包含完整前后端。GitHub Pages 从 `gh-pages` 分支根目录发布。运行 `npm run build:pages` 生成 `frontend/chain/` 下的独立页面，运行 `npm run snapshot` 生成月度快照。发布时将 `frontend/` 内容与 docs/PRD.docx 同步到 Pages 分支根目录。

Render 使用 Node.js 运行时，构建命令 `npm test`，启动命令 `npm start`。后端监听 `PORT`。健康端点为 `/api/health`。前端部署域名或 API 域名变化时，同步更新服务端 CORS 以及 `frontend/scene-app.js` 的 API 地址。

月度评分和经营数据采用情景测算。开封 13 类部件的节点、供货范围与公开资料见 server/kaifeng-trace.json。

## 场景页面

导航使用独立地址，链接携带城市、产业链、统计月等选择。总览综合研判可用 `overview/#system` 直达。历史 `supply-index.html` 带锚点的地址会跳到对应新页面。

| 页面 | 相对地址 |
| --- | --- |
| 场景介绍 | `chain/` |
| 发展总览 | `chain/overview/` |
| 物流、供应、韧性 | `chain/logistics/`、`chain/supply/`、`chain/resilience/` |
| 供应链追溯 | `chain/trace/` |
| 城市对标与复算 | `chain/benchmark/`、`chain/benchmark/actions/`、`chain/benchmark/review/` |

各页面共享 `templates/scene/` 中的页框、导航和录入口径，按当前地址生成对应内容。

## 指数接口与高德地图

- `GET /api/index?case=kaifeng-auto&period=2026-10` 返回总分、四项指标、贸易结构与默认部件的追溯数据。可带 `part` 查询指定部件。
- 点击「环节覆盖」展开供应追溯。地图支持拖动、滚轮、双指及按钮缩放。城市点位与供货路径可联动企业披露资料。
- 在 Render 服务环境中设置 `AMAP_WEB_KEY`、`AMAP_SECURITY_CODE`，并在高德控制台允许 `xuxuyayaya.github.io` 和该服务的 Render 域名。安全密钥仅由服务端地图代理使用。配置前，页面提供城市分布示意和高德城市跳转。


## 月度数据维护

在物流、供应、追溯、韧性或差距页打开录入窗口，修改所选城市产业链的当月数据。试算后可用 GitHub 细粒度个人访问令牌保存。令牌应仅授权该仓库的 Contents 读写权限，只用于当次提交。保存文件位于 [data 分支](https://github.com/xuxuyayaya/supply-chain-index/tree/data) 的 `records/<case>/<YYYY-MM>.json`。提交记录可追溯，保存后在线指数及相关月份走势重新计算。仓库公开，录入内容须可公开。

省内同产业对标按 2025 年城市 GDP 差额排序，数据与来源见 `server/benchmark-cities.mjs`。产业差距以同月产业增加值和评分计算。
