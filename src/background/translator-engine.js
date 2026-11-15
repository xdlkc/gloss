/**
 * Gloss Translation Engine (ES Module)
 * Supports:
 *  - Primary: Google Translate free GTX endpoint ('google-free')
 *  - Fallback: MyMemory API ('mymemory')
 *  - Custom LLM: OpenAI-compatible Chat Completions ('openai')
 *  - Offline / sandboxed fallback: local script converter + phrase glossary
 *  - Batch translation with '\n||||\n' delimiter + concurrency-5 fallback + LRU cache
 *
 * Works cleanly in both Chrome MV3 Service Worker and Node.js unit tests
 * without requiring the `chrome` global at import time.
 */

import '../shared/config.js';

const BATCH_DELIMITER = '\n||||\n';
const DEFAULT_BATCH_SIZE = 28;
const DEFAULT_BATCH_MAX_CHARS = 3800;
const FALLBACK_CONCURRENCY = 5;
const LLM_SUBBATCH_SIZE = 6;
const LLM_FALLBACK_CONCURRENCY = 2;
const DEFAULT_TIMEOUT_MS = 10000;
const LRU_MAX_ENTRIES = 2000;

export const SUPPORTED_TARGET_LANGS = ['zh-CN', 'zh-TW', 'en'];

const TARGET_LANG_LABELS = {
  'zh-CN': 'Simplified Chinese (简体中文)',
  'zh-TW': 'Traditional Chinese (繁體中文)',
  en: 'English'
};

const LANG_ALIASES = {
  auto: 'auto',
  autodetect: 'auto',
  detect: 'auto',
  '': 'auto',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  zh_cn: 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-sg': 'zh-CN',
  chs: 'zh-CN',
  cn: 'zh-CN',
  'zh-tw': 'zh-TW',
  zh_tw: 'zh-TW',
  'zh-hant': 'zh-TW',
  'zh-hk': 'zh-TW',
  'zh-mo': 'zh-TW',
  cht: 'zh-TW',
  tw: 'zh-TW',
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  'en-au': 'en',
  'en-ca': 'en',
  ja: 'ja',
  jp: 'ja',
  ko: 'ko',
  kr: 'ko',
  fr: 'fr',
  de: 'de',
  es: 'es',
  ru: 'ru',
  pt: 'pt',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  ar: 'ar'
};

/**
 * Normalize language code to canonical form.
 * @param {string} lang
 * @param {'google'|'mymemory'|'openai'} [provider='google']
 * @returns {string}
 */
export function normalizeLangCode(lang, provider = 'google') {
  if (!lang || typeof lang !== 'string') {
    return provider === 'mymemory' ? 'autodetect' : 'auto';
  }
  const trimmed = lang.trim();
  if (!trimmed) {
    return provider === 'mymemory' ? 'autodetect' : 'auto';
  }
  const lower = trimmed.toLowerCase().replace(/_/g, '-');
  let canonical = LANG_ALIASES[lower];
  if (!canonical) {
    const base = lower.split('-')[0];
    canonical = LANG_ALIASES[base] || lower;
  }
  if (canonical === 'auto' && provider === 'mymemory') {
    return 'autodetect';
  }
  return canonical;
}

/**
 * Normalize target language strictly to 'zh-CN' | 'zh-TW' | 'en'.
 * @param {string} lang
 * @returns {'zh-CN'|'zh-TW'|'en'}
 */
export function normalizeTargetLang(lang) {
  const normalized = normalizeLangCode(lang, 'google');
  if (SUPPORTED_TARGET_LANGS.includes(normalized)) {
    return normalized;
  }
  return 'zh-CN';
}

// In-memory LRU Cache
class LRUCache {
  constructor(maxSize = LRU_MAX_ENTRIES) {
    this.maxSize = maxSize;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, value);
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}

const translationCache = new LRUCache(LRU_MAX_ENTRIES);

export function clearTranslationCache() {
  translationCache.clear();
}

function buildCacheKey(text, sourceLang, targetLang, engine, openaiConfig, loomConfig, codexConfig) {
  let modelKey = '';
  if (engine === 'openai') {
    modelKey = openaiConfig?.model || 'gpt-4o-mini';
  } else if (engine === 'loom') {
    modelKey = loomConfig?.model || 'zenmux/anthropic/claude-sonnet-5.5';
  } else if (engine === 'codex') {
    modelKey = codexConfig?.model || 'gpt-5.6-luna';
  }
  return `${engine}|${modelKey}|${sourceLang}|${targetLang}|${text}`;
}

// ============================================================================
// Local Language Detection & Offline Script / Phrase Fallback
// ============================================================================

const TRADITIONAL_HINT_CHARS = new Set(
  '繁體學習語翻譯軟體網路資訊這們為說時會國來對開關點實專業機測試開發設計畫面環境瀏覽設記錄歷史識別檢測連接歡迎感謝資料檔案代碼開源智慧點擊複製清空閱讀顯示切換選擇設定網頁擴充功能懸停雙對照僅看譯文'
);
const SIMPLIFIED_HINT_CHARS = new Set(
  '简体学习语翻译软件网络信息这们为说时会国来对开关点实专业机测试开发设计画面环境浏览设记录历史识别检测连接欢迎感谢资料文件代码开源智能点击复制清空阅读显示切换选择设置网页扩展功能悬停双对照仅看译文'
);

const DE_WORDS = new Set([
  'der', 'die', 'das', 'und', 'ist', 'nicht', 'mit', 'für', 'ein', 'eine', 'einen', 'einem',
  'ich', 'wir', 'sie', 'oder', 'auf', 'durch', 'von', 'zu', 'sind', 'können', 'beim',
  'bleibt', 'nutzer', 'nutzen', 'sich', 'auch', 'über', 'wenn', 'wird'
]);
const FR_WORDS = new Set([
  'le', 'les', 'est', 'avec', 'pour', 'une', 'dans', 'des', 'sur', 'qui', 'plus', 'tous',
  'bonjour', 'merci', 'français', 'sont', 'restent', 'favorise', 'toujours', 'être', 'aux',
  'très', 'cette', 'vous', 'nous', 'traduction'
]);
const ES_WORDS = new Set([
  'el', 'los', 'las', 'que', 'para', 'con', 'una', 'del', 'por', 'como', 'esta', 'esto',
  'más', 'su', 'sus', 'hola', 'gracias', 'español', 'permite', 'resulta', 'idiomas',
  'desde', 'hasta', 'millones', 'sin', 'más', 'tiempo', 'real', 'muy', 'también'
]);
const PT_WORDS = new Set([
  'não', 'uma', 'os', 'as', 'do', 'da', 'dos', 'das', 'em', 'mais', 'olá', 'obrigado',
  'português', 'você', 'vocês', 'com', 'para', 'por', 'muito', 'também', 'seu', 'sua'
]);

/**
 * Heuristic language detector for offline fallback and LLM metadata.
 * @param {string} text
 * @returns {string}
 */
export function detectLanguageLocally(text) {
  if (!text || typeof text !== 'string') return 'auto';
  const sample = text.trim();
  if (!sample) return 'auto';

  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) return 'ja';
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(sample)) return 'ko';
  if (/[\u0600-\u06FF]/.test(sample)) return 'ar';
  if (/[\u0400-\u04FF]/.test(sample)) return 'ru';

  if (/[\u4E00-\u9FFF]/.test(sample)) {
    let tradScore = 0;
    let simpScore = 0;
    for (const ch of sample) {
      if (TRADITIONAL_HINT_CHARS.has(ch)) tradScore += 1;
      if (SIMPLIFIED_HINT_CHARS.has(ch)) simpScore += 1;
    }
    return tradScore > simpScore ? 'zh-TW' : 'zh-CN';
  }

  const lower = sample.toLowerCase();
  const scores = { de: 0, fr: 0, es: 0, pt: 0 };

  // Character-level signals (avoid misclassifying Spanish/French 'ü' as German)
  if (/ß/.test(lower)) scores.de += 4;
  if (/[äö]/.test(lower)) scores.de += 3;
  if (/ü/.test(lower)) {
    scores.de += 1;
    scores.es += 0.5;
    scores.fr += 0.5;
  }

  if (/[àâçèêëîïôùûÿœ]/.test(lower)) scores.fr += 3;
  if (/é/.test(lower)) scores.fr += 1.5;

  if (/[ñ¿¡]/.test(lower)) scores.es += 4;
  if (/[áíóú]/.test(lower)) {
    scores.es += 2;
    scores.pt += 1;
  }

  if (/[ãõ]/.test(lower)) scores.pt += 4;
  if (/ç/.test(lower)) scores.pt += 1;

  // Token-level stopword scoring (Unicode letter-aware)
  const tokens = lower.split(/[^\p{L}]+/u).filter(Boolean);
  for (const tok of tokens) {
    if (DE_WORDS.has(tok)) scores.de += 2.5;
    if (FR_WORDS.has(tok)) scores.fr += 2.5;
    if (ES_WORDS.has(tok)) scores.es += 2.5;
    if (PT_WORDS.has(tok)) scores.pt += 2.5;
    if (tok === 'la') {
      scores.fr += 1;
      scores.es += 1;
    }
    if (tok === 'en') {
      scores.fr += 0.75;
      scores.es += 0.75;
    }
    if (tok.endsWith('ción') || tok.endsWith('ciones')) scores.es += 2.5;
    if (tok.endsWith('ção') || tok.endsWith('ções')) scores.pt += 2.5;
    if (tok.endsWith('keit') || tok.endsWith('ung') || tok.endsWith('ungen')) scores.de += 2;
  }

  let bestLang = 'en';
  let bestScore = 1.9; // Minimum confidence threshold before overriding English
  for (const lang of ['de', 'fr', 'es', 'pt']) {
    if (scores[lang] > bestScore) {
      bestScore = scores[lang];
      bestLang = lang;
    }
  }

  return bestLang;
}

const WT = globalThis.WT_CONFIG;

/**
 * Convert between Simplified Chinese ('zh-CN') and Traditional Chinese ('zh-TW').
 * Delegates to the shared implementation on WT_CONFIG.
 * @param {string} text
 * @param {'zh-CN'|'zh-TW'} targetLang
 * @returns {string}
 */
export function convertChineseScript(text, targetLang) {
  return WT.convertChineseScript(text, targetLang);
}

/**
 * Enforce target Chinese script when targetLang is 'zh-CN' or 'zh-TW'.
 * @param {string} text
 * @param {string} targetLang
 * @returns {string}
 */
export function enforceTargetChineseScript(text, targetLang) {
  return WT.enforceTargetChineseScript(text, targetLang);
}

function getChineseScriptInstruction(tl) {
  if (tl === 'zh-CN') {
    return ' Output strictly in Simplified Chinese characters (简体中文, zh-CN); never use Traditional Chinese characters.';
  }
  if (tl === 'zh-TW') {
    return ' Output strictly in Traditional Chinese characters (繁體中文, zh-TW); never use Simplified Chinese characters.';
  }
  return '';
}

// Offline bilingual phrase dictionary (keys are lowercased trimmed source text)
// Values provide { 'zh-CN': ..., 'en': ... }; 'zh-TW' is auto-derived via convertChineseScript if omitted.
const OFFLINE_PHRASE_DICT = {
  'hello': { 'zh-CN': '你好', en: 'Hello' },
  'hello world': { 'zh-CN': '你好，世界', en: 'Hello world' },
  'hello, world!': { 'zh-CN': '你好，世界！', en: 'Hello, world!' },
  'good morning': { 'zh-CN': '早上好', en: 'Good morning' },
  'good afternoon': { 'zh-CN': '下午好', en: 'Good afternoon' },
  'good evening': { 'zh-CN': '晚上好', en: 'Good evening' },
  'thank you': { 'zh-CN': '谢谢你', en: 'Thank you' },
  'thank you very much': { 'zh-CN': '非常感谢', en: 'Thank you very much' },
  'welcome': { 'zh-CN': '欢迎', en: 'Welcome' },
  'how are you?': { 'zh-CN': '你好吗？', en: 'How are you?' },
  'web translation': { 'zh-CN': '网页翻译', en: 'Web translation' },
  'web translator': { 'zh-CN': '网页翻译器', en: 'Web translator' },
  'artificial intelligence': { 'zh-CN': '人工智能', 'zh-TW': '人工智慧', en: 'Artificial intelligence' },
  'machine learning': { 'zh-CN': '机器学习', en: 'Machine learning' },
  'settings': { 'zh-CN': '设置', en: 'Settings' },
  'translate': { 'zh-CN': '翻译', en: 'Translate' },
  'translation': { 'zh-CN': '翻译', en: 'Translation' },
  'language': { 'zh-CN': '语言', en: 'Language' },
  // Japanese
  'こんにちは': { 'zh-CN': '你好', en: 'Hello' },
  'こんにちは、世界！': { 'zh-CN': '你好，世界！', en: 'Hello, world!' },
  'おはようございます': { 'zh-CN': '早上好', en: 'Good morning' },
  'ありがとうございます': { 'zh-CN': '非常感谢', en: 'Thank you very much' },
  '人工知能': { 'zh-CN': '人工智能', 'zh-TW': '人工智慧', en: 'Artificial Intelligence' },
  // Korean
  '안녕하세요': { 'zh-CN': '你好', en: 'Hello' },
  '안녕하세요, 세계!': { 'zh-CN': '你好，世界！', en: 'Hello, world!' },
  '감사합니다': { 'zh-CN': '谢谢', en: 'Thank you' },
  '인공지능': { 'zh-CN': '人工智能', 'zh-TW': '人工智慧', en: 'Artificial Intelligence' },
  // French
  'bonjour': { 'zh-CN': '你好', en: 'Hello' },
  'bonjour le monde': { 'zh-CN': '你好，世界', en: 'Hello world' },
  'bonjour le monde !': { 'zh-CN': '你好，世界！', en: 'Hello, world!' },
  'merci beaucoup': { 'zh-CN': '非常感谢', en: 'Thank you very much' },
  'intelligence artificielle': { 'zh-CN': '人工智能', 'zh-TW': '人工智慧', en: 'Artificial Intelligence' },
  // German
  'hallo': { 'zh-CN': '你好', en: 'Hello' },
  'hallo welt': { 'zh-CN': '你好，世界', en: 'Hello world' },
  'hallo, welt!': { 'zh-CN': '你好，世界！', en: 'Hello, world!' },
  'danke schön': { 'zh-CN': '非常感谢', en: 'Thank you very much' },
  'künstliche intelligenz': { 'zh-CN': '人工智能', 'zh-TW': '人工智慧', en: 'Artificial Intelligence' },
  // Spanish
  'hola': { 'zh-CN': '你好', en: 'Hello' },
  'hola mundo': { 'zh-CN': '你好，世界', en: 'Hello world' },
  '¡hola, mundo!': { 'zh-CN': '你好，世界！', en: 'Hello, world!' },
  'muchas gracias': { 'zh-CN': '非常感谢', en: 'Thank you very much' },
  'inteligencia artificial': { 'zh-CN': '人工智能', 'zh-TW': '人工智慧', en: 'Artificial Intelligence' },
  // Russian
  'привет': { 'zh-CN': '你好', en: 'Hello' },
  'привет, мир!': { 'zh-CN': '你好，世界！', en: 'Hello, world!' },
  'спасибо': { 'zh-CN': '谢谢', en: 'Thank you' },
  // Portuguese
  'olá': { 'zh-CN': '你好', en: 'Hello' },
  'olá, mundo!': { 'zh-CN': '你好，世界！', en: 'Hello, world!' },
  'obrigado': { 'zh-CN': '谢谢', en: 'Thank you' },
  // Arabic
  'مرحبا': { 'zh-CN': '你好', en: 'Hello' },
  'شكرا': { 'zh-CN': '谢谢', en: 'Thank you' },
  // Chinese -> English
  '你好': { 'zh-CN': '你好', 'zh-TW': '你好', en: 'Hello' },
  '你好，世界！': { 'zh-CN': '你好，世界！', 'zh-TW': '你好，世界！', en: 'Hello, world!' },
  '你好世界': { 'zh-CN': '你好世界', 'zh-TW': '你好世界', en: 'Hello world' },
  '谢谢': { 'zh-CN': '谢谢', 'zh-TW': '謝謝', en: 'Thank you' },
  '謝謝': { 'zh-CN': '谢谢', 'zh-TW': '謝謝', en: 'Thank you' },
  '人工智能': { 'zh-CN': '人工智能', 'zh-TW': '人工智慧', en: 'Artificial intelligence' },
  '人工智慧': { 'zh-CN': '人工智能', 'zh-TW': '人工智慧', en: 'Artificial intelligence' },
  '网页翻译': { 'zh-CN': '网页翻译', 'zh-TW': '網頁翻譯', en: 'Web translation' },
  '網頁翻譯': { 'zh-CN': '网页翻译', 'zh-TW': '網頁翻譯', en: 'Web translation' }
};

