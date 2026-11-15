# Gloss（眉批）

> 展卷对读，随文批注：网页原地双语对照翻译与侧边栏 AI 阅读、总结、润色浏览器扩展。

**Gloss（眉批）** 是一款基于 **Manifest V3**（兼容 Chrome / Edge / Firefox）的网页翻译与 **Sider 风格 AI 阅读写作助手** 浏览器扩展。支持将**任意语言**网页整页翻译或划词翻译为 **简体中文 (`zh-CN`)**、**繁體中文 (`zh-TW`)** 与 **English (`en`)**，并提供侧边栏上下文对话、一键网页总结、划词 AI 解释/润色与写作回填能力。

---

## 核心特性 / Features

- **多语言自动识别 → 三大目标语言**
  - 来源语言支持 `auto`（自动检测任意语言），以及英语、简体中文、繁體中文、日本語、한국어、Français、Deutsch、Español、Русский、Português、العربية 等。
  - 目标语言专注优化三大高频输出：**简体中文 (`zh-CN`)**、**繁體中文 (`zh-TW`)**、**English (`en`)**。
- **整页翻译：Chrome 式原地替换（默认）、双语对照与高速动态预译**
  - **原地替换 (`replace`，默认)**：直接在原 DOM `Text` 节点（`nodeValue`）上原地替换为译文，**不注入多余包装元素**，加载过程中不改变排版结构，完整保留 Flex/Grid 多列对齐、时间线、状态徽章（如 `[ SHIPPED ]`）与行内样式，支持一键 100% **恢复原文**。
  - **双语对照 (`bilingual`)**：保留原文段落并优雅插入译文（支持默认、下划线、卡片 3 种视觉样式），且与原地替换模式共享文本级缓存，随时无缝切换不重复请求。
  - **首屏优先 + 后台全页预译 + 动态 DOM 增量监听**：采用双优先级队列（视口优先、滚动实时插队、`MutationObserver` 自动捕获异步挂载与折叠展开内容）、同批去重与顶部进度条，滚动与懒加载区块无需二次点击即可译出。
  - **智能保护机制**：自动跳过 `<pre>`、`<code>`、`<kbd>`、`<samp>`、`<var>`、`<svg>`、表单控件、`.notranslate`、`translate="no"`、CSS/路径/`@handle`/单位技术 token 以及原始 JSX/HTML 代码片段（如 `<GraphTimeline title="SHIPPED">`）。
- **Sider 风格 AI 侧边栏助手 (`Alt+S`)**
  - **右侧滑出抽屉 (`.wt-sidebar`)**：固定右侧 `380px` 面板，顶栏内置 **多模型快速切换下拉框**（含 **OpenAI Codex 订阅** `codex:gpt-5.6-luna` 等 11 款 Codex/GPT 模型分组，以及按 `WT_CONFIG.LOOM_PRESET_PROVIDERS` 分组的 Loom 模型），切换后实时同步 `SAVE_SETTINGS`。
  - **💬 AI 对话 (`chat`)**：默认勾选「📄 关联当前网页」与「🧠 深度思考」，在关联当前网页时同步识别并提取正文中的**页面配图**（最多 4 张）；支持在侧边栏与 Popup/SidePanel 中展开折叠式 **`💭 思考过程`**（兼容 Kimi / GLM / DeepSeek `reasoning_content`、Codex SSE `response.reasoning_summary_text` 与 `<think>` 标签，取消勾选「深度思考」可一键切换极速无思考模式），并支持 **点击 `🖼️ 传图`、剪贴板 `Ctrl/Cmd+V` 粘贴截图、拖拽图片**、引用划词片段、快捷提示词与多轮看图追问；当所选模型仅支持纯文本时会自动降级重试并给出切换视觉模型提示。
  - **📄 网页总结 (`summary`)**：通过 `extractPageContext()` 智能抽取标题、大纲与主体正文（跳过扩展自身 UI 与导航/脚本/代码块），提供 **`⚡ 一键生成网页摘要`** (`summarize_page`)、**`📌 提炼核心要点`** (`key_takeaways`)、**`❓ 生成关键问答`** (`page_qa`) 与 **`💬 基于摘要继续追问`**。
  - **✍️ 写作润色 (`write`)**：支持「填入当前选中文本」、6 大加工模式（`✨ 专业润色` `polish`、`📏 精简缩写` `shorten`、`🚀 扩写丰富` `expand`、`🔧 语法纠错` `grammar`、`🇺🇸 译为英文` `translate_en`、`🇨🇳 译为中文` `translate_zh`），以及 **`📥 填入页面输入框`**（自动回填最近聚焦的 `<input>` / `<textarea>` / `[contenteditable]`）。
