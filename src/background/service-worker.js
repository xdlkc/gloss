/**
 * Gloss MV3 Background Service Worker
 * Imports shared configuration (side-effect on globalThis.WT_CONFIG)
 * and the modular translation engine.
 */
import '../shared/config.js';
import {
  translateText,
  translateBatch,
  chatWithAI,
  fetchLoomModels,
  startCodexDeviceAuth,
  pollCodexDeviceAuthOnce,
  normalizeLangCode,
  normalizeTargetLang
} from './translator-engine.js';

const WT = globalThis.WT_CONFIG;

async function persistRefreshedCodexCredential(nextCred) {
  if (!nextCred || typeof nextCred !== 'object') return;
  try {
    const latest = await WT.getSettings();
    const prev = (latest && latest.codexConfig && typeof latest.codexConfig === 'object')
      ? latest.codexConfig
      : {};
    await WT.saveSettings({
      codexConfig: {
        ...prev,
        ...(nextCred.accessToken ? { accessToken: nextCred.accessToken } : {}),
        ...(nextCred.refreshToken ? { refreshToken: nextCred.refreshToken } : {}),
        ...(nextCred.accountId ? { accountId: nextCred.accountId } : {}),
        ...(typeof nextCred.expiresAt === 'number' && Number.isFinite(nextCred.expiresAt)
          ? { expiresAt: nextCred.expiresAt }
          : {}),
        ...(nextCred.email ? { email: nextCred.email } : {}),
        ...(nextCred.planType ? { planType: nextCred.planType } : {})
      }
    });
  } catch (err) {
    console.warn('[Gloss] Failed to persist refreshed Codex credential:', err);
  }
}

const CONTEXT_MENU_IDS = {
  PARENT: 'wt-context-parent',
  SELECTION_ZH_CN: 'wt-translate-zh-CN',
  SELECTION_ZH_TW: 'wt-translate-zh-TW',
  SELECTION_EN: 'wt-translate-en',
  SEPARATOR: 'wt-context-sep',
  TRANSLATE_PAGE: 'wt-translate-page',
  SEPARATOR_AI: 'wt-context-sep-ai',
  OPEN_SIDEBAR: 'wt-open-sidebar',
  SUMMARIZE_PAGE: 'wt-summarize-page',
  EXPLAIN_SELECTION: 'wt-explain-selection',
  POLISH_SELECTION: 'wt-polish-selection',
  ANALYZE_IMAGE: 'wt-context-analyze-image'
};

const SELECTION_MENU_TARGET_MAP = {
  [CONTEXT_MENU_IDS.SELECTION_ZH_CN]: 'zh-CN',
  [CONTEXT_MENU_IDS.SELECTION_ZH_TW]: 'zh-TW',
  [CONTEXT_MENU_IDS.SELECTION_EN]: 'en'
};

/**
 * Determine whether a tab URL allows content-script injection.
 * Allows http://, https://, file:// and excludes browser/extension/webstore pages.
 * @param {string} url
 * @returns {boolean}
 */
export function isInjectableTabUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (
    /^(chrome|edge|chrome-extension|moz-extension|devtools|view-source):\/\//i.test(trimmed) ||
    /^about:/i.test(trimmed)
  ) {
    return false;
  }
  if (!/^(https?|file):\/\//i.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'file:') {
      return true;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    if (host === 'chromewebstore.google.com') {
      return false;
    }
    if (host === 'chrome.google.com' && pathname.startsWith('/webstore')) {
      return false;
    }
    return Boolean(host);
  } catch (_) {
    return false;
  }
}

/**
 * Open Chrome native Side Panel immediately (preserving user gesture when called
 * without preceding awaits) and swallow errors in environments without chrome.sidePanel.
 */
function openNativeSidePanel(tab) {
  try {
    if (
      typeof chrome === 'undefined' ||
      !chrome.sidePanel ||
      typeof chrome.sidePanel.open !== 'function'
    ) {
      return Promise.resolve(false);
    }
    const openOptions =
      tab && typeof tab.windowId === 'number'
        ? { windowId: tab.windowId }
        : tab && typeof tab.id === 'number'
          ? { tabId: tab.id }
          : null;
    if (!openOptions) {
      return Promise.resolve(false);
    }
    const maybePromise = chrome.sidePanel.open(openOptions);
    if (maybePromise && typeof maybePromise.then === 'function') {
      return maybePromise.then(
        () => true,
        () => false
      );
    }
    return Promise.resolve(true);
  } catch (_) {
    return Promise.resolve(false);
  }
}

