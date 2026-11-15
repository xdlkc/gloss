(function (global) {
  'use strict';

  const WTContent = (global.WTContent = global.WTContent || {});

  const BLOCK_SELECTOR =
    'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dd, dt, summary';

  const SKIP_SELECTOR = [
    'script',
    'style',
    'noscript',
    'pre',
    'code',
    'kbd',
    'samp',
    'var',
    'svg',
    'math',
    'textarea',
    'input',
    'select',
    'button',
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[translate="no"]',
    '.notranslate',
    '.wt-ignore',
    '.wt-translated-block',
    '.wt-replaced-text',
    '#wt-root-container'
  ].join(', ');

  const IGNORE_TEXT_NODES_IN = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'SVG',
    'MATH',
    'TEXTAREA',
    'INPUT',
    'SELECT',
    'BUTTON'
  ]);

  const CODE_LIKE_TAGS = new Set(['PRE', 'CODE', 'KBD', 'SAMP', 'VAR']);
  const JSX_OR_HTML_TAG_RE = /^<\/?[A-Za-z][A-Za-z0-9._-]*(\s|>|\/|$)/;
  const MARKDOWN_TIMELINE_RE = /^-[ \t]+\*{0,2}[A-Z][a-z]{2}[ \t]+\d{1,2}\*{0,2}:/;
  const CSS_TOKEN_RE = /^(?:--[a-z0-9_-]+|::[a-z0-9_*-]+)$/i;
  const PATH_OR_HANDLE_OR_FILE_RE =
    /^(?:\/[a-z0-9_./-]+|@[a-z0-9_.-]+|[a-z0-9_.-]+\.(?:tsx?|jsx?|mjs|cjs|json|md|txt|css|rs|py|sh|yml|yaml|toml))$/i;
  const NUMERIC_UNIT_RE = /^[+-]?\d+(?:\.\d+)?\s*(?:px|em|rem|vh|vw|dvh|%|kb|mb|gb|ms|s|h)$/i;
  const BATCH_SIZE = 28;
  const MAX_CONCURRENT_BATCHES = 4;

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
    return Object.assign({}, base, cfg, {
      loomConfig: Object.assign({}, base.loomConfig, cfg.loomConfig || {}),
      codexConfig: Object.assign({}, base.codexConfig, cfg.codexConfig || {}),
      openaiConfig: Object.assign({}, base.openaiConfig, cfg.openaiConfig || {})
    });
  }

  function isSkippableCodeText(rawText) {
    if (!rawText) return true;
    const trimmed = rawText.trim();
    if (!trimmed) return true;
    if (JSX_OR_HTML_TAG_RE.test(trimmed)) return true;
    if (MARKDOWN_TIMELINE_RE.test(trimmed)) return true;
    if (CSS_TOKEN_RE.test(trimmed)) return true;
    if (PATH_OR_HANDLE_OR_FILE_RE.test(trimmed)) return true;
    if (NUMERIC_UNIT_RE.test(trimmed)) return true;
    return false;
  }

  function isTranslatableText(text) {
    if (!text) return false;
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length < 2) return false;
    if (isSkippableCodeText(normalized)) return false;
    if (!/\p{L}/u.test(normalized)) return false;
    if (/^(https?:\/\/\S+|mailto:\S+|\S+@\S+\.\S+)$/i.test(normalized)) return false;
    return true;
  }

  function splitTextWhitespace(raw) {
    const str = typeof raw === 'string' ? raw : '';
    const match = str.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) {
      return { leadingSpace: '', rawCore: str.trim(), coreText: str.trim(), trailingSpace: '' };
    }
    const rawCore = match[2];
    return {
      leadingSpace: match[1],
      rawCore,
      coreText: rawCore.replace(/\s+/g, ' ').trim(),
      trailingSpace: match[3]
    };
  }

  function extractTextDetails(rootEl) {
    let fullText = '';
    let proseText = '';

    function walk(node, insideCode) {
      if (!node) return;
      if (node.nodeType === 3) {
        const val = node.nodeValue || '';
        fullText += val;
        if (!insideCode) {
          proseText += val;
        }
        return;
      }
      if (node.nodeType !== 1) return;

      const el = node;
      const tag = el.tagName;
      if (IGNORE_TEXT_NODES_IN.has(tag)) return;
      if (
        el.classList &&
        (el.classList.contains('wt-translated-block') ||
          el.classList.contains('wt-replaced-text') ||
          el.id === 'wt-root-container')
      ) {
        return;
      }

      const nextInsideCode = insideCode || CODE_LIKE_TAGS.has(tag);
      const children = el.childNodes;
      for (let i = 0; i < children.length; i += 1) {
        walk(children[i], nextInsideCode);
      }
    }

    walk(rootEl, false);

    return {
      fullText: fullText.replace(/\s+/g, ' ').trim(),
      proseText: proseText.replace(/\s+/g, ' ').trim()
    };
  }

  function shouldSkipElement(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.isContentEditable) return true;
    if (!el.closest) return false;
    const match = el.closest(SKIP_SELECTOR);
    if (!match) return false;
    if (
      typeof document !== 'undefined' &&
      match === document.documentElement &&
      match.getAttribute &&
      match.getAttribute('data-wt-guard') === '1'
    ) {
      return false;
    }
    return true;
  }

  function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.hidden) return false;
    if (typeof global.getComputedStyle === 'function') {
      const style = global.getComputedStyle(el);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) {
        return false;
      }
    }
    return true;
  }

  function hasTranslatableProse(el) {
    const { fullText, proseText } = extractTextDetails(el);
    if (!isTranslatableText(proseText)) return false;
    return isTranslatableText(fullText) ? fullText : '';
  }

  function isInViewportRange(el, marginPx) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return true;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const vh = global.innerHeight || 800;
    return rect.bottom >= -marginPx && rect.top <= vh + marginPx;
  }

  function createDOMTranslator(options) {
    const opts = options || {};
    const sendMessage = opts.sendMessage;
    const defaultSettings = getDefaultSettings();
    const initRaw = opts.settings || {};
    let settings = Object.assign({}, defaultSettings, initRaw, {
      loomConfig: Object.assign({}, defaultSettings.loomConfig, initRaw.loomConfig || {}),
      codexConfig: Object.assign({}, defaultSettings.codexConfig, initRaw.codexConfig || {}),
      openaiConfig: Object.assign({}, defaultSettings.openaiConfig, initRaw.openaiConfig || {})
    });
    let isExcluded = Boolean(opts.isExcluded);
    const onStatusChange = typeof opts.onStatusChange === 'function' ? opts.onStatusChange : null;

    let isPageTranslated = false;
    let runId = 0;
    let idCounter = 0;
    let savedHtmlAttrs = null;
    let activeObserver = null;
    let activeMutationObserver = null;
    let mutationDebounceTimer = null;
    let scrollThrottleTimer = null;
    let scrollThrottlePending = false;
    let flushTimer = null;
    let dynamicTimers = [];
    let scrollListener = null;
    let resizeListener = null;
    let observedTargetSet = new WeakSet();
    let pendingQueue = [];
    let activeBatches = 0;
    let flushScheduled = false;
    let lastError = null;

    // Shared text-level cache across both 'replace' and 'bilingual' modes
    // Key: `${engine}:${model}|${sourceLang}|${targetLang}|${sourceText}`
    const textTranslationCache = new Map();

    // Block records (used in 'bilingual' mode)
    const elementRecords = new WeakMap();
    const recordsById = new Map();

    // TextNode records (used in 'replace' mode)
    const textNodeRecords = new WeakMap();
    const activeTextRecords = new Map();
    const elementToTextRecords = new Map();

    // Alt + Hover state
    let hoveredAltBlock = null;
    let altHoverInitialized = false;

    function getActiveModelId(engineName) {
      const eng = engineName || settings.engine || 'google-free';
      if (eng === 'loom') {
        return (settings.loomConfig && settings.loomConfig.model) || '';
      }
      if (eng === 'codex') {
        return (settings.codexConfig && settings.codexConfig.model) || '';
      }
      if (eng === 'openai') {
        return (settings.openaiConfig && settings.openaiConfig.model) || '';
      }
      return '';
    }

    function enforceTargetScript(text) {
      if (typeof text !== 'string' || !text) return text || '';
      if (global.WT_CONFIG && typeof global.WT_CONFIG.enforceTargetChineseScript === 'function') {
        return global.WT_CONFIG.enforceTargetChineseScript(text, settings.targetLang);
      }
      return text;
    }

    function applyCachedResult(rec, cached) {
      rec.translatedText = enforceTargetScript(cached.translatedText);
      rec.detectedSourceLang = cached.detectedSourceLang;
      rec.status = 'translated';
      rec.errorMessage = null;
      rec.scriptGuardCount = 0;
    }

    function getTargetHtmlLang() {
      if (settings.targetLang === 'zh-TW') return 'zh-TW';
      if (settings.targetLang === 'en') return 'en';
      return 'zh-CN';
    }

    function applyPageLanguageGuards() {
      if (typeof document === 'undefined' || !document.documentElement) return;
      const html = document.documentElement;
      if (!savedHtmlAttrs) {
        savedHtmlAttrs = {
          hadLang: html.hasAttribute('lang'),
          lang: html.getAttribute('lang'),
          hadTranslate: html.hasAttribute('translate'),
          translate: html.getAttribute('translate'),
          hadNotranslateClass: Boolean(html.classList && html.classList.contains('notranslate'))
        };
      }
      if (!savedHtmlAttrs.hadTranslate && !savedHtmlAttrs.hadNotranslateClass) {
        html.setAttribute('data-wt-guard', '1');
      }
      html.setAttribute('lang', getTargetHtmlLang());
      html.setAttribute('translate', 'no');
      if (html.classList) {
        html.classList.add('notranslate');
      }
    }

    function restorePageLanguageGuards() {
      if (typeof document === 'undefined' || !document.documentElement || !savedHtmlAttrs) return;
      const html = document.documentElement;
      html.removeAttribute('data-wt-guard');
      if (savedHtmlAttrs.hadLang) {
        html.setAttribute('lang', savedHtmlAttrs.lang || '');
      } else {
        html.removeAttribute('lang');
      }
      if (savedHtmlAttrs.hadTranslate) {
        html.setAttribute('translate', savedHtmlAttrs.translate || '');
      } else {
        html.removeAttribute('translate');
      }
      if (!savedHtmlAttrs.hadNotranslateClass && html.classList) {
        html.classList.remove('notranslate');
      }
      savedHtmlAttrs = null;
    }

    function makeCacheKey(engine, sourceLang, targetLang) {
      const eng = engine || 'google-free';
      const modelId = getActiveModelId(eng);
      return `${eng}:${modelId}|${sourceLang || 'auto'}|${targetLang || 'zh-CN'}`;
    }

    function makeTextCacheKey(engine, sourceLang, targetLang, sourceText) {
      return `${makeCacheKey(engine, sourceLang, targetLang)}|${sourceText}`;
    }

    function countRecordsByStatus(targetStatus) {
      let count = 0;
      activeTextRecords.forEach((rec) => {
        if (rec.status === targetStatus) count += 1;
      });
      recordsById.forEach((rec) => {
        if (rec.status === targetStatus) count += 1;
      });
      return count;
    }

    function getTranslatedCount() {
      return countRecordsByStatus('translated');
    }

    function getLoadingCount() {
      let count = countRecordsByStatus('loading');
      for (let i = 0; i < pendingQueue.length; i += 1) {
        if (pendingQueue[i] && pendingQueue[i].status !== 'loading') {
          count += 1;
        }
      }
      return count;
    }

    function getErrorCount() {
      return countRecordsByStatus('error');
    }

    function getTotalCount() {
      return settings.displayMode === 'bilingual' ? recordsById.size : activeTextRecords.size;
    }

    function getStatus() {
      return {
        isTranslated: isPageTranslated,
        sourceLang: settings.sourceLang,
        targetLang: settings.targetLang,
        displayMode: settings.displayMode,
        engine: settings.engine,
        translationStyle: settings.translationStyle,
        translatedCount: getTranslatedCount(),
        loadingCount: getLoadingCount(),
        errorCount: getErrorCount(),
        totalCount: getTotalCount(),
        lastError
      };
    }

    function emitStatus() {
      if (onStatusChange) {
        try {
          onStatusChange(getStatus());
        } catch (_) {
          // Ignore listener errors
        }
      }
    }

    // =========================================================================
    // Mode 1: Chrome-style In-Place TextNode Replacement ('replace')
    // =========================================================================

    function collectTranslatableTextNodes(rootNode) {
      const root = rootNode || document.body || document.documentElement;
      if (!root) return [];

      const out = [];

      function walk(node) {
        if (!node) return;
        if (node.nodeType === 1) {
          if (shouldSkipElement(node)) return;
          if (!isElementVisible(node)) return;
          const children = node.childNodes;
          for (let i = 0; i < children.length; i += 1) {
            walk(children[i]);
          }
          return;
        }
        if (node.nodeType === 3) {
          const parent = node.parentElement;
          if (!parent) return;

          const existing = textNodeRecords.get(node);
          if (existing && existing.status !== 'idle') {
            out.push(node);
            return;
          }

          const raw = node.nodeValue || '';
          const parts = splitTextWhitespace(raw);
          if (!parts.rawCore || isSkippableCodeText(parts.rawCore)) return;
          if (!isTranslatableText(parts.coreText)) return;
          out.push(node);
        }
      }

      walk(root);
      return out;
    }

    function ensureTextRecord(textNode) {
      let record = textNodeRecords.get(textNode);
      if (record) {
        record.parentElement = textNode.parentElement;
        if (record.status === 'idle') {
          const raw = textNode.nodeValue || '';
          const parts = splitTextWhitespace(raw);
          if (!parts.rawCore || isSkippableCodeText(parts.rawCore) || !isTranslatableText(parts.coreText)) {
            return null;
          }
          record.originalNodeValue = raw;
          record.leadingSpace = parts.leadingSpace;
          record.trailingSpace = parts.trailingSpace;
          record.sourceText = parts.coreText;
        }
        activeTextRecords.set(record.id, record);
        return record;
      }

      const raw = textNode.nodeValue || '';
      const parts = splitTextWhitespace(raw);
      if (!parts.rawCore || isSkippableCodeText(parts.rawCore) || !isTranslatableText(parts.coreText)) {
        return null;
      }

      idCounter += 1;
      const id = `wt-txt-${idCounter}`;
      record = {
        kind: 'text',
        id,
        textNode,
        parentElement: textNode.parentElement,
        originalNodeValue: raw,
        leadingSpace: parts.leadingSpace,
        trailingSpace: parts.trailingSpace,
        sourceText: parts.coreText,
        translatedText: null,
        detectedSourceLang: null,
        status: 'idle',
        errorMessage: null,
        highPriority: false
      };
      textNodeRecords.set(textNode, record);
      activeTextRecords.set(id, record);
      return record;
    }

    function renderTextRecord(record) {
      const node = record.textNode;
      if (!node) return;

      // CRITICAL for zero layout shift: never inject wrappers or mutate layout while loading/error/idle
      if (record.status === 'translated') {
        const normalized = enforceTargetScript(record.translatedText || '');
        record.translatedText = normalized;
        const nextValue = record.leadingSpace + normalized + record.trailingSpace;
        if (node.nodeValue !== nextValue) {
          node.nodeValue = nextValue;
        }
      } else {
        if (node.nodeValue !== record.originalNodeValue) {
          node.nodeValue = record.originalNodeValue;
        }
      }
    }

    function restoreAllTextNodes() {
      activeTextRecords.forEach((rec) => {
        rec.status = 'idle';
        rec.errorMessage = null;
        rec.highPriority = false;
        renderTextRecord(rec);
      });
      activeTextRecords.clear();
      elementToTextRecords.clear();
    }

    // =========================================================================
    // Mode 2: Block-Level Bilingual Translation ('bilingual')
    // =========================================================================

    function ensureBlockRecord(el) {
      let record = elementRecords.get(el);
      if (record) {
        const freshText = hasTranslatableProse(el);
        if (freshText && freshText !== record.sourceText && record.status === 'idle') {
          record.sourceText = freshText;
          record.cache.clear();
        }
        recordsById.set(record.id, record);
        return record;
      }

      const text = hasTranslatableProse(el);
      if (!text) return null;

      idCounter += 1;
      const id = `wt-blk-${idCounter}`;
      record = {
        kind: 'block',
        id,
        element: el,
        sourceText: text,
        cache: new Map(),
        translatedText: null,
        detectedSourceLang: null,
        status: 'idle',
        errorMessage: null,
        highPriority: false,
        bilingualNode: null,
        replacedNode: null,
        originalWrap: null
      };
      elementRecords.set(el, record);
      recordsById.set(id, record);
      return record;
    }

    function unwrapOriginalChildren(record) {
      const el = record.element;
      const wrap = record.originalWrap;
      if (!wrap) return;

      if (wrap.parentNode === el) {
        while (wrap.firstChild) {
          el.insertBefore(wrap.firstChild, wrap);
        }
        wrap.remove();
        if (typeof el.normalize === 'function') {
          el.normalize();
        }
      }
      record.originalWrap = null;
    }

    function removeTranslatedNodes(record) {
      if (record.bilingualNode && record.bilingualNode.parentNode) {
        record.bilingualNode.parentNode.removeChild(record.bilingualNode);
      }
      record.bilingualNode = null;

      if (record.replacedNode && record.replacedNode.parentNode) {
        record.replacedNode.parentNode.removeChild(record.replacedNode);
      }
      record.replacedNode = null;
    }

    function renderBlockRecord(record) {
      const el = record.element;
      if (!el || !el.isConnected) return;

      const styleName = settings.translationStyle || 'default';

      if (record.status === 'idle') {
        removeTranslatedNodes(record);
        unwrapOriginalChildren(record);
        el.removeAttribute('data-wt-id');
        el.removeAttribute('data-wt-state');
        return;
      }

      el.setAttribute('data-wt-id', record.id);
      el.setAttribute('data-wt-state', record.status);

      if (record.status === 'loading') {
        if (record.replacedNode && record.replacedNode.parentNode) {
          record.replacedNode.parentNode.removeChild(record.replacedNode);
          record.replacedNode = null;
        }
        unwrapOriginalChildren(record);

        if (!record.bilingualNode) {
          record.bilingualNode = document.createElement('div');
          record.bilingualNode.setAttribute('data-wt-id', record.id);
        }
        record.bilingualNode.className = `wt-translated-block wt-style-${styleName} wt-loading`;
        record.bilingualNode.textContent = '正在翻译...';
        if (record.bilingualNode.parentNode !== el) {
          el.appendChild(record.bilingualNode);
        }
        return;
      }

      if (record.status === 'error') {
        if (record.replacedNode && record.replacedNode.parentNode) {
          record.replacedNode.parentNode.removeChild(record.replacedNode);
          record.replacedNode = null;
        }
        unwrapOriginalChildren(record);

        if (!record.bilingualNode) {
          record.bilingualNode = document.createElement('div');
          record.bilingualNode.setAttribute('data-wt-id', record.id);
        }
        record.bilingualNode.className = `wt-translated-block wt-style-${styleName} wt-error`;
        record.bilingualNode.textContent = `翻译失败: ${record.errorMessage || '请重试'}`;
        if (record.bilingualNode.parentNode !== el) {
          el.appendChild(record.bilingualNode);
        }
        return;
      }

      // status === 'translated' (bilingual block)
      if (record.replacedNode && record.replacedNode.parentNode) {
        record.replacedNode.parentNode.removeChild(record.replacedNode);
        record.replacedNode = null;
      }
      unwrapOriginalChildren(record);

      if (!record.bilingualNode) {
        record.bilingualNode = document.createElement('div');
        record.bilingualNode.setAttribute('data-wt-id', record.id);
        record.bilingualNode.setAttribute('translate', 'no');
      }
      const normalized = enforceTargetScript(record.translatedText || '');
      record.translatedText = normalized;
      record.bilingualNode.className = `wt-translated-block notranslate wt-style-${styleName}`;
      record.bilingualNode.textContent = normalized;
      if (record.bilingualNode.parentNode !== el) {
        el.appendChild(record.bilingualNode);
      }
    }

    function restoreAllBilingualBlocks() {
      recordsById.forEach((rec) => {
        rec.status = 'idle';
        rec.errorMessage = null;
        rec.highPriority = false;
        renderBlockRecord(rec);
      });

      const orphanReplaced = document.querySelectorAll('.wt-replaced-text');
      for (let i = 0; i < orphanReplaced.length; i += 1) {
        orphanReplaced[i].remove();
      }
      const orphanBlocks = document.querySelectorAll('.wt-translated-block');
      for (let i = 0; i < orphanBlocks.length; i += 1) {
        orphanBlocks[i].remove();
      }
      const orphanWraps = document.querySelectorAll('.wt-original-wrap');
      for (let i = 0; i < orphanWraps.length; i += 1) {
        const wrap = orphanWraps[i];
        const parent = wrap.parentNode;
        if (parent) {
          while (wrap.firstChild) {
            parent.insertBefore(wrap.firstChild, wrap);
          }
          wrap.remove();
          if (typeof parent.normalize === 'function') {
            parent.normalize();
          }
        }
      }
      recordsById.clear();
    }

    function collectTranslatableBlocks(rootNode) {
      const root = rootNode || document.body || document.documentElement;
      if (!root) return [];

      const raw = root.querySelectorAll(BLOCK_SELECTOR);
      const candidates = [];
      const candidateSet = new Set();

      for (let i = 0; i < raw.length; i += 1) {
        const el = raw[i];
        if (shouldSkipElement(el)) continue;
        if (!isElementVisible(el)) continue;
        if (!hasTranslatableProse(el)) continue;
        candidates.push(el);
        candidateSet.add(el);
      }

      // Skip parent blocks that contain nested valid block candidates
      const parentsWithChildren = new Set();
      for (let i = 0; i < candidates.length; i += 1) {
        let parent = candidates[i].parentElement;
        while (parent && parent !== root) {
          if (candidateSet.has(parent)) {
            parentsWithChildren.add(parent);
          }
          parent = parent.parentElement;
        }
      }

      const leafBlocks = [];
      for (let i = 0; i < candidates.length; i += 1) {
        if (!parentsWithChildren.has(candidates[i])) {
          leafBlocks.push(candidates[i]);
        }
      }
      return leafBlocks;
    }

    // =========================================================================
    // Shared Observer & Batch Queue
    // =========================================================================

    function observeTarget(el) {
      if (!activeObserver || !el || observedTargetSet.has(el)) return;
      observedTargetSet.add(el);
      try {
        activeObserver.observe(el);
      } catch (_) {
        // Ignore
      }
    }

    function teardownObserver() {
      if (activeObserver) {
        try {
          activeObserver.disconnect();
        } catch (_) {
          // Ignore
        }
        activeObserver = null;
      }
      if (activeMutationObserver) {
        try {
          activeMutationObserver.disconnect();
        } catch (_) {
          // Ignore
        }
        activeMutationObserver = null;
      }
      if (mutationDebounceTimer) {
        clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = null;
      }
      if (scrollThrottleTimer) {
        clearTimeout(scrollThrottleTimer);
        scrollThrottleTimer = null;
      }
      scrollThrottlePending = false;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      while (dynamicTimers.length > 0) {
        clearTimeout(dynamicTimers.pop());
      }
      if (scrollListener && typeof global.removeEventListener === 'function') {
        try {
          global.removeEventListener('scroll', scrollListener, true);
        } catch (_) {
          // Ignore
        }
        scrollListener = null;
      }
      if (resizeListener && typeof global.removeEventListener === 'function') {
        try {
          global.removeEventListener('resize', resizeListener, false);
        } catch (_) {
          // Ignore
        }
        resizeListener = null;
      }
      observedTargetSet = new WeakSet();
      pendingQueue = [];
      activeBatches = 0;
      flushScheduled = false;
    }

    function scheduleBatchFlush(targetRunId) {
      if (flushScheduled) return;
      flushScheduled = true;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flushScheduled = false;
        pumpBatchQueue(targetRunId);
      }, 24);
    }

    function insertHighPriorityRecord(record) {
      record.highPriority = true;
      let insertIdx = pendingQueue.length;
      for (let i = 0; i < pendingQueue.length; i += 1) {
        if (!pendingQueue[i].highPriority) {
          insertIdx = i;
          break;
        }
      }
      pendingQueue.splice(insertIdx, 0, record);
    }

    function promoteRecordToFront(record, targetRunId) {
      if (!record || targetRunId !== runId || !isPageTranslated) return;
      if (record.status !== 'idle') return;
      const existingIdx = pendingQueue.indexOf(record);
      if (existingIdx !== -1) {
        if (record.highPriority) return;
        pendingQueue.splice(existingIdx, 1);
        insertHighPriorityRecord(record);
        scheduleBatchFlush(targetRunId);
        return;
      }
      enqueueRecord(record, targetRunId, true);
    }

    function enqueueRecord(record, targetRunId, highPriority) {
      if (!record || targetRunId !== runId || !isPageTranslated) return;
      if (record.status === 'loading' || record.status === 'translated') return;
      if (pendingQueue.indexOf(record) !== -1) {
        if (highPriority && !record.highPriority) {
          promoteRecordToFront(record, targetRunId);
        }
        return;
      }
      if (highPriority) {
        insertHighPriorityRecord(record);
      } else {
        record.highPriority = false;
        pendingQueue.push(record);
      }
      scheduleBatchFlush(targetRunId);
    }

    function renderAnyRecord(record) {
      if (record.kind === 'text') {
        renderTextRecord(record);
      } else {
        renderBlockRecord(record);
      }
    }

    async function processSingleBatch(batchRecords, targetRunId) {
      if (!batchRecords.length || targetRunId !== runId || !isPageTranslated) return;

      const cacheKey = makeCacheKey(settings.engine, settings.sourceLang, settings.targetLang);
      const uncached = [];

      for (let i = 0; i < batchRecords.length; i += 1) {
        const rec = batchRecords[i];
        const textKey = makeTextCacheKey(
          settings.engine,
          settings.sourceLang,
          settings.targetLang,
          rec.sourceText
        );

        let cached = rec.cache && rec.cache.get(cacheKey);
        if (!cached && textTranslationCache.has(textKey)) {
          cached = textTranslationCache.get(textKey);
          if (rec.cache) rec.cache.set(cacheKey, cached);
        }

        if (cached) {
          applyCachedResult(rec, cached);
          renderAnyRecord(rec);
        } else {
          rec.status = 'loading';
          renderAnyRecord(rec);
          uncached.push(rec);
        }
      }

      if (uncached.length === 0) {
        lastError = null;
        return;
      }

      emitStatus();

      // Within-batch source text deduplication
      const uniqueTexts = [];
      const groupMap = new Map();
      for (let i = 0; i < uncached.length; i += 1) {
        const rec = uncached[i];
        let group = groupMap.get(rec.sourceText);
        if (!group) {
          group = [];
          groupMap.set(rec.sourceText, group);
          uniqueTexts.push(rec.sourceText);
        }
        group.push(rec);
      }

      try {
        const res = await sendMessage({
          type: 'TRANSLATE_BATCH',
          payload: {
            texts: uniqueTexts,
            sourceLang: settings.sourceLang,
            targetLang: settings.targetLang,
            engine: settings.engine
          }
        });

        if (targetRunId !== runId || !isPageTranslated) return;

        if (res && res.ok && res.data && Array.isArray(res.data.translations)) {
          const translations = res.data.translations;
          const detectedList = res.data.detectedSourceLangs || [];
          let batchSuccessCount = 0;
          let batchLastErr = null;

          for (let i = 0; i < uniqueTexts.length; i += 1) {
            const srcText = uniqueTexts[i];
            const recsInGroup = groupMap.get(srcText) || [];
            const translatedText = enforceTargetScript(
              typeof translations[i] === 'string' ? translations[i] : ''
            );
            const detectedSourceLang = detectedList[i] || settings.sourceLang;

            if (translatedText) {
              const entry = { translatedText, detectedSourceLang };
              const textKey = makeTextCacheKey(
                settings.engine,
                settings.sourceLang,
                settings.targetLang,
                srcText
              );
              textTranslationCache.set(textKey, entry);
              for (let j = 0; j < recsInGroup.length; j += 1) {
                const rec = recsInGroup[j];
                if (rec.cache) rec.cache.set(cacheKey, entry);
                applyCachedResult(rec, entry);
                batchSuccessCount += 1;
                renderAnyRecord(rec);
              }
            } else {
              batchLastErr = '空译文';
              for (let j = 0; j < recsInGroup.length; j += 1) {
                const rec = recsInGroup[j];
                rec.status = 'error';
                rec.errorMessage = '空译文';
                renderAnyRecord(rec);
              }
            }
          }

          if (batchLastErr) {
            lastError = batchLastErr;
          } else if (batchSuccessCount > 0) {
            lastError = null;
          }
        } else {
          const errMsg = (res && res.error) || '翻译请求失败';
          lastError = errMsg;
          for (let i = 0; i < uncached.length; i += 1) {
            uncached[i].status = 'error';
            uncached[i].errorMessage = errMsg;
            renderAnyRecord(uncached[i]);
          }
        }
      } catch (err) {
        if (targetRunId !== runId || !isPageTranslated) return;
        const errMsg = err && err.message ? err.message : String(err);
        lastError = errMsg;
        for (let i = 0; i < uncached.length; i += 1) {
          uncached[i].status = 'error';
          uncached[i].errorMessage = errMsg;
          renderAnyRecord(uncached[i]);
        }
      }
    }

    function pumpBatchQueue(targetRunId) {
      if (targetRunId !== runId || !isPageTranslated) return;

      while (activeBatches < MAX_CONCURRENT_BATCHES && pendingQueue.length > 0) {
        const batch = pendingQueue.splice(0, BATCH_SIZE);
        activeBatches += 1;
        processSingleBatch(batch, targetRunId).finally(() => {
          if (targetRunId !== runId) return;
          activeBatches = Math.max(0, activeBatches - 1);
          if (!isPageTranslated) return;

          if (pendingQueue.length > 0) {
            pumpBatchQueue(targetRunId);
          } else if (activeBatches === 0 && getTranslatedCount() === 0 && getErrorCount() > 0) {
            isPageTranslated = false;
            teardownObserver();
            restorePageLanguageGuards();
          }

          emitStatus();
        });
      }
    }

    function isInsideExtensionUI(node) {
      let cur = node && node.nodeType === 3 ? node.parentElement : node;
      while (cur && cur.nodeType === 1) {
        if (
          cur.id === 'wt-root-container' ||
          (cur.classList &&
            (cur.classList.contains('wt-translated-block') ||
              cur.classList.contains('wt-replaced-text')))
        ) {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    }

    function isOwnMutationRecord(mutation) {
      if (!mutation) return true;
      if (isInsideExtensionUI(mutation.target)) return true;
      if (mutation.type === 'childList') {
        const added = mutation.addedNodes;
        const removed = mutation.removedNodes;
        let hasExternalNode = false;
        if (added) {
          for (let i = 0; i < added.length; i += 1) {
            if (!isInsideExtensionUI(added[i])) {
              hasExternalNode = true;
              break;
            }
          }
        }
        if (!hasExternalNode && removed) {
          for (let i = 0; i < removed.length; i += 1) {
            if (!isInsideExtensionUI(removed[i])) {
              hasExternalNode = true;
              break;
            }
          }
        }
        if (!hasExternalNode) return true;
      }
      return false;
    }

    function createViewportObserver(targetRunId) {
      if (typeof global.IntersectionObserver !== 'function') return null;
      return new global.IntersectionObserver(
        (entries) => {
          if (targetRunId !== runId || !isPageTranslated) return;
          for (let i = 0; i < entries.length; i += 1) {
            const entry = entries[i];
            if (entry.isIntersecting || entry.intersectionRatio > 0) {
              if (activeObserver) {
                try {
                  activeObserver.unobserve(entry.target);
                } catch (_) {
                  // Ignore
                }
              }
              if (settings.displayMode === 'bilingual') {
                const rec = elementRecords.get(entry.target);
                if (rec) {
                  promoteRecordToFront(rec, targetRunId);
                }
              } else {
                const recs = elementToTextRecords.get(entry.target);
                if (recs) {
                  recs.forEach((rec) => {
                    promoteRecordToFront(rec, targetRunId);
                  });
                }
              }
            }
          }
        },
        {
          root: null,
          rootMargin: '600px 0px 600px 0px',
          threshold: 0.01
        }
      );
    }

    function scanDynamicNodes(targetRunId) {
      if (!isPageTranslated || targetRunId !== runId) return;
      const root = document.body || document.documentElement;
      if (!root) return;

      let newlyTracked = 0;

      if (settings.displayMode === 'bilingual') {
        const blocks = collectTranslatableBlocks(root);
        const cacheKey = makeCacheKey(settings.engine, settings.sourceLang, settings.targetLang);

        for (let i = 0; i < blocks.length; i += 1) {
          const el = blocks[i];
          const existing = elementRecords.get(el);
          if (
            existing &&
            recordsById.has(existing.id) &&
            (existing.status !== 'idle' || pendingQueue.indexOf(existing) !== -1)
          ) {
            continue;
          }

          const rec = ensureBlockRecord(el);
          if (!rec) continue;

          const textKey = makeTextCacheKey(
            settings.engine,
            settings.sourceLang,
            settings.targetLang,
            rec.sourceText
          );
          let cached = rec.cache.get(cacheKey);
          if (!cached && textTranslationCache.has(textKey)) {
            cached = textTranslationCache.get(textKey);
            rec.cache.set(cacheKey, cached);
          }

          if (cached) {
            applyCachedResult(rec, cached);
            renderBlockRecord(rec);
            newlyTracked += 1;
          } else {
            const highPri = isInViewportRange(el, 600);
            enqueueRecord(rec, targetRunId, highPri);
            if (!highPri) {
              observeTarget(el);
            }
            newlyTracked += 1;
          }
        }
      } else {
        const textNodes = collectTranslatableTextNodes(root);

        for (let i = 0; i < textNodes.length; i += 1) {
          const node = textNodes[i];
          const existing = textNodeRecords.get(node);
          if (
            existing &&
            activeTextRecords.has(existing.id) &&
            (existing.status !== 'idle' || pendingQueue.indexOf(existing) !== -1)
          ) {
            continue;
          }

          const rec = ensureTextRecord(node);
          if (!rec) continue;

          const textKey = makeTextCacheKey(
            settings.engine,
            settings.sourceLang,
            settings.targetLang,
            rec.sourceText
          );

          if (textTranslationCache.has(textKey)) {
            const cached = textTranslationCache.get(textKey);
            applyCachedResult(rec, cached);
            renderTextRecord(rec);
            newlyTracked += 1;
          } else {
            if (rec.parentElement) {
              let set = elementToTextRecords.get(rec.parentElement);
              if (!set) {
                set = new Set();
                elementToTextRecords.set(rec.parentElement, set);
              }
              set.add(rec);
            }
            const highPri = isInViewportRange(rec.parentElement, 600);
            enqueueRecord(rec, targetRunId, highPri);
            if (!highPri && rec.parentElement) {
              observeTarget(rec.parentElement);
            }
            newlyTracked += 1;
          }
        }
      }

      if (newlyTracked > 0) {
        emitStatus();
      }
    }

    function handleCharacterDataMutation(mutation) {
      if (!isPageTranslated || !mutation || mutation.type !== 'characterData') return;
      const targetNode = mutation.target;
      if (!targetNode) return;
      if (settings.targetLang !== 'zh-CN' && settings.targetLang !== 'zh-TW') return;

      const rec = textNodeRecords.get(targetNode);
      if (rec && rec.status === 'translated') {
        const expected =
          rec.leadingSpace + enforceTargetScript(rec.translatedText || '') + rec.trailingSpace;
        const current = targetNode.nodeValue || '';
        if (current === expected) return;
        if (enforceTargetScript(current) === expected && (rec.scriptGuardCount || 0) < 8) {
          rec.scriptGuardCount = (rec.scriptGuardCount || 0) + 1;
          targetNode.nodeValue = expected;
        }
        return;
      }

      const parent = targetNode.parentElement;
      if (parent && parent.classList && parent.classList.contains('wt-translated-block')) {
        const blk = recordsById.get(parent.getAttribute('data-wt-id'));
        if (blk && blk.status === 'translated') {
          const expected = enforceTargetScript(blk.translatedText || '');
          const current = targetNode.nodeValue || '';
          if (current === expected) return;
          if (enforceTargetScript(current) === expected && (blk.scriptGuardCount || 0) < 8) {
            blk.scriptGuardCount = (blk.scriptGuardCount || 0) + 1;
            targetNode.nodeValue = expected;
          }
        }
      }
    }

    function setupDynamicObservers(targetRunId) {
      if (!isPageTranslated || targetRunId !== runId) return;

      const targetRoot = document.body || document.documentElement;
      if (typeof global.MutationObserver === 'function' && targetRoot) {
        activeMutationObserver = new global.MutationObserver((mutations) => {
          if (!isPageTranslated || targetRunId !== runId) return;
          let shouldScan = false;
          for (let i = 0; i < mutations.length; i += 1) {
            const mutation = mutations[i];
            if (mutation && mutation.type === 'characterData') {
              handleCharacterDataMutation(mutation);
              continue;
            }
            if (!isOwnMutationRecord(mutation)) {
              shouldScan = true;
            }
          }
          if (!shouldScan) return;

          if (mutationDebounceTimer) {
            clearTimeout(mutationDebounceTimer);
          }
          mutationDebounceTimer = setTimeout(() => {
            mutationDebounceTimer = null;
            scanDynamicNodes(targetRunId);
          }, 80);
        });

        try {
          activeMutationObserver.observe(targetRoot, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: [
              'hidden',
              'style',
              'class',
              'open',
              'aria-expanded',
              'data-state',
              'data-open'
            ]
          });
        } catch (_) {
          // Ignore invalid observe target in minimal mocks
        }
      }

      if (typeof global.addEventListener === 'function') {
        const runScrollSweep = () => {
          if (!isPageTranslated || targetRunId !== runId) return;
          const queueSnapshot = pendingQueue.slice();
          for (let i = 0; i < queueSnapshot.length; i += 1) {
            const rec = queueSnapshot[i];
            if (!rec || rec.status !== 'idle' || rec.highPriority) continue;
            const el = rec.kind === 'text' ? rec.parentElement : rec.element;
            if (el && isInViewportRange(el, 600)) {
              promoteRecordToFront(rec, targetRunId);
            }
          }
          scanDynamicNodes(targetRunId);
        };

        const handleScrollOrResize = () => {
          if (!isPageTranslated || targetRunId !== runId) return;
          if (scrollThrottleTimer) {
            scrollThrottlePending = true;
            return;
          }
          runScrollSweep();
          scrollThrottleTimer = setTimeout(() => {
            scrollThrottleTimer = null;
            if (scrollThrottlePending) {
              scrollThrottlePending = false;
              runScrollSweep();
            }
          }, 100);
        };

        scrollListener = handleScrollOrResize;
        resizeListener = handleScrollOrResize;
        global.addEventListener('scroll', scrollListener, { passive: true, capture: true });
        global.addEventListener('resize', resizeListener, { passive: true });
      }

      dynamicTimers.push(
        setTimeout(() => {
          scanDynamicNodes(targetRunId);
        }, 250)
      );
      dynamicTimers.push(
        setTimeout(() => {
          scanDynamicNodes(targetRunId);
        }, 1000)
      );
    }

    function translateTextNodesInPage(currentRunId) {
      // Ensure no leftover bilingual blocks exist when switching to replace
      restoreAllBilingualBlocks();
      elementToTextRecords.clear();

      const textNodes = collectTranslatableTextNodes();
      const recordsToFetch = [];

      for (let i = 0; i < textNodes.length; i += 1) {
        const rec = ensureTextRecord(textNodes[i]);
        if (!rec) continue;

        const textKey = makeTextCacheKey(
          settings.engine,
          settings.sourceLang,
          settings.targetLang,
          rec.sourceText
        );

        if (textTranslationCache.has(textKey)) {
          const cached = textTranslationCache.get(textKey);
          applyCachedResult(rec, cached);
          renderTextRecord(rec);
        } else {
          if (rec.status !== 'idle') {
            rec.status = 'idle';
            rec.errorMessage = null;
            renderTextRecord(rec);
          }
          recordsToFetch.push(rec);
          if (rec.parentElement) {
            let set = elementToTextRecords.get(rec.parentElement);
            if (!set) {
              set = new Set();
              elementToTextRecords.set(rec.parentElement, set);
            }
            set.add(rec);
          }
        }
      }

      activeObserver = createViewportObserver(currentRunId);

      for (let i = 0; i < recordsToFetch.length; i += 1) {
        const rec = recordsToFetch[i];
        const highPri = isInViewportRange(rec.parentElement, 700);
        enqueueRecord(rec, currentRunId, highPri);
        if (!highPri && rec.parentElement) {
          observeTarget(rec.parentElement);
        }
      }

      setupDynamicObservers(currentRunId);
      emitStatus();
      return getStatus();
    }

    function translateBilingualBlocksInPage(currentRunId) {
      // Restore any in-place text nodes before switching to bilingual blocks
      restoreAllTextNodes();

      const blocks = collectTranslatableBlocks();
      const cacheKey = makeCacheKey(settings.engine, settings.sourceLang, settings.targetLang);
      const recordsToFetch = [];

      for (let i = 0; i < blocks.length; i += 1) {
        const rec = ensureBlockRecord(blocks[i]);
        if (!rec) continue;

        const textKey = makeTextCacheKey(
          settings.engine,
          settings.sourceLang,
          settings.targetLang,
          rec.sourceText
        );

        let cached = rec.cache.get(cacheKey);
        if (!cached && textTranslationCache.has(textKey)) {
          cached = textTranslationCache.get(textKey);
          rec.cache.set(cacheKey, cached);
        }

        if (cached) {
          applyCachedResult(rec, cached);
          renderBlockRecord(rec);
        } else {
          if (rec.status !== 'idle') {
            rec.status = 'idle';
            renderBlockRecord(rec);
          }
          recordsToFetch.push(rec);
        }
      }

      activeObserver = createViewportObserver(currentRunId);

      for (let i = 0; i < recordsToFetch.length; i += 1) {
        const rec = recordsToFetch[i];
        const highPri = isInViewportRange(rec.element, 700);
        enqueueRecord(rec, currentRunId, highPri);
        if (!highPri) {
          observeTarget(rec.element);
        }
      }

      setupDynamicObservers(currentRunId);
      emitStatus();
      return getStatus();
    }

    function applyOverrides(overrideOpts) {
      const merged = overrideOpts || {};
      if (merged.sourceLang) settings.sourceLang = merged.sourceLang;
      if (merged.targetLang) settings.targetLang = merged.targetLang;
      if (merged.displayMode) settings.displayMode = merged.displayMode;
      if (merged.engine) settings.engine = merged.engine;
      if (merged.translationStyle) settings.translationStyle = merged.translationStyle;
      if (merged.loomConfig) {
        settings.loomConfig = Object.assign({}, settings.loomConfig || {}, merged.loomConfig);
      }
      if (merged.codexConfig) {
        settings.codexConfig = Object.assign({}, settings.codexConfig || {}, merged.codexConfig);
      }
      if (merged.openaiConfig) {
        settings.openaiConfig = Object.assign({}, settings.openaiConfig || {}, merged.openaiConfig);
      }
    }

    function renormalizeActiveRecords() {
      activeTextRecords.forEach((rec) => {
        rec.scriptGuardCount = 0;
        if (rec.status === 'translated') {
          renderTextRecord(rec);
        }
      });
      recordsById.forEach((rec) => {
        rec.scriptGuardCount = 0;
        if (rec.status === 'translated') {
          renderBlockRecord(rec);
        }
      });
    }

    function translatePage(overrideOpts) {
      applyOverrides(overrideOpts);
      runId += 1;
      const currentRunId = runId;
      teardownObserver();
      lastError = null;
      isPageTranslated = true;
      applyPageLanguageGuards();

      if (settings.displayMode === 'bilingual') {
        return translateBilingualBlocksInPage(currentRunId);
      }
      return translateTextNodesInPage(currentRunId);
    }

    function restorePage() {
      runId += 1;
      isPageTranslated = false;
      lastError = null;
      teardownObserver();
      clearAltHighlight();
      restorePageLanguageGuards();

      restoreAllTextNodes();
      restoreAllBilingualBlocks();

      const strayHighlights = document.querySelectorAll('.wt-alt-hover-highlight');
      for (let i = 0; i < strayHighlights.length; i += 1) {
        removeAltHighlightClass(strayHighlights[i]);
      }

      emitStatus();
      return getStatus();
    }

    function setMode(modeOpts) {
      const next = modeOpts || {};
      const prevMode = settings.displayMode;
      const prevCacheKey = makeCacheKey(settings.engine, settings.sourceLang, settings.targetLang);

      applyOverrides(next);

      const nextCacheKey = makeCacheKey(settings.engine, settings.sourceLang, settings.targetLang);
      const languageOrEngineChanged = prevCacheKey !== nextCacheKey;
      const modeChanged = prevMode !== settings.displayMode;
      const forceRetranslate = Boolean(next.forceRetranslate);

      if (!isPageTranslated) {
        // Update any single Alt+Hover translated items cleanly
        if (modeChanged) {
          lastError = null;
          if (settings.displayMode === 'bilingual') {
            restoreAllTextNodes();
          } else {
            restoreAllBilingualBlocks();
          }
        } else {
          if (languageOrEngineChanged && getTranslatedCount() === 0 && getErrorCount() > 0) {
            restoreAllTextNodes();
            restoreAllBilingualBlocks();
            lastError = null;
          }
          recordsById.forEach((rec) => {
            if (rec.status === 'translated') renderBlockRecord(rec);
          });
        }
        emitStatus();
        return getStatus();
      }

      applyPageLanguageGuards();
      renormalizeActiveRecords();

      if (languageOrEngineChanged || modeChanged || forceRetranslate) {
        return translatePage({});
      }

      // Only translationStyle changed in bilingual mode: re-render without re-fetching
      if (settings.displayMode === 'bilingual') {
        recordsById.forEach((rec) => {
          if (rec.status === 'translated' || rec.status === 'loading' || rec.status === 'error') {
            renderBlockRecord(rec);
          }
        });
      }
      emitStatus();
      return getStatus();
    }

    function togglePage(overrideOpts) {
      if (isPageTranslated) {
        return restorePage();
      }
      return translatePage(overrideOpts);
    }

    // =========================================================================
    // Alt + Hover Single-Block / In-Place Toggle
    // =========================================================================

    async function toggleSingleInPlaceBlock(el) {
      const textNodes = collectTranslatableTextNodes(el);
      if (!textNodes.length) return;

      const recs = [];
      for (let i = 0; i < textNodes.length; i += 1) {
        const rec = ensureTextRecord(textNodes[i]);
        if (rec) recs.push(rec);
      }
      if (!recs.length) return;
      if (recs.some((r) => r.status === 'loading')) return;

      if (recs.some((r) => r.status === 'translated')) {
        for (let i = 0; i < recs.length; i += 1) {
          recs[i].status = 'idle';
          recs[i].errorMessage = null;
          renderTextRecord(recs[i]);
        }
        emitStatus();
        return;
      }

      const captureRunId = runId;
      const uncached = [];

      for (let i = 0; i < recs.length; i += 1) {
        const rec = recs[i];
        const textKey = makeTextCacheKey(
          settings.engine,
          settings.sourceLang,
          settings.targetLang,
          rec.sourceText
        );
        if (textTranslationCache.has(textKey)) {
          const cached = textTranslationCache.get(textKey);
          applyCachedResult(rec, cached);
          renderTextRecord(rec);
        } else {
          rec.status = 'loading';
          renderTextRecord(rec);
          uncached.push(rec);
        }
      }

      if (uncached.length === 0) {
        lastError = null;
        emitStatus();
        return;
      }

      emitStatus();

      try {
        if (uncached.length === 1) {
          const rec = uncached[0];
          const res = await sendMessage({
            type: 'TRANSLATE_TEXT',
            payload: {
              text: rec.sourceText,
              sourceLang: settings.sourceLang,
              targetLang: settings.targetLang,
              engine: settings.engine,
              saveHistory: false
            }
          });
          if (captureRunId !== runId) return;
          if (res && res.ok && res.data && res.data.translatedText) {
            const entry = {
              translatedText: res.data.translatedText,
              detectedSourceLang: res.data.detectedSourceLang || settings.sourceLang
            };
            const textKey = makeTextCacheKey(
              settings.engine,
              settings.sourceLang,
              settings.targetLang,
              rec.sourceText
            );
            textTranslationCache.set(textKey, entry);
            rec.translatedText = entry.translatedText;
            rec.detectedSourceLang = entry.detectedSourceLang;
            rec.status = 'translated';
            rec.errorMessage = null;
            lastError = null;
          } else {
            const errMsg = (res && res.error) || '翻译失败';
            rec.status = 'error';
            rec.errorMessage = errMsg;
            lastError = errMsg;
          }
          renderTextRecord(rec);
        } else {
          const res = await sendMessage({
            type: 'TRANSLATE_BATCH',
            payload: {
              texts: uncached.map((r) => r.sourceText),
              sourceLang: settings.sourceLang,
              targetLang: settings.targetLang,
              engine: settings.engine
            }
          });
          if (captureRunId !== runId) return;
          if (res && res.ok && res.data && Array.isArray(res.data.translations)) {
            const detectedList = res.data.detectedSourceLangs || [];
            let batchSuccessCount = 0;
            let batchLastErr = null;
            for (let i = 0; i < uncached.length; i += 1) {
              const rec = uncached[i];
              const translatedText =
                typeof res.data.translations[i] === 'string' ? res.data.translations[i] : '';
              if (translatedText) {
                const entry = {
                  translatedText,
                  detectedSourceLang: detectedList[i] || settings.sourceLang
                };
                const textKey = makeTextCacheKey(
                  settings.engine,
                  settings.sourceLang,
                  settings.targetLang,
                  rec.sourceText
                );
                textTranslationCache.set(textKey, entry);
                rec.translatedText = entry.translatedText;
                rec.detectedSourceLang = entry.detectedSourceLang;
                rec.status = 'translated';
                rec.errorMessage = null;
                batchSuccessCount += 1;
              } else {
                rec.status = 'error';
                rec.errorMessage = '空译文';
                batchLastErr = '空译文';
              }
              renderTextRecord(rec);
            }
            if (batchLastErr) {
              lastError = batchLastErr;
            } else if (batchSuccessCount > 0) {
              lastError = null;
            }
          } else {
            const errMsg = (res && res.error) || '翻译请求失败';
            lastError = errMsg;
            for (let i = 0; i < uncached.length; i += 1) {
              uncached[i].status = 'error';
              uncached[i].errorMessage = errMsg;
              renderTextRecord(uncached[i]);
            }
          }
        }
      } catch (err) {
        if (captureRunId !== runId) return;
        const errMsg = err && err.message ? err.message : String(err);
        lastError = errMsg;
        for (let i = 0; i < uncached.length; i += 1) {
          uncached[i].status = 'error';
          uncached[i].errorMessage = errMsg;
          renderTextRecord(uncached[i]);
        }
      }

      emitStatus();
    }

    async function toggleSingleBlock(el) {
      if (settings.displayMode !== 'bilingual') {
        return toggleSingleInPlaceBlock(el);
      }

      const rec = ensureBlockRecord(el);
      if (!rec) return;
      if (rec.status === 'loading') return;

      if (rec.status === 'translated' || rec.status === 'error') {
        rec.status = 'idle';
        rec.errorMessage = null;
        renderBlockRecord(rec);
        emitStatus();
        return;
      }

      const captureRunId = runId;
      const cacheKey = makeCacheKey(settings.engine, settings.sourceLang, settings.targetLang);
      const textKey = makeTextCacheKey(
        settings.engine,
        settings.sourceLang,
        settings.targetLang,
        rec.sourceText
      );

      let cached = rec.cache.get(cacheKey);
      if (!cached && textTranslationCache.has(textKey)) {
        cached = textTranslationCache.get(textKey);
        rec.cache.set(cacheKey, cached);
      }

      if (cached) {
        rec.translatedText = cached.translatedText;
        rec.detectedSourceLang = cached.detectedSourceLang;
        rec.status = 'translated';
        rec.errorMessage = null;
        renderBlockRecord(rec);
        emitStatus();
        return;
      }

      rec.status = 'loading';
      renderBlockRecord(rec);

      try {
        const res = await sendMessage({
          type: 'TRANSLATE_TEXT',
          payload: {
            text: rec.sourceText,
            sourceLang: settings.sourceLang,
            targetLang: settings.targetLang,
            engine: settings.engine,
            saveHistory: false
          }
        });

        if (captureRunId !== runId) return;

        if (res && res.ok && res.data && res.data.translatedText) {
          const entry = {
            translatedText: res.data.translatedText,
            detectedSourceLang: res.data.detectedSourceLang || settings.sourceLang
          };
          textTranslationCache.set(textKey, entry);
          rec.cache.set(cacheKey, entry);
          rec.translatedText = entry.translatedText;
          rec.detectedSourceLang = entry.detectedSourceLang;
          rec.status = 'translated';
          rec.errorMessage = null;
          lastError = null;
        } else {
          const errMsg = (res && res.error) || '翻译失败';
          rec.status = 'error';
          rec.errorMessage = errMsg;
          lastError = errMsg;
        }
      } catch (err) {
        if (captureRunId !== runId) return;
        const errMsg = err && err.message ? err.message : String(err);
        rec.status = 'error';
        rec.errorMessage = errMsg;
        lastError = errMsg;
      }

      renderBlockRecord(rec);
      emitStatus();
    }

    function findClosestTranslatableBlock(target) {
      if (!target) return null;
      const startEl = target.nodeType === 3 ? target.parentElement : target;
      if (!startEl || typeof startEl.closest !== 'function') return null;

      const candidate = startEl.closest(BLOCK_SELECTOR);
      if (candidate) {
        if (shouldSkipElement(candidate)) return null;
        if (!isElementVisible(candidate)) return null;

        if (settings.displayMode !== 'bilingual') {
          return collectTranslatableTextNodes(candidate).length > 0 ? candidate : null;
        }

        if (!hasTranslatableProse(candidate)) return null;
        const nested = candidate.querySelectorAll(BLOCK_SELECTOR);
        for (let i = 0; i < nested.length; i += 1) {
          if (
            !shouldSkipElement(nested[i]) &&
            isElementVisible(nested[i]) &&
            hasTranslatableProse(nested[i])
          ) {
            return null;
          }
        }
        return candidate;
      }

      // In replace mode, also allow hovering structured non-block elements (e.g. timeline spans/rows)
      if (settings.displayMode !== 'bilingual') {
        if (!shouldSkipElement(startEl) && isElementVisible(startEl)) {
          if (collectTranslatableTextNodes(startEl).length > 0) {
            return startEl;
          }
        }
      }

      return null;
    }

    function removeAltHighlightClass(el) {
      if (!el || !el.classList) return;
      el.classList.remove('wt-alt-hover-highlight');
      if (el.getAttribute && el.getAttribute('class') === '') {
        el.removeAttribute('class');
      }
    }

    function clearAltHighlight() {
      if (hoveredAltBlock) {
        removeAltHighlightClass(hoveredAltBlock);
      }
      hoveredAltBlock = null;
    }

    function handleAltMouseMove(e) {
      if (!settings.altHoverTranslate || isExcluded) {
        if (hoveredAltBlock) clearAltHighlight();
        return;
      }
      if (!e.altKey) {
        if (hoveredAltBlock) clearAltHighlight();
        return;
      }

      const block = findClosestTranslatableBlock(e.target);
      if (!block) {
        if (hoveredAltBlock) clearAltHighlight();
        return;
      }

      if (block !== hoveredAltBlock) {
        clearAltHighlight();
        hoveredAltBlock = block;
        block.classList.add('wt-alt-hover-highlight');
        setTimeout(() => {
          removeAltHighlightClass(block);
        }, 650);
        toggleSingleBlock(block);
      }
    }

    function handleAltKeyUp(e) {
      if (e.key === 'Alt') {
        clearAltHighlight();
      }
    }

    function handleAltMouseOut(e) {
      if (hoveredAltBlock && (!e.relatedTarget || !hoveredAltBlock.contains(e.relatedTarget))) {
        clearAltHighlight();
      }
    }

    function bindAltHover() {
      if (altHoverInitialized || typeof document === 'undefined') return;
      altHoverInitialized = true;
      document.addEventListener('mousemove', handleAltMouseMove, true);
      document.addEventListener('mouseout', handleAltMouseOut, true);
      document.addEventListener('keyup', handleAltKeyUp, true);
    }

    function updateSettings(nextSettings, nextExcluded) {
      if (typeof nextExcluded === 'boolean') {
        isExcluded = nextExcluded;
      }
      if (!nextSettings) return;

      const prevStyle = settings.translationStyle;
      const prevMode = settings.displayMode;
      const prevCacheKey = makeCacheKey(settings.engine, settings.sourceLang, settings.targetLang);

      settings = Object.assign({}, settings, nextSettings);
      if (nextSettings.loomConfig) {
        settings.loomConfig = Object.assign({}, settings.loomConfig || {}, nextSettings.loomConfig);
      }
      if (nextSettings.codexConfig) {
        settings.codexConfig = Object.assign({}, settings.codexConfig || {}, nextSettings.codexConfig);
      }
      if (nextSettings.openaiConfig) {
        settings.openaiConfig = Object.assign({}, settings.openaiConfig || {}, nextSettings.openaiConfig);
      }

      const nextCacheKey = makeCacheKey(settings.engine, settings.sourceLang, settings.targetLang);
      const languageOrEngineChanged = prevCacheKey !== nextCacheKey;
      const modeChanged = prevMode !== settings.displayMode;
      const styleChanged = prevStyle !== settings.translationStyle;

      if ((languageOrEngineChanged || modeChanged) && isPageTranslated) {
        translatePage({});
        return;
      }

      if (styleChanged && settings.displayMode === 'bilingual') {
        recordsById.forEach((rec) => {
          if (rec.status === 'translated' || rec.status === 'loading' || rec.status === 'error') {
            renderBlockRecord(rec);
          }
        });
      }
      emitStatus();
    }

    function destroy() {
      restorePage();
      if (altHoverInitialized && typeof document !== 'undefined') {
        document.removeEventListener('mousemove', handleAltMouseMove, true);
        document.removeEventListener('mouseout', handleAltMouseOut, true);
        document.removeEventListener('keyup', handleAltKeyUp, true);
        altHoverInitialized = false;
      }
      clearAltHighlight();
    }

    bindAltHover();

    return {
      translatePage,
      restorePage,
      togglePage,
      setMode,
      getStatus,
      toggleSingleBlock,
      updateSettings,
      collectTranslatableBlocks,
      collectTranslatableTextNodes,
      destroy
    };
  }

  WTContent.createDOMTranslator = createDOMTranslator;
  WTContent.isTranslatableText = isTranslatableText;
  WTContent.isSkippableCodeText = isSkippableCodeText;
})(typeof globalThis !== 'undefined' ? globalThis : window);
