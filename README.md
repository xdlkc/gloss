# Gloss (`眉批`)

English | [简体中文](./README.zh-CN.md)

> Read side by side, annotate as you go.

**Gloss** is a lightweight, local-first Manifest V3 browser extension for web translation and AI-assisted reading (supporting Chrome, Edge, and Firefox). It translates pages into **Simplified Chinese** (`zh-CN`), **Traditional Chinese** (`zh-TW`), or **English** (`en`), paired with an on-demand right-hand AI sidebar for summarizing long articles, analyzing webpage images, multi-turn Q&A, and writing polish.

Named after traditional marginalia and interlinear glosses (*méipī*, `眉批`), Gloss keeps translated reading directly inside the original page layout on the left while letting you question, excerpt, and annotate in the sidebar on the right.

## Installation

1. Clone or download this repository locally:
   ```sh
   git clone https://github.com/xdlkc/gloss.git
   ```
2. Open `chrome://extensions` in Chrome (or `edge://extensions` in Edge) and enable **Developer mode**.
3. Click **Load unpacked** and select the `gloss` directory. No API key is required to start using free full-page and selection translation.

> Note: On Chromium browsers, Gloss also integrates with the native `sidePanel` API (`src/popup/popup.html?mode=sidepanel`) for restricted pages such as `chrome://`. In environments without `chrome.sidePanel` (such as Firefox or non-Chromium MV3 hosts), Gloss falls back to the in-page AI sidebar and popup workspace.

## Shortcuts & Interactions

| Action | Behavior |
| --- | --- |
| `Alt + T` | Toggle full-page translation / restore original text |
| `Alt + S` | Open / close the right-hand AI sidebar (switches to browser native Side Panel on restricted pages) |
| `Alt + Hover` | Translate or restore a single paragraph under the cursor |
| `Select text` | Open the selection translation card (`zh-CN` / `zh-TW` / `en` switch, TTS speak, copy) or trigger AI explain, summarize, polish, or follow-up |
| `Right-click image` | Choose **AI 解读此图片** ("AI Analyze Image") to send charts or screenshots directly to the AI sidebar |
| `Toolbar icon / Floating ball` | Switch between **In-place Replace** and **Bilingual Comparison**, change target language, or switch model backends |

## Core Features

- **Layout-Preserving Page Translation**: Defaults to **In-place Replace** (`replace`), swapping text nodes directly without breaking Flex/Grid multi-column layouts, tables, or timelines. Switch anytime to **Bilingual Comparison** (`bilingual`) to display translations alongside original text while sharing the same translation cache. Automatically skips `<pre>`, `<code>`, math formulas, and `notranslate` elements, prioritizing the viewport and preloading on scroll.
- **Streaming Thinking AI Sidebar**: Automatically attaches current page text and extracted page images; also supports pasting screenshots (`Cmd+V` / `Ctrl+V`), drag-and-drop, or file upload. Streams live reasoning traces (`💭 正在思考...`) for reasoning models, with a toggleable **Deep Thinking** switch for faster direct responses.
- **Cross-Page History Search**: Archives chat sessions automatically by normalized page URL. Open the sidebar history panel to fuzzy-search past conversations by page title, domain, message text, or reasoning content and resume any prior page context.
- **Long-Article Summaries & Writing Fill-back**: Built-in one-click page summary, key takeaways, and generated Q&A. The Writing workspace supports professional polish, shorten, expand, grammar correction, and EN/ZH translation, with one-click copy or fill-back into active editable inputs on the page.

## Translation & Model Backends

Switch backends anytime from the popup model drawer or the extension Options page:

| Backend | Best For | Configuration |
| --- | --- | --- |
| **Google Translate (Free) / MyMemory** | Fast everyday browsing (default) | Zero-config out of the box; automatic fallback on failure |
| **[Loom](https://github.com/xdlkc/loom) Local Gateway** | Routing through locally configured providers (ZenMux, GLM, MiniMax, DeepSeek, Kimi, LongCat) | Connects to `http://127.0.0.1:4319/v1` with local `hub.key` (`~/Library/Application Support/ModelHub/.local/hub.key`) to sync `/v1/models`; uses low reasoning effort for fast full-page translation while keeping full reasoning and vision in sidebar chat |
| **ChatGPT / Codex Subscription** | Reusing ChatGPT Plus / Pro quota for translation and chat | Paste or import local `~/.codex/auth.json` or `~/.pi/agent/auth.json`, or sign in via OAuth Device Code; refreshes expiring tokens automatically |
| **OpenAI-Compatible API** | Any third-party or self-hosted LLM API | Set custom endpoint URL, API key, and model name |

## Directory Layout

```text
gloss/
├── manifest.json                         # Manifest V3 config, permissions, commands & side_panel
├── icons/                                # Extension SVG & PNG icons (16/32/48/128)
├── src/
│   ├── shared/config.js                  # Shared settings, preset providers/models & chat session store
│   ├── background/
│   │   ├── service-worker.js             # MV3 service worker, context menus, commands & Side Panel
│   │   └── translator-engine.js          # Google/MyMemory/Loom/Codex/OpenAI translation & AI streaming
│   ├── content/
│   │   ├── index.js                      # Content script lifecycle, shortcuts & message routing
│   │   ├── dom-translator.js             # Layout-preserving DOM walker, cache & bilingual mode
│   │   ├── selection-ui.js               # Floating ball, selection card, in-page AI sidebar & fill-back
│   │   └── content.css                   # Injected content & sidebar styles
│   ├── popup/                            # Extension popup & Side Panel 4-tab UI (Translate/Chat/Summary/Write)
│   └── options/                          # Options dashboard (languages, display modes, backends, exclusions)
├── demo/index.html                       # Local multilingual & sidebar test sandbox
└── tests/verify-extension.mjs            # Zero-dependency automated verification suite
```

## Development & Verification

Preview the local multilingual and sidebar interaction sandbox:

```sh
python3 -m http.server 8080
# Open http://localhost:8080/demo/index.html
```

Run the zero-dependency automated verification suite (Node.js 18+):

```sh
node tests/verify-extension.mjs
```