/**
 * Send a message to a tab's content script, injecting content scripts if needed
 * on eligible http(s)/file pages where the content script isn't attached yet.
 */
export async function sendMessageToTab(tabId, message, tabUrl = '') {
  if (typeof chrome === 'undefined' || !chrome.tabs || typeof tabId !== 'number') {
    return null;
  }

  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    const canInject = chrome.scripting && isInjectableTabUrl(tabUrl);

    if (!canInject) {
      return null;
    }

    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['src/content/content.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          'src/shared/config.js',
          'src/content/dom-translator.js',
          'src/content/selection-ui.js',
          'src/content/index.js'
        ]
      });
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (_) {
      return null;
    }
  }
}

/**
 * Register MV3 context menus cleanly (idempotent via removeAll).
 */
export function setupContextMenus() {
  if (typeof chrome === 'undefined' || !chrome.contextMenus) return;

  try {
    chrome.contextMenus.removeAll(() => {
      // Ignore lastError during teardown
      void chrome.runtime?.lastError;

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.PARENT,
        title: 'Gloss 网页翻译',
        contexts: ['page', 'selection', 'image']
      });

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.SELECTION_ZH_CN,
        parentId: CONTEXT_MENU_IDS.PARENT,
        title: '翻译选中文本为 简体中文',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.SELECTION_ZH_TW,
        parentId: CONTEXT_MENU_IDS.PARENT,
        title: '翻译选中文本为 繁體中文',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.SELECTION_EN,
        parentId: CONTEXT_MENU_IDS.PARENT,
        title: '翻译选中文本为 English',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.SEPARATOR,
        parentId: CONTEXT_MENU_IDS.PARENT,
        type: 'separator',
        contexts: ['page', 'selection']
      });

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.TRANSLATE_PAGE,
        parentId: CONTEXT_MENU_IDS.PARENT,
        title: '翻译当前网页',
        contexts: ['page', 'selection']
      });

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.SEPARATOR_AI,
        parentId: CONTEXT_MENU_IDS.PARENT,
        type: 'separator',
        contexts: ['page', 'selection']
      });

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.OPEN_SIDEBAR,
        parentId: CONTEXT_MENU_IDS.PARENT,
        title: '打开 AI 侧边栏助手 (Alt+S)',
        contexts: ['page', 'selection']
      });

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.SUMMARIZE_PAGE,
        parentId: CONTEXT_MENU_IDS.PARENT,
        title: 'AI 总结当前网页',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.EXPLAIN_SELECTION,
        parentId: CONTEXT_MENU_IDS.PARENT,
        title: 'AI 解释选中文本',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.POLISH_SELECTION,
        parentId: CONTEXT_MENU_IDS.PARENT,
        title: 'AI 润色选中文本',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.ANALYZE_IMAGE,
        parentId: CONTEXT_MENU_IDS.PARENT,
        title: 'AI 解读此图片',
        contexts: ['image']
      });
    });
  } catch (err) {
    console.warn('[Gloss] Failed to register context menus:', err);
  }
}

