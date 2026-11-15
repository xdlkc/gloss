(function () {
  'use strict';

  const WT = globalThis.WT_CONFIG || {};

  const FALLBACK_SOURCE_LANGUAGES = [
    { code: 'auto', label: '自动检测 · 任意语言' },
    { code: 'en', label: 'English (英语)' },
    { code: 'zh-CN', label: '简体中文' },
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'ja', label: '日本語 (日语)' },
    { code: 'ko', label: '한국어 (韩语)' },
    { code: 'fr', label: 'Français (法语)' },
    { code: 'de', label: 'Deutsch (德语)' },
    { code: 'es', label: 'Español (西班牙语)' },
    { code: 'ru', label: 'Русский (俄语)' },
    { code: 'pt', label: 'Português (葡萄牙语)' },
    { code: 'ar', label: 'العربية (阿拉伯语)' }
  ];

  const FALLBACK_DEFAULT_SETTINGS = {
    sourceLang: 'auto',
    targetLang: 'zh-CN',
    displayMode: 'replace',
    engine: 'google-free',
    selectionMode: 'icon',
    showFloatingBall: true,
    altHoverTranslate: true,
    translationStyle: 'default',
    excludedDomains: [],
    openaiConfig: {
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      model: 'gpt-4o-mini'
    },
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
    }
  };

  const FALLBACK_CODEX_PRESET_MODELS = [
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna (默认推荐)' },
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' },
    { id: 'gpt-6-luna', name: 'GPT-6 Luna' },
    { id: 'gpt-6-sol', name: 'GPT-6 Sol' },
    { id: 'gpt-6-astra', name: 'GPT-6 Astra' },
    { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' },
    { id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra' },
    { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex' },
    { id: 'gpt-5.4', name: 'GPT-5.4' },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' }
  ];

  const FALLBACK_LOOM_PRESET_PROVIDERS = [
    {
      id: 'zenmux',
      name: 'ZenMux',
      billing: 'ZenMux 聚合',
      models: [
        { id: 'zenmux/anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5' },
        { id: 'zenmux/meta/muse-wonder-1.0', name: 'Muse Wonder 1.0' },
        { id: 'zenmux/inclusionai/ling-3.1-flash', name: 'Ling 3.1 Flash' },
        { id: 'zenmux/xiaomi/mimo-v2.6-flash', name: 'MiMo v2.6 Flash' },
        { id: 'zenmux/xiaomi/mimo-v2.6-pro', name: 'MiMo v2.6 Pro' }
      ]
    },
    {
      id: 'glm',
      name: 'GLM 国内 Coding Plan',
      billing: 'Coding Plan',
      models: [
        { id: 'glm/glm-5.3', name: 'GLM-5.3' },
        { id: 'glm/glm-5.3-flash', name: 'GLM-5.3 Flash' },
        { id: 'glm/glm-5.3-flashx', name: 'GLM-5.3 FlashX' },
        { id: 'glm/glm-5.2', name: 'GLM-5.2' },
        { id: 'glm/glm-5.1', name: 'GLM-5.1' },
        { id: 'glm/glm-5-turbo', name: 'GLM-5 Turbo' },
        { id: 'glm/glm-5', name: 'GLM-5' },
        { id: 'glm/glm-4.7', name: 'GLM-4.7' },
        { id: 'glm/glm-4.6', name: 'GLM-4.6' },
        { id: 'glm/glm-4.5', name: 'GLM-4.5' },
        { id: 'glm/glm-4.5-air', name: 'GLM-4.5 Air' }
      ]
    },
    {
      id: 'minimax',
      name: 'MiniMax 国内订阅',
      billing: '国内订阅',
      models: [{ id: 'minimax/minimax-m3.1-flash', name: 'MiniMax M3.1 Flash' }]
    },
    {
      id: 'deepseek',
      name: 'DeepSeek API 钱包',
      billing: 'API 钱包',
      models: [
        { id: 'deepseek/deepseek-flash', name: 'DeepSeek Flash' },
        { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek v4 Pro' }
      ]
    },
    {
      id: 'kimi',
      name: 'Kimi Code 国内订阅',
      billing: '国内订阅',
      models: [
        { id: 'kimi/k3.1-pro', name: 'Kimi K3.1 Pro' },
        { id: 'kimi/k3.1-pro-highspeed', name: 'Kimi K3.1 Pro 高速' },
        { id: 'kimi/k3', name: 'Kimi K3' },
        { id: 'kimi/k3-256k', name: 'Kimi K3 256K' },
        { id: 'kimi/kimi-for-coding', name: 'Kimi K2.8 Preview' },
        { id: 'kimi/kimi-for-coding-highspeed', name: 'Kimi K2.7 Code 高速' }
      ]
    },
    {
      id: 'longcat',
      name: 'LongCat 美团开放平台',
      billing: '开放平台',
      models: [{ id: 'longcat/longcat-2.5', name: 'LongCat 2.5' }]
    }
  ];

  function getPresetLoomProviders() {
    if (Array.isArray(WT.LOOM_PRESET_PROVIDERS) && WT.LOOM_PRESET_PROVIDERS.length > 0) {
      return WT.LOOM_PRESET_PROVIDERS;
    }
    return FALLBACK_LOOM_PRESET_PROVIDERS;
  }

  function getCodexPresetModels() {
    if (Array.isArray(WT.CODEX_PRESET_MODELS) && WT.CODEX_PRESET_MODELS.length > 0) {
      return WT.CODEX_PRESET_MODELS.map((m) =>
        typeof m === 'string'
          ? { id: m, name: m }
          : { id: m.id || m.value || m.model, name: m.name || m.label || m.id }
      ).filter((m) => Boolean(m.id));
    }
    return FALLBACK_CODEX_PRESET_MODELS;
  }

  function decodeJwtPayloadLocal(token) {
    try {
      const parts = String(token || '').trim().split('.');
      if (parts.length < 2) return null;
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const jsonText = typeof TextDecoder !== 'undefined'
        ? new TextDecoder().decode(bytes)
        : decodeURIComponent(escape(bin));
      return JSON.parse(jsonText);
    } catch (_) {
      return null;
    }
  }

  function parseCodexCredential(rawInput) {
    if (typeof WT.parseCodexAuthInput === 'function') {
      const res = WT.parseCodexAuthInput(rawInput);
      if (res && typeof res === 'object') {
        if ('ok' in res) {
          if (!res.ok) throw new Error(res.error || '无法解析 Codex 凭证');
          return res.credential || res.data || res;
        }
        if (res.accessToken) return res;
      }
      throw new Error('未能从输入内容解析有效 Codex 凭证');
    }

    const raw = String(rawInput || '').trim();
    if (!raw) throw new Error('输入内容为空，请粘贴 JSON 或选择本地文件');

    let accessToken = '';
    let refreshToken = '';
    let accountId = '';
    let expiresAt = 0;

    if (raw.startsWith('eyJ') && raw.split('.').length >= 3) {
      accessToken = raw;
    } else {
      let obj;
      try {
        obj = JSON.parse(raw);
      } catch (_) {
        throw new Error('无法解析为 JSON，请确认文件或粘贴内容格式正确');
      }
      if (obj?.tokens && typeof obj.tokens === 'object') {
        accessToken = obj.tokens.access_token || obj.tokens.accessToken || '';
        refreshToken = obj.tokens.refresh_token || obj.tokens.refreshToken || '';
        accountId = obj.tokens.account_id || obj.tokens.accountId || '';
      } else if (obj?.['openai-codex'] || obj?.openai) {
        const entry = obj['openai-codex'] || obj.openai;
        accessToken = entry.access || entry.access_token || entry.accessToken || '';
        refreshToken = entry.refresh || entry.refresh_token || entry.refreshToken || '';
        expiresAt = Number(entry.expires || entry.expiresAt || 0) || 0;
        accountId = entry.accountId || entry.account_id || '';
      } else {
        accessToken = obj?.access_token || obj?.accessToken || obj?.access || '';
        refreshToken = obj?.refresh_token || obj?.refreshToken || obj?.refresh || '';
        accountId = obj?.account_id || obj?.accountId || '';
        expiresAt = Number(obj?.expiresAt || obj?.expires || 0) || 0;
      }
    }

    if (!accessToken) {
      throw new Error('未在凭证中找到 access_token / access 字段');
    }

    const payload = decodeJwtPayloadLocal(accessToken);
    const authClaim = payload?.['https://api.openai.com/auth'] || {};
    const profileClaim = payload?.['https://api.openai.com/profile'] || {};
    if (!accountId && authClaim.chatgpt_account_id) {
      accountId = String(authClaim.chatgpt_account_id);
    }
    const planType = authClaim.chatgpt_plan_type ? String(authClaim.chatgpt_plan_type) : '';
    const email = profileClaim.email ? String(profileClaim.email) : '';
    if (!expiresAt && typeof payload?.exp === 'number') {
      expiresAt = payload.exp * 1000;
    }

    return {
      accessToken: String(accessToken).trim(),
      refreshToken: String(refreshToken || '').trim(),
      accountId: String(accountId || '').trim(),
      expiresAt: Number(expiresAt) || 0,
      email,
      planType
    };
  }

  function formatPlanType(planType) {
    const raw = String(planType || '').trim();
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function maskAccountSuffix(accountId) {
    const raw = String(accountId || '').trim();
    if (!raw) return '';
    return raw.length > 6 ? `...${raw.slice(-6)}` : `...${raw.slice(-4)}`;
  }

  function formatCodexExpiresAt(expiresAt) {
    const ts = Number(expiresAt);
    if (!Number.isFinite(ts) || ts <= 0) return '';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function readSelectedFileText(file) {
    if (!file) return Promise.resolve('');
    if (typeof file.text === 'function') {
      return file.text();
    }
    return new Promise((resolve, reject) => {
      if (typeof FileReader === 'undefined') {
        reject(new Error('当前环境不支持读取文件'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
  }

  const state = {
    settings: cloneDefaultSettings(),
    loomProviders: getPresetLoomProviders(),
    loomSource: 'preset',
    toastTimer: null,
    openaiDebounceTimer: null,
    loomDebounceTimer: null,
    codexPollTimer: null,
    codexPollSession: 0
  };

  const el = {
    resetSettingsBtn: document.getElementById('resetSettingsBtn'),
    saveAllBtn: document.getElementById('saveAllBtn'),
    navLinks: document.querySelectorAll('.nav-link'),
    optSourceLang: document.getElementById('optSourceLang'),
    optTargetLangGroup: document.getElementById('optTargetLangGroup'),
    optDisplayModeGroup: document.getElementById('optDisplayModeGroup'),
    optTranslationStyleGroup: document.getElementById('optTranslationStyleGroup'),
    optShowFloatingBall: document.getElementById('optShowFloatingBall'),
    optAltHoverTranslate: document.getElementById('optAltHoverTranslate'),
    optSelectionModeGroup: document.getElementById('optSelectionModeGroup'),
    optEngineGroup: document.getElementById('optEngineGroup'),
    codexConfigCard: document.getElementById('codexConfigCard'),
    codexAuthStatus: document.getElementById('codexAuthStatus'),
    codexModel: document.getElementById('codexModel'),
    codexReasoningEffort: document.getElementById('codexReasoningEffort'),
    codexTestBtn: document.getElementById('codexTestBtn'),
    codexClearAuthBtn: document.getElementById('codexClearAuthBtn'),
    codexImportFileBtn: document.getElementById('codexImportFileBtn'),
    codexAuthFileInput: document.getElementById('codexAuthFileInput'),
    codexAuthJsonInput: document.getElementById('codexAuthJsonInput'),
    codexParseJsonBtn: document.getElementById('codexParseJsonBtn'),
    codexDeviceLoginBtn: document.getElementById('codexDeviceLoginBtn'),
    codexDeviceCancelBtn: document.getElementById('codexDeviceCancelBtn'),
    codexDeviceBox: document.getElementById('codexDeviceBox'),
    codexDeviceVerifyLink: document.getElementById('codexDeviceVerifyLink'),
    codexDeviceCodeText: document.getElementById('codexDeviceCodeText'),
    codexCopyCodeBtn: document.getElementById('codexCopyCodeBtn'),
    codexDeviceStatusText: document.getElementById('codexDeviceStatusText'),
    codexImportNotice: document.getElementById('codexImportNotice'),
    loomConfigPanel: document.getElementById('loomConfigPanel'),
    loomSourceBadge: document.getElementById('loomSourceBadge'),
    optLoomBaseUrl: document.getElementById('optLoomBaseUrl'),
    optLoomApiKey: document.getElementById('optLoomApiKey'),
    toggleLoomKeyBtn: document.getElementById('toggleLoomKeyBtn'),
    refreshLoomModelsBtn: document.getElementById('refreshLoomModelsBtn'),
    loomModelsNotice: document.getElementById('loomModelsNotice'),
    optLoomProvider: document.getElementById('optLoomProvider'),
    optLoomModel: document.getElementById('optLoomModel'),
    openaiConfigPanel: document.getElementById('openaiConfigPanel'),
    openaiHintBadge: document.getElementById('openaiHintBadge'),
    optApiUrl: document.getElementById('optApiUrl'),
    optModel: document.getElementById('optModel'),
    optApiKey: document.getElementById('optApiKey'),
    toggleApiKeyBtn: document.getElementById('toggleApiKeyBtn'),
    testEngineBtn: document.getElementById('testEngineBtn'),
    testResultBox: document.getElementById('testResultBox'),
    testStatusBadge: document.getElementById('testStatusBadge'),
    testLatencyText: document.getElementById('testLatencyText'),
    testOutputText: document.getElementById('testOutputText'),
    domainInput: document.getElementById('domainInput'),
    addDomainBtn: document.getElementById('addDomainBtn'),
    domainError: document.getElementById('domainError'),
    domainList: document.getElementById('domainList'),
    domainEmpty: document.getElementById('domainEmpty'),
    saveToast: document.getElementById('saveToast'),
    saveToastText: document.getElementById('saveToastText')
  };

  function cloneDefaultSettings() {
    const base = WT.DEFAULT_SETTINGS || FALLBACK_DEFAULT_SETTINGS;
    return {
      ...FALLBACK_DEFAULT_SETTINGS,
      ...base,
      excludedDomains: Array.isArray(base.excludedDomains) ? [...base.excludedDomains] : [],
      openaiConfig: {
        ...FALLBACK_DEFAULT_SETTINGS.openaiConfig,
        ...(base.openaiConfig || {})
      },
      loomConfig: {
        ...FALLBACK_DEFAULT_SETTINGS.loomConfig,
        ...(base.loomConfig || {})
      },
      codexConfig: {
        ...FALLBACK_DEFAULT_SETTINGS.codexConfig,
        ...(base.codexConfig || {})
      }
    };
  }

  function mergeSettings(base, partial) {
    return {
      ...base,
      ...(partial || {}),
      excludedDomains: Array.isArray(partial?.excludedDomains)
        ? [...partial.excludedDomains]
        : Array.isArray(base.excludedDomains)
          ? [...base.excludedDomains]
          : [],
      openaiConfig: {
        ...(base.openaiConfig || FALLBACK_DEFAULT_SETTINGS.openaiConfig),
        ...(partial?.openaiConfig || {})
      },
      loomConfig: {
        ...(base.loomConfig || FALLBACK_DEFAULT_SETTINGS.loomConfig),
        ...(partial?.loomConfig || {})
      },
      codexConfig: {
        ...(base.codexConfig || FALLBACK_DEFAULT_SETTINGS.codexConfig),
        ...(partial?.codexConfig || {})
      }
    };
  }

  function normalizeLanguageList(raw, fallbackList) {
    if (!raw) return fallbackList;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw
        .map((item) => {
          if (typeof item === 'string') return { code: item, label: item };
          const code = item.code || item.value || item.id;
          const label = item.label || item.name || item.nativeName || item.title || code;
          return code ? { code, label } : null;
        })
        .filter(Boolean);
    }
    if (typeof raw === 'object') {
      const entries = Object.entries(raw);
      if (entries.length > 0) {
        return entries.map(([key, val]) => {
          if (typeof val === 'string') return { code: key, label: val };
          return {
            code: val?.code || key,
            label: val?.label || val?.name || val?.nativeName || key
          };
        });
      }
    }
    return fallbackList;
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      if (!globalThis.chrome?.runtime?.sendMessage) {
        resolve({ ok: false, error: '当前环境不支持扩展通信' });
        return;
      }
      let settled = false;
      const done = (res) => {
        if (!settled) {
          settled = true;
          resolve(res);
        }
      };
      try {
        const maybePromise = chrome.runtime.sendMessage(message, (response) => {
          const err = chrome.runtime.lastError;
          if (err) {
            done({ ok: false, error: err.message || '后台通信失败' });
            return;
          }
          if (response !== undefined) {
            done(response);
          } else {
            setTimeout(() => done({ ok: false, error: '后台未返回响应' }), 0);
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(
            (res) => done(res || { ok: false, error: '后台未返回响应' }),
            (err) => done({ ok: false, error: err?.message || '后台通信失败' })
          );
        }
      } catch (err) {
        done({ ok: false, error: err?.message || '发送消息失败' });
      }
    });
  }

  function showToast(message, isError) {
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }
    el.saveToastText.textContent = message || '已保存';
    el.saveToast.classList.toggle('is-error', Boolean(isError));
    el.saveToast.hidden = false;
    state.toastTimer = setTimeout(() => {
      el.saveToast.hidden = true;
    }, 2200);
  }

  async function savePartialSettings(partial, toastMessage) {
    state.settings = mergeSettings(state.settings, partial);
    const res = await sendRuntimeMessage({
      type: 'SAVE_SETTINGS',
      payload: partial
    });

    if (res?.ok && res.data) {
      state.settings = mergeSettings(state.settings, res.data);
      showToast(toastMessage || '已保存', false);
      return true;
    }

    if (typeof WT.saveSettings === 'function') {
      try {
        const merged = await WT.saveSettings(partial);
        if (merged) state.settings = mergeSettings(state.settings, merged);
        showToast(toastMessage || '已保存', false);
        return true;
      } catch (err) {
        showToast(err?.message || '保存设置失败', true);
        return false;
      }
    }

    showToast(res?.error || '保存设置失败', true);
    return false;
  }

  async function loadSettings() {
    const res = await sendRuntimeMessage({ type: 'GET_SETTINGS' });
    if (res?.ok && res.data) {
      state.settings = mergeSettings(state.settings, res.data);
      return;
    }
    if (typeof WT.getSettings === 'function') {
      try {
        const stored = await WT.getSettings();
        if (stored) state.settings = mergeSettings(state.settings, stored);
      } catch (_) {}
    }
  }

  function setRadioGroupActive(container, attrName, activeValue) {
    const buttons = container.querySelectorAll(`[${attrName}]`);
    buttons.forEach((btn) => {
      const value = btn.getAttribute(attrName);
      const isActive = value === activeValue;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', String(isActive));
    });
  }

  function populateSourceLanguages() {
    const list = normalizeLanguageList(WT.SOURCE_LANGUAGES, FALLBACK_SOURCE_LANGUAGES);
    el.optSourceLang.textContent = '';
    for (const item of list) {
      const option = document.createElement('option');
      option.value = item.code;
      option.textContent = item.label;
      el.optSourceLang.appendChild(option);
    }
  }

  function renderDomains() {
    const domains = Array.isArray(state.settings.excludedDomains)
      ? state.settings.excludedDomains
      : [];
    el.domainList.textContent = '';

    if (domains.length === 0) {
      el.domainEmpty.hidden = false;
      return;
    }

    el.domainEmpty.hidden = true;
    const fragment = document.createDocumentFragment();

    for (const domain of domains) {
      const chip = document.createElement('span');
      chip.className = 'domain-chip';

      const text = document.createElement('span');
      text.textContent = domain;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'domain-remove-btn';
      removeBtn.setAttribute('aria-label', `移除 ${domain}`);
      removeBtn.title = `移除 ${domain}`;
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', async () => {
        const nextDomains = state.settings.excludedDomains.filter((item) => item !== domain);
        await savePartialSettings({ excludedDomains: nextDomains }, '已保存');
        renderDomains();
      });

      chip.appendChild(text);
      chip.appendChild(removeBtn);
      fragment.appendChild(chip);
    }

    el.domainList.appendChild(fragment);
  }

  function resolveLoomProvider(providers, loomCfg) {
    if (!Array.isArray(providers) || providers.length === 0) return null;
    const byId = providers.find((p) => p.id === loomCfg.provider);
    if (byId) return byId;
    const byModel = providers.find((p) => (p.models || []).some((m) => m.id === loomCfg.model));
    if (byModel) return byModel;
    const prefix = String(loomCfg.model || '').split('/')[0];
    return providers.find((p) => p.id === prefix) || providers[0];
  }

  function populateLoomModelsSelect(providerObj, selectedModelId) {
    const models = providerObj && Array.isArray(providerObj.models) ? providerObj.models : [];
    el.optLoomModel.textContent = '';

    for (const m of models) {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id;
      el.optLoomModel.appendChild(option);
    }

    if (selectedModelId && !models.some((m) => m.id === selectedModelId)) {
      const custom = document.createElement('option');
      custom.value = selectedModelId;
      custom.textContent = selectedModelId;
      el.optLoomModel.appendChild(custom);
    }

    if (selectedModelId) {
      el.optLoomModel.value = selectedModelId;
    } else if (models[0]) {
      el.optLoomModel.value = models[0].id;
    }
  }

  function renderLoomSelectors() {
    const loom = state.settings.loomConfig || FALLBACK_DEFAULT_SETTINGS.loomConfig;
    const providers = state.loomProviders;
    const selectedProvider = resolveLoomProvider(providers, loom);

    el.optLoomProvider.textContent = '';
    for (const p of providers) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.billing ? `${p.name} · ${p.billing}` : p.name || p.id;
      el.optLoomProvider.appendChild(option);
    }

    if (selectedProvider) {
      el.optLoomProvider.value = selectedProvider.id;
    }

    populateLoomModelsSelect(selectedProvider, loom.model);
  }

  function showLoomNotice(message, tone) {
    if (!message) {
      el.loomModelsNotice.hidden = true;
      el.loomModelsNotice.textContent = '';
      el.loomModelsNotice.className = 'loom-notice';
      return;
    }
    el.loomModelsNotice.hidden = false;
    el.loomModelsNotice.textContent = message;
    el.loomModelsNotice.className = tone ? `loom-notice ${tone}` : 'loom-notice';
  }

  function renderCodexSelectors() {
    const codex = state.settings.codexConfig || FALLBACK_DEFAULT_SETTINGS.codexConfig;
    const models = getCodexPresetModels();
    const selectedModel = codex.model || FALLBACK_DEFAULT_SETTINGS.codexConfig.model;

    if (el.codexModel) {
      el.codexModel.textContent = '';
      for (const m of models) {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id;
        el.codexModel.appendChild(option);
      }
      if (selectedModel && !models.some((m) => m.id === selectedModel)) {
        const custom = document.createElement('option');
        custom.value = selectedModel;
        custom.textContent = selectedModel;
        el.codexModel.appendChild(custom);
      }
      el.codexModel.value = selectedModel;
    }

    if (el.codexReasoningEffort) {
      el.codexReasoningEffort.value = codex.reasoningEffort || 'low';
    }
  }

  function renderCodexAuthStatus() {
    const codex = state.settings.codexConfig || FALLBACK_DEFAULT_SETTINGS.codexConfig;
    const hasAccess = Boolean((codex.accessToken || '').trim());
    const hasRefresh = Boolean((codex.refreshToken || '').trim());

    if (el.codexClearAuthBtn) {
      el.codexClearAuthBtn.disabled = !hasAccess && !hasRefresh;
    }
    if (!el.codexAuthStatus) return;

    if (!hasAccess) {
      el.codexAuthStatus.className = 'panel-badge';
      el.codexAuthStatus.textContent = '未授权';
      return;
    }

    const expiredNoRefresh =
      typeof codex.expiresAt === 'number' &&
      codex.expiresAt > 0 &&
      codex.expiresAt <= Date.now() &&
      !hasRefresh;

    if (expiredNoRefresh) {
      el.codexAuthStatus.className = 'panel-badge is-warn';
      el.codexAuthStatus.textContent = '凭证已过期 · 请重新授权';
      return;
    }

    const parts = ['已授权'];
    const planLabel = formatPlanType(codex.planType);
    if (planLabel) parts.push(planLabel);
    if (codex.email) parts.push(codex.email);
    const maskedSuffix = maskAccountSuffix(codex.accountId);
    if (maskedSuffix) parts.push(`账号 ${maskedSuffix}`);
    const expiresLabel = formatCodexExpiresAt(codex.expiresAt);
    if (expiresLabel) parts.push(`有效期 ${expiresLabel}`);

    el.codexAuthStatus.className = 'panel-badge is-active';
    el.codexAuthStatus.textContent = parts.join(' · ');
  }

  function showCodexImportNotice(message, tone) {
    if (!el.codexImportNotice) return;
    if (!message) {
      el.codexImportNotice.hidden = true;
      el.codexImportNotice.textContent = '';
      el.codexImportNotice.className = 'loom-notice';
      return;
    }
    el.codexImportNotice.hidden = false;
    el.codexImportNotice.textContent = message;
    el.codexImportNotice.className = tone ? `loom-notice ${tone}` : 'loom-notice';
  }

  function renderEnginePanelsState() {
    const engine = state.settings.engine || 'google-free';
    const isLoom = engine === 'loom';
    const isCodex = engine === 'codex';
    const isOpenAI = engine === 'openai';

    el.loomConfigPanel.hidden = !isLoom;
    if (el.codexConfigCard) {
      el.codexConfigCard.hidden = !isCodex;
      el.codexConfigCard.classList.toggle('is-highlighted', isCodex);
    }
    el.openaiConfigPanel.classList.toggle('is-highlighted', isOpenAI);
    el.openaiHintBadge.classList.toggle('is-active', isOpenAI);
    el.openaiHintBadge.textContent = isOpenAI ? '当前已启用此引擎' : '当前未启用，可提前配置';
  }

  function renderAllSettings() {
    const s = state.settings;
    el.optSourceLang.value = s.sourceLang || 'auto';
    setRadioGroupActive(el.optTargetLangGroup, 'data-target-lang', s.targetLang || 'zh-CN');
    setRadioGroupActive(el.optDisplayModeGroup, 'data-display-mode', s.displayMode || 'replace');
    setRadioGroupActive(
      el.optTranslationStyleGroup,
      'data-translation-style',
      s.translationStyle || 'default'
    );
    el.optShowFloatingBall.checked = Boolean(s.showFloatingBall);
    el.optAltHoverTranslate.checked = Boolean(s.altHoverTranslate);
    setRadioGroupActive(el.optSelectionModeGroup, 'data-selection-mode', s.selectionMode || 'icon');
    setRadioGroupActive(el.optEngineGroup, 'data-engine', s.engine || 'google-free');

    const loom = s.loomConfig || FALLBACK_DEFAULT_SETTINGS.loomConfig;
    el.optLoomBaseUrl.value = loom.baseUrl || FALLBACK_DEFAULT_SETTINGS.loomConfig.baseUrl;
    el.optLoomApiKey.value = loom.apiKey || '';
    renderLoomSelectors();
    renderCodexSelectors();
    renderCodexAuthStatus();

    const openai = s.openaiConfig || FALLBACK_DEFAULT_SETTINGS.openaiConfig;
    el.optApiUrl.value = openai.apiUrl || FALLBACK_DEFAULT_SETTINGS.openaiConfig.apiUrl;
    el.optApiKey.value = openai.apiKey || '';
    el.optModel.value = openai.model || FALLBACK_DEFAULT_SETTINGS.openaiConfig.model;

    renderEnginePanelsState();
    renderDomains();
  }

  function readOpenAIConfigFromInputs() {
    return {
      apiUrl: el.optApiUrl.value.trim() || FALLBACK_DEFAULT_SETTINGS.openaiConfig.apiUrl,
      apiKey: el.optApiKey.value.trim(),
      model: el.optModel.value.trim() || FALLBACK_DEFAULT_SETTINGS.openaiConfig.model
    };
  }

  function readLoomConfigFromInputs() {
    return {
      baseUrl: el.optLoomBaseUrl.value.trim() || FALLBACK_DEFAULT_SETTINGS.loomConfig.baseUrl,
      apiKey: el.optLoomApiKey.value.trim(),
      provider: el.optLoomProvider.value || state.settings.loomConfig?.provider || 'zenmux',
      model: el.optLoomModel.value || state.settings.loomConfig?.model || FALLBACK_DEFAULT_SETTINGS.loomConfig.model
    };
  }

  function readCodexConfigFromInputs() {
    const base = state.settings.codexConfig || FALLBACK_DEFAULT_SETTINGS.codexConfig;
    return {
      ...base,
      model: (el.codexModel && el.codexModel.value) || base.model || FALLBACK_DEFAULT_SETTINGS.codexConfig.model,
      reasoningEffort: (el.codexReasoningEffort && el.codexReasoningEffort.value) || base.reasoningEffort || 'low'
    };
  }

  function scheduleOpenAISave() {
    if (state.openaiDebounceTimer) {
      clearTimeout(state.openaiDebounceTimer);
    }
    state.openaiDebounceTimer = setTimeout(() => {
      state.openaiDebounceTimer = null;
      savePartialSettings({ openaiConfig: readOpenAIConfigFromInputs() }, '已保存');
    }, 450);
  }

  function flushOpenAISave() {
    if (state.openaiDebounceTimer) {
      clearTimeout(state.openaiDebounceTimer);
      state.openaiDebounceTimer = null;
      return savePartialSettings({ openaiConfig: readOpenAIConfigFromInputs() }, '已保存');
    }
    return Promise.resolve(true);
  }

  function scheduleLoomSave() {
    if (state.loomDebounceTimer) {
      clearTimeout(state.loomDebounceTimer);
    }
    state.loomDebounceTimer = setTimeout(() => {
      state.loomDebounceTimer = null;
      savePartialSettings({ loomConfig: readLoomConfigFromInputs() }, '已保存');
    }, 450);
  }

  function flushLoomSave() {
    if (state.loomDebounceTimer) {
      clearTimeout(state.loomDebounceTimer);
      state.loomDebounceTimer = null;
      return savePartialSettings({ loomConfig: readLoomConfigFromInputs() }, '已保存');
    }
    return Promise.resolve(true);
  }

  async function handleRefreshLoomModels() {
    await flushLoomSave();
    const loomConfig = readLoomConfigFromInputs();

    el.refreshLoomModelsBtn.disabled = true;
    el.refreshLoomModelsBtn.textContent = '正在刷新...';
    showLoomNotice('正在从 Loom 网关拉取供应商与模型列表...', '');

    try {
      const res = await sendRuntimeMessage({
        type: 'FETCH_LOOM_MODELS',
        payload: {
          baseUrl: loomConfig.baseUrl,
          apiKey: loomConfig.apiKey
        }
      });

      if (res?.ok && res.data && Array.isArray(res.data.providers) && res.data.providers.length > 0) {
        state.loomProviders = res.data.providers;
        state.loomSource = res.data.source || 'preset';
        renderLoomSelectors();

        if (state.loomSource === 'live') {
          const totalModels = state.loomProviders.reduce(
            (sum, p) => sum + (Array.isArray(p.models) ? p.models.length : 0),
            0
          );
          el.loomSourceBadge.textContent = '实时网关列表';
          showLoomNotice(
            `成功从 Loom 网关同步 ${state.loomProviders.length} 个供应商、共 ${totalModels} 个模型。`,
            'is-success'
          );
        } else {
          el.loomSourceBadge.textContent =
            res.data.code === 'LOCAL_CLIENTS_ONLY' ? '受限回退（预设）' : '本地预设列表';
          showLoomNotice(
            res.data.warning || '未能连接 Loom 实时网关，已加载本地预设供应商与模型列表。',
            'is-warn'
          );
        }
      } else {
        state.loomProviders = getPresetLoomProviders();
        state.loomSource = 'preset';
        el.loomSourceBadge.textContent = '本地预设列表';
        renderLoomSelectors();
        showLoomNotice(
          res?.error || '获取 Loom 模型列表失败，已保留本地预设列表。',
          'is-warn'
        );
      }
    } finally {
      el.refreshLoomModelsBtn.disabled = false;
      el.refreshLoomModelsBtn.textContent = '刷新供应商与模型';
    }
  }

  function normalizeDomainInput(raw) {
    let val = String(raw || '').trim().toLowerCase();
    if (!val) return '';

    if (/^https?:\/\//i.test(val)) {
      try {
        val = new URL(val).hostname.toLowerCase();
      } catch (_) {
        return '';
      }
    } else {
      val = val.replace(/^\*\./, '').split('/')[0].split('?')[0].split('#')[0];
      val = val.replace(/:\d+$/, '');
    }

    if (!val || /\s/.test(val)) return '';
    if (val !== 'localhost' && !val.includes('.')) return '';
    if (!/^[a-z0-9.-]+$/.test(val)) return '';
    return val;
  }

  function showDomainError(msg) {
    if (!msg) {
      el.domainError.hidden = true;
      el.domainError.textContent = '';
      return;
    }
    el.domainError.hidden = false;
    el.domainError.textContent = msg;
  }

  async function handleAddDomain() {
    const normalized = normalizeDomainInput(el.domainInput.value);
    if (!normalized) {
      showDomainError('请输入有效的域名，例如 github.com 或 docs.python.org');
      return;
    }

    const existing = Array.isArray(state.settings.excludedDomains)
      ? state.settings.excludedDomains
      : [];

    if (existing.includes(normalized)) {
      showDomainError(`域名 ${normalized} 已在排除列表中`);
      return;
    }

    showDomainError('');
    el.domainInput.value = '';
    const nextDomains = [...existing, normalized];
    await savePartialSettings({ excludedDomains: nextDomains }, '已保存');
    renderDomains();
  }

  function stopCodexDevicePoll(hideBox) {
    state.codexPollSession += 1;
    if (state.codexPollTimer) {
      clearTimeout(state.codexPollTimer);
      state.codexPollTimer = null;
    }
    if (el.codexDeviceLoginBtn) {
      el.codexDeviceLoginBtn.disabled = false;
      el.codexDeviceLoginBtn.textContent = 'OAuth 设备码登录 (Device Code)';
    }
    if (el.codexDeviceCancelBtn) {
      el.codexDeviceCancelBtn.hidden = true;
    }
    if (hideBox && el.codexDeviceBox) {
      el.codexDeviceBox.hidden = true;
    }
  }

  function mergeCodexCredential(prevCfg, cred) {
    const base = prevCfg || readCodexConfigFromInputs();
    return {
      ...FALLBACK_DEFAULT_SETTINGS.codexConfig,
      ...base,
      accessToken: String(cred.accessToken || '').trim(),
      refreshToken: String(cred.refreshToken || base.refreshToken || '').trim(),
      accountId: String(cred.accountId || base.accountId || '').trim(),
      expiresAt: Number(cred.expiresAt || 0) || 0,
      email: String(cred.email || base.email || '').trim(),
      planType: String(cred.planType || base.planType || '').trim()
    };
  }

  async function applyCodexCredential(cred, successMessage) {
    const nextCodexConfig = mergeCodexCredential(readCodexConfigFromInputs(), cred);
    stopCodexDevicePoll(true);
    const saved = await savePartialSettings(
      { engine: 'codex', codexConfig: nextCodexConfig },
      successMessage || 'Codex 凭证已保存'
    );
    if (saved) {
      renderAllSettings();
      const parts = [successMessage || '已成功导入并保存 Codex 凭证'];
      const planLabel = formatPlanType(nextCodexConfig.planType);
      if (planLabel) parts.push(`套餐 ${planLabel}`);
      if (nextCodexConfig.email) parts.push(nextCodexConfig.email);
      const masked = maskAccountSuffix(nextCodexConfig.accountId);
      if (masked) parts.push(`账号 ${masked}`);
      showCodexImportNotice(parts.join(' · '), 'is-success');
    }
    return saved;
  }

  async function handleImportCodexRaw(rawText, sourceLabel) {
    try {
      const cred = parseCodexCredential(rawText);
      const ok = await applyCodexCredential(cred, `${sourceLabel}导入成功`);
      if (ok && el.codexAuthJsonInput) {
        el.codexAuthJsonInput.value = '';
      }
    } catch (err) {
      showCodexImportNotice(err?.message || '解析 Codex 凭证失败，请检查内容格式。', 'is-warn');
      showToast('凭证解析失败', true);
    }
  }

  async function pollCodexDeviceLoop(sessionId, deviceAuthId, userCode, intervalSeconds, startedAt) {
    if (sessionId !== state.codexPollSession) return;
    if (Date.now() - startedAt > 10 * 60 * 1000) {
      stopCodexDevicePoll(false);
      if (el.codexDeviceStatusText) {
        el.codexDeviceStatusText.textContent = '授权等待超时（10 分钟），请重新获取设备码。';
      }
      showCodexImportNotice('Device Code 授权等待超时，请重试。', 'is-warn');
      return;
    }

    const res = await sendRuntimeMessage({
      type: 'TEST_ENGINE',
      payload: {
        engine: 'codex',
        action: 'codex_device_poll',
        deviceAuthId,
        userCode
      }
    });

    if (sessionId !== state.codexPollSession) return;

    const payload = res?.data || {};
    const completedCred =
      payload.status === 'complete'
        ? payload.credential || payload.codexConfig || payload
        : payload.credential && payload.credential.accessToken
          ? payload.credential
          : null;

    if (res?.ok && completedCred && completedCred.accessToken) {
      await applyCodexCredential(completedCred, 'OAuth 设备码登录成功');
      return;
    }

    const isError =
      !res?.ok || payload.status === 'error' || payload.status === 'expired';
    if (isError) {
      const errMsg = res?.error || payload.error || '设备码授权已失效，请重新发起登录。';
      stopCodexDevicePoll(false);
      if (el.codexDeviceStatusText) {
        el.codexDeviceStatusText.textContent = errMsg;
      }
      showCodexImportNotice(errMsg, 'is-warn');
      return;
    }

    const nextIntervalSec = Math.max(1, Number(payload.intervalSeconds || intervalSeconds || 5));
    if (el.codexDeviceStatusText) {
      el.codexDeviceStatusText.textContent = `正在等待浏览器完成授权（每 ${nextIntervalSec} 秒自动检测）...`;
    }
    state.codexPollTimer = setTimeout(() => {
      pollCodexDeviceLoop(sessionId, deviceAuthId, userCode, nextIntervalSec, startedAt);
    }, nextIntervalSec * 1000);
  }

  async function startCodexDeviceLogin() {
    stopCodexDevicePoll(false);
    const sessionId = ++state.codexPollSession;

    if (el.codexDeviceLoginBtn) {
      el.codexDeviceLoginBtn.disabled = true;
      el.codexDeviceLoginBtn.textContent = '正在获取设备码...';
    }
    showCodexImportNotice('', '');

    try {
      const res = await sendRuntimeMessage({
        type: 'TEST_ENGINE',
        payload: {
          engine: 'codex',
          action: 'codex_device_start'
        }
      });

      if (sessionId !== state.codexPollSession) return;

      if (!res?.ok || !res.data || !res.data.deviceAuthId || !res.data.userCode) {
        stopCodexDevicePoll(false);
        showCodexImportNotice(res?.error || '获取 OAuth 设备码失败，请检查网络或代理设置。', 'is-warn');
        showToast('获取设备码失败', true);
        return;
      }

      const { deviceAuthId, userCode } = res.data;
      const intervalSeconds = Math.max(1, Number(res.data.intervalSeconds || res.data.interval || 5));
      const verificationUrl = res.data.verificationUrl || 'https://auth.openai.com/codex/device';

      if (el.codexDeviceVerifyLink) {
        el.codexDeviceVerifyLink.href = verificationUrl;
        el.codexDeviceVerifyLink.textContent = verificationUrl;
      }
      if (el.codexDeviceCodeText) {
        el.codexDeviceCodeText.textContent = userCode;
      }
      if (el.codexDeviceStatusText) {
        el.codexDeviceStatusText.textContent = `请在浏览器完成授权（每 ${intervalSeconds} 秒自动检测）...`;
      }
      if (el.codexDeviceBox) {
        el.codexDeviceBox.hidden = false;
      }
      if (el.codexDeviceLoginBtn) {
        el.codexDeviceLoginBtn.textContent = '等待浏览器授权中...';
      }
      if (el.codexDeviceCancelBtn) {
        el.codexDeviceCancelBtn.hidden = false;
      }

      const startedAt = Date.now();
      state.codexPollTimer = setTimeout(() => {
        pollCodexDeviceLoop(sessionId, deviceAuthId, userCode, intervalSeconds, startedAt);
      }, intervalSeconds * 1000);
    } catch (err) {
      if (sessionId === state.codexPollSession) {
        stopCodexDevicePoll(false);
        showCodexImportNotice(err?.message || '启动 OAuth 设备码登录失败', 'is-warn');
      }
    }
  }

  async function handleClearCodexAuth() {
    stopCodexDevicePoll(true);
    const current = readCodexConfigFromInputs();
    const cleared = {
      ...current,
      accessToken: '',
      refreshToken: '',
      accountId: '',
      expiresAt: 0,
      email: '',
      planType: ''
    };
    if (el.codexAuthJsonInput) {
      el.codexAuthJsonInput.value = '';
    }
    await savePartialSettings({ codexConfig: cleared }, '已清除 Codex 授权凭证');
    renderCodexAuthStatus();
    showCodexImportNotice('已清除本地保存的 Codex 授权凭证。', '');
  }

  async function handleTestEngine() {
    const openaiConfig = readOpenAIConfigFromInputs();
    const loomConfig = readLoomConfigFromInputs();
    const codexConfig = readCodexConfigFromInputs();
    const engine = state.settings.engine || 'google-free';
    state.settings = mergeSettings(state.settings, { openaiConfig, loomConfig, codexConfig });

    el.testEngineBtn.disabled = true;
    el.testEngineBtn.textContent = '正在测试...';
    if (el.codexTestBtn) el.codexTestBtn.disabled = true;
    el.testResultBox.hidden = false;
    el.testResultBox.className = 'test-result';
    el.testStatusBadge.textContent = '连接测试中...';
    el.testLatencyText.textContent = '';
    el.testOutputText.textContent = '正在向所选翻译引擎发送测试请求，请稍候...';

    try {
      const res = await sendRuntimeMessage({
        type: 'TEST_ENGINE',
        payload: {
          engine,
          openaiConfig,
          loomConfig,
          codexConfig
        }
      });

      if (res?.ok && res.data) {
        const latency =
          typeof res.data.latencyMs === 'number' ? `${res.data.latencyMs} ms` : '';
        el.testResultBox.className = 'test-result is-success';
        el.testStatusBadge.textContent = '连接成功';
        el.testLatencyText.textContent = latency ? `耗时 ${latency}` : '';
        el.testOutputText.textContent = `测试译文：${res.data.translatedText || ''}`;
        if (engine === 'codex') {
          showCodexImportNotice(
            `Codex 连接测试成功${latency ? `（${latency}）` : ''}：${res.data.translatedText || ''}`,
            'is-success'
          );
        }
      } else {
        el.testResultBox.className = 'test-result is-error';
        el.testStatusBadge.textContent = '连接失败';
        el.testLatencyText.textContent = '';
        const errMsg = res?.error || '无法连接当前翻译引擎，请检查网络或参数配置。';
        el.testOutputText.textContent = errMsg;
        if (engine === 'codex') {
          showCodexImportNotice(errMsg, 'is-warn');
        }
      }
    } finally {
      el.testEngineBtn.disabled = false;
      el.testEngineBtn.textContent = '测试连接';
      if (el.codexTestBtn) el.codexTestBtn.disabled = false;
    }
  }

  function bindRadioGroup(container, attrName, settingKey, afterUpdate) {
    container.addEventListener('click', async (event) => {
      const card = event.target.closest(`[${attrName}]`);
      if (!card) return;
      const value = card.getAttribute(attrName);
      if (!value || state.settings[settingKey] === value) return;

      setRadioGroupActive(container, attrName, value);
      await savePartialSettings({ [settingKey]: value }, '已保存');
      if (typeof afterUpdate === 'function') afterUpdate(value);
    });
  }

  function bindNavigationHighlight() {
    el.navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        el.navLinks.forEach((item) => item.classList.remove('active'));
        link.classList.add('active');
      });
    });
  }

  function bindEvents() {
    bindNavigationHighlight();

    el.optSourceLang.addEventListener('change', () => {
      savePartialSettings({ sourceLang: el.optSourceLang.value }, '已保存');
    });

    bindRadioGroup(el.optTargetLangGroup, 'data-target-lang', 'targetLang');
    bindRadioGroup(el.optDisplayModeGroup, 'data-display-mode', 'displayMode');
    bindRadioGroup(el.optTranslationStyleGroup, 'data-translation-style', 'translationStyle');
    bindRadioGroup(el.optSelectionModeGroup, 'data-selection-mode', 'selectionMode');
    bindRadioGroup(el.optEngineGroup, 'data-engine', 'engine', renderEnginePanelsState);

    el.optShowFloatingBall.addEventListener('change', () => {
      savePartialSettings({ showFloatingBall: el.optShowFloatingBall.checked }, '已保存');
    });

    el.optAltHoverTranslate.addEventListener('change', () => {
      savePartialSettings({ altHoverTranslate: el.optAltHoverTranslate.checked }, '已保存');
    });

    [el.optLoomBaseUrl, el.optLoomApiKey].forEach((input) => {
      input.addEventListener('input', scheduleLoomSave);
      input.addEventListener('blur', () => {
        if (state.loomDebounceTimer) {
          flushLoomSave();
        }
      });
    });

    el.toggleLoomKeyBtn.addEventListener('click', () => {
      const isPassword = el.optLoomApiKey.type === 'password';
      el.optLoomApiKey.type = isPassword ? 'text' : 'password';
      el.toggleLoomKeyBtn.textContent = isPassword ? '隐藏' : '显示';
    });

    el.refreshLoomModelsBtn.addEventListener('click', handleRefreshLoomModels);

    el.optLoomProvider.addEventListener('change', async () => {
      const providerId = el.optLoomProvider.value;
      const matched = state.loomProviders.find((p) => p.id === providerId);
      populateLoomModelsSelect(matched, '');
      const firstModel = el.optLoomModel.value || (matched?.models?.[0]?.id || '');
      const nextLoomConfig = {
        ...readLoomConfigFromInputs(),
        provider: providerId,
        model: firstModel
      };
      await savePartialSettings({ loomConfig: nextLoomConfig }, '已保存');
    });

    el.optLoomModel.addEventListener('change', async () => {
      const nextLoomConfig = readLoomConfigFromInputs();
      await savePartialSettings({ loomConfig: nextLoomConfig }, '已保存');
    });

    if (el.codexModel) {
      el.codexModel.addEventListener('change', async () => {
        await savePartialSettings({ codexConfig: readCodexConfigFromInputs() }, '已保存');
      });
    }

    if (el.codexReasoningEffort) {
      el.codexReasoningEffort.addEventListener('change', async () => {
        await savePartialSettings({ codexConfig: readCodexConfigFromInputs() }, '已保存');
      });
    }

    if (el.codexTestBtn) {
      el.codexTestBtn.addEventListener('click', handleTestEngine);
    }

    if (el.codexClearAuthBtn) {
      el.codexClearAuthBtn.addEventListener('click', handleClearCodexAuth);
    }

    if (el.codexImportFileBtn && el.codexAuthFileInput) {
      el.codexImportFileBtn.addEventListener('click', () => {
        el.codexAuthFileInput.click();
      });
    }

    if (el.codexAuthFileInput) {
      el.codexAuthFileInput.addEventListener('change', async () => {
        const file = el.codexAuthFileInput.files && el.codexAuthFileInput.files[0];
        if (!file) return;
        try {
          const text = await readSelectedFileText(file);
          await handleImportCodexRaw(text, '本地文件');
        } catch (err) {
          showCodexImportNotice(err?.message || '读取本地文件失败', 'is-warn');
        } finally {
          el.codexAuthFileInput.value = '';
        }
      });
    }

    if (el.codexParseJsonBtn && el.codexAuthJsonInput) {
      el.codexParseJsonBtn.addEventListener('click', async () => {
        await handleImportCodexRaw(el.codexAuthJsonInput.value, '文本凭证');
      });
    }

    if (el.codexDeviceLoginBtn) {
      el.codexDeviceLoginBtn.addEventListener('click', startCodexDeviceLogin);
    }

    if (el.codexDeviceCancelBtn) {
      el.codexDeviceCancelBtn.addEventListener('click', () => {
        stopCodexDevicePoll(true);
        showCodexImportNotice('已取消 OAuth 设备码授权等待。', '');
      });
    }

    if (el.codexCopyCodeBtn && el.codexDeviceCodeText) {
      el.codexCopyCodeBtn.addEventListener('click', async () => {
        const codeText = (el.codexDeviceCodeText.textContent || '').trim();
        if (!codeText || codeText === '---- ----') return;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(codeText);
            el.codexCopyCodeBtn.textContent = '已复制 ✓';
            setTimeout(() => {
              if (el.codexCopyCodeBtn) el.codexCopyCodeBtn.textContent = '复制授权码';
            }, 1400);
          }
        } catch (_) {
          showToast('复制失败，请手动选中复制', true);
        }
      });
    }

    [el.optApiUrl, el.optModel, el.optApiKey].forEach((input) => {
      input.addEventListener('input', scheduleOpenAISave);
      input.addEventListener('blur', () => {
        if (state.openaiDebounceTimer) {
          flushOpenAISave();
        }
      });
    });

    el.toggleApiKeyBtn.addEventListener('click', () => {
      const isPassword = el.optApiKey.type === 'password';
      el.optApiKey.type = isPassword ? 'text' : 'password';
      el.toggleApiKeyBtn.textContent = isPassword ? '隐藏' : '显示';
    });

    el.testEngineBtn.addEventListener('click', async () => {
      await flushOpenAISave();
      await flushLoomSave();
      await handleTestEngine();
    });

    el.addDomainBtn.addEventListener('click', handleAddDomain);
    el.domainInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAddDomain();
      }
    });
    el.domainInput.addEventListener('input', () => {
      if (!el.domainError.hidden) showDomainError('');
    });

    el.saveAllBtn.addEventListener('click', async () => {
      if (state.openaiDebounceTimer) {
        clearTimeout(state.openaiDebounceTimer);
        state.openaiDebounceTimer = null;
      }
      if (state.loomDebounceTimer) {
        clearTimeout(state.loomDebounceTimer);
        state.loomDebounceTimer = null;
      }
      const payload = {
        ...state.settings,
        sourceLang: el.optSourceLang.value,
        showFloatingBall: el.optShowFloatingBall.checked,
        altHoverTranslate: el.optAltHoverTranslate.checked,
        openaiConfig: readOpenAIConfigFromInputs(),
        loomConfig: readLoomConfigFromInputs(),
        codexConfig: readCodexConfigFromInputs()
      };
      await savePartialSettings(payload, '已保存全部设置');
    });

    el.resetSettingsBtn.addEventListener('click', async () => {
      stopCodexDevicePoll(true);
      if (el.codexAuthJsonInput) el.codexAuthJsonInput.value = '';
      showCodexImportNotice('', '');
      const defaults = cloneDefaultSettings();
      state.loomProviders = getPresetLoomProviders();
      state.loomSource = 'preset';
      el.loomSourceBadge.textContent = '预设供应商与模型';
      showLoomNotice('', '');
      await savePartialSettings(defaults, '已恢复默认设置');
      renderAllSettings();
    });
  }

  async function init() {
    populateSourceLanguages();
    bindEvents();
    await loadSettings();
    renderAllSettings();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