- **多种快捷入口与交互方式**
  - **划词翻译弹窗 & AI 工具条**：划词卡片内置 **简 / 繁 / 英** 一键切换、复制、TTS 朗读，以及 Sider AI 工具条（**`✨ 解释`** / **`📝 总结`** / **`✒️ 润色`** / **`💬 追问`**），点击即唤起侧边栏并执行对应任务。
  - **悬浮球、Popup 与全局快捷键**：页面右下角折叠悬浮球与 Popup 弹窗均提供 **`💬 AI 侧边栏 (Alt+S)`** 与 **`📄 AI 总结本页`** 入口；全局快捷键支持 `Alt+T`（整页翻译开关）与 `Alt+S`（打开/关闭 AI 侧边栏）；右键菜单新增 5 项（打开 AI 侧边栏、AI 总结当前网页、AI 解释选中文本、AI 润色选中文本、**图片右键「AI 解读此图片」**）。
  - **Alt + Hover 单段翻译**：按住 `Alt` 键悬停任意段落即可单段即时翻译或还原。
- **多翻译引擎、OpenAI Codex 订阅、Loom 本地网关与智能降级策略**
  - **OpenAI Codex 订阅 (`codex`，ChatGPT Plus/Pro · 兼容 `pi` / `opencode2` 协议)**：
    - 复用 ChatGPT Plus/Pro 订阅额度接入 `https://chatgpt.com/backend-api/codex/responses` SSE 流式接口（支持 **11 款预设模型**：`gpt-5.6-luna`（默认/推荐）、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-6-luna`、`gpt-6-sol`、`gpt-6-astra`、`gpt-6.1-sol`、`gpt-6.1-terra`、`gpt-5.3-codex`、`gpt-5.4`、`gpt-5.4-mini` 及 `low`/`medium`/`high` 思考强度），同时驱动整页翻译与 `AI_CHAT` 侧边栏对话。
    - 支持两种授权接入：1）本地纯 JS 解析导入 `~/.codex/auth.json`、`~/.pi/agent/auth.json`、OAuth 响应或 JWT（含快捷命令 `pbcopy < ~/.codex/auth.json`，导入后清空输入框且绝不回显 Token 原文）；2）扩展设置页内置 **OAuth 设备码登录 (`Device Code`)** 跳转 `https://auth.openai.com/codex/device` 授权并自动轮询绑定。临近过期（`< 3 分钟`）或 `401` 时自动通过 `refresh_token` 静默续期并持久化最新凭证。
  - **Google Translate Free (`google-free`) & MyMemory (`mymemory`)**：默认免费高速翻译与主接口异常自动降级；无付费 Key 场景下 `AI_CHAT` 亦可自动走本地翻译与结构化要点降级方案，确保完整功能开箱可用。
  - **Loom 本地网关 (`loom`)**：原生支持本机 Loom / ModelHub 网关（默认 `http://127.0.0.1:4319/v1`）；整页翻译自动为 `kimi` / `deepseek` / `glm` / `longcat` 等推理模型开启低思考加速参数，AI 对话/总结/写作默认开启完整思考链并返回 `reasoning_content`（勾选关闭「🧠 深度思考」可切回极速参数，HTTP 400 不兼容时自动重试回退）；支持 6 大预设供应商、`/v1/models` 实时拉取与 Kimi 多模态识图。
    > **关于 `403 LOCAL_CLIENTS_ONLY` 说明**：扩展遵守浏览器安全规范，绝不伪造 `Origin` / `Sec-Fetch-Site` 请求头；当触发本机拦截或网关未启动时，会自动提示诊断信息并回退内置预设模型列表。
  - **OpenAI 兼容接口 (`openai`)**：支持配置自定义 `apiUrl`、`apiKey` 与 `model`（默认 `gpt-4o-mini`），同时服务整页翻译与 `AI_CHAT` 侧边栏对话。