function dispatchChatStreamProgress(streamId, sender, prog) {
  if (!streamId || !prog) return;
  const progressMessage = {
    type: WT?.MESSAGE_TYPES?.SIDEBAR_ACTION || 'SIDEBAR_ACTION',
    payload: {
      action: 'stream_progress',
      streamId,
      reasoning: prog.reasoning || '',
      reply: prog.reply || '',
      thinkingMs: prog.thinkingMs || 0,
      model: prog.model || ''
    }
  };

  const tabId = sender?.tab?.id;
  if (typeof tabId === 'number' && typeof chrome !== 'undefined' && typeof chrome?.tabs?.sendMessage === 'function') {
    try {
      const p = chrome.tabs.sendMessage(tabId, progressMessage);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {
      // Ignore closed tab channel
    }
  }

  if (typeof chrome !== 'undefined' && typeof chrome?.runtime?.sendMessage === 'function') {
    try {
      const p = chrome.runtime.sendMessage(progressMessage);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {
      // Ignore closed extension view channel
    }
  }
}

/**
 * Handle background message types in the Shared Contract.
 * @param {object} message
 * @param {chrome.runtime.MessageSender|null} [sender]
 * @returns {Promise<object>}
 */
export async function handleBackgroundMessage(message, sender = null) {
  if (!message || typeof message !== 'object' || !message.type) {
    return { ok: false, error: 'Invalid message payload' };
  }

  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};

  try {
    switch (message.type) {
      case 'TRANSLATE_TEXT': {
        const text = typeof payload.text === 'string' ? payload.text : '';
        if (!text.trim()) {
          return { ok: false, error: '翻译文本不能为空' };
        }
        const settings = await WT.getSettings();
        const sourceLang = payload.sourceLang || settings.sourceLang || 'auto';
        const targetLang = normalizeTargetLang(payload.targetLang || settings.targetLang || 'zh-CN');
        const engine = payload.engine || settings.engine || 'google-free';
        const codexConfig = {
          ...settings.codexConfig,
          ...(payload.codexConfig && typeof payload.codexConfig === 'object' ? payload.codexConfig : {})
        };

        const result = await translateText({
          text,
          sourceLang,
          targetLang,
          engine,
          openaiConfig: payload.openaiConfig || settings.openaiConfig,
          loomConfig: payload.loomConfig || settings.loomConfig,
          codexConfig,
          onTokenRefreshed: persistRefreshedCodexCredential
        });

        if (payload.saveHistory) {
          await WT.addHistoryItem({
            text,
            translatedText: result.translatedText,
            detectedSourceLang: result.detectedSourceLang,
            sourceLang: normalizeLangCode(sourceLang, 'google'),
            targetLang,
            engine: result.engine
          });
        }

        return {
          ok: true,
          data: {
            translatedText: result.translatedText,
            detectedSourceLang: result.detectedSourceLang,
            engine: result.engine
          }
        };
      }

      case 'TRANSLATE_BATCH': {
        const texts = Array.isArray(payload.texts) ? payload.texts : [];
        if (texts.length === 0) {
          return {
            ok: true,
            data: {
              translations: [],
              detectedSourceLangs: [],
              engine: payload.engine || 'google-free'
            }
          };
        }
        const settings = await WT.getSettings();
        const sourceLang = payload.sourceLang || settings.sourceLang || 'auto';
        const targetLang = normalizeTargetLang(payload.targetLang || settings.targetLang || 'zh-CN');
        const engine = payload.engine || settings.engine || 'google-free';
        const codexConfig = {
          ...settings.codexConfig,
          ...(payload.codexConfig && typeof payload.codexConfig === 'object' ? payload.codexConfig : {})
        };

        const result = await translateBatch({
          texts,
          sourceLang,
          targetLang,
          engine,
          openaiConfig: payload.openaiConfig || settings.openaiConfig,
          loomConfig: payload.loomConfig || settings.loomConfig,
          codexConfig,
          onTokenRefreshed: persistRefreshedCodexCredential
        });

        return {
          ok: true,
          data: {
            translations: result.translations,
            detectedSourceLangs: result.detectedSourceLangs,
            engine: result.engine
          }
        };
      }

      case 'GET_SETTINGS': {
        const settings = await WT.getSettings();
        return { ok: true, data: settings };
      }

      case 'SAVE_SETTINGS': {
        const merged = await WT.saveSettings(payload);
        return { ok: true, data: merged };
      }

      case 'GET_HISTORY': {
        if (payload.kind === 'chat_sessions') {
          if (payload.action === 'save' && payload.session) {
            const session = await WT.saveChatSession(payload.session);
            const data = await WT.getChatSessions({
              query: payload.query || '',
              pageUrl: payload.pageUrl || ''
            });
            return { ok: true, kind: 'chat_sessions', data, session };
          }
          if (payload.action === 'delete' && payload.sessionId) {
            const data = await WT.deleteChatSession(payload.sessionId);
            return { ok: true, kind: 'chat_sessions', data };
          }
          const data = await WT.getChatSessions({
            query: payload.query || '',
            pageUrl: payload.pageUrl || '',
            limit: payload.limit
          });
          return { ok: true, kind: 'chat_sessions', data };
        }
        const history = await WT.getHistory();
        return { ok: true, data: history };
      }

      case 'CLEAR_HISTORY': {
        if (payload.kind === 'chat_sessions') {
          const empty = await WT.clearChatSessions();
          return { ok: true, kind: 'chat_sessions', data: empty };
        }
        const empty = await WT.clearHistory();
        return { ok: true, data: empty };
      }

      case 'TEST_ENGINE': {
        if (payload.action === 'codex_device_start') {
          const deviceAuth = await startCodexDeviceAuth();
          return {
            ok: true,
            data: deviceAuth
          };
        }
        if (payload.action === 'codex_device_poll') {
          const deviceAuthId = typeof payload.deviceAuthId === 'string' ? payload.deviceAuthId.trim() : '';
          const userCode = typeof payload.userCode === 'string' ? payload.userCode.trim() : '';
          if (!deviceAuthId || !userCode) {
            return { ok: false, error: '缺少 deviceAuthId 或 userCode' };
          }
          const pollResult = await pollCodexDeviceAuthOnce(deviceAuthId, userCode);
          if (pollResult && pollResult.status === 'complete' && pollResult.credential) {
            await persistRefreshedCodexCredential(pollResult.credential);
          }
          return {
            ok: true,
            data: pollResult
          };
        }

        const settings = await WT.getSettings();
        const engine = payload.engine || settings.engine || 'google-free';
        const openaiConfig = {
          ...settings.openaiConfig,
          ...(payload.openaiConfig && typeof payload.openaiConfig === 'object' ? payload.openaiConfig : {})
        };
        const loomConfig = {
          ...settings.loomConfig,
          ...(payload.loomConfig && typeof payload.loomConfig === 'object' ? payload.loomConfig : {})
        };
        const codexConfig = {
          ...settings.codexConfig,
          ...(payload.codexConfig && typeof payload.codexConfig === 'object' ? payload.codexConfig : {})
        };

        const start = Date.now();
        const res = await translateText({
          text: 'Hello, world!',
          sourceLang: 'en',
          targetLang: 'zh-CN',
          engine,
          openaiConfig,
          loomConfig,
          codexConfig,
          onTokenRefreshed: persistRefreshedCodexCredential,
          skipCache: true,
          allowOfflineFallback: false
        });
        const latencyMs = Math.max(1, Date.now() - start);

        return {
          ok: true,
          data: {
            translatedText: res.translatedText,
            latencyMs
          }
        };
      }

      case 'FETCH_LOOM_MODELS': {
        const settings = await WT.getSettings();
        const baseUrl = payload.baseUrl || settings.loomConfig?.baseUrl || 'http://127.0.0.1:4319/v1';
        const apiKey = payload.apiKey !== undefined ? payload.apiKey : (settings.loomConfig?.apiKey || '');
        const presetProviders = Array.isArray(WT?.LOOM_PRESET_PROVIDERS) ? WT.LOOM_PRESET_PROVIDERS : [];

        try {
          const providers = await fetchLoomModels({ baseUrl, apiKey });
          if (Array.isArray(providers) && providers.length > 0) {
            return {
              ok: true,
              data: {
                providers,
                source: 'live'
              }
            };
          }
          return {
            ok: true,
            data: {
              providers: presetProviders,
              source: 'preset',
              warning: 'Loom 网关未返回可用模型列表，已加载本地预设供应商与模型列表',
              code: 'EMPTY_MODELS'
            }
          };
        } catch (err) {
          return {
            ok: true,
            data: {
              providers: presetProviders,
              source: 'preset',
              warning: err && err.message ? err.message : String(err),
              code: (err && err.code) || 'LOOM_UNAVAILABLE'
            }
          };
        }
      }

      case 'AI_CHAT': {
        const settings = await WT.getSettings();
        const targetLang = normalizeTargetLang(payload.targetLang || settings.targetLang || 'zh-CN');
        const engine = payload.engine || settings.engine || 'google-free';
        const loomConfig = {
          ...settings.loomConfig,
          ...(payload.loomConfig && typeof payload.loomConfig === 'object' ? payload.loomConfig : {}),
          ...(payload.provider && payload.provider !== 'codex' ? { provider: payload.provider } : {})
        };
        const openaiConfig = {
          ...settings.openaiConfig,
          ...(payload.openaiConfig && typeof payload.openaiConfig === 'object' ? payload.openaiConfig : {})
        };
        const codexConfig = {
          ...settings.codexConfig,
          ...(payload.codexConfig && typeof payload.codexConfig === 'object' ? payload.codexConfig : {})
        };
        const streamId = typeof payload.streamId === 'string' ? payload.streamId.trim() : '';
        const wantStream = Boolean(payload.stream || streamId);

        const data = await chatWithAI({
          messages: payload.messages,
          prompt: payload.prompt,
          taskType: payload.taskType || 'chat',
          selectionText: payload.selectionText,
          pageContext: payload.pageContext || null,
          images: Array.isArray(payload.images) ? payload.images : undefined,
          enableThinking: payload.enableThinking,
          reasoningEffort: payload.reasoningEffort,
          targetLang,
          engine,
          model: payload.model,
          provider: payload.provider,
          loomConfig,
          openaiConfig,
          codexConfig,
          stream: wantStream,
          onProgress: wantStream
            ? (prog) => dispatchChatStreamProgress(streamId, sender, prog)
            : undefined,
          onTokenRefreshed: persistRefreshedCodexCredential,
          forceFallback: payload.forceFallback,
          offline: payload.offline
        });

        return {
          ok: true,
          data
        };
      }

      default:
        return null;
    }
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : String(err),
      ...(err && err.code ? { code: err.code } : {})
    };
  }
}

