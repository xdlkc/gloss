/**
 * Gloss Shared Configuration & Storage Helpers
 * Runs both as a classic script (content_scripts / popup / options)
 * and via side-effect ES module import (`import '../shared/config.js'`).
 * Do NOT use `export` or `import` syntax in this file.
 */
(function initWTConfig(root) {
  'use strict';

  const SOURCE_LANGUAGES = [
    { code: 'auto', label: '自动检测 (任意语言)', nativeLabel: 'Auto Detect', shortLabel: '自动' },
    { code: 'en', label: '英语 (English)', nativeLabel: 'English', shortLabel: 'EN' },
    { code: 'zh-CN', label: '简体中文', nativeLabel: '简体中文', shortLabel: '简中' },
    { code: 'zh-TW', label: '繁體中文', nativeLabel: '繁體中文', shortLabel: '繁中' },
    { code: 'ja', label: '日语 (日本語)', nativeLabel: '日本語', shortLabel: 'JA' },
    { code: 'ko', label: '韩语 (한국어)', nativeLabel: '한국어', shortLabel: 'KO' },
    { code: 'fr', label: '法语 (Français)', nativeLabel: 'Français', shortLabel: 'FR' },
    { code: 'de', label: '德语 (Deutsch)', nativeLabel: 'Deutsch', shortLabel: 'DE' },
    { code: 'es', label: '西班牙语 (Español)', nativeLabel: 'Español', shortLabel: 'ES' },
    { code: 'ru', label: '俄语 (Русский)', nativeLabel: 'Русский', shortLabel: 'RU' },
    { code: 'pt', label: '葡萄牙语 (Português)', nativeLabel: 'Português', shortLabel: 'PT' },
    { code: 'ar', label: '阿拉伯语 (العربية)', nativeLabel: 'العربية', shortLabel: 'AR' }
  ];

  const TARGET_LANGUAGES = [
    { code: 'zh-CN', label: '简体中文', nativeLabel: '简体中文', shortLabel: '简' },
    { code: 'zh-TW', label: '繁體中文', nativeLabel: '繁體中文', shortLabel: '繁' },
    { code: 'en', label: 'English', nativeLabel: 'English', shortLabel: 'EN' }
  ];

  const STORAGE_KEYS = {
    SETTINGS: 'wt_settings',
    HISTORY: 'wt_history',
    CHAT_SESSIONS: 'wt_chat_sessions'
  };

  const MAX_HISTORY_ITEMS = 50;
  const MAX_CHAT_SESSIONS = 40;
  const MAX_SESSION_MESSAGES = 40;

  const DEFAULT_SETTINGS = {
    sourceLang: 'auto',
    targetLang: 'zh-CN',
    displayMode: 'replace',      // 'replace' | 'bilingual'
    engine: 'google-free',       // 'google-free' | 'mymemory' | 'loom' | 'openai' | 'codex'
    selectionMode: 'icon',       // 'icon' | 'instant' | 'off'
    showFloatingBall: true,
    altHoverTranslate: true,
    translationStyle: 'default', // 'default' | 'underline' | 'card'
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

  const CODEX_PRESET_MODELS = [
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', label: 'GPT-5.6 Luna (默认/推荐)', recommended: true, contextWindow: 400000, maxTokens: 32768 },
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', label: 'GPT-5.6 Sol', contextWindow: 400000, maxTokens: 32768 },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', label: 'GPT-5.6 Terra', contextWindow: 400000, maxTokens: 32768 },
    { id: 'gpt-6-luna', name: 'GPT-6 Luna', label: 'GPT-6 Luna', contextWindow: 400000, maxTokens: 32768 },
    { id: 'gpt-6-sol', name: 'GPT-6 Sol', label: 'GPT-6 Sol', contextWindow: 400000, maxTokens: 32768 },
    { id: 'gpt-6-astra', name: 'GPT-6 Astra', label: 'GPT-6 Astra', contextWindow: 400000, maxTokens: 32768 },
    { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', label: 'GPT-6.1 Sol', contextWindow: 400000, maxTokens: 32768 },
    { id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra', label: 'GPT-6.1 Terra', contextWindow: 400000, maxTokens: 32768 },
    { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', label: 'GPT-5.3 Codex', contextWindow: 400000, maxTokens: 32768 },
    { id: 'gpt-5.4', name: 'GPT-5.4', label: 'GPT-5.4', contextWindow: 400000, maxTokens: 32768 },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', label: 'GPT-5.4 Mini', contextWindow: 400000, maxTokens: 32768 }
  ];

  const LOOM_PRESET_PROVIDERS = [
    {
      id: 'zenmux',
      name: 'ZenMux',
      billing: 'ZenMux',
      models: [
        { id: 'zenmux/anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5', contextWindow: 200000, maxTokens: 16384 },
        { id: 'zenmux/meta/muse-wonder-1.0', name: 'Muse Wonder 1.0', contextWindow: 128000, maxTokens: 8192 },
        { id: 'zenmux/inclusionai/ling-3.1-flash', name: 'Ling 3.1 Flash', contextWindow: 128000, maxTokens: 8192 },
        { id: 'zenmux/xiaomi/mimo-v2.6-flash', name: 'MiMo v2.6 Flash', contextWindow: 128000, maxTokens: 8192 },
        { id: 'zenmux/xiaomi/mimo-v2.6-pro', name: 'MiMo v2.6 Pro', contextWindow: 128000, maxTokens: 16384 }
      ]
    },
    {
      id: 'glm',
      name: 'GLM 国内 Coding Plan',
      billing: 'GLM Coding Plan',
      models: [
        { id: 'glm/glm-5.3', name: 'GLM-5.3', contextWindow: 128000, maxTokens: 8192 },
        { id: 'glm/glm-5.3-flash', name: 'GLM-5.3 Flash', contextWindow: 128000, maxTokens: 8192 },
        { id: 'glm/glm-5.3-flashx', name: 'GLM-5.3 FlashX', contextWindow: 128000, maxTokens: 8192 },
        { id: 'glm/glm-5.2', name: 'GLM-5.2', contextWindow: 128000, maxTokens: 8192 },
        { id: 'glm/glm-5.1', name: 'GLM-5.1', contextWindow: 128000, maxTokens: 8192 },
        { id: 'glm/glm-5-turbo', name: 'GLM-5 Turbo', contextWindow: 128000, maxTokens: 8192 },
        { id: 'glm/glm-5', name: 'GLM-5', contextWindow: 128000, maxTokens: 8192 },
        { id: 'glm/glm-4.7', name: 'GLM-4.7', contextWindow: 128000, maxTokens: 8192 },
        { id: 'glm/glm-4.6', name: 'GLM-4.6', contextWindow: 128000, maxTokens: 8192 },
        { id: 'glm/glm-4.5', name: 'GLM-4.5', contextWindow: 128000, maxTokens: 8192 },
        { id: 'glm/glm-4.5-air', name: 'GLM-4.5 Air', contextWindow: 128000, maxTokens: 8192 }
      ]
    },
    {
      id: 'minimax',
      name: 'MiniMax 国内订阅',
      billing: 'MiniMax Subscription',
      models: [
        { id: 'minimax/minimax-m3.1-flash', name: 'MiniMax M3.1 Flash', contextWindow: 200000, maxTokens: 8192 }
      ]
    },
    {
      id: 'deepseek',
      name: 'DeepSeek API 钱包',
      billing: 'DeepSeek Wallet',
      models: [
        { id: 'deepseek/deepseek-flash', name: 'DeepSeek Flash', contextWindow: 128000, maxTokens: 8192 },
        { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', contextWindow: 128000, maxTokens: 16384 }
      ]
    },
    {
      id: 'kimi',
      name: 'Kimi Code 国内订阅',
      billing: 'Kimi Code',
      models: [
        { id: 'kimi/k3.1-pro', name: 'Kimi K3.1 Pro', contextWindow: 1048576, maxTokens: 32768 },
        { id: 'kimi/k3.1-pro-highspeed', name: 'Kimi K3.1 Pro 高速', contextWindow: 1048576, maxTokens: 32768 },
        { id: 'kimi/k3', name: 'Kimi K3', contextWindow: 1048576, maxTokens: 32768 },
        { id: 'kimi/k3-256k', name: 'Kimi K3 256K', contextWindow: 262144, maxTokens: 32768 },
        { id: 'kimi/kimi-for-coding', name: 'Kimi K2.8 Preview', contextWindow: 1048576, maxTokens: 32768 },
        { id: 'kimi/kimi-for-coding-highspeed', name: 'Kimi K2.7 Code 高速', contextWindow: 262144, maxTokens: 32768 }
      ]
    },
    {
      id: 'longcat',
      name: 'LongCat 美团开放平台',
      billing: 'LongCat Open Platform',
      models: [
        { id: 'longcat/longcat-2.5', name: 'LongCat 2.5', contextWindow: 128000, maxTokens: 8192 }
      ]
    }
  ];

  const MESSAGE_TYPES = {
    TRANSLATE_TEXT: 'TRANSLATE_TEXT',
    TRANSLATE_BATCH: 'TRANSLATE_BATCH',
    GET_SETTINGS: 'GET_SETTINGS',
    SAVE_SETTINGS: 'SAVE_SETTINGS',
    GET_HISTORY: 'GET_HISTORY',
    CLEAR_HISTORY: 'CLEAR_HISTORY',
    TEST_ENGINE: 'TEST_ENGINE',
    FETCH_LOOM_MODELS: 'FETCH_LOOM_MODELS',
    AI_CHAT: 'AI_CHAT',
    PAGE_TRANSLATE_START: 'PAGE_TRANSLATE_START',
    PAGE_TRANSLATE_RESTORE: 'PAGE_TRANSLATE_RESTORE',
    PAGE_TRANSLATE_TOGGLE: 'PAGE_TRANSLATE_TOGGLE',
    PAGE_SET_MODE: 'PAGE_SET_MODE',
    PAGE_GET_STATUS: 'PAGE_GET_STATUS',
    SHOW_SELECTION_TRANSLATION: 'SHOW_SELECTION_TRANSLATION',
    SIDEBAR_TOGGLE: 'SIDEBAR_TOGGLE',
    SIDEBAR_ACTION: 'SIDEBAR_ACTION'
  };

  const AI_TASK_TYPES = {
    chat: {
      id: 'chat',
      label: 'AI 对话',
      tab: 'chat',
      description: '围绕当前网页或自由提问展开多轮对话'
    },
    summarize_page: {
      id: 'summarize_page',
      label: '网页摘要',
      tab: 'summary',
      description: '一键提炼当前网页核心摘要、主题与关键结论'
    },
    key_takeaways: {
      id: 'key_takeaways',
      label: '核心要点',
      tab: 'summary',
      description: '提取网页结构化关键要点与重点信息'
    },
    page_qa: {
      id: 'page_qa',
      label: '关键问答',
      tab: 'summary',
      description: '围绕当前网页内容生成常见问题与解答'
    },
    explain: {
      id: 'explain',
      label: '解释',
      tab: 'chat',
      description: '用通俗清晰的语言解释术语或选中内容'
    },
    summarize: {
      id: 'summarize',
      label: '总结',
      tab: 'chat',
      description: '精炼总结选中段落的核心含义'
    },
    polish: {
      id: 'polish',
      label: '专业润色',
      tab: 'write',
      description: '优化表达专业度、流畅度与可读性'
    },
    shorten: {
      id: 'shorten',
      label: '精简缩写',
      tab: 'write',
      description: '保留关键信息并压缩冗余篇幅'
    },
    expand: {
      id: 'expand',
      label: '扩写丰富',
      tab: 'write',
      description: '补充逻辑细节与生动完整表达'
    },
    grammar: {
      id: 'grammar',
      label: '语法纠错',
      tab: 'write',
      description: '修正拼写、语法与标点问题并给出顺畅版本'
    },
    translate_en: {
      id: 'translate_en',
      label: '译为英文',
      tab: 'write',
      description: '自然地道地翻译为英文'
    },
    translate_zh: {
      id: 'translate_zh',
      label: '译为中文',
      tab: 'write',
      description: '自然地道地翻译为中文'
    }
  };

  const VALID_TARGET_LANGS = new Set(['zh-CN', 'zh-TW', 'en']);
  const VALID_DISPLAY_MODES = new Set(['bilingual', 'replace']);
  const VALID_ENGINES = new Set(['google-free', 'mymemory', 'loom', 'openai', 'codex']);
  const VALID_CODEX_REASONING_EFFORTS = new Set(['low', 'medium', 'high']);
  const VALID_SELECTION_MODES = new Set(['icon', 'instant', 'off']);
  const VALID_TRANSLATION_STYLES = new Set(['default', 'underline', 'card']);

  // Fallback in-memory storage when running outside browser/extension context
  const memoryStore = new Map();

  function decodeBase64UrlToUtf8(b64url) {
    if (typeof b64url !== 'string' || !b64url) return '';
    let b64 = b64url.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    const binary = typeof atob === 'function'
      ? atob(b64)
      : (typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64').toString('binary') : '');
    if (!binary) return '';
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (typeof TextDecoder === 'function') {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    let pct = '';
    for (let i = 0; i < bytes.length; i += 1) {
      pct += `%${bytes[i].toString(16).padStart(2, '0')}`;
    }
    return decodeURIComponent(pct);
  }

  function decodeJwtPayload(token) {
    if (typeof token !== 'string') return null;
    const clean = token.trim().replace(/^Bearer\s+/i, '');
    const parts = clean.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    try {
      const parsed = JSON.parse(decodeBase64UrlToUtf8(parts[1]));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function normalizeCodexTimestamp(rawTs) {
    if (typeof rawTs === 'string' && rawTs.trim()) {
      const asNum = Number(rawTs);
      if (Number.isFinite(asNum) && asNum > 0) {
        return asNum < 1e12 ? Math.round(asNum * 1000) : Math.round(asNum);
      }
      const parsedDate = Date.parse(rawTs);
      return Number.isFinite(parsedDate) && parsedDate > 0 ? parsedDate : 0;
    }
    if (typeof rawTs === 'number' && Number.isFinite(rawTs) && rawTs > 0) {
      return rawTs < 1e12 ? Math.round(rawTs * 1000) : Math.round(rawTs);
    }
    return 0;
  }

  function extractCodexClaimsFromJwt(token) {
    const payload = decodeJwtPayload(token);
    if (!payload) return {};
    const authNs = payload['https://api.openai.com/auth'];
    const profileNs = payload['https://api.openai.com/profile'];
    const accountId =
      authNs && typeof authNs.chatgpt_account_id === 'string'
        ? authNs.chatgpt_account_id.trim()
        : '';
    const planType =
      authNs && typeof authNs.chatgpt_plan_type === 'string'
        ? authNs.chatgpt_plan_type.trim()
        : '';
    const email =
      profileNs && typeof profileNs.email === 'string'
        ? profileNs.email.trim()
        : (typeof payload.email === 'string' ? payload.email.trim() : '');
    const expiresAt = normalizeCodexTimestamp(payload.exp);
    return { accountId, planType, email, expiresAt };
  }

  /**
   * Parse Codex OAuth credentials from ~/.codex/auth.json, ~/.pi/agent/auth.json,
   * OAuth token responses, or a raw JWT string (pure JS, zero fs/Node dependencies).
   */
  function parseCodexAuthInput(rawInput) {
    let inputObj = null;
    let rawStr = '';

    if (rawInput && typeof rawInput === 'object') {
      inputObj = rawInput;
    } else if (typeof rawInput === 'string') {
      rawStr = rawInput.trim();
      if (!rawStr) {
        throw new Error('请输入或选择 Codex 凭证 JSON / JWT 内容');
      }
      if (rawStr.startsWith('{') || rawStr.startsWith('[')) {
        try {
          inputObj = JSON.parse(rawStr);
        } catch (err) {
          throw new Error(`Codex 凭证 JSON 解析失败：${err.message}`);
        }
      }
    } else {
      throw new Error('无效的 Codex 凭证输入');
    }

    let accessToken = '';
    let refreshToken = '';
    let accountId = '';
    let email = '';
    let planType = '';
    let expiresAt = 0;
    let idToken = '';

    if (inputObj && typeof inputObj === 'object' && !Array.isArray(inputObj)) {
      const piCodex = inputObj['openai-codex'] || inputObj['openai_codex'];
      const piOpenAI = inputObj.openai;
      const tokensObj = inputObj.tokens && typeof inputObj.tokens === 'object' ? inputObj.tokens : null;

      let source = inputObj;
      if (tokensObj && (tokensObj.access_token || tokensObj.accessToken || tokensObj.refresh_token)) {
        source = tokensObj;
      } else if (piCodex && typeof piCodex === 'object' && (piCodex.access || piCodex.access_token)) {
        source = piCodex;
      } else if (piOpenAI && typeof piOpenAI === 'object' && (piOpenAI.access || piOpenAI.access_token)) {
        source = piOpenAI;
      } else if (inputObj.codex && typeof inputObj.codex === 'object' && (inputObj.codex.access || inputObj.codex.access_token)) {
        source = inputObj.codex;
      }

      accessToken = String(
        source.access_token || source.accessToken || source.access || ''
      ).trim().replace(/^Bearer\s+/i, '');
      refreshToken = String(
        source.refresh_token || source.refreshToken || source.refresh || ''
      ).trim();
      accountId = String(
        source.account_id || source.accountId || source.chatgpt_account_id || ''
      ).trim();
      email = String(source.email || '').trim();
      planType = String(source.planType || source.plan_type || '').trim();
      idToken = String(source.id_token || source.idToken || '').trim();

      expiresAt = normalizeCodexTimestamp(source.expiresAt || source.expires_at || source.expires);
      if (!expiresAt && Number.isFinite(Number(source.expires_in)) && Number(source.expires_in) > 0) {
        expiresAt = Date.now() + Math.round(Number(source.expires_in) * 1000);
      }
    } else if (rawStr) {
      const stripped = rawStr.replace(/^Bearer\s+/i, '').trim();
      if (decodeJwtPayload(stripped)) {
        accessToken = stripped;
      } else {
        throw new Error('无法识别输入的凭证内容：请粘贴有效的 ~/.codex/auth.json、~/.pi/agent/auth.json 或 JWT');
      }
    }

    if (!accessToken) {
      throw new Error('未在导入内容中找到 Codex accessToken，请确认文件或 JSON 格式正确');
    }

    const accessClaims = extractCodexClaimsFromJwt(accessToken);
    const idClaims = idToken ? extractCodexClaimsFromJwt(idToken) : {};

    accountId = accountId || accessClaims.accountId || idClaims.accountId || '';
    planType = planType || accessClaims.planType || idClaims.planType || '';
    email = email || accessClaims.email || idClaims.email || '';
    expiresAt = expiresAt || accessClaims.expiresAt || idClaims.expiresAt || 0;

    if (!accountId) {
      throw new Error('凭证缺少 chatgpt_account_id（请确保导入的是 ChatGPT Plus/Pro Codex OAuth 凭证而非 API Key）');
    }

    return {
      accessToken,
      refreshToken,
      accountId,
      expiresAt,
      email,
      planType
    };
  }

  function cloneDefaultSettings() {
    return {
      ...DEFAULT_SETTINGS,
      excludedDomains: [],
      openaiConfig: { ...DEFAULT_SETTINGS.openaiConfig },
      loomConfig: { ...DEFAULT_SETTINGS.loomConfig },
      codexConfig: { ...DEFAULT_SETTINGS.codexConfig }
    };
  }

  function normalizeExcludedDomains(domains) {
    if (!Array.isArray(domains)) return [];
    const seen = new Set();
    const out = [];
    for (const item of domains) {
      if (typeof item !== 'string') continue;
      const clean = item.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    }
    return out;
  }

  function mergeSettings(baseSettings, partialSettings) {
    const base = baseSettings && typeof baseSettings === 'object'
      ? {
          ...cloneDefaultSettings(),
          ...baseSettings,
          openaiConfig: {
            ...DEFAULT_SETTINGS.openaiConfig,
            ...(baseSettings.openaiConfig || {})
          },
          loomConfig: {
            ...DEFAULT_SETTINGS.loomConfig,
            ...(baseSettings.loomConfig || {})
          },
          codexConfig: {
            ...DEFAULT_SETTINGS.codexConfig,
            ...(baseSettings.codexConfig || {})
          }
        }
      : cloneDefaultSettings();

    if (!partialSettings || typeof partialSettings !== 'object') {
      base.excludedDomains = normalizeExcludedDomains(base.excludedDomains);
      return base;
    }

    const next = {
      ...base,
      ...partialSettings,
      openaiConfig: {
        ...base.openaiConfig,
        ...(partialSettings.openaiConfig && typeof partialSettings.openaiConfig === 'object'
          ? partialSettings.openaiConfig
          : {})
      },
      loomConfig: {
        ...base.loomConfig,
        ...(partialSettings.loomConfig && typeof partialSettings.loomConfig === 'object'
          ? partialSettings.loomConfig
          : {})
      },
      codexConfig: {
        ...base.codexConfig,
        ...(partialSettings.codexConfig && typeof partialSettings.codexConfig === 'object'
          ? partialSettings.codexConfig
          : {})
      }
    };

    if (!next.sourceLang || typeof next.sourceLang !== 'string') {
      next.sourceLang = base.sourceLang;
    }
    if (!VALID_TARGET_LANGS.has(next.targetLang)) {
      next.targetLang = VALID_TARGET_LANGS.has(base.targetLang)
        ? base.targetLang
        : DEFAULT_SETTINGS.targetLang;
    }
    if (!VALID_DISPLAY_MODES.has(next.displayMode)) {
      next.displayMode = base.displayMode;
    }
    if (!VALID_ENGINES.has(next.engine)) {
      next.engine = base.engine;
    }
    if (!VALID_SELECTION_MODES.has(next.selectionMode)) {
      next.selectionMode = base.selectionMode;
    }
    if (!VALID_TRANSLATION_STYLES.has(next.translationStyle)) {
      next.translationStyle = base.translationStyle;
    }

    next.showFloatingBall = typeof next.showFloatingBall === 'boolean'
      ? next.showFloatingBall
      : base.showFloatingBall;
    next.altHoverTranslate = typeof next.altHoverTranslate === 'boolean'
      ? next.altHoverTranslate
      : base.altHoverTranslate;
    next.excludedDomains = normalizeExcludedDomains(
      Array.isArray(partialSettings.excludedDomains)
        ? partialSettings.excludedDomains
        : base.excludedDomains
    );

    next.openaiConfig.apiUrl = typeof next.openaiConfig.apiUrl === 'string' && next.openaiConfig.apiUrl.trim()
      ? next.openaiConfig.apiUrl.trim()
      : DEFAULT_SETTINGS.openaiConfig.apiUrl;
    next.openaiConfig.apiKey = typeof next.openaiConfig.apiKey === 'string'
      ? next.openaiConfig.apiKey.trim()
      : '';
    next.openaiConfig.model = typeof next.openaiConfig.model === 'string' && next.openaiConfig.model.trim()
      ? next.openaiConfig.model.trim()
      : DEFAULT_SETTINGS.openaiConfig.model;

    next.loomConfig.baseUrl = typeof next.loomConfig.baseUrl === 'string' && next.loomConfig.baseUrl.trim()
      ? next.loomConfig.baseUrl.trim().replace(/\/+$/, '')
      : DEFAULT_SETTINGS.loomConfig.baseUrl;
    next.loomConfig.apiKey = typeof next.loomConfig.apiKey === 'string'
      ? next.loomConfig.apiKey.trim()
      : '';
    next.loomConfig.provider = typeof next.loomConfig.provider === 'string' && next.loomConfig.provider.trim()
      ? next.loomConfig.provider.trim()
      : DEFAULT_SETTINGS.loomConfig.provider;
    next.loomConfig.model = typeof next.loomConfig.model === 'string' && next.loomConfig.model.trim()
      ? next.loomConfig.model.trim()
      : DEFAULT_SETTINGS.loomConfig.model;
    if (next.loomConfig.model === 'kimi/k3.1-highspeed') {
      next.loomConfig.model = 'kimi/k3.1-pro-highspeed';
    }

    next.codexConfig.baseUrl = typeof next.codexConfig.baseUrl === 'string' && next.codexConfig.baseUrl.trim()
      ? next.codexConfig.baseUrl.trim().replace(/\/+$/, '')
      : DEFAULT_SETTINGS.codexConfig.baseUrl;
    next.codexConfig.model = typeof next.codexConfig.model === 'string' && next.codexConfig.model.trim()
      ? next.codexConfig.model.trim()
      : DEFAULT_SETTINGS.codexConfig.model;
    const rawEffort = typeof next.codexConfig.reasoningEffort === 'string'
      ? next.codexConfig.reasoningEffort.trim().toLowerCase()
      : '';
    next.codexConfig.reasoningEffort = VALID_CODEX_REASONING_EFFORTS.has(rawEffort)
      ? rawEffort
      : DEFAULT_SETTINGS.codexConfig.reasoningEffort;
    next.codexConfig.accessToken = typeof next.codexConfig.accessToken === 'string'
      ? next.codexConfig.accessToken.trim().replace(/^Bearer\s+/i, '')
      : '';
    next.codexConfig.refreshToken = typeof next.codexConfig.refreshToken === 'string'
      ? next.codexConfig.refreshToken.trim()
      : '';
    next.codexConfig.accountId = typeof next.codexConfig.accountId === 'string'
      ? next.codexConfig.accountId.trim()
      : '';
    next.codexConfig.email = typeof next.codexConfig.email === 'string'
      ? next.codexConfig.email.trim()
      : '';
    next.codexConfig.planType = typeof next.codexConfig.planType === 'string'
      ? next.codexConfig.planType.trim()
      : '';
    next.codexConfig.expiresAt = normalizeCodexTimestamp(next.codexConfig.expiresAt);

    if (next.codexConfig.accessToken && (!next.codexConfig.accountId || !next.codexConfig.expiresAt)) {
      const claims = extractCodexClaimsFromJwt(next.codexConfig.accessToken);
      if (!next.codexConfig.accountId && claims.accountId) next.codexConfig.accountId = claims.accountId;
      if (!next.codexConfig.email && claims.email) next.codexConfig.email = claims.email;
      if (!next.codexConfig.planType && claims.planType) next.codexConfig.planType = claims.planType;
      if (!next.codexConfig.expiresAt && claims.expiresAt) next.codexConfig.expiresAt = claims.expiresAt;
    }

    return next;
  }

  function getChromeStorage() {
    if (typeof chrome !== 'undefined' && chrome && chrome.storage) {
      return chrome.storage;
    }
    return null;
  }

  function storageCall(area, method, arg) {
    return new Promise((resolve, reject) => {
      try {
        const fn = area && area[method];
        if (typeof fn !== 'function') {
          reject(new Error(`Storage method "${method}" is unavailable`));
          return;
        }
        let settled = false;
        const finish = (err, value) => {
          if (settled) return;
          settled = true;
          if (err) reject(err);
          else resolve(value);
        };
        const callback = (value) => {
          const lastError = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError;
          if (lastError) {
            finish(new Error(lastError.message || String(lastError)));
          } else {
            finish(null, value);
          }
        };
        const maybePromise = arg !== undefined ? fn.call(area, arg, callback) : fn.call(area, callback);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(
            (res) => finish(null, res),
            (err) => finish(err)
          );
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  function readLocalStorageFallback(key) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : undefined;
      }
    } catch (_) {
      // Ignore localStorage parse/security errors
    }
    return memoryStore.get(key);
  }

  function writeLocalStorageFallback(key, value) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (_) {
      // Ignore localStorage quota/security errors
    }
    memoryStore.set(key, value);
  }

  async function readFromArea(area, key) {
    const res = await storageCall(area, 'get', [key]);
    return res && typeof res === 'object' ? res[key] : undefined;
  }

  async function writeToArea(area, key, value) {
    await storageCall(area, 'set', { [key]: value });
  }

  async function getSettings() {
    const storage = getChromeStorage();
    let stored;

    if (storage && storage.sync) {
      try {
        stored = await readFromArea(storage.sync, STORAGE_KEYS.SETTINGS);
      } catch (_) {
        stored = undefined;
      }
    }

    if (stored === undefined && storage && storage.local) {
      try {
        stored = await readFromArea(storage.local, STORAGE_KEYS.SETTINGS);
      } catch (_) {
        stored = undefined;
      }
    }

    if (stored === undefined && !storage) {
      stored = readLocalStorageFallback(STORAGE_KEYS.SETTINGS);
    }

    return mergeSettings(DEFAULT_SETTINGS, stored);
  }

  async function saveSettings(partialSettings) {
    const current = await getSettings();
    const merged = mergeSettings(current, partialSettings);
    const storage = getChromeStorage();

    if (storage && storage.sync) {
      try {
        await writeToArea(storage.sync, STORAGE_KEYS.SETTINGS, merged);
        return merged;
      } catch (_) {
        // Fall through to storage.local
      }
    }

    if (storage && storage.local) {
      try {
        await writeToArea(storage.local, STORAGE_KEYS.SETTINGS, merged);
        return merged;
      } catch (_) {
        // Fall through to memory/localStorage
      }
    }

    writeLocalStorageFallback(STORAGE_KEYS.SETTINGS, merged);
    return merged;
  }

  async function getHistory() {
    const storage = getChromeStorage();
    let history;

    if (storage && storage.local) {
      try {
        history = await readFromArea(storage.local, STORAGE_KEYS.HISTORY);
      } catch (_) {
        history = undefined;
      }
    } else if (!storage) {
      history = readLocalStorageFallback(STORAGE_KEYS.HISTORY);
    }

    return Array.isArray(history) ? history : [];
  }

  async function addHistoryItem(item) {
    if (!item || typeof item !== 'object') {
      return getHistory();
    }
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    const translatedText = typeof item.translatedText === 'string' ? item.translatedText.trim() : '';
    if (!text || !translatedText) {
      return getHistory();
    }

    const entry = {
      id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      translatedText,
      detectedSourceLang: item.detectedSourceLang || item.sourceLang || 'auto',
      sourceLang: item.sourceLang || 'auto',
      targetLang: item.targetLang || DEFAULT_SETTINGS.targetLang,
      engine: item.engine || DEFAULT_SETTINGS.engine,
      timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now()
    };

    const existing = await getHistory();
    const filtered = existing.filter(
      (h) => !(h && h.text === entry.text && h.targetLang === entry.targetLang)
    );
    const next = [entry, ...filtered].slice(0, MAX_HISTORY_ITEMS);

    const storage = getChromeStorage();
    if (storage && storage.local) {
      try {
        await writeToArea(storage.local, STORAGE_KEYS.HISTORY, next);
        return next;
      } catch (_) {
        // Fall through
      }
    }

    writeLocalStorageFallback(STORAGE_KEYS.HISTORY, next);
    return next;
  }

  async function clearHistory() {
    const empty = [];
    const storage = getChromeStorage();

    if (storage && storage.local) {
      try {
        await writeToArea(storage.local, STORAGE_KEYS.HISTORY, empty);
        return empty;
      } catch (_) {
        // Fall through
      }
    }

    writeLocalStorageFallback(STORAGE_KEYS.HISTORY, empty);
    return empty;
  }

  // ==========================================================================
  // Historical Webpage AI Conversation Sessions Store & Query Helpers
  // ==========================================================================

  function normalizeSessionPageUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    if (/^(?:https?:\/\/|file:\/\/)/i.test(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        if (parsed.hash && !parsed.hash.startsWith('#/')) {
          parsed.hash = '';
        }
        return parsed.toString();
      } catch (_) {
        const hashIdx = trimmed.indexOf('#');
        if (hashIdx >= 0 && !trimmed.slice(hashIdx).startsWith('#/')) {
          return trimmed.slice(0, hashIdx);
        }
        return trimmed;
      }
    }
    return trimmed;
  }

  function extractSessionHostname(rawUrl) {
    const clean = normalizeSessionPageUrl(rawUrl);
    if (!clean) return '自由对话';
    if (/^file:\/\//i.test(clean)) return '本地文件';
    try {
      const parsed = new URL(clean);
      return parsed.hostname || '自由对话';
    } catch (_) {
      return '自由对话';
    }
  }

  function sanitizeSessionMessage(msg) {
    if (!msg || typeof msg !== 'object' || msg.loading || msg.isError) {
      return null;
    }
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    const content = typeof msg.content === 'string' ? msg.content.trim().slice(0, 12000) : '';
    const reasoning = typeof msg.reasoning === 'string' ? msg.reasoning.trim().slice(0, 6000) : '';
    const quoteText = typeof msg.quoteText === 'string' ? msg.quoteText.trim().slice(0, 1000) : '';

    let images = [];
    if (Array.isArray(msg.images) && msg.images.length > 0) {
      images = msg.images
        .slice(0, 4)
        .map((im) => {
          if (!im || typeof im !== 'object') return null;
          let url = typeof im.url === 'string' ? im.url.trim() : '';
          let dataUrl = typeof im.dataUrl === 'string' ? im.dataUrl.trim() : '';
          if (dataUrl.length > 160000) dataUrl = '';
          if (url.length > 160000 && /^data:image\//i.test(url)) url = '';
          const alt = typeof im.alt === 'string' ? im.alt.trim().slice(0, 100) : '';
          const source = typeof im.source === 'string' ? im.source.trim().slice(0, 24) : '';
          if (!url && !dataUrl && !alt) return null;
          return { url, dataUrl, alt, source };
        })
        .filter(Boolean);
    }

    if (!content && !quoteText && !reasoning && images.length === 0) {
      return null;
    }

    const out = {
      role,
      content,
      reasoning,
      thinkingMs:
        typeof msg.thinkingMs === 'number' && Number.isFinite(msg.thinkingMs)
          ? Math.max(0, Math.round(msg.thinkingMs))
          : 0,
      quoteText,
      modelLabel: typeof msg.modelLabel === 'string' ? msg.modelLabel.trim().slice(0, 100) : '',
      engine: typeof msg.engine === 'string' ? msg.engine.trim().slice(0, 40) : '',
      isFallback: Boolean(msg.isFallback),
      timestamp:
        typeof msg.timestamp === 'number' && Number.isFinite(msg.timestamp)
          ? msg.timestamp
          : Date.now()
    };
    if (images.length > 0) {
      out.images = images;
    }
    return out;
  }

  function buildSessionMatchSnippet(session, rawQuery) {
    const collapseWs = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const messages = Array.isArray(session?.messages) ? session.messages : [];
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const q = collapseWs(rawQuery).toLowerCase();

    if (!q) {
      const base = collapseWs(
        (lastMsg && (lastMsg.content || lastMsg.quoteText)) ||
        session?.pageExcerpt ||
        session?.pageTitle ||
        ''
      );
      return base.length > 90 ? `${base.slice(0, 90).trimEnd()}...` : base;
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const candidates = [];
    for (let i = 0; i < messages.length; i += 1) {
      const m = messages[i];
      if (m && m.content) candidates.push(collapseWs(m.content));
      if (m && m.quoteText) candidates.push(collapseWs(m.quoteText));
      if (m && m.reasoning) candidates.push(collapseWs(m.reasoning));
    }
    if (session?.pageTitle) candidates.push(collapseWs(session.pageTitle));
    if (session?.pageExcerpt) candidates.push(collapseWs(session.pageExcerpt));
    if (session?.pageUrl) candidates.push(collapseWs(session.pageUrl));

    let chosen = candidates.find((txt) => {
      const lower = txt.toLowerCase();
      return tokens.every((t) => lower.includes(t));
    });
    if (!chosen) {
      chosen = candidates.find((txt) => {
        const lower = txt.toLowerCase();
        return tokens.some((t) => lower.includes(t));
      });
    }

    if (!chosen) {
      const base = collapseWs(
        (lastMsg && (lastMsg.content || lastMsg.quoteText)) || session?.pageTitle || ''
      );
      return base.length > 90 ? `${base.slice(0, 90).trimEnd()}...` : base;
    }

    const lowerChosen = chosen.toLowerCase();
    let firstIdx = -1;
    for (let i = 0; i < tokens.length; i += 1) {
      const idx = lowerChosen.indexOf(tokens[i]);
      if (idx >= 0 && (firstIdx < 0 || idx < firstIdx)) {
        firstIdx = idx;
      }
    }
    if (firstIdx < 0) firstIdx = 0;

    const start = Math.max(0, firstIdx - 28);
    const end = Math.min(chosen.length, start + 100);
    let excerpt = chosen.slice(start, end).trim();
    if (start > 0) excerpt = `...${excerpt}`;
    if (end < chosen.length) excerpt = `${excerpt}...`;
    return excerpt;
  }

  async function readChatSessionsRaw() {
    const storage = getChromeStorage();
    let sessions;

    if (storage && storage.local) {
      try {
        sessions = await readFromArea(storage.local, STORAGE_KEYS.CHAT_SESSIONS);
      } catch (_) {
        sessions = undefined;
      }
    }

    if (!Array.isArray(sessions)) {
      sessions = readLocalStorageFallback(STORAGE_KEYS.CHAT_SESSIONS);
    }

    return Array.isArray(sessions) ? sessions : [];
  }

  async function writeChatSessionsRaw(next) {
    const clean = Array.isArray(next) ? next : [];
    writeLocalStorageFallback(STORAGE_KEYS.CHAT_SESSIONS, clean);
    const storage = getChromeStorage();
    if (storage && storage.local) {
      try {
        await writeToArea(storage.local, STORAGE_KEYS.CHAT_SESSIONS, clean);
      } catch (_) {
        // Fallback already persisted above
      }
    }
    return clean;
  }

  async function getChatSessions(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const targetUrl = typeof opts.pageUrl === 'string' && opts.pageUrl.trim()
      ? normalizeSessionPageUrl(opts.pageUrl)
      : '';
    const queryRaw = typeof opts.query === 'string' ? opts.query.trim() : '';
    const tokens = queryRaw ? queryRaw.toLowerCase().split(/\s+/).filter(Boolean) : [];
    const limit =
      typeof opts.limit === 'number' && Number.isFinite(opts.limit) && opts.limit > 0
        ? Math.min(MAX_CHAT_SESSIONS, Math.floor(opts.limit))
        : MAX_CHAT_SESSIONS;

    const rawList = await readChatSessionsRaw();
    const matched = [];

    for (let i = 0; i < rawList.length; i += 1) {
      const s = rawList[i];
      if (!s || typeof s !== 'object') continue;
      if (targetUrl) {
        const sUrl = normalizeSessionPageUrl(s.pageUrl || '');
        if (sUrl !== targetUrl) continue;
      }

      if (tokens.length > 0) {
        const msgParts = Array.isArray(s.messages)
          ? s.messages.map((m) => `${m?.content || ''}\n${m?.quoteText || ''}\n${m?.reasoning || ''}`).join('\n')
          : '';
        const haystack = [
          s.title || '',
          s.pageTitle || '',
          s.pageUrl || '',
          s.hostname || '',
          s.pageExcerpt || '',
          msgParts
        ]
          .join('\n')
          .toLowerCase();
        const allMatched = tokens.every((t) => haystack.includes(t));
        if (!allMatched) continue;
      }

      matched.push({
        ...s,
        matchSnippet: buildSessionMatchSnippet(s, queryRaw)
      });
    }

    matched.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    return matched.slice(0, limit);
  }

  async function saveChatSession(sessionInput) {
    if (!sessionInput || typeof sessionInput !== 'object') return null;
    const rawMsgs = Array.isArray(sessionInput.messages) ? sessionInput.messages : [];
    const sanitizedMessages = rawMsgs
      .map(sanitizeSessionMessage)
      .filter(Boolean)
      .slice(-MAX_SESSION_MESSAGES);

    if (sanitizedMessages.length === 0) {
      return null;
    }

    const existing = await readChatSessionsRaw();
    const inputId = typeof sessionInput.id === 'string' ? sessionInput.id.trim() : '';
    const prev = inputId ? existing.find((s) => s && s.id === inputId) : null;

    const id = inputId || `cs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pageUrl = normalizeSessionPageUrl(
      typeof sessionInput.pageUrl === 'string' ? sessionInput.pageUrl : (prev?.pageUrl || '')
    );
    const pageTitle = (
      (typeof sessionInput.pageTitle === 'string' ? sessionInput.pageTitle.trim() : '') ||
      prev?.pageTitle ||
      extractSessionHostname(pageUrl) ||
      '自由对话'
    ).slice(0, 200);
    const hostname = (
      (typeof sessionInput.hostname === 'string' ? sessionInput.hostname.trim() : '') ||
      extractSessionHostname(pageUrl)
    ).slice(0, 120);
    const pageExcerpt = (
      (typeof sessionInput.pageExcerpt === 'string' ? sessionInput.pageExcerpt.trim() : '') ||
      prev?.pageExcerpt ||
      ''
    ).slice(0, 2400);

    const firstUserMsg = sanitizedMessages.find((m) => m.role === 'user') || sanitizedMessages[0];
    const autoTitleSource = (firstUserMsg?.content || firstUserMsg?.quoteText || pageTitle || '网页会话')
      .replace(/\s+/g, ' ')
      .trim();
    const title = (
      (typeof sessionInput.title === 'string' && sessionInput.title.trim()) ||
      (autoTitleSource.length > 48 ? `${autoTitleSource.slice(0, 48).trimEnd()}...` : autoTitleSource) ||
      pageTitle
    ).slice(0, 120);

    const now = Date.now();
    const createdAt =
      typeof sessionInput.createdAt === 'number' && Number.isFinite(sessionInput.createdAt)
        ? sessionInput.createdAt
        : (typeof prev?.createdAt === 'number' && Number.isFinite(prev.createdAt) ? prev.createdAt : now);
    const updatedAt =
      typeof sessionInput.updatedAt === 'number' && Number.isFinite(sessionInput.updatedAt)
        ? sessionInput.updatedAt
        : now;

    const entry = {
      id,
      title,
      pageUrl,
      pageTitle,
      hostname,
      pageExcerpt,
      createdAt,
      updatedAt,
      messages: sanitizedMessages
    };

    const filtered = existing.filter((s) => s && s.id !== id);
    const next = [entry, ...filtered].slice(0, MAX_CHAT_SESSIONS);
    await writeChatSessionsRaw(next);

    return {
      ...entry,
      matchSnippet: buildSessionMatchSnippet(entry, '')
    };
  }

  async function deleteChatSession(sessionId) {
    const targetId = typeof sessionId === 'string' ? sessionId.trim() : '';
    const existing = await readChatSessionsRaw();
    const next = existing.filter((s) => s && s.id !== targetId);
    await writeChatSessionsRaw(next);
    return getChatSessions();
  }

  async function clearChatSessions() {
    await writeChatSessionsRaw([]);
    return [];
  }

  // ==========================================================================
  // Simplified <-> Traditional Chinese Script Conversion & Enforcement
  // ==========================================================================

  function normalizeScriptTargetLang(lang) {
    if (!lang || typeof lang !== 'string') return '';
    const clean = lang.trim().toLowerCase().replace(/_/g, '-');
    if (
      clean === 'zh-tw' ||
      clean === 'zh-hant' ||
      clean === 'zh-hk' ||
      clean === 'zh-mo' ||
      clean === 'cht' ||
      clean === 'tw'
    ) {
      return 'zh-TW';
    }
    if (
      clean === 'zh-cn' ||
      clean === 'zh-hans' ||
      clean === 'zh-sg' ||
      clean === 'zh' ||
      clean === 'chs' ||
      clean === 'cn'
    ) {
      return 'zh-CN';
    }
    if (clean === 'en' || clean.startsWith('en-')) {
      return 'en';
    }
    return clean;
  }

  const S2T_PHRASES = [
    ['软件', '軟體'],
    ['网络', '網路'],
    ['信息', '資訊'],
    ['默认', '預設'],
    ['支持', '支援'],
    ['界面', '介面'],
    ['服务器', '伺服器'],
    ['内存', '記憶體'],
    ['视频', '影片'],
    ['音频', '音訊'],
    ['链接', '連結'],
    ['扩展', '擴充'],
    ['数据', '資料'],
    ['人工智能', '人工智慧'],
    ['操作系统', '作業系統'],
    ['数据库', '資料庫'],
    ['浏览器', '瀏覽器'],
    ['鼠标', '滑鼠'],
    ['键盘', '鍵盤'],
    ['屏幕', '螢幕'],
    ['打印', '列印'],
    ['博客', '部落格'],
    ['面条', '麵條'],
    ['面包', '麵包'],
    ['面粉', '麵粉'],
    ['方便面', '泡麵'],
    ['制造', '製造'],
    ['制作', '製作'],
    ['复制', '複製'],
    ['录制', '錄製'],
    ['定制', '定製'],
    ['研制', '研製'],
    ['绘制', '繪製'],
    ['复杂', '複雜'],
    ['重复', '重複'],
    ['恢复', '恢復'],
    ['修复', '修復'],
    ['联系', '聯繫'],
    ['关系', '關係'],
    ['维系', '維繫'],
    ['用于', '用於'],
    ['对于', '對於'],
    ['关于', '關於'],
    ['由于', '由於'],
    ['基于', '基於'],
    ['属于', '屬於'],
    ['处于', '處於'],
    ['位于', '位於'],
    ['等于', '等於'],
    ['大于', '大於'],
    ['小于', '小於'],
    ['高于', '高於'],
    ['低于', '低於'],
    ['终于', '終於'],
    ['开辟', '開闢'],
    ['舍弃', '捨棄'],
    ['取舍', '取捨'],
    ['战斗', '戰鬥'],
    ['奋斗', '奮鬥'],
    ['斗争', '鬥爭'],
    ['轻松', '輕鬆'],
    ['放松', '放鬆'],
    ['抑郁', '抑鬱'],
    ['郁闷', '鬱悶'],
    ['浓郁', '濃鬱'],
    ['丑陋', '醜陋'],
    ['账户', '帳戶'],
    ['账号', '帳號'],
    ['账单', '帳單'],
    ['电子邮件', '電子郵件'],
    ['代码仓库', '程式碼倉庫'],
    ['单点登录', '單一登入']
  ];

  // S->T only phrasing nuances (do not blindly reverse to avoid over-converting)
  const S2T_ONLY_PHRASES = [
    ['设置', '設定']
  ];

  const T2S_PHRASES = [
    ...S2T_PHRASES.map(([s, t]) => [t, s]),
    ['帳戶', '账户'],
    ['賬戶', '账户'],
    ['帳號', '账号'],
    ['賬號', '账号'],
    ['帳單', '账单'],
    ['賬單', '账单'],
    ['記帳', '记账'],
    ['結帳', '结账'],
    ['轉帳', '转账'],
    ['對帳', '对账'],
    ['台帳', '台账'],
    ['單點登錄', '单点登录'],
    ['回覆', '回复'],
    ['反覆', '反复'],
    ['憑藉', '凭借'],
    ['藉此', '借此'],
    ['藉由', '借由']
  ];

  const S2T_CHAR_MAP = {};
  const addS2TPairs = (pairsStr) => {
    for (let i = 0; i + 1 < pairsStr.length; i += 2) {
      const s = pairsStr[i];
      const t = pairsStr[i + 1];
      if (s && t && s !== t && !S2T_CHAR_MAP[s]) {
        S2T_CHAR_MAP[s] = t;
      }
    }
  };

  // High-frequency Simplified -> Traditional character mapping table (unique keys, S!=T)
  addS2TPairs(
    '简簡体體繁繁语語翻翻译譯网網页頁软軟件件络絡认認设設浏瀏览覽显顯' +
    '换換选選择擇划劃词詞悬懸停停双雙对對照照仅僅复復清清历歷记記' +
    '录錄识識别別检檢测測试試连連欢歡谢謝学學习習国國际際开開' +
    '关關点點击擊实實现現专專业業机機发發计計画畫环環资資档檔' +
    '码碼读讀听聽写寫说說请請問問帮幫图圖标標題題签簽栏欄纽紐弹彈' +
    '动動快快键鍵盘盤屏屏数數据據库庫服服端端云雲离離线線种種' +
    '类類样樣风風条條排排除除域域表表添添删刪保保经經旧舊变變' +
    '优優质質高高效效率率缓緩冲衝并並异異错錯误誤警警告告内內' +
    '汇彙单單独獨节節与與为為这這个個们們会會来來时時間間没沒' +
    '无無够夠让讓给給从從进進过過后後边邊里裡长長轻輕难難' +
    '爱愛亲親电電腦腦话話车車东東风風鸟鳥鱼魚龙龍马馬飞飛' +
    '铁鐵桥橋门門户戶书書纸紙笔筆声聲乐樂视視频頻暂暫继繼续續' +
    '结結终終总總构構创創产產商商贸貿济濟银銀钱錢币幣价價费費' +
    '买買卖賣订訂账賬号號隐隱权權证證确確录錄注註册冊编編辑輯' +
    '补補升升级級载載导導搜搜过過滤濾统統报報树樹状狀态態决決' +
    '应應参參配配规規范範协協议議块塊驱驅调調传傳输輸携攜获獲' +
    '归歸备備还還复復彻徹临臨实實广廣显顯领領进進观觀愿願该該' +
    '许許拦攔转轉闭閉启啟运運执執触觸响響反反馈饋评評论論讨討' +
    '沟溝桥橋梁樑亿億额額适適邮郵仓倉联聯织織购購杂雜责責贤賢' +
    '货貨贩販贫貧贬貶贷貸贴貼贵貴贺賀赁賃贼賊宾賓赏賞赔賠赋賦' +
    '赌賭赐賜赖賴赚賺赞贊赠贈赢贏鉴鑑验驗强強给給细細约約红紅' +
    '练練紧緊绪緒缘緣缠纏缩縮缴繳罚罰罢罷罗羅羟羥羡羨翘翹职職' +
    '肃肅肠腸肤膚肿腫胀脹胁脅胶膠脉脈脏臟脑腦脓膿脚腳脱脫脸臉' +
    '腊臘腻膩腾騰舆輿舱艙舰艦艰艱艺藝莹瑩莺鶯萝蘿萤螢营營萧蕭' +
    '萨薩蓝藍虑慮虚虛虫蟲虽雖虾蝦蚀蝕蚁蟻蚂螞蚕蠶蛮蠻衬襯袭襲' +
    '装裝裤褲见見觅覓觉覺觊覬觌覿觞觴订訂讣訃讯訊讧訌讨討讪訕' +
    '讫訖训訓讲講讳諱讴謳讶訝讷訥讹訛讼訟讽諷访訪诀訣诂詁诃訶' +
    '诅詛诈詐诉訴诊診诋詆诏詔诒詒诓誆诔誄诖詿诗詩诘詰诙詼诚誠' +
    '诛誅诜詵诞誕诟詬诠詮诡詭询詢诣詣诤諍详詳诧詫诨諢诩詡诫誡' +
    '诬誣诮誚诰誥诱誘诲誨诳誑诵誦诶誒诸諸诹諏诺諾诼諑诽誹课課' +
    '诿諉谀諛谁誰谂諗谄諂谅諒谆諄谇誶谈談谊誼谋謀谌諶谍諜谎謊' +
    '谏諫谐諧谑謔谒謁谓謂谔諤谕諭谖諼谗讒谘諮谙諳谚諺谛諦谜謎' +
    '谝諞谟謨谠讜谡謖谣謠谤謗谥諡谦謙谧謐谨謹谩謾谪謫谫譾谬謬' +
    '谭譚谮譖谯譙谰讕谱譜谲譎谳讞谴譴谵譫谶讖轧軋轨軌轩軒轫軔' +
    '轭軛轮輪轰轟轱軲轲軻轳轤轴軸轵軹轶軼轷軤轸軫轹轢轺軺轿轎' +
    '轾輊辀輈辁輇辂輅较較辄輒辅輔辆輛辇輦辈輩辉輝辊輥辋輞辌輬' +
    '辍輟辎輜辏輳辐輻辔轡辕轅辖轄辗輾辘轆辙轍辚轔办辦辞辭辩辯' +
    '辫辮辽遼达達迁遷迈邁违違迟遲迩邇迹跡逊遜递遞逦邐逻邏遗遺' +
    '遥遙邓鄧邝鄺邬鄔邹鄒邺鄴邻鄰郁鬱郑鄭郓鄆郦酈郧鄖酝醞酱醬' +
    '酿釀释釋针針钉釘钊釗钋釙钌釕钍釷钎釺钏釧钐釤钒釩钓釣钔鍆' +
    '钕釹钗釵钙鈣钚鈈钛鈦钜鉅钝鈍钞鈔钟鐘钠鈉钡鋇钢鋼钣鈑钤鈐' +
    '钥鑰钦欽钧鈞钨鎢钩鉤钪鈧钫鈁钬鈦钭鈄钯鈀钰鈺钲鉦钳鉗钴鈷' +
    '钵缽钶鉳钷鉕钹鈸钺鉞钻鑽钼鉬钽鉭钾鉀钿鈿铀鈾铂鉑铃鈴铄鑠' +
    '铅鉛铆鉚铈鈰铉鉉铊鉈铋鉍铌鈮铍鈹铎鐸铜銅铝鋁铡鍘铠鎧铨銓' +
    '铢銖铣銑铤鋌铭銘铬鉻铧鏵铩鎩铪鉿铫銚铮錚铯銫铰鉸铱銥铲鏟' +
    '铳銃铴鐋铵銨铷銣铸鑄铹鐒铺鋪链鏈铿鏗销銷锁鎖锂鋰锃鋥锄鋤' +
    '锅鍋锆鋯锇鋨锈鏽锉銼锊鋝锋鋒锌鋅锐銳锑銻锒鋃锓鋟锔鋦锕錒' +
    '锖錆锗鍺锚錨锛錛锜錡锝鍀锞錁锟錕锡錫锢錮锣鑼锤錘锥錐锦錦' +
    '锨鍁锱錙锯鋸锰錳锲鍥锴鍇锵鏘锶鍶锷鍔锸鍤锹鍬锻鍛锼鎪锾鍰' +
    '镀鍍镁鎂镂鏤镇鎮镉鎘镊鑷镌鐫镍鎳镏鎦镐鎬镑鎊镒鎰镓鎵镔鑌' +
    '镖鏢镗鏜镘鏝镙鏍镛鏞镜鏡镝鏑镞鏃镟鏇镡鐔镣鐐镤鏷镥鑥镦鐓' +
    '镧鑭镨鐠镩鑹镪鏹镫鐙镬鑊镭鐳镯鐲镰鐮镱鐿镲鑔镳鑣镶鑲闩閂' +
    '闪閃闫閆闭閉闯闖闰閏闱闈闲閒闳閎闷悶闸閘闹鬧闺閨闻聞闼闥' +
    '闽閩闾閭闿闓阀閥阁閣阂閡阃閫阄鬮阅閱阆閬阇闍阈閾阉閹阊閶' +
    '阋鬩阌閿阍閽阎閻阏閼阐闡阑闌阒闃阔闊阕闋阖闔阗闐阙闕阚闞' +
    '队隊阳陽阴陰阵陣阶階陆陸陇隴陈陳陉陘陕陝陨隕险險随隨隶隸' +
    '雏雛雠讎雾霧霁霽霉黴霭靄靓靚静靜靥靨鞑韃鞒鞽鞯韉韦韋韧韌' +
    '韩韓韪韙韫韞韬韜韵韻顶頂顷頃顸頇项項顺順须須顼頊顽頑顾顧' +
    '顿頓颀頎颁頒颂頌颃頏预預颅顱颇頗颈頸颉頡颊頰颋頲颌頜颍潁' +
    '颏頦颐頤频頻颓頹颔頷颖穎颗顆颙顒颚顎颛顓颜顏颞顳颟顢颠顛' +
    '颡顙颢顥颤顫颦顰颧顴飏颺飐颭飑颮飒颯飓颶飔颸飕颼飗飀飘飄' +
    '飙飆饥飢饦飥饧餳饨飩饩餼饪飪饫飫饬飭饭飯饮飲饯餞饰飾饱飽' +
    '饲飼饴飴饵餌饶饒饷餉饺餃饼餅饽餑饿餓馀餘馁餒馆館馈饋馋饞' +
    '馍饃馏餾馐饈馑饉馒饅馓饊馔饌馕饢驭馭驮馱驯馴驰馳驱驅驳駁' +
    '驴驢驵駔驶駛驷駟驸駙驹駒驺騶驻駐驼駝驽駑驾駕驿驛骀駘骁驍' +
    '骂罵骄驕骅驊骆駱骇駭骈駢骊驪骋騁骏駿骐騏骑騎骒騍骓騅骖驂' +
    '骗騙骘騭骚騷骛騖骜驁骝騮骞騫骟騸骠驃骡騾骢驄骣驏骤驟骥驥' +
    '骧驤肮骯髋髖鬓鬢鲁魯鲜鮮鸡雞鸣鳴鸥鷗鸦鴉鸭鴨鸽鴿鹅鵝鹤鶴' +
    '鹰鷹麦麥黄黃齐齊齿齒龄齡龟龜扫掃拟擬审審团團净淨浅淺满滿' +
    '热熱稳穩竞競礼禮称稱积積汉漢残殘极極构構场場坏壞块塊坚堅' +
    '圆圓圣聖园園压壓卫衛却卻厅廳历歷厉厲厌厭厕廁参參双雙变變' +
    '叙敘号號叹嘆叶葉吁籲吓嚇听聽启啟吴吳员員呜嗚咏詠哑啞响響' +
    '唤喚喷噴嘘噓嘱囑国國图圖坛壇坝壩坟墳坠墜垒壘垦墾垫墊堕墮' +
    '壮壯声聲壳殼壶壺处處备備夸誇夺奪奋奮奖獎奥奧妆妝妇婦妈媽' +
    '娄婁娇嬌娱娛婴嬰孙孫学學宝寶实實宪憲宫宮宽寬宾賓寝寢宁寧' +
    '写寫宠寵对對寻尋导導寿壽将將尔爾尘塵尝嘗尧堯尽盡层層届屆' +
    '尸屍属屬屡屢岂豈岗崗岛島岭嶺岳嶽峡峽巅巔币幣帅帥师師帐帳' +
    '帘簾带帶帮幫并並广廣庄莊庆慶库庫应應庙廟庞龐废廢厂廠开開' +
    '异異弃棄张張弥彌弯彎弹彈强強归歸当當录錄彻徹征徵后後态態' +
    '怜憐总總恋戀恒恆恶惡恼惱悦悅悬懸惊驚惧懼惨慘惩懲惫憊惬愜' +
    '惭慚惯慣愤憤愿願虑慮忧憂怀懷盖蓋组組纯純纳納纵縱纷紛纺紡绍紹' +
    '绒絨绕繞绘繪绝絕绑綁绩績绵綿绿綠纬緯缚縛缝縫'
  );
  // Fix accidental identity or swapped pairs in addS2TPairs above if any (all clean, explicit overrides below)
  S2T_CHAR_MAP['钬'] = '鈥';
  S2T_CHAR_MAP['么'] = '麼';
  S2T_CHAR_MAP['只'] = '只'; // keep 只 unchanged in S2T
  delete S2T_CHAR_MAP['只'];
  delete S2T_CHAR_MAP['台'];
  delete S2T_CHAR_MAP['么']; // 什么/怎么 -> 什麼/怎麼 (let phrase or 麼 map)
  S2T_CHAR_MAP['么'] = '麼';

  const T2S_CHAR_MAP = {};
  for (const [s, t] of Object.entries(S2T_CHAR_MAP)) {
    if (s !== t && !T2S_CHAR_MAP[t]) {
      T2S_CHAR_MAP[t] = s;
    }
  }
  const T2S_EXTRA = {
    '於': '于',
    '並': '并',
    '併': '并',
    '麵': '面',
    '製': '制',
    '係': '系',
    '繫': '系',
    '裡': '里',
    '裏': '里',
    '臺': '台',
    '檯': '台',
    '颱': '台',
    '後': '后',
    '發': '发',
    '髮': '发',
    '複': '复',
    '復': '复',
    '歷': '历',
    '曆': '历',
    '匯': '汇',
    '彙': '汇',
    '獲': '获',
    '穫': '获',
    '餘': '余',
    '穀': '谷',
    '鐘': '钟',
    '鍾': '钟',
    '簽': '签',
    '籤': '签',
    '鑑': '鉴',
    '鑒': '鉴',
    '臟': '脏',
    '髒': '脏',
    '捨': '舍',
    '餵': '喂',
    '迴': '回',
    '週': '周',
    '註': '注',
    '誌': '志',
    '屬': '属',
    '眾': '众',
    '衆': '众',
    '群': '群',
    '羣': '群',
    '線': '线',
    '綫': '线',
    '啟': '启',
    '啓': '启',
    '戶': '户',
    '為': '为',
    '爲': '为',
    '偽': '伪',
    '僞': '伪',
    '夠': '够',
    '纔': '才',
    '儘': '尽',
    '盡': '尽',
    '蘇': '苏',
    '甦': '苏',
    '佔': '占',
    '隻': '只',
    '祇': '只',
    '衹': '只',
    '闆': '板',
    '鬆': '松',
    '鬥': '斗',
    '鬱': '郁',
    '醜': '丑',
    '鞦': '秋',
    '韆': '千',
    '賬': '账',
    '帳': '帐',
    '劃': '划',
    '劉': '刘',
    '創': '创',
    '劇': '剧',
    '勸': '劝',
    '勞': '劳',
    '勢': '势',
    '醫': '医',
    '華': '华',
    '廠': '厂',
    '廳': '厅',
    '歷': '历',
    '厭': '厌',
    '厲': '厉',
    '葉': '叶',
    '歎': '叹',
    '嚇': '吓',
    '嘯': '啸',
    '嚴': '严',
    '喪': '丧',
    '喬': '乔',
    '單': '单',
    '噴': '喷',
    '囑': '嘱',
    '圓': '圆',
    '圖': '图',
    '場': '场',
    '塊': '块',
    '堅': '坚',
    '壇': '坛',
    '壩': '坝',
    '墳': '坟',
    '墜': '坠',
    '壘': '垒',
    '墾': '垦',
    '墊': '垫',
    '墮': '堕',
    '壓': '压',
    '壯': '壮',
    '壽': '寿',
    '夠': '够',
    '夢': '梦',
    '夾': '夹',
    '奪': '夺',
    '奮': '奋',
    '奧': '奥',
    '獎': '奖',
    '妝': '妆',
    '婦': '妇',
    '媽': '妈',
    '婁': '娄',
    '嬌': '娇',
    '娛': '娱',
    '嬰': '婴',
    '孫': '孙',
    '寧': '宁',
    '審': '审',
    '寫': '写',
    '寬': '宽',
    '寵': '宠',
    '寶': '宝',
    '實': '实',
    '尋': '寻',
    '導': '导',
    '將': '将',
    '爾': '尔',
    '塵': '尘',
    '嘗': '尝',
    '堯': '尧',
    '尷': '尴',
    '尬': '尬',
    '屆': '届',
    '屍': '尸',
    '層': '层',
    '屬': '属',
    '屢': '屡',
    '岡': '冈',
    '島': '岛',
    '嶺': '岭',
    '嶽': '岳',
    '峽': '峡',
    '嶄': '崭',
    '巔': '巅',
    '幣': '币',
    '帥': '帅',
    '師': '师',
    '幫': '帮',
    '幹': '干',
    '幾': '几',
    '廣': '广',
    '庫': '库',
    '應': '应',
    '龐': '庞',
    '廢': '废',
    '張': '张',
    '彌': '弥',
    '彎': '弯',
    '強': '强',
    '彈': '弹',
    '歸': '归',
    '當': '当',
    '錄': '录',
    '徹': '彻',
    '徵': '征',
    '懷': '怀',
    '態': '态',
    '總': '总',
    '戀': '恋',
    '恆': '恒',
    '惡': '恶',
    '惱': '恼',
    '慘': '惨',
    '懲': '惩',
    '憊': '惫',
    '慣': '惯',
    '應': '应',
    '戰': '战',
    '截': '截',
    '擁': '拥',
    '撥': '拨',
    '擷': '撷',
    '攜': '携',
    '斷': '断',
    '無': '无',
    '曉': '晓',
    '術': '术',
    '極': '极',
    '構': '构',
    '標': '标',
    '樣': '样',
    '橋': '桥',
    '檢': '检',
    '權': '权',
    '歲': '岁',
    '殘': '残',
    '氣': '气',
    '漢': '汉',
    '溫': '温',
    '滿': '满',
    '熱': '热',
    '獨': '独',
    '禮': '礼',
    '稱': '称',
    '積': '积',
    '穩': '稳',
    '競': '竞',
    '筆': '笔',
    '簡': '简',
    '職': '职',
    '腦': '脑',
    '舉': '举',
    '舊': '旧',
    '節': '节',
    '範': '范',
    '萬': '万',
    '號': '号',
    '護': '护',
    '賽': '赛',
    '辭': '辞',
    '這': '这',
    '進': '进',
    '遠': '远',
    '連': '连',
    '選': '选',
    '適': '适',
    '遲': '迟',
    '釋': '释',
    '鐵': '铁',
    '長': '长',
    '門': '门',
    '閃': '闪',
    '閉': '闭',
    '開': '开',
    '間': '间',
    '閱': '阅',
    '際': '际',
    '隨': '随',
    '隱': '隐',
    '難': '难',
    '雲': '云',
    '電': '电',
    '靈': '灵',
    '靜': '静',
    '響': '响',
    '頁': '页',
    '頂': '顶',
    '項': '项',
    '順': '顺',
    '預': '预',
    '領': '领',
    '頭': '头',
    '頻': '频',
    '題': '题',
    '額': '额',
    '風': '风',
    '飛': '飞',
    '館': '馆',
    '馬': '马',
    '驗': '验',
    '魚': '鱼',
    '鳥': '鸟',
    '點': '点',
    '齊': '齐',
    '龍': '龙',
    '與': '与',
    '專': '专',
    '業': '业',
    '東': '东',
    '絲': '丝',
    '兩': '两',
    '個': '个',
    '臨': '临',
    '舉': '举',
    '義': '义',
    '樂': '乐',
    '書': '书',
    '買': '买',
    '亂': '乱',
    '爭': '争',
    '亞': '亚',
    '產': '产',
    '親': '亲',
    '僅': '仅',
    '從': '从',
    '優': '优',
    '會': '会',
    '傳': '传',
    '傷': '伤',
    '體': '体',
    '來': '来',
    '條': '条',
    '備': '备',
    '價': '价',
    '億': '亿',
    '儲': '储',
    '兒': '儿',
    '黨': '党',
    '關': '关',
    '興': '兴',
    '養': '养',
    '內': '内',
    '軍': '军',
    '農': '农',
    '準': '准',
    '減': '减',
    '鳳': '凤',
    '憑': '凭',
    '擊': '击',
    '則': '则',
    '剛': '刚',
    '刪': '删',
    '別': '别',
    '辦': '办',
    '務': '务',
    '動': '动',
    '區': '区',
    '協': '协',
    '賣': '卖',
    '衛': '卫',
    '卻': '却',
    '參': '参',
    '雙': '双',
    '變': '变',
    '聽': '听',
    '吳': '吴',
    '員': '员',
    '問': '问',
    '園': '园',
    '國': '国',
    '聖': '圣',
    '壞': '坏',
    '報': '报',
    '聲': '声',
    '處': '处',
    '愛': '爱',
    '顯': '显',
    '點': '点'
  };
  for (const [trad, simp] of Object.entries(T2S_EXTRA)) {
    if (trad && simp && trad !== simp) {
      T2S_CHAR_MAP[trad] = simp;
    }
  }

  /**
   * Convert between Simplified Chinese ('zh-CN') and Traditional Chinese ('zh-TW').
   * @param {string} text
   * @param {'zh-CN'|'zh-TW'} targetLang
   * @returns {string}
   */
  function convertChineseScript(text, targetLang) {
    if (!text || typeof text !== 'string') return text || '';
    const norm = normalizeScriptTargetLang(targetLang);
    const isTrad = norm === 'zh-TW';
    const phrases = isTrad ? [...S2T_ONLY_PHRASES, ...S2T_PHRASES] : T2S_PHRASES;
    const charMap = isTrad ? S2T_CHAR_MAP : T2S_CHAR_MAP;

    let out = text;
    for (const [from, to] of phrases) {
      if (out.includes(from)) {
        out = out.split(from).join(to);
      }
    }

    let result = '';
    for (const ch of out) {
      result += charMap[ch] || ch;
    }
    return result;
  }

  /**
   * Enforce target Chinese script when targetLang is 'zh-CN' or 'zh-TW'.
   * Leaves non-Chinese target languages (e.g. 'en') untouched.
   * @param {string} text
   * @param {string} targetLang
   * @returns {string}
   */
  function enforceTargetChineseScript(text, targetLang) {
    if (!text || typeof text !== 'string') return text || '';
    const norm = normalizeScriptTargetLang(targetLang);
    if (norm === 'zh-CN' || norm === 'zh-TW') {
      return convertChineseScript(text, norm);
    }
    return text;
  }

  root.WT_CONFIG = {
    SOURCE_LANGUAGES,
    TARGET_LANGUAGES,
    DEFAULT_SETTINGS,
    LOOM_PRESET_PROVIDERS,
    CODEX_PRESET_MODELS,
    MESSAGE_TYPES,
    AI_TASK_TYPES,
    STORAGE_KEYS,
    MAX_HISTORY_ITEMS,
    MAX_CHAT_SESSIONS,
    mergeSettings,
    parseCodexAuthInput,
    convertChineseScript,
    enforceTargetChineseScript,
    normalizeSessionPageUrl,
    getSettings,
    saveSettings,
    getHistory,
    addHistoryItem,
    clearHistory,
    getChatSessions,
    saveChatSession,
    deleteChatSession,
    clearChatSessions
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