- **弹出工作区 (`Popup 400px`)、Chrome 原生 `sidePanel` & 设置中心**
  - **Sider 4-Tab 弹窗 & 原生 Side Panel (`src/popup/popup.html?mode=sidepanel`)**：紧凑零截断头部 **`Gloss`**（`翻译 · 对话 · 总结 · 写作`）、可折叠共享引擎抽屉（支持切换 **Codex 订阅 11 款模型**与本地凭证状态展示、Loom 全宽供应商/模型选择），以及顶层 4-Tab 工作区（`🌐 翻译` / `💬 AI 对话` / `📄 总结` / `✍️ 写作`）。Popup 模式默认激活 `🌐 翻译`，原生 Side Panel 模式自适应 `100% × 100vh` 全高布局并默认进入 `💬 AI 对话`（通过 `PAGE_GET_STATUS` `{ includeContext: true }` 实时拉取当前页正文）。
  - **受限页面（`chrome://` / 应用商店 / `about:`）无阻塞体验**：整页控制卡片自动折叠为单行提示条并将「即时文本翻译」顶至首屏主位；`🧩 侧边栏` 与 `📄 总结本页` 按钮**永久可用**——在受限页点击 `🧩 侧边栏`、触发 `Alt+S` 或右键菜单时，扩展同步保留用户手势直调 Chrome 原生 `chrome.sidePanel.open`（无 `chrome.sidePanel` API 环境如 Firefox 则自动切换至内置 AI 对话 Tab），`💬 AI 对话`、`📄 总结`（含自定义粘贴正文）与 `✍️ 写作` 在任何受限页均可直接使用。
  - **Options**：语言偏好、整页模式与样式、划词模式、**OpenAI Codex 订阅授权**（本地 `auth.json` 导入 / OAuth 设备码登录 / 凭证清除）、Loom 网关配置（`hub.key` 提示路径 `~/Library/Application Support/ModelHub/.local/hub.key`）、OpenAI 兼容接口、连接测试与域名排除名单（`excludedDomains`）。

---

## 目录结构 / Project Structure

```text
gloss/
├── manifest.json                   # Manifest V3 扩展清单 (含 sidePanel 权限/面板、Alt+T 与 Alt+S 命令)
├── icons/                          # 扩展图标 (SVG + 16/32/48/128 PNG)
├── src/
│   ├── shared/
│   │   └── config.js               # 共享语言列表、CODEX_PRESET_MODELS、parseCodexAuthInput、Loom 预设、17 消息常量
│   ├── background/
│   │   ├── translator-engine.js    # 多引擎翻译与 chatWithAI 核心 (Google / MyMemory / Loom / Codex OAuth+SSE / OpenAI)
│   │   └── service-worker.js       # MV3 后台分发、AI_CHAT、Codex 设备码/自动续期持久化、右键菜单与 sidePanel 唤起
│   ├── content/
│   │   ├── content.css             # 页内译文、顶部进度条、划词弹窗 AI 工具条与右侧 Sider AI 侧边栏样式
│   │   ├── dom-translator.js       # 原地 TextNode 替换 + 双语对照、双队列预译与 MutationObserver
│   │   ├── selection-ui.js         # 划词 AI 弹窗、悬浮球、Sider AI 侧边栏 (含 Codex/Loom 模型切换) 与 Alt+S 监听
│   │   └── index.js                # Content Script 入口、PAGE_GET_STATUS 上下文拉取与 codexConfig 同步
│   ├── popup/
│   │   ├── popup.html              # Sider 4-Tab 弹窗 & 原生 Side Panel (?mode=sidepanel) 界面
│   │   ├── popup.css               # 弹窗与全高 Side Panel 响应式样式 (含受限页折叠与深色模式)
│   │   └── popup.js                # 4-Tab AI 对话/总结/写作、整页控制、Codex/Loom 抽屉与原生 sidePanel 联动逻辑
│   └── options/
│       ├── options.html            # 设置中心页面 (含 OpenAI Codex 订阅导入/设备码授权卡片)
│       ├── options.css             # 设置页样式
│       └── options.js              # 配置读写、Codex auth.json/Device Code 授权、Loom 联动、引擎测试与域名管理
├── demo/
│   └── index.html                  # 8 语种 + 时间线对比 + Sider 长文总结/写作回填示例 + 独立 Polyfill 桥接
├── tests/
│   └── verify-extension.mjs        # 零依赖 Node.js ESM 自动化验证套件
└── README.md
```

---

## 安装与使用 / Chrome & Edge Unpacked Installation

1. 打开 Chrome 或 Microsoft Edge，在地址栏输入：
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. 打开右上角的 **开发者模式 (Developer mode)** 开关。
3. 点击 **加载已解压的扩展程序 (Load unpacked)**。
4. 选择本项目根目录 `/Users/lkc/Code/gloss`。
5. 固定扩展图标到工具栏后，即可在任意网页使用整页翻译（默认 `原地替换`、`Alt+T`）、按 `Alt+S` 打开 **Sider AI 侧边栏**、划词翻译/AI 解释润色，或使用 `Alt + Hover` 单段翻译。

---

## 运行交互式多语言 Demo / Running the Demo Page

