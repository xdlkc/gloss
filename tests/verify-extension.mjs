#!/usr/bin/env node
/**
 * Gloss Extension Automated Verification Suite (Zero External Dependencies)
 * Usage: node tests/verify-extension.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const results = [];

async function runCheck(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, passed: true, detail: detail || 'OK' });
    console.log(`[PASS] ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    const message = err && err.stack ? err.message : String(err);
    results.push({ name, passed: false, detail: message });
    console.error(`[FAIL] ${name} — ${message}`);
  }
}

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

function makeSyntheticCodexJwt({
  accountId = 'acct_synth_test_001',
  planType = 'pro',
  email = 'codex-测试@example.test',
  expSeconds = Math.floor(Date.now() / 1000) + 3600
} = {}) {
  const encodeB64Url = (obj) =>
    Buffer.from(JSON.stringify(obj), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  const header = encodeB64Url({ alg: 'RS256', typ: 'JWT' });
  const payload = encodeB64Url({
    exp: expSeconds,
    'https://api.openai.com/auth': {
      chatgpt_account_id: accountId,
      chatgpt_plan_type: planType
    },
    'https://api.openai.com/profile': {
      email
    }
  });
  return `${header}.${payload}.synthsig`;
}

function collectJsFiles(dirPath, out = []) {
  if (!fs.existsSync(dirPath)) return out;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(full, out);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      out.push(full);
    }
  }
  return out;
}

// ============================================================================
// 1. Required Files & PNG Icon Validation
// ============================================================================
await runCheck('1. Required Files & PNG Magic Signature Check', () => {
  const requiredFiles = [
    'manifest.json',
    'icons/icon.svg',
    'icons/icon16.png',
    'icons/icon32.png',
    'icons/icon48.png',
    'icons/icon128.png',
    'src/shared/config.js',
    'src/background/translator-engine.js',
    'src/background/service-worker.js',
    'src/content/content.css',
    'src/content/dom-translator.js',
    'src/content/selection-ui.js',
    'src/content/index.js',
    'src/popup/popup.html',
    'src/popup/popup.css',
    'src/popup/popup.js',
    'src/options/options.html',
    'src/options/options.css',
    'src/options/options.js',
    'demo/index.html',
    'README.md'
  ];

  const missing = [];
  const empty = [];

  for (const rel of requiredFiles) {
    const abs = path.join(ROOT_DIR, rel);
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size === 0) {
      empty.push(rel);
    }
  }

  assert.equal(missing.length, 0, `Missing files: ${missing.join(', ')}`);
  assert.equal(empty.length, 0, `Empty files: ${empty.join(', ')}`);

  const expectedPngSizes = [
    ['icons/icon16.png', 16],
    ['icons/icon32.png', 32],
    ['icons/icon48.png', 48],
    ['icons/icon128.png', 128]
  ];
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  for (const [rel, expectedDim] of expectedPngSizes) {
    const buf = fs.readFileSync(path.join(ROOT_DIR, rel));
    assert.ok(buf.length >= 24, `${rel} is too small to be a valid PNG`);
    assert.ok(buf.subarray(0, 8).equals(pngMagic), `${rel} lacks valid PNG magic header (89 50 4E 47)`);
    assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR', `${rel} missing IHDR chunk`);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.equal(width, expectedDim, `${rel} width expected ${expectedDim}, got ${width}`);
    assert.equal(height, expectedDim, `${rel} height expected ${expectedDim}, got ${height}`);
  }

  return `${requiredFiles.length} files verified, 4 PNG icons validated`;
});

// ============================================================================
// 2. Manifest V3 & HTML Asset Path Validation
// ============================================================================
await runCheck('2. Manifest V3 & HTML Path Validation', () => {
  const manifestRaw = readText('manifest.json');
  const manifest = JSON.parse(manifestRaw);

  assert.equal(manifest.manifest_version, 3, 'manifest_version must be 3');
  assert.ok(manifest.name && typeof manifest.name === 'string', 'manifest.name missing');
  assert.ok(manifest.version && typeof manifest.version === 'string', 'manifest.version missing');
  assert.equal(
    manifest.commands?.['toggle-ai-sidebar']?.suggested_key?.default,
    'Alt+S',
    'manifest.commands["toggle-ai-sidebar"] must bind Alt+S'
  );

  const requiredPermissions = ['storage', 'activeTab', 'contextMenus', 'scripting', 'sidePanel'];
  assert.ok(Array.isArray(manifest.permissions), 'manifest.permissions must be an array');
  for (const perm of requiredPermissions) {
    assert.ok(manifest.permissions.includes(perm), `manifest.permissions missing "${perm}"`);
  }
  assert.equal(
    manifest.side_panel?.default_path,
    'src/popup/popup.html?mode=sidepanel',
    'manifest.side_panel.default_path must point to src/popup/popup.html?mode=sidepanel'
  );

  const referencedPaths = [];
  if (manifest.background?.service_worker) referencedPaths.push(manifest.background.service_worker);
  if (manifest.action?.default_popup) referencedPaths.push(manifest.action.default_popup);
  if (manifest.side_panel?.default_path) referencedPaths.push(manifest.side_panel.default_path);
  if (manifest.options_page) referencedPaths.push(manifest.options_page);
  if (manifest.icons) referencedPaths.push(...Object.values(manifest.icons));
  if (manifest.action?.default_icon) referencedPaths.push(...Object.values(manifest.action.default_icon));
  if (Array.isArray(manifest.content_scripts)) {
    for (const cs of manifest.content_scripts) {
      if (Array.isArray(cs.js)) referencedPaths.push(...cs.js);
      if (Array.isArray(cs.css)) referencedPaths.push(...cs.css);
    }
  }

  assert.ok(referencedPaths.length > 0, 'No paths referenced in manifest.json');
  for (const rel of referencedPaths) {
    const cleanRel = String(rel).split(/[?#]/)[0];
    const abs = path.join(ROOT_DIR, cleanRel);
    assert.ok(fs.existsSync(abs), `Manifest path not found on disk: ${rel}`);
  }

  // Verify local relative <script src="..."> and <link href="..."> in HTML files
  const htmlFiles = ['src/popup/popup.html', 'src/options/options.html', 'demo/index.html'];
  let htmlRefCount = 0;
  for (const htmlRel of htmlFiles) {
    const htmlDir = path.dirname(path.join(ROOT_DIR, htmlRel));
    const html = readText(htmlRel);
    const refRegex = /(?:src|href)=["']([^"']+)["']/g;
    let match;
    while ((match = refRegex.exec(html)) !== null) {
      const target = match[1];
      if (!target || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#') || target.startsWith('data:')) {
        continue;
      }
      const resolved = path.resolve(htmlDir, target);
      assert.ok(fs.existsSync(resolved), `${htmlRel} references missing asset: ${target}`);
      htmlRefCount += 1;
    }
  }

  // Verify popup.html has Sider 4-Tab workspace, SidePanel markers & all getElementById IDs used in popup.js
  const popupHtml = readText('src/popup/popup.html');
  const popupJs = readText('src/popup/popup.js');
  for (const requiredPopupMarker of [
    '<h1>Gloss</h1>',
    'id="workspaceTabs"',
    'id="tabBtnTranslate"',
    'id="tabBtnChat"',
    'id="tabBtnSummary"',
    'id="tabBtnWrite"',
    'id="paneTranslate"',
    'id="paneChat"',
    'id="paneSummary"',
    'id="paneWrite"',
    'id="engineConfigCard"',
    'id="pageRestrictedBar"',
    'id="pageTargetLangGroup"',
    'id="openSidebarBtn"',
    'id="summarizePageBtn"',
    'id="popupChatHistoryBtn"',
    'id="popupChatHistoryPanel"',
    'id="popupChatHistorySearch"',
    'id="popupChatHistoryList"',
    'id="popupChatInput"',
    'id="popupSummaryCustomInput"',
    'id="popupWriteInput"',
    '<option value="codex">',
    'id="popupCodexRow"',
    'id="popupCodexModel"',
    'id="popupCodexHint"',
    'id="popupCodexImportBtn"',
    'id="popupCodexFileInput"'
  ]) {
    assert.ok(popupHtml.includes(requiredPopupMarker), `popup.html missing ${requiredPopupMarker}`);
  }
  const popupIdRegex = /getElementById\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g;
  let popupIdMatch;
  while ((popupIdMatch = popupIdRegex.exec(popupJs)) !== null) {
    assert.ok(
      popupHtml.includes(`id="${popupIdMatch[1]}"`),
      `popup.html missing #${popupIdMatch[1]} referenced by popup.js`
    );
  }

  // Verify options.html has Codex Subscription UI & 100% getElementById parity with options.js
  const optionsHtml = readText('src/options/options.html');
  const optionsJs = readText('src/options/options.js');
  for (const requiredOptMarker of [
    'data-engine="codex"',
    'id="codexConfigCard"',
    'id="codexAuthStatus"',
    'id="codexModel"',
    'id="codexReasoningEffort"',
    'id="codexTestBtn"',
    'id="codexClearAuthBtn"',
    'id="codexImportFileBtn"',
    'id="codexAuthFileInput"',
    'id="codexAuthJsonInput"',
    'id="codexParseJsonBtn"',
    'id="codexDeviceLoginBtn"',
    'id="codexDeviceBox"',
    'id="codexDeviceCodeText"',
    'id="codexCopyCodeBtn"'
  ]) {
    assert.ok(optionsHtml.includes(requiredOptMarker), `options.html missing ${requiredOptMarker}`);
  }
  const optionsIdRegex = /getElementById\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g;
  let optIdMatch;
  while ((optIdMatch = optionsIdRegex.exec(optionsJs)) !== null) {
    assert.ok(
      optionsHtml.includes(`id="${optIdMatch[1]}"`),
      `options.html missing #${optIdMatch[1]} referenced by options.js`
    );
  }

  return `${referencedPaths.length} manifest paths & ${htmlRefCount} HTML asset refs verified`;
});

// ============================================================================
// 3. Syntax Check (node --check) & Classic Script Compatibility
// ============================================================================
await runCheck('3. JS Syntax Check (node --check) & Classic Script Check', () => {
  const jsFiles = collectJsFiles(ROOT_DIR);
  assert.ok(jsFiles.length >= 9, `Expected at least 9 JS/MJS files, found ${jsFiles.length}`);

  for (const absPath of jsFiles) {
    execFileSync(process.execPath, ['--check', absPath], { stdio: 'pipe' });
  }

  // Classic scripts MUST NOT use ES module import/export syntax
  const classicScripts = [
    'src/shared/config.js',
    'src/content/dom-translator.js',
    'src/content/selection-ui.js',
    'src/content/index.js',
    'src/popup/popup.js',
    'src/options/options.js'
  ];

  for (const rel of classicScripts) {
    const code = readText(rel);
    // vm.Script parses strictly as a classic script and throws SyntaxError on import/export
    new vm.Script(code, { filename: rel });
  }

  // Also syntax-check demo/index.html inline <script type="module"> and verify demo contents
  const demoHtml = readText('demo/index.html');
  const demoModuleMatch = demoHtml.match(/<script\s+type="module">([\s\S]*?)<\/script>/);
  assert.ok(demoModuleMatch, 'demo/index.html missing <script type="module"> polyfill bridge');
  execFileSync(process.execPath, ['--input-type=module', '--check'], {
    input: demoModuleMatch[1],
    stdio: ['pipe', 'pipe', 'pipe']
  });

  for (const requiredMarker of [
    'lang="en"',
    'lang="ja"',
    'lang="ko"',
    'lang="fr"',
    'lang="de"',
    'lang="es"',
    'lang="zh-CN"',
    'lang="zh-TW"',
    '<pre><code>',
    'notranslate',
    'translate="no"',
    'GraphTimeline',
    'SHIPPED',
    'Mar 12',
    'CLI copies the files',
    'FETCH_LOOM_MODELS',
    'data-mode="replace"',
    'demo-sidebar-btn',
    'demo-summarize-btn',
    'AI_CHAT',
    'SIDEBAR_TOGGLE',
    'SIDEBAR_ACTION',
    'demo-write-target',
    'sider-ai-showcase'
  ]) {
    assert.ok(demoHtml.includes(requiredMarker), `demo/index.html missing required marker: ${requiredMarker}`);
  }

  const contentCss = readText('src/content/content.css');
  const openBraces = (contentCss.match(/\{/g) || []).length;
  const closeBraces = (contentCss.match(/\}/g) || []).length;
  assert.equal(openBraces, closeBraces, `content.css brace mismatch: {=${openBraces}, }=${closeBraces}`);
  assert.ok(contentCss.includes('#wt-root-container .wt-hidden'), 'content.css missing #wt-root-container .wt-hidden');

  const popupCss = readText('src/popup/popup.css');
  const popupOpenBraces = (popupCss.match(/\{/g) || []).length;
  const popupCloseBraces = (popupCss.match(/\}/g) || []).length;
  assert.equal(popupOpenBraces, popupCloseBraces, `popup.css brace mismatch: {=${popupOpenBraces}, }=${popupCloseBraces}`);
  for (const cssMarker of ['[hidden]', 'html.is-sidepanel', '.workspace-tabs', '.page-card.is-restricted']) {
    assert.ok(popupCss.includes(cssMarker), `popup.css missing ${cssMarker}`);
  }

  const optionsCss = readText('src/options/options.css');
  const optOpenBraces = (optionsCss.match(/\{/g) || []).length;
  const optCloseBraces = (optionsCss.match(/\}/g) || []).length;
  assert.equal(optOpenBraces, optCloseBraces, `options.css brace mismatch: {=${optOpenBraces}, }=${optCloseBraces}`);
  for (const optCssMarker of ['.codex-choice-card', '.codex-device-box']) {
    assert.ok(optionsCss.includes(optCssMarker), `options.css missing ${optCssMarker}`);
  }

  return `${jsFiles.length} JS/MJS files passed node --check; ${classicScripts.length} classic scripts, CSS & demo module validated`;
});

// ============================================================================
// 4. Shared Config VM Sandbox Check
// ============================================================================
await runCheck('4. Shared Config (WT_CONFIG) VM Sandbox Check', async () => {
  const configCode = readText('src/shared/config.js');

  const storeData = { sync: {}, local: {} };
  const makeArea = (areaName) => ({
    get(keys, cb) {
      const data = storeData[areaName];
      const out = {};
      if (Array.isArray(keys)) {
        for (const k of keys) if (k in data) out[k] = data[k];
      } else if (typeof keys === 'string') {
        if (keys in data) out[keys] = data[keys];
      } else if (keys && typeof keys === 'object') {
        for (const [k, def] of Object.entries(keys)) {
          out[k] = k in data ? data[k] : def;
        }
      } else {
        Object.assign(out, data);
      }
      if (typeof cb === 'function') cb(out);
      return Promise.resolve(out);
    },
    set(items, cb) {
      Object.assign(storeData[areaName], items);
      if (typeof cb === 'function') cb();
      return Promise.resolve();
    }
  });

  const sandbox = {
    console,
    Date,
    Math,
    Set,
    Map,
    Promise,
    JSON,
    Uint8Array,
    TextDecoder,
    atob,
    decodeURIComponent,
    chrome: {
      runtime: {},
      storage: {
        sync: makeArea('sync'),
        local: makeArea('local')
      }
    }
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(configCode, sandbox, { filename: 'src/shared/config.js' });

  const cfg = sandbox.WT_CONFIG;
  assert.ok(cfg && typeof cfg === 'object', 'globalThis.WT_CONFIG must be defined');

  // Verify TARGET_LANGUAGES defines zh-CN, zh-TW, en
  const targetCodes = Array.isArray(cfg.TARGET_LANGUAGES)
    ? cfg.TARGET_LANGUAGES.map((l) => (typeof l === 'string' ? l : l.code))
    : Object.keys(cfg.TARGET_LANGUAGES || {});
  for (const code of ['zh-CN', 'zh-TW', 'en']) {
    assert.ok(targetCodes.includes(code), `TARGET_LANGUAGES missing "${code}"`);
  }

  // Verify SOURCE_LANGUAGES defines 'auto' and major languages
  const sourceCodes = Array.isArray(cfg.SOURCE_LANGUAGES)
    ? cfg.SOURCE_LANGUAGES.map((l) => (typeof l === 'string' ? l : l.code))
    : Object.keys(cfg.SOURCE_LANGUAGES || {});
  for (const code of ['auto', 'en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'fr', 'de', 'es']) {
    assert.ok(sourceCodes.includes(code), `SOURCE_LANGUAGES missing "${code}"`);
  }

  // Verify DEFAULT_SETTINGS schema
  const def = cfg.DEFAULT_SETTINGS;
  assert.ok(def && typeof def === 'object', 'DEFAULT_SETTINGS missing');
  assert.equal(def.sourceLang, 'auto');
  assert.equal(def.targetLang, 'zh-CN');
  assert.equal(def.displayMode, 'replace');
  assert.equal(def.engine, 'google-free');
  assert.equal(def.selectionMode, 'icon');
  assert.equal(def.showFloatingBall, true);

  assert.equal(
    cfg.convertChineseScript(
      '我們為企業提供超過 1 億美元的額度，用于通過 Claude Mythos 修復關鍵漏洞。適用相關條款。立即申請 →',
      'zh-CN'
    ),
    '我们为企业提供超过 1 亿美元的额度，用于通过 Claude Mythos 修复关键漏洞。适用相关条款。立即申请 →',
    'zh-CN script conversion must simplify devin.ai banner copy'
  );
  assert.equal(
    cfg.enforceTargetChineseScript('添加企業級 SSO', 'zh-CN'),
    '添加企业级 SSO',
    'enforceTargetChineseScript must normalize Traditional phrase to Simplified for zh-CN'
  );
  assert.equal(
    cfg.convertChineseScript(
      '我在瀏覽器中測試了設置、登錄和賬戶關聯。現有的電子郵件登錄仍然有效，所有檢查均通過。',
      'zh-CN'
    ),
    '我在浏览器中测试了设置、登录和账户关联。现有的电子邮件登录仍然有效，所有检查均通过。',
    'zh-CN script conversion must simplify settings/login/account copy'
  );
  assert.equal(
    cfg.convertChineseScript('页面控制与系统设置', 'zh-TW'),
    '頁面控制與系統設定',
    'zh-TW script conversion must map simplified copy to Traditional Chinese'
  );
  assert.equal(def.altHoverTranslate, true);
  assert.equal(def.translationStyle, 'default');
  assert.ok(Array.isArray(def.excludedDomains));
  assert.ok(def.openaiConfig && typeof def.openaiConfig === 'object');
  assert.ok(typeof def.openaiConfig.apiUrl === 'string' && def.openaiConfig.apiUrl.length > 0);
  assert.ok(typeof def.openaiConfig.model === 'string' && def.openaiConfig.model.length > 0);
  assert.ok(def.loomConfig && typeof def.loomConfig === 'object', 'DEFAULT_SETTINGS.loomConfig missing');
  assert.equal(def.loomConfig.baseUrl, 'http://127.0.0.1:4319/v1');
  assert.equal(def.loomConfig.apiKey, '');
  assert.equal(def.loomConfig.provider, 'zenmux');
  assert.equal(def.loomConfig.model, 'zenmux/anthropic/claude-sonnet-5.5');

  // Verify Round 7 Codex Subscription config & 11 preset models
  assert.equal(cfg.mergeSettings({}, { engine: 'codex' }).engine, 'codex', 'mergeSettings must accept engine: "codex"');
  assert.ok(def.codexConfig && typeof def.codexConfig === 'object', 'DEFAULT_SETTINGS.codexConfig missing');
  assert.equal(def.codexConfig.baseUrl, 'https://chatgpt.com/backend-api');
  assert.equal(def.codexConfig.model, 'gpt-5.6-luna');
  assert.equal(def.codexConfig.reasoningEffort, 'low');
  assert.ok(Array.isArray(cfg.CODEX_PRESET_MODELS), 'WT_CONFIG.CODEX_PRESET_MODELS missing');
  assert.equal(cfg.CODEX_PRESET_MODELS.length, 11, `Expected 11 CODEX_PRESET_MODELS, got ${cfg.CODEX_PRESET_MODELS.length}`);
  for (const codexId of ['gpt-5.6-luna', 'gpt-6-luna', 'gpt-5.3-codex', 'gpt-5.4', 'gpt-5.4-mini']) {
    assert.ok(cfg.CODEX_PRESET_MODELS.some((m) => m.id === codexId), `CODEX_PRESET_MODELS missing ${codexId}`);
  }
  assert.equal(Object.keys(cfg.MESSAGE_TYPES || {}).length, 17, 'MESSAGE_TYPES must stay strictly at 17 constants');

  // Verify LOOM_PRESET_PROVIDERS & MESSAGE_TYPES
  assert.ok(Array.isArray(cfg.LOOM_PRESET_PROVIDERS), 'LOOM_PRESET_PROVIDERS missing');
  const expectedProviders = ['zenmux', 'glm', 'minimax', 'deepseek', 'kimi', 'longcat'];
  const presetIds = cfg.LOOM_PRESET_PROVIDERS.map((p) => p.id);
  assert.equal(presetIds.length, 6, `Expected 6 LOOM_PRESET_PROVIDERS, got ${presetIds.length}`);
  for (const pid of expectedProviders) {
    assert.ok(presetIds.includes(pid), `Missing Loom preset provider: ${pid}`);
    const pObj = cfg.LOOM_PRESET_PROVIDERS.find((p) => p.id === pid);
    assert.ok(Array.isArray(pObj.models) && pObj.models.length > 0, `Preset provider ${pid} has no models`);
  }
  const glmPreset = cfg.LOOM_PRESET_PROVIDERS.find((p) => p.id === 'glm');
  assert.equal(glmPreset?.models?.length, 11, 'GLM preset must preserve all 11 models');
  const kimiPreset = cfg.LOOM_PRESET_PROVIDERS.find((p) => p.id === 'kimi');
  assert.equal(kimiPreset?.models?.length, 6, 'Kimi preset must preserve all 6 models');
  assert.ok(
    kimiPreset?.models?.some((m) => m.id === 'kimi/k3.1-pro-highspeed'),
    'Kimi preset models must include kimi/k3.1-pro-highspeed'
  );

  // Verify all 17 MESSAGE_TYPES and 12 AI_TASK_TYPES
  const expectedMessageKeys = [
    'TRANSLATE_TEXT',
    'TRANSLATE_BATCH',
    'GET_SETTINGS',
    'SAVE_SETTINGS',
    'GET_HISTORY',
    'CLEAR_HISTORY',
    'TEST_ENGINE',
    'FETCH_LOOM_MODELS',
    'AI_CHAT',
    'PAGE_TRANSLATE_START',
    'PAGE_TRANSLATE_RESTORE',
    'PAGE_TRANSLATE_TOGGLE',
    'PAGE_SET_MODE',
    'PAGE_GET_STATUS',
    'SHOW_SELECTION_TRANSLATION',
    'SIDEBAR_TOGGLE',
    'SIDEBAR_ACTION'
  ];
  for (const key of expectedMessageKeys) {
    assert.equal(cfg.MESSAGE_TYPES?.[key], key, `WT_CONFIG.MESSAGE_TYPES missing ${key}`);
  }

  assert.ok(cfg.AI_TASK_TYPES && typeof cfg.AI_TASK_TYPES === 'object', 'WT_CONFIG.AI_TASK_TYPES missing');
  const expectedTaskTypes = [
    'chat',
    'summarize_page',
    'key_takeaways',
    'page_qa',
    'explain',
    'summarize',
    'polish',
    'shorten',
    'expand',
    'grammar',
    'translate_en',
    'translate_zh'
  ];
  for (const taskKey of expectedTaskTypes) {
    assert.ok(
      cfg.AI_TASK_TYPES[taskKey] || Object.values(cfg.AI_TASK_TYPES).some((t) => t === taskKey || t?.id === taskKey),
      `WT_CONFIG.AI_TASK_TYPES missing "${taskKey}"`
    );
  }

  // Verify STORAGE_KEYS
  assert.equal(cfg.STORAGE_KEYS?.SETTINGS, 'wt_settings');
  assert.equal(cfg.STORAGE_KEYS?.HISTORY, 'wt_history');
  assert.equal(cfg.STORAGE_KEYS?.CHAT_SESSIONS, 'wt_chat_sessions');

  // Verify WT_CONFIG historical webpage chat session helpers (save / query / snippet / delete / clear)
  assert.equal(
    cfg.normalizeSessionPageUrl('https://devin.ai/pricing#enterprise'),
    'https://devin.ai/pricing',
    'normalizeSessionPageUrl must strip standard fragment hashes'
  );
  const sess1 = await cfg.saveChatSession({
    pageUrl: 'https://devin.ai/pricing#enterprise',
    pageTitle: 'Devin Pricing Plans',
    pageExcerpt: 'Enterprise plans include custom deployment and SAML SSO.',
    messages: [
      { role: 'user', content: 'Does Devin support SAML SSO?' },
      {
        role: 'assistant',
        content: 'Yes, Enterprise plans include SAML SSO and priority support.',
        reasoning: 'Checked enterprise billing section in Devin pricing docs'
      }
    ],
    updatedAt: 1000
  });
  const sess2 = await cfg.saveChatSession({
    pageUrl: 'https://mdxcn.dev/components',
    pageTitle: 'MDXCN Components',
    messages: [
      { role: 'user', content: 'Summarize GraphTimeline usage' },
      { role: 'assistant', content: 'Write Markdown lists inside JSX tags to render timelines.' }
    ],
    updatedAt: 2000
  });
  assert.ok(sess1?.id && sess2?.id);
  const allSessions = await cfg.getChatSessions();
  assert.equal(allSessions.length, 2);
  assert.equal(allSessions[0].id, sess2.id, 'Sessions must sort newest updatedAt first');

  const queryByReply = await cfg.getChatSessions({ query: 'SAML priority' });
  assert.equal(queryByReply.length, 1);
  assert.equal(queryByReply[0].id, sess1.id);
  assert.ok(queryByReply[0].matchSnippet.includes('SAML SSO'), 'Expected matchSnippet highlighting SAML SSO');

  const queryByReasoning = await cfg.getChatSessions({ query: 'enterprise billing section' });
  assert.equal(queryByReasoning.length, 1);
  assert.equal(queryByReasoning[0].id, sess1.id);

  const queryByHost = await cfg.getChatSessions({ query: 'mdxcn.dev' });
  assert.equal(queryByHost.length, 1);
  assert.equal(queryByHost[0].id, sess2.id);

  const afterDel = await cfg.deleteChatSession(sess1.id);
  assert.equal(afterDel.length, 1);
  assert.equal(afterDel[0].id, sess2.id);

  const afterClear = await cfg.clearChatSessions();
  assert.equal(Array.isArray(afterClear) || Array.isArray([...afterClear]), true);
  assert.equal(afterClear.length, 0, 'clearChatSessions must return an empty list');

  // Test storage helpers & deep merge of loomConfig + codexConfig in sandbox
  const saved = await cfg.saveSettings({
    targetLang: 'zh-TW',
    displayMode: 'bilingual',
    loomConfig: {
      provider: 'deepseek',
      model: 'deepseek/deepseek-v3.2'
    },
    codexConfig: {
      model: 'gpt-6-luna',
      reasoningEffort: 'high'
    }
  });
  assert.equal(saved.targetLang, 'zh-TW');
  assert.equal(saved.displayMode, 'bilingual');
  assert.equal(saved.loomConfig.baseUrl, 'http://127.0.0.1:4319/v1');
  assert.equal(saved.loomConfig.provider, 'deepseek');
  assert.equal(saved.loomConfig.model, 'deepseek/deepseek-v3.2');
  assert.equal(saved.codexConfig.baseUrl, 'https://chatgpt.com/backend-api');
  assert.equal(saved.codexConfig.model, 'gpt-6-luna');
  assert.equal(saved.codexConfig.reasoningEffort, 'high');
  const loaded = await cfg.getSettings();
  assert.equal(loaded.targetLang, 'zh-TW');
  assert.equal(loaded.sourceLang, 'auto');
  assert.equal(loaded.loomConfig.baseUrl, 'http://127.0.0.1:4319/v1');
  assert.equal(loaded.loomConfig.provider, 'deepseek');
  assert.equal(loaded.codexConfig.model, 'gpt-6-luna');

  // Verify WT_CONFIG.parseCodexAuthInput across 4 synthetic input formats (no real auth files touched)
  assert.equal(typeof cfg.parseCodexAuthInput, 'function', 'WT_CONFIG.parseCodexAuthInput missing');
  const synthExpSec = Math.floor(Date.now() / 1000) + 7200;
  const synthJwt = makeSyntheticCodexJwt({
    accountId: 'acct_parse_test_001',
    planType: 'plus',
    email: 'synth-用户@example.test',
    expSeconds: synthExpSec
  });

  const parsedCodexCli = cfg.parseCodexAuthInput(JSON.stringify({
    tokens: {
      access_token: synthJwt,
      refresh_token: 'rt_codex_synth',
      account_id: 'acct_parse_test_001'
    }
  }));
  assert.equal(parsedCodexCli.accessToken, synthJwt);
  assert.equal(parsedCodexCli.refreshToken, 'rt_codex_synth');
  assert.equal(parsedCodexCli.accountId, 'acct_parse_test_001');
  assert.equal(parsedCodexCli.planType, 'plus');
  assert.equal(parsedCodexCli.email, 'synth-用户@example.test');
  assert.equal(parsedCodexCli.expiresAt, synthExpSec * 1000);

  const parsedPiAuth = cfg.parseCodexAuthInput(JSON.stringify({
    'openai-codex': {
      access: synthJwt,
      refresh: 'rt_pi_synth',
      expires: synthExpSec * 1000
    }
  }));
  assert.equal(parsedPiAuth.refreshToken, 'rt_pi_synth');
  assert.equal(parsedPiAuth.accountId, 'acct_parse_test_001');

  const parsedOAuthResp = cfg.parseCodexAuthInput(JSON.stringify({
    access_token: synthJwt,
    refresh_token: 'rt_oauth_synth',
    expires_in: 3600
  }));
  assert.equal(parsedOAuthResp.refreshToken, 'rt_oauth_synth');
  assert.ok(parsedOAuthResp.expiresAt > Date.now() + 3000 * 1000);

  const parsedBareJwt = cfg.parseCodexAuthInput(`Bearer ${synthJwt}`);
  assert.equal(parsedBareJwt.accessToken, synthJwt);
  assert.equal(parsedBareJwt.accountId, 'acct_parse_test_001');
  assert.equal(parsedBareJwt.email, 'synth-用户@example.test');

  return `WT_CONFIG verified (${sourceCodes.length} source, ${targetCodes.length} target, ${presetIds.length} Loom providers, 11 Codex models)`;
});

// ============================================================================
// 5. Translator Engine Unit Tests (Mocked fetch + Offline Fallback)
// ============================================================================
await runCheck('5. Translator Engine Unit Tests (Google / Batch / MyMemory / OpenAI / Offline)', async () => {
  const engineUrl = pathToFileURL(path.join(ROOT_DIR, 'src/background/translator-engine.js')).href;
  const engineMod = await import(engineUrl);

  assert.equal(typeof engineMod.translateText, 'function', 'translateText export missing');
  assert.equal(typeof engineMod.translateBatch, 'function', 'translateBatch export missing');
  assert.equal(typeof engineMod.normalizeLangCode, 'function', 'normalizeLangCode export missing');

  const originalFetch = globalThis.fetch;
  const clearCache = () => {
    if (typeof engineMod.clearTranslationCache === 'function') {
      engineMod.clearTranslationCache();
    }
  };

  try {
    // 5a. Google Translate URL construction & zh-CN / zh-TW / en / auto handling
    clearCache();
    const capturedUrls = [];
    globalThis.fetch = async (url) => {
      capturedUrls.push(String(url));
      const parsed = new URL(String(url));
      const tl = parsed.searchParams.get('tl');
      const reply = tl === 'zh-TW' ? '你好，世界！' : tl === 'en' ? 'Hello, world!' : '你好，世界！';
      return {
        ok: true,
        status: 200,
        async json() {
          return [[[reply, parsed.searchParams.get('q'), null, null, 1]], null, 'en'];
        }
      };
    };

    for (const targetLang of ['zh-CN', 'zh-TW', 'en']) {
      const res = await engineMod.translateText({
        text: `Test phrase for ${targetLang}`,
        sourceLang: 'auto',
        targetLang,
        engine: 'google-free',
        skipCache: true
      });
      assert.ok(res.translatedText.length > 0, `Empty result for ${targetLang}`);
      assert.equal(res.engine, 'google-free');
    }

    assert.equal(capturedUrls.length, 3);
    const firstUrl = new URL(capturedUrls[0]);
    assert.equal(firstUrl.origin + firstUrl.pathname, 'https://translate.googleapis.com/translate_a/single');
    assert.equal(firstUrl.searchParams.get('client'), 'gtx');
    assert.equal(firstUrl.searchParams.get('sl'), 'auto');
    assert.equal(firstUrl.searchParams.get('tl'), 'zh-CN');
    assert.equal(firstUrl.searchParams.get('dt'), 't');
    assert.equal(new URL(capturedUrls[1]).searchParams.get('tl'), 'zh-TW');
    assert.equal(new URL(capturedUrls[2]).searchParams.get('tl'), 'en');

    // 5b. Batch delimiter splitting/re-joining + mismatch fallback
    clearCache();
    let batchFetchCalls = 0;
    globalThis.fetch = async (url) => {
      batchFetchCalls += 1;
      const q = new URL(String(url)).searchParams.get('q');
      const parts = q.split('\n||||\n').map((s) => `译:${s}`);
      return {
        ok: true,
        status: 200,
        async json() {
          return [[[parts.join('\n||||\n'), q, null, null, 1]], null, 'en'];
        }
      };
    };

    const batchRes = await engineMod.translateBatch({
      texts: ['First paragraph', 'Second paragraph', 'Third paragraph'],
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      engine: 'google-free',
      skipCache: true
    });
    assert.equal(batchFetchCalls, 1, 'Expected single batched Google request');
    assert.deepEqual(batchRes.translations, ['译:First paragraph', '译:Second paragraph', '译:Third paragraph']);

    // Mismatch delimiter count -> fallback to per-item calls
    clearCache();
    let mismatchCalls = 0;
    globalThis.fetch = async (url) => {
      mismatchCalls += 1;
      const q = new URL(String(url)).searchParams.get('q');
      const textOut = q.includes('||||') ? 'corrupted single segment without delimiter' : `单句:${q}`;
      return {
        ok: true,
        status: 200,
        async json() {
          return [[[textOut, q, null, null, 1]], null, 'en'];
        }
      };
    };

    const mismatchRes = await engineMod.translateBatch({
      texts: ['Alpha sentence', 'Beta sentence'],
      sourceLang: 'en',
      targetLang: 'zh-CN',
      engine: 'google-free',
      skipCache: true
    });
    assert.ok(mismatchCalls >= 3, 'Expected fallback per-item calls on delimiter mismatch');
    assert.deepEqual(mismatchRes.translations, ['单句:Alpha sentence', '单句:Beta sentence']);

    // 5c. MyMemory fallback when Google primary fails
    clearCache();
    const fallbackCalls = [];
    globalThis.fetch = async (url) => {
      const sUrl = String(url);
      fallbackCalls.push(sUrl);
      if (sUrl.includes('translate.googleapis.com')) {
        throw new Error('Simulated Google network failure');
      }
      if (sUrl.includes('api.mymemory.translated.net')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              responseStatus: 200,
              responseData: {
                translatedText: '來自 MyMemory 的繁體譯文',
                detectedLanguage: 'en'
              }
            };
          }
        };
      }
      throw new Error(`Unexpected URL: ${sUrl}`);
    };

    const mmRes = await engineMod.translateText({
      text: 'Fallback test sentence',
      sourceLang: 'auto',
      targetLang: 'zh-TW',
      engine: 'google-free',
      skipCache: true
    });
    assert.equal(mmRes.engine, 'mymemory');
    assert.equal(mmRes.translatedText, '來自 MyMemory 的繁體譯文');
    assert.ok(fallbackCalls.some((u) => u.includes('langpair=autodetect|zh-TW')), 'MyMemory langpair check failed');

    // 5d. OpenAI payload formatting
    clearCache();
    let capturedOpenAI = null;
    globalThis.fetch = async (url, init) => {
      capturedOpenAI = { url: String(url), init, body: JSON.parse(init.body) };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [{ message: { content: 'OpenAI 翻译结果' } }]
          };
        }
      };
    };

    const openaiRes = await engineMod.translateText({
      text: 'OpenAI payload verification',
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      engine: 'openai',
      openaiConfig: {
        apiUrl: 'https://example.invalid/v1/chat/completions',
        apiKey: 'sk-test-12345',
        model: 'gpt-4o-mini'
      },
      skipCache: true
    });

    assert.equal(openaiRes.engine, 'openai');
    assert.equal(openaiRes.translatedText, 'OpenAI 翻译结果');
    assert.equal(capturedOpenAI.url, 'https://example.invalid/v1/chat/completions');
    assert.equal(capturedOpenAI.init.method, 'POST');
    assert.equal(capturedOpenAI.init.headers.Authorization, 'Bearer sk-test-12345');
    assert.equal(capturedOpenAI.body.model, 'gpt-4o-mini');
    assert.equal(capturedOpenAI.body.messages[0].role, 'system');
    assert.ok(capturedOpenAI.body.messages[0].content.includes('zh-CN') || capturedOpenAI.body.messages[0].content.includes('Simplified Chinese'));
    assert.equal(capturedOpenAI.body.messages[1].content, 'OpenAI payload verification');

    // 5e. Offline fallback when fetch rejects completely
    clearCache();
    globalThis.fetch = async () => {
      throw new Error('Network offline');
    };

    const offlineSingle = await engineMod.translateText({
      text: 'Hello, world!',
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      engine: 'google-free',
      skipCache: true
    });
    assert.ok(offlineSingle.translatedText && offlineSingle.translatedText.trim().length > 0);

    const offlineS2T = await engineMod.translateText({
      text: '网页翻译软件支持简体中文与繁體中文切换',
      sourceLang: 'zh-CN',
      targetLang: 'zh-TW',
      engine: 'google-free',
      skipCache: true
    });
    assert.ok(offlineS2T.translatedText.includes('網頁翻譯軟體'), `Expected S2T conversion, got: ${offlineS2T.translatedText}`);

    const offlineBatch = await engineMod.translateBatch({
      texts: ['Bonjour le monde !', 'Unseen arbitrary offline paragraph'],
      sourceLang: 'auto',
      targetLang: 'en',
      engine: 'google-free',
      skipCache: true
    });
    assert.equal(offlineBatch.translations.length, 2);
    assert.ok(offlineBatch.translations.every((t) => typeof t === 'string' && t.trim().length > 0));

    // --- 5e-2. Enforce Simplified Chinese output even when upstream engine returns Traditional Chinese ---
    clearCache();
    globalThis.fetch = async (url, init = {}) => {
      assert.ok(String(url).endsWith('/chat/completions'), `Unexpected mock URL: ${url}`);
      const parsed = JSON.parse(init.body || '{}');
      const userPrompt = parsed.messages?.[parsed.messages.length - 1]?.content || '';
      const reply = userPrompt.includes('||||')
        ? '我們為企業提供超過 1 億美元的額度，並添加企業級 SSO\n||||\n添加企業級 SSO'
        : '我們為企業提供超過 1 億美元的額度，並添加企業級 SSO';
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: reply } }] }),
        json: async () => ({ choices: [{ message: { content: reply } }] })
      };
    };
    const loomTradConfig = {
      baseUrl: 'http://127.0.0.1:4319/v1',
      apiKey: 'hub.test-key',
      provider: 'kimi',
      model: 'kimi/k3.1-pro'
    };
    const normalizedSingle = await engineMod.translateText({
      text: 'We offer over $100M in enterprise credits and add enterprise SSO',
      sourceLang: 'en',
      targetLang: 'zh-CN',
      engine: 'loom',
      loomConfig: loomTradConfig,
      skipCache: true
    });
    assert.equal(
      normalizedSingle.translatedText,
      '我们为企业提供超过 1 亿美元的额度，并添加企业级 SSO',
      'translateText must normalize Traditional Chinese upstream response to Simplified Chinese for zh-CN'
    );
    const normalizedBatch = await engineMod.translateBatch({
      texts: ['We offer over $100M in enterprise credits and add enterprise SSO', 'Add enterprise SSO'],
      sourceLang: 'en',
      targetLang: 'zh-CN',
      engine: 'loom',
      loomConfig: loomTradConfig,
      skipCache: true
    });
    assert.deepEqual(
      normalizedBatch.translations,
      ['我们为企业提供超过 1 亿美元的额度，并添加企业级 SSO', '添加企业级 SSO'],
      'translateBatch must normalize Traditional Chinese upstream responses to Simplified Chinese for zh-CN'
    );
    clearCache();

    // --- 5f. Loom Gateway fetchLoomModels + translateWithLoom + 403 LOCAL_CLIENTS_ONLY ---
    const loomCalls = [];
    globalThis.fetch = async (url, init = {}) => {
      loomCalls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body });
      if (String(url).endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            object: 'list',
            data: [
              { id: 'zenmux/anthropic/claude-sonnet-5.5', owned_by: 'ZenMux' },
              { id: 'zenmux/openai/gpt-5.4', owned_by: 'ZenMux' },
              { id: 'deepseek/deepseek-v3.2', owned_by: 'DeepSeek' }
            ]
          }),
          json: async () => ({
            object: 'list',
            data: [
              { id: 'zenmux/anthropic/claude-sonnet-5.5', owned_by: 'ZenMux' },
              { id: 'zenmux/openai/gpt-5.4', owned_by: 'ZenMux' },
              { id: 'deepseek/deepseek-v3.2', owned_by: 'DeepSeek' }
            ]
          })
        };
      }
      if (String(url).endsWith('/chat/completions')) {
        const parsed = JSON.parse(init.body || '{}');
        const userText = parsed.messages?.[parsed.messages.length - 1]?.content || '';
        const reply = userText.includes('||||')
          ? '三月 12 日\n||||\nCLI 复制了文件'
          : '已由 Loom 本地网关翻译';
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ choices: [{ message: { content: reply } }] }),
          json: async () => ({ choices: [{ message: { content: reply } }] })
        };
      }
      throw new Error(`Unexpected Loom mock URL: ${url}`);
    };

    const groupedProviders = await engineMod.fetchLoomModels({
      baseUrl: 'http://127.0.0.1:4319/v1',
      apiKey: 'hub.test-key'
    });
    assert.ok(Array.isArray(groupedProviders) && groupedProviders.length >= 2, 'fetchLoomModels should group providers');
    const zenmuxGroup = groupedProviders.find((p) => p.id === 'zenmux');
    assert.ok(zenmuxGroup && zenmuxGroup.models.length === 2, 'zenmux group should contain 2 models');
    assert.equal(loomCalls[0].headers.Authorization, 'Bearer hub.test-key');

    const loomSingle = await engineMod.translateText({
      text: 'CLI copies the files',
      sourceLang: 'en',
      targetLang: 'zh-CN',
      engine: 'loom',
      loomConfig: {
        baseUrl: 'http://127.0.0.1:4319/v1',
        apiKey: 'hub.test-key',
        provider: 'zenmux',
        model: 'zenmux/anthropic/claude-sonnet-5.5'
      },
      skipCache: true
    });
    assert.equal(loomSingle.translatedText, '已由 Loom 本地网关翻译');
    assert.equal(loomSingle.engine, 'loom');

    const loomChatCall = loomCalls.find((c) => c.url.endsWith('/chat/completions'));
    assert.ok(loomChatCall, 'Expected POST /chat/completions call for Loom');
    const loomReqBody = JSON.parse(loomChatCall.body || '{}');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(loomReqBody, 'temperature'),
      'translateWithLoom must omit temperature for thinking models'
    );
    const loomSysPrompt = loomReqBody.messages?.find((m) => m.role === 'system')?.content || '';
    assert.ok(
      loomSysPrompt.includes('Think briefly') && loomSysPrompt.includes('do not overthink'),
      'translateWithLoom system prompt must enforce brief reasoning'
    );

    const loomBatch = await engineMod.translateBatch({
      texts: ['Mar 12', 'CLI copies the files'],
      sourceLang: 'en',
      targetLang: 'zh-CN',
      engine: 'loom',
      loomConfig: {
        baseUrl: 'http://127.0.0.1:4319/v1',
        apiKey: 'hub.test-key',
        provider: 'zenmux',
        model: 'zenmux/anthropic/claude-sonnet-5.5'
      },
      skipCache: true
    });
    assert.deepEqual(loomBatch.translations, ['三月 12 日', 'CLI 复制了文件']);

    // --- 5g. Loom kimi/k3.1-pro reasoning_effort: 'none', 400 fallback & translateBatch deduplication ---
    clearCache();
    const dedupCalls = [];
    globalThis.fetch = async (url, init = {}) => {
      const parsed = JSON.parse(init.body || '{}');
      dedupCalls.push({ url: String(url), body: parsed });
      const userPrompt = parsed.messages?.[parsed.messages.length - 1]?.content || '';
      const reply = userPrompt.includes('||||')
        ? '已发布\n||||\n三月 12 日\n||||\nCLI 复制了文件'
        : 'Kimi 低思考翻译';
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: reply } }] }),
        json: async () => ({ choices: [{ message: { content: reply } }] })
      };
    };

    const kimiSingle = await engineMod.translateWithLoom(
      'Fast thinking test',
      'en',
      'zh-CN',
      { baseUrl: 'http://127.0.0.1:4319/v1', apiKey: 'hub.test-key', provider: 'kimi', model: 'kimi/k3.1-pro' }
    );
    assert.equal(kimiSingle.translatedText, 'Kimi 低思考翻译');
    assert.equal(dedupCalls.length, 1);
    assert.equal(dedupCalls[0].body.reasoning_effort, 'none', 'kimi/k3.1-pro must send reasoning_effort: "none"');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(dedupCalls[0].body, 'temperature'),
      'kimi/k3.1-pro must omit temperature'
    );

    const dedupResult = await engineMod.translateBatch({
      texts: ['SHIPPED', 'Mar 12', 'SHIPPED', 'CLI copies the files', 'SHIPPED'],
      sourceLang: 'en',
      targetLang: 'zh-CN',
      engine: 'loom',
      loomConfig: {
        baseUrl: 'http://127.0.0.1:4319/v1',
        apiKey: 'hub.test-key',
        provider: 'kimi',
        model: 'kimi/k3.1-pro'
      },
      skipCache: true
    });
    assert.equal(dedupCalls.length, 2, 'Deduplicated batch should emit exactly 1 Loom request');
    const dedupPrompt = dedupCalls[1].body.messages?.find((m) => m.role === 'user')?.content || '';
    assert.equal(
      dedupPrompt.split('SHIPPED').length - 1,
      1,
      'Duplicate "SHIPPED" must appear only once in outgoing user prompt'
    );
    assert.equal(dedupPrompt.split('||||').length, 3, 'Expected 3 deduplicated segments in user prompt');
    assert.deepEqual(
      dedupResult.translations,
      ['已发布', '三月 12 日', '已发布', 'CLI 复制了文件', '已发布'],
      'Deduplicated batch must fan results back to all 5 positions'
    );

    // HTTP 400 automatic compatibility fallback when fastParams is rejected
    const fallback400Calls = [];
    globalThis.fetch = async (url, init = {}) => {
      const parsed = JSON.parse(init.body || '{}');
      fallback400Calls.push({ url: String(url), body: parsed });
      if (Object.prototype.hasOwnProperty.call(parsed, 'reasoning_effort')) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { code: 'UPSTREAM_400', message: 'Unsupported reasoning_effort' } }),
          json: async () => ({ error: { code: 'UPSTREAM_400', message: 'Unsupported reasoning_effort' } })
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: 'Kimi 400 回退翻译成功' } }] }),
        json: async () => ({ choices: [{ message: { content: 'Kimi 400 回退翻译成功' } }] })
      };
    };

    const fallback400Res = await engineMod.translateWithLoom(
      'Fallback check',
      'en',
      'zh-CN',
      { baseUrl: 'http://127.0.0.1:4319/v1', apiKey: 'hub.test-key', provider: 'kimi', model: 'kimi/k3.1-pro' }
    );
    assert.equal(fallback400Res.translatedText, 'Kimi 400 回退翻译成功');
    assert.equal(fallback400Calls.length, 2, 'HTTP 400 with fastParams must retry once without extra params');
    assert.equal(fallback400Calls[0].body.reasoning_effort, 'none');
    assert.ok(!Object.prototype.hasOwnProperty.call(fallback400Calls[1].body, 'reasoning_effort'));
    assert.ok(!Object.prototype.hasOwnProperty.call(fallback400Calls[1].body, 'temperature'));

    // Verify 403 LOCAL_CLIENTS_ONLY propagation on fetchLoomModels & translateWithLoom
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { code: 'LOCAL_CLIENTS_ONLY', message: 'Browser extension Origin rejected' } }),
      json: async () => ({ error: { code: 'LOCAL_CLIENTS_ONLY', message: 'Browser extension Origin rejected' } })
    });
    await assert.rejects(
      () => engineMod.fetchLoomModels({ baseUrl: 'http://127.0.0.1:4319/v1', apiKey: 'hub.test-key' }),
      (err) => err && err.code === 'LOCAL_CLIENTS_ONLY'
    );
    await assert.rejects(
      () => engineMod.translateWithLoom(
        'Hello',
        'en',
        'zh-CN',
        { baseUrl: 'http://127.0.0.1:4319/v1', apiKey: 'hub.test-key', model: 'zenmux/anthropic/claude-sonnet-5.5' }
      ),
      (err) => err && err.code === 'LOCAL_CLIENTS_ONLY' && String(err.message || '').includes('Origin')
    );

    // --- 5h. chatWithAI (Loom thinking + multimodal / Multi-turn / 400 fallback / OpenAI / Free fallback / service-worker AI_CHAT) ---
    assert.equal(typeof engineMod.chatWithAI, 'function', 'chatWithAI export missing');

    const TINY_PNG_DATA_URL =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const chatCalls = [];
    globalThis.fetch = async (url, init = {}) => {
      const urlStr = String(url);
      if (urlStr === 'https://img.example.test/chart.png') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'image/png' },
          arrayBuffer: async () => Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').buffer
        };
      }
      const body = init.body ? JSON.parse(init.body) : {};
      chatCalls.push({ url: urlStr, headers: init.headers || {}, body });
      if (urlStr.includes('127.0.0.1:4319') && chatCalls.length === 3 && Object.prototype.hasOwnProperty.call(body, 'reasoning_effort')) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { code: 'UPSTREAM_400', message: 'Unsupported reasoning_effort' } }),
          json: async () => ({ error: { code: 'UPSTREAM_400', message: 'Unsupported reasoning_effort' } })
        };
      }
      if (
        urlStr.includes('127.0.0.1:4319') &&
        body.model === 'glm/glm-5-turbo' &&
        Array.isArray(body.messages) &&
        body.messages.some((m) => Array.isArray(m.content))
      ) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { code: 'UNSUPPORTED_IMAGE', message: 'Model does not support image_url' } }),
          json: async () => ({ error: { code: 'UNSUPPORTED_IMAGE', message: 'Model does not support image_url' } })
        };
      }
      const reply = urlStr.includes('example.invalid')
        ? '<think>OpenAI proxy internal reasoning</think>OpenAI 侧边栏回复'
        : '## 网页摘要\n- 要点 1：本地 Loom 网关加速';
      const reasoningContent = urlStr.includes('example.invalid')
        ? ''
        : '1. 分析页面标题与结构\n2. 总结重点信息';
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            choices: [
              {
                message: {
                  content: reply,
                  ...(reasoningContent ? { reasoning_content: reasoningContent } : {})
                }
              }
            ]
          }),
        json: async () => ({
          choices: [
            {
              message: {
                content: reply,
                ...(reasoningContent ? { reasoning_content: reasoningContent } : {})
              }
            }
          ]
        })
      };
    };

    // Call 0: Default enableThinking=true omits buildLoomFastParams so reasoning_content is returned
    const summaryChat = await engineMod.chatWithAI({
      taskType: 'summarize_page',
      targetLang: 'zh-CN',
      engine: 'loom',
      model: 'kimi/k3.1-pro',
      loomConfig: { baseUrl: 'http://127.0.0.1:4319/v1', apiKey: 'hub.chat-key', provider: 'kimi', model: 'kimi/k3.1-pro' },
      pageContext: { title: 'Demo Essay', url: 'https://example.test/essay', content: 'Core reading context paragraph.' }
    });
    assert.equal(summaryChat.engine, 'loom');
    assert.equal(summaryChat.model, 'kimi/k3.1-pro');
    assert.ok(summaryChat.reply.includes('网页摘要'));
    assert.ok(summaryChat.reasoning.includes('分析页面标题与结构'), 'Default chatWithAI must extract reasoning_content');
    assert.equal(chatCalls[0].url, 'http://127.0.0.1:4319/v1/chat/completions');
    assert.ok(!Object.prototype.hasOwnProperty.call(chatCalls[0].body, 'reasoning_effort'), 'Default thinking mode must not send reasoning_effort: "none"');
    assert.ok(JSON.stringify(chatCalls[0].body.messages).includes('Demo Essay'));

    // Call 1: Multi-turn with multimodal image (dataUrl + remote URL converted to base64)
    const multiTurnChat = await engineMod.chatWithAI({
      taskType: 'chat',
      targetLang: 'zh-CN',
      engine: 'loom',
      model: 'kimi/k3.1-pro',
      loomConfig: { baseUrl: 'http://127.0.0.1:4319/v1', apiKey: 'hub.chat-key', provider: 'kimi', model: 'kimi/k3.1-pro' },
      messages: [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' }
      ],
      prompt: 'Second follow-up with images',
      selectionText: 'Quoted passage',
      images: [
        { dataUrl: TINY_PNG_DATA_URL, alt: 'Uploaded screenshot' },
        { url: 'https://img.example.test/chart.png', alt: 'Chart image' }
      ]
    });
    assert.equal(multiTurnChat.engine, 'loom');
    assert.equal(multiTurnChat.imageCount, 2);
    const serializedMulti = JSON.stringify(chatCalls[1].body.messages);
    assert.ok(serializedMulti.includes('First question') && serializedMulti.includes('First answer'));
    assert.ok(serializedMulti.includes('Second follow-up with images') && serializedMulti.includes('Quoted passage'));
    const lastUserMsg = chatCalls[1].body.messages[chatCalls[1].body.messages.length - 1];
    assert.ok(Array.isArray(lastUserMsg.content), 'Multimodal chat must send content part array');
    assert.ok(lastUserMsg.content.some((p) => p.type === 'image_url' && p.image_url?.url === TINY_PNG_DATA_URL));
    assert.ok(lastUserMsg.content.some((p) => p.type === 'image_url' && /^data:image\/png;base64,/.test(p.image_url?.url || '')));

    // Calls 2->3: Explicit enableThinking: false sends buildLoomFastParams, suppresses reasoning, and retries HTTP 400
    const chat400Retry = await engineMod.chatWithAI({
      taskType: 'explain',
      targetLang: 'zh-CN',
      engine: 'loom',
      model: 'kimi/k3.1-pro',
      enableThinking: false,
      loomConfig: { baseUrl: 'http://127.0.0.1:4319/v1', apiKey: 'hub.chat-key', model: 'kimi/k3.1-pro' },
      selectionText: 'MV3 Service Worker'
    });
    assert.equal(chat400Retry.engine, 'loom');
    assert.equal(chat400Retry.reasoning, '', 'enableThinking: false must suppress reasoning');
    assert.equal(chatCalls.length, 4, 'Expected HTTP 400 fastParams retry in chatWithAI');
    assert.equal(chatCalls[2].body.reasoning_effort, 'none');
    assert.ok(!Object.prototype.hasOwnProperty.call(chatCalls[3].body, 'reasoning_effort'));

    // Calls 4->5->6: Text-only model rejecting image_url with HTTP 400 automatically retries text-only + adds hint
    const textOnlyFallbackChat = await engineMod.chatWithAI({
      taskType: 'chat',
      targetLang: 'zh-CN',
      engine: 'loom',
      model: 'glm/glm-5-turbo',
      loomConfig: { baseUrl: 'http://127.0.0.1:4319/v1', apiKey: 'hub.chat-key', provider: 'glm', model: 'glm/glm-5-turbo' },
      prompt: 'Look at this chart',
      images: [{ dataUrl: TINY_PNG_DATA_URL }]
    });
    assert.equal(textOnlyFallbackChat.imageCount, 0);
    assert.ok(textOnlyFallbackChat.reply.includes('暂不支持图片输入'), 'Expected text-only fallback hint');
    assert.ok(Array.isArray(chatCalls[4].body.messages.at(-1).content), 'First GLM call included image_url');
    assert.equal(typeof chatCalls[chatCalls.length - 1].body.messages.at(-1).content, 'string', 'Retry GLM call stripped image_url to plain string');

    // OpenAI chatWithAI route + <think> tag extraction
    const openaiChat = await engineMod.chatWithAI({
      taskType: 'polish',
      targetLang: 'en',
      engine: 'openai',
      openaiConfig: { apiUrl: 'https://example.invalid/v1/chat/completions', apiKey: 'sk-chat', model: 'gpt-4o-mini' },
      prompt: 'hi team i want ask update'
    });
    assert.equal(openaiChat.engine, 'openai');
    assert.equal(openaiChat.model, 'gpt-4o-mini');
    assert.equal(openaiChat.reply, 'OpenAI 侧边栏回复');
    assert.equal(openaiChat.reasoning, 'OpenAI proxy internal reasoning');

    // OpenAI/Loom SSE streaming with incremental reasoning_content + content progress updates
    const sseProgressEvents = [];
    let streamedReqBody = null;
    globalThis.fetch = async (_url, init) => {
      streamedReqBody = JSON.parse(init.body);
      const chunks = [
        'data: {"choices":[{"delta":{"reasoning_content":"Step 1"}}]}\n\n',
        'data: {"choices":[{"delta":{"reasoning_content":"\\nStep 2","content":"Final "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"streamed summary"}}]}\n\n',
        'data: [DONE]\n\n'
      ];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        }
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      });
    };
    const streamedChat = await engineMod.chatWithAI({
      taskType: 'summarize_page',
      targetLang: 'zh-CN',
      engine: 'openai',
      openaiConfig: { apiUrl: 'https://example.invalid/v1/chat/completions', apiKey: 'sk-chat', model: 'kimi/k3.1-pro' },
      prompt: 'Summarize streamed',
      enableThinking: true,
      stream: true,
      onProgress: (prog) => sseProgressEvents.push(prog)
    });
    assert.equal(streamedReqBody?.stream, true, 'chatWithAI stream:true must forward stream:true in request body');
    assert.ok(
      sseProgressEvents.some((p) => p.reasoning === 'Step 1' && !p.reply),
      'chatWithAI SSE streaming must emit incremental reasoning progress before reply arrives'
    );
    assert.ok(
      sseProgressEvents.some((p) => p.reasoning === 'Step 1\nStep 2' && p.reply === 'Final '),
      'chatWithAI SSE streaming must emit accumulated reasoning and partial reply progress'
    );
    assert.equal(streamedChat.reasoning, 'Step 1\nStep 2');
    assert.equal(streamedChat.reply, 'Final streamed summary');

    // Free/offline fallback across all 12 task types without uncaught errors
    globalThis.fetch = async () => {
      throw new Error('Offline network blocked');
    };
    const allTasks = [
      'chat',
      'summarize_page',
      'key_takeaways',
      'page_qa',
      'explain',
      'summarize',
      'polish',
      'shorten',
      'expand',
      'grammar',
      'translate_en',
      'translate_zh'
    ];
    for (const taskType of allTasks) {
      const fb = await engineMod.chatWithAI({
        taskType,
        targetLang: 'zh-CN',
        engine: 'google-free',
        prompt: 'Browser extensions use Manifest V3 architecture. Service workers handle background events.',
        selectionText: 'Manifest V3',
        pageContext: { title: 'MV3 Guide', url: 'https://example.test/mv3', content: 'Sentence one. Sentence two.' }
      });
      assert.equal(fb.engine, 'google-free');
      assert.equal(fb.model, 'google-free');
      assert.equal(fb.fallback, true);
      assert.ok(typeof fb.reply === 'string' && fb.reply.trim().length > 0, `Empty fallback reply for ${taskType}`);
    }

    // 5i. Codex Subscription Engine Unit Tests (Device Auth / Token Refresh / SSE / Batch / AI_CHAT)
    clearCache();
    assert.equal(typeof engineMod.refreshCodexToken, 'function', 'refreshCodexToken export missing');
    assert.equal(typeof engineMod.startCodexDeviceAuth, 'function', 'startCodexDeviceAuth export missing');
    assert.equal(typeof engineMod.pollCodexDeviceAuthOnce, 'function', 'pollCodexDeviceAuthOnce export missing');
    assert.equal(typeof engineMod.translateWithCodex, 'function', 'translateWithCodex export missing');

    const codexOldJwt = makeSyntheticCodexJwt({
      accountId: 'acct_codex_001',
      planType: 'pro',
      email: 'codex-user@example.test',
      expSeconds: Math.floor(Date.now() / 1000) + 60 // < 3 min triggers proactive refresh
    });
    const codexFreshJwt = makeSyntheticCodexJwt({
      accountId: 'acct_codex_001',
      planType: 'pro',
      email: 'codex-user@example.test',
      expSeconds: Math.floor(Date.now() / 1000) + 7200
    });
    const codexThirdJwt = makeSyntheticCodexJwt({
      accountId: 'acct_codex_001',
      planType: 'pro',
      email: 'codex-user@example.test',
      expSeconds: Math.floor(Date.now() / 1000) + 10800
    });

    const codexFetchCalls = [];
    let pollAttempt = 0;
    let simulateUnauthorizedOnce = false;
    let codexSseReply = '你好，Codex SSE！';
    let codexSseReasoning = '';

    globalThis.fetch = async (url, init = {}) => {
      const urlStr = String(url);
      codexFetchCalls.push({ url: urlStr, headers: init.headers || {}, body: init.body });

      if (urlStr === 'https://auth.openai.com/api/accounts/deviceauth/usercode') {
        const parsed = JSON.parse(init.body || '{}');
        assert.equal(parsed.client_id, 'app_EMoamEEZ73f0CkXaXp7hrann');
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ device_auth_id: 'dev_auth_123', user_code: 'ABCD-EFGH', interval: 5 }),
          json: async () => ({ device_auth_id: 'dev_auth_123', user_code: 'ABCD-EFGH', interval: 5 })
        };
      }
      if (urlStr === 'https://auth.openai.com/api/accounts/deviceauth/token') {
        pollAttempt += 1;
        if (pollAttempt === 1) {
          return {
            ok: false,
            status: 403,
            text: async () => JSON.stringify({ error: { code: 'deviceauth_authorization_pending' } }),
            json: async () => ({ error: { code: 'deviceauth_authorization_pending' } })
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ authorization_code: 'auth_code_999', code_verifier: 'verifier_xyz' }),
          json: async () => ({ authorization_code: 'auth_code_999', code_verifier: 'verifier_xyz' })
        };
      }
      if (urlStr === 'https://auth.openai.com/oauth/token') {
        const params = new URLSearchParams(String(init.body || ''));
        const grant = params.get('grant_type');
        const nextTok = grant === 'authorization_code' ? codexFreshJwt : codexThirdJwt;
        const nextRt = grant === 'authorization_code' ? 'rt_from_device' : 'rt_rotated';
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: nextTok, refresh_token: nextRt, expires_in: 7200 }),
          json: async () => ({ access_token: nextTok, refresh_token: nextRt, expires_in: 7200 })
        };
      }
      if (urlStr === 'https://chatgpt.com/backend-api/codex/responses') {
        if (simulateUnauthorizedOnce) {
          simulateUnauthorizedOnce = false;
          return { ok: false, status: 401, text: async () => 'Unauthorized' };
        }
        const sseEvents = [
          'event: response.created',
          'data: {"type":"response.created"}',
          ''
        ];
        if (codexSseReasoning) {
          sseEvents.push(
            `data: ${JSON.stringify({ type: 'response.reasoning_summary_text.delta', delta: codexSseReasoning })}`,
            ''
          );
        }
        sseEvents.push(
          `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: codexSseReply.slice(0, 4) })}`,
          '',
          `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: codexSseReply.slice(4) })}`,
          '',
          'data: {"type":"response.completed"}',
          ''
        );
        const sseText = sseEvents.join('\n');
        return {
          ok: true,
          status: 200,
          text: async () => sseText
        };
      }
      throw new Error(`Unexpected Codex test URL: ${urlStr}`);
    };

    const devStart = await engineMod.startCodexDeviceAuth();
    assert.equal(devStart.deviceAuthId, 'dev_auth_123');
    assert.equal(devStart.userCode, 'ABCD-EFGH');
    assert.equal(devStart.verificationUrl, 'https://auth.openai.com/codex/device');

    const poll1 = await engineMod.pollCodexDeviceAuthOnce(devStart.deviceAuthId, devStart.userCode);
    assert.equal(poll1.status, 'pending');
    const poll2 = await engineMod.pollCodexDeviceAuthOnce(devStart.deviceAuthId, devStart.userCode);
    assert.equal(poll2.status, 'complete');
    assert.equal(poll2.credential.accessToken, codexFreshJwt);
    assert.equal(poll2.credential.accountId, 'acct_codex_001');

    // Proactive (< 3 min) token refresh & SSE delta concatenation
    const refreshedCallbacks = [];
    const nearExpiryRes = await engineMod.translateWithCodex(
      'Hello Codex SSE',
      'en',
      'zh-CN',
      {
        baseUrl: 'https://chatgpt.com/backend-api',
        model: 'gpt-5.6-luna',
        reasoningEffort: 'low',
        accessToken: codexOldJwt,
        refreshToken: 'rt_old_1',
        accountId: 'acct_codex_001',
        expiresAt: Date.now() + 60 * 1000
      },
      {
        onTokenRefreshed: (nextCred) => refreshedCallbacks.push(nextCred)
      }
    );
    assert.equal(nearExpiryRes.translatedText, '你好，Codex SSE！');
    assert.equal(nearExpiryRes.engine, 'codex');
    assert.equal(refreshedCallbacks.length, 1, 'Near-expiry token must refresh and notify onTokenRefreshed');
    assert.equal(refreshedCallbacks[0].accessToken, codexThirdJwt);

    const lastResponsesCall = codexFetchCalls.filter((c) => c.url.endsWith('/codex/responses')).pop();
    assert.equal(lastResponsesCall.headers['chatgpt-account-id'], 'acct_codex_001');
    assert.equal(lastResponsesCall.headers['OpenAI-Beta'], 'responses=experimental');
    assert.equal(lastResponsesCall.headers.originator, 'pi');
    assert.equal(lastResponsesCall.headers.accept, 'text/event-stream');
    const parsedCodexBody = JSON.parse(lastResponsesCall.body);
    assert.equal(parsedCodexBody.model, 'gpt-5.6-luna');
    assert.equal(parsedCodexBody.store, false);
    assert.equal(parsedCodexBody.stream, true);

    // 401 unauthorized response triggers refresh & single retry
    simulateUnauthorizedOnce = true;
    const retryCallbacks = [];
    codexSseReply = '401 重试成功';
    const retryRes = await engineMod.translateWithCodex(
      'Retry 401',
      'en',
      'zh-CN',
      {
        baseUrl: 'https://chatgpt.com/backend-api',
        model: 'gpt-5.6-luna',
        accessToken: codexFreshJwt,
        refreshToken: 'rt_valid_2',
        accountId: 'acct_codex_001',
        expiresAt: Date.now() + 7200 * 1000
      },
      {
        onTokenRefreshed: (nextCred) => retryCallbacks.push(nextCred)
      }
    );
    assert.equal(retryRes.translatedText, '401 重试成功');
    assert.equal(retryCallbacks.length, 1, 'HTTP 401 must trigger refreshCodexToken & onTokenRefreshed');

    // translateBatch & chatWithAI with engine: 'codex'
    clearCache();
    codexSseReply = '批一\n||||\n批二';
    const codexBatch = await engineMod.translateBatch(['One', 'Two'], {
      engine: 'codex',
      targetLang: 'zh-CN',
      codexConfig: {
        accessToken: codexFreshJwt,
        refreshToken: 'rt_valid_2',
        accountId: 'acct_codex_001',
        expiresAt: Date.now() + 7200 * 1000
      }
    });
    assert.deepEqual(codexBatch.translations, ['批一', '批二']);
    assert.equal(codexBatch.engine, 'codex');

    codexSseReply = 'Codex 多轮回复';
    codexSseReasoning = 'Codex reasoning summary delta.';
    const codexChat = await engineMod.chatWithAI({
      engine: 'codex',
      targetLang: 'zh-CN',
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: 'Explain Codex with image' }
      ],
      images: [{ dataUrl: TINY_PNG_DATA_URL }],
      codexConfig: {
        model: 'gpt-6-luna',
        accessToken: codexFreshJwt,
        refreshToken: 'rt_valid_2',
        accountId: 'acct_codex_001',
        expiresAt: Date.now() + 7200 * 1000
      }
    });
    assert.equal(codexChat.engine, 'codex');
    assert.equal(codexChat.model, 'gpt-6-luna');
    assert.equal(codexChat.reply, 'Codex 多轮回复');
    assert.equal(codexChat.reasoning, 'Codex reasoning summary delta.');
    assert.equal(codexChat.imageCount, 1);
    const lastCodexChatBody = JSON.parse(codexFetchCalls[codexFetchCalls.length - 1].body);
    assert.ok(
      lastCodexChatBody.input.some(
        (item) => Array.isArray(item.content) && item.content.some((p) => p.type === 'input_image' && p.image_url === TINY_PNG_DATA_URL)
      ),
      'Codex multimodal chat must include input_image item'
    );
    codexSseReasoning = '';

    // service-worker.js AI_CHAT message handler merging stored settings
    const swCalls = [];
    globalThis.fetch = async (url, init = {}) => {
      swCalls.push({ url: String(url), headers: init.headers || {}, body: JSON.parse(init.body || '{}') });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: 'ServiceWorker AI 回复' } }] }),
        json: async () => ({ choices: [{ message: { content: 'ServiceWorker AI 回复' } }] })
      };
    };

    const prevChrome = globalThis.chrome;
    const swStore = {
      wt_settings: {
        engine: 'loom',
        targetLang: 'zh-CN',
        loomConfig: {
          baseUrl: 'http://127.0.0.1:4319/v1',
          apiKey: 'hub.sw-secret',
          provider: 'glm',
          model: 'glm/glm-5-turbo'
        }
      }
    };
    let onInstalledListener = null;
    let menuClickedListener = null;
    let commandListener = null;
    const sidePanelOpenCalls = [];
    const setPanelBehaviorCalls = [];
    let tabsSendImpl = async () => ({ ok: true });
    const tabsSendCalls = [];

    globalThis.chrome = {
      storage: {
        sync: {
          get: (_k, cb) => {
            const out = { wt_settings: swStore.wt_settings };
            if (typeof cb === 'function') cb(out);
            return Promise.resolve(out);
          },
          set: (items, cb) => {
            Object.assign(swStore, items);
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          }
        },
        local: {
          get: (_k, cb) => {
            if (typeof cb === 'function') cb({});
            return Promise.resolve({});
          },
          set: (_items, cb) => {
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          }
        }
      },
      runtime: {
        onInstalled: { addListener: (fn) => { onInstalledListener = fn; } },
        onStartup: { addListener: () => {} },
        onMessage: { addListener: () => {} }
      },
      contextMenus: {
        onClicked: { addListener: (fn) => { menuClickedListener = fn; } },
        removeAll: (cb) => cb && cb(),
        create: () => {}
      },
      commands: { onCommand: { addListener: (fn) => { commandListener = fn; } } },
      sidePanel: {
        open: (opts) => {
          sidePanelOpenCalls.push(opts);
          return Promise.resolve();
        },
        setPanelBehavior: (opts) => {
          setPanelBehaviorCalls.push(opts);
          return Promise.resolve();
        }
      },
      tabs: {
        query: async () => [],
        sendMessage: (tabId, message) => {
          tabsSendCalls.push({ tabId, message });
          return tabsSendImpl(tabId, message);
        }
      }
    };
    try {
      const swUrl = pathToFileURL(path.join(ROOT_DIR, 'src/background/service-worker.js')).href;
      const swMod = await import(swUrl);
      const swResp = await swMod.handleBackgroundMessage({
        type: 'AI_CHAT',
        payload: { taskType: 'explain', prompt: 'Explain MV3' }
      });
      assert.equal(swResp?.ok, true, 'service-worker AI_CHAT must return ok: true');
      assert.equal(swResp.data?.reply, 'ServiceWorker AI 回复');
      assert.equal(swResp.data?.model, 'glm/glm-5-turbo');
      assert.equal(swCalls[0].headers.Authorization, 'Bearer hub.sw-secret');
      assert.equal(swCalls[0].body.thinking, undefined, 'Default SW AI_CHAT must enable thinking (not disabled)');

      const swFastResp = await swMod.handleBackgroundMessage({
        type: 'AI_CHAT',
        payload: {
          taskType: 'explain',
          prompt: 'Fast mode',
          enableThinking: false,
          images: [{ dataUrl: TINY_PNG_DATA_URL }]
        }
      });
      assert.equal(swFastResp?.ok, true);
      assert.deepEqual(swCalls[1].body.thinking, { type: 'disabled' }, 'enableThinking: false must disable thinking on GLM');
      assert.ok(Array.isArray(swCalls[1].body.messages.at(-1).content), 'SW AI_CHAT must forward payload.images');

      const prevSwFetch = globalThis.fetch;
      const prevSwTabsSend = globalThis.chrome.tabs.sendMessage;
      const swStreamTabMsgs = [];
      globalThis.chrome.tabs.sendMessage = async (tabId, message) => {
        swStreamTabMsgs.push({ tabId, message });
        return { ok: true };
      };
      globalThis.fetch = async (url, init) => {
        if (String(url).includes('/v1/chat/completions') || String(url).includes('/chat/completions')) {
          const bodyObj = init?.body ? JSON.parse(init.body) : {};
          assert.equal(bodyObj.stream, true, 'SW AI_CHAT with streamId must request stream: true');
          const sseText = [
            'data: {"choices":[{"delta":{"reasoning_content":"SW Step 1"}}]}\n\n',
            'data: {"choices":[{"delta":{"reasoning_content":" -> Step 2","content":"SW Final Reply"}}]}\n\n',
            'data: [DONE]\n\n'
          ].join('');
          return new Response(sseText, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' }
          });
        }
        return prevSwFetch(url, init);
      };
      try {
        const swStreamResp = await swMod.handleBackgroundMessage(
          {
            type: 'AI_CHAT',
            payload: {
              taskType: 'summarize_page',
              prompt: 'Sum',
              enableThinking: true,
              streamId: 'test-stream-1'
            }
          },
          { tab: { id: 88 } }
        );
        assert.equal(swStreamResp?.ok, true);
        assert.equal(swStreamResp?.data?.reasoning, 'SW Step 1 -> Step 2');
        assert.equal(swStreamResp?.data?.reply, 'SW Final Reply');
        assert.ok(
          swStreamTabMsgs.some(
            (m) =>
              m.tabId === 88 &&
              m.message?.type === 'SIDEBAR_ACTION' &&
              m.message?.payload?.action === 'stream_progress' &&
              m.message?.payload?.streamId === 'test-stream-1' &&
              String(m.message?.payload?.reasoning || '').includes('SW Step 1')
          ),
          'SW AI_CHAT with streamId must push live SIDEBAR_ACTION stream_progress to sender.tab.id'
        );
      } finally {
        globalThis.fetch = prevSwFetch;
        globalThis.chrome.tabs.sendMessage = prevSwTabsSend;
      }

      // Round 6: isInjectableTabUrl & native Side Panel user-gesture preservation
      assert.equal(typeof swMod.isInjectableTabUrl, 'function', 'service-worker must export isInjectableTabUrl');
      for (const okUrl of ['https://example.com/a', 'http://127.0.0.1:4319/demo', 'file:///Users/test/a.html']) {
        assert.equal(swMod.isInjectableTabUrl(okUrl), true, `Expected injectable URL: ${okUrl}`);
      }
      for (const badUrl of [
        'chrome://extensions/',
        'edge://settings/',
        'about:blank',
        'chrome-extension://abc/popup.html',
        'moz-extension://def/popup.html',
        'https://chromewebstore.google.com/detail/xyz',
        'https://chrome.google.com/webstore/detail/xyz',
        ''
      ]) {
        assert.equal(swMod.isInjectableTabUrl(badUrl), false, `Expected restricted URL: ${badUrl}`);
      }

      if (onInstalledListener) onInstalledListener({ reason: 'install' });
      assert.equal(setPanelBehaviorCalls.length, 0, 'service-worker must not hijack default popup via setPanelBehavior');

      assert.ok(typeof commandListener === 'function', 'service-worker must register commands.onCommand');
      // Restricted URL: chrome.sidePanel.open MUST fire synchronously BEFORE any await without calling tabs.sendMessage
      const restrictedCmdPromise = commandListener('toggle-ai-sidebar', { id: 42, windowId: 7, url: 'chrome://extensions/' });
      assert.equal(sidePanelOpenCalls.length, 1, 'Alt+S on chrome:// must invoke chrome.sidePanel.open synchronously');
      assert.deepEqual(sidePanelOpenCalls[0], { windowId: 7 });
      assert.equal(tabsSendCalls.length, 0, 'Alt+S on chrome:// must not await tabs.sendMessage before sidePanel.open');
      await restrictedCmdPromise;

      // Injectable URL success -> sends SIDEBAR_TOGGLE without opening native sidePanel
      await commandListener('toggle-ai-sidebar', { id: 43, windowId: 8, url: 'https://example.com/article' });
      assert.equal(tabsSendCalls.length, 1);
      assert.equal(tabsSendCalls[0].message.type, 'SIDEBAR_TOGGLE');
      assert.equal(sidePanelOpenCalls.length, 1, 'Successful SIDEBAR_TOGGLE must not also open native sidePanel');

      // Injectable URL where content script is unreachable -> falls back to native sidePanel
      tabsSendImpl = async () => null;
      await commandListener('toggle-ai-sidebar', { id: 44, windowId: 9, url: 'https://example.com/unreachable' });
      assert.equal(sidePanelOpenCalls.length, 2, 'Unreachable content tab must fall back to chrome.sidePanel.open');
      assert.deepEqual(sidePanelOpenCalls[1], { windowId: 9 });

      // Context menu wt-summarize-page on restricted URL -> immediate sidePanel.open
      assert.ok(typeof menuClickedListener === 'function', 'service-worker must register contextMenus.onClicked');
      await menuClickedListener({ menuItemId: 'wt-summarize-page' }, { id: 45, windowId: 11, url: 'chrome://settings/' });
      assert.equal(sidePanelOpenCalls.length, 3);
      assert.deepEqual(sidePanelOpenCalls[2], { windowId: 11 });

      // Round 8: Context menu wt-context-analyze-image forwards analyze_image + srcUrl to active tab
      tabsSendImpl = async () => ({ ok: true });
      await menuClickedListener(
        { menuItemId: 'wt-context-analyze-image', srcUrl: 'https://example.com/forum-chart.png' },
        { id: 46, windowId: 12, url: 'https://example.com/post' }
      );
      const imgMenuCall = tabsSendCalls[tabsSendCalls.length - 1];
      assert.equal(imgMenuCall?.message?.type, 'SIDEBAR_ACTION');
      assert.equal(imgMenuCall?.message?.payload?.action, 'analyze_image');
      assert.equal(imgMenuCall?.message?.payload?.imageUrl, 'https://example.com/forum-chart.png');

      // Round 7: service-worker TEST_ENGINE codex_device_start / codex_device_poll + AI_CHAT token refresh persistence
      pollAttempt = 1; // Next poll hits 200 authorization_code -> token exchange
      globalThis.fetch = async (url, init = {}) => {
        const urlStr = String(url);
        if (urlStr === 'https://auth.openai.com/api/accounts/deviceauth/usercode') {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ device_auth_id: 'sw_dev_01', user_code: 'SWCO-DEX1', interval: 5 }),
            json: async () => ({ device_auth_id: 'sw_dev_01', user_code: 'SWCO-DEX1', interval: 5 })
          };
        }
        if (urlStr === 'https://auth.openai.com/api/accounts/deviceauth/token') {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ authorization_code: 'sw_auth_code', code_verifier: 'sw_verifier' }),
            json: async () => ({ authorization_code: 'sw_auth_code', code_verifier: 'sw_verifier' })
          };
        }
        if (urlStr === 'https://auth.openai.com/oauth/token') {
          const p = new URLSearchParams(String(init.body || ''));
          const tok = p.get('grant_type') === 'refresh_token' ? codexThirdJwt : codexFreshJwt;
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ access_token: tok, refresh_token: 'rt_sw_persisted', expires_in: 7200 }),
            json: async () => ({ access_token: tok, refresh_token: 'rt_sw_persisted', expires_in: 7200 })
          };
        }
        if (urlStr === 'https://chatgpt.com/backend-api/codex/responses') {
          return {
            ok: true,
            status: 200,
            text: async () => 'data: {"type":"response.output_text.delta","delta":"SW Codex 响应"}\n\ndata: {"type":"response.completed"}\n'
          };
        }
        throw new Error(`Unexpected SW Codex fetch: ${urlStr}`);
      };

      const swDevStart = await swMod.handleBackgroundMessage({
        type: 'TEST_ENGINE',
        payload: { action: 'codex_device_start' }
      });
      assert.equal(swDevStart?.ok, true);
      assert.equal(swDevStart.data?.userCode, 'SWCO-DEX1');

      const swDevPoll = await swMod.handleBackgroundMessage({
        type: 'TEST_ENGINE',
        payload: { action: 'codex_device_poll', deviceAuthId: 'sw_dev_01', userCode: 'SWCO-DEX1' }
      });
      assert.equal(swDevPoll?.ok, true);
      assert.equal(swDevPoll.data?.status, 'complete');
      assert.equal(swStore.wt_settings.codexConfig?.accessToken, codexFreshJwt, 'codex_device_poll must persist codexConfig');
      assert.equal(swStore.wt_settings.codexConfig?.accountId, 'acct_codex_001');

      // Expiring token in AI_CHAT triggers refresh & updates persisted swStore.wt_settings.codexConfig
      swStore.wt_settings.engine = 'codex';
      swStore.wt_settings.codexConfig = {
        ...swStore.wt_settings.codexConfig,
        accessToken: codexOldJwt,
        refreshToken: 'rt_sw_old',
        expiresAt: Date.now() + 60 * 1000
      };
      const swCodexChat = await swMod.handleBackgroundMessage({
        type: 'AI_CHAT',
        payload: { taskType: 'explain', prompt: 'Explain Codex' }
      });
      assert.equal(swCodexChat?.ok, true);
      assert.equal(swCodexChat.data?.engine, 'codex');
      assert.equal(swCodexChat.data?.reply, 'SW Codex 响应');
      assert.equal(swStore.wt_settings.codexConfig?.accessToken, codexThirdJwt, 'AI_CHAT refresh must persist fresh token');

      // SW GET_HISTORY / CLEAR_HISTORY (kind: 'chat_sessions') save, query, delete & clear
      const swSessSave = await swMod.handleBackgroundMessage({
        type: 'GET_HISTORY',
        payload: {
          kind: 'chat_sessions',
          action: 'save',
          session: {
            pageUrl: 'https://example.org/handbook',
            pageTitle: 'Engineering Handbook',
            messages: [
              { role: 'user', content: 'Summarize deploy cadence' },
              { role: 'assistant', content: 'Services release twice weekly via canary rollouts.' }
            ]
          }
        }
      });
      assert.equal(swSessSave?.ok, true);
      assert.equal(swSessSave?.kind, 'chat_sessions');
      assert.equal(swSessSave?.data?.length, 1);

      const swSessSearch = await swMod.handleBackgroundMessage({
        type: 'GET_HISTORY',
        payload: { kind: 'chat_sessions', query: 'canary rollouts' }
      });
      assert.equal(swSessSearch?.ok, true);
      assert.equal(swSessSearch?.kind, 'chat_sessions');
      assert.equal(swSessSearch?.data?.length, 1);
      assert.equal(swSessSearch?.data?.[0]?.pageTitle, 'Engineering Handbook');

      const swSessDelete = await swMod.handleBackgroundMessage({
        type: 'GET_HISTORY',
        payload: { kind: 'chat_sessions', action: 'delete', sessionId: swSessSave.session.id }
      });
      assert.equal(swSessDelete?.ok, true);
      assert.equal(swSessDelete?.data?.length, 0);

      const swSessClear = await swMod.handleBackgroundMessage({
        type: 'CLEAR_HISTORY',
        payload: { kind: 'chat_sessions' }
      });
      assert.equal(swSessClear?.ok, true);
      assert.deepEqual(swSessClear?.data, []);
    } finally {
      if (prevChrome === undefined) {
        delete globalThis.chrome;
      } else {
        globalThis.chrome = prevChrome;
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    clearCache();
  }

  return 'Google, Batch/Dedup, MyMemory, OpenAI, Loom (+400/403), Codex (+Device/Refresh/SSE), chatWithAI & SW AI_CHAT/sidePanel passed';
});

// ============================================================================
// 6. Cross-File Message Contract Check (All 17 Contract Messages)
// ============================================================================
await runCheck('6. Cross-File Message Contract Check (17 Contract Messages)', () => {
  const BACKGROUND_MSGS = [
    'TRANSLATE_TEXT',
    'TRANSLATE_BATCH',
    'GET_SETTINGS',
    'SAVE_SETTINGS',
    'GET_HISTORY',
    'CLEAR_HISTORY',
    'TEST_ENGINE',
    'FETCH_LOOM_MODELS',
    'AI_CHAT'
  ];
  const CONTENT_MSGS = [
    'PAGE_TRANSLATE_START',
    'PAGE_TRANSLATE_RESTORE',
    'PAGE_TRANSLATE_TOGGLE',
    'PAGE_SET_MODE',
    'PAGE_GET_STATUS',
    'SHOW_SELECTION_TRANSLATION',
    'SIDEBAR_TOGGLE',
    'SIDEBAR_ACTION'
  ];
  const ALL_17 = [...BACKGROUND_MSGS, ...CONTENT_MSGS];

  const configText = readText('src/shared/config.js');
  const swText = readText('src/background/service-worker.js');
  const contentIndexText = readText('src/content/index.js');
  const contentAllText = [
    readText('src/content/dom-translator.js'),
    readText('src/content/selection-ui.js'),
    contentIndexText
  ].join('\n');
  const popupText = readText('src/popup/popup.js');
  const optionsText = readText('src/options/options.js');

  for (const msg of ALL_17) {
    assert.ok(configText.includes(msg), `src/shared/config.js missing message constant ${msg}`);
  }
  for (const msg of BACKGROUND_MSGS) {
    assert.ok(swText.includes(msg), `service-worker.js missing handler for ${msg}`);
  }
  for (const msg of CONTENT_MSGS) {
    assert.ok(contentIndexText.includes(msg), `content/index.js missing handler for ${msg}`);
  }
  assert.ok(swText.includes('SIDEBAR_TOGGLE') && swText.includes('SIDEBAR_ACTION'), 'service-worker.js missing sidebar command/menu dispatch');

  const contentRequiredOutbound = ['TRANSLATE_TEXT', 'TRANSLATE_BATCH', 'GET_SETTINGS', 'SAVE_SETTINGS', 'AI_CHAT'];
  for (const msg of contentRequiredOutbound) {
    assert.ok(contentAllText.includes(msg), `src/content/* missing outbound call ${msg}`);
  }

  const popupRequired = [
    'TRANSLATE_TEXT',
    'GET_SETTINGS',
    'SAVE_SETTINGS',
    'GET_HISTORY',
    'CLEAR_HISTORY',
    'FETCH_LOOM_MODELS',
    'PAGE_TRANSLATE_START',
    'PAGE_TRANSLATE_RESTORE',
    'PAGE_SET_MODE',
    'PAGE_GET_STATUS',
    'SIDEBAR_TOGGLE',
    'SIDEBAR_ACTION'
  ];
  for (const msg of popupRequired) {
    assert.ok(popupText.includes(msg), `popup.js missing message ${msg}`);
  }

  const optionsRequired = ['GET_SETTINGS', 'SAVE_SETTINGS', 'TEST_ENGINE', 'FETCH_LOOM_MODELS'];
  for (const msg of optionsRequired) {
    assert.ok(optionsText.includes(msg), `options.js missing message ${msg}`);
  }

  return 'All 17 contract message types verified across config, background, content, popup & options';
});

// ============================================================================
// 7. DOM `replace` Mode In-Place TextNode Test (Node VM DOM Mock)
// ============================================================================
await runCheck('7. DOM replace Mode In-Place TextNode Replacement', async () => {
  function matchesSimpleSelector(el, sel) {
    const s = sel.trim();
    if (!s || el.nodeType !== 1) return false;
    if (s.startsWith('.')) return el.classList.contains(s.slice(1));
    if (s.startsWith('#')) return el.getAttribute('id') === s.slice(1);
    const attrEq = s.match(/^\[([A-Za-z0-9_-]+)="([^"]*)"\]$/);
    if (attrEq) return el.getAttribute(attrEq[1]) === attrEq[2];
    const attrPlain = s.match(/^\[([A-Za-z0-9_-]+)\]$/);
    if (attrPlain) return el.hasAttribute(attrPlain[1]);
    return el.tagName.toLowerCase() === s.toLowerCase();
  }

  function createDomEnvironment() {
    class MockClassList {
      constructor(el) {
        this.el = el;
        this.set = new Set();
      }
      add(...names) {
        for (const n of names) if (n) this.set.add(n);
        this.el._attributes.set('class', Array.from(this.set).join(' '));
      }
      remove(...names) {
        for (const n of names) this.set.delete(n);
        this.el._attributes.set('class', Array.from(this.set).join(' '));
      }
      toggle(name, force) {
        const shouldAdd = typeof force === 'boolean' ? force : !this.set.has(name);
        if (shouldAdd) {
          this.add(name);
        } else {
          this.remove(name);
        }
        return shouldAdd;
      }
      contains(name) {
        return this.set.has(name);
      }
    }

    class MockTextNode {
      constructor(value) {
        this.nodeType = 3;
        this.nodeValue = String(value);
        this.parentElement = null;
      }
      get parentNode() {
        return this.parentElement;
      }
      get textContent() {
        return this.nodeValue;
      }
      set textContent(v) {
        this.nodeValue = String(v);
      }
      get isConnected() {
        let cur = this.parentElement;
        while (cur) {
          if (cur === doc.documentElement) return true;
          cur = cur.parentElement;
        }
        return false;
      }
    }

    class MockElement {
      constructor(tagName) {
        this.nodeType = 1;
        this.tagName = String(tagName).toUpperCase();
        this.childNodes = [];
        this.parentElement = null;
        this.hidden = false;
        this.disabled = false;
        this.checked = false;
        this.type = '';
        this.placeholder = '';
        this.rows = 2;
        this.selectedIndex = 0;
        this.selected = false;
        this.scrollTop = 0;
        this.scrollHeight = 100;
        this.style = {};
        this._value = undefined;
        this._innerHtml = '';
        this._listeners = new Map();
        this._attributes = new Map();
        this.classList = new MockClassList(this);
        this.dataset = new Proxy({}, {
          get: (_t, prop) => {
            const attr = 'data-' + String(prop).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
            return this.getAttribute(attr) ?? undefined;
          },
          set: (_t, prop, val) => {
            const attr = 'data-' + String(prop).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
            this.setAttribute(attr, val);
            return true;
          }
        });
      }
      get id() {
        return this._attributes.get('id') || '';
      }
      set id(v) {
        this.setAttribute('id', String(v));
      }
      get className() {
        return this._attributes.get('class') || '';
      }
      set className(v) {
        this.setAttribute('class', String(v));
      }
      get parentNode() {
        return this.parentElement;
      }
      get children() {
        return this.childNodes.filter((c) => c.nodeType === 1);
      }
      get nextSibling() {
        if (!this.parentElement) return null;
        const list = this.parentElement.childNodes;
        const idx = list.indexOf(this);
        return idx >= 0 && idx + 1 < list.length ? list[idx + 1] : null;
      }
      get options() {
        return this.querySelectorAll('option');
      }
      get selectedOptions() {
        const opts = this.options;
        const explicit = opts.filter((o) => o.selected);
        if (explicit.length > 0) return explicit;
        return opts[this.selectedIndex] ? [opts[this.selectedIndex]] : [];
      }
      get value() {
        if (this._value !== undefined) return this._value;
        if (this.tagName === 'SELECT') {
          const sel = this.selectedOptions[0];
          return sel ? sel.value : '';
        }
        if (this._attributes.has('value')) return this._attributes.get('value');
        if (this.tagName === 'OPTION') return this.textContent;
        return '';
      }
      set value(v) {
        this._value = String(v);
        if (this.tagName === 'SELECT') {
          const opts = this.options;
          opts.forEach((o, i) => {
            o.selected = o.value === this._value;
            if (o.selected) this.selectedIndex = i;
          });
        }
      }
      get isConnected() {
        if (this === doc.documentElement) return true;
        let cur = this.parentElement;
        while (cur) {
          if (cur === doc.documentElement) return true;
          cur = cur.parentElement;
        }
        return false;
      }
      get textContent() {
        return this.childNodes.map((c) => c.textContent).join('');
      }
      set textContent(v) {
        this.childNodes = [];
        if (v !== undefined && v !== null && String(v) !== '') {
          this.appendChild(new MockTextNode(v));
        }
      }
      get innerHTML() {
        return this._innerHtml;
      }
      set innerHTML(v) {
        this._innerHtml = String(v || '');
        this.childNodes = [];
        if (this._innerHtml) {
          const stripped = this._innerHtml.replace(/<[^>]+>/g, '').trim();
          if (stripped) this.appendChild(new MockTextNode(stripped));
        }
      }
      setAttribute(k, v) {
        const key = String(k);
        const val = String(v);
        this._attributes.set(key, val);
        if (key === 'class') {
          this.classList.set = new Set(val.split(/\s+/).filter(Boolean));
        }
      }
      getAttribute(k) {
        return this._attributes.has(k) ? this._attributes.get(k) : null;
      }
      hasAttribute(k) {
        return this._attributes.has(k);
      }
      removeAttribute(k) {
        this._attributes.delete(k);
        if (k === 'class') this.classList.set.clear();
      }
      appendChild(node) {
        if (node && node.nodeType === 11) {
          const children = [...node.childNodes];
          for (const child of children) {
            this.appendChild(child);
          }
          return node;
        }
        if (node.parentElement) {
          const idx = node.parentElement.childNodes.indexOf(node);
          if (idx >= 0) node.parentElement.childNodes.splice(idx, 1);
        }
        node.parentElement = this;
        this.childNodes.push(node);
        return node;
      }
      insertBefore(newNode, refNode) {
        if (!refNode) return this.appendChild(newNode);
        if (newNode.parentElement) {
          const oldIdx = newNode.parentElement.childNodes.indexOf(newNode);
          if (oldIdx >= 0) newNode.parentElement.childNodes.splice(oldIdx, 1);
        }
        const idx = this.childNodes.indexOf(refNode);
        newNode.parentElement = this;
        if (idx >= 0) {
          this.childNodes.splice(idx, 0, newNode);
        } else {
          this.childNodes.push(newNode);
        }
        return newNode;
      }
      removeChild(node) {
        const idx = this.childNodes.indexOf(node);
        if (idx >= 0) {
          this.childNodes.splice(idx, 1);
          node.parentElement = null;
        }
        return node;
      }
      append(...nodes) {
        for (const n of nodes) {
          this.appendChild(typeof n === 'string' ? new MockTextNode(n) : n);
        }
      }
      remove() {
        if (this.parentElement) {
          const idx = this.parentElement.childNodes.indexOf(this);
          if (idx >= 0) this.parentElement.childNodes.splice(idx, 1);
          this.parentElement = null;
        }
      }
      addEventListener(type, fn) {
        if (!this._listeners.has(type)) this._listeners.set(type, new Set());
        this._listeners.get(type).add(fn);
      }
      removeEventListener(type, fn) {
        this._listeners.get(type)?.delete(fn);
      }
      dispatchEvent(evt) {
        const eventObj = Object.assign({ target: this, currentTarget: this, stopPropagation() {}, preventDefault() {} }, evt || {});
        let cur = this;
        while (cur) {
          eventObj.currentTarget = cur;
          for (const fn of cur._listeners.get(eventObj.type) || []) {
            fn(eventObj);
          }
          if (!eventObj.bubbles) break;
          cur = cur.parentElement;
        }
        if (eventObj.bubbles) {
          doc.dispatchEvent(eventObj);
        }
        return true;
      }
      focus() {
        doc.activeElement = this;
        this.dispatchEvent({ type: 'focusin', bubbles: true, target: this });
      }
      select() {}
      contains(target) {
        let cur = target;
        while (cur) {
          if (cur === this) return true;
          cur = cur.parentElement;
        }
        return false;
      }
      closest(selectorList) {
        const selectors = String(selectorList).split(',').map((s) => s.trim()).filter(Boolean);
        let cur = this;
        while (cur) {
          if (selectors.some((sel) => matchesSimpleSelector(cur, sel))) return cur;
          cur = cur.parentElement;
        }
        return null;
      }
      querySelectorAll(selectorList) {
        const selectors = String(selectorList).split(',').map((s) => s.trim()).filter(Boolean);
        const found = [];
        const visit = (node) => {
          for (const child of node.childNodes || []) {
            if (child.nodeType === 1) {
              if (selectors.some((sel) => matchesSimpleSelector(child, sel))) found.push(child);
              visit(child);
            }
          }
        };
        visit(this);
        return found;
      }
      querySelector(selectorList) {
        return this.querySelectorAll(selectorList)[0] || null;
      }
    }

    const listeners = new Map();
    const doc = {
      documentElement: null,
      body: null,
      readyState: 'complete',
      title: 'Gloss Demo',
      activeElement: null,
      createElement: (tag) => new MockElement(tag),
      createTextNode: (txt) => new MockTextNode(txt),
      createDocumentFragment: () => {
        const frag = new MockElement('#fragment');
        frag.nodeType = 11;
        return frag;
      },
      querySelectorAll: (sel) => doc.documentElement.querySelectorAll(sel),
      querySelector: (sel) => doc.documentElement.querySelector(sel),
      getElementById: (id) => doc.documentElement.querySelector(`#${id}`),
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener: (type, fn) => {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent: (evt) => {
        const eventObj = Object.assign({ target: doc.body, stopPropagation() {}, preventDefault() {} }, evt || {});
        for (const fn of listeners.get(eventObj.type) || []) {
          fn(eventObj);
        }
        return true;
      }
    };
    doc.documentElement = new MockElement('html');
    doc.body = new MockElement('body');
    doc.documentElement.appendChild(doc.body);
    return { doc, MockTextNode };
  }

  const { doc } = createDomEnvironment();

  const row = doc.createElement('div');
  row.setAttribute('class', 'timeline-row');
  const spanBullet = doc.createElement('span');
  const bulletText = doc.createTextNode('●');
  spanBullet.appendChild(bulletText);

  const spanDate = doc.createElement('span');
  const dateText = doc.createTextNode('Mar 12');
  spanDate.appendChild(dateText);

  const spanDesc = doc.createElement('span');
  const descText = doc.createTextNode('CLI copies the files');
  spanDesc.appendChild(descText);

  row.appendChild(spanBullet);
  row.appendChild(spanDate);
  row.appendChild(spanDesc);
  doc.body.appendChild(row);

  const pre = doc.createElement('pre');
  const code = doc.createElement('code');
  const jsxText = doc.createTextNode('<GraphTimeline title="SHIPPED">...</GraphTimeline>');
  code.appendChild(jsxText);
  pre.appendChild(code);
  doc.body.appendChild(pre);

  const protectedPara = doc.createElement('p');
  protectedPara.setAttribute('class', 'notranslate');
  const protectedText = doc.createTextNode('Protected raw text');
  protectedPara.appendChild(protectedText);
  doc.body.appendChild(protectedPara);

  function createDomTranslatorInVm(targetDoc, sendMessage, envOpts = {}) {
    const winListeners = new Map();
    const sandbox = {
      document: targetDoc,
      innerHeight: envOpts.innerHeight || 800,
      setTimeout,
      clearTimeout,
      console,
      getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
      addEventListener: (type, fn) => {
        if (!winListeners.has(type)) winListeners.set(type, new Set());
        winListeners.get(type).add(fn);
      },
      removeEventListener: (type, fn) => {
        winListeners.get(type)?.delete(fn);
      },
      chrome: {
        storage: {
          sync: { get: (_keys, cb) => cb && cb({}), set: (_items, cb) => cb && cb() },
          local: { get: (_keys, cb) => cb && cb({}), set: (_items, cb) => cb && cb() },
          onChanged: { addListener: () => {} }
        },
        runtime: { id: 'verify-ext', sendMessage: () => {} }
      }
    };
    if (envOpts.MutationObserver) {
      sandbox.MutationObserver = envOpts.MutationObserver;
    }
    if (envOpts.hooks) {
      envOpts.hooks.dispatchWindowEvent = (type, evt = {}) => {
        for (const fn of winListeners.get(type) || []) fn(evt);
      };
    }
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(readText('src/shared/config.js'), ctx, { filename: 'src/shared/config.js' });
    vm.runInContext(readText('src/content/dom-translator.js'), ctx, { filename: 'src/content/dom-translator.js' });
    return ctx.WTContent.createDOMTranslator({ sendMessage });
  }

  const batchRequests = [];
  const dict = {
    'Mar 12': '3月12日',
    'CLI copies the files': 'CLI 复制了文件'
  };

  const translator = createDomTranslatorInVm(doc, async (msg) => {
    if (msg.type === 'TRANSLATE_BATCH') {
      batchRequests.push(msg.payload.texts.slice());
      return {
        ok: true,
        data: {
          translations: msg.payload.texts.map((t) => dict[t] || `[zh] ${t}`)
        }
      };
    }
    return { ok: true, data: {} };
  });

  try {
    assert.equal(translator.getStatus().displayMode, 'replace', 'Default displayMode should be replace');
    await translator.translatePage({});

    const deadline = Date.now() + 1000;
    while (Date.now() < deadline) {
      const st = translator.getStatus();
      if (!st.isTranslating && st.translatedCount >= 2) break;
      await new Promise((r) => setTimeout(r, 20));
    }

    assert.equal(doc.querySelectorAll('.wt-translated-block').length, 0, 'replace mode must not inject .wt-translated-block');
    assert.equal(doc.querySelectorAll('.wt-replaced-text').length, 0, 'replace mode must not inject .wt-replaced-text');
    assert.equal(doc.querySelectorAll('.wt-original-wrap').length, 0, 'replace mode must not inject .wt-original-wrap');
    assert.equal(row.childNodes.length, 3, 'timeline-row structure must stay 3 spans');
    assert.equal(spanBullet.childNodes[0], bulletText);
    assert.equal(spanDate.childNodes[0], dateText);
    assert.equal(spanDesc.childNodes[0], descText);
    assert.equal(bulletText.nodeValue, '●', 'bullet symbol should stay untouched');
    assert.equal(dateText.nodeValue, '3月12日', 'date Text node should translate in place');
    assert.equal(descText.nodeValue, 'CLI 复制了文件', 'description Text node should translate in place');
    assert.equal(jsxText.nodeValue, '<GraphTimeline title="SHIPPED">...</GraphTimeline>', '<pre><code> JSX must stay untouched');
    assert.equal(protectedText.nodeValue, 'Protected raw text', '.notranslate must stay untouched');
    assert.ok(batchRequests.flat().includes('CLI copies the files'));
    assert.ok(!batchRequests.flat().some((t) => t.includes('GraphTimeline')));

    const statusAfterTranslate = translator.getStatus();
    assert.equal(typeof statusAfterTranslate.loadingCount, 'number');
    assert.equal(typeof statusAfterTranslate.errorCount, 'number');
    assert.ok('lastError' in statusAfterTranslate, 'getStatus() must expose lastError');
    assert.equal(statusAfterTranslate.loadingCount, 0);
    assert.equal(statusAfterTranslate.errorCount, 0);
    assert.equal(statusAfterTranslate.lastError, null);
    assert.equal(doc.documentElement.getAttribute('lang'), 'zh-CN', 'Document lang must match target language while translated');
    assert.equal(doc.documentElement.getAttribute('translate'), 'no', 'Translated page root must guard against external re-translation');
    assert.equal(doc.documentElement.classList.contains('notranslate'), true, 'Translated page root must carry notranslate');

    translator.restorePage();
    assert.equal(doc.documentElement.getAttribute('lang'), null, 'restorePage must restore document lang');
    assert.equal(doc.documentElement.getAttribute('translate'), null, 'restorePage must remove translate="no" guard');
    assert.equal(doc.documentElement.classList.contains('notranslate'), false, 'restorePage must remove notranslate class');
    assert.equal(dateText.nodeValue, 'Mar 12', 'restorePage must restore date Text node');
    assert.equal(descText.nodeValue, 'CLI copies the files', 'restorePage must restore desc Text node');
    assert.equal(translator.getStatus().isTranslated, false);
  } finally {
    translator.destroy();
  }

  // Verify all-batch failure resets isTranslated=false and populates errorCount & lastError
  const errEnv = createDomEnvironment();
  const errDoc = errEnv.doc;
  const errPara = errDoc.createElement('p');
  const errText1 = errDoc.createTextNode('First failing paragraph');
  errPara.appendChild(errText1);
  errDoc.body.appendChild(errPara);

  const errTranslator = createDomTranslatorInVm(errDoc, async (msg) => {
    if (msg.type === 'TRANSLATE_BATCH') {
      return {
        ok: false,
        error: 'Loom 网关拦截了浏览器扩展的 POST 请求 (403 LOCAL_CLIENTS_ONLY：Origin blocked)'
      };
    }
    return { ok: true, data: {} };
  });

  try {
    await errTranslator.translatePage({});
    const errDeadline = Date.now() + 1000;
    while (Date.now() < errDeadline) {
      const st = errTranslator.getStatus();
      if (!st.isTranslated && st.loadingCount === 0 && st.errorCount > 0) break;
      await new Promise((r) => setTimeout(r, 20));
    }

    const failStatus = errTranslator.getStatus();
    assert.equal(failStatus.isTranslated, false, 'When all batches fail, isTranslated must reset to false');
    assert.equal(failStatus.translatedCount, 0);
    assert.equal(failStatus.loadingCount, 0);
    assert.ok(failStatus.errorCount > 0, 'errorCount must be > 0 after failed batch');
    assert.ok(
      typeof failStatus.lastError === 'string' && failStatus.lastError.includes('LOCAL_CLIENTS_ONLY'),
      'lastError must preserve batch error message'
    );
    assert.equal(errText1.nodeValue, 'First failing paragraph', 'Failed translation must leave original Text node intact');
  } finally {
    errTranslator.destroy();
  }

  // Verify below-the-fold background pre-translation, scroll priority promotion & dynamic DOM incremental translation
  const dynEnv = createDomEnvironment();
  const dynDoc = dynEnv.doc;

  const heroEl = dynDoc.createElement('h1');
  heroEl.getBoundingClientRect = () => ({ top: 100, bottom: 130, width: 400, height: 30 });
  const heroText = dynDoc.createTextNode('Viewport hero');
  heroEl.appendChild(heroText);
  dynDoc.body.appendChild(heroEl);

  const belowTextNodes = [];
  for (let i = 0; i < 141; i += 1) {
    const p = dynDoc.createElement('p');
    p.getBoundingClientRect = () => ({ top: 2500 + i * 50, bottom: 2540 + i * 50, width: 400, height: 40 });
    const txt = dynDoc.createTextNode(`Below fold ${i}`);
    p.appendChild(txt);
    dynDoc.body.appendChild(p);
    belowTextNodes.push(txt);
  }

  let scrollTargetRect = { top: 9600, bottom: 9640, width: 400, height: 40 };
  const scrollTargetEl = dynDoc.createElement('p');
  scrollTargetEl.getBoundingClientRect = () => scrollTargetRect;
  const scrollTargetText = dynDoc.createTextNode('Scroll promoted block');
  scrollTargetEl.appendChild(scrollTargetText);
  dynDoc.body.appendChild(scrollTargetEl);

  const hiddenPanel = dynDoc.createElement('div');
  hiddenPanel.hidden = true;
  hiddenPanel.getBoundingClientRect = () => (hiddenPanel.hidden
    ? { top: 0, bottom: 0, width: 0, height: 0 }
    : { top: 300, bottom: 340, width: 400, height: 40 });
  const hiddenPanelPara = dynDoc.createElement('p');
  const hiddenPanelText = dynDoc.createTextNode('Hidden panel details');
  hiddenPanelPara.appendChild(hiddenPanelText);
  hiddenPanel.appendChild(hiddenPanelPara);
  dynDoc.body.appendChild(hiddenPanel);

  const activeMutationObservers = new Set();
  class MockMutationObserver {
    constructor(cb) {
      this.cb = cb;
    }
    observe(target, config) {
      this.target = target;
      this.config = config;
      activeMutationObservers.add(this);
    }
    disconnect() {
      activeMutationObservers.delete(this);
    }
  }
  function emitMutations(records) {
    for (const obs of Array.from(activeMutationObservers)) {
      obs.cb(records);
    }
  }

  const dynBatches = [];
  const heldBatchResolvers = [];
  let holdFirstFour = true;
  const dynHooks = {};

  const dynTranslator = createDomTranslatorInVm(
    dynDoc,
    async (msg) => {
      if (msg.type === 'TRANSLATE_BATCH') {
        const batchCopy = msg.payload.texts.slice();
        dynBatches.push(batchCopy);
        if (holdFirstFour && dynBatches.length <= 4) {
          await new Promise((resolve) => heldBatchResolvers.push(resolve));
        }
        return {
          ok: true,
          data: {
            translations: batchCopy.map((t) => `[译] ${t}`)
          }
        };
      }
      return { ok: true, data: {} };
    },
    { innerHeight: 800, MutationObserver: MockMutationObserver, hooks: dynHooks }
  );

  try {
    await dynTranslator.translatePage({});

    const gateDeadline = Date.now() + 1000;
    while (Date.now() < gateDeadline && heldBatchResolvers.length < 4) {
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(heldBatchResolvers.length, 4, 'Expected 4 concurrent initial batches');
    assert.equal(dynBatches[0][0], 'Viewport hero', 'In-viewport hero element must be prioritized at Batch 1 start');

    // Simulate user scrolling to reveal scrollTargetEl while remaining below-fold items are queued
    scrollTargetRect = { top: 120, bottom: 160, width: 400, height: 40 };
    dynHooks.dispatchWindowEvent('scroll', { type: 'scroll' });

    holdFirstFour = false;
    while (heldBatchResolvers.length > 0) {
      heldBatchResolvers.shift()();
    }

    const preDeadline = Date.now() + 1500;
    while (Date.now() < preDeadline) {
      const st = dynTranslator.getStatus();
      if (st.translatedCount >= 143 && st.loadingCount === 0) break;
      await new Promise((r) => setTimeout(r, 15));
    }

    assert.ok(dynBatches.length >= 5, `Expected >= 5 batches, got ${dynBatches.length}`);
    assert.equal(
      dynBatches[4][0],
      'Scroll promoted block',
      'Scrolled-into-view item must promote to head of next batch ahead of remaining offscreen items'
    );
    assert.equal(heroText.nodeValue, '[译] Viewport hero');
    assert.equal(scrollTargetText.nodeValue, '[译] Scroll promoted block');
    assert.ok(
      belowTextNodes.every((n, idx) => n.nodeValue === `[译] Below fold ${idx}`),
      'All offscreen below-the-fold nodes must pre-translate automatically without scrolling'
    );
    assert.equal(hiddenPanelText.nodeValue, 'Hidden panel details', 'Hidden panel must stay untranslated while hidden');

    // Simulate delayed next/dynamic mount + accordion reveal (MutationObserver incremental scan)
    const dynSection = dynDoc.createElement('section');
    const dynStrings = [
      '[ COMMITS ]',
      '774 contributions',
      '[ MARGIN ]',
      'Revenue',
      'Refunds',
      'Hosting',
      'Profit'
    ];
    const dynTextNodes = dynStrings.map((label) => {
      const el = dynDoc.createElement('div');
      const txt = dynDoc.createTextNode(label);
      el.appendChild(txt);
      dynSection.appendChild(el);
      return { label, txt };
    });
    dynDoc.body.appendChild(dynSection);
    hiddenPanel.hidden = false;

    emitMutations([
      { type: 'childList', target: dynDoc.body, addedNodes: [dynSection], removedNodes: [] },
      { type: 'attributes', attributeName: 'hidden', target: hiddenPanel }
    ]);

    const mutDeadline = Date.now() + 1500;
    while (Date.now() < mutDeadline) {
      const st = dynTranslator.getStatus();
      if (st.translatedCount >= 151 && st.loadingCount === 0) break;
      await new Promise((r) => setTimeout(r, 20));
    }

    for (const item of dynTextNodes) {
      assert.equal(
        item.txt.nodeValue,
        `[译] ${item.label}`,
        `Dynamically mounted "${item.label}" must auto-translate via MutationObserver`
      );
    }
    assert.equal(
      hiddenPanelText.nodeValue,
      '[译] Hidden panel details',
      'Expanded hidden panel must auto-translate via attribute MutationObserver'
    );
    assert.equal(dynDoc.querySelectorAll('.wt-translated-block').length, 0);
    assert.equal(dynDoc.querySelectorAll('.wt-replaced-text').length, 0);

    dynTranslator.restorePage();
    assert.equal(heroText.nodeValue, 'Viewport hero');
    assert.equal(belowTextNodes[0].nodeValue, 'Below fold 0');
    assert.equal(hiddenPanelText.nodeValue, 'Hidden panel details');
    assert.equal(dynTextNodes[1].txt.nodeValue, '774 contributions');
  } finally {
    dynTranslator.destroy();
  }

  // Verify zh-CN script normalization, characterData tamper guard & content PAGE_SET_MODE targetLang switch
  const scriptEnv = createDomEnvironment();
  const scriptDoc = scriptEnv.doc;
  const ssoPara = scriptDoc.createElement('p');
  const ssoText = scriptDoc.createTextNode('Add enterprise SSO');
  ssoPara.appendChild(ssoText);
  scriptDoc.body.appendChild(ssoPara);

  const scriptObservers = new Set();
  class ScriptMockMutationObserver {
    constructor(cb) {
      this.cb = cb;
    }
    observe(target, config) {
      this.target = target;
      this.config = config;
      scriptObservers.add(this);
    }
    disconnect() {
      scriptObservers.delete(this);
    }
  }

  const scriptTranslator = createDomTranslatorInVm(
    scriptDoc,
    async (msg) => {
      if (msg.type === 'TRANSLATE_BATCH') {
        return {
          ok: true,
          data: {
            translations: msg.payload.texts.map(() => '添加企業級 SSO')
          }
        };
      }
      return { ok: true, data: {} };
    },
    { MutationObserver: ScriptMockMutationObserver }
  );

  try {
    await scriptTranslator.translatePage({});
    const scriptDeadline = Date.now() + 1000;
    while (Date.now() < scriptDeadline) {
      const st = scriptTranslator.getStatus();
      if (st.translatedCount >= 1 && st.loadingCount === 0) break;
      await new Promise((r) => setTimeout(r, 15));
    }
    assert.equal(
      ssoText.nodeValue,
      '添加企业级 SSO',
      'domTranslator must normalize Traditional Chinese batch response to Simplified Chinese for zh-CN'
    );

    const hasCharDataObserver = Array.from(scriptObservers).some((obs) => Boolean(obs.config?.characterData));
    assert.equal(hasCharDataObserver, true, 'MutationObserver must watch characterData on translated document');

    ssoText.nodeValue = '添加企業級 SSO';
    for (const obs of Array.from(scriptObservers)) {
      obs.cb([{ type: 'characterData', target: ssoText }]);
    }
    assert.equal(
      ssoText.nodeValue,
      '添加企业级 SSO',
      'characterData observer must immediately revert external Simp->Trad tampering'
    );
  } finally {
    scriptTranslator.destroy();
  }

  const switchEnv = createDomEnvironment();
  const switchDoc = switchEnv.doc;
  const switchP = switchDoc.createElement('p');
  const switchText = switchDoc.createTextNode('Add enterprise SSO');
  switchP.appendChild(switchText);
  switchDoc.body.appendChild(switchP);

  const switchRuntimeListeners = new Set();
  const switchStorageListeners = new Set();
  const switchBatchCalls = [];
  const switchStore = {
    wt_settings: {
      sourceLang: 'auto',
      targetLang: 'zh-TW',
      displayMode: 'replace',
      engine: 'loom',
      selectionMode: 'icon',
      showFloatingBall: false,
      altHoverTranslate: false,
      loomConfig: {
        baseUrl: 'http://127.0.0.1:4319/v1',
        apiKey: 'hub.test',
        provider: 'kimi',
        model: 'kimi/k3.1-pro'
      }
    }
  };
  class SwitchMockEvent {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
  }
  const switchSandbox = {
    document: switchDoc,
    location: { href: 'https://devin.ai/', hostname: 'devin.ai' },
    innerWidth: 1280,
    innerHeight: 800,
    setTimeout,
    clearTimeout,
    console,
    Event: SwitchMockEvent,
    getSelection: () => ({ toString: () => '', rangeCount: 0 }),
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    addEventListener: () => {},
    removeEventListener: () => {},
    chrome: {
      storage: {
        sync: {
          get: (_k, cb) => {
            const out = { wt_settings: switchStore.wt_settings };
            if (cb) cb(out);
            return Promise.resolve(out);
          },
          set: (items, cb) => {
            Object.assign(switchStore, items);
            if (cb) cb();
            return Promise.resolve();
          }
        },
        local: {
          get: (_k, cb) => {
            if (cb) cb({});
            return Promise.resolve({});
          },
          set: (_items, cb) => {
            if (cb) cb();
            return Promise.resolve();
          }
        },
        onChanged: {
          addListener: (fn) => switchStorageListeners.add(fn),
          removeListener: (fn) => switchStorageListeners.delete(fn)
        }
      },
      runtime: {
        id: 'verify-ext-switch',
        onMessage: {
          addListener: (fn) => switchRuntimeListeners.add(fn),
          removeListener: (fn) => switchRuntimeListeners.delete(fn)
        },
        sendMessage: async (msg) => {
          if (msg.type === 'GET_SETTINGS') {
            return { ok: true, data: switchStore.wt_settings };
          }
          if (msg.type === 'SAVE_SETTINGS') {
            switchStore.wt_settings = Object.assign({}, switchStore.wt_settings, msg.payload || {});
            return { ok: true, data: switchStore.wt_settings };
          }
          if (msg.type === 'TRANSLATE_BATCH') {
            switchBatchCalls.push(msg.payload?.targetLang);
            return {
              ok: true,
              data: {
                translations: msg.payload.texts.map(() => '添加企業級 SSO')
              }
            };
          }
          return { ok: true, data: {} };
        }
      }
    }
  };
  switchSandbox.window = switchSandbox;
  switchSandbox.globalThis = switchSandbox;
  switchSandbox.self = switchSandbox;
  const switchVm = vm.createContext(switchSandbox);
  vm.runInContext(readText('src/shared/config.js'), switchVm, { filename: 'src/shared/config.js' });
  vm.runInContext(readText('src/content/dom-translator.js'), switchVm, { filename: 'src/content/dom-translator.js' });
  vm.runInContext(readText('src/content/selection-ui.js'), switchVm, { filename: 'src/content/selection-ui.js' });
  vm.runInContext(readText('src/content/index.js'), switchVm, { filename: 'src/content/index.js' });
  const dispatchToSwitchVm = (msg) => new Promise((resolve) => {
    let settled = false;
    const sendResponse = (res) => {
      if (!settled) {
        settled = true;
        resolve(res);
      }
    };
    for (const fn of switchRuntimeListeners) {
      const keepOpen = fn(msg, {}, sendResponse);
      if (!keepOpen && !settled) {
        settled = true;
        resolve(undefined);
      }
    }
  });
  try {
    await dispatchToSwitchVm({ type: 'PAGE_TRANSLATE_START', payload: {} });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(switchText.nodeValue, '添加企業級 SSO', 'Initial zh-TW translation should preserve Traditional text');
    assert.equal(switchDoc.documentElement.getAttribute('lang'), 'zh-TW');

    await dispatchToSwitchVm({
      type: 'PAGE_SET_MODE',
      payload: { targetLang: 'zh-CN', displayMode: 'replace', forceRetranslate: true }
    });
    await new Promise((r) => setTimeout(r, 60));
    assert.ok(switchBatchCalls.includes('zh-CN'), 'PAGE_SET_MODE must trigger re-translation with targetLang zh-CN');
    assert.equal(switchText.nodeValue, '添加企业级 SSO', 'Switching targetLang zh-TW -> zh-CN must re-translate DOM cleanly to Simplified Chinese');
    assert.equal(switchDoc.documentElement.getAttribute('lang'), 'zh-CN');
  } finally {
    switchVm.__WT_CONTENT_API__?.destroy();
  }

  // Verify Round 5 Sider AI Sidebar, extractPageContext (<=6000), Popover/FAB AI, Write Backfill, Alt+S & destroy()
  const siderEnv = createDomEnvironment();
  const siderDoc = siderEnv.doc;
  siderDoc.title = 'Sider AI Architecture';

  const navEl = siderDoc.createElement('nav');
  const navLink = siderDoc.createElement('a');
  navLink.textContent = 'Skip Nav Text';
  navEl.appendChild(navLink);
  siderDoc.body.appendChild(navEl);

  const scriptEl = siderDoc.createElement('script');
  scriptEl.textContent = 'var shouldNotAppearInContext = true;';
  siderDoc.body.appendChild(scriptEl);

  const articleEl = siderDoc.createElement('article');
  const h1El = siderDoc.createElement('h1');
  h1El.textContent = 'Primary Article Heading';
  const h2El = siderDoc.createElement('h2');
  h2El.textContent = 'Subsection Outline';
  const longParaEl = siderDoc.createElement('p');
  longParaEl.textContent =
    'Main article summary sentence. ' +
    'Detailed paragraph content for testing summarization and contextual chat. '.repeat(110);
  const articleImgEl = siderDoc.createElement('img');
  articleImgEl.setAttribute('src', 'https://example.test/chart.png');
  articleImgEl.setAttribute('alt', 'Yield Curve Chart');
  articleImgEl.setAttribute('width', '640');
  articleImgEl.setAttribute('height', '400');
  const avatarImgEl = siderDoc.createElement('img');
  avatarImgEl.className = 'user-avatar';
  avatarImgEl.setAttribute('src', 'https://example.test/avatar.png');
  avatarImgEl.setAttribute('width', '24');
  avatarImgEl.setAttribute('height', '24');
  articleEl.appendChild(h1El);
  articleEl.appendChild(h2El);
  articleEl.appendChild(longParaEl);
  articleEl.appendChild(articleImgEl);
  articleEl.appendChild(avatarImgEl);
  siderDoc.body.appendChild(articleEl);

  const footerEl = siderDoc.createElement('footer');
  const footerP = siderDoc.createElement('p');
  footerP.textContent = 'Skip Footer Text';
  const footerImg = siderDoc.createElement('img');
  footerImg.setAttribute('src', 'https://example.test/footer-banner.png');
  footerImg.setAttribute('width', '500');
  footerImg.setAttribute('height', '200');
  footerEl.appendChild(footerP);
  footerEl.appendChild(footerImg);
  siderDoc.body.appendChild(footerEl);

  const writeTarget = siderDoc.createElement('textarea');
  writeTarget.id = 'demo-write-target';
  writeTarget.value = 'hi team i want ask update';
  let writeInputEvents = 0;
  writeTarget.addEventListener('input', () => {
    writeInputEvents += 1;
  });
  siderDoc.body.appendChild(writeTarget);

  const outboundMsgs = [];
  const runtimeListeners = new Set();
  const storageChangedListeners = new Set();
  const sidebarStore = {
    wt_settings: {
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      displayMode: 'replace',
      engine: 'loom',
      selectionMode: 'icon',
      showFloatingBall: true,
      altHoverTranslate: true,
      loomConfig: {
        baseUrl: 'http://127.0.0.1:4319/v1',
        apiKey: 'hub.test',
        provider: 'kimi',
        model: 'kimi/k3.1-pro'
      }
    }
  };

  class MockEvent {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
  }

  const siderSandbox = {
    document: siderDoc,
    location: { href: 'https://example.test/article', hostname: 'example.test' },
    innerWidth: 1280,
    innerHeight: 800,
    setTimeout,
    clearTimeout,
    console,
    Event: MockEvent,
    getSelection: () => ({ toString: () => 'Local-first LLM', rangeCount: 0 }),
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    addEventListener: () => {},
    removeEventListener: () => {},
    chrome: {
      storage: {
        sync: {
          get: (_k, cb) => {
            const out = { wt_settings: sidebarStore.wt_settings };
            if (cb) cb(out);
            return Promise.resolve(out);
          },
          set: (items, cb) => {
            Object.assign(sidebarStore, items);
            if (cb) cb();
            return Promise.resolve();
          }
        },
        local: {
          get: (_k, cb) => {
            if (cb) cb({});
            return Promise.resolve({});
          },
          set: (_items, cb) => {
            if (cb) cb();
            return Promise.resolve();
          }
        },
        onChanged: {
          addListener: (fn) => storageChangedListeners.add(fn),
          removeListener: (fn) => storageChangedListeners.delete(fn)
        }
      },
      runtime: {
        id: 'verify-ext-sider',
        onMessage: {
          addListener: (fn) => runtimeListeners.add(fn),
          removeListener: (fn) => runtimeListeners.delete(fn)
        },
        sendMessage: async (msg) => {
          outboundMsgs.push(msg);
          if (msg.type === 'GET_SETTINGS') {
            return { ok: true, data: sidebarStore.wt_settings };
          }
          if (msg.type === 'SAVE_SETTINGS') {
            sidebarStore.wt_settings = Object.assign({}, sidebarStore.wt_settings, msg.payload || {});
            return { ok: true, data: sidebarStore.wt_settings };
          }
          if (msg.type === 'TRANSLATE_BATCH') {
            return { ok: true, data: { translations: msg.payload.texts.map((t) => `[译] ${t}`) } };
          }
          if (msg.type === 'TRANSLATE_TEXT') {
            return { ok: true, data: { translatedText: `[译] ${msg.payload.text}`, detectedSourceLang: 'en' } };
          }
          if (msg.type === 'AI_CHAT') {
            if (outboundMsgs.nextAiChatGate) {
              const gate = outboundMsgs.nextAiChatGate;
              outboundMsgs.nextAiChatGate = null;
              await gate;
            }
            const task = msg.payload?.taskType || 'chat';
            return {
              ok: true,
              data: {
                reply: `AI(${task}): polished & explained`,
                reasoning: msg.payload?.enableThinking === false ? '' : `Sidebar reasoning for ${task}`,
                thinkingMs: msg.payload?.enableThinking === false ? 0 : 1200,
                model: 'kimi/k3.1-pro',
                engine: 'loom'
              }
            };
          }
          return { ok: true, data: {} };
        }
      }
    }
  };
  siderSandbox.window = siderSandbox;
  siderSandbox.globalThis = siderSandbox;
  siderSandbox.self = siderSandbox;

  const siderVm = vm.createContext(siderSandbox);
  vm.runInContext(readText('src/shared/config.js'), siderVm, { filename: 'src/shared/config.js' });
  vm.runInContext(readText('src/content/dom-translator.js'), siderVm, { filename: 'src/content/dom-translator.js' });
  vm.runInContext(readText('src/content/selection-ui.js'), siderVm, { filename: 'src/content/selection-ui.js' });
  vm.runInContext(readText('src/content/index.js'), siderVm, { filename: 'src/content/index.js' });

  const dispatchToContentVm = (msg) => new Promise((resolve) => {
    let settled = false;
    const sendResponse = (res) => {
      if (!settled) {
        settled = true;
        resolve(res);
      }
    };
    for (const fn of runtimeListeners) {
      const keepOpen = fn(msg, {}, sendResponse);
      if (!keepOpen && !settled) {
        settled = true;
        resolve(undefined);
      }
    }
  });

  const api = siderVm.__WT_CONTENT_API__;
  assert.ok(api, 'window.__WT_CONTENT_API__ must be exposed by content/index.js');
  assert.equal(runtimeListeners.size, 1, 'Expected 1 runtime.onMessage listener registered');

  try {
    // 1. SIDEBAR_TOGGLE mounts .wt-sidebar strictly inside #wt-root-container (.notranslate)
    const toggleRes = await dispatchToContentVm({ type: 'SIDEBAR_TOGGLE', payload: { open: true, tab: 'chat' } });
    assert.equal(toggleRes?.ok, true);
    assert.equal(toggleRes?.sidebarOpen, true);
    assert.equal(api.isSidebarOpen(), true);

    const rootWrap = siderDoc.getElementById('wt-root-container');
    assert.ok(rootWrap && rootWrap.classList.contains('notranslate'), '#wt-root-container must carry notranslate');
    const sidebarNode = rootWrap.querySelector('.wt-sidebar');
    assert.ok(sidebarNode && !sidebarNode.classList.contains('wt-hidden'), '.wt-sidebar must mount inside #wt-root-container');

    // 2. page translation must NOT translate sidebar or #wt-root-container content
    await dispatchToContentVm({ type: 'PAGE_TRANSLATE_START', payload: {} });
    await new Promise((r) => setTimeout(r, 60));
    const translatedBatchTexts = outboundMsgs.filter((m) => m.type === 'TRANSLATE_BATCH').flatMap((m) => m.payload.texts);
    assert.ok(translatedBatchTexts.includes('Primary Article Heading'));
    assert.ok(!translatedBatchTexts.some((t) => t.includes('Gloss') || t.includes('AI 对话') || t.includes('写入页面')));

    // 3. extractPageContext skips nav/footer/script/#wt-root-container, extracts images & caps length <= 6000
    const ctx = api.extractPageContext();
    assert.equal(ctx.title, 'Sider AI Architecture');
    assert.equal(ctx.url, 'https://example.test/article');
    assert.ok(ctx.content.includes('Primary Article Heading'));
    assert.ok(ctx.content.includes('Main article summary sentence.'));
    assert.ok(!ctx.content.includes('Skip Nav Text') && !ctx.content.includes('Skip Footer Text'));
    assert.ok(!ctx.content.includes('shouldNotAppearInContext') && !ctx.content.includes('Gloss · AI 助手'));
    assert.ok(ctx.content.length <= 6000, `extractPageContext length must be <= 6000, got ${ctx.content.length}`);
    assert.ok(Array.isArray(ctx.images) && ctx.images.length === 1, `Expected 1 article image extracted, got ${ctx.images?.length}`);
    assert.equal(ctx.images[0].url, 'https://example.test/chart.png');
    assert.ok(!ctx.images.some((im) => im.url.includes('avatar.png') || im.url.includes('footer-banner.png')));

    // 4. Focus editable target & test SIDEBAR_ACTION (summarize_page, explain, polish -> clean write backfill, analyze_image)
    writeTarget.focus();

    let releaseSummaryAi = null;
    outboundMsgs.nextAiChatGate = new Promise((resolve) => {
      releaseSummaryAi = resolve;
    });
    await dispatchToContentVm({
      type: 'SIDEBAR_ACTION',
      payload: { action: 'summarize_page', tab: 'summary', autoRun: true }
    });
    await new Promise((r) => setTimeout(r, 20));
    const pendingSummaryMsg = [...outboundMsgs].reverse().find((m) => m.type === 'AI_CHAT' && m.payload.taskType === 'summarize_page');
    assert.ok(pendingSummaryMsg?.payload?.streamId, 'summarize_page AI_CHAT must include streamId');
    const streamingThinkEl = rootWrap.querySelector('.wt-summary-result')?.querySelector('.wt-thinking-streaming');
    assert.ok(
      streamingThinkEl && streamingThinkEl.classList.contains('wt-thinking-box') && streamingThinkEl.textContent.includes('正在思考'),
      'Summary pane must immediately render live streaming thinking box while waiting'
    );
    await dispatchToContentVm({
      type: 'SIDEBAR_ACTION',
      payload: {
        action: 'stream_progress',
        streamId: pendingSummaryMsg.payload.streamId,
        reasoning: '正在拆解网页核心段落...',
        reply: ''
      }
    });
    assert.ok(
      rootWrap.querySelector('.wt-summary-result')?.querySelector('.wt-thinking-body')?.textContent.includes('正在拆解网页核心段落...'),
      'Sidebar stream_progress must live-update .wt-thinking-body while request is in flight'
    );
    releaseSummaryAi();
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(
      outboundMsgs.some((m) => m.type === 'AI_CHAT' && m.payload.taskType === 'summarize_page' && m.payload.pageContext?.content),
      'summarize_page SIDEBAR_ACTION must send AI_CHAT with pageContext'
    );
    assert.ok(rootWrap.querySelector('.wt-summary-result').textContent.includes('AI(summarize_page)'));
    assert.ok(
      rootWrap.querySelector('.wt-summary-result')?.querySelector('.wt-thinking-box')?.textContent.includes('Sidebar reasoning for summarize_page'),
      'Summary pane must render .wt-thinking-box when reasoning is present'
    );

    await dispatchToContentVm({
      type: 'SIDEBAR_ACTION',
      payload: { action: 'explain', text: 'Local-first LLM', tab: 'chat', autoRun: true }
    });
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(
      outboundMsgs.some((m) => m.type === 'AI_CHAT' && m.payload.taskType === 'explain' && m.payload.selectionText === 'Local-first LLM')
    );
    assert.ok(rootWrap.querySelector('.wt-chat-list').textContent.includes('AI(explain)'));
    assert.ok(
      rootWrap.querySelector('.wt-chat-list')?.querySelector('.wt-thinking-box')?.textContent.includes('Sidebar reasoning for explain'),
      'Chat pane must render .wt-thinking-box'
    );

    await dispatchToContentVm({
      type: 'SIDEBAR_ACTION',
      payload: { action: 'analyze_image', imageUrl: 'https://example.test/chart.png', tab: 'chat', autoRun: true }
    });
    await new Promise((r) => setTimeout(r, 20));
    const analyzeImgCall = outboundMsgs.filter((m) => m.type === 'AI_CHAT').pop();
    assert.ok(
      Array.isArray(analyzeImgCall?.payload?.images) && analyzeImgCall.payload.images[0]?.url === 'https://example.test/chart.png',
      'analyze_image SIDEBAR_ACTION must forward image in AI_CHAT payload'
    );
    const userChatNodes = rootWrap.querySelectorAll('.wt-chat-msg-user');
    const lastUserChatNode = userChatNodes[userChatNodes.length - 1];
    assert.ok(
      lastUserChatNode?.querySelector('.wt-chat-msg-thumb'),
      'User chat bubble must render attached image thumbnail'
    );

    await dispatchToContentVm({
      type: 'SIDEBAR_ACTION',
      payload: { action: 'polish', text: 'hi team i want ask update', tab: 'write', autoRun: true }
    });
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(rootWrap.querySelector('.wt-write-result').textContent.includes('AI(polish)'));
    assert.ok(
      rootWrap.querySelector('.wt-write-result')?.querySelector('.wt-thinking-box')?.textContent.includes('Sidebar reasoning for polish'),
      'Write pane must render .wt-thinking-box'
    );
    const insertBtn = rootWrap.querySelector('.wt-write-insert-btn');
    assert.ok(insertBtn && !insertBtn.disabled, 'Write backfill button must enable after result');
    insertBtn.dispatchEvent({ type: 'click', bubbles: true });
    assert.equal(writeTarget.value, 'AI(polish): polished & explained');
    assert.ok(writeInputEvents >= 1, 'Backfilling textarea must emit input event');

    // 5. Popover AI bar & Floating Ball AI row clicks trigger AI_CHAT
    await dispatchToContentVm({
      type: 'SHOW_SELECTION_TRANSLATION',
      payload: { text: 'Selection phrase for AI' }
    });
    const prevAiCount = outboundMsgs.filter((m) => m.type === 'AI_CHAT').length;
    const popoverExplainBtn = rootWrap.querySelector('.wt-popover-ai-bar')?.querySelector('[data-ai-action="explain"]');
    assert.ok(popoverExplainBtn, 'Popover AI explain button missing');
    popoverExplainBtn.dispatchEvent({ type: 'click', bubbles: true });
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(outboundMsgs.filter((m) => m.type === 'AI_CHAT').length > prevAiCount);

    const beforeFabCount = outboundMsgs.filter((m) => m.type === 'AI_CHAT').length;
    const fabSummaryBtn = rootWrap.querySelector('[data-wt-fab-action="summarize"]');
    assert.ok(fabSummaryBtn, 'Floating ball summarize button missing');
    fabSummaryBtn.dispatchEvent({ type: 'click', bubbles: true });
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(outboundMsgs.filter((m) => m.type === 'AI_CHAT').length > beforeFabCount);

    // 6. PAGE_GET_STATUS includeContext: true vs omitted (Round 6 SidePanel/Popup context pull)
    const statusPlain = await dispatchToContentVm({ type: 'PAGE_GET_STATUS', payload: {} });
    assert.equal(statusPlain?.ok, true);
    assert.equal(statusPlain.status?.pageContext, undefined, 'PAGE_GET_STATUS without includeContext must omit pageContext');

    const statusWithCtx = await dispatchToContentVm({
      type: 'PAGE_GET_STATUS',
      payload: { includeContext: true }
    });
    assert.equal(statusWithCtx?.ok, true);
    assert.equal(statusWithCtx.status?.pageContext?.title, 'Sider AI Architecture');
    assert.ok(statusWithCtx.status?.pageContext?.content.includes('Main article summary sentence.'));

    // 7. Round 7 Sidebar Codex model switcher (optgroup + SAVE_SETTINGS + AI_CHAT stripped model)
    const modelSelect = sidebarNode.querySelector('.wt-sidebar-model-select');
    assert.ok(modelSelect, 'Sidebar missing .wt-sidebar-model-select');
    const codexOpt = modelSelect.querySelectorAll('option').find((opt) => opt.value === 'codex:gpt-5.6-luna');
    assert.ok(codexOpt, 'Sidebar model selector missing codex:gpt-5.6-luna option');
    assert.ok(
      modelSelect.querySelectorAll('optgroup').some((og) => String(og.getAttribute('label') || '').includes('Codex')),
      'Sidebar model selector missing Codex optgroup'
    );
    modelSelect.value = 'codex:gpt-6-luna';
    modelSelect.dispatchEvent({ type: 'change', bubbles: true });
    await new Promise((r) => setTimeout(r, 20));
    const codexSaveMsg = outboundMsgs.filter((m) => m.type === 'SAVE_SETTINGS').pop();
    assert.equal(codexSaveMsg?.payload?.engine, 'codex', 'Selecting codex model must save engine: "codex"');
    assert.equal(codexSaveMsg?.payload?.codexConfig?.model, 'gpt-6-luna');

    const chatInputInSidebar = sidebarNode.querySelector('.wt-chat-input');
    const chatSendInSidebar = sidebarNode.querySelector('.wt-chat-send-btn');
    assert.ok(chatInputInSidebar && chatSendInSidebar);
    chatInputInSidebar.value = 'Test Codex sidebar prompt';
    chatSendInSidebar.dispatchEvent({ type: 'click', bubbles: true });
    await new Promise((r) => setTimeout(r, 20));
    const codexSidebarAiCall = outboundMsgs.filter((m) => m.type === 'AI_CHAT').pop();
    assert.equal(codexSidebarAiCall?.payload?.engine, 'codex');
    assert.equal(codexSidebarAiCall?.payload?.model, 'gpt-6-luna', 'Sidebar AI_CHAT must strip "codex:" prefix');
    assert.ok(codexSidebarAiCall?.payload?.codexConfig && typeof codexSidebarAiCall.payload.codexConfig === 'object');

    // 7b. Historical webpage chat sessions in Sider AI Sidebar (auto-save, search, filter, restore)
    const savedArticleSessions = await siderVm.WT_CONFIG.getChatSessions({ query: 'Test Codex sidebar prompt' });
    assert.equal(savedArticleSessions.length, 1, 'Sidebar chat must auto-save current webpage session');
    assert.equal(savedArticleSessions[0].pageUrl, 'https://example.test/article');
    assert.equal(savedArticleSessions[0].pageTitle, 'Sider AI Architecture');

    await siderVm.WT_CONFIG.saveChatSession({
      id: 'hist-docs-session',
      pageUrl: 'https://docs.anthropic.com/guide#intro',
      pageTitle: 'Claude API Docs',
      pageExcerpt: 'Structured JSON schemas validate model tool outputs.',
      messages: [
        { role: 'user', content: 'How does tool use work?' },
        {
          role: 'assistant',
          content: 'Tool use allows structured JSON calls with strict schema validation.',
          reasoning: 'Checking tool schema docs'
        }
      ],
      updatedAt: Date.now() + 5000
    });

    const sidebarNewChatBtn = sidebarNode.querySelector('.wt-sidebar-new-chat-btn');
    const sidebarHistoryBtn = sidebarNode.querySelector('.wt-sidebar-history-btn');
    assert.ok(sidebarNewChatBtn && sidebarHistoryBtn, 'Sidebar missing history/new-chat controls');

    sidebarNewChatBtn.dispatchEvent({ type: 'click', bubbles: true });
    assert.ok(sidebarNode.querySelector('.wt-chat-empty'), 'New chat button must reset chat list to empty state');

    sidebarHistoryBtn.dispatchEvent({ type: 'click', bubbles: true });
    await new Promise((r) => setTimeout(r, 25));
    const historyPanel = sidebarNode.querySelector('.wt-chat-history-panel');
    assert.ok(historyPanel && !historyPanel.classList.contains('wt-hidden'), 'History button must open .wt-chat-history-panel');
    assert.equal(sidebarNode.querySelectorAll('.wt-chat-history-item').length, 2, 'Expected 2 saved webpage sessions');

    const historySearch = sidebarNode.querySelector('.wt-chat-history-search');
    historySearch.value = 'structured JSON';
    historySearch.dispatchEvent({ type: 'input', bubbles: true });
    await new Promise((r) => setTimeout(r, 25));
    const filteredItems = sidebarNode.querySelectorAll('.wt-chat-history-item');
    assert.equal(filteredItems.length, 1, 'Searching historical chats must filter to matching session');
    assert.ok(
      filteredItems[0].querySelector('.wt-chat-history-snippet')?.textContent.includes('structured JSON'),
      'Filtered session card must display matching snippet'
    );

    filteredItems[0].dispatchEvent({ type: 'click', bubbles: true });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(historyPanel.classList.contains('wt-hidden'), true, 'Selecting session must close history panel');
    assert.ok(
      sidebarNode.querySelector('.wt-chat-list')?.textContent.includes('Tool use allows structured JSON calls'),
      'Selecting historical session must restore its conversation messages'
    );
    const restoredBanner = sidebarNode.querySelector('.wt-chat-session-banner');
    assert.ok(
      restoredBanner && !restoredBanner.classList.contains('wt-hidden') && restoredBanner.textContent.includes('Claude API Docs'),
      'Restoring historical session must show webpage context banner'
    );

    // 8. Alt+S toggles sidebar cleanly
    assert.equal(api.isSidebarOpen(), true);
    siderDoc.dispatchEvent({ type: 'keydown', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key: 's', code: 'KeyS' });
    assert.equal(api.isSidebarOpen(), false, 'Alt+S must close open sidebar');
    siderDoc.dispatchEvent({ type: 'keydown', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key: 's', code: 'KeyS' });
    assert.equal(api.isSidebarOpen(), true, 'Alt+S must reopen closed sidebar');
  } finally {
    api.destroy();
  }

  assert.equal(siderDoc.getElementById('wt-root-container'), null, 'destroy() must remove #wt-root-container');
  assert.equal(runtimeListeners.size, 0, 'destroy() must unregister runtime.onMessage listener');
  assert.equal(storageChangedListeners.size, 0, 'destroy() must unregister storage.onChanged listener');

  // --- Part C: Round 6 Sider 4-Tab Popup & Native SidePanel VM Test ---
  function loadHtmlIntoMockDoc(targetDoc, htmlText) {
    const voidTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
      'meta', 'param', 'source', 'track', 'wbr', 'path', 'circle', 'line',
      'rect', 'polygon', 'polyline'
    ]);
    const stripped = htmlText.replace(/<!--[\s\S]*?-->/g, '');
    const tokenRegex = /<(\/?)([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
    const stack = [targetDoc.documentElement];
    let inBody = false;
    let tok;
    while ((tok = tokenRegex.exec(stripped)) !== null) {
      if (tok[4] !== undefined) {
        if (inBody) {
          const text = tok[4].replace(/\s+/g, ' ');
          if (text.trim()) {
            stack[stack.length - 1].appendChild(targetDoc.createTextNode(text));
          }
        }
        continue;
      }
      const isClose = tok[1] === '/';
      const tag = tok[2].toLowerCase();
      const rawAttrs = tok[3] || '';
      if (tag === 'html' || tag === 'head' || tag === 'meta' || tag === 'link' || tag === 'title' || tag === 'script') {
        continue;
      }
      if (tag === 'body') {
        if (!isClose) {
          inBody = true;
          stack.push(targetDoc.body);
        } else {
          inBody = false;
        }
        continue;
      }
      if (!inBody) continue;
      if (isClose) {
        for (let i = stack.length - 1; i > 1; i -= 1) {
          if (stack[i].tagName.toLowerCase() === tag) {
            stack.length = i;
            break;
          }
        }
        continue;
      }
      const el = targetDoc.createElement(tag);
      const selfClose = /\/\s*$/.test(rawAttrs) || voidTags.has(tag);
      const attrPart = rawAttrs.replace(/\/\s*$/, '');
      const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
      let am;
      while ((am = attrRegex.exec(attrPart)) !== null) {
        const k = am[1];
        const v = am[2] ?? am[3] ?? am[4] ?? '';
        el.setAttribute(k, v);
        if (k === 'hidden') el.hidden = true;
        else if (k === 'checked') el.checked = true;
        else if (k === 'disabled') el.disabled = true;
        else if (k === 'selected') el.selected = true;
        else if (k === 'value') el.value = v;
        else if (k === 'type') el.type = v;
      }
      stack[stack.length - 1].appendChild(el);
      if (!selfClose) {
        stack.push(el);
      }
    }
  }

  const configCodeForPopup = readText('src/shared/config.js');
  const popupHtmlSrc = readText('src/popup/popup.html');
  const popupJsSrc = readText('src/popup/popup.js');

  async function bootPopupVm({
    search = '',
    activeTab,
    withSidePanelApi = true,
    initialPageStatus = null,
    onTabMessage = null,
    out = null
  }) {
    const { doc: pDoc } = createDomEnvironment();
    if (out) out.doc = pDoc;
    loadHtmlIntoMockDoc(pDoc, popupHtmlSrc);

    const runtimeMessages = [];
    const tabMessages = [];
    const sidePanelOpenCalls = [];
    let closedCount = 0;

    const chromeMock = {
      storage: {
        sync: {
          get: (_k, cb) => {
            const out = { wt_settings: {} };
            if (typeof cb === 'function') cb(out);
            return Promise.resolve(out);
          },
          set: (_items, cb) => {
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          }
        },
        local: {
          get: (_k, cb) => {
            if (typeof cb === 'function') cb({ wt_history: [] });
            return Promise.resolve({ wt_history: [] });
          },
          set: (_items, cb) => {
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          }
        }
      },
      tabs: {
        query: async () => [activeTab],
        onActivated: { addListener: () => {} },
        onUpdated: { addListener: () => {} },
        sendMessage: async (tabId, msg) => {
          tabMessages.push({ tabId, msg });
          if (onTabMessage) {
            const customRes = onTabMessage(msg);
            if (customRes !== undefined) return customRes;
          }
          if (msg.type === 'PAGE_GET_STATUS') {
            if (initialPageStatus) {
              return { ok: true, status: { ...initialPageStatus } };
            }
            return {
              ok: true,
              status: {
                isTranslated: false,
                translatedCount: 0,
                pageContext: msg.payload?.includeContext
                  ? {
                      title: activeTab.title,
                      url: activeTab.url,
                      content: 'SidePanel extracted page body text',
                      images: [{ url: 'https://example.test/sp-diagram.png', alt: 'SidePanel diagram' }]
                    }
                  : undefined
              }
            };
          }
          if (msg.type === 'SIDEBAR_TOGGLE' || msg.type === 'SIDEBAR_ACTION') {
            return { ok: true, sidebarOpen: true };
          }
          return { ok: true };
        }
      },
      runtime: {
        sendMessage: async (msg) => {
          runtimeMessages.push(msg);
          if (msg.type === 'GET_SETTINGS') return { ok: true, data: {} };
          if (msg.type === 'SAVE_SETTINGS') return { ok: true, data: msg.payload };
          if (msg.type === 'GET_HISTORY') return { ok: true, data: [] };
          if (msg.type === 'AI_CHAT') {
            return {
              ok: true,
              data: {
                reply: `PopupAI(${msg.payload.taskType}): ${msg.payload.prompt || ''}`.trim(),
                reasoning: msg.payload?.enableThinking === false ? '' : `Popup reasoning (${msg.payload.taskType})`,
                thinkingMs: msg.payload?.enableThinking === false ? 0 : 900,
                model: 'glm/glm-5-turbo',
                engine: 'loom'
              }
            };
          }
          return { ok: true, data: {} };
        },
        openOptionsPage: () => {}
      }
    };

    if (withSidePanelApi) {
      chromeMock.sidePanel = {
        open: (opts) => {
          sidePanelOpenCalls.push(opts);
          return Promise.resolve();
        }
      };
    }

    const sandbox = {
      document: pDoc,
      location: { search },
      navigator: { clipboard: { writeText: async () => {} } },
      URL,
      URLSearchParams,
      console,
      setTimeout,
      clearTimeout,
      chrome: chromeMock,
      matchMedia: () => ({ matches: false, addEventListener: () => {} })
    };
    sandbox.window = Object.assign(sandbox, {
      close: () => {
        closedCount += 1;
      },
      open: () => {}
    });
    sandbox.globalThis = sandbox;
    const ctxVm = vm.createContext(sandbox);
    vm.runInContext(configCodeForPopup, ctxVm, { filename: 'src/shared/config.js' });
    vm.runInContext(popupJsSrc, ctxVm, { filename: 'src/popup/popup.js' });
    pDoc.dispatchEvent({ type: 'DOMContentLoaded' });
    await new Promise((r) => setTimeout(r, 30));

    return {
      pDoc,
      ctxVm,
      runtimeMessages,
      tabMessages,
      sidePanelOpenCalls,
      getClosedCount: () => closedCount
    };
  }

  // Scenario C1: Restricted page (chrome://extensions/) in Popup mode keeps Sider triggers enabled & 4 tabs working
  const restrictedVm = await bootPopupVm({
    search: '',
    activeTab: { id: 101, windowId: 77, url: 'chrome://extensions/', title: 'Extensions' },
    withSidePanelApi: true
  });
  const rDoc = restrictedVm.pDoc;
  assert.equal(rDoc.getElementById('pageCard').classList.contains('is-restricted'), true, 'chrome:// must mark #pageCard .is-restricted');
  assert.equal(rDoc.getElementById('pageRestrictedBar').hidden, false, '#pageRestrictedBar must show on restricted pages');
  assert.equal(rDoc.getElementById('pageControlsBody').hidden, true, '#pageControlsBody must collapse on restricted pages');
  assert.equal(rDoc.getElementById('togglePageTranslateBtn').hidden, true, '#togglePageTranslateBtn must hide on restricted pages');
  assert.equal(rDoc.getElementById('openSidebarBtn').disabled, false, '#openSidebarBtn must NEVER be disabled on restricted pages');
  assert.equal(rDoc.getElementById('summarizePageBtn').disabled, false, '#summarizePageBtn must NEVER be disabled on restricted pages');
  assert.equal(rDoc.getElementById('paneTranslate').hidden, false, 'Popup mode defaults to Translate tab');

  // Clicking #openSidebarBtn on restricted page opens Chrome Side Panel synchronously & closes popup
  rDoc.getElementById('openSidebarBtn').dispatchEvent({ type: 'click', bubbles: true });
  assert.equal(restrictedVm.sidePanelOpenCalls.length, 1, 'Clicking #openSidebarBtn on chrome:// must invoke chrome.sidePanel.open synchronously');
  assert.equal(restrictedVm.sidePanelOpenCalls[0]?.windowId, 77);
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(restrictedVm.getClosedCount(), 1, 'Popup closes after opening native Side Panel');

  // Clicking #summarizePageBtn on restricted page switches straight to #paneSummary without tab sendMessage
  rDoc.getElementById('summarizePageBtn').dispatchEvent({ type: 'click', bubbles: true });
  assert.equal(rDoc.getElementById('paneSummary').hidden, false, '#summarizePageBtn must open Summary tab on restricted page');
  assert.equal(restrictedVm.tabMessages.length, 0, 'Must not send content messages to chrome:// tab');

  // Custom summary on restricted page -> AI_CHAT works & renders .ai-thinking-box cleanly
  rDoc.getElementById('popupSummaryCustomInput').value = 'Restricted custom text';
  rDoc.getElementById('popupSummaryRunBtn').dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(rDoc.getElementById('popupSummaryResult').textContent.includes('PopupAI(summarize_page)'));
  assert.ok(rDoc.getElementById('popupSummaryResult').querySelector('.ai-thinking-box')?.textContent.includes('Popup reasoning (summarize_page)'));
  assert.equal(rDoc.getElementById('popupSummaryCopyBtn').disabled, false);

  // Writing tab on restricted page -> AI_CHAT works & renders .ai-thinking-box
  rDoc.getElementById('tabBtnWrite').dispatchEvent({ type: 'click', bubbles: true });
  assert.equal(rDoc.getElementById('paneWrite').hidden, false);
  rDoc.getElementById('popupWriteInput').value = 'Draft note to polish';
  rDoc.getElementById('popupWriteActions').querySelector('[data-write-task="polish"]').dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(rDoc.getElementById('popupWriteResult').textContent.includes('PopupAI(polish)'));
  assert.ok(rDoc.getElementById('popupWriteResult').querySelector('.ai-thinking-box')?.textContent.includes('Popup reasoning (polish)'));
  assert.equal(rDoc.getElementById('popupWriteCopyBtn').disabled, false);

  // Restricted fallback when chrome.sidePanel is unavailable (e.g. Firefox): clicking #openSidebarBtn switches to Chat tab & works
  const noSidePanelVm = await bootPopupVm({
    search: '',
    activeTab: { id: 102, windowId: 78, url: 'about:blank', title: 'Blank' },
    withSidePanelApi: false
  });
  noSidePanelVm.pDoc.getElementById('openSidebarBtn').dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(noSidePanelVm.pDoc.getElementById('paneChat').hidden, false, 'Fallback without chrome.sidePanel must activate Chat tab');
  noSidePanelVm.pDoc.getElementById('popupChatInput').value = 'Hello on restricted page';
  noSidePanelVm.pDoc.getElementById('popupChatSendBtn').dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(noSidePanelVm.pDoc.getElementById('popupChatList').textContent.includes('PopupAI(chat)'));

  // Scenario C2: Native Side Panel (?mode=sidepanel) on normal HTTPS page
  const sidePanelVm = await bootPopupVm({
    search: '?mode=sidepanel',
    activeTab: { id: 103, windowId: 79, url: 'https://example.test/post', title: 'Article Post' },
    withSidePanelApi: true
  });
  const spDoc = sidePanelVm.pDoc;
  assert.equal(spDoc.documentElement.classList.contains('is-sidepanel'), true, '?mode=sidepanel must add html.is-sidepanel');
  assert.equal(spDoc.getElementById('openSidebarBtn').hidden, true, 'SidePanel mode hides duplicate #openSidebarBtn');
  assert.equal(spDoc.getElementById('paneChat').hidden, false, 'SidePanel mode defaults to AI Chat tab');
  assert.equal(spDoc.getElementById('paneTranslate').hidden, true);
  spDoc.getElementById('tabBtnTranslate').dispatchEvent({ type: 'click', bubbles: true });
  spDoc.getElementById('summarizePageBtn').dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(spDoc.getElementById('paneSummary').hidden, false, 'SidePanel #summarizePageBtn switches to Summary tab');
  assert.equal(sidePanelVm.getClosedCount(), 0, 'SidePanel mode must not close itself');
  assert.ok(
    sidePanelVm.runtimeMessages.some(
      (m) =>
        m.type === 'AI_CHAT' &&
        m.payload.taskType === 'summarize_page' &&
        m.payload.enableThinking === true &&
        m.payload.pageContext?.content === 'SidePanel extracted page body text' &&
        m.payload.pageContext?.images?.[0]?.url === 'https://example.test/sp-diagram.png'
    ),
    'SidePanel summary must fetch context (including images) via PAGE_GET_STATUS and forward enableThinking'
  );
  assert.equal(spDoc.getElementById('popupChatPageImgBadge').hidden, false, '#popupChatPageImgBadge must show detected page image count');
  assert.ok(spDoc.getElementById('popupChatPageImgBadge').textContent.includes('1'));

  // Round 7 Popup Codex engine switch & Options JSON credential import (synthetic JWT only)
  const popupEngineSelect = spDoc.getElementById('popupEngineSelect');
  popupEngineSelect.value = 'codex';
  popupEngineSelect.dispatchEvent({ type: 'change', bubbles: true });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(spDoc.getElementById('popupCodexRow').hidden, false, 'Selecting codex engine must show #popupCodexRow');
  const popupCodexModel = spDoc.getElementById('popupCodexModel');
  assert.ok(popupCodexModel.options.length >= 11, '#popupCodexModel must load all 11 Codex models');
  popupCodexModel.value = 'gpt-5.4';
  popupCodexModel.dispatchEvent({ type: 'change', bubbles: true });
  await new Promise((r) => setTimeout(r, 15));
  assert.ok(spDoc.getElementById('engineBadge').textContent.includes('Codex'), '#engineBadge must display Codex');

  const optionsHtmlSrc = readText('src/options/options.html');
  const optionsJsSrc = readText('src/options/options.js');
  const { doc: optDoc } = createDomEnvironment();
  loadHtmlIntoMockDoc(optDoc, optionsHtmlSrc);
  const optSavedPayloads = [];
  const optStore = { wt_settings: {} };
  const optSandbox = {
    document: optDoc,
    navigator: { clipboard: { writeText: async () => {} } },
    Uint8Array,
    TextDecoder,
    atob,
    decodeURIComponent,
    URL,
    console,
    setTimeout,
    clearTimeout,
    chrome: {
      storage: {
        sync: {
          get: (_k, cb) => {
            const out = { wt_settings: optStore.wt_settings };
            if (typeof cb === 'function') cb(out);
            return Promise.resolve(out);
          },
          set: (items, cb) => {
            Object.assign(optStore, items);
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          }
        },
        local: {
          get: (_k, cb) => {
            if (typeof cb === 'function') cb({});
            return Promise.resolve({});
          },
          set: (_items, cb) => {
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          }
        }
      },
      runtime: {
        sendMessage: async (msg) => {
          if (msg.type === 'SAVE_SETTINGS') {
            optSavedPayloads.push(msg.payload);
            optStore.wt_settings = Object.assign({}, optStore.wt_settings, msg.payload);
            return { ok: true, data: optStore.wt_settings };
          }
          if (msg.type === 'GET_SETTINGS') return { ok: true, data: optStore.wt_settings };
          return { ok: true, data: {} };
        }
      }
    }
  };
  optSandbox.window = optSandbox;
  optSandbox.globalThis = optSandbox;
  const optCtx = vm.createContext(optSandbox);
  vm.runInContext(configCodeForPopup, optCtx, { filename: 'src/shared/config.js' });
  vm.runInContext(optionsJsSrc, optCtx, { filename: 'src/options/options.js' });
  optDoc.dispatchEvent({ type: 'DOMContentLoaded' });
  await new Promise((r) => setTimeout(r, 25));

  const optCodexBtn = optDoc.querySelector('[data-engine="codex"]');
  assert.ok(optCodexBtn, 'options.html missing [data-engine="codex"] button');
  optCodexBtn.dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(optDoc.getElementById('codexConfigCard').hidden, false, 'Clicking codex card must reveal #codexConfigCard');

  const synthOptJwt = makeSyntheticCodexJwt({ accountId: 'acct_opt_999', planType: 'pro', email: 'opt@example.test' });
  optDoc.getElementById('codexAuthJsonInput').value = JSON.stringify({
    tokens: { access_token: synthOptJwt, refresh_token: 'rt_opt_synth', account_id: 'acct_opt_999' }
  });
  optDoc.getElementById('codexParseJsonBtn').dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(optDoc.getElementById('codexAuthJsonInput').value, '', 'Options must clear auth textarea immediately after import');
  const codexStatusBadge = optDoc.getElementById('codexAuthStatus').textContent;
  assert.ok(codexStatusBadge.includes('已授权'), `Expected 已授权 status badge, got: ${codexStatusBadge}`);
  assert.ok(!codexStatusBadge.includes(synthOptJwt), 'Status badge must NEVER echo raw JWT token');
  assert.equal(optStore.wt_settings.codexConfig?.accountId, 'acct_opt_999');

  // Verify #pageTargetLangGroup syncs with #targetLangGroup and dispatches forceRetranslate: true even on repeat clicks
  const langSyncOut = {};
  const langSyncModeMsgs = [];
  await bootPopupVm({
    search: '',
    activeTab: { id: 104, windowId: 80, url: 'https://devin.ai/', title: 'Devin' },
    withSidePanelApi: true,
    initialPageStatus: {
      isTranslated: true,
      translatedCount: 10,
      targetLang: 'zh-CN',
      displayMode: 'replace'
    },
    out: langSyncOut,
    onTabMessage: (msg) => {
      if (msg.type === 'PAGE_SET_MODE') {
        langSyncModeMsgs.push(msg.payload);
        return {
          ok: true,
          status: {
            isTranslated: true,
            translatedCount: 10,
            targetLang: msg.payload?.targetLang || 'zh-CN',
            displayMode: msg.payload?.displayMode || 'replace'
          }
        };
      }
      return undefined;
    }
  });
  const langDoc = langSyncOut.doc;
  const pageLangGroup = langDoc.getElementById('pageTargetLangGroup');
  const quickLangGroup = langDoc.getElementById('targetLangGroup');
  const getActiveLangIn = (grp) =>
    grp
      .querySelectorAll('[data-target-lang]')
      .find((btn) => btn.classList.contains('active'))
      ?.getAttribute('data-target-lang');

  assert.equal(getActiveLangIn(pageLangGroup), 'zh-CN');
  assert.equal(getActiveLangIn(quickLangGroup), 'zh-CN');

  pageLangGroup.querySelector('[data-target-lang="zh-TW"]').dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(getActiveLangIn(pageLangGroup), 'zh-TW');
  assert.equal(getActiveLangIn(quickLangGroup), 'zh-TW');
  assert.equal(langSyncModeMsgs[langSyncModeMsgs.length - 1]?.targetLang, 'zh-TW');
  assert.equal(langSyncModeMsgs[langSyncModeMsgs.length - 1]?.forceRetranslate, true);

  pageLangGroup.querySelector('[data-target-lang="zh-CN"]').dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(getActiveLangIn(pageLangGroup), 'zh-CN');
  assert.equal(getActiveLangIn(quickLangGroup), 'zh-CN');
  assert.equal(langSyncModeMsgs[langSyncModeMsgs.length - 1]?.targetLang, 'zh-CN');
  assert.equal(langSyncModeMsgs[langSyncModeMsgs.length - 1]?.forceRetranslate, true);

  const countBeforeRepeatClick = langSyncModeMsgs.length;
  pageLangGroup.querySelector('[data-target-lang="zh-CN"]').dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(langSyncModeMsgs.length, countBeforeRepeatClick + 1, 'Clicking active zh-CN must still dispatch PAGE_SET_MODE');
  assert.equal(langSyncModeMsgs[langSyncModeMsgs.length - 1]?.targetLang, 'zh-CN');
  assert.equal(langSyncModeMsgs[langSyncModeMsgs.length - 1]?.forceRetranslate, true);

  // Verify Popup / SidePanel historical webpage session save, search & restore
  const histPopupVm = await bootPopupVm({
    search: '?mode=sidepanel',
    activeTab: { id: 105, windowId: 81, url: 'https://example.test/post', title: 'Article Post' },
    withSidePanelApi: true
  });
  const hpDoc = histPopupVm.pDoc;
  hpDoc.getElementById('popupChatInput').value = 'Summarize this article post';
  hpDoc.getElementById('popupChatSendBtn').dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(hpDoc.getElementById('popupChatHistoryCount').textContent, '1', 'Popup chat send must auto-save webpage session');

  await histPopupVm.ctxVm.WT_CONFIG.saveChatSession({
    id: 'popup-devin-session',
    pageUrl: 'https://devin.ai/pricing',
    pageTitle: 'Devin Pricing',
    messages: [
      { role: 'user', content: 'Does enterprise plan have SSO?' },
      { role: 'assistant', content: 'Enterprise plan includes SSO and dedicated VPC support.' }
    ],
    updatedAt: Date.now() + 3000
  });

  hpDoc.getElementById('popupChatHistoryBtn').dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(hpDoc.getElementById('popupChatHistoryPanel').hidden, false);
  assert.equal(hpDoc.getElementById('popupChatHistoryCount').textContent, '2');

  const hpSearch = hpDoc.getElementById('popupChatHistorySearch');
  hpSearch.value = 'VPC support';
  hpSearch.dispatchEvent({ type: 'input', bubbles: true });
  await new Promise((r) => setTimeout(r, 25));
  const hpItems = hpDoc.getElementById('popupChatHistoryList').querySelectorAll('.chat-history-item');
  assert.equal(hpItems.length, 1, 'Popup history search must filter matching webpage sessions');
  assert.ok(hpItems[0].querySelector('.chat-history-snippet')?.textContent.includes('VPC support'));

  hpItems[0].dispatchEvent({ type: 'click', bubbles: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(hpDoc.getElementById('popupChatHistoryPanel').hidden, true);
  assert.equal(hpDoc.getElementById('popupChatSessionBanner').hidden, false);
  assert.ok(hpDoc.getElementById('popupChatSessionBannerText').textContent.includes('Devin Pricing'));
  assert.ok(hpDoc.getElementById('popupChatList').textContent.includes('Enterprise plan includes SSO and dedicated VPC support.'));

  hpDoc.getElementById('popupChatSessionExitBtn').dispatchEvent({ type: 'click', bubbles: true });
  assert.equal(hpDoc.getElementById('popupChatSessionBanner').hidden, true);
  assert.ok(hpDoc.getElementById('popupChatList').querySelector('.chat-empty-state'));

  return 'In-place replace, below-fold/scroll/dynamic DOM, Sider AI Sidebar, 4-Tab Popup/SidePanel & Codex Integration passed';
});

// ============================================================================
// Summary & Exit Code
// ============================================================================
const passedCount = results.filter((r) => r.passed).length;
const failedCount = results.length - passedCount;

console.log(`\nVerification Summary: ${passedCount}/${results.length} passed, ${failedCount} failed.`);
process.exit(failedCount === 0 ? 0 : 1);