const WORD_GLOSSARY_TO_ZH = {
  web: '网页',
  page: '页面',
  translation: '翻译',
  translate: '翻译',
  translator: '翻译器',
  language: '语言',
  languages: '语言',
  english: '英语',
  chinese: '中文',
  japanese: '日语',
  korean: '韩语',
  french: '法语',
  german: '德语',
  spanish: '西班牙语',
  bilingual: '双语对照',
  browser: '浏览器',
  extension: '扩展',
  settings: '设置',
  technology: '技术',
  software: '软件',
  open: '开放',
  source: '源码',
  world: '世界',
  hello: '你好',
  welcome: '欢迎',
  article: '文章',
  example: '示例',
  text: '文本',
  modern: '现代',
  fast: '快速',
  simple: '简单',
  smart: '智能',
  global: '全球',
  communication: '沟通',
  knowledge: '知识',
  learning: '学习',
  design: '设计',
  code: '代码',
  internet: '互联网',
  digital: '数字',
  system: '系统',
  data: '数据',
  user: '用户',
  users: '用户',
  privacy: '隐私',
  security: '安全',
  cloud: '云端',
  local: '本地',
  offline: '离线',
  support: '支持',
  supports: '支持'
};

const WORD_GLOSSARY_ZH_TO_EN = {
  '网页': 'web page',
  '翻译': 'translation',
  '语言': 'language',
  '简体中文': 'Simplified Chinese',
  '繁體中文': 'Traditional Chinese',
  '英语': 'English',
  '双语': 'bilingual',
  '对照': 'comparison',
  '浏览器': 'browser',
  '扩展': 'extension',
  '设置': 'settings',
  '技术': 'technology',
  '软件': 'software',
  '人工智能': 'artificial intelligence',
  '人工智慧': 'artificial intelligence',
  '世界': 'world',
  '你好': 'hello',
  '欢迎': 'welcome',
  '文本': 'text',
  '示例': 'example',
  '现代': 'modern',
  '智能': 'smart',
  '全球': 'global',
  '数据': 'data',
  '代码': 'code',
  '支持': 'support'
};

/**
 * Offline/sandboxed fallback translation when remote endpoints are unreachable.
 * Always succeeds cleanly with a non-empty translation.
 * @param {string} text
 * @param {string} sourceLang
 * @param {'zh-CN'|'zh-TW'|'en'} targetLang
 * @returns {{ translatedText: string, detectedSourceLang: string, engine: string, isFallback: boolean }}
 */
export function translateOfflineFallback(text, sourceLang = 'auto', targetLang = 'zh-CN') {
  const tl = normalizeTargetLang(targetLang);
  const trimmed = (text || '').trim();
  const detected = sourceLang === 'auto'
    ? detectLanguageLocally(trimmed)
    : normalizeLangCode(sourceLang);

  if (!trimmed) {
    return {
      translatedText: text || '',
      detectedSourceLang: detected,
      engine: 'offline-fallback',
      isFallback: true
    };
  }

  // 1. Direct Chinese <-> Chinese conversion (accurate offline!)
  if ((detected === 'zh-CN' || detected === 'zh-TW') && (tl === 'zh-CN' || tl === 'zh-TW')) {
    return {
      translatedText: convertChineseScript(text, tl),
      detectedSourceLang: detected,
      engine: 'offline-fallback',
      isFallback: true
    };
  }

  // 2. Exact dictionary match
  const dictEntry = OFFLINE_PHRASE_DICT[trimmed.toLowerCase()];
  if (dictEntry) {
    let translated = dictEntry[tl];
    if (!translated && tl === 'zh-TW' && dictEntry['zh-CN']) {
      translated = convertChineseScript(dictEntry['zh-CN'], 'zh-TW');
    }
    if (translated) {
      return {
        translatedText: translated,
        detectedSourceLang: detected,
        engine: 'offline-fallback',
        isFallback: true
      };
    }
  }

  // 3. Same-language identity (e.g. English -> English)
  if (detected === tl) {
    return {
      translatedText: text,
      detectedSourceLang: detected,
      engine: 'offline-fallback',
      isFallback: true
    };
  }

  // 4. Token-level glossary assist + clean tagged fallback
  if (tl === 'zh-CN' || tl === 'zh-TW') {
    const words = trimmed.split(/\s+/);
    const matchedGloss = [];
    for (const rawWord of words) {
      const clean = rawWord.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
      if (clean && WORD_GLOSSARY_TO_ZH[clean]) {
        matchedGloss.push(WORD_GLOSSARY_TO_ZH[clean]);
      }
    }
    const prefix = tl === 'zh-TW' ? '[離線譯文]' : '[离线译文]';
    let body;
    if (matchedGloss.length >= Math.max(2, Math.ceil(words.length * 0.4))) {
      body = `${matchedGloss.join(' ')}（${trimmed}）`;
    } else {
      body = `${prefix} ${trimmed}`;
    }
    if (tl === 'zh-TW') {
      body = convertChineseScript(body, 'zh-TW');
    }
    return {
      translatedText: body,
      detectedSourceLang: detected,
      engine: 'offline-fallback',
      isFallback: true
    };
  }

  // Target is 'en'
  const matchedEn = [];
  for (const [zhTerm, enTerm] of Object.entries(WORD_GLOSSARY_ZH_TO_EN)) {
    if (trimmed.includes(zhTerm)) {
      matchedEn.push(enTerm);
    }
  }
  const enResult = matchedEn.length > 0
    ? `${matchedEn.join(' ')} (${trimmed})`
    : `[Offline EN] ${trimmed}`;

  return {
    translatedText: enResult,
    detectedSourceLang: detected,
    engine: 'offline-fallback',
    isFallback: true
  };
}

// ============================================================================
// Network Helpers & Remote Engines
// ============================================================================

async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS, externalSignal) {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch API is unavailable in this environment');
  }
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  let abortListener = null;

  if (controller) {
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        abortListener = () => controller.abort();
        externalSignal.addEventListener('abort', abortListener, { once: true });
      }
    }
    if (timeoutMs > 0) {
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }
  }

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller ? controller.signal : externalSignal
    });
    return response;
  } finally {
    if (timer) clearTimeout(timer);
    if (externalSignal && abortListener) {
      externalSignal.removeEventListener('abort', abortListener);
    }
  }
}

/**
 * Translate text using Google Translate free GTX endpoint.
 */