`demo/index.html` 内含：
- **8 种语言测试文章**：**English、日本語、한국어、Français、Deutsch、Español、简体中文、繁體中文**。
- **结构化排版 / 时间线对比演示 (`Structured Layout / Timeline Demo`)**：展示 `<pre><code>` 内的 `<GraphTimeline title="SHIPPED">...</GraphTimeline>` 原码与右侧 `[ SHIPPED ]` 多列时间线的对比效果。
- **Sider AI 长文阅读与写作回填沙盒 (`#sider-ai-showcase` / `#writing-sandbox`)**：内置长篇英文技术文章用于直接测试 **`📄 AI 总结本页`** / **`💬 AI 侧边栏 (Alt+S)`** 与上下文问答，并提供 `<textarea id="demo-write-target">` 供「✍️ 写作润色」Tab 实测一键回填页面输入框。
- **受保护元素示例**：`<pre><code>`、`.notranslate`、`translate="no"`。

由于 `demo/index.html` 在未安装扩展时会自动通过 `<script type="module">` 桥接 `src/background/translator-engine.js` 并提供 `chrome.storage` / `chrome.runtime` Polyfill（支持整页翻译、`FETCH_LOOM_MODELS` 与 `AI_CHAT` 对话/总结/润色），请通过本地 HTTP 服务打开：

```bash
cd /Users/lkc/Code/gloss

# 方式 A：使用 Python 内置 HTTP 服务器
python3 -m http.server 8080

# 方式 B：或使用 npx serve
npx serve . -l 8080
```

然后在浏览器访问：<http://localhost:8080/demo/index.html>

- 页面顶部交互栏默认选中 **`原地替换`**，可直接测试整页翻译、切换 **`简体中文 / 繁體中文 / English`**、切换 **`原地替换 / 双语对照`**、**恢复原文**、**测试划词弹窗**，以及新增的 **`💬 AI 侧边栏 (Alt+S)`** 与 **`📄 AI 总结本页`**。
- 如果同时在浏览器中加载了真实扩展，Demo 页会自动识别扩展注入状态并让真实扩展接管页面翻译与侧边栏交互。

---

## 运行自动化测试 / Running Verification Tests

项目内置零外部依赖的 Node.js ESM 验证脚本（需 Node.js 18+）：

```bash
cd /Users/lkc/Code/gloss
node tests/verify-extension.mjs
```

验证内容涵盖 7 大项：
1. 必需文件完整性与 PNG 图标文件头（Magic Bytes + 尺寸）校验
2. `manifest.json` MV3 规范（含 `sidePanel` 权限、`side_panel.default_path`、`toggle-ai-sidebar` `Alt+S` 命令）、`popup.html` <-> `popup.js` 与 `options.html` <-> `options.js` 全部 DOM ID 100% 对齐及引用路径存在性校验
3. 全项目 `.js` 文件 `node --check` 语法校验、Classic Script 兼容性校验、`content.css` / `popup.css` / `options.css` 花括号与关键选择器校验及 `demo/index.html` 模块语法校验
4. `src/shared/config.js` 在 VM 沙箱中的配置校验（`displayMode: 'replace'`、`loomConfig`、`codexConfig`、11 款 `CODEX_PRESET_MODELS`、6 大 `LOOM_PRESET_PROVIDERS`、17 个 `MESSAGE_TYPES`、12 个 `AI_TASK_TYPES` 与 `parseCodexAuthInput` 四格式解析）
5. `translator-engine.js` 与 `service-worker.js` 单元测试（Mock `fetch` 验证 Google Translate、批处理去重、MyMemory 降级、Loom 模型与翻译含 `reasoning_effort: 'none'` / 400 回退 / `403 LOCAL_CLIENTS_ONLY`、Codex 订阅 `startCodexDeviceAuth`/`pollCodexDeviceAuthOnce`/SSE 解析/`< 3min` 与 `401` 刷新持久化、`chatWithAI` 多引擎路由与离线降级、`AI_CHAT`、`TEST_ENGINE` 设备码动作、`isInjectableTabUrl` 及受限页同步 `chrome.sidePanel.open`）
6. 17 个跨模块通信消息契约（Background + Content + Popup + Options）一致性校验
7. Node VM DOM 端到端测试：涵盖 `原地替换 (replace)`（Flex 时间线行、视口外预译、滚动插队、`MutationObserver` 增量翻译、全批失败重置、`restorePage()`）、页内 Sider AI 侧边栏（`SIDEBAR_TOGGLE`/`SIDEBAR_ACTION`/`PAGE_GET_STATUS { includeContext: true }`、Codex/Loom 模型切换、`extractPageContext()` `<= 6000` 过滤、划词/悬浮球 AI、写作回填、`Alt+S`、`destroy()`）以及 **Sider 4-Tab Popup / 原生 Side Panel (`?mode=sidepanel`) / Options Codex 凭证导入**（受限页折叠、无回显脱敏状态及同步持久化）
