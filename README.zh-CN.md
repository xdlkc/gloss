# Gloss（眉批）

[English](./README.md) | 简体中文

> 展卷对读，随文批注。

**Gloss（眉批）** 是一款轻量、本地优先的浏览器网页翻译与 AI 阅读助手扩展（Manifest V3，支持 Chrome / Edge / Firefox）。它把外文网页实时译为 **简体中文**（`zh-CN`）、**繁體中文**（`zh-TW`）或 **English**（`en`），并在右侧提供随叫随到的 AI 侧边栏，用于总结长文、解读网页配图、多轮问答与写作润色。

「Gloss」源自古籍与手稿中的行间注疏与页边眉批：左边在原网页排版上直接对读译文，右边展开侧边栏随时提问、摘录与批注。

## 安装

1. 克隆或下载本仓库到本地：
   ```sh
   git clone https://github.com/xdlkc/gloss.git
   ```
2. 在 Chrome 地址栏打开 `chrome://extensions`（Edge 打开 `edge://extensions`），开启右上角 **开发者模式**。
3. 点击 **加载已解压的扩展程序**，选择 `gloss` 目录即可。无需配置任何 API Key 即可直接使用免费整页与划词翻译。

> 说明：在 Chromium 内核浏览器中，Gloss 会配合原生 `sidePanel`（`src/popup/popup.html?mode=sidepanel`）在 `chrome://` 等受限页面提供侧边栏；在不支持 `chrome.sidePanel` 的环境（如 Firefox 或部分 MV3 宿主）中，会自动回退到页内 AI 侧边栏与弹窗工作区。

## 怎么用

| 操作 | 作用 |
| --- | --- |
| `Alt + T` | 开启整页翻译 / 一键恢复原文 |
| `Alt + S` | 打开 / 收起右侧 AI 侧边栏（在 `chrome://` 等受限页自动切换为浏览器原生侧边栏） |
| `Alt + 鼠标悬停` | 指哪译哪，单段即时翻译或还原 |
| `鼠标划选文字` | 弹出翻译卡片（简 / 繁 / 英切换、朗读、复制），或一键唤起 AI 解释、总结、润色与追问 |
| `右键网页图片` | 选择「AI 解读此图片」，直接把图表或截图送入侧边栏识图分析 |
| `点击工具栏图标 / 右下角悬浮球` | 随时切换「原地替换 / 双语对照」、目标语言或翻译与模型引擎 |

## 核心功能

- **不破排版的整页翻译**：默认采用「原地替换」（`replace`）模式，直接替换文本节点而不破坏 Flex/Grid 多列布局、表格与时间线；也可随时一键切换为「双语对照」（`bilingual`）保留原文并排阅读，且共享翻译缓存不重复请求。自动跳过 `<pre>`、`<code>`、数学公式与 `notranslate` 区域，首屏优先翻译并在滚动时自动预加载。
- **实时流式思考的 AI 侧边栏**：默认关联当前网页正文并自动提取文中配图，也支持直接 `⌘V` / `Ctrl+V` 粘贴截图、拖拽或上传图片。针对推理模型实时流式展开 `💭 正在思考...` 过程，不想等待时可取消勾选「🧠 深度思考」切回快速回答。
- **跨网页历史会话检索**：自动按规范化后的网页 URL 归档对话记录，点击侧边栏顶部「🕒 历史」即可按网页标题、域名、对话内容或推理过程模糊搜索并恢复过往任意页面的问答上下文。
- **长文总结与写作回填**：内置一键生成网页摘要、提炼核心要点、生成关键问答；「写作润色」支持专业润色、精简缩写、扩写丰富、语法纠错与中英互译，改完可一键复制或直接回填到当前页面的可编辑输入框中。

## 翻译引擎与模型接入

在扩展设置页或弹窗顶部模型抽屉中可随时切换后端：

| 引擎 | 适用场景 | 配置方式 |
| --- | --- | --- |
| **Google 免费翻译 / MyMemory** | 日常快速网页翻译（默认） | 零配置开箱即用，主接口异常时自动降级 |
| **[Loom](https://github.com/xdlkc/loom) 本机网关** | 统一调用本机已配好的 ZenMux、GLM、MiniMax、DeepSeek、Kimi、LongCat 等模型 | 默认连接 `http://127.0.0.1:4319/v1`，填入本机 `hub.key`（`~/Library/Application Support/ModelHub/.local/hub.key`）即可实时同步 `/v1/models` 目录；整页翻译自动使用低思考参数提速，侧边栏对话保留完整推理链与多模态识图 |
| **ChatGPT / Codex 订阅** | 直接复用 ChatGPT Plus / Pro 订阅额度进行翻译与对话 | 支持粘贴或导入本地 `~/.codex/auth.json`、`~/.pi/agent/auth.json`，或在设置页通过 OAuth 设备码登录；Token 临近过期自动静默续期 |
| **OpenAI 兼容接口** | 接入任意第三方或自建大模型 API | 填入自定义 Endpoint URL、API Key 与模型名称即可 |

## 目录结构

```text
gloss/
├── manifest.json                         # Manifest V3 配置、权限、快捷键与 side_panel 定义
├── icons/                                # 扩展 SVG 与 PNG 图标（16/32/48/128）
├── src/
│   ├── shared/config.js                  # 共享配置、预设供应商/模型列表与网页会话历史存储
│   ├── background/
│   │   ├── service-worker.js             # MV3 后台服务、右键菜单、快捷键与 Side Panel 调度
│   │   └── translator-engine.js          # Google/MyMemory/Loom/Codex/OpenAI 翻译与流式对话引擎
│   ├── content/
│   │   ├── index.js                      # 内容脚本初始化、快捷键监听与消息路由
│   │   ├── dom-translator.js             # 保排版 DOM 遍历翻译、缓存与双语对照模式
│   │   ├── selection-ui.js               # 悬浮球、划词卡片、页内 AI 侧边栏与表单回填
│   │   └── content.css                   # 注入页面与侧边栏样式
│   ├── popup/                            # 弹窗与 Side Panel 四标签工作区（翻译/AI 对话/总结/写作）
│   └── options/                          # 设置中心（语言偏好、排版样式、引擎鉴权、排除域名）
├── demo/index.html                       # 本地多语言与侧边栏交互测试沙盒
└── tests/verify-extension.mjs            # 零依赖自动化测试套件
```

## 开发与验证

本地预览多语言与侧边栏交互沙盒：

```sh
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080/demo/index.html
```

运行零依赖自动化测试套件（Node.js 18+）：

```sh
node tests/verify-extension.mjs
```
