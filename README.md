# 产业链供应分析指数

可复用的产业链供应分析场景。默认案例是虚构的海川先进制造产业链。开封汽车是参考示例。

- [产品需求文档](docs/PRD.md)
- [Word 版 PRD](docs/PRD.docx)
- [GitHub Pages](https://xuxuyayaya.github.io/supply-chain-index/)
- [后端健康检查](https://supply-chain-index-xuxuyayaya.onrender.com/api/health)

## 本地使用

需要 Node.js 22 或更新版本，无须安装第三方依赖。

```sh
npm start
npm test
```

打开 http://localhost:3000 查看门户首页，从「方案 · 产品 · 场景」进入指数分析。也可直接访问 http://localhost:3000/supply-index.html。后端负责案例查询、指数计算、贸易汇总和追溯图。案例数据在 `server/catalog.mjs`。

## 部署

`main` 分支包含完整前后端。GitHub Pages 从 `gh-pages` 分支根目录发布。运行 `npm run snapshot` 后，前端目录包含静态演示快照。发布时将 `frontend/` 内容同步到 Pages 分支。

Render 使用 Node.js 运行时，构建命令 `npm test`，启动命令 `npm start`。后端监听 `PORT`。健康端点为 `/api/health`。前端部署域名或 API 域名变化时，同步更新服务端 CORS 以及 `frontend/app.js` 的 API 地址。

所有案例为演示。网页中的企业关系是业务层级示意。