const HANDLED_TYPES = new Set([
  'TRANSLATE_TEXT',
  'TRANSLATE_BATCH',
  'GET_SETTINGS',
  'SAVE_SETTINGS',
  'GET_HISTORY',
  'CLEAR_HISTORY',
  'TEST_ENGINE',
  'FETCH_LOOM_MODELS',
  'AI_CHAT'
]);

if (typeof chrome !== 'undefined' && chrome.runtime) {
  if (chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
      setupContextMenus();
    });
  }

  if (chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
      setupContextMenus();
    });
  }

  if (chrome.contextMenus?.onClicked) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (!tab || typeof tab.id !== 'number') return;

      const targetLang = SELECTION_MENU_TARGET_MAP[info.menuItemId];
      if (targetLang) {
        const text = (info.selectionText || '').trim();
        if (!text) return;
        await sendMessageToTab(
          tab.id,
          {
            type: 'SHOW_SELECTION_TRANSLATION',
            payload: { text, targetLang }
          },
          tab.url || ''
        );
        return;
      }

      if (info.menuItemId === CONTEXT_MENU_IDS.TRANSLATE_PAGE) {
        const settings = await WT.getSettings();
        await sendMessageToTab(
          tab.id,
          {
            type: 'PAGE_TRANSLATE_TOGGLE',
            payload: {
              targetLang: settings.targetLang,
              displayMode: settings.displayMode
            }
          },
          tab.url || ''
        );
        return;
      }

      if (info.menuItemId === CONTEXT_MENU_IDS.OPEN_SIDEBAR) {
        const tabUrl = tab.url || tab.pendingUrl || '';
        if (!isInjectableTabUrl(tabUrl)) {
          await openNativeSidePanel(tab);
          return;
        }
        const response = await sendMessageToTab(
          tab.id,
          {
            type: WT?.MESSAGE_TYPES?.SIDEBAR_TOGGLE || 'SIDEBAR_TOGGLE',
            payload: { open: true }
          },
          tabUrl
        );
        if (!response) {
          await openNativeSidePanel(tab);
        }
        return;
      }

      if (info.menuItemId === CONTEXT_MENU_IDS.SUMMARIZE_PAGE) {
        const tabUrl = tab.url || tab.pendingUrl || '';
        if (!isInjectableTabUrl(tabUrl)) {
          await openNativeSidePanel(tab);
          return;
        }
        const response = await sendMessageToTab(
          tab.id,
          {
            type: WT?.MESSAGE_TYPES?.SIDEBAR_ACTION || 'SIDEBAR_ACTION',
            payload: { action: 'summarize_page', tab: 'summary', autoRun: true }
          },
          tabUrl
        );
        if (!response) {
          await openNativeSidePanel(tab);
        }
        return;
      }

      if (info.menuItemId === CONTEXT_MENU_IDS.EXPLAIN_SELECTION) {
        const text = (info.selectionText || '').trim();
        if (!text) return;
        const tabUrl = tab.url || tab.pendingUrl || '';
        if (!isInjectableTabUrl(tabUrl)) {
          await openNativeSidePanel(tab);
          return;
        }
        const response = await sendMessageToTab(
          tab.id,
          {
            type: WT?.MESSAGE_TYPES?.SIDEBAR_ACTION || 'SIDEBAR_ACTION',
            payload: { action: 'explain', text, tab: 'chat', autoRun: true }
          },
          tabUrl
        );
        if (!response) {
          await openNativeSidePanel(tab);
        }
        return;
      }

      if (info.menuItemId === CONTEXT_MENU_IDS.POLISH_SELECTION) {
        const text = (info.selectionText || '').trim();
        if (!text) return;
        const tabUrl = tab.url || tab.pendingUrl || '';
        if (!isInjectableTabUrl(tabUrl)) {
          await openNativeSidePanel(tab);
          return;
        }
        const response = await sendMessageToTab(
          tab.id,
          {
            type: WT?.MESSAGE_TYPES?.SIDEBAR_ACTION || 'SIDEBAR_ACTION',
            payload: { action: 'polish', text, tab: 'write', autoRun: true }
          },
          tabUrl
        );
        if (!response) {
          await openNativeSidePanel(tab);
        }
        return;
      }

      if (info.menuItemId === CONTEXT_MENU_IDS.ANALYZE_IMAGE) {
        const imageUrl = (info.srcUrl || '').trim();
        if (!imageUrl) return;
        const tabUrl = tab.url || tab.pendingUrl || '';
        if (!isInjectableTabUrl(tabUrl)) {
          await openNativeSidePanel(tab);
          return;
        }
        const response = await sendMessageToTab(
          tab.id,
          {
            type: WT?.MESSAGE_TYPES?.SIDEBAR_ACTION || 'SIDEBAR_ACTION',
            payload: { action: 'analyze_image', imageUrl, tab: 'chat', autoRun: true }
          },
          tabUrl
        );
        if (!response) {
          await openNativeSidePanel(tab);
        }
      }
    });
  }

  if (chrome.commands?.onCommand) {
    chrome.commands.onCommand.addListener(async (command, cmdTab) => {
      if (command !== 'toggle-page-translate' && command !== 'toggle-ai-sidebar') return;
      try {
        let tab = cmdTab && typeof cmdTab.id === 'number' ? cmdTab : null;
        if (!tab) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          tab = tabs && tabs[0];
        }
        if (!tab || typeof tab.id !== 'number') return;

        if (command === 'toggle-ai-sidebar') {
          const tabUrl = tab.url || tab.pendingUrl || '';
          if (!isInjectableTabUrl(tabUrl)) {
            await openNativeSidePanel(tab);
            return;
          }
          const response = await sendMessageToTab(
            tab.id,
            {
              type: WT?.MESSAGE_TYPES?.SIDEBAR_TOGGLE || 'SIDEBAR_TOGGLE',
              payload: {}
            },
            tabUrl
          );
          if (!response) {
            await openNativeSidePanel(tab);
          }
          return;
        }

        const settings = await WT.getSettings();
        await sendMessageToTab(
          tab.id,
          {
            type: 'PAGE_TRANSLATE_TOGGLE',
            payload: {
              targetLang: settings.targetLang,
              displayMode: settings.displayMode
            }
          },
          tab.url || ''
        );
      } catch (err) {
        console.warn('[Gloss] Command handler failed:', err);
      }
    });
  }

  if (chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !HANDLED_TYPES.has(message.type)) {
        return false;
      }

      handleBackgroundMessage(message, sender)
        .then((result) => {
          try {
            sendResponse(result || { ok: false, error: 'Unknown background response' });
          } catch (_) {
            // Receiver channel may have closed
          }
        })
        .catch((err) => {
          try {
            sendResponse({
              ok: false,
              error: err && err.message ? err.message : String(err)
            });
          } catch (_) {
            // Receiver channel may have closed
          }
        });

      return true;
    });
  }
}
