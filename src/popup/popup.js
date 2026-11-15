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

  const FALLBACK_TARGET_LANGUAGES = [
    { code: 'zh-CN', label: '简体中文' },
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'en', label: 'English' }
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
        { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' }
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

  const ENGINE_LABELS = {
    'google-free': 'Google 免费',
    mymemory: 'MyMemory',
    loom: 'Loom 网关',
    codex: 'Codex 订阅',
    openai: 'OpenAI'
  };

  const TARGET_LABELS = {
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    en: 'English'
  };

  const LANG_SHORT_LABELS = {
    auto: '自动检测',
    en: 'English',
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    ru: 'Русский',
    pt: 'Português',
    ar: 'العربية'
  };

  const CHAT_CHIP_PROMPTS = {
    summarize_page: '请全面总结当前网页的核心主题、结构与关键结论。',
    key_takeaways: '请提炼当前网页最值得关注的 3-6 条核心要点。',
    page_qa: '请基于当前网页内容生成 3-5 个常见关键问题与简明解答。',
    explain: '请用通俗易懂的语言解释当前引用内容或页面中的核心概念。'
  };

  const SUMMARY_TASK_PROMPTS = {
    summarize_page: '请生成一份结构清晰的当前网页内容摘要。',
    key_takeaways: '请提炼当前网页最重要的核心要点列表。',
    page_qa: '请围绕当前网页内容生成常见问题与解答。'
  };

  function detectSidePanelMode() {
    try {
      const search = globalThis.location && typeof globalThis.location.search === 'string'
        ? globalThis.location.search
        : '';
      return new URLSearchParams(search).get('mode') === 'sidepanel';
    } catch (_) {
      return false;
    }
  }

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
    if (!raw) throw new Error('输入内容为空');

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
        throw new Error('输入格式不是有效的 JSON 或 JWT Token');
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
      throw new Error('未在 JSON 中找到 access_token / access 字段');
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

  const isSidePanelMode = detectSidePanelMode();

  const state = {
    isSidePanelMode,
    activeWorkspaceTab: isSidePanelMode ? 'chat' : 'translate',
    engineDrawerOpen: false,
    settings: cloneDefaultSettings(),
    loomProviders: getPresetLoomProviders(),
    loomSource: 'preset',
    loomHint: '',
    loomHintIsWarn: false,
    codexHint: '',
    codexHintIsWarn: false,
    activeTabId: null,
    activeWindowId: null,
    activeTabUrl: '',
    activeTabTitle: '',
    isRestrictedPage: false,
    isExcludedDomain: false,
    pageContext: null,
    pageStatus: {
      isTranslated: false,
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      displayMode: 'replace',
      translatedCount: 0,
      loadingCount: 0,
      errorCount: 0,
      lastError: null
    },
    statusPollTimers: [],
    isPageBusy: false,
    isQuickTranslating: false,
    lastQuickTranslatedText: '',
    history: [],
    chatMessages: [],
    chatSessionId: '',
    chatSessionPageMeta: null,
    chatHistoryOpen: false,
    chatHistoryQuery: '',
    chatSessions: [],
    chatSessionsRequestId: 0,
    chatQuotedText: '',
    pendingChatImages: [],
    enableThinking: true,
    chatLoading: false,
    chatRequestId: 0,
    summaryLoading: false,
    summaryRequestId: 0,
    summaryText: '',
    writeLoading: false,
    writeRequestId: 0,
    writeOutput: ''
  };

  const el = {
    engineBadge: document.getElementById('engineBadge'),
    openSidebarBtn: document.getElementById('openSidebarBtn'),
    openOptionsBtn: document.getElementById('openOptionsBtn'),
    workspaceTabs: document.getElementById('workspaceTabs'),
    tabBtnTranslate: document.getElementById('tabBtnTranslate'),
    tabBtnChat: document.getElementById('tabBtnChat'),
    tabBtnSummary: document.getElementById('tabBtnSummary'),
    tabBtnWrite: document.getElementById('tabBtnWrite'),
    engineConfigCard: document.getElementById('engineConfigCard'),
    engineCardTitle: document.getElementById('engineCardTitle'),
    popupEngineSelect: document.getElementById('popupEngineSelect'),
    popupLoomRow: document.getElementById('popupLoomRow'),
    popupLoomProvider: document.getElementById('popupLoomProvider'),
    popupLoomModel: document.getElementById('popupLoomModel'),
    popupLoomHint: document.getElementById('popupLoomHint'),
    popupLoomRefreshBtn: document.getElementById('popupLoomRefreshBtn'),
    drawerOptionsBtn: document.getElementById('drawerOptionsBtn'),
    popupCodexRow: document.getElementById('popupCodexRow'),
    popupCodexModel: document.getElementById('popupCodexModel'),
    popupCodexHint: document.getElementById('popupCodexHint'),
    popupCodexImportBtn: document.getElementById('popupCodexImportBtn'),
    popupCodexFileInput: document.getElementById('popupCodexFileInput'),
    paneTranslate: document.getElementById('paneTranslate'),
    paneChat: document.getElementById('paneChat'),
    paneSummary: document.getElementById('paneSummary'),
    paneWrite: document.getElementById('paneWrite'),
    pageCard: document.getElementById('pageCard'),
    pageCardTitle: document.getElementById('pageCardTitle'),
    pageStatusBadge: document.getElementById('pageStatusBadge'),
    pageRestrictedBar: document.getElementById('pageRestrictedBar'),
    pageNotice: document.getElementById('pageNotice'),
    pageControlsBody: document.getElementById('pageControlsBody'),
    pageTargetLangGroup: document.getElementById('pageTargetLangGroup'),
    displayModeGroup: document.getElementById('displayModeGroup'),
    togglePageTranslateBtn: document.getElementById('togglePageTranslateBtn'),
    togglePageTranslateText: document.getElementById('togglePageTranslateText'),
    summarizePageBtn: document.getElementById('summarizePageBtn'),
    instantCardTitle: document.getElementById('instantCardTitle'),
    charCount: document.getElementById('charCount'),
    clearTextBtn: document.getElementById('clearTextBtn'),
    sourceLangSelect: document.getElementById('sourceLangSelect'),
    targetLangGroup: document.getElementById('targetLangGroup'),
    quickInput: document.getElementById('quickInput'),
    quickTargetLabel: document.getElementById('quickTargetLabel'),
    quickTranslateBtn: document.getElementById('quickTranslateBtn'),
    quickTranslateBtnText: document.getElementById('quickTranslateBtnText'),
    quickResultBox: document.getElementById('quickResultBox'),
    detectedLangPill: document.getElementById('detectedLangPill'),
    resultEnginePill: document.getElementById('resultEnginePill'),
    speakResultBtn: document.getElementById('speakResultBtn'),
    speakResultText: document.getElementById('speakResultText'),
    copyResultBtn: document.getElementById('copyResultBtn'),
    copyResultText: document.getElementById('copyResultText'),
    quickResultText: document.getElementById('quickResultText'),
    quickErrorText: document.getElementById('quickErrorText'),
    toggleHistoryBtn: document.getElementById('toggleHistoryBtn'),
    historyToggleLabel: document.getElementById('historyToggleLabel'),
    historyCount: document.getElementById('historyCount'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    historyBody: document.getElementById('historyBody'),
    historyList: document.getElementById('historyList'),
    historyEmpty: document.getElementById('historyEmpty'),
    popupChatContextToggle: document.getElementById('popupChatContextToggle'),
    popupChatContextLabel: document.getElementById('popupChatContextLabel'),
    popupChatThinkingToggle: document.getElementById('popupChatThinkingToggle'),
    popupChatPageImgBadge: document.getElementById('popupChatPageImgBadge'),
    popupChatHistoryBtn: document.getElementById('popupChatHistoryBtn'),
    popupChatHistoryCount: document.getElementById('popupChatHistoryCount'),
    popupChatNewBtn: document.getElementById('popupChatNewBtn'),
    popupChatClearBtn: document.getElementById('popupChatClearBtn'),
    popupChatSessionBanner: document.getElementById('popupChatSessionBanner'),
    popupChatSessionBannerText: document.getElementById('popupChatSessionBannerText'),
    popupChatSessionOpenLink: document.getElementById('popupChatSessionOpenLink'),
    popupChatSessionExitBtn: document.getElementById('popupChatSessionExitBtn'),
    popupChatHistoryPanel: document.getElementById('popupChatHistoryPanel'),
    popupChatHistorySearch: document.getElementById('popupChatHistorySearch'),
    popupChatHistoryClearAllBtn: document.getElementById('popupChatHistoryClearAllBtn'),
    popupChatHistoryList: document.getElementById('popupChatHistoryList'),
    popupChatHistoryEmpty: document.getElementById('popupChatHistoryEmpty'),
    popupChatQuoteWrap: document.getElementById('popupChatQuoteWrap'),
    popupChatQuoteText: document.getElementById('popupChatQuoteText'),
    popupChatQuoteClearBtn: document.getElementById('popupChatQuoteClearBtn'),
    popupChatChips: document.getElementById('popupChatChips'),
    popupChatList: document.getElementById('popupChatList'),
    popupChatImageStrip: document.getElementById('popupChatImageStrip'),
    popupChatImageInput: document.getElementById('popupChatImageInput'),
    popupChatImageBtn: document.getElementById('popupChatImageBtn'),
    popupChatInput: document.getElementById('popupChatInput'),
    popupChatSendBtn: document.getElementById('popupChatSendBtn'),
    popupSummaryPageTitle: document.getElementById('popupSummaryPageTitle'),
    popupSummarySourceMeta: document.getElementById('popupSummarySourceMeta'),
    popupSummaryRefreshBtn: document.getElementById('popupSummaryRefreshBtn'),
    popupSummaryRunBtn: document.getElementById('popupSummaryRunBtn'),
    popupSummaryTakeawaysBtn: document.getElementById('popupSummaryTakeawaysBtn'),
    popupSummaryQaBtn: document.getElementById('popupSummaryQaBtn'),
    popupSummaryCustomInput: document.getElementById('popupSummaryCustomInput'),
    popupSummaryResult: document.getElementById('popupSummaryResult'),
    popupSummaryCopyBtn: document.getElementById('popupSummaryCopyBtn'),
    popupSummaryFollowupBtn: document.getElementById('popupSummaryFollowupBtn'),
    popupWriteClearBtn: document.getElementById('popupWriteClearBtn'),
    popupWriteInput: document.getElementById('popupWriteInput'),
    popupWriteActions: document.getElementById('popupWriteActions'),
    popupWriteResult: document.getElementById('popupWriteResult'),
    popupWriteEngineMeta: document.getElementById('popupWriteEngineMeta'),
    popupWriteCopyBtn: document.getElementById('popupWriteCopyBtn')
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
          if (typeof item === 'string') {
            return { code: item, label: LANG_SHORT_LABELS[item] || item };
          }
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

  function queryActiveTab() {
    return new Promise((resolve) => {
      if (!globalThis.chrome?.tabs?.query) {
        resolve(null);
        return;
      }
      let settled = false;
      const done = (tabs) => {
        if (!settled) {
          settled = true;
          resolve(Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null);
        }
      };
      try {
        const maybePromise = chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime?.lastError) {
            done([]);
            return;
          }
          if (tabs !== undefined) {
            done(tabs);
          } else {
            setTimeout(() => done([]), 0);
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(done, () => done([]));
        }
      } catch (_) {
        done([]);
      }
    });
  }

  function sendTabMessage(tabId, message) {
    return new Promise((resolve) => {
      if (tabId == null || !globalThis.chrome?.tabs?.sendMessage) {
        resolve({ ok: false, error: '无法连接当前标签页' });
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
        const maybePromise = chrome.tabs.sendMessage(tabId, message, (response) => {
          const err = chrome.runtime?.lastError;
          if (err) {
            done({ ok: false, error: err.message || '当前页面未注入翻译脚本' });
            return;
          }
          if (response !== undefined) {
            done(response);
          } else {
            setTimeout(() => done({ ok: false, error: '页面脚本未响应' }), 0);
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(
            (res) => done(res || { ok: false, error: '页面脚本未响应' }),
            (err) => done({ ok: false, error: err?.message || '当前页面未注入翻译脚本' })
          );
        }
      } catch (err) {
        done({ ok: false, error: err?.message || '发送标签页消息失败' });
      }
    });
  }

  function isRestrictedUrl(url) {
    if (!url || typeof url !== 'string') return true;
    const lower = url.toLowerCase();
    const blockedPrefixes = [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'about:',
      'devtools://',
      'view-source:',
      'moz-extension://',
      'safari-extension://',
      'https://chrome.google.com/webstore',
      'https://chromewebstore.google.com',
      'https://microsoftedge.microsoft.com/addons'
    ];
    return blockedPrefixes.some((prefix) => lower.startsWith(prefix));
  }

  function isInjectableUrl(url) {
    return typeof url === 'string' && /^(https?|file):\/\//i.test(url) && !isRestrictedUrl(url);
  }

  function extractHostname(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function checkDomainExcluded(hostname, excludedDomains) {
    if (!hostname || !Array.isArray(excludedDomains)) return false;
    return excludedDomains.some((domain) => {
      const clean = String(domain || '').trim().toLowerCase();
      if (!clean) return false;
      return hostname === clean || hostname.endsWith('.' + clean);
    });
  }

  // Safe DOM Markdown renderer for AI Chat / Summary / Write panels
  function appendInlineMarkdown(parent, text) {
    const tokenRe = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
    let lastIdx = 0;
    let match;
    while ((match = tokenRe.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parent.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        const strong = document.createElement('strong');
        strong.textContent = token.slice(2, -2);
        parent.appendChild(strong);
      } else if (token.startsWith('`') && token.endsWith('`')) {
        const code = document.createElement('code');
        code.className = 'ai-md-inline-code';
        code.textContent = token.slice(1, -1);
        parent.appendChild(code);
      } else if (token.startsWith('[')) {
        const linkMatch = token.match(/^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/);
        if (linkMatch) {
          const a = document.createElement('a');
          a.className = 'ai-md-link';
          a.setAttribute('href', linkMatch[2]);
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
          a.textContent = linkMatch[1];
          parent.appendChild(a);
        } else {
          parent.appendChild(document.createTextNode(token));
        }
      }
      lastIdx = tokenRe.lastIndex;
    }
    if (lastIdx < text.length) {
      parent.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
  }

  function renderMarkdownToElement(container, rawText) {
    if (!container) return;
    container.textContent = '';
    const text = String(rawText || '').replace(/\r\n/g, '\n');
    if (!text.trim()) return;

    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeLines = [];

    const flushCodeBlock = () => {
      if (!codeLines.length) return;
      const pre = document.createElement('pre');
      pre.className = 'ai-md-pre';
      const code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      pre.appendChild(code);
      container.appendChild(pre);
      codeLines = [];
    };

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (/^```/.test(line.trim())) {
        if (inCodeBlock) {
          flushCodeBlock();
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed) continue;

      const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const hEl = document.createElement('div');
        hEl.className = `ai-md-heading ai-md-h${headingMatch[1].length}`;
        appendInlineMarkdown(hEl, headingMatch[2]);
        container.appendChild(hEl);
        continue;
      }

      const listMatch = trimmed.match(/^(?:[-*•]|(\d+)\.)\s+(.+)$/);
      if (listMatch) {
        const liEl = document.createElement('div');
        liEl.className = 'ai-md-li';
        const bullet = document.createElement('span');
        bullet.className = 'ai-md-bullet';
        bullet.textContent = listMatch[1] ? `${listMatch[1]}.` : '•';
        const contentSpan = document.createElement('span');
        contentSpan.className = 'ai-md-li-text';
        appendInlineMarkdown(contentSpan, listMatch[2]);
        liEl.appendChild(bullet);
        liEl.appendChild(contentSpan);
        container.appendChild(liEl);
        continue;
      }

      const pEl = document.createElement('div');
      pEl.className = 'ai-md-p';
      appendInlineMarkdown(pEl, trimmed);
      container.appendChild(pEl);
    }

    if (inCodeBlock) {
      flushCodeBlock();
    }
  }

  function createThinkingElement(reasoning, thinkingMs, opts = {}) {
    const clean = typeof reasoning === 'string' ? reasoning.trim() : '';
    const isStreaming = Boolean(opts && opts.streaming);
    if (!clean && !isStreaming) return null;
    const details = document.createElement('details');
    details.className = isStreaming ? 'ai-thinking-box ai-thinking-streaming' : 'ai-thinking-box';
    details.open = true;
    const summary = document.createElement('summary');
    summary.className = 'ai-thinking-summary';
    const secLabel =
      typeof thinkingMs === 'number' && thinkingMs >= 100
        ? ` (${(thinkingMs / 1000).toFixed(1)}s)`
        : '';
    summary.textContent = isStreaming
      ? `💭 正在思考...${secLabel}`
      : `💭 思考过程${secLabel}`;
    const body = document.createElement('div');
    body.className = 'ai-thinking-body';
    renderMarkdownToElement(
      body,
      clean || opts.placeholder || '正在读取网页内容并进行深度思考...'
    );
    if (isStreaming && typeof body.scrollHeight === 'number') {
      body.scrollTop = body.scrollHeight;
    }
    details.appendChild(summary);
    details.appendChild(body);
    return details;
  }

  function readAndCompressImageFile(file) {
    return new Promise((resolve) => {
      if (!file || typeof FileReader === 'undefined') {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = () => {
        const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!/^data:image\//i.test(rawDataUrl)) {
          resolve(null);
          return;
        }
        const alt = (file.name || 'image').slice(0, 100);
        if (typeof globalThis.Image !== 'function' || typeof document === 'undefined') {
          resolve({ url: rawDataUrl, dataUrl: rawDataUrl, alt, source: 'upload' });
          return;
        }
        const img = new globalThis.Image();
        img.onerror = () => resolve({ url: rawDataUrl, dataUrl: rawDataUrl, alt, source: 'upload' });
        img.onload = () => {
          try {
            const natW = img.naturalWidth || img.width || 0;
            const natH = img.naturalHeight || img.height || 0;
            if (!natW || !natH || (Math.max(natW, natH) <= 1280 && rawDataUrl.length <= 900000)) {
              resolve({ url: rawDataUrl, dataUrl: rawDataUrl, alt, source: 'upload' });
              return;
            }
            const scale = Math.min(1, 1280 / Math.max(natW, natH));
            const canvas = document.createElement('canvas');
            if (!canvas || typeof canvas.getContext !== 'function') {
              resolve({ url: rawDataUrl, dataUrl: rawDataUrl, alt, source: 'upload' });
              return;
            }
            canvas.width = Math.max(1, Math.round(natW * scale));
            canvas.height = Math.max(1, Math.round(natH * scale));
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve({ url: rawDataUrl, dataUrl: rawDataUrl, alt, source: 'upload' });
              return;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressed = canvas.toDataURL('image/jpeg', 0.86);
            resolve({
              url: compressed || rawDataUrl,
              dataUrl: compressed || rawDataUrl,
              alt,
              source: 'upload'
            });
          } catch (_) {
            resolve({ url: rawDataUrl, dataUrl: rawDataUrl, alt, source: 'upload' });
          }
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  function populateSourceLanguages() {
    if (!el.sourceLangSelect) return;
    const list = normalizeLanguageList(WT.SOURCE_LANGUAGES, FALLBACK_SOURCE_LANGUAGES);
    el.sourceLangSelect.textContent = '';
    for (const item of list) {
      const option = document.createElement('option');
      option.value = item.code;
      option.textContent = item.label;
      el.sourceLangSelect.appendChild(option);
    }
    el.sourceLangSelect.value = state.settings.sourceLang || 'auto';
  }

  function renderTargetLangControls() {
    const targetList = normalizeLanguageList(WT.TARGET_LANGUAGES, FALLBACK_TARGET_LANGUAGES);
    const activeCode = state.settings.targetLang || 'zh-CN';
    const groups = [el.pageTargetLangGroup, el.targetLangGroup];
    for (const group of groups) {
      if (!group) continue;
      const buttons = group.querySelectorAll('[data-target-lang]');
      buttons.forEach((btn) => {
        const code = btn.getAttribute('data-target-lang');
        const matched = targetList.find((item) => item.code === code);
        if (matched) {
          btn.textContent = matched.label;
        }
        const isActive = code === activeCode;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });
    }
    const label = TARGET_LABELS[activeCode] || activeCode;
    if (el.quickTargetLabel) {
      el.quickTargetLabel.textContent = `译为：${label}`;
    }
  }

  function renderDisplayModeControls() {
    if (!el.displayModeGroup) return;
    const activeMode = state.settings.displayMode || 'replace';
    const buttons = el.displayModeGroup.querySelectorAll('[data-display-mode]');
    buttons.forEach((btn) => {
      const mode = btn.getAttribute('data-display-mode');
      const isActive = mode === activeMode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  function formatLoomShortModel(modelId) {
    const raw = String(modelId || '').trim();
    if (!raw) return 'Loom';
    for (const provider of state.loomProviders) {
      const found = (provider.models || []).find((m) => m.id === raw);
      if (found && found.name) return found.name;
    }
    return raw.includes('/') ? raw.split('/').slice(-1)[0] : raw;
  }

  function formatCodexShortModel(modelId) {
    const raw = String(modelId || '').trim();
    if (!raw) return 'GPT-5.6 Luna';
    const presets = getCodexPresetModels();
    const found = presets.find((m) => m.id === raw);
    if (found && found.name) {
      return found.name.replace(/\s*\([^)]*\)\s*$/, '').trim() || raw;
    }
    return raw
      .replace(/^gpt-/i, 'GPT-')
      .replace(/-codex$/i, ' Codex')
      .replace(/-mini$/i, ' Mini')
      .replace(/-([a-z])/g, (_, ch) => ` ${ch.toUpperCase()}`);
  }

  function getActiveModelDisplayLabel() {
    const engine = state.settings.engine || 'google-free';
    if (engine === 'loom') {
      const modelId = state.settings.loomConfig?.model || FALLBACK_DEFAULT_SETTINGS.loomConfig.model;
      return formatLoomShortModel(modelId);
    }
    if (engine === 'codex') {
      const modelId = state.settings.codexConfig?.model || FALLBACK_DEFAULT_SETTINGS.codexConfig.model;
      return formatCodexShortModel(modelId);
    }
    return ENGINE_LABELS[engine] || engine;
  }

  function renderEngineBadge() {
    if (!el.engineBadge) return;
    const engine = state.settings.engine || 'google-free';
    if (engine === 'loom') {
      const hasApiKey = Boolean((state.settings.loomConfig?.apiKey || '').trim());
      const modelId = state.settings.loomConfig?.model || FALLBACK_DEFAULT_SETTINGS.loomConfig.model;
      const shortModel = formatLoomShortModel(modelId);
      el.engineBadge.textContent = `Loom · ${shortModel}`;
      el.engineBadge.title = hasApiKey
        ? `Loom · ${modelId}（点击切换引擎或模型）`
        : `Loom · ${modelId}（未填写 hub.key，点击配置）`;
      el.engineBadge.classList.toggle('is-warn', !hasApiKey);
      return;
    }
    if (engine === 'codex') {
      const codexCfg = state.settings.codexConfig || FALLBACK_DEFAULT_SETTINGS.codexConfig;
      const hasAuth = Boolean((codexCfg.accessToken || '').trim());
      const modelId = codexCfg.model || FALLBACK_DEFAULT_SETTINGS.codexConfig.model;
      const shortModel = formatCodexShortModel(modelId);
      el.engineBadge.textContent = `Codex · ${shortModel}`;
      el.engineBadge.title = hasAuth
        ? `Codex · ${modelId}（已授权，点击切换引擎或模型）`
        : `Codex · ${modelId}（未导入凭证，点击导入或设置）`;
      el.engineBadge.classList.toggle('is-warn', !hasAuth);
      return;
    }
    el.engineBadge.textContent = ENGINE_LABELS[engine] || engine;
    el.engineBadge.title = '点击展开或收起引擎与模型设置';
    el.engineBadge.classList.remove('is-warn');
  }

  function toggleEngineDrawer(forceOpen) {
    state.engineDrawerOpen = typeof forceOpen === 'boolean' ? forceOpen : !state.engineDrawerOpen;
    if (el.engineConfigCard) {
      el.engineConfigCard.hidden = !state.engineDrawerOpen;
    }
    if (el.engineBadge) {
      el.engineBadge.setAttribute('aria-expanded', String(state.engineDrawerOpen));
    }
  }

  function resolveSelectedLoomProvider() {
    const providers = state.loomProviders;
    if (!Array.isArray(providers) || providers.length === 0) return null;
    const cfg = state.settings.loomConfig || FALLBACK_DEFAULT_SETTINGS.loomConfig;
    const byId = providers.find((p) => p.id === cfg.provider);
    if (byId) return byId;
    const byModel = providers.find((p) => (p.models || []).some((m) => m.id === cfg.model));
    if (byModel) return byModel;
    const prefix = String(cfg.model || '').split('/')[0];
    return providers.find((p) => p.id === prefix) || providers[0];
  }

  function formatCodexConnectionSummary(codexCfg) {
    const hasAuth = Boolean((codexCfg?.accessToken || '').trim());
    if (!hasAuth) {
      return { text: '未导入凭证', isWarn: true, isOk: false };
    }
    const expiredNoRefresh =
      typeof codexCfg.expiresAt === 'number' &&
      codexCfg.expiresAt > 0 &&
      codexCfg.expiresAt <= Date.now() &&
      !(codexCfg.refreshToken || '').trim();
    if (expiredNoRefresh) {
      return { text: '凭证已过期，请重新导入', isWarn: true, isOk: false };
    }
    const planLabel = formatPlanType(codexCfg.planType) || 'Codex';
    const tail = codexCfg.email || (codexCfg.accountId ? `...${codexCfg.accountId.slice(-6)}` : 'Connected');
    return { text: `${planLabel} · ${tail}`, isWarn: false, isOk: true };
  }

  function renderCodexSwitcherPanel() {
    const codexCfg = state.settings.codexConfig || FALLBACK_DEFAULT_SETTINGS.codexConfig;
    const models = getCodexPresetModels();
    const currentModel = codexCfg.model || FALLBACK_DEFAULT_SETTINGS.codexConfig.model;

    if (el.popupCodexModel) {
      el.popupCodexModel.textContent = '';
      for (const m of models) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name || m.id;
        el.popupCodexModel.appendChild(opt);
      }
      if (currentModel && !models.some((m) => m.id === currentModel)) {
        const customOpt = document.createElement('option');
        customOpt.value = currentModel;
        customOpt.textContent = currentModel;
        el.popupCodexModel.appendChild(customOpt);
      }
      el.popupCodexModel.value = currentModel;
    }

    if (el.popupCodexHint) {
      if (state.codexHint) {
        el.popupCodexHint.textContent = state.codexHint;
        el.popupCodexHint.classList.toggle('is-warn', Boolean(state.codexHintIsWarn));
        el.popupCodexHint.classList.toggle('is-ok', !state.codexHintIsWarn);
      } else {
        const summary = formatCodexConnectionSummary(codexCfg);
        el.popupCodexHint.textContent = summary.text;
        el.popupCodexHint.classList.toggle('is-warn', summary.isWarn);
        el.popupCodexHint.classList.toggle('is-ok', summary.isOk);
      }
    }
  }

  function renderEngineSwitcher() {
    const engine = state.settings.engine || 'google-free';
    if (el.popupEngineSelect) {
      el.popupEngineSelect.value = engine;
    }

    const isLoom = engine === 'loom';
    const isCodex = engine === 'codex';
    if (el.popupLoomRow) {
      el.popupLoomRow.hidden = !isLoom;
    }
    if (el.popupCodexRow) {
      el.popupCodexRow.hidden = !isCodex;
    }

    if (isCodex) {
      renderCodexSwitcherPanel();
      return;
    }
    if (!isLoom) return;

    const providers = state.loomProviders;
    const selectedProvider = resolveSelectedLoomProvider();
    if (el.popupLoomProvider) {
      el.popupLoomProvider.textContent = '';
      for (const p of providers) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name || p.id;
        el.popupLoomProvider.appendChild(opt);
      }
      if (selectedProvider) {
        el.popupLoomProvider.value = selectedProvider.id;
      }
    }

    const models = selectedProvider && Array.isArray(selectedProvider.models)
      ? selectedProvider.models
      : [];
    const currentModel = state.settings.loomConfig?.model || '';
    if (el.popupLoomModel) {
      el.popupLoomModel.textContent = '';
      for (const m of models) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name || m.id;
        el.popupLoomModel.appendChild(opt);
      }
      if (currentModel && !models.some((m) => m.id === currentModel)) {
        const customOpt = document.createElement('option');
        customOpt.value = currentModel;
        customOpt.textContent = currentModel;
        el.popupLoomModel.appendChild(customOpt);
      }
      if (currentModel) {
        el.popupLoomModel.value = currentModel;
      } else if (models[0]) {
        el.popupLoomModel.value = models[0].id;
      }
    }

    if (el.popupLoomHint) {
      const hasApiKey = Boolean((state.settings.loomConfig?.apiKey || '').trim());
      if (!hasApiKey) {
        el.popupLoomHint.textContent = '请先配置 hub.key 密钥';
        el.popupLoomHint.classList.add('is-warn');
      } else if (state.loomHint) {
        el.popupLoomHint.textContent = state.loomHint;
        el.popupLoomHint.classList.toggle('is-warn', Boolean(state.loomHintIsWarn));
      } else {
        el.popupLoomHint.textContent =
          state.loomSource === 'live' ? '已同步实时网关模型' : '本地预设供应商与模型';
        el.popupLoomHint.classList.remove('is-warn');
      }
    }
  }

  async function refreshLoomModels(silent) {
    const loomCfg = state.settings.loomConfig || FALLBACK_DEFAULT_SETTINGS.loomConfig;
    if (!silent && el.popupLoomRefreshBtn) {
      el.popupLoomRefreshBtn.disabled = true;
      el.popupLoomRefreshBtn.textContent = '刷新中...';
    }
    try {
      const res = await sendRuntimeMessage({
        type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.FETCH_LOOM_MODELS) || 'FETCH_LOOM_MODELS',
        payload: {
          baseUrl: loomCfg.baseUrl,
          apiKey: loomCfg.apiKey
        }
      });
      if (res?.ok && res.data && Array.isArray(res.data.providers) && res.data.providers.length > 0) {
        state.loomProviders = res.data.providers;
        state.loomSource = res.data.source || 'preset';
        if (res.data.source === 'live') {
          state.loomHint = `已同步实时网关 (${res.data.providers.length} 家)`;
          state.loomHintIsWarn = false;
        } else if (res.data.code === 'LOCAL_CLIENTS_ONLY') {
          state.loomHint = '网关 403 受限，已加载预设模型';
          state.loomHintIsWarn = true;
        } else if (res.data.warning && !silent) {
          state.loomHint = '网关未响应，已加载预设模型';
          state.loomHintIsWarn = true;
        } else {
          state.loomHint = '';
          state.loomHintIsWarn = false;
        }
      } else if (!silent) {
        state.loomHint = res?.error || '获取模型失败，使用本地预设';
        state.loomHintIsWarn = true;
      }
    } finally {
      if (!silent && el.popupLoomRefreshBtn) {
        el.popupLoomRefreshBtn.disabled = false;
        el.popupLoomRefreshBtn.textContent = '刷新模型';
      }
      renderEngineSwitcher();
      renderEngineBadge();
    }
  }

  function showPageNotice(message, isError) {
    if (!el.pageNotice) return;
    if (!message) {
      el.pageNotice.hidden = true;
      el.pageNotice.textContent = '';
      el.pageNotice.classList.remove('is-error');
      return;
    }
    el.pageNotice.hidden = false;
    el.pageNotice.textContent = message;
    el.pageNotice.classList.toggle('is-error', Boolean(isError));
  }

  function renderAIWorkspacePageMeta() {
    const restricted = state.isRestrictedPage || !isInjectableUrl(state.activeTabUrl);
    if (el.popupChatContextLabel) {
      el.popupChatContextLabel.textContent = restricted
        ? '💬 自由对话模式（受限页面）'
        : '📄 关联当前网页';
    }
    if (el.popupChatContextToggle) {
      el.popupChatContextToggle.disabled = restricted;
      if (restricted) {
        el.popupChatContextToggle.checked = false;
      }
    }

    const pageImgCount = Array.isArray(state.pageContext?.images) ? state.pageContext.images.length : 0;
    if (el.popupChatPageImgBadge) {
      const showImgBadge = !restricted && Boolean(el.popupChatContextToggle?.checked) && pageImgCount > 0;
      el.popupChatPageImgBadge.hidden = !showImgBadge;
      el.popupChatPageImgBadge.textContent = showImgBadge ? `🖼️ 本页 ${pageImgCount} 图` : '';
    }

    if (el.popupSummaryPageTitle) {
      el.popupSummaryPageTitle.textContent = restricted
        ? '受限系统页（可使用自定义正文）'
        : state.pageContext?.title || state.activeTabTitle || state.activeTabUrl || '当前网页';
    }
    if (el.popupSummarySourceMeta) {
      if (restricted) {
        el.popupSummarySourceMeta.textContent = '可在下方粘贴任意文章正文，或切换至普通网页一键总结';
      } else if (state.pageContext && typeof state.pageContext.content === 'string') {
        el.popupSummarySourceMeta.textContent =
          pageImgCount > 0
            ? `已提取 ${state.pageContext.content.length} 字 · ${pageImgCount} 张图片`
            : `已提取 ${state.pageContext.content.length} 字正文`;
      } else {
        el.popupSummarySourceMeta.textContent = '点击按钮将自动提取当前网页正文';
      }
    }
    if (el.popupSummaryRefreshBtn) {
      el.popupSummaryRefreshBtn.hidden = restricted;
    }
  }

  function renderPageStatus() {
    const {
      isTranslated,
      translatedCount = 0,
      loadingCount = 0,
      errorCount = 0,
      lastError = null
    } = state.pageStatus;

    // Keep Sider AI triggers permanently actionable (never disabled)
    if (el.openSidebarBtn) el.openSidebarBtn.disabled = false;
    if (el.summarizePageBtn) el.summarizePageBtn.disabled = false;

    if (state.isRestrictedPage) {
      if (el.pageCard) el.pageCard.classList.add('is-restricted');
      if (el.pageControlsBody) el.pageControlsBody.hidden = true;
      if (el.pageRestrictedBar) el.pageRestrictedBar.hidden = false;
      if (el.pageStatusBadge) {
        el.pageStatusBadge.textContent = '受限页面';
        el.pageStatusBadge.className = 'status-pill status-warn';
      }
      if (el.togglePageTranslateBtn) {
        el.togglePageTranslateBtn.hidden = true;
        el.togglePageTranslateBtn.disabled = true;
        el.togglePageTranslateBtn.classList.remove('is-translated');
      }
      if (el.togglePageTranslateText) {
        el.togglePageTranslateText.textContent = '当前页不支持整页翻译';
      }
      showPageNotice('', false);
      renderAIWorkspacePageMeta();
      return;
    }

    if (el.pageCard) el.pageCard.classList.remove('is-restricted');
    if (el.pageControlsBody) el.pageControlsBody.hidden = false;
    if (el.pageRestrictedBar) el.pageRestrictedBar.hidden = true;
    if (el.togglePageTranslateBtn) {
      el.togglePageTranslateBtn.hidden = false;
      el.togglePageTranslateBtn.disabled = state.isPageBusy;
    }

    if (isTranslated) {
      if (!state.isExcludedDomain) {
        showPageNotice('', false);
      }
      if (el.pageStatusBadge) {
        if (loadingCount > 0 && translatedCount === 0) {
          el.pageStatusBadge.textContent = '正在翻译...';
        } else if (loadingCount > 0 && translatedCount > 0) {
          const totalCount = state.pageStatus.totalCount || translatedCount + loadingCount;
          el.pageStatusBadge.textContent = `翻译中 · ${translatedCount}/${totalCount} 段`;
        } else {
          const countSuffix = translatedCount > 0 ? ` · ${translatedCount} 段` : '';
          el.pageStatusBadge.textContent = `已翻译${countSuffix}`;
        }
        el.pageStatusBadge.className = 'status-pill status-active';
      }
      if (el.togglePageTranslateBtn) el.togglePageTranslateBtn.classList.add('is-translated');
      if (el.togglePageTranslateText) {
        el.togglePageTranslateText.textContent = state.isPageBusy ? '正在还原...' : '恢复原文';
      }
    } else if ((lastError || errorCount > 0) && translatedCount === 0) {
      if (el.pageStatusBadge) {
        el.pageStatusBadge.textContent = '翻译失败';
        el.pageStatusBadge.className = 'status-pill status-warn';
      }
      showPageNotice(lastError || '整页翻译失败，请检查翻译引擎配置', true);
      if (el.togglePageTranslateBtn) el.togglePageTranslateBtn.classList.remove('is-translated');
      if (el.togglePageTranslateText) {
        el.togglePageTranslateText.textContent = state.isPageBusy ? '正在翻译...' : '重试整页翻译';
      }
    } else {
      if (el.pageStatusBadge) {
        el.pageStatusBadge.textContent = state.isExcludedDomain ? '已排除域名' : '未翻译';
        el.pageStatusBadge.className = state.isExcludedDomain
          ? 'status-pill status-warn'
          : 'status-pill status-idle';
      }
      if (el.togglePageTranslateBtn) el.togglePageTranslateBtn.classList.remove('is-translated');
      if (el.togglePageTranslateText) {
        el.togglePageTranslateText.textContent = state.isPageBusy ? '正在翻译...' : '整页翻译';
      }
    }

    renderAIWorkspacePageMeta();
  }

  function switchWorkspaceTab(tabName) {
    const validTabs = new Set(['translate', 'chat', 'summary', 'write']);
    const target = validTabs.has(tabName) ? tabName : 'translate';
    state.activeWorkspaceTab = target;

    const tabButtons = el.workspaceTabs
      ? el.workspaceTabs.querySelectorAll('[data-workspace-tab]')
      : [];
    tabButtons.forEach((btn) => {
      const active = btn.getAttribute('data-workspace-tab') === target;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    if (el.paneTranslate) el.paneTranslate.hidden = target !== 'translate';
    if (el.paneChat) el.paneChat.hidden = target !== 'chat';
    if (el.paneSummary) el.paneSummary.hidden = target !== 'summary';
    if (el.paneWrite) el.paneWrite.hidden = target !== 'write';

    if (
      (target === 'summary' || (target === 'chat' && el.popupChatContextToggle?.checked)) &&
      !state.isRestrictedPage &&
      !state.pageContext
    ) {
      fetchActivePageContext().catch(() => null);
    }
    if (target === 'chat' && el.popupChatInput && typeof el.popupChatInput.focus === 'function') {
      el.popupChatInput.focus();
    }
  }

  async function savePartialSettings(partial) {
    state.settings = mergeSettings(state.settings, partial);
    const res = await sendRuntimeMessage({
      type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.SAVE_SETTINGS) || 'SAVE_SETTINGS',
      payload: partial
    });
    if (res?.ok && res.data) {
      state.settings = mergeSettings(state.settings, res.data);
    } else if (typeof WT.saveSettings === 'function') {
      try {
        const merged = await WT.saveSettings(partial);
        if (merged) state.settings = mergeSettings(state.settings, merged);
      } catch (_) {}
    }
    renderEngineBadge();
  }

  async function loadSettings() {
    const res = await sendRuntimeMessage({
      type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.GET_SETTINGS) || 'GET_SETTINGS'
    });
    if (res?.ok && res.data) {
      state.settings = mergeSettings(state.settings, res.data);
    } else if (typeof WT.getSettings === 'function') {
      try {
        const stored = await WT.getSettings();
        if (stored) state.settings = mergeSettings(state.settings, stored);
      } catch (_) {}
    }
  }

  async function syncActiveTabStatus() {
    const tab = await queryActiveTab();
    if (!tab || tab.id == null) {
      state.activeTabId = null;
      state.activeWindowId = null;
      state.activeTabUrl = '';
      state.activeTabTitle = '';
      state.pageContext = null;
      state.isRestrictedPage = true;
      renderPageStatus();
      return;
    }

    if (state.activeTabId !== tab.id || state.activeTabUrl !== (tab.url || '')) {
      state.pageContext = null;
    }

    state.activeTabId = tab.id;
    state.activeWindowId = tab.windowId != null ? tab.windowId : null;
    state.activeTabUrl = tab.url || '';
    state.activeTabTitle = tab.title || '';

    if (isRestrictedUrl(state.activeTabUrl) || !isInjectableUrl(state.activeTabUrl)) {
      state.isRestrictedPage = true;
      state.pageStatus.isTranslated = false;
      state.pageStatus.translatedCount = 0;
      renderPageStatus();
      return;
    }

    state.isRestrictedPage = false;
    const hostname = extractHostname(state.activeTabUrl);
    state.isExcludedDomain = checkDomainExcluded(hostname, state.settings.excludedDomains);
    if (state.isExcludedDomain) {
      showPageNotice(`当前域名 (${hostname}) 在排除列表中，可点击按钮手动翻译或前往设置管理。`, false);
    } else {
      showPageNotice('', false);
    }

    const res = await sendTabMessage(state.activeTabId, {
      type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.PAGE_GET_STATUS) || 'PAGE_GET_STATUS',
      payload: state.activeWorkspaceTab === 'summary' ? { includeContext: true } : undefined
    });

    if (res?.ok && res.status) {
      state.pageStatus = {
        ...state.pageStatus,
        ...res.status
      };
      if (res.status.pageContext) {
        state.pageContext = res.status.pageContext;
      }
      if (state.pageStatus.isTranslated) {
        if (TARGET_LABELS[state.pageStatus.targetLang]) {
          state.settings.targetLang = state.pageStatus.targetLang;
          renderTargetLangControls();
        }
        if (
          state.pageStatus.displayMode === 'bilingual' ||
          state.pageStatus.displayMode === 'replace'
        ) {
          state.settings.displayMode = state.pageStatus.displayMode;
          renderDisplayModeControls();
        }
        if (state.pageStatus.loadingCount > 0) {
          scheduleStatusPolls();
        }
      }
    } else {
      state.pageStatus.isTranslated = false;
      state.pageStatus.translatedCount = 0;
      if (!state.isExcludedDomain && res?.error) {
        showPageNotice('如刚安装或更新扩展，请刷新当前标签页后再试整页翻译。', false);
      }
    }

    renderPageStatus();
  }

  function clearStatusPolls() {
    while (state.statusPollTimers.length > 0) {
      clearTimeout(state.statusPollTimers.pop());
    }
  }

  function scheduleStatusPolls() {
    clearStatusPolls();
    const delays = [400, 1500, 3500];
    for (const delay of delays) {
      const timerId = setTimeout(async () => {
        if (state.isRestrictedPage || state.activeTabId == null || state.isPageBusy) return;
        const pollRes = await sendTabMessage(state.activeTabId, {
          type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.PAGE_GET_STATUS) || 'PAGE_GET_STATUS'
        });
        if (pollRes?.ok && pollRes.status) {
          state.pageStatus = {
            ...state.pageStatus,
            ...pollRes.status
          };
          renderPageStatus();
          if (
            !state.pageStatus.isTranslated ||
            (state.pageStatus.loadingCount === 0 && state.pageStatus.translatedCount > 0)
          ) {
            clearStatusPolls();
          }
        }
      }, delay);
      state.statusPollTimers.push(timerId);
    }
  }

  async function ensureContentScriptAndSend(message) {
    if (state.activeTabId == null && !state.isRestrictedPage) {
      const tab = await queryActiveTab();
      if (tab && tab.id != null) {
        state.activeTabId = tab.id;
        state.activeWindowId = tab.windowId != null ? tab.windowId : null;
        state.activeTabUrl = tab.url || '';
        state.activeTabTitle = tab.title || '';
        state.isRestrictedPage = isRestrictedUrl(state.activeTabUrl) || !isInjectableUrl(state.activeTabUrl);
      }
    }
    if (state.isRestrictedPage || state.activeTabId == null || !isInjectableUrl(state.activeTabUrl)) {
      return { ok: false, error: '当前页面受浏览器安全限制' };
    }

    let res = await sendTabMessage(state.activeTabId, message);
    if (res?.ok) {
      return res;
    }

    const canInject = Boolean(globalThis.chrome?.scripting?.executeScript);
    if (canInject) {
      try {
        if (typeof chrome.scripting.insertCSS === 'function') {
          await chrome.scripting.insertCSS({
            target: { tabId: state.activeTabId },
            files: ['src/content/content.css']
          });
        }
        await chrome.scripting.executeScript({
          target: { tabId: state.activeTabId },
          files: [
            'src/shared/config.js',
            'src/content/dom-translator.js',
            'src/content/selection-ui.js',
            'src/content/index.js'
          ]
        });
        res = await sendTabMessage(state.activeTabId, message);
        if (res?.ok) {
          return res;
        }
      } catch (_) {}
    }

    return res || { ok: false, error: '当前页面尚未就绪，请刷新当前标签页后再试。' };
  }

  async function fetchActivePageContext() {
    if (state.isRestrictedPage || state.activeTabId == null || !isInjectableUrl(state.activeTabUrl)) {
      return null;
    }
    const res = await ensureContentScriptAndSend({
      type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.PAGE_GET_STATUS) || 'PAGE_GET_STATUS',
      payload: { includeContext: true }
    });
    if (res?.ok && res.status?.pageContext) {
      state.pageContext = res.status.pageContext;
      renderAIWorkspacePageMeta();
      return state.pageContext;
    }
    return state.pageContext || null;
  }

  async function handleTogglePageTranslate() {
    if (state.isRestrictedPage || state.activeTabId == null || state.isPageBusy) return;

    clearStatusPolls();
    state.isPageBusy = true;
    showPageNotice('', false);
    renderPageStatus();

    try {
      if (state.pageStatus.isTranslated) {
        const res = await sendTabMessage(state.activeTabId, {
          type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.PAGE_TRANSLATE_RESTORE) || 'PAGE_TRANSLATE_RESTORE'
        });
        if (res?.ok) {
          state.pageStatus = {
            ...state.pageStatus,
            loadingCount: 0,
            errorCount: 0,
            lastError: null,
            ...(res.status || {}),
            isTranslated: false,
            translatedCount: 0
          };
        } else {
          showPageNotice(res?.error || '恢复原文失败，请刷新页面重试。', true);
        }
      } else {
        const res = await ensureContentScriptAndSend({
          type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.PAGE_TRANSLATE_START) || 'PAGE_TRANSLATE_START',
          payload: {
            sourceLang: state.settings.sourceLang,
            targetLang: state.settings.targetLang,
            displayMode: state.settings.displayMode
          }
        });
        if (res?.ok) {
          state.pageStatus = {
            ...state.pageStatus,
            loadingCount: 0,
            errorCount: 0,
            lastError: null,
            ...(res.status || {}),
            isTranslated:
              res.status && typeof res.status.isTranslated === 'boolean'
                ? res.status.isTranslated
                : true
          };
          scheduleStatusPolls();
        } else {
          showPageNotice(res?.error || '无法连接页面脚本，请刷新当前标签页后重试。', true);
        }
      }
    } finally {
      state.isPageBusy = false;
      renderPageStatus();
    }
  }

  async function notifyPageModeChange(extra = {}) {
    if (state.isRestrictedPage || state.activeTabId == null || !state.pageStatus.isTranslated) {
      return;
    }
    const res = await sendTabMessage(state.activeTabId, {
      type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.PAGE_SET_MODE) || 'PAGE_SET_MODE',
      payload: {
        displayMode: state.settings.displayMode,
        targetLang: state.settings.targetLang,
        forceRetranslate: Boolean(extra && extra.forceRetranslate)
      }
    });
    if (res?.ok && res.status) {
      state.pageStatus = {
        ...state.pageStatus,
        ...res.status
      };
      renderPageStatus();
    }
  }

  function updateCharCounter() {
    if (!el.quickInput || !el.charCount || !el.clearTextBtn) return;
    const len = el.quickInput.value.length;
    el.charCount.textContent = `${len} / 5000`;
    el.clearTextBtn.hidden = len === 0;
  }

  function formatLangLabel(code) {
    if (!code) return '自动检测';
    return LANG_SHORT_LABELS[code] || code;
  }

  async function translateQuickText(saveHistory) {
    if (!el.quickInput) return;
    const text = el.quickInput.value.trim();
    if (!text || state.isQuickTranslating) return;

    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (el.speakResultText) el.speakResultText.textContent = '朗读';
      if (el.speakResultBtn) el.speakResultBtn.classList.remove('is-active');
    }

    state.isQuickTranslating = true;
    if (el.quickTranslateBtn) el.quickTranslateBtn.disabled = true;
    if (el.quickTranslateBtnText) el.quickTranslateBtnText.textContent = '翻译中...';
    if (el.quickResultBox) el.quickResultBox.hidden = false;
    if (el.quickErrorText) el.quickErrorText.hidden = true;
    if (el.quickResultText) {
      el.quickResultText.hidden = false;
      el.quickResultText.textContent = '正在翻译...';
    }

    try {
      const res = await sendRuntimeMessage({
        type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.TRANSLATE_TEXT) || 'TRANSLATE_TEXT',
        payload: {
          text,
          sourceLang: state.settings.sourceLang || 'auto',
          targetLang: state.settings.targetLang || 'zh-CN',
          engine: state.settings.engine || 'google-free',
          codexConfig: state.settings.codexConfig || FALLBACK_DEFAULT_SETTINGS.codexConfig,
          saveHistory: Boolean(saveHistory)
        }
      });

      if (res?.ok && res.data) {
        const { translatedText, detectedSourceLang, engine } = res.data;
        state.lastQuickTranslatedText = translatedText || '';
        if (el.detectedLangPill) {
          el.detectedLangPill.textContent = `检测: ${formatLangLabel(detectedSourceLang || state.settings.sourceLang)}`;
        }
        if (el.resultEnginePill) {
          el.resultEnginePill.textContent = ENGINE_LABELS[engine || state.settings.engine] || engine || '';
        }
        if (el.quickResultText) el.quickResultText.textContent = translatedText || '';
        if (el.quickErrorText) el.quickErrorText.hidden = true;

        if (saveHistory) {
          await loadHistory();
        }
      } else {
        state.lastQuickTranslatedText = '';
        if (el.quickResultText) el.quickResultText.hidden = true;
        if (el.quickErrorText) {
          el.quickErrorText.hidden = false;
          el.quickErrorText.textContent = res?.error || '翻译请求失败，请检查网络或引擎设置。';
        }
      }
    } finally {
      state.isQuickTranslating = false;
      if (el.quickTranslateBtn) el.quickTranslateBtn.disabled = false;
      if (el.quickTranslateBtnText) el.quickTranslateBtnText.textContent = '翻译';
    }
  }

  async function copyToClipboard(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}

    try {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.setAttribute('readonly', '');
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(temp);
      return copied;
    } catch (_) {
      return false;
    }
  }

  function handleSpeakResult() {
    const text = state.lastQuickTranslatedText || (el.quickResultText ? el.quickResultText.textContent.trim() : '');
    if (!text || typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return;

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (el.speakResultText) el.speakResultText.textContent = '朗读';
      if (el.speakResultBtn) el.speakResultBtn.classList.remove('is-active');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const target = state.settings.targetLang || 'zh-CN';
    utterance.lang = target === 'en' ? 'en-US' : target;
    utterance.onend = () => {
      if (el.speakResultText) el.speakResultText.textContent = '朗读';
      if (el.speakResultBtn) el.speakResultBtn.classList.remove('is-active');
    };
    utterance.onerror = () => {
      if (el.speakResultText) el.speakResultText.textContent = '朗读';
      if (el.speakResultBtn) el.speakResultBtn.classList.remove('is-active');
    };

    if (el.speakResultText) el.speakResultText.textContent = '停止';
    if (el.speakResultBtn) el.speakResultBtn.classList.add('is-active');
    window.speechSynthesis.speak(utterance);
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 60) return '刚刚';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function renderHistory() {
    if (!el.historyList || !el.historyCount || !el.clearHistoryBtn || !el.historyEmpty) return;
    const list = Array.isArray(state.history) ? state.history : [];
    el.historyCount.textContent = String(list.length);
    el.clearHistoryBtn.disabled = list.length === 0;
    el.historyList.textContent = '';

    if (list.length === 0) {
      el.historyEmpty.hidden = false;
      return;
    }

    el.historyEmpty.hidden = true;
    const fragment = document.createDocumentFragment();

    for (const item of list.slice(0, 20)) {
      const card = document.createElement('div');
      card.className = 'history-item';

      const top = document.createElement('div');
      top.className = 'history-item-top';

      const pair = document.createElement('span');
      pair.className = 'history-pair';
      const srcName = formatLangLabel(item.detectedSourceLang || item.sourceLang || 'auto');
      const dstName = TARGET_LABELS[item.targetLang] || item.targetLang || 'zh-CN';
      pair.textContent = `${srcName} → ${dstName}`;

      const actions = document.createElement('div');
      actions.className = 'history-actions';

      const time = document.createElement('span');
      time.className = 'history-time';
      time.textContent = formatRelativeTime(item.timestamp);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'history-copy-btn';
      copyBtn.textContent = '复制';
      copyBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const ok = await copyToClipboard(item.translatedText || '');
        if (ok) {
          copyBtn.textContent = '已复制';
          setTimeout(() => {
            copyBtn.textContent = '复制';
          }, 1200);
        }
      });

      actions.appendChild(time);
      actions.appendChild(copyBtn);
      top.appendChild(pair);
      top.appendChild(actions);

      const src = document.createElement('div');
      src.className = 'history-src';
      src.textContent = item.text || '';
      src.title = item.text || '';

      const dst = document.createElement('div');
      dst.className = 'history-dst';
      dst.textContent = item.translatedText || '';
      dst.title = item.translatedText || '';

      const loadIntoQuick = () => {
        if (!el.quickInput) return;
        el.quickInput.value = item.text || '';
        updateCharCounter();
        state.lastQuickTranslatedText = item.translatedText || '';
        if (el.quickResultBox) el.quickResultBox.hidden = false;
        if (el.quickErrorText) el.quickErrorText.hidden = true;
        if (el.quickResultText) {
          el.quickResultText.hidden = false;
          el.quickResultText.textContent = item.translatedText || '';
        }
        if (el.detectedLangPill) {
          el.detectedLangPill.textContent = `检测: ${formatLangLabel(item.detectedSourceLang || item.sourceLang)}`;
        }
        if (el.resultEnginePill) {
          el.resultEnginePill.textContent = ENGINE_LABELS[item.engine] || item.engine || '';
        }
      };

      src.addEventListener('click', loadIntoQuick);
      dst.addEventListener('click', loadIntoQuick);

      card.appendChild(top);
      card.appendChild(src);
      card.appendChild(dst);
      fragment.appendChild(card);
    }

    el.historyList.appendChild(fragment);
  }

  async function loadHistory() {
    const res = await sendRuntimeMessage({
      type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.GET_HISTORY) || 'GET_HISTORY'
    });
    if (res?.ok && Array.isArray(res.data)) {
      state.history = res.data;
    } else if (typeof WT.getHistory === 'function') {
      try {
        state.history = await WT.getHistory();
      } catch (_) {
        state.history = [];
      }
    }
    renderHistory();
  }

  function openOptionsPage() {
    if (globalThis.chrome?.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
      return;
    }
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open('../options/options.html', '_blank', 'noopener');
    }
  }

  let popupStreamSeq = 0;
  const popupStreamCallbacks = new Map();

  if (globalThis.chrome?.runtime?.onMessage?.addListener) {
    chrome.runtime.onMessage.addListener((message) => {
      const actionType = (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.SIDEBAR_ACTION) || 'SIDEBAR_ACTION';
      if (
        message &&
        message.type === actionType &&
        message.payload &&
        message.payload.action === 'stream_progress' &&
        message.payload.streamId
      ) {
        const cb = popupStreamCallbacks.get(message.payload.streamId);
        if (typeof cb === 'function') {
          cb(message.payload);
        }
      }
      return false;
    });
  }

  function renderPopupStreamingPane(targetEl, paneOpts) {
    if (!targetEl) return;
    const p = paneOpts || {};
    targetEl.textContent = '';
    if (p.reasoning || (p.streaming && p.showEmptyThinking)) {
      const thinkingEl = createThinkingElement(p.reasoning, p.thinkingMs, {
        streaming: Boolean(p.streaming),
        placeholder: p.placeholder || '正在读取网页内容并进行深度思考...'
      });
      if (thinkingEl) {
        targetEl.appendChild(thinkingEl);
      }
    }
    if (p.reply) {
      const body = document.createElement('div');
      renderMarkdownToElement(body, p.reply);
      targetEl.appendChild(body);
    }
    if (p.streaming && !p.reply) {
      const loadingRow = document.createElement('div');
      loadingRow.className = 'ai-loading-row';
      loadingRow.textContent = p.loadingText || 'AI 正在思考...';
      targetEl.appendChild(loadingRow);
    }
  }

  // Shared AI_CHAT Caller for Chat, Summary, and Write Tabs
  async function callAIChat({ messages, prompt, taskType, selectionText, pageContext, images, enableThinking, onProgress }) {
    const type = (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.AI_CHAT) || 'AI_CHAT';
    const engine = state.settings.engine || 'google-free';
    const loomCfg = state.settings.loomConfig || FALLBACK_DEFAULT_SETTINGS.loomConfig;
    const openaiCfg = state.settings.openaiConfig || FALLBACK_DEFAULT_SETTINGS.openaiConfig;
    const codexCfg = state.settings.codexConfig || FALLBACK_DEFAULT_SETTINGS.codexConfig;
    const activeModel = engine === 'codex' ? codexCfg.model || 'gpt-5.6-luna' : loomCfg.model || '';
    const useThinking =
      typeof enableThinking === 'boolean'
        ? enableThinking
        : Boolean(el.popupChatThinkingToggle ? el.popupChatThinkingToggle.checked : state.enableThinking);
    const streamId = `wt-popup-stream-${Date.now()}-${++popupStreamSeq}`;
    if (typeof onProgress === 'function') {
      popupStreamCallbacks.set(streamId, onProgress);
    }
    try {
      const res = await sendRuntimeMessage({
        type,
        payload: {
          messages: Array.isArray(messages) ? messages : [],
          prompt: prompt || '',
          taskType: taskType || 'chat',
          selectionText: selectionText || '',
          pageContext: pageContext || null,
          images: Array.isArray(images) ? images : [],
          enableThinking: useThinking,
          stream: true,
          streamId,
          targetLang: state.settings.targetLang || 'zh-CN',
          engine,
          model: activeModel,
          provider: engine === 'codex' ? 'codex' : loomCfg.provider || '',
          loomConfig: loomCfg,
          openaiConfig: openaiCfg,
          codexConfig: codexCfg
        }
      });
      if (!res?.ok || !res.data) {
        throw new Error(res?.error || 'AI 服务暂不可用，请检查引擎设置后重试。');
      }
      return res.data;
    } finally {
      popupStreamCallbacks.delete(streamId);
    }
  }

  function renderPopupPendingImages() {
    if (!el.popupChatImageStrip) return;
    el.popupChatImageStrip.textContent = '';
    if (!Array.isArray(state.pendingChatImages) || state.pendingChatImages.length === 0) {
      el.popupChatImageStrip.hidden = true;
      return;
    }
    el.popupChatImageStrip.hidden = false;
    state.pendingChatImages.forEach((imgObj, idx) => {
      const chip = document.createElement('div');
      chip.className = 'chat-image-chip';
      const img = document.createElement('img');
      img.className = 'chat-image-thumb';
      img.src = imgObj.dataUrl || imgObj.url;
      img.alt = imgObj.alt || `图片 ${idx + 1}`;
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'chat-image-remove';
      rmBtn.title = '移除图片';
      rmBtn.textContent = '×';
      rmBtn.addEventListener('click', () => {
        state.pendingChatImages.splice(idx, 1);
        renderPopupPendingImages();
      });
      chip.appendChild(img);
      chip.appendChild(rmBtn);
      el.popupChatImageStrip.appendChild(chip);
    });
  }

  async function addPopupImagesFromFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) => f && /^image\//i.test(f.type || ''));
    if (files.length === 0) return;
    for (const file of files) {
      if (state.pendingChatImages.length >= 4) break;
      const parsed = await readAndCompressImageFile(file);
      if (parsed) {
        state.pendingChatImages.push(parsed);
      }
    }
    renderPopupPendingImages();
  }

  function renderPopupChatSessionBanner() {
    if (!el.popupChatSessionBanner || !el.popupChatSessionBannerText) return;
    const meta = state.chatSessionPageMeta;
    if (meta && (meta.pageUrl || meta.pageTitle)) {
      const host = meta.hostname || '';
      const title = meta.pageTitle || meta.pageUrl || '历史网页';
      el.popupChatSessionBannerText.textContent = host
        ? `📄 历史网页：${host} · ${title}`
        : `📄 历史网页：${title}`;
      el.popupChatSessionBannerText.title = meta.pageUrl || title;
      if (el.popupChatSessionOpenLink) {
        if (/^https?:\/\//i.test(meta.pageUrl || '')) {
          el.popupChatSessionOpenLink.href = meta.pageUrl;
          el.popupChatSessionOpenLink.setAttribute('href', meta.pageUrl);
          el.popupChatSessionOpenLink.hidden = false;
        } else {
          el.popupChatSessionOpenLink.hidden = true;
        }
      }
      el.popupChatSessionBanner.hidden = false;
    } else {
      el.popupChatSessionBanner.hidden = true;
      if (el.popupChatSessionOpenLink) {
        el.popupChatSessionOpenLink.hidden = true;
      }
    }
  }

  function renderPopupChatHistory() {
    const list = Array.isArray(state.chatSessions) ? state.chatSessions : [];
    if (el.popupChatHistoryCount) {
      el.popupChatHistoryCount.textContent = String(list.length);
    }
    if (el.popupChatHistoryBtn) {
      el.popupChatHistoryBtn.setAttribute('aria-expanded', String(Boolean(state.chatHistoryOpen)));
      el.popupChatHistoryBtn.classList.toggle('is-active', Boolean(state.chatHistoryOpen));
    }
    if (el.popupChatHistoryPanel) {
      el.popupChatHistoryPanel.hidden = !state.chatHistoryOpen;
    }
    if (el.popupChatHistoryClearAllBtn) {
      el.popupChatHistoryClearAllBtn.disabled = list.length === 0;
    }
    if (!el.popupChatHistoryList || !el.popupChatHistoryEmpty) return;

    el.popupChatHistoryList.textContent = '';
    if (list.length === 0) {
      el.popupChatHistoryEmpty.textContent = state.chatHistoryQuery
        ? `未找到包含“${state.chatHistoryQuery}”的历史网页会话`
        : '暂无历史网页会话';
      el.popupChatHistoryEmpty.hidden = false;
      return;
    }

    el.popupChatHistoryEmpty.hidden = true;
    const fragment = document.createDocumentFragment();

    for (const sess of list) {
      if (!sess || typeof sess !== 'object') continue;
      const card = document.createElement('div');
      card.className =
        sess.id && sess.id === state.chatSessionId
          ? 'chat-history-item is-active'
          : 'chat-history-item';
      card.setAttribute('data-session-id', sess.id || '');

      const top = document.createElement('div');
      top.className = 'chat-history-item-top';

      const pageEl = document.createElement('span');
      pageEl.className = 'chat-history-page';
      const host = sess.hostname || '自由对话';
      const pageTitle = sess.pageTitle || sess.pageUrl || '未命名网页';
      pageEl.textContent = `🌐 ${host} · ${pageTitle}`;
      pageEl.title = sess.pageUrl || pageTitle;

      const actions = document.createElement('div');
      actions.className = 'chat-history-actions';

      const timeEl = document.createElement('span');
      timeEl.className = 'chat-history-time';
      timeEl.textContent = formatRelativeTime(sess.updatedAt);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'chat-history-del-btn';
      delBtn.setAttribute('data-delete-session-id', sess.id || '');
      delBtn.title = '删除会话';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        deletePopupChatSession(sess.id || '');
      });

      actions.appendChild(timeEl);
      actions.appendChild(delBtn);
      top.appendChild(pageEl);
      top.appendChild(actions);

      const titleEl = document.createElement('div');
      titleEl.className = 'chat-history-title';
      const msgCount = Array.isArray(sess.messages) ? sess.messages.length : 0;
      titleEl.textContent = `${sess.title || pageTitle} (${msgCount}条)`;

      card.appendChild(top);
      card.appendChild(titleEl);

      if (sess.matchSnippet) {
        const snippetEl = document.createElement('div');
        snippetEl.className = 'chat-history-snippet';
        snippetEl.textContent = sess.matchSnippet;
        card.appendChild(snippetEl);
      }

      card.addEventListener('click', () => {
        selectPopupChatSession(sess);
      });

      fragment.appendChild(card);
    }

    el.popupChatHistoryList.appendChild(fragment);
  }

  async function loadPopupChatSessions(queryOverride) {
    const query = typeof queryOverride === 'string' ? queryOverride : state.chatHistoryQuery;
    const reqId = ++state.chatSessionsRequestId;
    let sessions = [];

    if (typeof WT.getChatSessions === 'function') {
      try {
        const localList = await WT.getChatSessions({ query });
        if (Array.isArray(localList)) {
          sessions = localList;
        }
      } catch (_) {
        // Ignore
      }
    }

    const res = await sendRuntimeMessage({
      type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.GET_HISTORY) || 'GET_HISTORY',
      payload: { kind: 'chat_sessions', query }
    });
    if (res?.ok && res.kind === 'chat_sessions' && Array.isArray(res.data)) {
      sessions = res.data;
    }

    if (reqId !== state.chatSessionsRequestId) return sessions;
    state.chatSessions = Array.isArray(sessions) ? sessions : [];
    renderPopupChatHistory();
    return state.chatSessions;
  }

  async function persistPopupChatSession(pageContext) {
    const validMsgs = state.chatMessages.filter((m) => m && !m.loading && !m.isError);
    if (validMsgs.length === 0) return null;

    const meta = state.chatSessionPageMeta;
    const pageUrl = (meta && meta.pageUrl) || (pageContext && pageContext.url) || state.activeTabUrl || '';
    const pageTitle =
      (meta && meta.pageTitle) ||
      (pageContext && pageContext.title) ||
      state.activeTabTitle ||
      pageUrl ||
      '自由对话';
    const pageExcerpt =
      (meta && meta.pageExcerpt) ||
      (pageContext && typeof pageContext.content === 'string' ? pageContext.content.slice(0, 2400) : '');

    const sessionInput = {
      id: state.chatSessionId || undefined,
      pageUrl,
      pageTitle,
      pageExcerpt,
      messages: validMsgs,
      updatedAt: Date.now()
    };

    let saved = null;
    if (typeof WT.saveChatSession === 'function') {
      try {
        saved = await WT.saveChatSession(sessionInput);
        if (saved && saved.id) {
          state.chatSessionId = saved.id;
        }
      } catch (_) {
        saved = null;
      }
    }

    const res = await sendRuntimeMessage({
      type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.GET_HISTORY) || 'GET_HISTORY',
      payload: {
        kind: 'chat_sessions',
        action: 'save',
        session: saved || sessionInput,
        query: state.chatHistoryQuery
      }
    });
    if (res?.ok && res.kind === 'chat_sessions') {
      if (res.session && res.session.id) {
        state.chatSessionId = res.session.id;
        saved = res.session;
      }
      if (Array.isArray(res.data)) {
        state.chatSessions = res.data;
        renderPopupChatHistory();
        return saved;
      }
    }

    await loadPopupChatSessions();
    return saved;
  }

  async function deletePopupChatSession(sessionId) {
    if (!sessionId) return;
    let nextList = null;

    if (typeof WT.deleteChatSession === 'function') {
      try {
        const afterLocal = await WT.deleteChatSession(sessionId);
        if (Array.isArray(afterLocal)) {
          nextList = state.chatHistoryQuery
            ? await WT.getChatSessions({ query: state.chatHistoryQuery })
            : afterLocal;
        }
      } catch (_) {
        // Ignore
      }
    }

    const res = await sendRuntimeMessage({
      type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.GET_HISTORY) || 'GET_HISTORY',
      payload: { kind: 'chat_sessions', action: 'delete', sessionId }
    });
    if (res?.ok && res.kind === 'chat_sessions' && Array.isArray(res.data)) {
      nextList = state.chatHistoryQuery && typeof WT.getChatSessions === 'function'
        ? await WT.getChatSessions({ query: state.chatHistoryQuery })
        : res.data;
    }

    if (sessionId === state.chatSessionId) {
      state.chatSessionId = '';
      state.chatSessionPageMeta = null;
      renderPopupChatSessionBanner();
    }
    if (Array.isArray(nextList)) {
      state.chatSessions = nextList;
      renderPopupChatHistory();
    } else {
      await loadPopupChatSessions();
    }
  }

  async function clearAllPopupChatSessions() {
    if (typeof WT.clearChatSessions === 'function') {
      try {
        await WT.clearChatSessions();
      } catch (_) {
        // Ignore
      }
    }
    await sendRuntimeMessage({
      type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.CLEAR_HISTORY) || 'CLEAR_HISTORY',
      payload: { kind: 'chat_sessions' }
    });
    state.chatSessionId = '';
    state.chatSessionPageMeta = null;
    state.chatSessions = [];
    renderPopupChatSessionBanner();
    renderPopupChatHistory();
  }

  function selectPopupChatSession(sess) {
    if (!sess || typeof sess !== 'object') return;
    state.chatRequestId += 1;
    state.chatLoading = false;
    if (el.popupChatSendBtn) el.popupChatSendBtn.disabled = false;

    state.chatSessionId = sess.id || '';
    state.chatSessionPageMeta = {
      pageUrl: sess.pageUrl || '',
      pageTitle: sess.pageTitle || sess.title || '历史网页',
      hostname: sess.hostname || '',
      pageExcerpt: sess.pageExcerpt || ''
    };
    state.chatMessages = Array.isArray(sess.messages)
      ? sess.messages.map((m) => ({ ...m }))
      : [];
    state.chatQuotedText = '';
    state.pendingChatImages = [];
    state.chatHistoryOpen = false;

    renderPopupChatQuote();
    renderPopupPendingImages();
    renderPopupChatSessionBanner();
    renderPopupChatHistory();
    renderPopupChatList();
  }

  function resetPopupChatSession() {
    state.chatRequestId += 1;
    state.chatLoading = false;
    if (el.popupChatSendBtn) el.popupChatSendBtn.disabled = false;
    state.chatSessionId = '';
    state.chatSessionPageMeta = null;
    state.chatMessages = [];
    state.chatQuotedText = '';
    state.pendingChatImages = [];
    state.chatHistoryOpen = false;
    renderPopupChatQuote();
    renderPopupPendingImages();
    renderPopupChatSessionBanner();
    renderPopupChatHistory();
    renderPopupChatList();
  }

  function renderPopupChatQuote() {
    if (!el.popupChatQuoteWrap || !el.popupChatQuoteText) return;
    if (state.chatQuotedText) {
      el.popupChatQuoteText.textContent =
        state.chatQuotedText.length > 140
          ? state.chatQuotedText.slice(0, 140).trimEnd() + '...'
          : state.chatQuotedText;
      el.popupChatQuoteWrap.hidden = false;
    } else {
      el.popupChatQuoteText.textContent = '';
      el.popupChatQuoteWrap.hidden = true;
    }
  }

  function renderPopupChatList() {
    if (!el.popupChatList) return;
    el.popupChatList.textContent = '';

    if (state.chatMessages.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'chat-empty-state';
      const title = document.createElement('div');
      title.className = 'chat-empty-title';
      title.textContent = '👋 Gloss AI 助手';
      const desc = document.createElement('div');
      desc.className = 'chat-empty-desc';
      desc.textContent = state.isRestrictedPage
        ? '当前为受限系统页（自由对话模式），可粘贴截图、点击「📄 总结」分析文章，或开启「深度思考」。'
        : '勾选「关联当前网页」可同步识别本页文字与图片；支持展示思考过程与粘贴截图提问。';
      empty.appendChild(title);
      empty.appendChild(desc);
      el.popupChatList.appendChild(empty);
      return;
    }

    for (const msg of state.chatMessages) {
      const item = document.createElement('div');
      item.className = `chat-msg chat-msg-${msg.role}`;

      if (msg.role === 'user') {
        if (msg.quoteText) {
          const quote = document.createElement('div');
          quote.className = 'chat-msg-quote';
          quote.textContent =
            msg.quoteText.length > 100
              ? msg.quoteText.slice(0, 100).trimEnd() + '...'
              : msg.quoteText;
          item.appendChild(quote);
        }
        if (Array.isArray(msg.images) && msg.images.length > 0) {
          const imgWrap = document.createElement('div');
          imgWrap.className = 'chat-msg-images';
          for (const im of msg.images) {
            const thumb = document.createElement('img');
            thumb.className = 'chat-msg-thumb';
            thumb.src = im.dataUrl || im.url;
            thumb.alt = im.alt || '附图';
            imgWrap.appendChild(thumb);
          }
          item.appendChild(imgWrap);
        }
        const textEl = document.createElement('div');
        textEl.textContent = msg.content || '';
        item.appendChild(textEl);
      } else if (msg.loading) {
        if (msg.reasoning || msg.enableThinking) {
          const liveThinkingEl = createThinkingElement(msg.reasoning, msg.thinkingMs, {
            streaming: !msg.content
          });
          if (liveThinkingEl) {
            item.appendChild(liveThinkingEl);
          }
        }
        if (msg.content) {
          const liveBody = document.createElement('div');
          renderMarkdownToElement(liveBody, msg.content);
          item.appendChild(liveBody);
        }
        const loading = document.createElement('div');
        loading.className = 'ai-loading-row';
        loading.textContent = msg.content ? 'AI 正在生成回答...' : 'AI 正在思考...';
        item.appendChild(loading);
      } else if (msg.isError) {
        item.classList.add('is-error');
        const errEl = document.createElement('div');
        errEl.textContent = `请求失败: ${msg.content || '请稍后重试'}`;
        item.appendChild(errEl);
      } else {
        const thinkingEl = createThinkingElement(msg.reasoning, msg.thinkingMs);
        if (thinkingEl) {
          item.appendChild(thinkingEl);
        }
        const body = document.createElement('div');
        renderMarkdownToElement(body, msg.content || '');
        item.appendChild(body);

        const meta = document.createElement('div');
        meta.className = 'chat-msg-meta';
        const modelEl = document.createElement('span');
        modelEl.className = 'chat-msg-model';
        modelEl.textContent = msg.isFallback
          ? `${ENGINE_LABELS[msg.engine] || '免费引擎'} · 降级`
          : msg.modelLabel || getActiveModelDisplayLabel();

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'tool-btn';
        copyBtn.textContent = '复制';
        copyBtn.addEventListener('click', async () => {
          if (await copyToClipboard(msg.content || '')) {
            copyBtn.textContent = '已复制 ✓';
            setTimeout(() => {
              copyBtn.textContent = '复制';
            }, 1300);
          }
        });

        meta.appendChild(modelEl);
        meta.appendChild(copyBtn);
        item.appendChild(meta);
      }

      el.popupChatList.appendChild(item);
    }

    el.popupChatList.scrollTop = el.popupChatList.scrollHeight;
  }

  async function sendPopupChatMessage(promptText, opts = {}) {
    const prompt = String(promptText || '').trim();
    const taskType = opts.taskType || 'chat';
    const selectionText = typeof opts.selectionText === 'string'
      ? opts.selectionText
      : state.chatQuotedText;
    const attachedImages = Array.isArray(opts.images) && opts.images.length > 0
      ? opts.images.slice(0, 4)
      : [];

    if (!prompt && !selectionText && attachedImages.length === 0) return;
    if (state.chatLoading) return;

    const userText = prompt || selectionText || '请结合图片内容进行分析与解读。';
    const useThinking = el.popupChatThinkingToggle
      ? Boolean(el.popupChatThinkingToggle.checked)
      : state.enableThinking;
    const reqId = ++state.chatRequestId;
    const historyForApi = state.chatMessages
      .filter((m) => !m.loading && !m.isError)
      .map((m) =>
        Array.isArray(m.images) && m.images.length > 0
          ? { role: m.role, content: m.content, images: m.images }
          : { role: m.role, content: m.content }
      );

    state.chatMessages.push({
      role: 'user',
      content: userText,
      quoteText: selectionText && selectionText !== userText ? selectionText : '',
      images: attachedImages
    });

    const assistantMsg = {
      role: 'assistant',
      content: '',
      reasoning: '',
      thinkingMs: 0,
      enableThinking: useThinking,
      loading: true,
      isError: false,
      modelLabel: '',
      engine: state.settings.engine,
      isFallback: false
    };
    state.chatMessages.push(assistantMsg);
    state.chatLoading = true;
    if (el.popupChatSendBtn) el.popupChatSendBtn.disabled = true;
    renderPopupChatList();

    let activeChatPageContext = null;
    try {
      let pageContext = null;
      const shouldIncludeCtx = Boolean(el.popupChatContextToggle?.checked);
      if (shouldIncludeCtx) {
        const normUrl = typeof WT.normalizeSessionPageUrl === 'function'
          ? WT.normalizeSessionPageUrl
          : (u) => String(u || '').trim();
        const currentUrl = normUrl(state.activeTabUrl || '');
        const restoredUrl = state.chatSessionPageMeta
          ? normUrl(state.chatSessionPageMeta.pageUrl || '')
          : '';
        if (state.chatSessionPageMeta && (!currentUrl || (restoredUrl && restoredUrl !== currentUrl))) {
          pageContext = {
            title: state.chatSessionPageMeta.pageTitle || '',
            url: state.chatSessionPageMeta.pageUrl || '',
            content: state.chatSessionPageMeta.pageExcerpt || '',
            images: []
          };
        } else if (!state.isRestrictedPage && isInjectableUrl(state.activeTabUrl)) {
          pageContext = state.pageContext || (await fetchActivePageContext());
        }
      }
      activeChatPageContext = pageContext;

      const data = await callAIChat({
        messages: historyForApi.concat([
          attachedImages.length > 0
            ? { role: 'user', content: userText, images: attachedImages }
            : { role: 'user', content: userText }
        ]),
        prompt: userText,
        taskType,
        selectionText,
        pageContext,
        images: attachedImages,
        enableThinking: useThinking,
        onProgress: (prog) => {
          if (reqId !== state.chatRequestId || !prog) return;
          assistantMsg.reasoning = useThinking ? (prog.reasoning || '') : '';
          assistantMsg.content = prog.reply || '';
          assistantMsg.thinkingMs = prog.thinkingMs || 0;
          if (prog.model) assistantMsg.modelLabel = formatLoomShortModel(prog.model);
          renderPopupChatList();
        }
      });
      if (reqId !== state.chatRequestId) return;
      assistantMsg.loading = false;
      assistantMsg.content = data.reply || '';
      assistantMsg.reasoning = data.reasoning || '';
      assistantMsg.thinkingMs = data.thinkingMs || 0;
      assistantMsg.modelLabel = data.model ? formatLoomShortModel(data.model) : getActiveModelDisplayLabel();
      assistantMsg.engine = data.engine || state.settings.engine;
      assistantMsg.isFallback = Boolean(data.fallback);
    } catch (err) {
      if (reqId !== state.chatRequestId) return;
      assistantMsg.loading = false;
      assistantMsg.isError = true;
      assistantMsg.content = err?.message || String(err);
    } finally {
      if (reqId === state.chatRequestId) {
        state.chatLoading = false;
        if (el.popupChatSendBtn) el.popupChatSendBtn.disabled = false;
        renderPopupChatList();
      }
    }

    if (reqId === state.chatRequestId && !assistantMsg.isError) {
      await persistPopupChatSession(activeChatPageContext);
    }
  }

  function submitPopupChatInput() {
    if (!el.popupChatInput || state.chatLoading) return;
    const text = el.popupChatInput.value.trim();
    const imagesToSend = state.pendingChatImages.slice(0, 4);
    if (!text && imagesToSend.length === 0) return;
    el.popupChatInput.value = '';
    state.pendingChatImages = [];
    renderPopupPendingImages();
    return sendPopupChatMessage(text || '请解读我上传的图片。', {
      taskType: 'chat',
      images: imagesToSend
    });
  }

  async function runPopupSummaryTask(taskType) {
    if (!el.popupSummaryResult) return;
    const customText = el.popupSummaryCustomInput ? el.popupSummaryCustomInput.value.trim() : '';
    const prompt = SUMMARY_TASK_PROMPTS[taskType] || SUMMARY_TASK_PROMPTS.summarize_page;
    const reqId = ++state.summaryRequestId;
    const useThinking = el.popupChatThinkingToggle
      ? Boolean(el.popupChatThinkingToggle.checked)
      : state.enableThinking;

    state.summaryLoading = true;
    state.summaryText = '';
    if (el.popupSummaryCopyBtn) el.popupSummaryCopyBtn.disabled = true;
    if (el.popupSummaryFollowupBtn) el.popupSummaryFollowupBtn.disabled = true;
    renderPopupStreamingPane(el.popupSummaryResult, {
      reasoning: '',
      thinkingMs: 0,
      reply: '',
      loadingText: 'AI 正在提炼内容...',
      streaming: true,
      showEmptyThinking: useThinking
    });

    try {
      let pageContext = null;
      if (customText) {
        pageContext = {
          title: '自定义输入文本',
          url: '',
          content: customText.slice(0, 8000)
        };
      } else if (!state.isRestrictedPage && isInjectableUrl(state.activeTabUrl)) {
        pageContext = await fetchActivePageContext();
      }

      if (!pageContext || !String(pageContext.content || '').trim()) {
        if (reqId !== state.summaryRequestId) return;
        el.popupSummaryResult.textContent =
          '当前为受限系统页或未提取到正文，请在上方「自定义正文」粘贴需要总结的文章后再点击分析。';
        if (el.popupSummaryCustomInput && typeof el.popupSummaryCustomInput.focus === 'function') {
          el.popupSummaryCustomInput.focus();
        }
        return;
      }

      const data = await callAIChat({
        messages: [{ role: 'user', content: prompt }],
        prompt,
        taskType,
        selectionText: '',
        pageContext,
        enableThinking: useThinking,
        onProgress: (prog) => {
          if (reqId !== state.summaryRequestId || !prog) return;
          renderPopupStreamingPane(el.popupSummaryResult, {
            reasoning: useThinking ? (prog.reasoning || '') : '',
            thinkingMs: prog.thinkingMs || 0,
            reply: prog.reply || '',
            loadingText: 'AI 正在提炼内容...',
            streaming: !prog.reply,
            showEmptyThinking: useThinking
          });
        }
      });
      if (reqId !== state.summaryRequestId) return;
      state.summaryText = data.reply || '';
      renderPopupStreamingPane(el.popupSummaryResult, {
        reasoning: useThinking ? (data.reasoning || '') : '',
        thinkingMs: data.thinkingMs || 0,
        reply: state.summaryText,
        streaming: false,
        showEmptyThinking: false
      });
      if (el.popupSummaryCopyBtn) el.popupSummaryCopyBtn.disabled = !state.summaryText;
      if (el.popupSummaryFollowupBtn) el.popupSummaryFollowupBtn.disabled = !state.summaryText;
    } catch (err) {
      if (reqId !== state.summaryRequestId) return;
      el.popupSummaryResult.textContent = `总结失败: ${err?.message || String(err)}`;
    } finally {
      if (reqId === state.summaryRequestId) {
        state.summaryLoading = false;
      }
    }
  }

  async function runPopupWriteTask(taskType) {
    if (!el.popupWriteInput || !el.popupWriteResult) return;
    const sourceText = el.popupWriteInput.value.trim();
    if (!sourceText) {
      el.popupWriteResult.textContent = '请先输入或粘贴需要 AI 加工处理的文本。';
      if (typeof el.popupWriteInput.focus === 'function') {
        el.popupWriteInput.focus();
      }
      return;
    }

    const reqId = ++state.writeRequestId;
    const useThinking = el.popupChatThinkingToggle
      ? Boolean(el.popupChatThinkingToggle.checked)
      : state.enableThinking;
    state.writeLoading = true;
    state.writeOutput = '';
    if (el.popupWriteCopyBtn) el.popupWriteCopyBtn.disabled = true;
    if (el.popupWriteEngineMeta) el.popupWriteEngineMeta.textContent = '处理中...';
    renderPopupStreamingPane(el.popupWriteResult, {
      reasoning: '',
      thinkingMs: 0,
      reply: '',
      loadingText: 'AI 正在改写文本...',
      placeholder: '正在分析文本并进行深度思考...',
      streaming: true,
      showEmptyThinking: useThinking
    });

    try {
      const data = await callAIChat({
        messages: [{ role: 'user', content: sourceText }],
        prompt: sourceText,
        taskType,
        selectionText: sourceText,
        pageContext: null,
        enableThinking: useThinking,
        onProgress: (prog) => {
          if (reqId !== state.writeRequestId || !prog) return;
          renderPopupStreamingPane(el.popupWriteResult, {
            reasoning: useThinking ? (prog.reasoning || '') : '',
            thinkingMs: prog.thinkingMs || 0,
            reply: prog.reply || '',
            loadingText: 'AI 正在改写文本...',
            placeholder: '正在分析文本并进行深度思考...',
            streaming: !prog.reply,
            showEmptyThinking: useThinking
          });
        }
      });
      if (reqId !== state.writeRequestId) return;
      state.writeOutput = data.reply || '';
      renderPopupStreamingPane(el.popupWriteResult, {
        reasoning: useThinking ? (data.reasoning || '') : '',
        thinkingMs: data.thinkingMs || 0,
        reply: state.writeOutput,
        streaming: false,
        showEmptyThinking: false
      });
      if (el.popupWriteCopyBtn) el.popupWriteCopyBtn.disabled = !state.writeOutput;
      if (el.popupWriteEngineMeta) {
        el.popupWriteEngineMeta.textContent = data.fallback
          ? `${ENGINE_LABELS[data.engine] || '免费引擎'} · 降级`
          : data.model
            ? formatLoomShortModel(data.model)
            : getActiveModelDisplayLabel();
      }
    } catch (err) {
      if (reqId !== state.writeRequestId) return;
      el.popupWriteResult.textContent = `处理失败: ${err?.message || String(err)}`;
      if (el.popupWriteEngineMeta) el.popupWriteEngineMeta.textContent = '';
    } finally {
      if (reqId === state.writeRequestId) {
        state.writeLoading = false;
      }
    }
  }

  function tryOpenNativeSidePanelSync() {
    if (
      state.isSidePanelMode ||
      !globalThis.chrome?.sidePanel ||
      typeof chrome.sidePanel.open !== 'function'
    ) {
      return null;
    }
    const openArg = state.activeWindowId != null
      ? { windowId: state.activeWindowId }
      : state.activeTabId != null
        ? { tabId: state.activeTabId }
        : null;
    if (!openArg) return null;
    try {
      // Called synchronously inside click handler to preserve Chrome user gesture
      return Promise.resolve(chrome.sidePanel.open(openArg)).then(
        () => true,
        () => false
      );
    } catch (_) {
      return null;
    }
  }

  async function handleOpenSidebar() {
    const restricted = state.isRestrictedPage || !isInjectableUrl(state.activeTabUrl);
    if (restricted) {
      const openedPromise = tryOpenNativeSidePanelSync();
      if (openedPromise) {
        const opened = await openedPromise;
        if (opened) {
          if (typeof window !== 'undefined' && typeof window.close === 'function') {
            window.close();
          }
          return;
        }
      }
      switchWorkspaceTab('chat');
      return;
    }

    if (state.isSidePanelMode) {
      const type = (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.SIDEBAR_TOGGLE) || 'SIDEBAR_TOGGLE';
      const res = await ensureContentScriptAndSend({ type, payload: {} });
      if (!res?.ok) {
        switchWorkspaceTab('chat');
      }
      return;
    }

    const type = (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.SIDEBAR_TOGGLE) || 'SIDEBAR_TOGGLE';
    const res = await ensureContentScriptAndSend({ type, payload: {} });
    if (res?.ok) {
      if (typeof window !== 'undefined' && typeof window.close === 'function') {
        window.close();
      }
      return;
    }

    switchWorkspaceTab('chat');
  }

  async function handleSummarizePage() {
    const restricted = state.isRestrictedPage || !isInjectableUrl(state.activeTabUrl);
    if (state.isSidePanelMode || restricted) {
      switchWorkspaceTab('summary');
      if (!restricted) {
        await runPopupSummaryTask('summarize_page');
      }
      return;
    }

    const type = (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.SIDEBAR_ACTION) || 'SIDEBAR_ACTION';
    const res = await ensureContentScriptAndSend({
      type,
      payload: { action: 'summarize_page', tab: 'summary', autoRun: true }
    });
    if (res?.ok) {
      if (typeof window !== 'undefined' && typeof window.close === 'function') {
        window.close();
      }
      return;
    }

    switchWorkspaceTab('summary');
  }

  function bindEvents() {
    if (el.openOptionsBtn) el.openOptionsBtn.addEventListener('click', openOptionsPage);
    if (el.drawerOptionsBtn) el.drawerOptionsBtn.addEventListener('click', openOptionsPage);
    if (el.engineBadge) {
      el.engineBadge.addEventListener('click', () => {
        toggleEngineDrawer();
      });
    }

    if (el.workspaceTabs) {
      el.workspaceTabs.addEventListener('click', (event) => {
        const btn = event.target?.closest ? event.target.closest('[data-workspace-tab]') : null;
        if (!btn) return;
        const tabName = btn.getAttribute('data-workspace-tab');
        if (tabName) switchWorkspaceTab(tabName);
      });
    }

    if (el.sourceLangSelect) {
      el.sourceLangSelect.addEventListener('change', async () => {
        const sourceLang = el.sourceLangSelect.value;
        await savePartialSettings({ sourceLang });
      });
    }

    const handleTargetLangGroupClick = async (event) => {
      const btn = event.target?.closest ? event.target.closest('[data-target-lang]') : null;
      if (!btn) return;
      const targetLang = btn.getAttribute('data-target-lang');
      if (!targetLang) return;

      if (targetLang === state.settings.targetLang) {
        if (state.pageStatus && state.pageStatus.isTranslated) {
          await notifyPageModeChange({ forceRetranslate: true });
        }
        return;
      }

      state.settings.targetLang = targetLang;
      renderTargetLangControls();
      await savePartialSettings({ targetLang });
      await notifyPageModeChange({ forceRetranslate: true });

      if (el.quickInput && el.quickInput.value.trim()) {
        await translateQuickText(false);
      }
    };

    if (el.pageTargetLangGroup) {
      el.pageTargetLangGroup.addEventListener('click', handleTargetLangGroupClick);
    }
    if (el.targetLangGroup) {
      el.targetLangGroup.addEventListener('click', handleTargetLangGroupClick);
    }

    if (el.displayModeGroup) {
      el.displayModeGroup.addEventListener('click', async (event) => {
        const btn = event.target?.closest ? event.target.closest('[data-display-mode]') : null;
        if (!btn) return;
        const displayMode = btn.getAttribute('data-display-mode');
        if (!displayMode || displayMode === state.settings.displayMode) return;

        await savePartialSettings({ displayMode });
        renderDisplayModeControls();
        await notifyPageModeChange();
      });
    }

    if (el.togglePageTranslateBtn) {
      el.togglePageTranslateBtn.addEventListener('click', handleTogglePageTranslate);
    }
    if (el.openSidebarBtn) {
      el.openSidebarBtn.addEventListener('click', handleOpenSidebar);
    }
    if (el.summarizePageBtn) {
      el.summarizePageBtn.addEventListener('click', handleSummarizePage);
    }

    if (el.popupEngineSelect) {
      el.popupEngineSelect.addEventListener('change', async () => {
        const engine = el.popupEngineSelect.value;
        state.codexHint = '';
        state.codexHintIsWarn = false;
        await savePartialSettings({ engine });
        renderEngineSwitcher();
        renderEngineBadge();
        await notifyPageModeChange();
        if (engine === 'loom') {
          refreshLoomModels(true);
        }
      });
    }

    if (el.popupCodexModel) {
      el.popupCodexModel.addEventListener('change', async () => {
        const model = el.popupCodexModel.value;
        const nextCodexConfig = {
          ...(state.settings.codexConfig || FALLBACK_DEFAULT_SETTINGS.codexConfig),
          model
        };
        await savePartialSettings({ codexConfig: nextCodexConfig });
        renderEngineBadge();
      });
    }

    if (el.popupCodexImportBtn) {
      el.popupCodexImportBtn.addEventListener('click', () => {
        if (state.isSidePanelMode && el.popupCodexFileInput) {
          el.popupCodexFileInput.click();
          return;
        }
        openOptionsPage();
      });
    }

    if (el.popupCodexFileInput) {
      el.popupCodexFileInput.addEventListener('change', async () => {
        const file = el.popupCodexFileInput.files && el.popupCodexFileInput.files[0];
        if (!file) return;
        try {
          const text = await readSelectedFileText(file);
          const cred = parseCodexCredential(text);
          const prevCfg = state.settings.codexConfig || FALLBACK_DEFAULT_SETTINGS.codexConfig;
          const nextCodexConfig = {
            ...prevCfg,
            accessToken: cred.accessToken || '',
            refreshToken: cred.refreshToken || '',
            accountId: cred.accountId || '',
            expiresAt: Number(cred.expiresAt || 0) || 0,
            email: cred.email || '',
            planType: cred.planType || ''
          };
          state.codexHint = '';
          state.codexHintIsWarn = false;
          await savePartialSettings({ engine: 'codex', codexConfig: nextCodexConfig });
          renderEngineSwitcher();
          renderEngineBadge();
        } catch (err) {
          state.codexHint = err?.message || '导入失败，请检查 JSON 格式';
          state.codexHintIsWarn = true;
          renderCodexSwitcherPanel();
        } finally {
          el.popupCodexFileInput.value = '';
        }
      });
    }

    if (el.popupLoomProvider) {
      el.popupLoomProvider.addEventListener('change', async () => {
        const providerId = el.popupLoomProvider.value;
        const matched = state.loomProviders.find((p) => p.id === providerId);
        const firstModel = matched && Array.isArray(matched.models) && matched.models[0]
          ? matched.models[0].id
          : state.settings.loomConfig?.model || '';
        const nextLoomConfig = {
          ...(state.settings.loomConfig || FALLBACK_DEFAULT_SETTINGS.loomConfig),
          provider: providerId,
          model: firstModel
        };
        await savePartialSettings({ loomConfig: nextLoomConfig });
        renderEngineSwitcher();
        renderEngineBadge();
      });
    }

    if (el.popupLoomModel) {
      el.popupLoomModel.addEventListener('change', async () => {
        const model = el.popupLoomModel.value;
        const nextLoomConfig = {
          ...(state.settings.loomConfig || FALLBACK_DEFAULT_SETTINGS.loomConfig),
          provider: el.popupLoomProvider?.value || state.settings.loomConfig?.provider || 'zenmux',
          model
        };
        await savePartialSettings({ loomConfig: nextLoomConfig });
        renderEngineBadge();
      });
    }

    if (el.popupLoomRefreshBtn) {
      el.popupLoomRefreshBtn.addEventListener('click', () => {
        refreshLoomModels(false);
      });
    }

    if (el.quickInput) {
      el.quickInput.addEventListener('input', updateCharCounter);
      el.quickInput.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          translateQuickText(true);
        }
      });
    }

    if (el.clearTextBtn) {
      el.clearTextBtn.addEventListener('click', () => {
        if (!el.quickInput) return;
        el.quickInput.value = '';
        state.lastQuickTranslatedText = '';
        if (el.quickResultBox) el.quickResultBox.hidden = true;
        if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
        updateCharCounter();
        if (typeof el.quickInput.focus === 'function') el.quickInput.focus();
      });
    }

    if (el.quickTranslateBtn) {
      el.quickTranslateBtn.addEventListener('click', () => translateQuickText(true));
    }

    if (el.copyResultBtn) {
      el.copyResultBtn.addEventListener('click', async () => {
        const text = state.lastQuickTranslatedText || (el.quickResultText ? el.quickResultText.textContent.trim() : '');
        const ok = await copyToClipboard(text);
        if (ok) {
          if (el.copyResultText) el.copyResultText.textContent = '已复制';
          el.copyResultBtn.classList.add('is-active');
          setTimeout(() => {
            if (el.copyResultText) el.copyResultText.textContent = '复制';
            el.copyResultBtn.classList.remove('is-active');
          }, 1400);
        }
      });
    }

    if (el.speakResultBtn) {
      el.speakResultBtn.addEventListener('click', handleSpeakResult);
    }

    if (el.toggleHistoryBtn) {
      el.toggleHistoryBtn.addEventListener('click', () => {
        const expanded = el.toggleHistoryBtn.getAttribute('aria-expanded') === 'true';
        const next = !expanded;
        el.toggleHistoryBtn.setAttribute('aria-expanded', String(next));
        if (el.historyBody) el.historyBody.hidden = !next;
      });
    }

    if (el.clearHistoryBtn) {
      el.clearHistoryBtn.addEventListener('click', async () => {
        const res = await sendRuntimeMessage({
          type: (WT.MESSAGE_TYPES && WT.MESSAGE_TYPES.CLEAR_HISTORY) || 'CLEAR_HISTORY'
        });
        if (res?.ok) {
          state.history = [];
        } else if (typeof WT.clearHistory === 'function') {
          try {
            await WT.clearHistory();
            state.history = [];
          } catch (_) {}
        }
        renderHistory();
      });
    }

    // Tab 2: AI Chat events
    if (el.popupChatContextToggle) {
      el.popupChatContextToggle.addEventListener('change', () => {
        renderAIWorkspacePageMeta();
        if (el.popupChatContextToggle.checked && !state.isRestrictedPage && !state.pageContext) {
          fetchActivePageContext().catch(() => null);
        }
      });
    }

    if (el.popupChatThinkingToggle) {
      el.popupChatThinkingToggle.addEventListener('change', () => {
        state.enableThinking = Boolean(el.popupChatThinkingToggle.checked);
      });
    }

    if (el.popupChatHistoryBtn) {
      el.popupChatHistoryBtn.addEventListener('click', () => {
        state.chatHistoryOpen = !state.chatHistoryOpen;
        renderPopupChatHistory();
        if (state.chatHistoryOpen) {
          loadPopupChatSessions();
          if (el.popupChatHistorySearch && typeof el.popupChatHistorySearch.focus === 'function') {
            el.popupChatHistorySearch.focus();
          }
        }
      });
    }

    if (el.popupChatNewBtn) {
      el.popupChatNewBtn.addEventListener('click', resetPopupChatSession);
    }

    if (el.popupChatSessionExitBtn) {
      el.popupChatSessionExitBtn.addEventListener('click', resetPopupChatSession);
    }

    if (el.popupChatHistorySearch) {
      el.popupChatHistorySearch.addEventListener('input', () => {
        state.chatHistoryQuery = el.popupChatHistorySearch.value.trim();
        loadPopupChatSessions(state.chatHistoryQuery);
      });
    }

    if (el.popupChatHistoryClearAllBtn) {
      el.popupChatHistoryClearAllBtn.addEventListener('click', clearAllPopupChatSessions);
    }

    if (el.popupChatClearBtn) {
      el.popupChatClearBtn.addEventListener('click', resetPopupChatSession);
    }

    if (el.popupChatQuoteClearBtn) {
      el.popupChatQuoteClearBtn.addEventListener('click', () => {
        state.chatQuotedText = '';
        renderPopupChatQuote();
      });
    }

    if (el.popupChatChips) {
      el.popupChatChips.addEventListener('click', (event) => {
        const chip = event.target?.closest ? event.target.closest('[data-chat-task]') : null;
        if (!chip) return;
        const taskType = chip.getAttribute('data-chat-task') || 'chat';
        const prompt = CHAT_CHIP_PROMPTS[taskType] || '请分析当前内容。';
        return sendPopupChatMessage(prompt, { taskType });
      });
    }

    if (el.popupChatImageBtn && el.popupChatImageInput) {
      el.popupChatImageBtn.addEventListener('click', () => {
        el.popupChatImageInput.click();
      });
      el.popupChatImageInput.addEventListener('change', async () => {
        if (el.popupChatImageInput.files && el.popupChatImageInput.files.length > 0) {
          await addPopupImagesFromFiles(el.popupChatImageInput.files);
        }
        el.popupChatImageInput.value = '';
      });
    }

    if (el.popupChatInput) {
      el.popupChatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          return submitPopupChatInput();
        }
      });
      el.popupChatInput.addEventListener('paste', async (event) => {
        const cd = event.clipboardData;
        if (!cd) return;
        const imageFiles = [];
        if (cd.items) {
          for (let i = 0; i < cd.items.length; i += 1) {
            const item = cd.items[i];
            if (item && item.type && item.type.startsWith('image/') && typeof item.getAsFile === 'function') {
              const file = item.getAsFile();
              if (file) imageFiles.push(file);
            }
          }
        }
        if (imageFiles.length === 0 && cd.files && cd.files.length > 0) {
          for (let i = 0; i < cd.files.length; i += 1) {
            if (cd.files[i] && /^image\//i.test(cd.files[i].type || '')) {
              imageFiles.push(cd.files[i]);
            }
          }
        }
        if (imageFiles.length > 0) {
          event.preventDefault();
          await addPopupImagesFromFiles(imageFiles);
        }
      });
    }

    if (el.paneChat) {
      el.paneChat.addEventListener('dragover', (event) => {
        event.preventDefault();
      });
      el.paneChat.addEventListener('drop', async (event) => {
        event.preventDefault();
        const files = event.dataTransfer && event.dataTransfer.files;
        if (files && files.length > 0) {
          await addPopupImagesFromFiles(files);
        }
      });
    }

    if (el.popupChatSendBtn) {
      el.popupChatSendBtn.addEventListener('click', submitPopupChatInput);
    }

    // Tab 3: Summary events
    if (el.popupSummaryRefreshBtn) {
      el.popupSummaryRefreshBtn.addEventListener('click', async () => {
        state.pageContext = null;
        await fetchActivePageContext();
      });
    }

    const summaryButtons = [
      el.popupSummaryRunBtn,
      el.popupSummaryTakeawaysBtn,
      el.popupSummaryQaBtn
    ].filter(Boolean);
    for (const btn of summaryButtons) {
      btn.addEventListener('click', () => {
        const taskType = btn.getAttribute('data-summary-task') || 'summarize_page';
        return runPopupSummaryTask(taskType);
      });
    }

    if (el.popupSummaryCopyBtn) {
      el.popupSummaryCopyBtn.addEventListener('click', async () => {
        if (!state.summaryText) return;
        if (await copyToClipboard(state.summaryText)) {
          el.popupSummaryCopyBtn.textContent = '已复制 ✓';
          setTimeout(() => {
            if (el.popupSummaryCopyBtn) el.popupSummaryCopyBtn.textContent = '复制摘要';
          }, 1300);
        }
      });
    }

    if (el.popupSummaryFollowupBtn) {
      el.popupSummaryFollowupBtn.addEventListener('click', () => {
        if (!state.summaryText) return;
        state.chatQuotedText = state.summaryText;
        renderPopupChatQuote();
        switchWorkspaceTab('chat');
      });
    }

    // Tab 4: Write events
    if (el.popupWriteInput) {
      el.popupWriteInput.addEventListener('input', () => {
        if (el.popupWriteClearBtn) {
          el.popupWriteClearBtn.hidden = el.popupWriteInput.value.length === 0;
        }
      });
    }

    if (el.popupWriteClearBtn) {
      el.popupWriteClearBtn.addEventListener('click', () => {
        if (el.popupWriteInput) el.popupWriteInput.value = '';
        state.writeOutput = '';
        el.popupWriteClearBtn.hidden = true;
        if (el.popupWriteResult) {
          el.popupWriteResult.textContent = '选择上方加工方式，AI 将立即生成优化后的文本。';
        }
        if (el.popupWriteCopyBtn) el.popupWriteCopyBtn.disabled = true;
        if (el.popupWriteEngineMeta) el.popupWriteEngineMeta.textContent = '';
      });
    }

    if (el.popupWriteActions) {
      el.popupWriteActions.addEventListener('click', (event) => {
        const btn = event.target?.closest ? event.target.closest('[data-write-task]') : null;
        if (!btn) return;
        const taskType = btn.getAttribute('data-write-task') || 'polish';
        return runPopupWriteTask(taskType);
      });
    }

    if (el.popupWriteCopyBtn) {
      el.popupWriteCopyBtn.addEventListener('click', async () => {
        if (!state.writeOutput) return;
        if (await copyToClipboard(state.writeOutput)) {
          el.popupWriteCopyBtn.textContent = '已复制 ✓';
          setTimeout(() => {
            if (el.popupWriteCopyBtn) el.popupWriteCopyBtn.textContent = '复制结果';
          }, 1300);
        }
      });
    }

    // Keep Side Panel synced with active browser tab changes
    if (state.isSidePanelMode && globalThis.chrome?.tabs) {
      if (typeof chrome.tabs.onActivated?.addListener === 'function') {
        chrome.tabs.onActivated.addListener(() => {
          syncActiveTabStatus().catch(() => null);
        });
      }
      if (typeof chrome.tabs.onUpdated?.addListener === 'function') {
        chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
          if (tabId === state.activeTabId && (changeInfo.url || changeInfo.status === 'complete')) {
            syncActiveTabStatus().catch(() => null);
          }
        });
      }
    }

    if (state.isSidePanelMode && globalThis.chrome?.storage?.onChanged?.addListener) {
      chrome.storage.onChanged.addListener((changes) => {
        const key = (WT.STORAGE_KEYS && WT.STORAGE_KEYS.SETTINGS) || 'wt_settings';
        if (changes && changes[key] && changes[key].newValue) {
          state.settings = mergeSettings(state.settings, changes[key].newValue);
          state.codexHint = '';
          state.codexHintIsWarn = false;
          renderEngineSwitcher();
          renderEngineBadge();
        }
      });
    }
  }

  async function init() {
    if (state.isSidePanelMode) {
      if (document.documentElement?.classList) {
        document.documentElement.classList.add('is-sidepanel');
      }
      if (document.body?.classList) {
        document.body.classList.add('is-sidepanel');
      }
      if (el.openSidebarBtn) {
        el.openSidebarBtn.hidden = true;
      }
    }

    bindEvents();
    switchWorkspaceTab(state.isSidePanelMode ? 'chat' : 'translate');
    renderPopupChatQuote();
    renderPopupChatList();
    updateCharCounter();

    await loadSettings();
    populateSourceLanguages();
    renderTargetLangControls();
    renderDisplayModeControls();
    renderEngineSwitcher();
    renderEngineBadge();
    if (state.settings.engine === 'loom') {
      refreshLoomModels(true);
    }
    await Promise.all([syncActiveTabStatus(), loadHistory(), loadPopupChatSessions()]);
    renderPopupChatSessionBanner();
    renderPopupChatList();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
