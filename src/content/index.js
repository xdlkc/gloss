(function (global) {
  'use strict';

  const WTContent = (global.WTContent = global.WTContent || {});

  // Guard against duplicate injection on the same page
  if (global.__WT_CONTENT_CONTROLLER__ && typeof global.__WT_CONTENT_CONTROLLER__.destroy === 'function') {
    try {
      global.__WT_CONTENT_CONTROLLER__.destroy();
    } catch (_) {
      // Ignore cleanup errors
    }
  }

  function getDefaultSettings() {
    const cfg = global.WT_CONFIG && global.WT_CONFIG.DEFAULT_SETTINGS;
    const base = {
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      displayMode: 'replace',
      engine: 'google-free',
      selectionMode: 'icon',
      showFloatingBall: true,
      altHoverTranslate: true,
      translationStyle: 'default',
      excludedDomains: [],
      loomConfig: {
        baseUrl: 'http://127.0.0.1:4319/v1',
        apiKey: '',
        provider: 'zenmux',
        model: 'zenmux/anthropic/claude-sonnet-5.5'
      },
      codexConfig: {
        baseUrl: 'https://chatgpt.com/backend-api',
        model: 'gpt-5.6-luna',
        reasoningEffort: 'low',
        accessToken: '',
        refreshToken: '',
        accountId: '',
        expiresAt: 0,
        email: '',
        planType: ''
      },
      openaiConfig: {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-4o-mini'
      }
    };
    if (!cfg) return base;
    const clonedCfg = JSON.parse(JSON.stringify(cfg));
    return Object.assign({}, base, clonedCfg, {
      loomConfig: Object.assign({}, base.loomConfig, clonedCfg.loomConfig || {}),
      codexConfig: Object.assign({}, base.codexConfig, clonedCfg.codexConfig || {}),
      openaiConfig: Object.assign({}, base.openaiConfig, clonedCfg.openaiConfig || {})
    });
  }

  function getSettingsStorageKey() {
    const keys = global.WT_CONFIG && global.WT_CONFIG.STORAGE_KEYS;
    return (keys && keys.SETTINGS) || 'wt_settings';
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === 'undefined' ||
        !chrome.runtime ||
        typeof chrome.runtime.sendMessage !== 'function'
      ) {
        reject(new Error('chrome.runtime.sendMessage 不可用'));
        return;
      }

      let settled = false;
      const finish = (response) => {
        if (settled) return;
        settled = true;
        const lastError = chrome.runtime && chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message || String(lastError)));
        } else {
          resolve(response);
        }
      };

      try {
        const maybePromise = chrome.runtime.sendMessage(message, (response) => {
          finish(response);
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(finish, (err) => {
            if (!settled) {
              settled = true;
              reject(err);
            }
          });
        }
      } catch (err) {
        if (!settled) {
          settled = true;
          reject(err);
        }
      }
    });
  }

  function normalizeHostPattern(entry) {
    if (!entry || typeof entry !== 'string') return '';
    let raw = entry.trim().toLowerCase();
    if (!raw) return '';
    raw = raw.replace(/^[a-z]+:\/\//, '');
    raw = raw.split('/')[0].split(':')[0];
    raw = raw.replace(/^\*\./, '');
    return raw;
  }

  function isDomainExcluded(hostname, excludedDomains) {
    const host = (hostname || '').toLowerCase();
    if (!host || !Array.isArray(excludedDomains) || excludedDomains.length === 0) {
      return false;
    }
    for (let i = 0; i < excludedDomains.length; i += 1) {
      const pattern = normalizeHostPattern(excludedDomains[i]);
      if (!pattern) continue;
      if (host === pattern || host.endsWith('.' + pattern)) {
        return true;
      }
    }
    return false;
  }

  function getCurrentHostname() {
    try {
      return (global.location && global.location.hostname) || '';
    } catch (_) {
      return '';
    }
  }

  let settings = getDefaultSettings();
  let excluded = isDomainExcluded(getCurrentHostname(), settings.excludedDomains);
  let initialized = false;
  let initPromise = null;

  const domTranslator = WTContent.createDOMTranslator({
    sendMessage: sendRuntimeMessage,
    settings,
    isExcluded: excluded,
    onStatusChange: (status) => {
      if (selectionUI) {
        selectionUI.syncPageStatus(status);
      }
    }
  });

  const selectionUI = WTContent.createSelectionUI({
    sendMessage: sendRuntimeMessage,
    settings,
    isExcluded: excluded,
    onTogglePage: () => {
      togglePageTranslation();
    },
    onChangeDisplayMode: (displayMode) => {
      setMode({ displayMode }).then(() => applyAndPersistSettings({ displayMode }));
    },
    onChangeTargetLang: (targetLang) => {
      setMode({ targetLang, forceRetranslate: true }).then(() =>
        applyAndPersistSettings({ targetLang })
      );
    },
    onSaveSettings: (partial) => {
      applyAndPersistSettings(partial);
    }
  });

  function applySettingsObject(nextRaw) {
    const defaults = getDefaultSettings();
    const merged = Object.assign({}, defaults, nextRaw || {});
    merged.loomConfig = Object.assign(
      {},
      defaults.loomConfig || {},
      (nextRaw && nextRaw.loomConfig) || {}
    );
    merged.codexConfig = Object.assign(
      {},
      defaults.codexConfig || {},
      (nextRaw && nextRaw.codexConfig) || {}
    );
    merged.openaiConfig = Object.assign(
      {},
      defaults.openaiConfig || {},
      (nextRaw && nextRaw.openaiConfig) || {}
    );
    settings = merged;
    excluded = isDomainExcluded(getCurrentHostname(), settings.excludedDomains);
    domTranslator.updateSettings(settings, excluded);
    selectionUI.updateSettings(settings, excluded);
    selectionUI.syncPageStatus(domTranslator.getStatus());
  }

  async function applyAndPersistSettings(partial) {
    const nextPatch = Object.assign({}, partial || {});
    if (partial && partial.loomConfig) {
      nextPatch.loomConfig = Object.assign({}, settings.loomConfig || {}, partial.loomConfig);
    }
    if (partial && partial.codexConfig) {
      nextPatch.codexConfig = Object.assign({}, settings.codexConfig || {}, partial.codexConfig);
    }
    if (partial && partial.openaiConfig) {
      nextPatch.openaiConfig = Object.assign({}, settings.openaiConfig || {}, partial.openaiConfig);
    }
    const merged = Object.assign({}, settings, nextPatch);
    applySettingsObject(merged);
    try {
      const res = await sendRuntimeMessage({
        type: 'SAVE_SETTINGS',
        payload: nextPatch
      });
      if (res && res.ok && res.data) {
        applySettingsObject(res.data);
      }
    } catch (_) {
      // Keep local state even if background storage is temporarily unreachable
    }
  }

  async function loadInitialSettings() {
    if (initialized) return settings;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 800));
        const res = await Promise.race([
          sendRuntimeMessage({ type: 'GET_SETTINGS' }).catch(() => null),
          timeout
        ]);
        if (res && res.ok && res.data) {
          applySettingsObject(res.data);
        }
      } catch (_) {
        // Fallback cleanly to defaults
      }
      initialized = true;
      selectionUI.syncPageStatus(domTranslator.getStatus());
      return settings;
    })();

    return initPromise;
  }

  function mergeOverridesIntoSettings(payload) {
    if (!payload || typeof payload !== 'object') return;
    const patch = {};
    if (payload.sourceLang) patch.sourceLang = payload.sourceLang;
    if (payload.targetLang) patch.targetLang = payload.targetLang;
    if (payload.displayMode) patch.displayMode = payload.displayMode;
    if (payload.engine) patch.engine = payload.engine;
    if (payload.translationStyle) patch.translationStyle = payload.translationStyle;
    if (payload.loomConfig) {
      patch.loomConfig = Object.assign({}, settings.loomConfig || {}, payload.loomConfig);
    }
    if (payload.codexConfig) {
      patch.codexConfig = Object.assign({}, settings.codexConfig || {}, payload.codexConfig);
    }
    if (payload.openaiConfig) {
      patch.openaiConfig = Object.assign({}, settings.openaiConfig || {}, payload.openaiConfig);
    }
    if (Object.keys(patch).length > 0) {
      applySettingsObject(Object.assign({}, settings, patch));
    }
  }

  async function startPageTranslation(payload) {
    await loadInitialSettings();
    mergeOverridesIntoSettings(payload);
    const status = domTranslator.translatePage(payload || {});
    selectionUI.syncPageStatus(status);
    return status;
  }

  async function restorePage() {
    await loadInitialSettings();
    const status = domTranslator.restorePage();
    selectionUI.syncPageStatus(status);
    return status;
  }

  async function togglePageTranslation(payload) {
    await loadInitialSettings();
    const current = domTranslator.getStatus();
    if (current.isTranslated) {
      return restorePage();
    }
    return startPageTranslation(payload);
  }

  async function setMode(payload) {
    await loadInitialSettings();
    const nextPayload = Object.assign({}, payload || {});
    const status = domTranslator.setMode(nextPayload);
    mergeOverridesIntoSettings(nextPayload);
    selectionUI.syncPageStatus(status);
    return status;
  }

  function getStatus() {
    return domTranslator.getStatus();
  }

  async function showSelectionTranslation(payload) {
    await loadInitialSettings();
    selectionUI.showSelectionTranslation(payload || {});
    return domTranslator.getStatus();
  }

  async function handleMessage(message) {
    if (!message || !message.type) {
      return { ok: false, error: '无效消息' };
    }

    const payload = message.payload || {};

    switch (message.type) {
      case 'PAGE_TRANSLATE_START': {
        const status = await startPageTranslation(payload);
        return { ok: true, status };
      }
      case 'PAGE_TRANSLATE_RESTORE': {
        const status = await restorePage();
        return { ok: true, status };
      }
      case 'PAGE_TRANSLATE_TOGGLE': {
        const status = await togglePageTranslation(payload);
        return { ok: true, status };
      }
      case 'PAGE_SET_MODE': {
        const status = await setMode(payload);
        return { ok: true, status };
      }
      case 'PAGE_GET_STATUS': {
        await loadInitialSettings();
        const status = getStatus();
        if (payload && payload.includeContext === true) {
          const pageContext =
            selectionUI && typeof selectionUI.extractPageContext === 'function'
              ? selectionUI.extractPageContext()
              : null;
          return {
            ok: true,
            status: Object.assign({}, status, { pageContext })
          };
        }
        return { ok: true, status };
      }
      case 'SHOW_SELECTION_TRANSLATION': {
        const status = await showSelectionTranslation(payload);
        return { ok: true, status };
      }
      case 'SIDEBAR_TOGGLE': {
        await loadInitialSettings();
        selectionUI.toggleSidebar(payload || {});
        return { ok: true, sidebarOpen: selectionUI.isSidebarOpen() };
      }
      case 'SIDEBAR_ACTION': {
        if (payload && payload.action === 'stream_progress') {
          selectionUI.openSidebarAction(payload);
          return { ok: true };
        }
        await loadInitialSettings();
        selectionUI.openSidebarAction(payload || {});
        return { ok: true, sidebarOpen: selectionUI.isSidebarOpen() };
      }
      default:
        return null;
    }
  }

  const CONTENT_MESSAGE_TYPES = new Set([
    'PAGE_TRANSLATE_START',
    'PAGE_TRANSLATE_RESTORE',
    'PAGE_TRANSLATE_TOGGLE',
    'PAGE_SET_MODE',
    'PAGE_GET_STATUS',
    'SHOW_SELECTION_TRANSLATION',
    'SIDEBAR_TOGGLE',
    'SIDEBAR_ACTION'
  ]);

  function onRuntimeMessage(message, _sender, sendResponse) {
    if (!message || !CONTENT_MESSAGE_TYPES.has(message.type)) {
      return false;
    }
    handleMessage(message)
      .then((res) => sendResponse(res))
      .catch((err) => {
        sendResponse({
          ok: false,
          error: err && err.message ? err.message : String(err)
        });
      });
    return true;
  }

  function onStorageChanged(changes, areaName) {
    if (!changes) return;
    if (areaName && areaName !== 'sync' && areaName !== 'local') return;
    const key = getSettingsStorageKey();
    if (changes[key] && changes[key].newValue) {
      applySettingsObject(changes[key].newValue);
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(onStorageChanged);
  }

  function destroy() {
    if (
      typeof chrome !== 'undefined' &&
      chrome.runtime &&
      chrome.runtime.onMessage &&
      typeof chrome.runtime.onMessage.removeListener === 'function'
    ) {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    }
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.onChanged &&
      typeof chrome.storage.onChanged.removeListener === 'function'
    ) {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    }
    domTranslator.destroy();
    selectionUI.destroy();
  }

  const controller = {
    startPageTranslation,
    restorePage,
    togglePageTranslation,
    setMode,
    getStatus,
    showSelectionTranslation,
    toggleSidebar: (opts) => selectionUI.toggleSidebar(opts || {}),
    openSidebarAction: (opts) => selectionUI.openSidebarAction(opts || {}),
    isSidebarOpen: () => selectionUI.isSidebarOpen(),
    extractPageContext: () => selectionUI.extractPageContext(),
    getSettings: () => Object.assign({}, settings),
    updateSettings: applyAndPersistSettings,
    isExcluded: () => excluded,
    handleMessage,
    destroy
  };

  global.__WT_CONTENT_CONTROLLER__ = controller;
  global.__WT_CONTENT_API__ = controller;
  WTContent.controller = controller;
  WTContent.init = loadInitialSettings;

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadInitialSettings();
    });
  } else {
    loadInitialSettings();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