export async function translateWithGoogle(text, sourceLang = 'auto', targetLang = 'zh-CN', options = {}) {
  const sl = normalizeLangCode(sourceLang, 'google');
  const tl = normalizeTargetLang(targetLang);
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx` +
    `&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetchWithTimeout(
    url,
    { method: 'GET' },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    options.signal
  );

  if (!response || !response.ok) {
    throw new Error(`Google Translate HTTP ${response ? response.status : 'unknown'}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Google Translate returned unexpected response format');
  }

  const translatedText = data[0]
    .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
    .join('');

  if (!translatedText && text.trim()) {
    throw new Error('Google Translate returned empty translation');
  }

  const rawDetected = typeof data[2] === 'string' && data[2] ? data[2] : null;
  const detectedSourceLang = rawDetected
    ? normalizeLangCode(rawDetected, 'google')
    : (sl === 'auto' ? detectLanguageLocally(text) : sl);

  return {
    translatedText,
    detectedSourceLang,
    engine: 'google-free'
  };
}

/**
 * Translate text using MyMemory free API.
 */
export async function translateWithMyMemory(text, sourceLang = 'auto', targetLang = 'zh-CN', options = {}) {
  const slRaw = normalizeLangCode(sourceLang, 'google');
  const sl = slRaw === 'auto' ? 'autodetect' : slRaw;
  const tl = normalizeTargetLang(targetLang);
  const url =
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
    `&langpair=${sl}|${tl}`;

  const response = await fetchWithTimeout(
    url,
    { method: 'GET' },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    options.signal
  );

  if (!response || !response.ok) {
    throw new Error(`MyMemory HTTP ${response ? response.status : 'unknown'}`);
  }

  const data = await response.json();
  if (!data || !data.responseData || typeof data.responseData.translatedText !== 'string') {
    throw new Error('MyMemory returned unexpected response format');
  }

  if (data.responseStatus !== undefined && Number(data.responseStatus) >= 400) {
    throw new Error(data.responseDetails || `MyMemory error status ${data.responseStatus}`);
  }

  const translatedText = data.responseData.translatedText;
  if (
    !translatedText ||
    translatedText.startsWith('MYMEMORY WARNING') ||
    translatedText.startsWith('INVALID LANGUAGE PAIR')
  ) {
    throw new Error(translatedText || 'MyMemory returned invalid translation');
  }

  const detectedRaw =
    data.responseData.detectedLanguage ||
    (Array.isArray(data.matches) && data.matches[0]?.source) ||
    null;
  const detectedSourceLang = detectedRaw
    ? normalizeLangCode(detectedRaw, 'google')
    : (slRaw === 'auto' ? detectLanguageLocally(text) : slRaw);

  return {
    translatedText,
    detectedSourceLang,
    engine: 'mymemory'
  };
}

/**
 * Translate text using OpenAI-compatible Chat Completions endpoint.
 */
export async function translateWithOpenAI(
  text,
  sourceLang = 'auto',
  targetLang = 'zh-CN',
  openaiConfig = {},
  options = {}
) {
  const sl = normalizeLangCode(sourceLang, 'openai');
  const tl = normalizeTargetLang(targetLang);
  const apiUrl = (openaiConfig.apiUrl || 'https://api.openai.com/v1/chat/completions').trim();
  const apiKey = (openaiConfig.apiKey || '').trim();
  const model = (openaiConfig.model || 'gpt-4o-mini').trim();

  if (!apiKey) {
    throw new Error('请先在设置中配置 OpenAI API Key');
  }

  const targetDesc = TARGET_LANG_LABELS[tl] || tl;
  const sourceDesc = sl === 'auto' ? 'any detected source language' : sl;
  const batchHint = options.isBatch
    ? ' Preserve all "\\n||||\\n" delimiters between segments verbatim and output the exact same number of segments.'
    : '';
  const scriptHint = getChineseScriptInstruction(tl);

  const systemPrompt =
    `You are a professional web translator. Translate the user text accurately from ${sourceDesc} into ${targetDesc}. ` +
    `Preserve original formatting, numbers, and punctuation. Return ONLY the translated text without explanations or markdown quotes.${scriptHint}${batchHint}`;

  const response = await fetchWithTimeout(
    apiUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]
      })
    },
    options.timeoutMs ?? 20000,
    options.signal
  );

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response || !response.ok) {
    const errMsg = data?.error?.message || `OpenAI API HTTP ${response ? response.status : 'unknown'}`;
    throw new Error(errMsg);
  }

  const translatedText = data?.choices?.[0]?.message?.content?.trim();
  if (!translatedText) {
    throw new Error('OpenAI API 未返回有效译文');
  }

  return {
    translatedText,
    detectedSourceLang: sl === 'auto' ? detectLanguageLocally(text) : sl,
    engine: 'openai'
  };
}

/**
 * Fetch available providers and models from local Loom gateway (`GET /v1/models`).
 * @param {{ baseUrl?: string, apiKey?: string, timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<Array<{ id: string, name: string, billing: string, models: Array<{ id: string, name: string, contextWindow: number, maxTokens: number }> }>>}
 */
export async function fetchLoomModels({ baseUrl, apiKey, timeoutMs, signal } = {}) {
  const cleanBase = String(baseUrl || 'http://127.0.0.1:4319/v1').trim().replace(/\/+$/, '');
  const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  const headers = {};
  if (cleanKey) {
    headers.Authorization = `Bearer ${cleanKey}`;
  }

  const response = await fetchWithTimeout(
    `${cleanBase}/models`,
    { method: 'GET', headers },
    timeoutMs ?? 8000,
    signal
  );

  const rawText = response && typeof response.text === 'function' ? await response.text() : '';
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (_) {
      data = null;
    }
  } else if (response && typeof response.json === 'function') {
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }
  }

  if (response && response.status === 403 && rawText.includes('LOCAL_CLIENTS_ONLY')) {
    const err = new Error(
      'Loom 网关拒绝了浏览器扩展请求 (403 LOCAL_CLIENTS_ONLY：Loom 默认拦截带 Origin / Sec-Fetch-Site: cross-site 的浏览器请求)，已加载本地预设供应商与模型列表'
    );
    err.code = 'LOCAL_CLIENTS_ONLY';
    throw err;
  }

  if (!response || !response.ok) {
    const errMsg = data?.error?.message || `Loom /models HTTP ${response ? response.status : 'unknown'}`;
    throw new Error(errMsg);
  }

  const items = Array.isArray(data?.data) ? data.data : [];
  const providerMap = new Map();

  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) continue;
    const modelId = item.id.trim();
    const slashIdx = modelId.indexOf('/');
    const prefix = slashIdx > 0 ? modelId.slice(0, slashIdx) : (item.owned_by || 'loom');

    let group = providerMap.get(prefix);
    if (!group) {
      group = {
        id: prefix,
        name: item.owned_by || prefix,
        billing: item.billing || '',
        models: []
      };
      providerMap.set(prefix, group);
    } else {
      if (group.name === prefix && item.owned_by) {
        group.name = item.owned_by;
      }
      if (!group.billing && item.billing) {
        group.billing = item.billing;
      }
    }

    group.models.push({
      id: modelId,
      name: item.name || modelId,
      contextWindow: item.context_window ?? item.contextWindow ?? 128000,
      maxTokens: item.max_output_tokens ?? item.maxTokens ?? 8192
    });
  }

  return Array.from(providerMap.values());
}

/**
 * Return fast non-thinking parameters for local Loom reasoning models.
 * @param {string} model
 * @returns {Record<string, unknown>}
 */
export function buildLoomFastParams(model) {
  const m = typeof model === 'string' ? model.trim() : '';
  if (/kimi-for-coding/i.test(m)) {
    return { reasoning_effort: 'low' };
  }
  if (/^(kimi\/)|kimi|k3/i.test(m)) {
    return { reasoning_effort: 'none' };
  }
  if (/^(deepseek|glm|longcat)\//i.test(m)) {
    return { thinking: { type: 'disabled' } };
  }
  return {};
}

function extractRawReasoningDelta(entries) {
  if (typeof entries === 'string') return entries;
  if (Array.isArray(entries)) {
    let out = '';
    for (const entry of entries) {
      if (!entry) continue;
      if (typeof entry === 'string') {
        out += entry;
      } else if (typeof entry === 'object') {
        const text =
          typeof entry.text === 'string'
            ? entry.text
            : (typeof entry.summary === 'string'
              ? entry.summary
              : (typeof entry.content === 'string'
                ? entry.content
                : (typeof entry.reasoning === 'string'
                  ? entry.reasoning
                  : (typeof entry.thinking === 'string' ? entry.thinking : ''))));
        if (text) out += text;
      }
    }
    return out;
  }
  if (entries && typeof entries === 'object') {
    const candidate = entries.text || entries.summary || entries.content || entries.reasoning || entries.thinking || '';
    return typeof candidate === 'string' ? candidate : '';
  }
  return '';
}

function getPartialTagPrefixLength(text, tags) {
  const maxCheck = Math.min(text.length, 11);
  for (let len = maxCheck; len >= 1; len -= 1) {
    const suffix = text.slice(-len).toLowerCase();
    for (const tag of tags) {
      if (tag.startsWith(suffix)) return len;
    }
  }
  return 0;
}

function feedOpenAiThinkTagChunk(chunkText, state) {
  if (!chunkText) return;
  state.tagPending += chunkText;
  const openTags = ['<think>', '<thinking>'];
  const closeTags = ['</think>', '</thinking>'];

  while (state.tagPending) {
    if (!state.thinkOpen) {
      const match = state.tagPending.match(/<(think|thinking)>/i);
      if (match) {
        const idx = match.index;
        if (idx > 0) {
          state.replyRaw += state.tagPending.slice(0, idx);
        }
        state.thinkOpen = true;
        state.tagPending = state.tagPending.slice(idx + match[0].length);
        continue;
      }
      const partialLen = getPartialTagPrefixLength(state.tagPending, openTags);
      if (partialLen > 0) {
        const cut = state.tagPending.length - partialLen;
        if (cut > 0) {
          state.replyRaw += state.tagPending.slice(0, cut);
          state.tagPending = state.tagPending.slice(cut);
        }
        break;
      }
      state.replyRaw += state.tagPending;
      state.tagPending = '';
      break;
    }

    const closeMatch = state.tagPending.match(/<\/(think|thinking)>/i);
    if (closeMatch) {
      const idx = closeMatch.index;
      if (idx > 0) {
        state.reasoningTagRaw += state.tagPending.slice(0, idx);
      }
      state.thinkOpen = false;
      state.tagPending = state.tagPending.slice(idx + closeMatch[0].length);
      continue;
    }
    const partialClose = getPartialTagPrefixLength(state.tagPending, closeTags);
    if (partialClose > 0) {
      const cut = state.tagPending.length - partialClose;
      if (cut > 0) {
        state.reasoningTagRaw += state.tagPending.slice(0, cut);
        state.tagPending = state.tagPending.slice(cut);
      }
      break;
    }
    state.reasoningTagRaw += state.tagPending;
    state.tagPending = '';
    break;
  }
}

function createOpenAiSseState({ model = '', engine = 'loom', enableThinking = true, startedAt = Date.now(), onProgress } = {}) {
  return {
    lineBuffer: '',
    reasoningFieldRaw: '',
    reasoningTagRaw: '',
    replyRaw: '',
    tagPending: '',
    thinkOpen: false,
    streamError: '',
    sseEventCount: 0,
    model,
    engine,
    enableThinking,
    startedAt,
    lastEmittedReasoning: '',
    lastEmittedReply: '',
    onProgress: typeof onProgress === 'function' ? onProgress : null
  };
}

function buildOpenAiSseSnapshot(state, flushPending = false) {
  let replyRaw = state.replyRaw;
  let reasoningTagRaw = state.reasoningTagRaw;
  if (flushPending && state.tagPending) {
    if (state.thinkOpen) {
      reasoningTagRaw += state.tagPending;
    } else {
      replyRaw += state.tagPending;
    }
  }
  const normalizeChunk = flushPending ? (s) => s.trim() : (s) => s.trimStart();
  const rField = normalizeChunk(state.reasoningFieldRaw);
  const rTag = normalizeChunk(reasoningTagRaw);
  let reasoning = '';
  if (rField && rTag && rField !== rTag) {
    reasoning = `${rField}\n\n${rTag}`;
  } else {
    reasoning = rField || rTag;
  }
  return {
    reasoning,
    reply: normalizeChunk(replyRaw)
  };
}

function emitOpenAiSseProgress(state, flushPending = false) {
  if (!state.onProgress) return;
  const snap = buildOpenAiSseSnapshot(state, flushPending);
  const emittedReasoning = state.enableThinking ? snap.reasoning : '';
  if (
    emittedReasoning === state.lastEmittedReasoning &&
    snap.reply === state.lastEmittedReply
  ) {
    return;
  }
  state.lastEmittedReasoning = emittedReasoning;
  state.lastEmittedReply = snap.reply;
  try {
    state.onProgress({
      reasoning: emittedReasoning,
      reply: snap.reply,
      thinkingMs: Math.max(0, Date.now() - state.startedAt),
      model: state.model,
      engine: state.engine
    });
  } catch (_) {
    // Ignore UI progress listener errors
  }
}

function parseOpenAiSseEvents(rawChunkBuffer, state, onEvent) {
  if (rawChunkBuffer) {
    state.lineBuffer += rawChunkBuffer;
  }
  const lines = state.lineBuffer.split(/\r?\n/);
  state.lineBuffer = lines.pop() || '';
  for (const rawLine of lines) {
    processOpenAiSseLine(rawLine, state, onEvent);
  }
}

function flushOpenAiSseLineBuffer(state, onEvent) {
  if (state.lineBuffer) {
    const trailing = state.lineBuffer;
    state.lineBuffer = '';
    processOpenAiSseLine(trailing, state, onEvent);
  }
  if (state.tagPending) {
    if (state.thinkOpen) {
      state.reasoningTagRaw += state.tagPending;
    } else {
      state.replyRaw += state.tagPending;
    }
    state.tagPending = '';
  }
  emitOpenAiSseProgress(state, true);
}

function processOpenAiSseLine(rawLine, state, onEvent) {
  const line = String(rawLine || '').trim();
  if (!line || !line.startsWith('data:')) return;
  const dataStr = line.slice(5).trim();
  if (!dataStr || dataStr === '[DONE]') return;

  let evt = null;
  try {
    evt = JSON.parse(dataStr);
  } catch (_) {
    return;
  }
  if (!evt || typeof evt !== 'object') return;
  state.sseEventCount += 1;
  if (typeof evt.model === 'string' && evt.model.trim()) {
    state.model = evt.model.trim();
  }
  if (evt.error?.message) {
    state.streamError = evt.error.message;
  }

  const choice = Array.isArray(evt.choices) ? evt.choices[0] : null;
  const delta = choice?.delta || choice?.message || evt.delta || evt.message || null;
  if (delta && typeof delta === 'object') {
    let gotReasoning = false;
    for (const field of [
      delta.reasoning_content,
      delta.reasoning,
      delta.reasoning_text,
      delta.thinking,
      delta.reasoning_details,
      choice?.reasoning_content,
      choice?.reasoning
    ]) {
      const piece = extractRawReasoningDelta(field);
      if (piece) {
        state.reasoningFieldRaw += piece;
        gotReasoning = true;
      }
    }

    if (typeof delta.content === 'string' && delta.content) {
      feedOpenAiThinkTagChunk(delta.content, state);
    } else if (Array.isArray(delta.content)) {
      for (const part of delta.content) {
        if (!part) continue;
        if (typeof part === 'string') {
          feedOpenAiThinkTagChunk(part, state);
        } else {
          const pType = String(part.type || '').toLowerCase();
          if (pType === 'thinking' || pType === 'reasoning' || pType === 'reasoning_content') {
            const rPiece = part.thinking || part.reasoning || part.text || part.content || '';
            if (typeof rPiece === 'string' && rPiece) {
              state.reasoningFieldRaw += rPiece;
              gotReasoning = true;
            }
          } else if (typeof part.text === 'string' && part.text) {
            feedOpenAiThinkTagChunk(part.text, state);
          } else if (typeof part.content === 'string' && part.content) {
            feedOpenAiThinkTagChunk(part.content, state);
          }
        }
      }
    }

    if (gotReasoning || delta.content) {
      emitOpenAiSseProgress(state, false);
    }
  }

  if (typeof onEvent === 'function') {
    onEvent(evt, state);
  }
}

async function consumeOpenAiChatResponse(
  response,
  { stream = false, enableThinking = true, startedAt = Date.now(), model = '', engine = 'loom', onProgress } = {}
) {
  let rawText = '';
  let data = null;

  if (!response || !response.ok) {
    if (response && typeof response.text === 'function') {
      try {
        rawText = await response.text();
      } catch (_) {
        rawText = '';
      }
    }
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch (_) {
        data = null;
      }
    } else if (response && typeof response.json === 'function') {
      try {
        data = await response.json();
      } catch (_) {
        data = null;
      }
    }
    return { response, rawText, data };
  }

  const sseState = createOpenAiSseState({ model, engine, enableThinking, startedAt, onProgress });
  const contentType = response.headers && typeof response.headers.get === 'function'
    ? String(response.headers.get('content-type') || '').toLowerCase()
    : '';
  const hasReader = Boolean(response.body && typeof response.body.getReader === 'function');
  const expectStream = Boolean((stream || typeof onProgress === 'function' || contentType.includes('text/event-stream')) && hasReader);

  if (expectStream && (!contentType || contentType.includes('text/event-stream') || stream)) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
      if (chunk) {
        rawText += chunk;
        parseOpenAiSseEvents(chunk, sseState);
      }
    }
    const tail = decoder.decode();
    if (tail) {
      rawText += tail;
      parseOpenAiSseEvents(tail, sseState);
    }
    flushOpenAiSseLineBuffer(sseState);

    if (sseState.sseEventCount > 0 || /^\s*data:/m.test(rawText)) {
      const snap = buildOpenAiSseSnapshot(sseState, true);
      if (sseState.streamError && !snap.reply) {
        data = { error: { message: sseState.streamError } };
      } else {
        data = {
          model: sseState.model || model,
          choices: [
            {
              message: {
                content: snap.reply,
                ...(snap.reasoning ? { reasoning_content: snap.reasoning } : {})
              }
            }
          ]
        };
      }
      return { response, rawText, data };
    }
  } else {
    if (response && typeof response.text === 'function') {
      rawText = await response.text();
    } else if (hasReader) {
      rawText = await readStreamOrTextBody(response);
    }
  }

  if (rawText && (/^\s*(?:event:|data:)/m.test(rawText) && !rawText.trim().startsWith('{'))) {
    parseOpenAiSseEvents(rawText, sseState);
    flushOpenAiSseLineBuffer(sseState);
    const snap = buildOpenAiSseSnapshot(sseState, true);
    if (sseState.streamError && !snap.reply) {
      data = { error: { message: sseState.streamError } };
    } else {
      data = {
        model: sseState.model || model,
        choices: [
          {
            message: {
              content: snap.reply,
              ...(snap.reasoning ? { reasoning_content: snap.reasoning } : {})
            }
          }
        ]
      };
    }
    return { response, rawText, data };
  }

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (_) {
      data = null;
    }
  } else if (response && typeof response.json === 'function') {
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }
  }

  if (data && typeof onProgress === 'function') {
    const extracted = extractChatReplyAndReasoning(data);
    const rOut = enableThinking ? (extracted.reasoning || '') : '';
    if (rOut || extracted.reply) {
      try {
        onProgress({
          reasoning: rOut,
          reply: extracted.reply || '',
          thinkingMs: Math.max(0, Date.now() - startedAt),
          model: data.model || model,
          engine
        });
      } catch (_) {
        // Ignore progress callback error
      }
    }
  }

  return { response, rawText, data };
}

async function postLoomChat(endpoint, apiKey, payload, timeoutMs, signal, streamOpts) {
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    },
    timeoutMs,
    signal
  );

  return consumeOpenAiChatResponse(response, {
    stream: Boolean(streamOpts?.stream ?? payload?.stream),
    enableThinking: streamOpts?.enableThinking !== false,
    startedAt: streamOpts?.startedAt || Date.now(),
    model: streamOpts?.model || payload?.model || '',
    engine: streamOpts?.engine || 'loom',
    onProgress: streamOpts?.onProgress
  });
}

/**
 * Translate text via local Loom gateway (`POST /v1/chat/completions`).
 */
export async function translateWithLoom(
  text,
  sourceLang = 'auto',
  targetLang = 'zh-CN',
  loomConfig = {},
  options = {}
) {
  const sl = normalizeLangCode(sourceLang, 'openai');
  const tl = normalizeTargetLang(targetLang);
  const baseUrl = String(loomConfig?.baseUrl || 'http://127.0.0.1:4319/v1').trim().replace(/\/+$/, '');
  const apiKey = typeof loomConfig?.apiKey === 'string' ? loomConfig.apiKey.trim() : '';
  const model = String(loomConfig?.model || 'zenmux/anthropic/claude-sonnet-5.5').trim();

  if (!apiKey) {
    throw new Error('请先在设置中填写 Loom 入口 Key (hub.key)');
  }

  const targetDesc = TARGET_LANG_LABELS[tl] || tl;
  const sourceDesc = sl === 'auto' ? 'any detected source language' : sl;
  const batchHint = options.isBatch
    ? ' Preserve all "\\n||||\\n" delimiters between segments verbatim and output the exact same number of segments.'
    : '';
  const scriptHint = getChineseScriptInstruction(tl);

  const systemPrompt =
    `You are a professional web translator. Translate the user text accurately from ${sourceDesc} into ${targetDesc}. ` +
    `Think briefly and do not overthink. Return ONLY the translated text without explanations or quotes.${scriptHint}${batchHint}`;

  const endpoint = `${baseUrl}/chat/completions`;
  const timeoutMs = options.timeoutMs ?? 60000;
  const basePayload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ]
  };
  const fastParams = buildLoomFastParams(model);
  const hasFastParams = Object.keys(fastParams).length > 0;
  const requestPayload = hasFastParams ? { ...basePayload, ...fastParams } : basePayload;

  let { response, rawText, data } = await postLoomChat(
    endpoint,
    apiKey,
    requestPayload,
    timeoutMs,
    options.signal
  );

  // Automatic compatibility fallback if upstream rejects fast-thinking params with HTTP 400
  if (response && response.status === 400 && hasFastParams) {
    ({ response, rawText, data } = await postLoomChat(
      endpoint,
      apiKey,
      basePayload,
      timeoutMs,
      options.signal
    ));
  }

  if (response && response.status === 403 && rawText.includes('LOCAL_CLIENTS_ONLY')) {
    const err = new Error(
      'Loom 网关拦截了浏览器扩展的 POST 请求 (403 LOCAL_CLIENTS_ONLY：Chrome 发送 POST 时会自动附带 Origin: chrome-extension://... 请求头，被 Loom gateway.rs 拦截)'
    );
    err.code = 'LOCAL_CLIENTS_ONLY';
    throw err;
  }

  if (!response || !response.ok) {
    const errMsg = data?.error?.message || `Loom API HTTP ${response ? response.status : 'unknown'}`;
    throw new Error(errMsg);
  }

  const translatedText = data?.choices?.[0]?.message?.content?.trim();
  if (!translatedText) {
    throw new Error('Loom API 未返回有效译文');
  }

  return {
    translatedText,
    detectedSourceLang: sl === 'auto' ? detectLanguageLocally(text) : sl,
    engine: 'loom'
  };
}

// ============================================================================
// OpenAI Codex Subscription Engine (OAuth Device Code / Token Refresh + SSE)
// ============================================================================

const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const CODEX_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const CODEX_DEVICE_USERCODE_URL = 'https://auth.openai.com/api/accounts/deviceauth/usercode';
const CODEX_DEVICE_POLL_URL = 'https://auth.openai.com/api/accounts/deviceauth/token';
const CODEX_DEVICE_REDIRECT_URI = 'https://auth.openai.com/deviceauth/callback';
const CODEX_DEVICE_VERIFICATION_URL = 'https://auth.openai.com/codex/device';
const CODEX_DEFAULT_BASE_URL = 'https://chatgpt.com/backend-api';
const CODEX_DEFAULT_MODEL = 'gpt-5.6-luna';
const CODEX_REFRESH_SKEW_MS = 3 * 60 * 1000;

function decodeBase64UrlToUtf8Engine(b64url) {
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

function decodeCodexJwtClaims(token) {
  if (typeof token !== 'string') return {};
  const clean = token.trim().replace(/^Bearer\s+/i, '');
  const parts = clean.split('.');
  if (parts.length !== 3 || !parts[1]) return {};
  try {
    const payload = JSON.parse(decodeBase64UrlToUtf8Engine(parts[1]));
    if (!payload || typeof payload !== 'object') return {};
    const authNs = payload['https://api.openai.com/auth'];
    const profileNs = payload['https://api.openai.com/profile'];
    const accountId = authNs && typeof authNs.chatgpt_account_id === 'string'
      ? authNs.chatgpt_account_id.trim()
      : '';
    const planType = authNs && typeof authNs.chatgpt_plan_type === 'string'
      ? authNs.chatgpt_plan_type.trim()
      : '';
    const email = profileNs && typeof profileNs.email === 'string'
      ? profileNs.email.trim()
      : (typeof payload.email === 'string' ? payload.email.trim() : '');
    const rawExp = Number(payload.exp);
    const expiresAt = Number.isFinite(rawExp) && rawExp > 0
      ? (rawExp < 1e12 ? Math.round(rawExp * 1000) : Math.round(rawExp))
      : 0;
    return { accountId, planType, email, expiresAt };
  } catch (_) {
    return {};
  }
}

function normalizeCodexExpiresAt(rawTs) {
  const num = Number(rawTs);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return num < 1e12 ? Math.round(num * 1000) : Math.round(num);
}

function buildCodexCredentialFromResponse(tokenData, fallbacks = {}) {
  const accessToken = String(
    tokenData?.access_token || tokenData?.accessToken || tokenData?.access || ''
  ).trim().replace(/^Bearer\s+/i, '');
  const refreshToken = String(
    tokenData?.refresh_token || tokenData?.refreshToken || tokenData?.refresh || fallbacks.refreshToken || ''
  ).trim();
  const idToken = String(tokenData?.id_token || tokenData?.idToken || '').trim();

  const accessClaims = decodeCodexJwtClaims(accessToken);
  const idClaims = idToken ? decodeCodexJwtClaims(idToken) : {};

  let expiresAt = normalizeCodexExpiresAt(tokenData?.expiresAt || tokenData?.expires_at || tokenData?.expires);
  if (!expiresAt) {
    expiresAt = accessClaims.expiresAt || idClaims.expiresAt || 0;
  }
  if (!expiresAt && Number.isFinite(Number(tokenData?.expires_in)) && Number(tokenData.expires_in) > 0) {
    expiresAt = Date.now() + Math.round(Number(tokenData.expires_in) * 1000);
  }

  return {
    accessToken,
    refreshToken,
    accountId: String(
      tokenData?.account_id ||
      tokenData?.accountId ||
      accessClaims.accountId ||
      idClaims.accountId ||
      fallbacks.accountId ||
      ''
    ).trim(),
    expiresAt,
    email: String(tokenData?.email || accessClaims.email || idClaims.email || fallbacks.email || '').trim(),
    planType: String(tokenData?.planType || accessClaims.planType || idClaims.planType || fallbacks.planType || '').trim()
  };
}

async function readResponseJsonAndText(response) {
  let rawText = '';
  let data = null;
  if (response && typeof response.text === 'function') {
    try {
      rawText = await response.text();
    } catch (_) {
      rawText = '';
    }
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch (_) {
        data = null;
      }
    }
  } else if (response && typeof response.json === 'function') {
    try {
      data = await response.json();
      rawText = data ? JSON.stringify(data) : '';
    } catch (_) {
      data = null;
    }
  }
  return { rawText, data };
}

/**
 * Refresh an OpenAI Codex OAuth access token using a refresh_token.
 */
export async function refreshCodexToken(refreshToken, options = {}) {
  const cleanRefresh = typeof refreshToken === 'string' ? refreshToken.trim() : '';
  if (!cleanRefresh) {
    throw new Error('缺少 Codex refresh_token，请重新导入凭证或进行设备码登录');
  }

  const form = new URLSearchParams();
  form.set('grant_type', 'refresh_token');
  form.set('refresh_token', cleanRefresh);
  form.set('client_id', CODEX_CLIENT_ID);

  const response = await fetchWithTimeout(
    CODEX_TOKEN_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: form.toString()
    },
    options.timeoutMs ?? 20000,
    options.signal
  );

  const { rawText, data } = await readResponseJsonAndText(response);
  if (!response || !response.ok) {
    const errMsg =
      data?.error_description ||
      data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : '') ||
      rawText ||
      `Codex OAuth refresh HTTP ${response ? response.status : 'unknown'}`;
    throw new Error(errMsg);
  }

  const cred = buildCodexCredentialFromResponse(data, {
    refreshToken: cleanRefresh,
    accountId: options.accountId,
    email: options.email,
    planType: options.planType
  });
  if (!cred.accessToken) {
    throw new Error('Codex OAuth 刷新响应缺少 access_token');
  }
  return cred;
}

/**
 * Start OpenAI Codex OAuth Device Code authorization flow.
 */
export async function startCodexDeviceAuth(options = {}) {
  const response = await fetchWithTimeout(
    CODEX_DEVICE_USERCODE_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ client_id: CODEX_CLIENT_ID })
    },
    options.timeoutMs ?? 15000,
    options.signal
  );

  const { rawText, data } = await readResponseJsonAndText(response);
  if (!response || !response.ok) {
    const errMsg =
      data?.error?.message ||
      data?.error_description ||
      (typeof data?.error === 'string' ? data.error : '') ||
      rawText ||
      `Codex device auth start HTTP ${response ? response.status : 'unknown'}`;
    throw new Error(errMsg);
  }

  const deviceAuthId = String(data?.device_auth_id || data?.deviceAuthId || '').trim();
  const userCode = String(data?.user_code || data?.userCode || '').trim();
  const rawInterval = Number(data?.interval ?? data?.intervalSeconds);
  const intervalSeconds = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : 5;

  if (!deviceAuthId || !userCode) {
    throw new Error('Codex 设备码接口未返回有效的 device_auth_id 或 user_code');
  }

  return {
    deviceAuthId,
    userCode,
    intervalSeconds,
    verificationUrl: CODEX_DEVICE_VERIFICATION_URL
  };
}

/**
 * Poll OpenAI Codex Device Code flow once and exchange authorization_code for OAuth tokens when ready.
 */
export async function pollCodexDeviceAuthOnce(deviceAuthId, userCode, options = {}) {
  let cleanAuthId = deviceAuthId;
  let cleanUserCode = userCode;
  let opts = options;

  if (deviceAuthId && typeof deviceAuthId === 'object') {
    cleanAuthId = deviceAuthId.deviceAuthId || deviceAuthId.device_auth_id;
    cleanUserCode = deviceAuthId.userCode || deviceAuthId.user_code;
    opts = userCode && typeof userCode === 'object' ? userCode : options;
  }

  cleanAuthId = String(cleanAuthId || '').trim();
  cleanUserCode = String(cleanUserCode || '').trim();
  if (!cleanAuthId || !cleanUserCode) {
    throw new Error('缺少 deviceAuthId 或 userCode，无法轮询 Codex 设备授权状态');
  }

  const response = await fetchWithTimeout(
    CODEX_DEVICE_POLL_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        device_auth_id: cleanAuthId,
        user_code: cleanUserCode
      })
    },
    opts.timeoutMs ?? 15000,
    opts.signal
  );

  const { rawText, data } = await readResponseJsonAndText(response);
  const errCode = String(data?.error?.code || data?.error || '').toLowerCase();
  if (
    response &&
    (response.status === 403 ||
      response.status === 404 ||
      errCode.includes('pending') ||
      errCode.includes('slow_down') ||
      rawText.includes('deviceauth_authorization_pending'))
  ) {
    return { status: 'pending' };
  }

  if (!response || !response.ok) {
    const errMsg =
      data?.error?.message ||
      data?.error_description ||
      (typeof data?.error === 'string' ? data.error : '') ||
      rawText ||
      `Codex device poll HTTP ${response ? response.status : 'unknown'}`;
    throw new Error(errMsg);
  }

  const authCode = String(data?.authorization_code || data?.code || '').trim();
  const codeVerifier = String(data?.code_verifier || data?.codeVerifier || '').trim();
  if (!authCode) {
    return { status: 'pending' };
  }

  const form = new URLSearchParams();
  form.set('grant_type', 'authorization_code');
  form.set('code', authCode);
  form.set('redirect_uri', CODEX_DEVICE_REDIRECT_URI);
  form.set('client_id', CODEX_CLIENT_ID);
  if (codeVerifier) {
    form.set('code_verifier', codeVerifier);
  }

  const tokenRes = await fetchWithTimeout(
    CODEX_TOKEN_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: form.toString()
    },
    opts.timeoutMs ?? 20000,
    opts.signal
  );

  const tokenParsed = await readResponseJsonAndText(tokenRes);
  if (!tokenRes || !tokenRes.ok) {
    const errMsg =
      tokenParsed.data?.error_description ||
      tokenParsed.data?.error?.message ||
      (typeof tokenParsed.data?.error === 'string' ? tokenParsed.data.error : '') ||
      tokenParsed.rawText ||
      `Codex authorization code exchange HTTP ${tokenRes ? tokenRes.status : 'unknown'}`;
    throw new Error(errMsg);
  }

  const credential = buildCodexCredentialFromResponse(tokenParsed.data);
  if (!credential.accessToken) {
    throw new Error('Codex 授权完成但未返回 access_token');
  }
  return {
    status: 'complete',
    credential
  };
}

function extractCodexTextFromObject(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (typeof obj.output_text === 'string' && obj.output_text.trim()) {
    return obj.output_text.trim();
  }
  if (obj.type !== 'reasoning' && typeof obj.text === 'string' && obj.text.trim()) {
    return obj.text.trim();
  }

  const targetObj = obj.response && typeof obj.response === 'object' ? obj.response : obj;
  if (typeof targetObj.output_text === 'string' && targetObj.output_text.trim()) {
    return targetObj.output_text.trim();
  }

  const items = Array.isArray(targetObj.output)
    ? targetObj.output
    : (obj.type === 'message' || (obj.type !== 'reasoning' && Array.isArray(obj.content)) ? [obj] : []);

  const chunks = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'reasoning') continue;
    if (typeof item.text === 'string' && item.text) {
      chunks.push(item.text);
      continue;
    }
    if (Array.isArray(item.content)) {
      for (const part of item.content) {
        if (!part) continue;
        if (typeof part === 'string') {
          chunks.push(part);
        } else if (part.type === 'reasoning' || part.type === 'reasoning_text' || part.type === 'summary_text') {
          continue;
        } else if (typeof part.text === 'string') {
          chunks.push(part.text);
        } else if (part.type === 'output_text' && typeof part.output_text === 'string') {
          chunks.push(part.output_text);
        }
      }
    } else if (typeof item.content === 'string') {
      chunks.push(item.content);
    }
  }
  if (chunks.length > 0) {
    return chunks.join('').trim();
  }

  const choiceContent = obj?.choices?.[0]?.message?.content;
  if (typeof choiceContent === 'string' && choiceContent.trim()) {
    return choiceContent.trim();
  }
  return '';
}

function extractTextFromReasoningEntries(entries) {
  if (typeof entries === 'string') {
    return entries.trim();
  }
  if (!Array.isArray(entries)) {
    if (entries && typeof entries === 'object') {
      const candidate = entries.text || entries.summary || entries.content || entries.reasoning || '';
      return typeof candidate === 'string' ? candidate.trim() : '';
    }
    return '';
  }
  const parts = [];
  for (const entry of entries) {
    if (!entry) continue;
    if (typeof entry === 'string') {
      if (entry.trim()) parts.push(entry.trim());
    } else if (typeof entry === 'object') {
      const text =
        typeof entry.text === 'string' ? entry.text
          : (typeof entry.summary === 'string' ? entry.summary
            : (typeof entry.content === 'string' ? entry.content
              : (typeof entry.reasoning === 'string' ? entry.reasoning : '')));
      if (text && text.trim()) parts.push(text.trim());
    }
  }
  return parts.join('\n').trim();
}

function extractCodexReasoningFromObject(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const targetObj = obj.response && typeof obj.response === 'object' ? obj.response : obj;
  const chunks = [];

  const pushUnique = (text) => {
    const clean = typeof text === 'string' ? text.trim() : '';
    if (clean && !chunks.includes(clean)) {
      chunks.push(clean);
    }
  };

  if (typeof targetObj.reasoning_content === 'string') {
    pushUnique(targetObj.reasoning_content);
  }
  if (typeof targetObj.reasoning_text === 'string') {
    pushUnique(targetObj.reasoning_text);
  }

  const collectFromReasoningItem = (item) => {
    if (!item || typeof item !== 'object') return;
    const summaryText = extractTextFromReasoningEntries(item.summary);
    if (summaryText) pushUnique(summaryText);
    const contentText = extractTextFromReasoningEntries(item.content);
    if (contentText) pushUnique(contentText);
    if (item.type === 'reasoning' && typeof item.text === 'string') {
      pushUnique(item.text);
    }
  };

  if (obj.type === 'reasoning') {
    collectFromReasoningItem(obj);
  }

  if (Array.isArray(targetObj.output)) {
    for (const item of targetObj.output) {
      if (item && item.type === 'reasoning') {
        collectFromReasoningItem(item);
      }
    }
  }

  const msg = obj?.choices?.[0]?.message;
  if (msg && typeof msg === 'object') {
    if (typeof msg.reasoning_content === 'string') pushUnique(msg.reasoning_content);
    if (typeof msg.reasoning === 'string') pushUnique(msg.reasoning);
  }

  return chunks.join('\n\n').trim();
}

function createCodexSseAccumulator(options = {}) {
  const enableThinking = options.enableThinking !== false;
  const startedAt = typeof options.startedAt === 'number' ? options.startedAt : Date.now();
  const model = options.model || CODEX_DEFAULT_MODEL;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  const state = {
    lineBuffer: '',
    deltaText: '',
    doneItemText: '',
    completedText: '',
    reasoningDeltaText: '',
    reasoningPartDoneText: '',
    reasoningItemText: '',
    completedReasoningText: '',
    streamError: '',
    currentEvent: '',
    lastEmittedReply: '',
    lastEmittedReasoning: ''
  };

  const getSnapshot = () => {
    const finalText = state.deltaText.trim()
      ? state.deltaText.trim()
      : (state.doneItemText.trim() || state.completedText.trim());
    const finalReasoning = state.reasoningDeltaText.trim()
      ? state.reasoningDeltaText.trim()
      : (state.reasoningPartDoneText.trim() || state.reasoningItemText.trim() || state.completedReasoningText.trim());
    return { text: finalText, reasoning: finalReasoning };
  };

  const maybeEmit = () => {
    if (!onProgress) return;
    const snap = getSnapshot();
    const emittedReasoning = enableThinking ? snap.reasoning : '';
    if (
      emittedReasoning === state.lastEmittedReasoning &&
      snap.text === state.lastEmittedReply
    ) {
      return;
    }
    state.lastEmittedReasoning = emittedReasoning;
    state.lastEmittedReply = snap.text;
    try {
      onProgress({
        reasoning: emittedReasoning,
        reply: snap.text,
        thinkingMs: Math.max(0, Date.now() - startedAt),
        model,
        engine: 'codex'
      });
    } catch (_) {
      // Ignore UI progress listener errors
    }
  };

  const processLine = (rawLine) => {
    const line = String(rawLine || '').trim();
    if (!line) {
      state.currentEvent = '';
      return;
    }
    if (line.startsWith('event:')) {
      state.currentEvent = line.slice(6).trim();
      return;
    }
    if (!line.startsWith('data:')) return;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === '[DONE]') return;

    let evt = null;
    try {
      evt = JSON.parse(dataStr);
    } catch (_) {
      return;
    }
    if (!evt || typeof evt !== 'object') return;

    const evtType = evt.type || state.currentEvent;
    if (evtType === 'error' || evtType === 'response.failed') {
      state.streamError =
        evt.message ||
        evt.error?.message ||
        evt.response?.error?.message ||
        state.streamError ||
        'Codex stream failed';
      return;
    }

    if (
      (evtType === 'response.reasoning_summary_text.delta' ||
        evtType === 'response.reasoning_text.delta' ||
        evtType === 'response.reasoning.delta') &&
      typeof (evt.delta ?? evt.text) === 'string'
    ) {
      state.reasoningDeltaText += (evt.delta ?? evt.text);
      maybeEmit();
      return;
    }

    if (evtType === 'response.reasoning_summary_text.done' || evtType === 'response.reasoning_text.done') {
      const doneText = typeof evt.text === 'string' ? evt.text : '';
      if (doneText) {
        state.reasoningPartDoneText = state.reasoningPartDoneText
          ? `${state.reasoningPartDoneText}\n\n${doneText}`
          : doneText;
        maybeEmit();
      }
      return;
    }

    if (evtType === 'response.reasoning_summary_part.done' && evt.part) {
      const partText = extractTextFromReasoningEntries(evt.part);
      if (partText) {
        state.reasoningPartDoneText = state.reasoningPartDoneText
          ? `${state.reasoningPartDoneText}\n\n${partText}`
          : partText;
        maybeEmit();
      }
      return;
    }

    if (evtType === 'response.output_text.delta' && typeof evt.delta === 'string') {
      state.deltaText += evt.delta;
      maybeEmit();
      return;
    }

    if (evtType === 'response.output_text.done' && typeof evt.text === 'string' && evt.text) {
      state.doneItemText += evt.text;
      maybeEmit();
      return;
    }

    if (evtType === 'response.output_item.done' && evt.item) {
      if (evt.item.type === 'reasoning') {
        const extractedR = extractCodexReasoningFromObject(evt.item);
        if (extractedR) {
          state.reasoningItemText = extractedR;
          maybeEmit();
        }
      } else {
        const extracted = extractCodexTextFromObject(evt.item);
        if (extracted) {
          state.doneItemText = extracted;
          maybeEmit();
        }
      }
      return;
    }

    if (evtType === 'response.completed' && evt.response) {
      if (evt.response.status === 'failed' && evt.response.error?.message) {
        state.streamError = evt.response.error.message;
      }
      const extracted = extractCodexTextFromObject(evt.response);
      if (extracted) state.completedText = extracted;
      const extractedR = extractCodexReasoningFromObject(evt.response);
      if (extractedR) state.completedReasoningText = extractedR;
      maybeEmit();
    }
  };

  return {
    feedChunk(chunk) {
      if (!chunk) return;
      state.lineBuffer += chunk;
      const lines = state.lineBuffer.split(/\r?\n/);
      state.lineBuffer = lines.pop() || '';
      for (const line of lines) {
        processLine(line);
      }
    },
    finish() {
      if (state.lineBuffer) {
        const trailing = state.lineBuffer;
        state.lineBuffer = '';
        processLine(trailing);
      }
      maybeEmit();
      const snap = getSnapshot();
      if (!snap.text && state.streamError) {
        throw new Error(state.streamError);
      }
      return snap;
    }
  };
}

function parseCodexSseOrJson(rawBody, options = {}) {
  const includeReasoning = Boolean(options && options.includeReasoning);
  const trimmed = typeof rawBody === 'string' ? rawBody.trim() : '';
  if (!trimmed) {
    return includeReasoning ? { text: '', reasoning: '' } : '';
  }

  // Support non-streaming JSON unit test stubs directly
  if (trimmed.startsWith('{')) {
    try {
      const parsedObj = JSON.parse(trimmed);
      if (parsedObj?.error?.message) {
        throw new Error(parsedObj.error.message);
      }
      const text = extractCodexTextFromObject(parsedObj);
      const reasoning = extractCodexReasoningFromObject(parsedObj);
      if (typeof options.onProgress === 'function' && (text || reasoning)) {
        try {
          options.onProgress({
            reasoning: options.enableThinking === false ? '' : reasoning,
            reply: text,
            thinkingMs: Math.max(0, Date.now() - (options.startedAt || Date.now())),
            model: options.model || CODEX_DEFAULT_MODEL,
            engine: 'codex'
          });
        } catch (_) {
          // Ignore UI progress error
        }
      }
      if (includeReasoning) {
        return { text, reasoning };
      }
      return text;
    } catch (err) {
      if (err && !/JSON/i.test(err.message)) throw err;
    }
  }

  const acc = createCodexSseAccumulator(options);
  acc.feedChunk(rawBody);
  const result = acc.finish();
  return includeReasoning ? result : result.text;
}

function buildCodexResponsesEndpoint(baseUrl) {
  const clean = String(baseUrl || CODEX_DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  if (clean.endsWith('/codex/responses')) return clean;
  if (clean.endsWith('/codex')) return `${clean}/responses`;
  return `${clean}/codex/responses`;
}

async function readStreamOrTextBody(response) {
  if (response && typeof response.text === 'function') {
    return await response.text();
  }
  if (response && response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let out = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      out += typeof value === 'string' ? value : decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    return out;
  }
  if (response && typeof response.json === 'function') {
    const obj = await response.json();
    return JSON.stringify(obj);
  }
  return '';
}

async function executeCodexResponses({
  instructions,
  input,
  model,
  reasoningEffort,
  codexConfig = {},
  options = {}
}) {
  let accessToken = String(codexConfig?.accessToken || '').trim().replace(/^Bearer\s+/i, '');
  let refreshToken = String(codexConfig?.refreshToken || '').trim();
  const claims = accessToken ? decodeCodexJwtClaims(accessToken) : {};
  let accountId = String(codexConfig?.accountId || claims.accountId || '').trim();
  let expiresAt = normalizeCodexExpiresAt(codexConfig?.expiresAt) || claims.expiresAt || 0;
  let email = String(codexConfig?.email || claims.email || '').trim();
  let planType = String(codexConfig?.planType || claims.planType || '').trim();

  if (!accessToken && !refreshToken) {
    throw new Error('请先在设置中导入或授权 OpenAI Codex 订阅凭证');
  }

  const applyRefreshedCred = async (nextCred) => {
    accessToken = nextCred.accessToken || accessToken;
    refreshToken = nextCred.refreshToken || refreshToken;
    accountId = nextCred.accountId || accountId;
    expiresAt = nextCred.expiresAt || expiresAt;
    email = nextCred.email || email;
    planType = nextCred.planType || planType;
    if (typeof options.onTokenRefreshed === 'function') {
      try {
        await options.onTokenRefreshed({
          accessToken,
          refreshToken,
          accountId,
          expiresAt,
          email,
          planType
        });
      } catch (_) {
        // Ignore persistence hook failure so active call can complete
      }
    }
  };

  let refreshedThisCall = false;
  const isExpiringSoon = !accessToken || (expiresAt > 0 && expiresAt - Date.now() < CODEX_REFRESH_SKEW_MS);
  if (isExpiringSoon && refreshToken) {
    try {
      const nextCred = await refreshCodexToken(refreshToken, {
        accountId,
        email,
        planType,
        timeoutMs: options.timeoutMs,
        signal: options.signal
      });
      await applyRefreshedCred(nextCred);
      refreshedThisCall = true;
    } catch (err) {
      if (!accessToken) throw err;
    }
  }

  if (!accessToken) {
    throw new Error('Codex accessToken 缺失或已失效，请重新授权');
  }
  if (!accountId) {
    throw new Error('Codex 凭证缺少 chatgpt_account_id，请重新导入有效的订阅凭证');
  }

  const endpoint = buildCodexResponsesEndpoint(codexConfig?.baseUrl);
  const enableThinking = options.enableThinking !== false;
  const effort = ['low', 'medium', 'high'].includes(String(reasoningEffort || '').toLowerCase())
    ? String(reasoningEffort).toLowerCase()
    : 'low';
  const bodyObj = {
    model: model || CODEX_DEFAULT_MODEL,
    store: false,
    stream: true,
    instructions: String(instructions || ''),
    input,
    text: { verbosity: 'low' },
    reasoning: enableThinking ? { effort, summary: 'auto' } : { effort }
  };
  const bodyJson = JSON.stringify(bodyObj);

  const sendCodexPost = async () => fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'chatgpt-account-id': accountId,
        'OpenAI-Beta': 'responses=experimental',
        originator: 'pi',
        accept: 'text/event-stream',
        'content-type': 'application/json'
      },
      body: bodyJson
    },
    options.timeoutMs ?? 60000,
    options.signal
  );

  let response = await sendCodexPost();

  if (response && response.status === 401 && refreshToken && !refreshedThisCall) {
    const nextCred = await refreshCodexToken(refreshToken, {
      accountId,
      email,
      planType,
      timeoutMs: options.timeoutMs,
      signal: options.signal
    });
    await applyRefreshedCred(nextCred);
    refreshedThisCall = true;
    response = await sendCodexPost();
  }

  const canStreamCodex = Boolean(
    response &&
      response.ok &&
      typeof options.onProgress === 'function' &&
      response.body &&
      typeof response.body.getReader === 'function'
  );

  let rawBody = '';
  let streamedResult = null;
  if (canStreamCodex) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const codexAcc = createCodexSseAccumulator({
      enableThinking,
      startedAt: options.startedAt || Date.now(),
      model: model || CODEX_DEFAULT_MODEL,
      onProgress: options.onProgress
    });
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
      if (chunk) {
        rawBody += chunk;
        codexAcc.feedChunk(chunk);
      }
    }
    const tail = decoder.decode();
    if (tail) {
      rawBody += tail;
      codexAcc.feedChunk(tail);
    }
    if (!rawBody.trim().startsWith('{')) {
      streamedResult = codexAcc.finish();
    }
  } else {
    rawBody = await readStreamOrTextBody(response);
  }

  if (!response || !response.ok) {
    let errMsg = '';
    if (rawBody) {
      try {
        const parsedErr = JSON.parse(rawBody);
        errMsg =
          parsedErr?.error?.message ||
          parsedErr?.detail ||
          parsedErr?.message ||
          '';
      } catch (_) {
        errMsg = rawBody.slice(0, 300);
      }
    }
    const err = new Error(errMsg || `Codex API HTTP ${response ? response.status : 'unknown'}`);
    if (response && typeof response.status === 'number') {
      err.status = response.status;
    }
    throw err;
  }

  const parseOpts = {
    includeReasoning: Boolean(options.includeReasoning),
    enableThinking,
    startedAt: options.startedAt,
    model: model || CODEX_DEFAULT_MODEL,
    onProgress: options.onProgress
  };

  if (options.includeReasoning) {
    const parsed = streamedResult || parseCodexSseOrJson(rawBody, parseOpts);
    if (!parsed.text) {
      throw new Error('Codex API 未返回有效内容');
    }
    return {
      text: parsed.text,
      reasoning: enableThinking ? (parsed.reasoning || '') : ''
    };
  }

  const textOut = streamedResult ? streamedResult.text : parseCodexSseOrJson(rawBody, parseOpts);
  if (!textOut) {
    throw new Error('Codex API 未返回有效内容');
  }
  return textOut;
}

/**
 * Translate text via OpenAI Codex Subscription Responses API (`chatgpt.com/backend-api/codex/responses`).
 */
export async function translateWithCodex(
  text,
  sourceLang = 'auto',
  targetLang = 'zh-CN',
  codexConfig = {},
  options = {}
) {
  const sl = normalizeLangCode(sourceLang, 'openai');
  const tl = normalizeTargetLang(targetLang);
  const model = String(options.model || codexConfig?.model || CODEX_DEFAULT_MODEL).trim();
  const reasoningEffort = String(options.reasoningEffort || codexConfig?.reasoningEffort || 'low').trim();

  const targetDesc = TARGET_LANG_LABELS[tl] || tl;
  const sourceDesc = sl === 'auto' ? 'any detected source language' : sl;
  const batchHint = options.isBatch
    ? ' Preserve all "\\n||||\\n" delimiters between segments verbatim and output the exact same number of segments.'
    : '';
  const scriptHint = getChineseScriptInstruction(tl);

  const instructions =
    `You are a professional web translator. Translate the user text accurately from ${sourceDesc} into ${targetDesc}. ` +
    `Preserve original formatting, numbers, and punctuation. Return ONLY the translated text without explanations or markdown quotes.${scriptHint}${batchHint}`;

  const translatedText = await executeCodexResponses({
    instructions,
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    ],
    model,
    reasoningEffort,
    codexConfig,
    options
  });

  return {
    translatedText,
    detectedSourceLang: sl === 'auto' ? detectLanguageLocally(text) : sl,
    engine: 'codex'
  };
}

// ============================================================================
// Public Unified Translation APIs
// ============================================================================

function parseSingleArgs(textOrOptions, maybeOptions = {}) {
  if (typeof textOrOptions === 'string') {
    return { text: textOrOptions, ...maybeOptions };
  }
  return textOrOptions && typeof textOrOptions === 'object' ? textOrOptions : {};
}

function parseBatchArgs(textsOrOptions, maybeOptions = {}) {
  if (Array.isArray(textsOrOptions)) {
    return { texts: textsOrOptions, ...maybeOptions };
  }
  return textsOrOptions && typeof textsOrOptions === 'object' ? textsOrOptions : {};
}

/**
 * Translate a single text string.
 * Accepts either `translateText({ text, sourceLang, targetLang, engine, openaiConfig, loomConfig })`
 * or `translateText(text, { sourceLang, targetLang, engine, openaiConfig, loomConfig })`.
 */
export async function translateText(textOrOptions, maybeOptions = {}) {
  const opts = parseSingleArgs(textOrOptions, maybeOptions);
  const text = typeof opts.text === 'string' ? opts.text : '';
  const sl = normalizeLangCode(opts.sourceLang || 'auto', 'google');
  const tl = normalizeTargetLang(opts.targetLang || 'zh-CN');
  const engine = opts.engine || 'google-free';
  const openaiConfig = opts.openaiConfig || opts.settings?.openaiConfig || {};
  const loomConfig = opts.loomConfig || opts.settings?.loomConfig || {};
  const codexConfig = opts.codexConfig || opts.settings?.codexConfig || {};
  const allowOfflineFallback = opts.allowOfflineFallback !== false;

  if (!text.trim()) {
    return {
      translatedText: text,
      detectedSourceLang: sl,
      engine
    };
  }

  const cacheKey = buildCacheKey(text, sl, tl, engine, openaiConfig, loomConfig, codexConfig);
  if (!opts.skipCache) {
    const cached = translationCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        translatedText: enforceTargetChineseScript(cached.translatedText, tl),
        fromCache: true
      };
    }
  }

  const finalizeResult = (res) => {
    const normalized = res && typeof res === 'object'
      ? { ...res, translatedText: enforceTargetChineseScript(res.translatedText, tl) }
      : res;
    if (normalized && normalized.engine !== 'offline-fallback') {
      translationCache.set(cacheKey, normalized);
    }
    return normalized;
  };

  if (engine === 'codex') {
    return finalizeResult(await translateWithCodex(text, sl, tl, codexConfig, opts));
  }

  if (engine === 'loom') {
    return finalizeResult(await translateWithLoom(text, sl, tl, loomConfig, opts));
  }

  if (engine === 'openai') {
    return finalizeResult(await translateWithOpenAI(text, sl, tl, openaiConfig, opts));
  }

  if (engine === 'mymemory') {
    try {
      return finalizeResult(await translateWithMyMemory(text, sl, tl, opts));
    } catch (err) {
      if (!allowOfflineFallback) throw err;
      return finalizeResult(translateOfflineFallback(text, sl, tl));
    }
  }

  // Primary: 'google-free' -> auto fallback to 'mymemory' -> offline fallback
  try {
    return finalizeResult(await translateWithGoogle(text, sl, tl, opts));
  } catch (googleErr) {
    try {
      return finalizeResult(await translateWithMyMemory(text, sl, tl, opts));
    } catch (myMemoryErr) {
      if (!allowOfflineFallback) {
        throw new Error(`Google (${googleErr.message}); MyMemory (${myMemoryErr.message})`);
      }
      return finalizeResult(translateOfflineFallback(text, sl, tl));
    }
  }
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  async function runWorker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await worker(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

function splitBatchTranslation(translatedCombined, expectedCount, options = {}) {
  if (typeof translatedCombined !== 'string') return null;

  let normalized = translatedCombined.trim();
  const fenceMatch = normalized.match(/^```[^\n]*\r?\n([\s\S]*?)\r?\n```$/);
  if (fenceMatch) {
    normalized = fenceMatch[1].trim();
  }

  let parts = normalized.split(BATCH_DELIMITER);
  if (parts.length !== expectedCount) {
    parts = normalized.split(/\r?\n?\s*\|{3,5}\s*\r?\n?/);
  }
  if (parts.length === expectedCount) {
    return parts.map((p) => p.trim());
  }

  if (options.allowLineFallback === true && expectedCount > 1 && !/\|{3,5}/.test(normalized)) {
    const sourceTexts = Array.isArray(options.sourceTexts) ? options.sourceTexts : null;
    const allSingleLine = !sourceTexts || (
      sourceTexts.length === expectedCount &&
      sourceTexts.every((s) => !/[\r\n]/.test(String(s ?? '')))
    );
    if (allSingleLine) {
      const lines = normalized.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === expectedCount) {
        return lines;
      }
    }
  }

  return null;
}

/**
 * Translate an array of strings with deduplication, delimiter batching,
 * LLM sub-batch fallback, concurrency-limited per-item fallback, and LRU caching.
 */
export async function translateBatch(textsOrOptions, maybeOptions = {}) {
  const opts = parseBatchArgs(textsOrOptions, maybeOptions);
  const rawTexts = Array.isArray(opts.texts) ? opts.texts : [];
  const sl = normalizeLangCode(opts.sourceLang || 'auto', 'google');
  const tl = normalizeTargetLang(opts.targetLang || 'zh-CN');
  const engine = opts.engine || 'google-free';
  const openaiConfig = opts.openaiConfig || opts.settings?.openaiConfig || {};
  const loomConfig = opts.loomConfig || opts.settings?.loomConfig || {};
  const rawCodexConfig = opts.codexConfig || opts.settings?.codexConfig || {};
  const codexConfig = rawCodexConfig && typeof rawCodexConfig === 'object' ? { ...rawCodexConfig } : {};
  const userOnTokenRefreshed = typeof opts.onTokenRefreshed === 'function' ? opts.onTokenRefreshed : null;
  const codexOpts = {
    ...opts,
    onTokenRefreshed: async (nextCred) => {
      Object.assign(codexConfig, nextCred);
      if (userOnTokenRefreshed) {
        await userOnTokenRefreshed(nextCred);
      }
    }
  };
  const allowOfflineFallback = opts.allowOfflineFallback !== false;
  const isLlmEngine = engine === 'loom' || engine === 'openai' || engine === 'codex';

  if (rawTexts.length === 0) {
    return {
      translations: [],
      detectedSourceLangs: [],
      engine
    };
  }

  const translations = new Array(rawTexts.length);
  const detectedSourceLangs = new Array(rawTexts.length);
  const uncachedIndices = [];
  let effectiveEngine = engine;

  for (let i = 0; i < rawTexts.length; i += 1) {
    const item = typeof rawTexts[i] === 'string' ? rawTexts[i] : String(rawTexts[i] ?? '');
    if (!item.trim()) {
      translations[i] = item;
      detectedSourceLangs[i] = sl;
      continue;
    }
    const key = buildCacheKey(item, sl, tl, engine, openaiConfig, loomConfig, codexConfig);
    const cached = !opts.skipCache ? translationCache.get(key) : undefined;
    if (cached) {
      translations[i] = enforceTargetChineseScript(cached.translatedText, tl);
      detectedSourceLangs[i] = cached.detectedSourceLang;
    } else {
      uncachedIndices.push(i);
    }
  }

  if (uncachedIndices.length === 0) {
    return {
      translations,
      detectedSourceLangs,
      engine: effectiveEngine
    };
  }

  // Deduplicate identical uncached texts within the same batch
  const groupMap = new Map();
  const uniqueGroups = [];
  for (const idx of uncachedIndices) {
    const text = typeof rawTexts[idx] === 'string' ? rawTexts[idx] : String(rawTexts[idx] ?? '');
    let group = groupMap.get(text);
    if (!group) {
      group = { text, indices: [idx] };
      groupMap.set(text, group);
      uniqueGroups.push(group);
    } else {
      group.indices.push(idx);
    }
  }

  const applyGroupResult = (group, translatedText, detectedSourceLang, usedEngine) => {
    const cleanText = enforceTargetChineseScript(String(translatedText ?? ''), tl);
    for (const idx of group.indices) {
      translations[idx] = cleanText;
      detectedSourceLangs[idx] = detectedSourceLang;
    }
    effectiveEngine = usedEngine;
    if (usedEngine !== 'offline-fallback') {
      translationCache.set(
        buildCacheKey(group.text, sl, tl, engine, openaiConfig, loomConfig, codexConfig),
        {
          translatedText: cleanText,
          detectedSourceLang,
          engine: usedEngine
        }
      );
    }
  };

  const translateSingleGroup = async (group) => {
    const res = await translateText({
      text: group.text,
      sourceLang: sl,
      targetLang: tl,
      engine,
      openaiConfig,
      loomConfig,
      codexConfig,
      onTokenRefreshed: codexOpts.onTokenRefreshed,
      allowOfflineFallback,
      signal: opts.signal,
      timeoutMs: opts.timeoutMs
    });
    applyGroupResult(group, res.translatedText, res.detectedSourceLang, res.engine);
  };

  const fallbackConcurrency = isLlmEngine ? LLM_FALLBACK_CONCURRENCY : FALLBACK_CONCURRENCY;

  if (uniqueGroups.length === 1 || engine === 'mymemory') {
    await runWithConcurrency(uniqueGroups, fallbackConcurrency, translateSingleGroup);
    return {
      translations,
      detectedSourceLangs,
      engine: effectiveEngine
    };
  }

  // Chunk unique groups by item count and length for safe delimiter batching
  const chunks = [];
  let currentChunk = [];
  let currentChars = 0;
  let hasInlineDelimiter = false;

  for (const group of uniqueGroups) {
    if (group.text.includes('||||')) {
      hasInlineDelimiter = true;
    }
    const approxLen = isLlmEngine ? group.text.length : encodeURIComponent(group.text).length;
    if (
      currentChunk.length >= DEFAULT_BATCH_SIZE ||
      (currentChunk.length > 0 && currentChars + approxLen > DEFAULT_BATCH_MAX_CHARS)
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }
    currentChunk.push(group);
    currentChars += approxLen;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  if (hasInlineDelimiter) {
    await runWithConcurrency(uniqueGroups, fallbackConcurrency, translateSingleGroup);
    return {
      translations,
      detectedSourceLangs,
      engine: effectiveEngine
    };
  }

  const tryDelimiterBatch = async (subChunk) => {
    const subTexts = subChunk.map((g) => g.text);
    const combined = subTexts.join(BATCH_DELIMITER);

    try {
      let batchRes;
      if (engine === 'codex') {
        batchRes = await translateWithCodex(combined, sl, tl, codexConfig, { ...codexOpts, isBatch: true });
      } else if (engine === 'loom') {
        batchRes = await translateWithLoom(combined, sl, tl, loomConfig, { ...opts, isBatch: true });
      } else if (engine === 'openai') {
        batchRes = await translateWithOpenAI(combined, sl, tl, openaiConfig, { ...opts, isBatch: true });
      } else {
        batchRes = await translateWithGoogle(combined, sl, tl, opts);
      }

      const parts = splitBatchTranslation(batchRes.translatedText, subChunk.length, {
        allowLineFallback: isLlmEngine,
        sourceTexts: subTexts
      });
      if (parts && parts.every((p, j) => p.length > 0 || !subTexts[j].trim())) {
        for (let j = 0; j < subChunk.length; j += 1) {
          const group = subChunk[j];
          const sourceText = subTexts[j];
          const translatedPart = parts[j];
          const localGuess = detectLanguageLocally(sourceText);
          const isDistinctScript = ['ja', 'ko', 'ar', 'ru', 'zh-CN', 'zh-TW'].includes(localGuess);
          const itemDetected = sl === 'auto'
            ? (isDistinctScript ? localGuess : (batchRes.detectedSourceLang && batchRes.detectedSourceLang !== 'auto' ? batchRes.detectedSourceLang : localGuess))
            : sl;
          applyGroupResult(group, translatedPart, itemDetected, batchRes.engine);
        }
        return true;
      }
      return false;
    } catch (err) {
      if (
        (err && err.code === 'LOCAL_CLIENTS_ONLY') ||
        (engine === 'loom' && !(loomConfig?.apiKey && String(loomConfig.apiKey).trim())) ||
        (engine === 'openai' && !(openaiConfig?.apiKey && String(openaiConfig.apiKey).trim())) ||
        (engine === 'codex' && !(codexConfig?.accessToken || codexConfig?.refreshToken))
      ) {
        throw err;
      }
      return false;
    }
  };

  const processBatchChunk = async (chunk) => {
    if (await tryDelimiterBatch(chunk)) {
      return;
    }

    if (isLlmEngine && chunk.length > 4) {
      for (let offset = 0; offset < chunk.length; offset += LLM_SUBBATCH_SIZE) {
        const subChunk = chunk.slice(offset, offset + LLM_SUBBATCH_SIZE);
        if (subChunk.length > 1 && (await tryDelimiterBatch(subChunk))) {
          continue;
        }
        await runWithConcurrency(subChunk, LLM_FALLBACK_CONCURRENCY, translateSingleGroup);
      }
      return;
    }

    await runWithConcurrency(chunk, fallbackConcurrency, translateSingleGroup);
  };

  for (const chunk of chunks) {
    await processBatchChunk(chunk);
  }

  return {
    translations,
    detectedSourceLangs,
    engine: effectiveEngine
  };
}

// ============================================================================
// Sider-Style AI Sidebar Chat, Page Summary, Explain & Writing Assistant
// ============================================================================

const MAX_CHAT_PAGE_CONTEXT_CHARS = 8000;
const MAX_CHAT_SELECTION_CHARS = 6000;
const MAX_CHAT_HISTORY_MESSAGES = 20;

const AI_TASK_INSTRUCTIONS = {
  chat: 'Answer questions and assist with web reading, comprehension, analysis, and writing accurately and concisely using Markdown when helpful.',
  summarize_page: 'Summarize the provided web page clearly in Markdown. Include a brief overview, main themes, and key takeaways.',
  key_takeaways: 'Extract 5 to 8 concise, high-signal key takeaways and key facts from the provided web page as a structured Markdown bullet list.',
  page_qa: 'Generate 4 to 6 insightful Q&A pairs based strictly on the provided web page context to help the reader grasp important concepts quickly.',
  explain: 'Explain the quoted or selected text clearly in accessible language, clarifying key terminology, context, and practical implications.',
  summarize: 'Concisely summarize the core meaning and essential details of the quoted or selected text using clear Markdown points.',
  polish: 'Rewrite and polish the provided text to improve clarity, flow, grammar, and professional tone while preserving original intent. Return the polished version clearly.',
  shorten: 'Condense and shorten the provided text significantly while keeping all essential information intact. Return the shortened version cleanly.',
  expand: 'Expand and enrich the provided text with clear elaboration, smooth transitions, and supporting detail while keeping the original intent.',
  grammar: 'Check and fix grammar, spelling, punctuation, and phrasing issues in the provided text. Present the corrected version clearly.',
  translate_en: 'Translate the provided text naturally, fluently, and accurately into English while preserving formatting and tone.',
  translate_zh: 'Translate the provided text naturally, fluently, and accurately into Chinese while preserving formatting and tone.'
};

const REWRITE_TASKS = new Set(['polish', 'shorten', 'expand', 'grammar']);

const MAX_CHAT_IMAGES = 4;
const MAX_CHAT_IMAGE_BYTES = 4 * 1024 * 1024;
const PAGE_IMAGE_ENABLED_TASKS = new Set(['chat', 'summarize_page', 'key_takeaways', 'page_qa']);

function extractChatReplyAndReasoning(data) {
  const message = data?.choices?.[0]?.message || data?.message || {};
  const choice = data?.choices?.[0] || {};
  const reasoningParts = [];
  const pushReasoning = (val) => {
    const clean = typeof val === 'string' ? val.trim() : '';
    if (clean && !reasoningParts.includes(clean)) {
      reasoningParts.push(clean);
    }
  };

  for (const field of [
    message.reasoning_content,
    message.reasoning,
    message.reasoning_text,
    message.thinking,
    message.reasoning_details,
    choice.reasoning_content,
    choice.reasoning
  ]) {
    const extracted = extractTextFromReasoningEntries(field);
    if (extracted) pushReasoning(extracted);
  }

  let reply = '';
  const rawContent = message.content;
  if (typeof rawContent === 'string') {
    let stripped = rawContent.replace(/<(think|thinking)>([\s\S]*?)<\/\1>/gi, (_, _tag, inner) => {
      if (inner && inner.trim()) {
        pushReasoning(inner);
      }
      return '';
    });
    // Handle models outputting unclosed <think>... when no closing tag exists
    if (/^<(think|thinking)>/i.test(stripped.trim()) && !/<\/(think|thinking)>/i.test(stripped)) {
      pushReasoning(stripped.replace(/^<(think|thinking)>/i, ''));
      stripped = '';
    }
    reply = stripped.trim();
  } else if (Array.isArray(rawContent)) {
    const replyParts = [];
    for (const part of rawContent) {
      if (!part) continue;
      if (typeof part === 'string') {
        replyParts.push(part);
        continue;
      }
      const pType = String(part.type || '').toLowerCase();
      if (pType === 'thinking' || pType === 'reasoning' || pType === 'reasoning_content') {
        const rText = part.thinking || part.reasoning || part.text || part.content || '';
        if (typeof rText === 'string') pushReasoning(rText);
      } else if (typeof part.text === 'string') {
        replyParts.push(part.text);
      } else if (typeof part.content === 'string') {
        replyParts.push(part.content);
      }
    }
    reply = replyParts.join('').trim();
  }

  return {
    reply,
    reasoning: reasoningParts.join('\n\n').trim()
  };
}

function extractChatReplyText(data) {
  return extractChatReplyAndReasoning(data).reply;
}

function isValidImageUrlOrData(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed) || /^https?:\/\//i.test(trimmed);
}

function normalizeChatImages(rawImages, maxCount = MAX_CHAT_IMAGES) {
  if (!Array.isArray(rawImages) || rawImages.length === 0) return [];
  const result = [];
  const seen = new Set();

  for (const item of rawImages) {
    if (result.length >= maxCount) break;
    if (!item) continue;
    const rawUrl = typeof item === 'string'
      ? item.trim()
      : (typeof item.url === 'string' ? item.url.trim() : '');
    const rawDataUrl = typeof item === 'object' && typeof item.dataUrl === 'string'
      ? item.dataUrl.trim()
      : '';
    const dataUrl = /^data:image\/[a-z0-9.+-]+;base64,/i.test(rawDataUrl)
      ? rawDataUrl
      : (/^data:image\/[a-z0-9.+-]+;base64,/i.test(rawUrl) ? rawUrl : '');
    const httpUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
    const dedupeKey = dataUrl ? dataUrl.slice(0, 128) : httpUrl;
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    if (!isValidImageUrlOrData(dataUrl || httpUrl)) continue;
    seen.add(dedupeKey);
    result.push({
      url: httpUrl || dataUrl,
      dataUrl,
      alt: typeof item === 'object' && typeof item.alt === 'string' ? item.alt.trim().slice(0, 140) : '',
      source: typeof item === 'object' && typeof item.source === 'string' ? item.source.trim() : ''
    });
  }

  return result;
}

function uint8ArrayToBase64(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) return '';
  if (typeof btoa === 'function') {
    const chunkSize = 0x8000;
    const parts = [];
    for (let i = 0; i < bytes.length; i += chunkSize) {
      parts.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
    }
    return btoa(parts.join(''));
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  return '';
}

function detectImageMimeType(contentTypeHeader, url, bytes) {
  const ct = String(contentTypeHeader || '').split(';')[0].trim().toLowerCase();
  if (ct.startsWith('text/html') || ct.startsWith('application/json') || ct.startsWith('text/plain')) {
    return '';
  }
  if (bytes && bytes.length >= 4) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return 'image/webp';
    }
  }
  if (ct.startsWith('image/')) {
    return ct === 'image/svg+xml' ? '' : ct;
  }
  const cleanUrl = String(url || '').toLowerCase();
  if (/\.png(?:\?|$)/.test(cleanUrl)) return 'image/png';
  if (/\.webp(?:\?|$)/.test(cleanUrl)) return 'image/webp';
  if (/\.gif(?:\?|$)/.test(cleanUrl)) return 'image/gif';
  return 'image/jpeg';
}

async function resolveSingleImageToDataUrl(img, options = {}) {
  if (img.dataUrl && /^data:image\/[a-z0-9.+-]+;base64,/i.test(img.dataUrl)) {
    return img.dataUrl;
  }
  if (img.url && /^data:image\/[a-z0-9.+-]+;base64,/i.test(img.url)) {
    return img.url;
  }
  if (!img.url || !/^https?:\/\//i.test(img.url) || options.resolveRemoteImages === false) {
    return img.url || '';
  }

  try {
    const response = await fetchWithTimeout(
      img.url,
      { method: 'GET' },
      Math.min(options.timeoutMs ?? 60000, 12000),
      options.signal
    );
    if (!response || !response.ok || typeof response.arrayBuffer !== 'function') {
      return img.url;
    }
    const contentType = response.headers && typeof response.headers.get === 'function'
      ? response.headers.get('content-type')
      : '';
    const buf = await response.arrayBuffer();
    if (!buf || buf.byteLength === 0 || buf.byteLength > MAX_CHAT_IMAGE_BYTES) {
      return img.url;
    }
    const bytes = new Uint8Array(buf);
    const mime = detectImageMimeType(contentType, img.url, bytes);
    if (!mime) {
      return img.url;
    }
    const base64 = uint8ArrayToBase64(bytes);
    return base64 ? `data:${mime};base64,${base64}` : img.url;
  } catch (_) {
    return img.url;
  }
}

async function resolveChatImagesForApi(images, options = {}) {
  const normalized = normalizeChatImages(images, MAX_CHAT_IMAGES);
  if (normalized.length === 0) return [];
  const resolvedUrls = await Promise.all(
    normalized.map((img) => resolveSingleImageToDataUrl(img, options))
  );
  return normalized
    .map((img, idx) => ({
      ...img,
      resolvedUrl: resolvedUrls[idx] || img.dataUrl || img.url
    }))
    .filter((img) => Boolean(img.resolvedUrl));
}

function buildMultimodalChatMessages(llmMessages, activeImages = []) {
  const lastUserIdx = (() => {
    for (let i = llmMessages.length - 1; i >= 0; i--) {
      if (llmMessages[i]?.role === 'user') return i;
    }
    return -1;
  })();

  return llmMessages.map((msg, idx) => {
    if (msg.role !== 'user') {
      return { role: msg.role, content: msg.content };
    }
    const msgImgs = idx === lastUserIdx
      ? activeImages
      : normalizeChatImages(msg.images, MAX_CHAT_IMAGES).map((it) => ({
          ...it,
          resolvedUrl: it.dataUrl || it.url
        }));
    if (!msgImgs || msgImgs.length === 0) {
      return { role: msg.role, content: msg.content };
    }
    return {
      role: 'user',
      content: [
        { type: 'text', text: msg.content },
        ...msgImgs.map((it) => ({
          type: 'image_url',
          image_url: { url: it.resolvedUrl }
        }))
      ]
    };
  });
}

function buildCodexMultimodalInput(llmMessages, activeImages = []) {
  const lastUserIdx = (() => {
    for (let i = llmMessages.length - 1; i >= 0; i--) {
      if (llmMessages[i]?.role === 'user') return i;
    }
    return -1;
  })();

  return llmMessages.slice(1).map((msg, sliceIdx) => {
    const originalIdx = sliceIdx + 1;
    if (msg.role === 'assistant') {
      return {
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: msg.content }]
      };
    }
    const msgImgs = originalIdx === lastUserIdx
      ? activeImages
      : normalizeChatImages(msg.images, MAX_CHAT_IMAGES).map((it) => ({
          ...it,
          resolvedUrl: it.dataUrl || it.url
        }));
    const content = [{ type: 'input_text', text: msg.content }];
    for (const it of msgImgs) {
      if (it.resolvedUrl) {
        content.push({
          type: 'input_image',
          detail: 'auto',
          image_url: it.resolvedUrl
        });
      }
    }
    return {
      role: 'user',
      content
    };
  });
}

function buildDefaultTaskPrompt(taskType, selectionText, pageTitle, targetLang) {
  const isEn = targetLang === 'en';
  const quoted = selectionText ? `\n\n"""\n${selectionText}\n"""` : '';

  switch (taskType) {
    case 'summarize_page':
      return isEn
        ? `Please summarize the current web page${pageTitle ? ` "${pageTitle}"` : ''}.`
        : `请总结当前网页${pageTitle ? `《${pageTitle}》` : ''}的核心内容。`;
    case 'key_takeaways':
      return isEn
        ? `Please extract the key takeaways from the current web page${pageTitle ? ` "${pageTitle}"` : ''}.`
        : `请提炼当前网页${pageTitle ? `《${pageTitle}》` : ''}的核心要点。`;
    case 'page_qa':
      return isEn
        ? `Please generate key Q&A pairs based on the current web page${pageTitle ? ` "${pageTitle}"` : ''}.`
        : `请基于当前网页${pageTitle ? `《${pageTitle}》` : ''}生成关键问答。`;
    case 'explain':
      return isEn
        ? `Please explain the following text clearly:${quoted}`
        : `请用清晰易懂的语言解释以下内容：${quoted}`;
    case 'summarize':
      return isEn
        ? `Please concisely summarize the following text:${quoted}`
        : `请简洁总结以下内容的核心要点：${quoted}`;
    case 'polish':
      return isEn
        ? `Please polish the following text:${quoted}`
        : `请润色优化以下文本表达：${quoted}`;
    case 'shorten':
      return isEn
        ? `Please condense and shorten the following text:${quoted}`
        : `请保留核心意思并精简缩写以下文本：${quoted}`;
    case 'expand':
      return isEn
        ? `Please expand and enrich the following text:${quoted}`
        : `请扩写并丰富以下文本内容：${quoted}`;
    case 'grammar':
      return isEn
        ? `Please check and fix grammar and spelling in the following text:${quoted}`
        : `请检查并修正以下文本的语法、拼写与标点错误：${quoted}`;
    case 'translate_en':
      return `Please translate the following text into natural English:${quoted}`;
    case 'translate_zh':
      return targetLang === 'zh-TW'
        ? `請將以下文本自然流暢地翻譯為繁體中文：${quoted}`
        : `请将以下文本自然流畅地翻译为简体中文：${quoted}`;
    default:
      if (quoted) {
        return isEn ? `Please help me analyze this text:${quoted}` : `请结合以下内容提供帮助：${quoted}`;
      }
      return isEn ? 'Please help me understand the current web page.' : '请结合当前网页上下文为我提供阅读帮助。';
  }
}

function buildChatSystemAndMessages(options, targetLang) {
  const taskType = typeof options.taskType === 'string' && options.taskType.trim()
    ? options.taskType.trim()
    : 'chat';
  const taskInstruction = AI_TASK_INSTRUCTIONS[taskType] || AI_TASK_INSTRUCTIONS.chat;
  const zhVariantLabel = targetLang === 'zh-TW'
    ? TARGET_LANG_LABELS['zh-TW']
    : TARGET_LANG_LABELS['zh-CN'];
  const targetDesc = TARGET_LANG_LABELS[targetLang] || TARGET_LANG_LABELS['zh-CN'];

  let languageDirective = `Respond in ${targetDesc}.`;
  if (taskType === 'translate_en') {
    languageDirective = 'Output the translation in natural English.';
  } else if (taskType === 'translate_zh') {
    languageDirective = `Output the translation in natural ${zhVariantLabel}.`;
  } else if (REWRITE_TASKS.has(taskType)) {
    languageDirective = `Keep the rewritten text in the same language as the source text unless instructed otherwise; if adding brief notes, write notes in ${targetDesc}.`;
  }

  const systemParts = [
    'You are Gloss AI, a helpful bilingual sidebar reading, summary, and writing assistant.',
    `Task focus (${taskType}): ${taskInstruction}`,
    languageDirective
  ];

  const pageContext = options.pageContext && typeof options.pageContext === 'object'
    ? options.pageContext
    : null;
  const pageTitle = typeof pageContext?.title === 'string' ? pageContext.title.trim() : '';
  const pageUrl = typeof pageContext?.url === 'string' ? pageContext.url.trim() : '';
  const rawPageContent = typeof pageContext?.content === 'string' ? pageContext.content.trim() : '';
  const safePageContent = rawPageContent.length > MAX_CHAT_PAGE_CONTEXT_CHARS
    ? `${rawPageContent.slice(0, MAX_CHAT_PAGE_CONTEXT_CHARS)}\n...(truncated)`
    : rawPageContent;

  if (pageTitle || pageUrl || safePageContent) {
    const pageBlock = [
      '[Current Web Page Context]',
      pageTitle ? `Title: ${pageTitle}` : '',
      pageUrl ? `URL: ${pageUrl}` : '',
      safePageContent ? `Content:\n${safePageContent}` : ''
    ].filter(Boolean).join('\n');
    systemParts.push(pageBlock);
  }

  const selectionText = typeof options.selectionText === 'string'
    ? options.selectionText.trim().slice(0, MAX_CHAT_SELECTION_CHARS)
    : '';
  if (selectionText) {
    systemParts.push(`[Quoted Selection Context]\n"""\n${selectionText}\n"""`);
  }

  const historyMsgs = [];
  if (Array.isArray(options.messages)) {
    for (const msg of options.messages) {
      if (!msg || typeof msg !== 'object') continue;
      const role = msg.role === 'assistant' ? 'assistant' : (msg.role === 'user' ? 'user' : null);
      const content = typeof msg.content === 'string' ? msg.content.trim() : '';
      const msgImages = role === 'user' ? normalizeChatImages(msg.images, MAX_CHAT_IMAGES) : [];
      if (role && (content || msgImages.length > 0)) {
        const entry = {
          role,
          content: content || '请结合图片内容分析并回答。'
        };
        if (msgImages.length > 0) {
          entry.images = msgImages;
        }
        historyMsgs.push(entry);
      }
    }
  }
  const trimmedHistory = historyMsgs.slice(-MAX_CHAT_HISTORY_MESSAGES);

  const userImages = normalizeChatImages(options.images, MAX_CHAT_IMAGES);
  const pageImages = pageContext && PAGE_IMAGE_ENABLED_TASKS.has(taskType)
    ? normalizeChatImages(pageContext.images, MAX_CHAT_IMAGES)
    : [];
  const activeImages = normalizeChatImages([...userImages, ...pageImages], MAX_CHAT_IMAGES);

  const promptText = typeof options.prompt === 'string' ? options.prompt.trim() : '';
  if (promptText) {
    const last = trimmedHistory[trimmedHistory.length - 1];
    if (!last || last.role !== 'user' || last.content !== promptText) {
      trimmedHistory.push({ role: 'user', content: promptText });
    }
  } else if (trimmedHistory.length === 0) {
    const defaultPrompt = activeImages.length > 0 && taskType === 'chat'
      ? (targetLang === 'en'
          ? 'Please analyze and explain the attached image(s) carefully.'
          : '请结合图片内容进行详细解读和分析。')
      : buildDefaultTaskPrompt(taskType, selectionText, pageTitle, targetLang);
    trimmedHistory.push({
      role: 'user',
      content: defaultPrompt
    });
  }

  return {
    taskType,
    pageTitle,
    pageUrl,
    rawPageContent,
    selectionText,
    promptText,
    activeImages,
    llmMessages: [
      { role: 'system', content: systemParts.join('\n\n') },
      ...trimmedHistory
    ]
  };
}

function extractKeySentences(text, maxCount = 5) {
  if (!text || typeof text !== 'string') return [];
  const rawChunks = text
    .split(/\r?\n+|(?<=[。！？.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 12);

  const seen = new Set();
  const picked = [];
  for (const chunk of rawChunks) {
    const norm = chunk.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    picked.push(chunk.length > 220 ? `${chunk.slice(0, 217)}...` : chunk);
    if (picked.length >= maxCount) break;
  }

  if (picked.length === 0) {
    const compact = text.replace(/\s+/g, ' ').trim();
    if (compact) picked.push(compact.slice(0, 220));
  }
  return picked;
}

function tidyTextDraft(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:!?，。；：！？])/g, '$1')
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, ch) => `${prefix}${ch.toUpperCase()}`)
    .trim();
}

async function buildFallbackChatReply(ctx, targetLang, engineName, options = {}) {
  const safeTranslate = async (text, destLang = targetLang) => {
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) return '';
    try {
      const res = await translateText({
        text: clean,
        sourceLang: 'auto',
        targetLang: destLang,
        engine: engineName,
        allowOfflineFallback: true,
        timeoutMs: options.timeoutMs,
        signal: options.signal
      });
      return (res && res.translatedText) || clean;
    } catch (_) {
      return translateOfflineFallback(clean, 'auto', destLang).translatedText;
    }
  };

  const safeBatchTranslate = async (items, destLang = targetLang) => {
    const cleanItems = items.map((s) => String(s || '').trim()).filter(Boolean);
    if (cleanItems.length === 0) return [];
    try {
      const res = await translateBatch({
        texts: cleanItems,
        sourceLang: 'auto',
        targetLang: destLang,
        engine: engineName,
        allowOfflineFallback: true,
        timeoutMs: options.timeoutMs,
        signal: options.signal
      });
      return Array.isArray(res?.translations) ? res.translations : cleanItems;
    } catch (_) {
      return cleanItems.map((item) => translateOfflineFallback(item, 'auto', destLang).translatedText);
    }
  };

  const { taskType, pageTitle, rawPageContent, selectionText, promptText, llmMessages } = ctx;
  const isEn = targetLang === 'en';
  const lastUserMsg = [...llmMessages].reverse().find((m) => m.role === 'user')?.content || '';
  const sourceFocus = selectionText || promptText || lastUserMsg;

  if (taskType === 'translate_en') {
    const translated = await safeTranslate(selectionText || promptText || rawPageContent.slice(0, 1200), 'en');
    return translated || '[Fallback] No input text provided.';
  }

  if (taskType === 'translate_zh') {
    const zhLang = targetLang === 'zh-TW' ? 'zh-TW' : 'zh-CN';
    const translated = await safeTranslate(selectionText || promptText || rawPageContent.slice(0, 1200), zhLang);
    return translated || '[降级模式] 未提供待翻译文本。';
  }

  if (taskType === 'summarize_page' || taskType === 'key_takeaways' || taskType === 'page_qa') {
    const corpus = rawPageContent || selectionText || promptText;
    const keyPoints = extractKeySentences(corpus, taskType === 'key_takeaways' ? 6 : 5);
    const titleLabel = pageTitle || (isEn ? 'Current Web Page' : '当前网页');
    const translatedInputs = pageTitle ? [pageTitle, ...keyPoints] : keyPoints;
    const translatedList = await safeBatchTranslate(translatedInputs, targetLang);
    const displayTitle = pageTitle ? (translatedList[0] || pageTitle) : titleLabel;
    const translatedPoints = pageTitle ? translatedList.slice(1) : translatedList;

    if (taskType === 'key_takeaways') {
      const header = isEn ? `### 💡 Key Takeaways: ${displayTitle}` : `### 💡 核心要点：${displayTitle}`;
      const bullets = translatedPoints.length > 0
        ? translatedPoints.map((pt) => `- ${pt}`).join('\n')
        : (isEn ? '- No readable text detected on this page.' : '- 当前网页暂未提取到足够的文本要点。');
      const tip = isEn
        ? '\n\n> Tip: Configure a Loom or OpenAI key in Settings for deep AI synthesis.'
        : '\n\n> 提示：当前处于免费/离线智能摘要降级模式，配置 Loom 或 OpenAI Key 可获得深度推理总结。';
      return `${header}\n\n${bullets}${tip}`;
    }

    if (taskType === 'page_qa') {
      const header = isEn ? `### ❓ Key Q&A: ${displayTitle}` : `### ❓ 关键问答：${displayTitle}`;
      const qaItems = [];
      for (let i = 0; i < Math.min(3, translatedPoints.length); i += 1) {
        if (isEn) {
          qaItems.push(`- **Q${i + 1}: What does "${displayTitle}" highlight regarding point ${i + 1}?**\n  **A${i + 1}:** ${translatedPoints[i]}`);
        } else {
          qaItems.push(`- **Q${i + 1}：关于《${displayTitle}》的第 ${i + 1} 项重点内容是什么？**\n  **A${i + 1}：** ${translatedPoints[i]}`);
        }
      }
      if (qaItems.length === 0) {
        qaItems.push(isEn ? '- **Q1:** What is this page about?\n  **A1:** Not enough readable content extracted.' : '- **Q1：本页主要介绍什么内容？**\n  **A1：** 暂未提取到足够的正文内容。');
      }
      return `${header}\n\n${qaItems.join('\n')}`;
    }

    const header = isEn ? `### 📄 Page Summary: ${displayTitle}` : `### 📄 网页摘要：${displayTitle}`;
    const overview = translatedPoints[0] || (isEn ? `Summary for ${displayTitle}.` : `《${displayTitle}》的内容概览。`);
    const bullets = translatedPoints.slice(0, 5).map((pt) => `- ${pt}`).join('\n');
    const note = isEn
      ? '\n\n> Tip: Connect Loom or OpenAI in Settings for full LLM summarization.'
      : '\n\n> 提示：当前由免费翻译与要点提取生成；在设置中配置 Loom 或 OpenAI Key 可解锁完整大模型总结。';
    return `${header}\n\n${overview}${bullets ? `\n\n${bullets}` : ''}${note}`;
  }

  if (taskType === 'explain' || taskType === 'summarize') {
    const snippet = (selectionText || promptText || rawPageContent.slice(0, 800)).trim();
    const detected = detectLanguageLocally(snippet);
    const translated = await safeTranslate(snippet.slice(0, 1000), targetLang);
    const heading = taskType === 'summarize'
      ? (isEn ? '### 📝 Selection Summary' : '### 📝 文本总结')
      : (isEn ? '### ✨ Plain Explanation' : '### ✨ 内容解释');
    const points = extractKeySentences(translated || snippet, 3);
    const bullets = points.map((p) => `- ${p}`).join('\n');
    return `${heading}\n\n${translated}\n\n${bullets ? `${isEn ? '**Key Points:**' : '**核心信息：**'}\n${bullets}\n\n` : ''}> ${isEn ? `Detected source: ${detected}` : `识别原文语言：${detected}（免费降级模式）`}`;
  }

  if (REWRITE_TASKS.has(taskType)) {
    const cleanInput = (selectionText || promptText || '').trim();
    const tidied = tidyTextDraft(cleanInput);
    if (taskType === 'shorten') {
      const clauses = extractKeySentences(tidied, 2);
      const shortened = clauses.join(' ') || tidied.slice(0, 140);
      const translatedRef = await safeTranslate(shortened, targetLang);
      return isEn
        ? `**Shortened Version:**\n\n${shortened}${translatedRef && translatedRef !== shortened ? `\n\n**Reference:** ${translatedRef}` : ''}`
        : `**精简结果：**\n\n${shortened}${translatedRef && translatedRef !== shortened ? `\n\n**参考译文：** ${translatedRef}` : ''}`;
    }
    if (taskType === 'grammar') {
      const translatedRef = await safeTranslate(tidied, targetLang);
      return isEn
        ? `**Checked & Corrected:**\n\n${tidied}${translatedRef && translatedRef !== tidied ? `\n\n**Meaning Check:** ${translatedRef}` : ''}`
        : `**语法与格式修正建议：**\n\n${tidied}${translatedRef && translatedRef !== tidied ? `\n\n**语义对照：** ${translatedRef}` : ''}`;
    }
    if (taskType === 'expand') {
      const translatedRef = await safeTranslate(tidied, targetLang);
      return isEn
        ? `**Expanded Draft:**\n\n${tidied}\n\nIn detail, this highlights the core point above and can be elaborated further when connected to Loom or OpenAI.\n\n**Reference:** ${translatedRef}`
        : `**扩写建议：**\n\n${tidied}\n\n进一步展开而言，上述表达围绕核心主题进行了说明；配置 Loom 或 OpenAI Key 后可生成更丰富的上下文扩写。\n\n**参考表达：** ${translatedRef}`;
    }
    const translatedRef = await safeTranslate(tidied, targetLang);
    return isEn
      ? `**Polished Draft:**\n\n${tidied}${translatedRef && translatedRef !== tidied ? `\n\n**Reference:** ${translatedRef}` : ''}`
      : `**润色建议：**\n\n${tidied}${translatedRef && translatedRef !== tidied ? `\n\n**参考译文：** ${translatedRef}` : ''}`;
  }

  // General 'chat' fallback: find matching context sentences + translate concisely
  const query = (promptText || lastUserMsg || selectionText || '').trim();
  const corpus = selectionText || rawPageContent;
  const queryTokens = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
  const candidates = extractKeySentences(corpus, 8);
  const ranked = candidates
    .map((sent) => {
      const lower = sent.toLowerCase();
      let score = 0;
      for (const tok of queryTokens) {
        if (lower.includes(tok)) score += 1;
      }
      return { sent, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.sent);

  const toTranslate = [
    selectionText ? selectionText.slice(0, 600) : '',
    ...ranked
  ].filter(Boolean);

  if (toTranslate.length > 0) {
    const translatedSnippets = await safeBatchTranslate(toTranslate, targetLang);
    const intro = isEn
      ? `### 💬 Gloss Assistant (Free Fallback)`
      : `### 💬 Gloss 智能助手（免费/离线降级）`;
    const body = translatedSnippets.map((s) => `- ${s}`).join('\n');
    const footer = isEn
      ? '\n\n> Tip: Configure a Loom or OpenAI API key in Settings for full multi-turn LLM chat.'
      : '\n\n> 提示：当前未配置大模型 API Key，以上基于页面上下文与翻译引擎生成；在设置中配置 Loom 或 OpenAI Key 可启用完整 AI 对话。';
    return `${intro}\n\n${body}${footer}`;
  }

  const translatedQuery = sourceFocus ? await safeTranslate(sourceFocus.slice(0, 600), targetLang) : '';
  return isEn
    ? `I am ready to help in fallback mode.${translatedQuery ? `\n\nTranslated note: ${translatedQuery}` : ''}\n\n> Configure Loom or OpenAI in Settings for full conversational AI.`
    : `已收到您的提问（当前处于免费/离线降级模式）。${translatedQuery ? `\n\n**内容理解/参考：** ${translatedQuery}` : ''}\n\n> 在设置中配置 Loom (` + '`hub.key`' + `) 或 OpenAI Key 后即可开启完整多轮 AI 对话。`;
}

/**
 * Sider-style AI assistant chat / page summary / writing helper.
 * Routes to Loom (`POST /chat/completions` + fast params + HTTP 400 fallback),
 * OpenAI Chat Completions, or smart local/free fallback without uncaught errors.
 */
export async function chatWithAI(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const targetLang = normalizeTargetLang(opts.targetLang || 'zh-CN');
  const requestedEngine = typeof opts.engine === 'string' && opts.engine.trim()
    ? opts.engine.trim()
    : 'google-free';
  const loomConfig = opts.loomConfig || opts.settings?.loomConfig || {};
  const openaiConfig = opts.openaiConfig || opts.settings?.openaiConfig || {};
  const codexConfig = opts.codexConfig || opts.settings?.codexConfig || {};
  const loomKey = typeof loomConfig?.apiKey === 'string' ? loomConfig.apiKey.trim() : '';
  const openaiKey = typeof openaiConfig?.apiKey === 'string' ? openaiConfig.apiKey.trim() : '';
  const hasCodexAuth = Boolean(
    (codexConfig?.accessToken && String(codexConfig.accessToken).trim()) ||
    (codexConfig?.refreshToken && String(codexConfig.refreshToken).trim())
  );
  const forceFallback = opts.forceFallback === true || opts.offline === true;
  const enableThinking = opts.enableThinking !== false;
  const defaultTimeoutMs = enableThinking ? 120000 : 60000;
  const effectiveTimeoutMs = opts.timeoutMs ?? defaultTimeoutMs;
  const wantStream = Boolean(opts.stream);
  const startedAt = Date.now();

  const ctx = buildChatSystemAndMessages(opts, targetLang);

  const shouldUseCodex = !forceFallback && requestedEngine === 'codex' && hasCodexAuth;
  const shouldUseOpenAI = !forceFallback && requestedEngine === 'openai' && Boolean(openaiKey);
  const shouldUseLoom = !forceFallback && !shouldUseCodex && !shouldUseOpenAI && (
    (requestedEngine === 'loom' && Boolean(loomKey)) ||
    (Boolean(loomKey) && requestedEngine !== 'openai' && requestedEngine !== 'codex')
  );

  const resolvedImages = !forceFallback && (shouldUseCodex || shouldUseOpenAI || shouldUseLoom) && ctx.activeImages.length > 0
    ? await resolveChatImagesForApi(ctx.activeImages, {
        timeoutMs: effectiveTimeoutMs,
        signal: opts.signal,
        resolveRemoteImages: opts.resolveRemoteImages
      })
    : [];

  const textOnlyMessages = ctx.llmMessages.map((msg) => ({
    role: msg.role,
    content: msg.content
  }));
  const multimodalMessages = resolvedImages.length > 0 || textOnlyMessages.length !== ctx.llmMessages.length ||
    ctx.llmMessages.some((m) => Array.isArray(m.images) && m.images.length > 0)
    ? buildMultimodalChatMessages(ctx.llmMessages, resolvedImages)
    : textOnlyMessages;
  const hasAnyMessageImages = multimodalMessages.some((msg) => Array.isArray(msg.content));
  const imageFallbackNote = targetLang === 'en'
    ? '\n\n> Note: The current model appears not to support image input and automatically fell back to text-only mode. Switch to Kimi K3.1 Pro, OpenAI, or Codex vision models to analyze images.'
    : '\n\n> 提示：当前模型暂不支持图片输入，已自动降级为纯文本回答；如需识别图片，建议切换至 Kimi K3.1 Pro、OpenAI 或 Codex 视觉模型。';

  if (shouldUseCodex) {
    const model = String(opts.model || codexConfig?.model || CODEX_DEFAULT_MODEL).trim();
    const reasoningEffort = String(opts.reasoningEffort || codexConfig?.reasoningEffort || 'low').trim();
    const instructions = ctx.llmMessages[0]?.content || '';
    const multimodalInput = buildCodexMultimodalInput(ctx.llmMessages, resolvedImages);
    const hasCodexImages = multimodalInput.some(
      (item) => Array.isArray(item.content) && item.content.some((part) => part?.type === 'input_image')
    );

    let parsed;
    let usedImageFallback = false;
    try {
      parsed = await executeCodexResponses({
        instructions,
        input: multimodalInput,
        model,
        reasoningEffort,
        codexConfig,
        options: {
          ...opts,
          timeoutMs: effectiveTimeoutMs,
          startedAt,
          enableThinking,
          includeReasoning: true,
          onProgress: opts.onProgress
        }
      });
    } catch (err) {
      const status = err?.status;
      if (
        hasCodexImages &&
        (status === 400 || status === 415 || status === 422 || /image|input_image|multimodal|unsupported/i.test(err?.message || ''))
      ) {
        usedImageFallback = true;
        parsed = await executeCodexResponses({
          instructions,
          input: buildCodexMultimodalInput(textOnlyMessages, []),
          model,
          reasoningEffort,
          codexConfig,
          options: {
            ...opts,
            timeoutMs: effectiveTimeoutMs,
            startedAt,
            enableThinking,
            includeReasoning: true,
            onProgress: opts.onProgress
          }
        });
      } else {
        throw err;
      }
    }

    const reasoning = enableThinking ? (parsed.reasoning || '') : '';
    const reply = usedImageFallback ? `${parsed.text}${imageFallbackNote}` : parsed.text;
    return {
      reply,
      reasoning,
      thinkingMs: reasoning ? Math.max(0, Date.now() - startedAt) : 0,
      imageCount: usedImageFallback ? 0 : (hasCodexImages ? resolvedImages.length : 0),
      model,
      engine: 'codex'
    };
  }

  if (shouldUseLoom) {
    const baseUrl = String(loomConfig?.baseUrl || 'http://127.0.0.1:4319/v1').trim().replace(/\/+$/, '');
    const model = String(opts.model || loomConfig?.model || 'zenmux/anthropic/claude-sonnet-5.5').trim();
    const endpoint = `${baseUrl}/chat/completions`;
    const timeoutMs = effectiveTimeoutMs;

    const allowTemp = !/(?:kimi|k3|\bo[134](?:-|\b)|gpt-5)/i.test(model);
    const minimalPayload = {
      model,
      messages: multimodalMessages,
      ...(wantStream ? { stream: true } : {})
    };
    const basePayload = allowTemp
      ? { ...minimalPayload, temperature: 0.3 }
      : minimalPayload;
    const fastParams = enableThinking ? {} : buildLoomFastParams(model);
    const hasFastParams = Object.keys(fastParams).length > 0;
    const requestPayload = hasFastParams ? { ...basePayload, ...fastParams } : basePayload;
    const streamOpts = {
      stream: wantStream,
      enableThinking,
      startedAt,
      model,
      engine: 'loom',
      onProgress: opts.onProgress
    };

    let { response, rawText, data } = await postLoomChat(
      endpoint,
      loomKey,
      requestPayload,
      timeoutMs,
      opts.signal,
      streamOpts
    );

    if (response && response.status === 400 && (hasFastParams || allowTemp)) {
      ({ response, rawText, data } = await postLoomChat(
        endpoint,
        loomKey,
        minimalPayload,
        timeoutMs,
        opts.signal,
        streamOpts
      ));
    }

    let usedImageFallback = false;
    if (
      response &&
      (response.status === 400 || response.status === 415 || response.status === 422) &&
      hasAnyMessageImages
    ) {
      usedImageFallback = true;
      const textOnlyPayload = {
        model,
        messages: textOnlyMessages,
        ...(wantStream ? { stream: true } : {}),
        ...(hasFastParams ? fastParams : {})
      };
      ({ response, rawText, data } = await postLoomChat(
        endpoint,
        loomKey,
        textOnlyPayload,
        timeoutMs,
        opts.signal,
        streamOpts
      ));
    }

    if (response && response.status === 403 && rawText.includes('LOCAL_CLIENTS_ONLY')) {
      const err = new Error(
        'Loom 网关拦截了浏览器扩展的 POST 请求 (403 LOCAL_CLIENTS_ONLY：Chrome 发送 POST 时会自动附带 Origin: chrome-extension://... 请求头，被 Loom gateway.rs 拦截)'
      );
      err.code = 'LOCAL_CLIENTS_ONLY';
      throw err;
    }

    if (!response || !response.ok) {
      const errMsg = data?.error?.message || `Loom API HTTP ${response ? response.status : 'unknown'}`;
      throw new Error(errMsg);
    }

    const parsed = extractChatReplyAndReasoning(data);
    if (!parsed.reply) {
      throw new Error('Loom API 未返回有效回复');
    }

    const reasoning = enableThinking ? (parsed.reasoning || '') : '';
    const reply = usedImageFallback ? `${parsed.reply}${imageFallbackNote}` : parsed.reply;
    return {
      reply,
      reasoning,
      thinkingMs: reasoning ? Math.max(0, Date.now() - startedAt) : 0,
      imageCount: usedImageFallback ? 0 : resolvedImages.length,
      model,
      engine: 'loom'
    };
  }

  if (shouldUseOpenAI) {
    const apiUrl = String(openaiConfig?.apiUrl || 'https://api.openai.com/v1/chat/completions').trim();
    const model = String(opts.model || openaiConfig?.model || 'gpt-4o-mini').trim();
    const timeoutMs = effectiveTimeoutMs;

    const postOpenAI = async (messagesPayload) => {
      const response = await fetchWithTimeout(
        apiUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            messages: messagesPayload,
            ...(wantStream ? { stream: true } : {})
          })
        },
        timeoutMs,
        opts.signal
      );

      return consumeOpenAiChatResponse(response, {
        stream: wantStream,
        enableThinking,
        startedAt,
        model,
        engine: 'openai',
        onProgress: opts.onProgress
      });
    };

    let { response, data } = await postOpenAI(multimodalMessages);
    let usedImageFallback = false;
    if (
      response &&
      (response.status === 400 || response.status === 415 || response.status === 422) &&
      hasAnyMessageImages
    ) {
      usedImageFallback = true;
      ({ response, data } = await postOpenAI(textOnlyMessages));
    }

    if (!response || !response.ok) {
      const errMsg = data?.error?.message || `OpenAI API HTTP ${response ? response.status : 'unknown'}`;
      throw new Error(errMsg);
    }

    const parsed = extractChatReplyAndReasoning(data);
    if (!parsed.reply) {
      throw new Error('OpenAI API 未返回有效回复');
    }

    const reasoning = enableThinking ? (parsed.reasoning || '') : '';
    const reply = usedImageFallback ? `${parsed.reply}${imageFallbackNote}` : parsed.reply;
    return {
      reply,
      reasoning,
      thinkingMs: reasoning ? Math.max(0, Date.now() - startedAt) : 0,
      imageCount: usedImageFallback ? 0 : resolvedImages.length,
      model,
      engine: 'openai'
    };
  }

  const fallbackEngine = (requestedEngine === 'mymemory' || requestedEngine === 'google-free')
    ? requestedEngine
    : 'google-free';
  let reply = await buildFallbackChatReply(ctx, targetLang, fallbackEngine, opts);
  if (ctx.activeImages.length > 0) {
    const imgNote = targetLang === 'en'
      ? `\n\n> Detected ${ctx.activeImages.length} image(s); image understanding requires Loom (e.g. Kimi K3.1 Pro), OpenAI, or Codex.`
      : `\n\n> 检测到 ${ctx.activeImages.length} 张图片，图片识图需配置并切换至 Loom（如 Kimi K3.1 Pro）、OpenAI 或 Codex 引擎。`;
    reply = `${reply}${imgNote}`;
  }
  return {
    reply,
    reasoning: '',
    thinkingMs: 0,
    imageCount: 0,
    model: fallbackEngine,
    engine: fallbackEngine,
    fallback: true
  };
}
