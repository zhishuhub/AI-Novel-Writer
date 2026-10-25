# 修改说明

本仓库基于 [EthanYoQ/AI-Novel-Writer](https://github.com/EthanYoQ/AI-Novel-Writer)（书童 Pagekin，GPL-3.0）修改，发布一键接入版桌面应用，产品名与图标沿用原项目。修改后的全部源码同样按 GPL-3.0 公开，著作权声明以原项目为准。

## 2026-10-25 修改内容

- **一键接入**：AI 服务改为用网站发的接入码换取调用地址和密钥（`electron/zhishu/`、`electron/controllers/zhishu-controller.ts`、`src/components/zhishu/`）。没接入时只显示接入页，打开和切回窗口时自动识别剪贴板里的接入码，也可以手动粘贴；在网站停止授权后接入页盖在工作台上面，编辑器不卸载，重新接入后接着写。接入信息存在 userData 目录的 `zhishu-connection.json`。
- **模型**：接入后只有一条模型配置，对话模型写 `chat`，由平台换成当前模型。模型列表、默认模型由接入决定，不读写 `models.json`；保存、删除、设默认、拉取模型列表的接口在接入模式下拒绝修改，连接测试只测接入的那条配置。
- **检索**：没有向量模型，知识库只按字词检索，不再拿对话模型请求 `/embeddings`；设置页不显示「检索模型」，知识库页不再引导去配置。
- **设置页**：「AI 模型」换成「AI 服务」，显示接入账号和「重新接入」。
- **关闭自动更新**：不再检查原项目的 GitHub Release，Windows 安装包不带更新源；「关于与更新」改为查询网站上本应用的最新版本，有新版提示去网站下载。
- **署名**：「关于与更新」注明基于原项目修改，并给出本仓库与原项目的源码地址。
- **打包**：新增 `.github/workflows/zhishu-release.yml`，推 `v{版本}-zs.{序号}` 的 tag 打 Windows 与 macOS 安装包并发布 Release。上游的资格认证、更新产物校验和界面冒烟依赖原项目更新源与未接入的界面，不在这个流程里跑。

所有改动都用 `src/shared/zhishu.ts` 的 `ZHISHU_MANAGED_AI` 开关包着，原项目的模型配置代码没有删除。
