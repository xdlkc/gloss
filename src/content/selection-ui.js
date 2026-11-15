(function (global) {
  'use strict';

  const WTContent = (global.WTContent = global.WTContent || {});

  const TARGET_TABS = [
    { code: 'zh-CN', label: '简体中文', shortLabel: '简' },
    { code: 'zh-TW', label: '繁體中文', shortLabel: '繁' },
    { code: 'en', label: 'English', shortLabel: 'EN' }
  ];

  const LANG_DISPLAY = {
    auto: '自动检测',
    en: 'EN',
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    ja: '日语 JA',
    ko: '韩语 KO',
    fr: '法语 FR',
    de: '德语 DE',
    es: '西语 ES',
    ru: '俄语 RU',
    pt: '葡语 PT',
    ar: '阿语 AR'
  };

  const ENGINE_DISPLAY = {
    'google-free': 'Google 翻译',
    mymemory: 'MyMemory',
    loom: 'Loom 网关',
    openai: 'OpenAI',
    codex: 'Codex 订阅'
  };

  const FALLBACK_CODEX_MODELS = [
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' },
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

  const FALLBACK_LOOM_PROVIDERS = [
    {
      id: 'zenmux',
      name: 'ZenMux',
      models: [{ id: 'zenmux/anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5' }]
    },
    {
      id: 'glm',
      name: 'GLM 国内 Coding Plan',
      models: [
        { id: 'glm/glm-5-turbo', name: 'GLM-5 Turbo' },
        { id: 'glm/glm-4.5-air', name: 'GLM-4.5 Air' }
      ]
    },
    {
      id: 'deepseek',
      name: 'DeepSeek API 钱包',
      models: [
        { id: 'deepseek/deepseek-flash', name: 'DeepSeek Flash' },
        { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' }
      ]
    },
    {
      id: 'kimi',
      name: 'Kimi Code 国内订阅',
      models: [
        { id: 'kimi/k3.1-pro', name: 'Kimi K3.1 Pro' },
        { id: 'kimi/k3.1-pro-highspeed', name: 'Kimi K3.1 Pro 高速' },
        { id: 'kimi/k3-256k', name: 'Kimi K3 256K' }
      ]
    },
    {
      id: 'longcat',
      name: 'LongCat 美团开放平台',
      models: [{ id: 'longcat/longcat-2.5', name: 'LongCat 2.5' }]
    }
  ];

  const MAX_PAGE_CONTEXT_CHARS = 6000;
  const MAX_PAGE_CONTEXT_IMAGES = 4;
  const CONTEXT_SKIP_IMAGE_RE = /(?:^|[\W_])(avatar|emoji|emoticon|favicon|badge|spinner|spacer|pixel)(?:$|[\W_])/i;
  const CONTEXT_SKIP_TAGS = new Set([
    'NAV',
    'FOOTER',
    'ASIDE',
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'SVG',
    'MATH',
    'PRE',
    'TEXTAREA',
    'SELECT',
    'BUTTON'
  ]);
  const NON_TEXT_INPUT_TYPES = new Set([
    'button',
    'submit',
    'reset',
    'checkbox',
    'radio',
    'file',
    'image',
    'hidden',
    'range',
    'color'
  ]);

  const QUICK_CHAT_CHIPS = [
    {
      taskType: 'summarize_page',
      label: '📝 总结本页',
      prompt: '请全面总结当前网页的核心主题、结构与关键结论。'
    },
    {
      taskType: 'key_takeaways',
      label: '💡 核心要点',
      prompt: '请提炼当前网页最值得关注的 3-6 条核心要点。'
    },
    {
      taskType: 'page_qa',
      label: '❓ 生成问答',
      prompt: '请基于当前网页内容生成 3-5 个常见关键问题与简明解答。'
    },
    {
      taskType: 'explain',
      label: '🔍 解释概念',
      prompt: '请用通俗易懂的语言解释当前引用内容或页面中的核心概念。'
    }
  ];

  const SUMMARY_ACTIONS = [
    {
      taskType: 'summarize_page',
      label: '⚡ 一键生成网页摘要',
      prompt: '请生成一份结构清晰的当前网页内容摘要。',
      primary: true
    },
    {
      taskType: 'key_takeaways',
      label: '📌 提炼核心要点',
      prompt: '请提炼当前网页最重要的核心要点列表。'
    },
    {
      taskType: 'page_qa',
      label: '❓ 生成关键问答',
      prompt: '请围绕当前网页内容生成常见问题与解答。'
    }
  ];

  const WRITE_ACTIONS = [
    { taskType: 'polish', label: '✨ 专业润色' },
    { taskType: 'shorten', label: '📏 精简缩写' },
    { taskType: 'expand', label: '🚀 扩写丰富' },
    { taskType: 'grammar', label: '🔧 语法纠错' },
    { taskType: 'translate_en', label: '🇺🇸 译为英文' },
    { taskType: 'translate_zh', label: '🇨🇳 译为中文' }
  ];

  const POPOVER_AI_ACTIONS = [
    { action: 'explain', label: '✨ 解释' },
    { action: 'summarize', label: '📝 总结' },
    { action: 'polish', label: '✒️ 润色' },
    { action: 'chat', label: '💬 追问' }
  ];

  const SVG_SPARKLES =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M5 18l.8 1.9L7.7 20.7l-1.9.8L5 23.4l-.8-1.9L2.3 20.7l1.9-.8L5 18z"/><path d="M19 14l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4z"/></svg>';

  const SVG_SEND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  const SVG_TRANSLATE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>';

  const SVG_COPY =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

  const SVG_SPEAK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function isEditableTarget(node) {
    if (!node) return false;
    const el = node.nodeType === 3 ? node.parentElement : node;
    if (!el || typeof el.closest !== 'function') return false;
    if (el.isContentEditable) return true;
    return Boolean(el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
  }

  function formatSourceBadge(sourceLang, detectedLang) {
    const base = sourceLang && sourceLang !== 'auto' ? LANG_DISPLAY[sourceLang] || sourceLang : '自动检测';
    if (!detectedLang || detectedLang === 'auto') {
      return base;
    }
    const detectedLabel = LANG_DISPLAY[detectedLang] || detectedLang.toUpperCase();
    if (sourceLang && sourceLang !== 'auto') {
      return detectedLabel;
    }
    return `${base} · ${detectedLabel}`;
  }

  function mapSpeechLang(targetLang) {
    if (targetLang === 'en') return 'en-US';
    if (targetLang === 'zh-TW') return 'zh-TW';
    return 'zh-CN';
  }

  function getLoomProviderList() {
    const cfgProviders = global.WT_CONFIG && global.WT_CONFIG.LOOM_PRESET_PROVIDERS;
    return Array.isArray(cfgProviders) && cfgProviders.length > 0
      ? cfgProviders
      : FALLBACK_LOOM_PROVIDERS;
  }

  function getCodexModelList() {
    const cfgModels = global.WT_CONFIG && global.WT_CONFIG.CODEX_PRESET_MODELS;
    return Array.isArray(cfgModels) && cfgModels.length > 0
      ? cfgModels
      : FALLBACK_CODEX_MODELS;
  }

  function findProviderForModel(modelId) {
    if (!modelId) return '';
    if (String(modelId).startsWith('codex:')) return 'codex';
    const providers = getLoomProviderList();
    for (let i = 0; i < providers.length; i += 1) {
      const models = providers[i].models || [];
      for (let j = 0; j < models.length; j += 1) {
        if (models[j].id === modelId) {
          return providers[i].id;
        }
      }
    }
    const slashIdx = String(modelId).indexOf('/');
    return slashIdx > 0 ? String(modelId).slice(0, slashIdx) : '';
  }

  function formatModelDisplayName(modelId) {
    if (!modelId) return '默认模型';
    const raw = String(modelId);
    const normalized = raw.startsWith('codex:') ? raw.slice('codex:'.length) : raw;
    const providers = getLoomProviderList();
    for (let i = 0; i < providers.length; i += 1) {
      const models = providers[i].models || [];
      for (let j = 0; j < models.length; j += 1) {
        if (models[j].id === normalized) {
          return models[j].name || normalized;
        }
      }
    }
    const codexModels = getCodexModelList();
    for (let i = 0; i < codexModels.length; i += 1) {
      if (codexModels[i].id === normalized) {
        return codexModels[i].name || normalized;
      }
    }
    return normalized;
  }

  function isSkippedContextElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.id === 'wt-root-container') return true;
    if (CONTEXT_SKIP_TAGS.has(el.tagName)) return true;
    if (el.hidden) return true;
    if (el.classList && el.classList.contains('wt-translated-block')) return true;
    if (typeof global.getComputedStyle === 'function') {
      try {
        const st = global.getComputedStyle(el);
        if (st && (st.display === 'none' || st.visibility === 'hidden')) {
          return true;
        }
      } catch (_) {
        // Ignore style lookup issues in minimal environments
      }
    }
    return false;
  }

  function extractReadableTextFromRoot(rootEl) {
    if (!rootEl) return '';
    const lines = [];
    let currentLine = '';

    const BLOCK_BREAK_TAGS = new Set([
      'P',
      'DIV',
      'SECTION',
      'ARTICLE',
      'MAIN',
      'HEADER',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'LI',
      'TR',
      'BLOCKQUOTE',
      'FIGCAPTION',
      'DT',
      'DD'
    ]);

    function flushLine() {
      const clean = currentLine.replace(/\s+/g, ' ').trim();
      if (clean) {
        lines.push(clean);
      }
      currentLine = '';
    }

    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        const val = node.nodeValue || '';
        if (val.trim()) {
          currentLine += (currentLine ? ' ' : '') + val.trim();
        }
        return;
      }
      if (node.nodeType !== 1) return;
      if (isSkippedContextElement(node)) return;

      const isBlock = BLOCK_BREAK_TAGS.has(node.tagName);
      if (isBlock) flushLine();
      const children = node.childNodes || [];
      for (let i = 0; i < children.length; i += 1) {
        walk(children[i]);
      }
      if (isBlock) flushLine();
    }

    walk(rootEl);
    flushLine();
    return lines.join('\n');
  }

  function tryCaptureImageToDataUrl(img, maxDim = 1024) {
    if (!img || typeof document === 'undefined') return '';
    try {
      const natW = Number(img.naturalWidth || 0);
      const natH = Number(img.naturalHeight || 0);
      if (!img.complete || natW <= 0 || natH <= 0) return '';
      const scale = Math.min(1, maxDim / Math.max(natW, natH));
      const targetW = Math.max(1, Math.round(natW * scale));
      const targetH = Math.max(1, Math.round(natH * scale));
      const canvas = document.createElement('canvas');
      if (!canvas || typeof canvas.getContext !== 'function') return '';
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.drawImage(img, 0, 0, targetW, targetH);
      return canvas.toDataURL('image/jpeg', 0.84);
    } catch (_) {
      return '';
    }
  }

  function extractPageImages(rootEl, baseUrl) {
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return [];
    const imgs = rootEl.querySelectorAll('img');
    const results = [];
    const seen = new Set();

    for (let i = 0; i < imgs.length && results.length < MAX_PAGE_CONTEXT_IMAGES; i += 1) {
      const img = imgs[i];
      if (!img) continue;
      let skipped = false;
      let cur = img;
      while (cur && cur.nodeType === 1) {
        if (isSkippedContextElement(cur)) {
          skipped = true;
          break;
        }
        cur = cur.parentElement;
      }
      if (skipped) continue;

      const rawSrc =
        (img.currentSrc ||
          img.src ||
          (typeof img.getAttribute === 'function'
            ? img.getAttribute('src') ||
              img.getAttribute('data-src') ||
              img.getAttribute('data-original')
            : '') ||
          '').trim();
      if (!rawSrc || /^(?:javascript:|blob:|about:)/i.test(rawSrc)) continue;
      if (/^data:image\/svg\+xml/i.test(rawSrc) || /\.svg(?:\?|$|#)/i.test(rawSrc)) continue;

      let resolvedUrl = rawSrc;
      if (!/^data:image\//i.test(rawSrc)) {
        try {
          resolvedUrl = new URL(rawSrc, baseUrl || 'https://example.com').href;
        } catch (_) {
          resolvedUrl = rawSrc;
        }
      }
      if (!/^(?:https?:\/\/|data:image\/)/i.test(resolvedUrl)) continue;
      if (seen.has(resolvedUrl)) continue;

      const attrW = typeof img.getAttribute === 'function' ? Number(img.getAttribute('width') || 0) : 0;
      const attrH = typeof img.getAttribute === 'function' ? Number(img.getAttribute('height') || 0) : 0;
      const w = Number(img.naturalWidth || img.width || attrW || 0);
      const h = Number(img.naturalHeight || img.height || attrH || 0);
      if (w > 0 && h > 0 && (Math.max(w, h) < 80 || Math.min(w, h) < 40)) {
        continue;
      }

      const alt = (
        (typeof img.getAttribute === 'function' ? img.getAttribute('alt') : '') ||
        img.alt ||
        (typeof img.getAttribute === 'function' ? img.getAttribute('title') : '') ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
      const hintStr = `${img.className || ''} ${resolvedUrl.split('?')[0].split('/').pop() || ''}`;
      if (w === 0 && h === 0 && CONTEXT_SKIP_IMAGE_RE.test(hintStr) && !alt) {
        continue;
      }
      if (w > 0 && w < 100 && CONTEXT_SKIP_IMAGE_RE.test(hintStr)) {
        continue;
      }

      seen.add(resolvedUrl);
      const dataUrl = /^data:image\//i.test(resolvedUrl)
        ? resolvedUrl
        : tryCaptureImageToDataUrl(img, 1024);
      results.push({
        url: resolvedUrl,
        dataUrl,
        alt,
        width: w || undefined,
        height: h || undefined,
        source: 'page'
      });
    }

    return results;
  }

  function extractPageContext() {
    if (typeof document === 'undefined') {
      return { title: '', url: '', content: '', images: [] };
    }
    const title = (document.title || '').trim();
    const url = (global.location && global.location.href) || '';
    const primaryCandidate =
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.body ||
      document.documentElement;

    let bodyText = extractReadableTextFromRoot(primaryCandidate);
    if (
      bodyText.length < 120 &&
      document.body &&
      primaryCandidate &&
      primaryCandidate !== document.body
    ) {
      const fallbackText = extractReadableTextFromRoot(document.body);
      if (fallbackText.length > bodyText.length) {
        bodyText = fallbackText;
      }
    }

    const outlineRoot = primaryCandidate || document.body || document.documentElement;
    const outlineParts = [];
    if (outlineRoot && typeof outlineRoot.querySelectorAll === 'function') {
      const headings = outlineRoot.querySelectorAll('h1, h2, h3');
      for (let i = 0; i < headings.length && outlineParts.length < 15; i += 1) {
        const h = headings[i];
        let skipped = false;
        let cur = h;
        while (cur && cur.nodeType === 1) {
          if (isSkippedContextElement(cur)) {
            skipped = true;
            break;
          }
          cur = cur.parentElement;
        }
        if (skipped) continue;
        const text = (h.textContent || '').replace(/\s+/g, ' ').trim();
        if (text && text.length >= 2) {
          outlineParts.push(`${h.tagName}: ${text}`);
        }
      }
    }

    let images = extractPageImages(outlineRoot, url);
    if (
      images.length === 0 &&
      document.body &&
      outlineRoot &&
      outlineRoot !== document.body
    ) {
      images = extractPageImages(document.body, url);
    }

    let combined = '';
    if (outlineParts.length > 0) {
      combined += `[页面大纲]\n${outlineParts.join('\n')}\n\n[正文内容]\n`;
    }
    combined += bodyText;
    if (images.length > 0) {
      const imgLines = images.map((im, idx) => {
        const shortUrl = im.url.length > 160 ? im.url.slice(0, 160) + '...' : im.url;
        return `${idx + 1}. ${im.alt ? `[${im.alt}] ` : ''}${shortUrl}`;
      });
      combined += `\n\n[页面图片列表]\n${imgLines.join('\n')}`;
    }
    combined = combined.replace(/\n{3,}/g, '\n\n').trim();
    if (combined.length > MAX_PAGE_CONTEXT_CHARS) {
      const suffix = '\n...(正文已截断)';
      const maxPrefix = Math.max(0, MAX_PAGE_CONTEXT_CHARS - suffix.length);
      combined = combined.slice(0, maxPrefix).trimEnd() + suffix;
    }

    return {
      title,
      url,
      content: combined,
      images
    };
  }

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
        code.className = 'wt-md-inline-code';
        code.textContent = token.slice(1, -1);
        parent.appendChild(code);
      } else if (token.startsWith('[')) {
        const linkMatch = token.match(/^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/);
        if (linkMatch) {
          const a = document.createElement('a');
          a.className = 'wt-md-link';
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
    container.innerHTML = '';
    const text = String(rawText || '').replace(/\r\n/g, '\n');
    if (!text.trim()) return;

    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeLines = [];

    const flushCodeBlock = () => {
      if (!codeLines.length) return;
      const pre = document.createElement('pre');
      pre.className = 'wt-md-pre';
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
      if (!trimmed) {
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const hEl = document.createElement('div');
        hEl.className = `wt-md-heading wt-md-h${headingMatch[1].length}`;
        appendInlineMarkdown(hEl, headingMatch[2]);
        container.appendChild(hEl);
        continue;
      }

      const listMatch = trimmed.match(/^(?:[-*•]|(\d+)\.)\s+(.+)$/);
      if (listMatch) {
        const liEl = document.createElement('div');
        liEl.className = 'wt-md-li';
        const bullet = document.createElement('span');
        bullet.className = 'wt-md-bullet';
        bullet.textContent = listMatch[1] ? `${listMatch[1]}.` : '•';
        const contentSpan = document.createElement('span');
        contentSpan.className = 'wt-md-li-text';
        appendInlineMarkdown(contentSpan, listMatch[2]);
        liEl.appendChild(bullet);
        liEl.appendChild(contentSpan);
        container.appendChild(liEl);
        continue;
      }

      const pEl = document.createElement('div');
      pEl.className = 'wt-md-p';
      appendInlineMarkdown(pEl, trimmed);
      container.appendChild(pEl);
    }

    if (inCodeBlock) {
      flushCodeBlock();
    }
  }

  function createThinkingElement(reasoning, thinkingMs, opts = {}) {
    const cleanReasoning = typeof reasoning === 'string' ? reasoning.trim() : '';
    const isStreaming = Boolean(opts && opts.streaming);
    if (!cleanReasoning && !isStreaming) return null;
    const details = document.createElement('details');
    details.className = isStreaming ? 'wt-thinking-box wt-thinking-streaming' : 'wt-thinking-box';
    details.open = true;
    const summary = document.createElement('summary');
    summary.className = 'wt-thinking-summary';
    const secLabel =
      typeof thinkingMs === 'number' && thinkingMs >= 100
        ? ` (${(thinkingMs / 1000).toFixed(1)}s)`
        : '';
    summary.textContent = isStreaming
      ? `💭 正在思考...${secLabel}`
      : `💭 思考过程${secLabel}`;
    const body = document.createElement('div');
    body.className = 'wt-thinking-body wt-chat-msg-markdown';
    renderMarkdownToElement(
      body,
      cleanReasoning || opts.placeholder || '正在读取网页内容并进行深度思考...'
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
        if (typeof global.Image !== 'function' || typeof document === 'undefined') {
          resolve({ url: rawDataUrl, dataUrl: rawDataUrl, alt, source: 'upload' });
          return;
        }
        const img = new global.Image();
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

  async function copyTextToClipboard(text) {
    if (!text) return false;
    let copied = false;
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (_) {
        copied = false;
      }
    }

    if (!copied && typeof document !== 'undefined' && document.execCommand) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        (document.body || document.documentElement).appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        ta.remove();
      } catch (_) {
        copied = false;
      }
    }
    return copied;
  }

  function isFocusablePageEditable(el, rootContainer) {
    if (!el || el.nodeType !== 1) return false;
    if (rootContainer && rootContainer.contains(el)) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const t = (el.getAttribute('type') || el.type || 'text').toLowerCase();
      return !NON_TEXT_INPUT_TYPES.has(t);
    }
    if (el.isContentEditable) return true;
    const ce = el.getAttribute && el.getAttribute('contenteditable');
    return ce === 'true' || ce === '';
  }

  function writeTextToEditable(targetEl, text, rootContainer) {
    if (!targetEl || !targetEl.isConnected || !isFocusablePageEditable(targetEl, rootContainer)) {
      return false;
    }
    try {
      if (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA') {
        targetEl.value = text;
        if (typeof global.Event === 'function' && typeof targetEl.dispatchEvent === 'function') {
          targetEl.dispatchEvent(new global.Event('input', { bubbles: true }));
          targetEl.dispatchEvent(new global.Event('change', { bubbles: true }));
        }
        return true;
      }
      targetEl.textContent = text;
      if (typeof global.Event === 'function' && typeof targetEl.dispatchEvent === 'function') {
        targetEl.dispatchEvent(new global.Event('input', { bubbles: true }));
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function createSelectionUI(options) {
    const opts = options || {};
    const sendMessage = opts.sendMessage;
    const onTogglePage = typeof opts.onTogglePage === 'function' ? opts.onTogglePage : function () {};
    const onChangeDisplayMode =
      typeof opts.onChangeDisplayMode === 'function' ? opts.onChangeDisplayMode : function () {};
    const onChangeTargetLang =
      typeof opts.onChangeTargetLang === 'function' ? opts.onChangeTargetLang : function () {};
    const onSaveSettings =
      typeof opts.onSaveSettings === 'function' ? opts.onSaveSettings : null;

    const baseLoomConfig = {
      baseUrl: 'http://127.0.0.1:4319/v1',
      apiKey: '',
      provider: 'zenmux',
      model: 'zenmux/anthropic/claude-sonnet-5.5'
    };
    const baseOpenAIConfig = {
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      model: 'gpt-4o-mini'
    };
    const baseCodexConfig = {
      baseUrl: 'https://chatgpt.com/backend-api',
      model: 'gpt-5.6-luna',
      reasoningEffort: 'low',
      accessToken: '',
      refreshToken: '',
      accountId: '',
      expiresAt: 0,
      email: '',
      planType: ''
    };

    const rawInitSettings = opts.settings || {};
    let settings = Object.assign(
      {
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        displayMode: 'replace',
        engine: 'google-free',
        selectionMode: 'icon',
        showFloatingBall: true
      },
      rawInitSettings,
      {
        loomConfig: Object.assign({}, baseLoomConfig, rawInitSettings.loomConfig || {}),
        openaiConfig: Object.assign({}, baseOpenAIConfig, rawInitSettings.openaiConfig || {}),
        codexConfig: Object.assign({}, baseCodexConfig, rawInitSettings.codexConfig || {})
      }
    );
    let isExcluded = Boolean(opts.isExcluded);
    let pageStatus = {
      isTranslated: false,
      translatedCount: 0,
      displayMode: settings.displayMode,
      targetLang: settings.targetLang
    };

    let rootContainer = null;
    let progressEl = null;
    let progressBarEl = null;
    let triggerBtn = null;
    let popoverEl = null;
    let fabWrapEl = null;
    let fabBallBtn = null;
    let fabPanelEl = null;
    let fabDotEl = null;
    let fabPrimaryBtn = null;
    let fabStatusText = null;
    let sidebarEl = null;

    let pendingSelection = null;
    let currentPopoverText = '';
    let currentPopoverTargetLang = settings.targetLang || 'zh-CN';
    let currentTranslatedText = '';
    let popoverRequestId = 0;
    let isSpeaking = false;
    let copyTimer = null;
    let progressHideTimer = null;
    let fabOpen = false;
    let listenersBound = false;

    // Sidebar AI state
    let sidebarOpen = false;
    let activeSidebarTab = 'chat';
    let includePageContext = true;
    let enableThinking = true;
    let chatQuotedText = '';
    let pendingChatImages = [];
    let chatMessages = [];
    let activeChatSessionId = '';
    let activeSessionPageMeta = null;
    let chatHistoryOpen = false;
    let chatHistoryQuery = '';
    let chatHistorySessions = [];
    let chatHistoryRequestId = 0;
    let chatLoading = false;
    let chatRequestId = 0;
    let summaryRequestId = 0;
    let writeRequestId = 0;
    let currentSummaryText = '';
    let currentWriteOutput = '';
    let lastFocusedEditable = null;
    let modelHintTimer = null;
    let sidebarNoticeTimer = null;
    let streamSeq = 0;

    const translationCache = new Map();
    const extraCleanupCallbacks = [];
    const activeStreamCallbacks = Object.create(null);

    function renderStreamingPaneResult(targetEl, paneOpts) {
      if (!targetEl) return;
      const p = paneOpts || {};
      targetEl.innerHTML = '';
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
        body.className = p.markdownClass || 'wt-summary-markdown';
        renderMarkdownToElement(body, p.reply);
        targetEl.appendChild(body);
      }
      if (p.streaming && !p.reply) {
        const loadWrap = document.createElement('span');
        loadWrap.className = 'wt-result-loading';
        loadWrap.innerHTML = `<span class="wt-spinner"></span><span>${p.loadingText || 'AI 正在思考...'}</span>`;
        targetEl.appendChild(loadWrap);
      }
    }

    // Popover elements
    let sourceBadgeEl = null;
    let sourcePreviewEl = null;
    let resultAreaEl = null;
    let copyBtnEl = null;
    let speakBtnEl = null;
    let engineTagEl = null;
    let tabButtons = [];
    let fabModeButtons = [];
    let fabLangButtons = [];

    // Sidebar DOM refs
    let sidebarModelSelect = null;
    let sidebarModelHint = null;
    let sidebarHistoryBtn = null;
    let sidebarNewChatBtn = null;
    let sidebarTabButtons = [];
    let sidebarPaneEls = {};
    let chatContextCheckbox = null;
    let chatThinkingCheckbox = null;
    let chatPageImgHintEl = null;
    let chatSessionBannerEl = null;
    let chatSessionBannerTextEl = null;
    let chatSessionLinkEl = null;
    let chatSessionResetBtn = null;
    let chatHistoryPanelEl = null;
    let chatHistorySearchEl = null;
    let chatHistoryClearAllBtn = null;
    let chatHistoryListEl = null;
    let chatQuoteWrap = null;
    let chatQuoteTextEl = null;
    let chatImageStripEl = null;
    let chatImageInputEl = null;
    let chatImageBtn = null;
    let chatListEl = null;
    let chatInputEl = null;
    let chatSendBtn = null;
    let summaryPageTitleEl = null;
    let summaryCharCountEl = null;
    let summaryResultEl = null;
    let summaryCopyBtn = null;
    let summaryFollowupBtn = null;
    let writeInputEl = null;
    let writeResultEl = null;
    let writeCopyBtn = null;
    let writeInsertBtn = null;
    let writeStatusEl = null;

    function ensureRoot() {
      const existing = document.getElementById('wt-root-container');
      if (existing && existing === rootContainer) return rootContainer;
      if (existing && existing !== rootContainer) {
        existing.remove();
      }

      rootContainer = document.createElement('div');
      rootContainer.id = 'wt-root-container';
      rootContainer.className = 'notranslate';
      rootContainer.setAttribute('translate', 'no');
      rootContainer.setAttribute('data-wt-ignore', 'true');

      buildPageProgress();
      buildTriggerButton();
      buildPopover();
      buildFloatingBall();
      buildSidebar();

      const host = document.documentElement || document.body;
      if (host) {
        host.appendChild(rootContainer);
      }
      syncFloatingBallVisibility();
      syncFloatingBallState();
      syncSidebarModelSelect();
      return rootContainer;
    }

    function buildPageProgress() {
      progressEl = document.createElement('div');
      progressEl.className = 'wt-page-progress wt-hidden';
      progressBarEl = document.createElement('div');
      progressBarEl.className = 'wt-page-progress-bar';
      progressBarEl.style.width = '0%';
      progressEl.appendChild(progressBarEl);
      rootContainer.appendChild(progressEl);
    }

    function buildTriggerButton() {
      triggerBtn = document.createElement('button');
      triggerBtn.type = 'button';
      triggerBtn.className = 'wt-sel-trigger wt-hidden';
      triggerBtn.title = '翻译选中文本';
      triggerBtn.innerHTML = `${SVG_TRANSLATE}<span>译</span>`;

      triggerBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      triggerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pendingSelection && pendingSelection.text) {
          const { text, rect } = pendingSelection;
          hideTrigger();
          openPopover(text, settings.targetLang, rect);
        }
      });

      rootContainer.appendChild(triggerBtn);
    }

    function buildPopover() {
      popoverEl = document.createElement('div');
      popoverEl.className = 'wt-popover wt-hidden';
      popoverEl.setAttribute('role', 'dialog');
      popoverEl.setAttribute('aria-label', 'Gloss 划词翻译');

      // Header
      const header = document.createElement('div');
      header.className = 'wt-popover-header';

      const titleGroup = document.createElement('div');
      titleGroup.className = 'wt-popover-title-group';

      const logo = document.createElement('span');
      logo.className = 'wt-popover-logo';
      logo.innerHTML = SVG_TRANSLATE;

      sourceBadgeEl = document.createElement('span');
      sourceBadgeEl.className = 'wt-source-badge';
      sourceBadgeEl.textContent = '自动检测';

      titleGroup.appendChild(logo);
      titleGroup.appendChild(sourceBadgeEl);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'wt-popover-close';
      closeBtn.title = '关闭';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePopover();
      });

      header.appendChild(titleGroup);
      header.appendChild(closeBtn);
      makePopoverDraggable(header);

      // 3 Target Language Tabs
      const tabsRow = document.createElement('div');
      tabsRow.className = 'wt-lang-tabs';
      tabButtons = TARGET_TABS.map((tab) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wt-lang-tab';
        btn.setAttribute('data-lang', tab.code);
        btn.textContent = tab.label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!currentPopoverText) return;
          currentPopoverTargetLang = tab.code;
          updatePopoverTabs();
          translatePopoverText(currentPopoverText, currentPopoverTargetLang);
        });
        tabsRow.appendChild(btn);
        return btn;
      });

      // Body
      const body = document.createElement('div');
      body.className = 'wt-popover-body';

      sourcePreviewEl = document.createElement('div');
      sourcePreviewEl.className = 'wt-source-preview';

      resultAreaEl = document.createElement('div');
      resultAreaEl.className = 'wt-result-area';

      body.appendChild(sourcePreviewEl);
      body.appendChild(resultAreaEl);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'wt-popover-footer';

      const actions = document.createElement('div');
      actions.className = 'wt-popover-actions';

      copyBtnEl = document.createElement('button');
      copyBtnEl.type = 'button';
      copyBtnEl.className = 'wt-action-btn';
      copyBtnEl.innerHTML = `${SVG_COPY}<span>复制</span>`;
      copyBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        copyTranslation();
      });

      speakBtnEl = document.createElement('button');
      speakBtnEl.type = 'button';
      speakBtnEl.className = 'wt-action-btn';
      speakBtnEl.innerHTML = `${SVG_SPEAK}<span>朗读</span>`;
      speakBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSpeakTranslation();
      });

      actions.appendChild(copyBtnEl);
      actions.appendChild(speakBtnEl);

      engineTagEl = document.createElement('span');
      engineTagEl.className = 'wt-engine-tag';
      engineTagEl.textContent = ENGINE_DISPLAY[settings.engine] || settings.engine;

      footer.appendChild(actions);
      footer.appendChild(engineTagEl);

      // Sider AI Popover Action Bar
      const aiBar = document.createElement('div');
      aiBar.className = 'wt-popover-ai-bar';
      POPOVER_AI_ACTIONS.forEach((item) => {
        const aiBtn = document.createElement('button');
        aiBtn.type = 'button';
        aiBtn.className = 'wt-popover-ai-btn';
        aiBtn.setAttribute('data-ai-action', item.action);
        aiBtn.textContent = item.label;
        aiBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const selectedText = currentPopoverText;
          if (!selectedText) return;
          closePopover();
          if (item.action === 'polish') {
            openSidebarAction({ action: 'polish', text: selectedText, tab: 'write', autoRun: true });
          } else if (item.action === 'chat') {
            openSidebarAction({ action: 'chat', text: selectedText, tab: 'chat', autoRun: false });
          } else {
            openSidebarAction({ action: item.action, text: selectedText, tab: 'chat', autoRun: true });
          }
        });
        aiBar.appendChild(aiBtn);
      });

      popoverEl.appendChild(header);
      popoverEl.appendChild(tabsRow);
      popoverEl.appendChild(body);
      popoverEl.appendChild(aiBar);
      popoverEl.appendChild(footer);

      popoverEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });

      rootContainer.appendChild(popoverEl);
    }

    function makePopoverDraggable(handle) {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;

      handle.addEventListener('mousedown', (e) => {
        if (e.target && e.target.closest('.wt-popover-close')) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = popoverEl.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        e.preventDefault();
      });

      const onMouseMove = (e) => {
        if (!dragging || !popoverEl) return;
        const vw = global.innerWidth || 1024;
        const vh = global.innerHeight || 768;
        const w = popoverEl.offsetWidth || 356;
        const h = popoverEl.offsetHeight || 220;
        const nextLeft = clamp(startLeft + (e.clientX - startX), 8, Math.max(8, vw - w - 8));
        const nextTop = clamp(startTop + (e.clientY - startY), 8, Math.max(8, vh - h - 8));
        popoverEl.style.left = `${nextLeft}px`;
        popoverEl.style.top = `${nextTop}px`;
      };

      const onMouseUp = () => {
        dragging = false;
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      extraCleanupCallbacks.push(() => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      });
    }

    function buildFloatingBall() {
      fabWrapEl = document.createElement('div');
      fabWrapEl.className = 'wt-fab-wrap';

      fabPanelEl = document.createElement('div');
      fabPanelEl.className = 'wt-fab-panel wt-hidden';

      const head = document.createElement('div');
      head.className = 'wt-fab-panel-head';
      const headTitle = document.createElement('span');
      headTitle.textContent = 'Gloss 翻译';
      fabStatusText = document.createElement('span');
      fabStatusText.className = 'wt-fab-status-text';
      fabStatusText.textContent = '未翻译';
      head.appendChild(headTitle);
      head.appendChild(fabStatusText);

      fabPrimaryBtn = document.createElement('button');
      fabPrimaryBtn.type = 'button';
      fabPrimaryBtn.className = 'wt-fab-primary-btn';
      fabPrimaryBtn.textContent = '整页翻译';
      fabPrimaryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onTogglePage();
      });

      // Display Mode Row
      const modeRow = document.createElement('div');
      modeRow.className = 'wt-fab-row';
      const modeLabel = document.createElement('span');
      modeLabel.className = 'wt-fab-label';
      modeLabel.textContent = '显示模式';
      const modeSeg = document.createElement('div');
      modeSeg.className = 'wt-fab-seg wt-cols-2';

      fabModeButtons = [
        { mode: 'replace', label: '原地替换' },
        { mode: 'bilingual', label: '双语对照' }
      ].map((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wt-fab-seg-btn';
        btn.setAttribute('data-mode', item.mode);
        btn.textContent = item.label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onChangeDisplayMode(item.mode);
        });
        modeSeg.appendChild(btn);
        return btn;
      });
      modeRow.appendChild(modeLabel);
      modeRow.appendChild(modeSeg);

      // Target Language Row
      const langRow = document.createElement('div');
      langRow.className = 'wt-fab-row';
      const langLabel = document.createElement('span');
      langLabel.className = 'wt-fab-label';
      langLabel.textContent = '目标语言';
      const langSeg = document.createElement('div');
      langSeg.className = 'wt-fab-seg wt-cols-3';

      fabLangButtons = TARGET_TABS.map((tab) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wt-fab-seg-btn';
        btn.setAttribute('data-lang', tab.code);
        btn.textContent = tab.shortLabel;
        btn.title = tab.label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onChangeTargetLang(tab.code);
        });
        langSeg.appendChild(btn);
        return btn;
      });
      langRow.appendChild(langLabel);
      langRow.appendChild(langSeg);

      // Sider AI Quick Actions inside Floating Ball Panel
      const fabAiRow = document.createElement('div');
      fabAiRow.className = 'wt-fab-ai-row';

      const fabSidebarBtn = document.createElement('button');
      fabSidebarBtn.type = 'button';
      fabSidebarBtn.className = 'wt-fab-ai-btn';
      fabSidebarBtn.setAttribute('data-wt-fab-action', 'sidebar');
      fabSidebarBtn.textContent = '💬 AI 侧边栏 (Alt+S)';
      fabSidebarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fabOpen = false;
        syncFloatingBallPanel();
        toggleSidebar({ open: true });
      });

      const fabSummaryBtn = document.createElement('button');
      fabSummaryBtn.type = 'button';
      fabSummaryBtn.className = 'wt-fab-ai-btn';
      fabSummaryBtn.setAttribute('data-wt-fab-action', 'summarize');
      fabSummaryBtn.textContent = '📄 总结本页';
      fabSummaryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fabOpen = false;
        syncFloatingBallPanel();
        openSidebarAction({ action: 'summarize_page', tab: 'summary', autoRun: true });
      });

      fabAiRow.appendChild(fabSidebarBtn);
      fabAiRow.appendChild(fabSummaryBtn);

      fabPanelEl.appendChild(head);
      fabPanelEl.appendChild(fabPrimaryBtn);
      fabPanelEl.appendChild(fabAiRow);
      fabPanelEl.appendChild(modeRow);
      fabPanelEl.appendChild(langRow);

      fabBallBtn = document.createElement('button');
      fabBallBtn.type = 'button';
      fabBallBtn.className = 'wt-fab-ball';
      fabBallBtn.title = 'Gloss 快捷翻译面板';
      fabBallBtn.innerHTML = SVG_TRANSLATE;

      fabDotEl = document.createElement('span');
      fabDotEl.className = 'wt-fab-dot wt-hidden';
      fabBallBtn.appendChild(fabDotEl);

      // Drag & click on floating ball
      let ballDragging = false;
      let ballMoved = false;
      let startY = 0;
      let startBottom = 72;

      fabBallBtn.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        ballDragging = true;
        ballMoved = false;
        startY = e.clientY;
        const rect = fabWrapEl.getBoundingClientRect();
        const vh = global.innerHeight || 768;
        startBottom = Math.max(16, vh - rect.bottom);
        e.stopPropagation();
      });

      const onBallMouseMove = (e) => {
        if (!ballDragging || !fabWrapEl) return;
        const deltaY = e.clientY - startY;
        if (Math.abs(deltaY) > 5) {
          ballMoved = true;
        }
        if (ballMoved) {
          const vh = global.innerHeight || 768;
          const nextBottom = clamp(startBottom - deltaY, 16, Math.max(16, vh - 80));
          fabWrapEl.style.bottom = `${nextBottom}px`;
        }
      };

      const onBallMouseUp = () => {
        ballDragging = false;
      };

      document.addEventListener('mousemove', onBallMouseMove);
      document.addEventListener('mouseup', onBallMouseUp);
      extraCleanupCallbacks.push(() => {
        document.removeEventListener('mousemove', onBallMouseMove);
        document.removeEventListener('mouseup', onBallMouseUp);
      });

      fabBallBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (ballMoved) {
          ballMoved = false;
          return;
        }
        fabOpen = !fabOpen;
        syncFloatingBallPanel();
      });

      fabWrapEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });

      fabWrapEl.appendChild(fabPanelEl);
      fabWrapEl.appendChild(fabBallBtn);
      rootContainer.appendChild(fabWrapEl);
    }

    function persistSettingsPatch(partial) {
      if (onSaveSettings) {
        onSaveSettings(partial);
        return;
      }
      if (typeof sendMessage === 'function') {
        sendMessage({ type: 'SAVE_SETTINGS', payload: partial }).catch(() => null);
      }
    }

    function showModelSwitchHint(msg) {
      if (!sidebarModelHint) return;
      sidebarModelHint.textContent = msg;
      sidebarModelHint.classList.remove('wt-hidden');
      if (modelHintTimer) clearTimeout(modelHintTimer);
      modelHintTimer = setTimeout(() => {
        modelHintTimer = null;
        if (sidebarModelHint) {
          sidebarModelHint.classList.add('wt-hidden');
        }
      }, 2200);
    }

    function populateModelSelect() {
      if (!sidebarModelSelect) return;
      sidebarModelSelect.innerHTML = '';
      const providers = getLoomProviderList();
      const codexModels = getCodexModelList();
      const knownIds = new Set();

      if (codexModels.length > 0) {
        const codexGroup = document.createElement('optgroup');
        const codexLabel = 'OpenAI Codex 订阅 (ChatGPT Plus/Pro)';
        codexGroup.label = codexLabel;
        codexGroup.setAttribute('label', codexLabel);
        for (let i = 0; i < codexModels.length; i += 1) {
          const m = codexModels[i];
          const val = `codex:${m.id}`;
          knownIds.add(val);
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = m.name || m.id;
          codexGroup.appendChild(opt);
        }
        sidebarModelSelect.appendChild(codexGroup);
      }

      for (let i = 0; i < providers.length; i += 1) {
        const provider = providers[i];
        const group = document.createElement('optgroup');
        const groupLabel = provider.name || provider.id;
        group.label = groupLabel;
        group.setAttribute('label', groupLabel);
        const models = provider.models || [];
        for (let j = 0; j < models.length; j += 1) {
          const m = models[j];
          knownIds.add(m.id);
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.name || m.id;
          group.appendChild(opt);
        }
        sidebarModelSelect.appendChild(group);
      }

      const activeValue =
        settings.engine === 'codex'
          ? `codex:${(settings.codexConfig && settings.codexConfig.model) || 'gpt-5.6-luna'}`
          : (settings.loomConfig && settings.loomConfig.model) || '';
      if (activeValue && !knownIds.has(activeValue)) {
        const customOpt = document.createElement('option');
        customOpt.value = activeValue;
        customOpt.textContent = formatModelDisplayName(activeValue);
        sidebarModelSelect.appendChild(customOpt);
      }
    }

    function syncSidebarModelSelect() {
      if (!sidebarModelSelect) return;
      const activeModel =
        settings.engine === 'codex'
          ? `codex:${(settings.codexConfig && settings.codexConfig.model) || 'gpt-5.6-luna'}`
          : (settings.loomConfig && settings.loomConfig.model) ||
            'zenmux/anthropic/claude-sonnet-5.5';
      const optionsList = sidebarModelSelect.querySelectorAll('option');
      let matched = false;
      for (let i = 0; i < optionsList.length; i += 1) {
        const isCurrent = optionsList[i].value === activeModel;
        optionsList[i].selected = isCurrent;
        if (isCurrent) {
          optionsList[i].setAttribute('selected', 'selected');
          matched = true;
        } else {
          optionsList[i].removeAttribute('selected');
        }
      }
      if (!matched) {
        populateModelSelect();
        const refreshed = sidebarModelSelect.querySelectorAll('option');
        for (let i = 0; i < refreshed.length; i += 1) {
          if (refreshed[i].value === activeModel) {
            refreshed[i].selected = true;
            refreshed[i].setAttribute('selected', 'selected');
          }
        }
      }
      sidebarModelSelect.value = activeModel;
    }

    function refreshPageImageHint(ctxArg) {
      if (!chatPageImgHintEl) return;
      if (!includePageContext) {
        chatPageImgHintEl.textContent = '';
        chatPageImgHintEl.classList.add('wt-hidden');
        return;
      }
      const ctx = ctxArg || extractPageContext();
      const count = Array.isArray(ctx?.images) ? ctx.images.length : 0;
      if (count > 0) {
        chatPageImgHintEl.textContent = `🖼️ 已捕获本页 ${count} 图`;
        chatPageImgHintEl.classList.remove('wt-hidden');
      } else {
        chatPageImgHintEl.textContent = '';
        chatPageImgHintEl.classList.add('wt-hidden');
      }
    }

    function refreshSummaryMeta() {
      if (!summaryPageTitleEl || !summaryCharCountEl) return;
      const ctx = extractPageContext();
      summaryPageTitleEl.textContent = ctx.title || ctx.url || '当前网页';
      summaryPageTitleEl.title = ctx.url || ctx.title || '';
      const imgCount = Array.isArray(ctx.images) ? ctx.images.length : 0;
      summaryCharCountEl.textContent =
        imgCount > 0
          ? `已提取 ${ctx.content.length} 字 · ${imgCount} 张图片`
          : `已提取 ${ctx.content.length} 字正文`;
      refreshPageImageHint(ctx);
      return ctx;
    }

    function formatChatSessionTime(ts) {
      if (!ts || !Number.isFinite(Number(ts))) return '';
      try {
        const d = new Date(Number(ts));
        const now = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        if (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        ) {
          return `${hh}:${mm}`;
        }
        return `${d.getMonth() + 1}-${d.getDate()} ${hh}:${mm}`;
      } catch (_) {
        return '';
      }
    }

    function updateSidebarHistoryButtonLabel() {
      if (!sidebarHistoryBtn) return;
      const count = Array.isArray(chatHistorySessions) ? chatHistorySessions.length : 0;
      sidebarHistoryBtn.textContent = count > 0 ? `🕒 历史(${count})` : '🕒 历史';
      sidebarHistoryBtn.classList.toggle('wt-active', Boolean(chatHistoryOpen));
    }

    function renderChatSessionBanner() {
      if (!chatSessionBannerEl || !chatSessionBannerTextEl) return;
      if (activeSessionPageMeta && (activeSessionPageMeta.pageUrl || activeSessionPageMeta.pageTitle)) {
        const hostLabel = activeSessionPageMeta.hostname || '';
        const titleLabel = activeSessionPageMeta.pageTitle || activeSessionPageMeta.pageUrl || '历史网页';
        chatSessionBannerTextEl.textContent = hostLabel
          ? `📄 历史网页：${hostLabel} · ${titleLabel}`
          : `📄 历史网页：${titleLabel}`;
        chatSessionBannerTextEl.title = activeSessionPageMeta.pageUrl || titleLabel;
        if (chatSessionLinkEl) {
          const url = activeSessionPageMeta.pageUrl || '';
          if (/^https?:\/\//i.test(url)) {
            chatSessionLinkEl.href = url;
            chatSessionLinkEl.setAttribute('href', url);
            chatSessionLinkEl.classList.remove('wt-hidden');
          } else {
            chatSessionLinkEl.classList.add('wt-hidden');
          }
        }
        chatSessionBannerEl.classList.remove('wt-hidden');
      } else {
        chatSessionBannerEl.classList.add('wt-hidden');
        if (chatSessionLinkEl) {
          chatSessionLinkEl.classList.add('wt-hidden');
        }
      }
    }

    function renderChatHistoryList() {
      updateSidebarHistoryButtonLabel();
      if (!chatHistoryListEl) return;
      chatHistoryListEl.innerHTML = '';

      if (!Array.isArray(chatHistorySessions) || chatHistorySessions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'wt-chat-history-empty';
        empty.textContent = chatHistoryQuery
          ? `未找到包含“${chatHistoryQuery}”的历史网页会话`
          : '暂无历史网页会话，发起对话后将自动按网页保存';
        chatHistoryListEl.appendChild(empty);
        return;
      }

      for (let i = 0; i < chatHistorySessions.length; i += 1) {
        const sess = chatHistorySessions[i];
        if (!sess || typeof sess !== 'object') continue;
        const item = document.createElement('div');
        item.className =
          sess.id && sess.id === activeChatSessionId
            ? 'wt-chat-history-item wt-active'
            : 'wt-chat-history-item';
        item.setAttribute('data-session-id', sess.id || '');

        const top = document.createElement('div');
        top.className = 'wt-chat-history-top';

        const pageEl = document.createElement('span');
        pageEl.className = 'wt-chat-history-page';
        const host = sess.hostname || '自由对话';
        const pTitle = sess.pageTitle || sess.pageUrl || '未命名网页';
        pageEl.textContent = `🌐 ${host} · ${pTitle}`;
        pageEl.title = sess.pageUrl || pTitle;

        const metaWrap = document.createElement('div');
        metaWrap.className = 'wt-chat-history-meta';

        const timeEl = document.createElement('span');
        timeEl.className = 'wt-chat-history-time';
        timeEl.textContent = formatChatSessionTime(sess.updatedAt);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'wt-chat-history-del';
        delBtn.setAttribute('data-delete-session-id', sess.id || '');
        delBtn.title = '删除该会话';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteSidebarChatSession(sess.id || '');
        });

        metaWrap.appendChild(timeEl);
        metaWrap.appendChild(delBtn);
        top.appendChild(pageEl);
        top.appendChild(metaWrap);

        const titleEl = document.createElement('div');
        titleEl.className = 'wt-chat-history-title';
        const msgCount = Array.isArray(sess.messages) ? sess.messages.length : 0;
        titleEl.textContent = `${sess.title || pTitle} (${msgCount}条)`;

        item.appendChild(top);
        item.appendChild(titleEl);

        if (sess.matchSnippet) {
          const snippetEl = document.createElement('div');
          snippetEl.className = 'wt-chat-history-snippet';
          snippetEl.textContent = sess.matchSnippet;
          item.appendChild(snippetEl);
        }

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          restoreSidebarChatSession(sess);
        });

        chatHistoryListEl.appendChild(item);
      }
    }

    async function fetchSidebarChatSessions(queryOverride) {
      const q = typeof queryOverride === 'string' ? queryOverride : chatHistoryQuery;
      const reqId = ++chatHistoryRequestId;
      const cfg = global.WT_CONFIG;
      let sessions = [];

      if (cfg && typeof cfg.getChatSessions === 'function') {
        try {
          const localList = await cfg.getChatSessions({ query: q });
          if (Array.isArray(localList)) {
            sessions = localList;
          }
        } catch (_) {
          // Ignore local session read error
        }
      }

      if (typeof sendMessage === 'function') {
        try {
          const res = await sendMessage({
            type: 'GET_HISTORY',
            payload: { kind: 'chat_sessions', query: q }
          });
          if (res && res.ok && res.kind === 'chat_sessions' && Array.isArray(res.data)) {
            sessions = res.data;
          }
        } catch (_) {
          // Fallback to WT_CONFIG result
        }
      }

      if (reqId !== chatHistoryRequestId) return sessions;
      chatHistorySessions = Array.isArray(sessions) ? sessions : [];
      renderChatHistoryList();
      return chatHistorySessions;
    }

    async function persistSidebarChatSession(ctx) {
      const validMessages = chatMessages.filter((m) => m && !m.loading && !m.isError);
      if (validMessages.length === 0) return null;

      const cfg = global.WT_CONFIG;
      const fallbackUrl = (global.location && global.location.href) || '';
      const fallbackTitle = (typeof document !== 'undefined' && document.title) || '';
      const pageUrl =
        (activeSessionPageMeta && activeSessionPageMeta.pageUrl) ||
        (ctx && ctx.url) ||
        fallbackUrl;
      const pageTitle =
        (activeSessionPageMeta && activeSessionPageMeta.pageTitle) ||
        (ctx && ctx.title) ||
        fallbackTitle ||
        pageUrl ||
        '自由对话';
      const pageExcerpt =
        (activeSessionPageMeta && activeSessionPageMeta.pageExcerpt) ||
        (ctx && typeof ctx.content === 'string' ? ctx.content.slice(0, 2400) : '');

      const sessionInput = {
        id: activeChatSessionId || undefined,
        pageUrl,
        pageTitle,
        pageExcerpt,
        messages: validMessages,
        updatedAt: Date.now()
      };

      let saved = null;
      if (cfg && typeof cfg.saveChatSession === 'function') {
        try {
          saved = await cfg.saveChatSession(sessionInput);
          if (saved && saved.id) {
            activeChatSessionId = saved.id;
          }
        } catch (_) {
          saved = null;
        }
      }

      if (typeof sendMessage === 'function') {
        try {
          const res = await sendMessage({
            type: 'GET_HISTORY',
            payload: {
              kind: 'chat_sessions',
              action: 'save',
              session: saved || sessionInput,
              query: chatHistoryQuery
            }
          });
          if (res && res.ok && res.kind === 'chat_sessions') {
            if (res.session && res.session.id) {
              activeChatSessionId = res.session.id;
              saved = res.session;
            }
            if (Array.isArray(res.data)) {
              chatHistorySessions = res.data;
              renderChatHistoryList();
              return saved;
            }
          }
        } catch (_) {
          // Fallback to WT_CONFIG result
        }
      }

      await fetchSidebarChatSessions();
      return saved;
    }

    async function deleteSidebarChatSession(sessionId) {
      if (!sessionId) return;
      const cfg = global.WT_CONFIG;
      let nextList = null;

      if (cfg && typeof cfg.deleteChatSession === 'function') {
        try {
          const localAfter = await cfg.deleteChatSession(sessionId);
          if (Array.isArray(localAfter)) {
            nextList = chatHistoryQuery
              ? await cfg.getChatSessions({ query: chatHistoryQuery })
              : localAfter;
          }
        } catch (_) {
          // Ignore
        }
      }

      if (typeof sendMessage === 'function') {
        try {
          const res = await sendMessage({
            type: 'GET_HISTORY',
            payload: { kind: 'chat_sessions', action: 'delete', sessionId }
          });
          if (res && res.ok && res.kind === 'chat_sessions' && Array.isArray(res.data)) {
            nextList = chatHistoryQuery
              ? await cfg?.getChatSessions?.({ query: chatHistoryQuery })
              : res.data;
          }
        } catch (_) {
          // Ignore
        }
      }

      if (sessionId === activeChatSessionId) {
        activeChatSessionId = '';
        activeSessionPageMeta = null;
        renderChatSessionBanner();
      }
      if (Array.isArray(nextList)) {
        chatHistorySessions = nextList;
        renderChatHistoryList();
      } else {
        await fetchSidebarChatSessions();
      }
    }

    async function clearAllSidebarChatSessions() {
      const cfg = global.WT_CONFIG;
      if (cfg && typeof cfg.clearChatSessions === 'function') {
        try {
          await cfg.clearChatSessions();
        } catch (_) {
          // Ignore
        }
      }
      if (typeof sendMessage === 'function') {
        try {
          await sendMessage({
            type: 'CLEAR_HISTORY',
            payload: { kind: 'chat_sessions' }
          });
        } catch (_) {
          // Ignore
        }
      }
      activeChatSessionId = '';
      activeSessionPageMeta = null;
      chatHistorySessions = [];
      renderChatSessionBanner();
      renderChatHistoryList();
    }

    function restoreSidebarChatSession(sess) {
      if (!sess || typeof sess !== 'object') return;
      chatRequestId += 1;
      chatLoading = false;
      if (chatSendBtn) chatSendBtn.disabled = false;

      activeChatSessionId = sess.id || '';
      activeSessionPageMeta = {
        pageUrl: sess.pageUrl || '',
        pageTitle: sess.pageTitle || sess.title || '历史网页',
        hostname: sess.hostname || '',
        pageExcerpt: sess.pageExcerpt || ''
      };
      chatMessages = Array.isArray(sess.messages)
        ? sess.messages.map((m) => Object.assign({}, m))
        : [];
      chatQuotedText = '';
      pendingChatImages = [];
      chatHistoryOpen = false;
      if (chatHistoryPanelEl) {
        chatHistoryPanelEl.classList.add('wt-hidden');
      }

      setSidebarTab('chat');
      renderChatQuote();
      renderPendingChatImages();
      renderChatSessionBanner();
      renderChatList();
      updateSidebarHistoryButtonLabel();
    }

    function startNewSidebarChat() {
      chatRequestId += 1;
      chatLoading = false;
      if (chatSendBtn) chatSendBtn.disabled = false;
      activeChatSessionId = '';
      activeSessionPageMeta = null;
      chatMessages = [];
      chatQuotedText = '';
      pendingChatImages = [];
      chatHistoryOpen = false;
      if (chatHistoryPanelEl) {
        chatHistoryPanelEl.classList.add('wt-hidden');
      }
      renderChatQuote();
      renderPendingChatImages();
      renderChatSessionBanner();
      renderChatList();
      updateSidebarHistoryButtonLabel();
    }

    function renderChatQuote() {
      if (!chatQuoteWrap || !chatQuoteTextEl) return;
      if (chatQuotedText) {
        const preview =
          chatQuotedText.length > 160
            ? chatQuotedText.slice(0, 160).trimEnd() + '...'
            : chatQuotedText;
        chatQuoteTextEl.textContent = preview;
        chatQuoteWrap.classList.remove('wt-hidden');
      } else {
        chatQuoteTextEl.textContent = '';
        chatQuoteWrap.classList.add('wt-hidden');
      }
    }

    function renderPendingChatImages() {
      if (!chatImageStripEl) return;
      chatImageStripEl.innerHTML = '';
      if (!Array.isArray(pendingChatImages) || pendingChatImages.length === 0) {
        chatImageStripEl.classList.add('wt-hidden');
        return;
      }
      chatImageStripEl.classList.remove('wt-hidden');
      for (let i = 0; i < pendingChatImages.length; i += 1) {
        const imgObj = pendingChatImages[i];
        const card = document.createElement('div');
        card.className = 'wt-chat-image-chip';
        const thumb = document.createElement('img');
        thumb.className = 'wt-chat-image-thumb';
        thumb.src = imgObj.dataUrl || imgObj.url;
        thumb.alt = imgObj.alt || `图片 ${i + 1}`;
        const rmBtn = document.createElement('button');
        rmBtn.type = 'button';
        rmBtn.className = 'wt-chat-image-remove';
        rmBtn.title = '移除图片';
        rmBtn.textContent = '×';
        rmBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          pendingChatImages.splice(i, 1);
          renderPendingChatImages();
        });
        card.appendChild(thumb);
        card.appendChild(rmBtn);
        chatImageStripEl.appendChild(card);
      }
    }

    async function addChatImagesFromFiles(fileList) {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList).filter((f) => f && /^image\//i.test(f.type || ''));
      if (files.length === 0) return;
      for (let i = 0; i < files.length; i += 1) {
        if (pendingChatImages.length >= MAX_PAGE_CONTEXT_IMAGES) break;
        const parsed = await readAndCompressImageFile(files[i]);
        if (parsed) {
          pendingChatImages.push(parsed);
        }
      }
      renderPendingChatImages();
    }

    function renderChatList() {
      if (!chatListEl) return;
      chatListEl.innerHTML = '';

      if (chatMessages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'wt-chat-empty';
        const title = document.createElement('div');
        title.className = 'wt-chat-empty-title';
        title.textContent = '👋 Gloss AI 助手';
        const desc = document.createElement('div');
        desc.className = 'wt-chat-empty-desc';
        desc.textContent =
          '勾选“关联当前网页”可同时读取本页文字与图片；支持展示思考过程，也可点击“传图”或直接 Ctrl/Cmd+V 粘贴截图提问。';
        empty.appendChild(title);
        empty.appendChild(desc);
        chatListEl.appendChild(empty);
        return;
      }

      for (let i = 0; i < chatMessages.length; i += 1) {
        const msg = chatMessages[i];
        const row = document.createElement('div');
        row.className = `wt-chat-msg wt-chat-msg-${msg.role}`;

        if (msg.role === 'user') {
          if (msg.quoteText) {
            const q = document.createElement('div');
            q.className = 'wt-chat-msg-quote';
            q.textContent =
              msg.quoteText.length > 120
                ? msg.quoteText.slice(0, 120).trimEnd() + '...'
                : msg.quoteText;
            row.appendChild(q);
          }
          if (Array.isArray(msg.images) && msg.images.length > 0) {
            const imgWrap = document.createElement('div');
            imgWrap.className = 'wt-chat-msg-images';
            for (let k = 0; k < msg.images.length; k += 1) {
              const im = msg.images[k];
              const thumb = document.createElement('img');
              thumb.className = 'wt-chat-msg-thumb';
              thumb.src = im.dataUrl || im.url;
              thumb.alt = im.alt || `附图 ${k + 1}`;
              imgWrap.appendChild(thumb);
            }
            row.appendChild(imgWrap);
          }
          const content = document.createElement('div');
          content.className = 'wt-chat-msg-text';
          content.textContent = msg.content || '';
          row.appendChild(content);
        } else {
          if (msg.loading) {
            if (msg.reasoning || msg.enableThinking) {
              const liveThinkingEl = createThinkingElement(msg.reasoning, msg.thinkingMs, {
                streaming: !msg.content
              });
              if (liveThinkingEl) {
                row.appendChild(liveThinkingEl);
              }
            }
            if (msg.content) {
              const liveBody = document.createElement('div');
              liveBody.className = 'wt-chat-msg-markdown';
              renderMarkdownToElement(liveBody, msg.content);
              row.appendChild(liveBody);
            } else {
              row.classList.add('wt-loading');
            }
            const loadWrap = document.createElement('span');
            loadWrap.className = 'wt-result-loading';
            loadWrap.innerHTML = `<span class="wt-spinner"></span><span>${msg.content ? 'AI 正在生成回答...' : 'AI 正在思考...'}</span>`;
            row.appendChild(loadWrap);
          } else if (msg.isError) {
            row.classList.add('wt-error');
            const errText = document.createElement('div');
            errText.textContent = `请求失败: ${msg.content || '请稍后重试'}`;
            row.appendChild(errText);
          } else {
            const thinkingEl = createThinkingElement(msg.reasoning, msg.thinkingMs);
            if (thinkingEl) {
              row.appendChild(thinkingEl);
            }
            const body = document.createElement('div');
            body.className = 'wt-chat-msg-markdown';
            renderMarkdownToElement(body, msg.content || '');
            row.appendChild(body);

            const meta = document.createElement('div');
            meta.className = 'wt-chat-msg-meta';
            const modelTag = document.createElement('span');
            modelTag.className = 'wt-chat-msg-model';
            modelTag.textContent = msg.isFallback
              ? `${ENGINE_DISPLAY[msg.engine] || '免费引擎'} · 降级`
              : formatModelDisplayName(msg.modelLabel);
            const msgCopyBtn = document.createElement('button');
            msgCopyBtn.type = 'button';
            msgCopyBtn.className = 'wt-chat-msg-copy';
            msgCopyBtn.textContent = '复制';
            msgCopyBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const ok = await copyTextToClipboard(msg.content || '');
              if (ok) {
                msgCopyBtn.textContent = '已复制 ✓';
                setTimeout(() => {
                  msgCopyBtn.textContent = '复制';
                }, 1400);
              }
            });
            meta.appendChild(modelTag);
            meta.appendChild(msgCopyBtn);
            row.appendChild(meta);
          }
        }
        chatListEl.appendChild(row);
      }

      chatListEl.scrollTop = chatListEl.scrollHeight;
    }

    async function sendAIChatRequest(payload) {
      if (typeof sendMessage !== 'function') {
        throw new Error('消息通道不可用');
      }
      const rawSelected =
        (sidebarModelSelect && sidebarModelSelect.value) ||
        (settings.engine === 'codex'
          ? `codex:${(settings.codexConfig && settings.codexConfig.model) || 'gpt-5.6-luna'}`
          : (settings.loomConfig && settings.loomConfig.model) || '');
      const isCodexSelected = String(rawSelected).startsWith('codex:');
      const selectedModel = isCodexSelected
        ? String(rawSelected).slice('codex:'.length)
        : rawSelected;
      const selectedProvider = isCodexSelected
        ? 'codex'
        : findProviderForModel(selectedModel) ||
          (settings.loomConfig && settings.loomConfig.provider) ||
          '';
      const useThinking =
        typeof payload.enableThinking === 'boolean' ? payload.enableThinking : enableThinking;
      const streamId =
        typeof payload.streamId === 'string' && payload.streamId.trim()
          ? payload.streamId.trim()
          : `wt-stream-${Date.now()}-${++streamSeq}`;
      if (typeof payload.onProgress === 'function') {
        activeStreamCallbacks[streamId] = payload.onProgress;
      }
      try {
        const res = await sendMessage({
          type: 'AI_CHAT',
          payload: {
            messages: payload.messages || [],
            prompt: payload.prompt || '',
            taskType: payload.taskType || 'chat',
            selectionText: payload.selectionText || '',
            pageContext: payload.pageContext || null,
            images: Array.isArray(payload.images) ? payload.images : [],
            enableThinking: useThinking,
            stream: true,
            streamId,
            targetLang: settings.targetLang || 'zh-CN',
            engine: settings.engine || 'google-free',
            model: selectedModel,
            provider: selectedProvider,
            loomConfig: settings.loomConfig || {},
            openaiConfig: settings.openaiConfig || {},
            codexConfig: settings.codexConfig || {}
          }
        });
        if (!res || !res.ok || !res.data) {
          throw new Error((res && res.error) || 'AI 服务无响应');
        }
        return res.data;
      } finally {
        delete activeStreamCallbacks[streamId];
      }
    }

    async function sendChatMessage(promptText, optsArg) {
      const prompt = (promptText || '').trim();
      const extra = optsArg || {};
      const taskType = extra.taskType || 'chat';
      const selectionText =
        typeof extra.selectionText === 'string' ? extra.selectionText : chatQuotedText;
      const attachedImages = Array.isArray(extra.images) && extra.images.length > 0
        ? extra.images.slice(0, MAX_PAGE_CONTEXT_IMAGES)
        : [];

      if (!prompt && !selectionText && attachedImages.length === 0) return;

      const userText = prompt || selectionText || '请结合图片内容进行分析与解读。';
      const reqId = ++chatRequestId;
      const useThinking = Boolean(enableThinking);
      const historyForApi = chatMessages
        .filter((m) => !m.loading && !m.isError)
        .map((m) =>
          Array.isArray(m.images) && m.images.length > 0
            ? { role: m.role, content: m.content, images: m.images }
            : { role: m.role, content: m.content }
        );

      chatMessages.push({
        role: 'user',
        content: userText,
        quoteText: selectionText && selectionText !== userText ? selectionText : '',
        images: attachedImages
      });

      const assistantPlaceholder = {
        role: 'assistant',
        content: '',
        reasoning: '',
        thinkingMs: 0,
        enableThinking: useThinking,
        loading: true,
        isError: false,
        modelLabel: '',
        engine: settings.engine,
        isFallback: false
      };
      chatMessages.push(assistantPlaceholder);
      chatLoading = true;
      if (chatSendBtn) chatSendBtn.disabled = true;
      renderChatList();

      let ctx = null;
      if (includePageContext) {
        const cfg = global.WT_CONFIG || {};
        const normUrl = typeof cfg.normalizeSessionPageUrl === 'function'
          ? cfg.normalizeSessionPageUrl
          : (u) => String(u || '').trim();
        const currentUrl = normUrl((global.location && global.location.href) || '');
        const restoredUrl = activeSessionPageMeta ? normUrl(activeSessionPageMeta.pageUrl || '') : '';
        if (activeSessionPageMeta && (!currentUrl || (restoredUrl && restoredUrl !== currentUrl))) {
          ctx = {
            title: activeSessionPageMeta.pageTitle || '',
            url: activeSessionPageMeta.pageUrl || '',
            content: activeSessionPageMeta.pageExcerpt || '',
            images: []
          };
        } else {
          ctx = extractPageContext();
        }
      }
      refreshPageImageHint(ctx);

      try {
        const data = await sendAIChatRequest({
          messages: historyForApi.concat([
            attachedImages.length > 0
              ? { role: 'user', content: userText, images: attachedImages }
              : { role: 'user', content: userText }
          ]),
          prompt: userText,
          taskType,
          selectionText,
          pageContext: ctx,
          images: attachedImages,
          enableThinking: useThinking,
          onProgress: (prog) => {
            if (reqId !== chatRequestId || !prog) return;
            assistantPlaceholder.reasoning = useThinking ? (prog.reasoning || '') : '';
            assistantPlaceholder.content = prog.reply || '';
            assistantPlaceholder.thinkingMs = prog.thinkingMs || 0;
            if (prog.model) assistantPlaceholder.modelLabel = prog.model;
            renderChatList();
          }
        });
        if (reqId !== chatRequestId) return;
        assistantPlaceholder.loading = false;
        assistantPlaceholder.content = data.reply || '';
        assistantPlaceholder.reasoning = data.reasoning || '';
        assistantPlaceholder.thinkingMs = data.thinkingMs || 0;
        assistantPlaceholder.modelLabel = data.model || '';
        assistantPlaceholder.engine = data.engine || settings.engine;
        assistantPlaceholder.isFallback = Boolean(data.fallback);
      } catch (err) {
        if (reqId !== chatRequestId) return;
        assistantPlaceholder.loading = false;
        assistantPlaceholder.isError = true;
        assistantPlaceholder.content = err && err.message ? err.message : String(err);
      }

      chatLoading = false;
      if (chatSendBtn) chatSendBtn.disabled = false;
      renderChatList();
      if (!assistantPlaceholder.isError) {
        await persistSidebarChatSession(ctx);
      }
    }

    function submitChatFromInput() {
      if (!chatInputEl || chatLoading) return;
      const text = (chatInputEl.value || '').trim();
      const imagesToSend = pendingChatImages.slice(0, MAX_PAGE_CONTEXT_IMAGES);
      if (!text && imagesToSend.length === 0) return;
      chatInputEl.value = '';
      pendingChatImages = [];
      renderPendingChatImages();
      sendChatMessage(text || '请解读我上传的图片。', {
        taskType: 'chat',
        images: imagesToSend
      });
    }

    async function runSummaryTask(taskType) {
      if (!summaryResultEl) return;
      const reqId = ++summaryRequestId;
      const ctx = refreshSummaryMeta() || extractPageContext();
      const actionDef =
        SUMMARY_ACTIONS.find((a) => a.taskType === taskType) || SUMMARY_ACTIONS[0];
      const useThinking = Boolean(enableThinking);

      currentSummaryText = '';
      if (summaryCopyBtn) summaryCopyBtn.disabled = true;
      if (summaryFollowupBtn) summaryFollowupBtn.disabled = true;

      renderStreamingPaneResult(summaryResultEl, {
        reasoning: '',
        thinkingMs: 0,
        reply: '',
        markdownClass: 'wt-summary-markdown',
        loadingText: '正在分析当前网页内容...',
        streaming: true,
        showEmptyThinking: useThinking
      });

      try {
        const data = await sendAIChatRequest({
          messages: [{ role: 'user', content: actionDef.prompt }],
          prompt: actionDef.prompt,
          taskType: actionDef.taskType,
          selectionText: '',
          pageContext: ctx,
          enableThinking: useThinking,
          onProgress: (prog) => {
            if (reqId !== summaryRequestId || !prog) return;
            renderStreamingPaneResult(summaryResultEl, {
              reasoning: useThinking ? (prog.reasoning || '') : '',
              thinkingMs: prog.thinkingMs || 0,
              reply: prog.reply || '',
              markdownClass: 'wt-summary-markdown',
              loadingText: '正在分析当前网页内容...',
              streaming: !prog.reply,
              showEmptyThinking: useThinking
            });
          }
        });
        if (reqId !== summaryRequestId) return;
        currentSummaryText = data.reply || '';
        renderStreamingPaneResult(summaryResultEl, {
          reasoning: useThinking ? (data.reasoning || '') : '',
          thinkingMs: data.thinkingMs || 0,
          reply: currentSummaryText,
          markdownClass: 'wt-summary-markdown',
          streaming: false,
          showEmptyThinking: false
        });
        const badge = document.createElement('div');
        badge.className = 'wt-summary-engine-meta';
        badge.textContent = data.fallback
          ? `${ENGINE_DISPLAY[data.engine] || '免费引擎'} · 降级生成`
          : `由 ${formatModelDisplayName(data.model)} 生成`;
        summaryResultEl.appendChild(badge);
        if (summaryCopyBtn) summaryCopyBtn.disabled = !currentSummaryText;
        if (summaryFollowupBtn) summaryFollowupBtn.disabled = !currentSummaryText;
      } catch (err) {
        if (reqId !== summaryRequestId) return;
        summaryResultEl.innerHTML = '';
        const errBox = document.createElement('div');
        errBox.className = 'wt-result-error';
        errBox.textContent = `总结失败: ${err && err.message ? err.message : String(err)}`;
        summaryResultEl.appendChild(errBox);
      }
    }

    function showWriteStatus(msg) {
      if (!writeStatusEl) return;
      writeStatusEl.textContent = msg;
      writeStatusEl.classList.remove('wt-hidden');
      if (sidebarNoticeTimer) clearTimeout(sidebarNoticeTimer);
      sidebarNoticeTimer = setTimeout(() => {
        sidebarNoticeTimer = null;
        if (writeStatusEl) writeStatusEl.classList.add('wt-hidden');
      }, 2000);
    }

    async function runWriteTask(taskType) {
      if (!writeInputEl || !writeResultEl) return;
      const sourceText = (writeInputEl.value || '').trim();
      if (!sourceText) {
        showWriteStatus('请先输入或填入需要处理的文本');
        return;
      }

      const reqId = ++writeRequestId;
      const useThinking = Boolean(enableThinking);
      currentWriteOutput = '';
      if (writeCopyBtn) writeCopyBtn.disabled = true;
      if (writeInsertBtn) writeInsertBtn.disabled = true;

      renderStreamingPaneResult(writeResultEl, {
        reasoning: '',
        thinkingMs: 0,
        reply: '',
        markdownClass: 'wt-write-markdown',
        loadingText: 'AI 正在处理文本...',
        placeholder: '正在分析文本并进行深度思考...',
        streaming: true,
        showEmptyThinking: useThinking
      });

      try {
        const data = await sendAIChatRequest({
          messages: [{ role: 'user', content: sourceText }],
          prompt: sourceText,
          taskType,
          selectionText: sourceText,
          pageContext: null,
          enableThinking: useThinking,
          onProgress: (prog) => {
            if (reqId !== writeRequestId || !prog) return;
            renderStreamingPaneResult(writeResultEl, {
              reasoning: useThinking ? (prog.reasoning || '') : '',
              thinkingMs: prog.thinkingMs || 0,
              reply: prog.reply || '',
              markdownClass: 'wt-write-markdown',
              loadingText: 'AI 正在处理文本...',
              placeholder: '正在分析文本并进行深度思考...',
              streaming: !prog.reply,
              showEmptyThinking: useThinking
            });
          }
        });
        if (reqId !== writeRequestId) return;
        currentWriteOutput = data.reply || '';
        renderStreamingPaneResult(writeResultEl, {
          reasoning: useThinking ? (data.reasoning || '') : '',
          thinkingMs: data.thinkingMs || 0,
          reply: currentWriteOutput,
          markdownClass: 'wt-write-markdown',
          streaming: false,
          showEmptyThinking: false
        });
        if (writeCopyBtn) writeCopyBtn.disabled = !currentWriteOutput;
        if (writeInsertBtn) writeInsertBtn.disabled = !currentWriteOutput;
      } catch (err) {
        if (reqId !== writeRequestId) return;
        writeResultEl.innerHTML = '';
        const errBox = document.createElement('div');
        errBox.className = 'wt-result-error';
        errBox.textContent = `处理失败: ${err && err.message ? err.message : String(err)}`;
        writeResultEl.appendChild(errBox);
      }
    }

    function setSidebarTab(tabName) {
      const targetTab =
        tabName === 'summary' || tabName === 'write' || tabName === 'chat' ? tabName : 'chat';
      activeSidebarTab = targetTab;
      for (let i = 0; i < sidebarTabButtons.length; i += 1) {
        const btn = sidebarTabButtons[i];
        btn.classList.toggle('wt-active', btn.getAttribute('data-tab') === targetTab);
      }
      const paneKeys = Object.keys(sidebarPaneEls);
      for (let i = 0; i < paneKeys.length; i += 1) {
        const k = paneKeys[i];
        sidebarPaneEls[k].classList.toggle('wt-hidden', k !== targetTab);
      }
      if (targetTab === 'summary') {
        refreshSummaryMeta();
      }
    }

    function buildSidebar() {
      sidebarEl = document.createElement('aside');
      sidebarEl.className = 'wt-sidebar wt-hidden';
      sidebarEl.setAttribute('role', 'complementary');
      sidebarEl.setAttribute('aria-label', 'Gloss AI 侧边栏');

      // Header
      const header = document.createElement('div');
      header.className = 'wt-sidebar-header';

      const titleRow = document.createElement('div');
      titleRow.className = 'wt-sidebar-title-row';
      const brand = document.createElement('div');
      brand.className = 'wt-sidebar-brand';
      brand.innerHTML = `<span class="wt-sidebar-logo">${SVG_SPARKLES}</span><span class="wt-sidebar-title">Gloss · AI 助手</span>`;

      const headActions = document.createElement('div');
      headActions.className = 'wt-sidebar-head-actions';

      sidebarHistoryBtn = document.createElement('button');
      sidebarHistoryBtn.type = 'button';
      sidebarHistoryBtn.className = 'wt-sidebar-history-btn';
      sidebarHistoryBtn.title = '查询历史网页会话';
      sidebarHistoryBtn.textContent = '🕒 历史';
      sidebarHistoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeSidebarTab !== 'chat') {
          setSidebarTab('chat');
          chatHistoryOpen = true;
        } else {
          chatHistoryOpen = !chatHistoryOpen;
        }
        if (chatHistoryPanelEl) {
          chatHistoryPanelEl.classList.toggle('wt-hidden', !chatHistoryOpen);
        }
        updateSidebarHistoryButtonLabel();
        if (chatHistoryOpen) {
          fetchSidebarChatSessions();
          if (chatHistorySearchEl && typeof chatHistorySearchEl.focus === 'function') {
            chatHistorySearchEl.focus();
          }
        }
      });

      sidebarNewChatBtn = document.createElement('button');
      sidebarNewChatBtn.type = 'button';
      sidebarNewChatBtn.className = 'wt-sidebar-new-chat-btn';
      sidebarNewChatBtn.title = '开启新对话';
      sidebarNewChatBtn.textContent = '➕ 新对话';
      sidebarNewChatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSidebarTab('chat');
        startNewSidebarChat();
      });

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'wt-sidebar-clear-btn';
      clearBtn.title = '清空对话';
      clearBtn.textContent = '清空';
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startNewSidebarChat();
      });

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'wt-sidebar-close-btn';
      closeBtn.title = '关闭 (Esc / Alt+S)';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar({ open: false });
      });

      headActions.appendChild(sidebarHistoryBtn);
      headActions.appendChild(sidebarNewChatBtn);
      headActions.appendChild(clearBtn);
      headActions.appendChild(closeBtn);
      titleRow.appendChild(brand);
      titleRow.appendChild(headActions);

      const modelRow = document.createElement('div');
      modelRow.className = 'wt-sidebar-model-row';
      const modelLabel = document.createElement('span');
      modelLabel.className = 'wt-sidebar-model-label';
      modelLabel.textContent = '模型';
      sidebarModelSelect = document.createElement('select');
      sidebarModelSelect.className = 'wt-sidebar-model-select';
      sidebarModelSelect.setAttribute('aria-label', '选择 AI 模型');
      populateModelSelect();
      syncSidebarModelSelect();
      sidebarModelSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        const nextVal = sidebarModelSelect.value;
        if (String(nextVal).startsWith('codex:')) {
          const nextCodexModel = String(nextVal).slice('codex:'.length) || 'gpt-5.6-luna';
          const nextCodexConfig = Object.assign(
            {},
            settings.codexConfig || baseCodexConfig,
            { model: nextCodexModel }
          );
          settings.engine = 'codex';
          settings.codexConfig = nextCodexConfig;
          const hasCodexAuth = Boolean(nextCodexConfig.accessToken);
          showModelSwitchHint(
            hasCodexAuth
              ? `已切换: ${formatModelDisplayName(nextVal)}`
              : `已切换: ${formatModelDisplayName(nextVal)}（请先在设置页登录/导入 Codex 凭证）`
          );
          persistSettingsPatch({
            engine: 'codex',
            codexConfig: nextCodexConfig
          });
          return;
        }
        const nextProvider =
          findProviderForModel(nextVal) ||
          (settings.loomConfig && settings.loomConfig.provider) ||
          'zenmux';
        const nextLoomConfig = Object.assign({}, settings.loomConfig || baseLoomConfig, {
          provider: nextProvider,
          model: nextVal
        });
        settings.engine = 'loom';
        settings.loomConfig = nextLoomConfig;
        showModelSwitchHint(`已切换: ${formatModelDisplayName(nextVal)}`);
        persistSettingsPatch({
          engine: 'loom',
          loomConfig: nextLoomConfig
        });
      });
      sidebarModelHint = document.createElement('span');
      sidebarModelHint.className = 'wt-sidebar-model-hint wt-hidden';
      modelRow.appendChild(modelLabel);
      modelRow.appendChild(sidebarModelSelect);

      header.appendChild(titleRow);
      header.appendChild(modelRow);
      header.appendChild(sidebarModelHint);

      // Tabs
      const tabsNav = document.createElement('div');
      tabsNav.className = 'wt-sidebar-tabs';
      const tabDefs = [
        { id: 'chat', label: '💬 AI 对话' },
        { id: 'summary', label: '📄 网页总结' },
        { id: 'write', label: '✍️ 写作润色' }
      ];
      sidebarTabButtons = tabDefs.map((t) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wt-sidebar-tab';
        btn.setAttribute('data-tab', t.id);
        btn.textContent = t.label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          setSidebarTab(t.id);
        });
        tabsNav.appendChild(btn);
        return btn;
      });

      // Body Panes
      const bodyWrap = document.createElement('div');
      bodyWrap.className = 'wt-sidebar-body';

      // --- Pane 1: Chat ---
      const chatPane = document.createElement('div');
      chatPane.className = 'wt-sidebar-pane wt-pane-chat';
      chatPane.setAttribute('data-pane', 'chat');

      const chatTopControls = document.createElement('div');
      chatTopControls.className = 'wt-chat-controls';

      const togglesRow = document.createElement('div');
      togglesRow.className = 'wt-chat-toggles-row';

      const ctxLabel = document.createElement('label');
      ctxLabel.className = 'wt-chat-ctx-toggle';
      chatContextCheckbox = document.createElement('input');
      chatContextCheckbox.type = 'checkbox';
      chatContextCheckbox.checked = includePageContext;
      chatContextCheckbox.addEventListener('change', () => {
        includePageContext = Boolean(chatContextCheckbox.checked);
        refreshPageImageHint();
      });
      const ctxText = document.createElement('span');
      ctxText.textContent = '📄 关联当前网页';
      ctxLabel.appendChild(chatContextCheckbox);
      ctxLabel.appendChild(ctxText);

      const thinkingLabel = document.createElement('label');
      thinkingLabel.className = 'wt-chat-ctx-toggle wt-chat-thinking-toggle';
      chatThinkingCheckbox = document.createElement('input');
      chatThinkingCheckbox.type = 'checkbox';
      chatThinkingCheckbox.checked = enableThinking;
      chatThinkingCheckbox.addEventListener('change', () => {
        enableThinking = Boolean(chatThinkingCheckbox.checked);
      });
      const thinkingText = document.createElement('span');
      thinkingText.textContent = '🧠 深度思考';
      thinkingLabel.appendChild(chatThinkingCheckbox);
      thinkingLabel.appendChild(thinkingText);

      chatPageImgHintEl = document.createElement('span');
      chatPageImgHintEl.className = 'wt-chat-page-img-hint wt-hidden';

      togglesRow.appendChild(ctxLabel);
      togglesRow.appendChild(thinkingLabel);
      togglesRow.appendChild(chatPageImgHintEl);

      chatQuoteWrap = document.createElement('div');
      chatQuoteWrap.className = 'wt-chat-quote wt-hidden';
      const quoteLabel = document.createElement('span');
      quoteLabel.className = 'wt-chat-quote-badge';
      quoteLabel.textContent = '引用';
      chatQuoteTextEl = document.createElement('span');
      chatQuoteTextEl.className = 'wt-chat-quote-text';
      const quoteClearBtn = document.createElement('button');
      quoteClearBtn.type = 'button';
      quoteClearBtn.className = 'wt-chat-quote-clear';
      quoteClearBtn.title = '移除引用';
      quoteClearBtn.textContent = '×';
      quoteClearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chatQuotedText = '';
        renderChatQuote();
      });
      chatQuoteWrap.appendChild(quoteLabel);
      chatQuoteWrap.appendChild(chatQuoteTextEl);
      chatQuoteWrap.appendChild(quoteClearBtn);

      const chipsRow = document.createElement('div');
      chipsRow.className = 'wt-chat-chips';
      QUICK_CHAT_CHIPS.forEach((chip) => {
        const cBtn = document.createElement('button');
        cBtn.type = 'button';
        cBtn.className = 'wt-chat-chip';
        cBtn.textContent = chip.label;
        cBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          sendChatMessage(chip.prompt, { taskType: chip.taskType });
        });
        chipsRow.appendChild(cBtn);
      });

      chatTopControls.appendChild(togglesRow);
      chatTopControls.appendChild(chatQuoteWrap);
      chatTopControls.appendChild(chipsRow);

      chatSessionBannerEl = document.createElement('div');
      chatSessionBannerEl.className = 'wt-chat-session-banner wt-hidden';
      chatSessionBannerTextEl = document.createElement('span');
      chatSessionBannerTextEl.className = 'wt-chat-session-banner-text';
      chatSessionLinkEl = document.createElement('a');
      chatSessionLinkEl.className = 'wt-chat-session-link wt-hidden';
      chatSessionLinkEl.target = '_blank';
      chatSessionLinkEl.rel = 'noopener noreferrer';
      chatSessionLinkEl.textContent = '↗ 原网页';
      chatSessionResetBtn = document.createElement('button');
      chatSessionResetBtn.type = 'button';
      chatSessionResetBtn.className = 'wt-chat-session-reset';
      chatSessionResetBtn.textContent = '返回本页新对话';
      chatSessionResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startNewSidebarChat();
      });
      chatSessionBannerEl.appendChild(chatSessionBannerTextEl);
      chatSessionBannerEl.appendChild(chatSessionLinkEl);
      chatSessionBannerEl.appendChild(chatSessionResetBtn);

      chatHistoryPanelEl = document.createElement('div');
      chatHistoryPanelEl.className = 'wt-chat-history-panel wt-hidden';

      const historyToolbar = document.createElement('div');
      historyToolbar.className = 'wt-chat-history-toolbar';

      chatHistorySearchEl = document.createElement('input');
      chatHistorySearchEl.type = 'search';
      chatHistorySearchEl.className = 'wt-chat-history-search';
      chatHistorySearchEl.placeholder = '搜索历史网页标题、域名或对话内容...';
      chatHistorySearchEl.setAttribute('aria-label', '搜索历史网页会话');
      chatHistorySearchEl.addEventListener('input', () => {
        chatHistoryQuery = (chatHistorySearchEl.value || '').trim();
        fetchSidebarChatSessions(chatHistoryQuery);
      });

      chatHistoryClearAllBtn = document.createElement('button');
      chatHistoryClearAllBtn.type = 'button';
      chatHistoryClearAllBtn.className = 'wt-chat-history-clear-all';
      chatHistoryClearAllBtn.textContent = '清空历史';
      chatHistoryClearAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearAllSidebarChatSessions();
      });

      historyToolbar.appendChild(chatHistorySearchEl);
      historyToolbar.appendChild(chatHistoryClearAllBtn);

      chatHistoryListEl = document.createElement('div');
      chatHistoryListEl.className = 'wt-chat-history-list';

      chatHistoryPanelEl.appendChild(historyToolbar);
      chatHistoryPanelEl.appendChild(chatHistoryListEl);

      chatListEl = document.createElement('div');
      chatListEl.className = 'wt-chat-list';

      const composer = document.createElement('div');
      composer.className = 'wt-chat-composer';

      chatImageStripEl = document.createElement('div');
      chatImageStripEl.className = 'wt-chat-image-strip wt-hidden';

      chatImageInputEl = document.createElement('input');
      chatImageInputEl.type = 'file';
      chatImageInputEl.accept = 'image/*';
      chatImageInputEl.multiple = true;
      chatImageInputEl.className = 'wt-hidden';
      chatImageInputEl.addEventListener('change', async () => {
        if (chatImageInputEl.files && chatImageInputEl.files.length > 0) {
          await addChatImagesFromFiles(chatImageInputEl.files);
        }
        chatImageInputEl.value = '';
      });

      const composerRow = document.createElement('div');
      composerRow.className = 'wt-chat-composer-row';

      chatInputEl = document.createElement('textarea');
      chatInputEl.className = 'wt-chat-input';
      chatInputEl.rows = 2;
      chatInputEl.placeholder = '输入问题或 Ctrl/Cmd+V 粘贴截图，Enter 发送...';
      chatInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          submitChatFromInput();
        }
      });
      chatInputEl.addEventListener('paste', async (e) => {
        const cd = e.clipboardData;
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
          e.preventDefault();
          await addChatImagesFromFiles(imageFiles);
        }
      });

      const composerActions = document.createElement('div');
      composerActions.className = 'wt-chat-composer-actions';

      chatImageBtn = document.createElement('button');
      chatImageBtn.type = 'button';
      chatImageBtn.className = 'wt-chat-image-btn';
      chatImageBtn.title = '上传图片（支持 PNG/JPG/WebP，或直接粘贴截图）';
      chatImageBtn.textContent = '🖼️ 传图';
      chatImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (chatImageInputEl && typeof chatImageInputEl.click === 'function') {
          chatImageInputEl.click();
        }
      });

      chatSendBtn = document.createElement('button');
      chatSendBtn.type = 'button';
      chatSendBtn.className = 'wt-chat-send-btn';
      chatSendBtn.innerHTML = `${SVG_SEND}<span>发送</span>`;
      chatSendBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        submitChatFromInput();
      });

      composerActions.appendChild(chatImageBtn);
      composerActions.appendChild(chatSendBtn);

      composerRow.appendChild(chatInputEl);
      composerRow.appendChild(composerActions);

      composer.appendChild(chatImageStripEl);
      composer.appendChild(chatImageInputEl);
      composer.appendChild(composerRow);

      chatPane.addEventListener('dragover', (e) => {
        e.preventDefault();
        composer.classList.add('wt-drag-over');
      });
      chatPane.addEventListener('dragleave', (e) => {
        if (!chatPane.contains(e.relatedTarget)) {
          composer.classList.remove('wt-drag-over');
        }
      });
      chatPane.addEventListener('drop', async (e) => {
        e.preventDefault();
        composer.classList.remove('wt-drag-over');
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length > 0) {
          await addChatImagesFromFiles(files);
        }
      });

      chatPane.appendChild(chatTopControls);
      chatPane.appendChild(chatSessionBannerEl);
      chatPane.appendChild(chatHistoryPanelEl);
      chatPane.appendChild(chatListEl);
      chatPane.appendChild(composer);

      // --- Pane 2: Summary ---
      const summaryPane = document.createElement('div');
      summaryPane.className = 'wt-sidebar-pane wt-pane-summary wt-hidden';
      summaryPane.setAttribute('data-pane', 'summary');

      const summaryMeta = document.createElement('div');
      summaryMeta.className = 'wt-summary-meta';
      summaryPageTitleEl = document.createElement('div');
      summaryPageTitleEl.className = 'wt-summary-page-title';
      const summarySubRow = document.createElement('div');
      summarySubRow.className = 'wt-summary-subrow';
      summaryCharCountEl = document.createElement('span');
      summaryCharCountEl.className = 'wt-summary-char-count';
      const refreshCtxBtn = document.createElement('button');
      refreshCtxBtn.type = 'button';
      refreshCtxBtn.className = 'wt-sidebar-mini-btn';
      refreshCtxBtn.textContent = '↻ 刷新正文';
      refreshCtxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        refreshSummaryMeta();
      });
      summarySubRow.appendChild(summaryCharCountEl);
      summarySubRow.appendChild(refreshCtxBtn);
      summaryMeta.appendChild(summaryPageTitleEl);
      summaryMeta.appendChild(summarySubRow);

      const summaryActionsWrap = document.createElement('div');
      summaryActionsWrap.className = 'wt-summary-actions';
      SUMMARY_ACTIONS.forEach((act) => {
        const sBtn = document.createElement('button');
        sBtn.type = 'button';
        sBtn.className = act.primary ? 'wt-summary-btn wt-primary' : 'wt-summary-btn';
        sBtn.setAttribute('data-summary-task', act.taskType);
        sBtn.textContent = act.label;
        sBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          runSummaryTask(act.taskType);
        });
        summaryActionsWrap.appendChild(sBtn);
      });

      summaryResultEl = document.createElement('div');
      summaryResultEl.className = 'wt-summary-result';
      summaryResultEl.textContent = '点击上方按钮，AI 将自动读取当前网页结构与正文生成清晰摘要。';

      const summaryFooter = document.createElement('div');
      summaryFooter.className = 'wt-sidebar-pane-footer';
      summaryCopyBtn = document.createElement('button');
      summaryCopyBtn.type = 'button';
      summaryCopyBtn.className = 'wt-action-btn';
      summaryCopyBtn.disabled = true;
      summaryCopyBtn.textContent = '复制结果';
      summaryCopyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await copyTextToClipboard(currentSummaryText)) {
          summaryCopyBtn.textContent = '已复制 ✓';
          setTimeout(() => {
            if (summaryCopyBtn) summaryCopyBtn.textContent = '复制结果';
          }, 1400);
        }
      });

      summaryFollowupBtn = document.createElement('button');
      summaryFollowupBtn.type = 'button';
      summaryFollowupBtn.className = 'wt-summary-followup-btn';
      summaryFollowupBtn.disabled = true;
      summaryFollowupBtn.textContent = '💬 基于摘要继续追问';
      summaryFollowupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentSummaryText) return;
        chatQuotedText = currentSummaryText;
        renderChatQuote();
        setSidebarTab('chat');
        if (chatInputEl && typeof chatInputEl.focus === 'function') {
          chatInputEl.focus();
        }
      });

      summaryFooter.appendChild(summaryCopyBtn);
      summaryFooter.appendChild(summaryFollowupBtn);

      summaryPane.appendChild(summaryMeta);
      summaryPane.appendChild(summaryActionsWrap);
      summaryPane.appendChild(summaryResultEl);
      summaryPane.appendChild(summaryFooter);

      // --- Pane 3: Write ---
      const writePane = document.createElement('div');
      writePane.className = 'wt-sidebar-pane wt-pane-write wt-hidden';
      writePane.setAttribute('data-pane', 'write');

      const writeInputHead = document.createElement('div');
      writeInputHead.className = 'wt-write-head';
      const writeLabel = document.createElement('span');
      writeLabel.className = 'wt-write-label';
      writeLabel.textContent = '原始文本';
      const fillSelectionBtn = document.createElement('button');
      fillSelectionBtn.type = 'button';
      fillSelectionBtn.className = 'wt-sidebar-mini-btn';
      fillSelectionBtn.textContent = '填入当前选中文本';
      fillSelectionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sel = global.getSelection ? global.getSelection() : null;
        const fromSel = sel ? sel.toString().trim() : '';
        const text =
          fromSel || (pendingSelection && pendingSelection.text) || currentPopoverText || '';
        if (text && writeInputEl) {
          writeInputEl.value = text;
        } else {
          showWriteStatus('当前未选中页面文本');
        }
      });
      writeInputHead.appendChild(writeLabel);
      writeInputHead.appendChild(fillSelectionBtn);

      writeInputEl = document.createElement('textarea');
      writeInputEl.className = 'wt-write-input';
      writeInputEl.rows = 4;
      writeInputEl.placeholder = '输入或粘贴需要润色、改写、纠错或翻译的文本...';

      const writeActionsGrid = document.createElement('div');
      writeActionsGrid.className = 'wt-write-actions';
      WRITE_ACTIONS.forEach((act) => {
        const wBtn = document.createElement('button');
        wBtn.type = 'button';
        wBtn.className = 'wt-write-action-btn';
        wBtn.setAttribute('data-write-task', act.taskType);
        wBtn.textContent = act.label;
        wBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          runWriteTask(act.taskType);
        });
        writeActionsGrid.appendChild(wBtn);
      });

      writeResultEl = document.createElement('div');
      writeResultEl.className = 'wt-write-result';
      writeResultEl.textContent = '加工后的文本结果将显示在这里。';

      writeStatusEl = document.createElement('div');
      writeStatusEl.className = 'wt-write-status wt-hidden';

      const writeFooter = document.createElement('div');
      writeFooter.className = 'wt-sidebar-pane-footer';
      writeCopyBtn = document.createElement('button');
      writeCopyBtn.type = 'button';
      writeCopyBtn.className = 'wt-action-btn';
      writeCopyBtn.disabled = true;
      writeCopyBtn.textContent = '复制结果';
      writeCopyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await copyTextToClipboard(currentWriteOutput)) {
          writeCopyBtn.textContent = '已复制 ✓';
          setTimeout(() => {
            if (writeCopyBtn) writeCopyBtn.textContent = '复制结果';
          }, 1400);
        }
      });

      writeInsertBtn = document.createElement('button');
      writeInsertBtn.type = 'button';
      writeInsertBtn.className = 'wt-write-insert-btn';
      writeInsertBtn.disabled = true;
      writeInsertBtn.textContent = '📥 填入页面输入框';
      writeInsertBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentWriteOutput) return;
        const ok = writeTextToEditable(lastFocusedEditable, currentWriteOutput, rootContainer);
        showWriteStatus(ok ? '已成功填入页面输入框 ✓' : '请先点击聚焦页面上的目标输入框');
      });

      writeFooter.appendChild(writeCopyBtn);
      writeFooter.appendChild(writeInsertBtn);

      writePane.appendChild(writeInputHead);
      writePane.appendChild(writeInputEl);
      writePane.appendChild(writeActionsGrid);
      writePane.appendChild(writeResultEl);
      writePane.appendChild(writeStatusEl);
      writePane.appendChild(writeFooter);

      sidebarPaneEls = {
        chat: chatPane,
        summary: summaryPane,
        write: writePane
      };

      bodyWrap.appendChild(chatPane);
      bodyWrap.appendChild(summaryPane);
      bodyWrap.appendChild(writePane);

      sidebarEl.appendChild(header);
      sidebarEl.appendChild(tabsNav);
      sidebarEl.appendChild(bodyWrap);

      sidebarEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });

      rootContainer.appendChild(sidebarEl);
      setSidebarTab(activeSidebarTab);
      renderChatList();
    }

    function toggleSidebar(actionOpts) {
      const o = actionOpts || {};
      ensureRoot();
      const nextOpen = typeof o.open === 'boolean' ? o.open : !sidebarOpen;
      sidebarOpen = nextOpen;
      if (sidebarEl) {
        sidebarEl.classList.toggle('wt-hidden', !sidebarOpen);
      }
      if (sidebarOpen) {
        if (o.tab === 'chat' || o.tab === 'summary' || o.tab === 'write') {
          setSidebarTab(o.tab);
        } else {
          refreshSummaryMeta();
        }
        refreshPageImageHint();
        syncSidebarModelSelect();
        fetchSidebarChatSessions();
      }
      return sidebarOpen;
    }

    function openSidebarAction(actionOpts) {
      const o = actionOpts || {};
      const action = o.action || 'chat';
      if (action === 'stream_progress') {
        const cb = o.streamId && activeStreamCallbacks[o.streamId];
        if (typeof cb === 'function') {
          cb(o);
        }
        return true;
      }
      const sel = global.getSelection ? global.getSelection() : null;
      const activeSelected = sel ? sel.toString().trim() : '';
      const rawText = typeof o.text === 'string' && o.text.trim() ? o.text.trim() : activeSelected;
      const rawImageUrl = typeof o.imageUrl === 'string' ? o.imageUrl.trim() : '';

      let targetTab = o.tab;
      if (targetTab !== 'chat' && targetTab !== 'summary' && targetTab !== 'write') {
        if (
          action === 'summarize_page' ||
          action === 'key_takeaways' ||
          action === 'page_qa'
        ) {
          targetTab = 'summary';
        } else if (
          action === 'polish' ||
          action === 'shorten' ||
          action === 'expand' ||
          action === 'grammar' ||
          action === 'translate_en' ||
          action === 'translate_zh'
        ) {
          targetTab = 'write';
        } else {
          targetTab = 'chat';
        }
      }

      toggleSidebar({ open: true, tab: targetTab });

      if (targetTab === 'summary') {
        if (o.autoRun !== false) {
          runSummaryTask(action === 'key_takeaways' || action === 'page_qa' ? action : 'summarize_page');
        }
        return true;
      }

      if (targetTab === 'write') {
        if (rawText && writeInputEl) {
          writeInputEl.value = rawText;
        }
        if (o.autoRun !== false) {
          runWriteTask(
            WRITE_ACTIONS.some((a) => a.taskType === action) ? action : 'polish'
          );
        } else if (writeInputEl && typeof writeInputEl.focus === 'function') {
          writeInputEl.focus();
        }
        return true;
      }

      // Chat tab
      if (rawText) {
        chatQuotedText = rawText;
        renderChatQuote();
      }

      if (action === 'analyze_image' && rawImageUrl) {
        const imgObj = {
          url: rawImageUrl,
          dataUrl: /^data:image\//i.test(rawImageUrl) ? rawImageUrl : '',
          alt: '网页右键图片',
          source: 'context_menu'
        };
        if (o.autoRun !== false) {
          sendChatMessage(o.prompt || '请仔细识别并解读这张图片的核心内容与关键信息。', {
            taskType: 'chat',
            images: [imgObj]
          });
        } else {
          pendingChatImages = [imgObj];
          renderPendingChatImages();
          if (chatInputEl && typeof chatInputEl.focus === 'function') {
            chatInputEl.focus();
          }
        }
      } else if (action === 'explain' && o.autoRun !== false) {
        sendChatMessage(o.prompt || '请用通俗清晰的方式解释这段内容的核心含义。', {
          taskType: 'explain',
          selectionText: rawText || chatQuotedText
        });
      } else if (action === 'summarize' && o.autoRun !== false) {
        sendChatMessage(o.prompt || '请总结提炼这段文本的核心要点。', {
          taskType: 'summarize',
          selectionText: rawText || chatQuotedText
        });
      } else if (
        o.autoRun === true &&
        (action === 'summarize_page' || action === 'key_takeaways' || action === 'page_qa')
      ) {
        const presetChip = QUICK_CHAT_CHIPS.find((c) => c.taskType === action);
        sendChatMessage(o.prompt || (presetChip && presetChip.prompt) || '请分析当前网页内容。', {
          taskType: action
        });
      } else if (o.autoRun === true && o.prompt) {
        sendChatMessage(o.prompt, { taskType: action, selectionText: rawText || chatQuotedText });
      } else if (chatInputEl && typeof chatInputEl.focus === 'function') {
        chatInputEl.focus();
      }
      return true;
    }

    function isSidebarOpen() {
      return sidebarOpen;
    }

    function syncFloatingBallVisibility() {
      if (!fabWrapEl) return;
      const shouldShow = settings.showFloatingBall !== false && !isExcluded;
      fabWrapEl.classList.toggle('wt-hidden', !shouldShow);
      if (!shouldShow) {
        fabOpen = false;
        syncFloatingBallPanel();
      }
    }

    function syncFloatingBallPanel() {
      if (!fabPanelEl) return;
      fabPanelEl.classList.toggle('wt-hidden', !fabOpen);
    }

    function syncFloatingBallState() {
      if (!fabBallBtn) return;
      const translated = Boolean(pageStatus && pageStatus.isTranslated);
      const count = (pageStatus && pageStatus.translatedCount) || 0;
      const loadingCount = (pageStatus && pageStatus.loadingCount) || 0;
      const totalCount = (pageStatus && pageStatus.totalCount) || count + loadingCount;
      const errorCount = (pageStatus && pageStatus.errorCount) || 0;
      const lastError = (pageStatus && pageStatus.lastError) || '';
      const hasFatalError = !translated && count === 0 && Boolean(lastError || errorCount > 0);
      const isLoading = translated && loadingCount > 0;
      const activeMode = (pageStatus && pageStatus.displayMode) || settings.displayMode || 'replace';
      const activeLang = (pageStatus && pageStatus.targetLang) || settings.targetLang || 'zh-CN';

      fabBallBtn.classList.toggle('wt-active', translated);
      fabBallBtn.classList.toggle('wt-loading', isLoading);
      fabBallBtn.title = hasFatalError
        ? `翻译失败：${lastError || '请检查翻译引擎配置'}`
        : 'Gloss 快捷翻译面板';
      if (fabDotEl) {
        fabDotEl.classList.toggle('wt-hidden', !translated);
      }
      if (fabPrimaryBtn) {
        fabPrimaryBtn.classList.toggle('wt-is-translated', translated);
        fabPrimaryBtn.textContent = translated
          ? '恢复原文'
          : hasFatalError
            ? '重试整页翻译'
            : '整页翻译';
      }
      if (fabStatusText) {
        if (isLoading) {
          fabStatusText.textContent =
            count > 0 ? `正在译 ${count}/${totalCount || count + loadingCount}` : '正在翻译...';
          fabStatusText.title = '';
        } else if (translated) {
          fabStatusText.textContent = `已译 ${count} 段`;
          fabStatusText.title = '';
        } else if (hasFatalError) {
          fabStatusText.textContent = '翻译失败';
          fabStatusText.title = lastError || '整页翻译失败';
        } else {
          fabStatusText.textContent = count > 0 ? `局部 ${count} 段` : '未翻译';
          fabStatusText.title = '';
        }
      }

      if (progressEl && progressBarEl) {
        if (isLoading) {
          if (progressHideTimer) {
            clearTimeout(progressHideTimer);
            progressHideTimer = null;
          }
          const pct = Math.max(
            12,
            Math.min(96, Math.round((count / Math.max(1, totalCount)) * 100))
          );
          progressEl.classList.remove('wt-hidden');
          progressBarEl.style.width = `${pct}%`;
        } else if (translated && loadingCount === 0) {
          if (!progressEl.classList.contains('wt-hidden')) {
            progressBarEl.style.width = '100%';
            if (progressHideTimer) {
              clearTimeout(progressHideTimer);
            }
            progressHideTimer = setTimeout(() => {
              progressHideTimer = null;
              if (pageStatus && pageStatus.isTranslated && (pageStatus.loadingCount || 0) > 0) {
                return;
              }
              if (progressEl) {
                progressEl.classList.add('wt-hidden');
              }
              if (progressBarEl) {
                progressBarEl.style.width = '0%';
              }
            }, 350);
          }
        } else {
          if (progressHideTimer) {
            clearTimeout(progressHideTimer);
            progressHideTimer = null;
          }
          progressEl.classList.add('wt-hidden');
          progressBarEl.style.width = '0%';
        }
      }
      for (let i = 0; i < fabModeButtons.length; i += 1) {
        const btn = fabModeButtons[i];
        btn.classList.toggle('wt-active', btn.getAttribute('data-mode') === activeMode);
      }
      for (let i = 0; i < fabLangButtons.length; i += 1) {
        const btn = fabLangButtons[i];
        btn.classList.toggle('wt-active', btn.getAttribute('data-lang') === activeLang);
      }
    }

    function updatePopoverTabs() {
      for (let i = 0; i < tabButtons.length; i += 1) {
        const btn = tabButtons[i];
        btn.classList.toggle('wt-active', btn.getAttribute('data-lang') === currentPopoverTargetLang);
      }
    }

    function showTrigger(rect) {
      ensureRoot();
      if (!triggerBtn) return;
      const vw = global.innerWidth || 1024;
      const vh = global.innerHeight || 768;
      const left = clamp((rect.right || rect.left || 0) + 6, 8, vw - 68);
      const top = clamp((rect.bottom || rect.top || 0) + 6, 8, vh - 40);
      triggerBtn.style.left = `${left}px`;
      triggerBtn.style.top = `${top}px`;
      triggerBtn.classList.remove('wt-hidden');
    }

    function hideTrigger() {
      if (triggerBtn) {
        triggerBtn.classList.add('wt-hidden');
      }
    }

    function positionPopover(rect) {
      if (!popoverEl) return;
      const vw = global.innerWidth || 1024;
      const vh = global.innerHeight || 768;
      const popWidth = Math.min(356, vw - 20);
      const popHeight = popoverEl.offsetHeight || 240;

      let left;
      let top;
      if (rect) {
        left = clamp(rect.left, 10, Math.max(10, vw - popWidth - 10));
        if (rect.bottom + popHeight + 16 <= vh) {
          top = rect.bottom + 8;
        } else if (rect.top - popHeight - 12 >= 10) {
          top = rect.top - popHeight - 8;
        } else {
          top = clamp(vh - popHeight - 12, 10, Math.max(10, vh - 120));
        }
      } else {
        left = clamp(Math.round((vw - popWidth) / 2), 10, vw - popWidth - 10);
        top = clamp(Math.round((vh - popHeight) / 3), 16, vh - popHeight - 16);
      }

      popoverEl.style.left = `${left}px`;
      popoverEl.style.top = `${top}px`;
    }

    function stopSpeaking() {
      isSpeaking = false;
      if (global.speechSynthesis && typeof global.speechSynthesis.cancel === 'function') {
        try {
          global.speechSynthesis.cancel();
        } catch (_) {
          // Ignore
        }
      }
      if (speakBtnEl) {
        speakBtnEl.classList.remove('wt-speaking');
        speakBtnEl.innerHTML = `${SVG_SPEAK}<span>朗读</span>`;
      }
    }

    function setPopoverLoading() {
      currentTranslatedText = '';
      if (copyBtnEl) copyBtnEl.disabled = true;
      if (speakBtnEl) speakBtnEl.disabled = true;
      stopSpeaking();

      resultAreaEl.innerHTML =
        '<span class="wt-result-loading"><span class="wt-spinner"></span><span>正在翻译...</span></span>';
    }

    function setPopoverSuccess(translatedText, detectedSourceLang, engineUsed) {
      currentTranslatedText = translatedText;
      sourceBadgeEl.textContent = formatSourceBadge(settings.sourceLang, detectedSourceLang);
      engineTagEl.textContent = ENGINE_DISPLAY[engineUsed || settings.engine] || settings.engine;

      resultAreaEl.textContent = translatedText;
      if (copyBtnEl) copyBtnEl.disabled = !translatedText;
      if (speakBtnEl) speakBtnEl.disabled = !translatedText;
    }

    function setPopoverError(errorMessage) {
      currentTranslatedText = '';
      if (copyBtnEl) copyBtnEl.disabled = true;
      if (speakBtnEl) speakBtnEl.disabled = true;

      resultAreaEl.innerHTML = '';
      const errWrap = document.createElement('div');
      errWrap.className = 'wt-result-error';

      const msg = document.createElement('span');
      msg.textContent = `翻译失败: ${errorMessage || '请稍后重试'}`;

      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'wt-retry-btn';
      retryBtn.textContent = '重试';
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        translatePopoverText(currentPopoverText, currentPopoverTargetLang, true);
      });

      errWrap.appendChild(msg);
      errWrap.appendChild(retryBtn);
      resultAreaEl.appendChild(errWrap);
    }

    async function translatePopoverText(text, targetLang, skipCache) {
      const reqId = ++popoverRequestId;
      const cleanText = (text || '').trim();
      const target = targetLang || settings.targetLang || 'zh-CN';
      const cacheKey = `${settings.engine}|${settings.sourceLang}|${target}|${cleanText}`;

      sourceBadgeEl.textContent = formatSourceBadge(settings.sourceLang, null);
      engineTagEl.textContent = ENGINE_DISPLAY[settings.engine] || settings.engine;

      if (!skipCache && translationCache.has(cacheKey)) {
        const cached = translationCache.get(cacheKey);
        setPopoverSuccess(cached.translatedText, cached.detectedSourceLang, cached.engine);
        return;
      }

      setPopoverLoading();

      try {
        const res = await sendMessage({
          type: 'TRANSLATE_TEXT',
          payload: {
            text: cleanText,
            sourceLang: settings.sourceLang,
            targetLang: target,
            engine: settings.engine,
            saveHistory: true
          }
        });

        if (reqId !== popoverRequestId) return;

        if (res && res.ok && res.data) {
          const translatedText = res.data.translatedText || '';
          const detectedSourceLang = res.data.detectedSourceLang || settings.sourceLang;
          const engineUsed = res.data.engine || settings.engine;
          translationCache.set(cacheKey, { translatedText, detectedSourceLang, engine: engineUsed });
          setPopoverSuccess(translatedText, detectedSourceLang, engineUsed);
        } else {
          setPopoverError((res && res.error) || '翻译服务无响应');
        }
      } catch (err) {
        if (reqId !== popoverRequestId) return;
        setPopoverError(err && err.message ? err.message : String(err));
      }
    }

    function openPopover(text, targetLang, rect) {
      const cleanText = (text || '').trim();
      if (!cleanText) return;

      ensureRoot();
      hideTrigger();

      currentPopoverText = cleanText;
      currentPopoverTargetLang = targetLang || settings.targetLang || 'zh-CN';
      sourcePreviewEl.textContent = cleanText;
      updatePopoverTabs();

      popoverEl.classList.remove('wt-hidden');
      positionPopover(rect);
      translatePopoverText(cleanText, currentPopoverTargetLang, false);
    }

    function closePopover() {
      popoverRequestId += 1;
      stopSpeaking();
      if (popoverEl) {
        popoverEl.classList.add('wt-hidden');
      }
    }

    async function copyTranslation() {
      if (!currentTranslatedText || !copyBtnEl) return;

      const copied = await copyTextToClipboard(currentTranslatedText);
      if (copied) {
        if (copyTimer) clearTimeout(copyTimer);
        copyBtnEl.classList.add('wt-success');
        copyBtnEl.innerHTML = `${SVG_COPY}<span>已复制 ✓</span>`;
        copyTimer = setTimeout(() => {
          if (copyBtnEl) {
            copyBtnEl.classList.remove('wt-success');
            copyBtnEl.innerHTML = `${SVG_COPY}<span>复制</span>`;
          }
        }, 1500);
      }
    }

    function toggleSpeakTranslation() {
      if (!currentTranslatedText) return;
      if (!global.speechSynthesis || typeof global.SpeechSynthesisUtterance !== 'function') {
        return;
      }

      if (isSpeaking) {
        stopSpeaking();
        return;
      }

      try {
        global.speechSynthesis.cancel();
        const utterance = new global.SpeechSynthesisUtterance(currentTranslatedText);
        utterance.lang = mapSpeechLang(currentPopoverTargetLang);
        utterance.onend = () => stopSpeaking();
        utterance.onerror = () => stopSpeaking();

        isSpeaking = true;
        if (speakBtnEl) {
          speakBtnEl.classList.add('wt-speaking');
          speakBtnEl.innerHTML = `${SVG_SPEAK}<span>停止</span>`;
        }
        global.speechSynthesis.speak(utterance);
      } catch (_) {
        stopSpeaking();
      }
    }

    function getCurrentSelectionRect(fallbackClientX, fallbackClientY) {
      const sel = global.getSelection ? global.getSelection() : null;
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect && (rect.width > 0 || rect.height > 0)) {
          return rect;
        }
      }
      if (typeof fallbackClientX === 'number' && typeof fallbackClientY === 'number') {
        return {
          left: fallbackClientX,
          right: fallbackClientX,
          top: fallbackClientY,
          bottom: fallbackClientY,
          width: 0,
          height: 0
        };
      }
      return null;
    }

    function handleMouseUp(e) {
      if (e.button !== 0) return;
      if (isExcluded || settings.selectionMode === 'off') return;
      if (rootContainer && rootContainer.contains(e.target)) return;
      if (isEditableTarget(e.target)) return;

      const clientX = e.clientX;
      const clientY = e.clientY;

      setTimeout(() => {
        if (isExcluded || settings.selectionMode === 'off') return;
        const sel = global.getSelection ? global.getSelection() : null;
        if (!sel || sel.isCollapsed) {
          hideTrigger();
          return;
        }
        if (isEditableTarget(sel.anchorNode) || isEditableTarget(sel.focusNode)) {
          hideTrigger();
          return;
        }
        if (
          rootContainer &&
          (rootContainer.contains(sel.anchorNode) || rootContainer.contains(sel.focusNode))
        ) {
          return;
        }

        const text = sel.toString().trim();
        if (!text) {
          hideTrigger();
          return;
        }

        const rect = getCurrentSelectionRect(clientX, clientY);
        pendingSelection = { text, rect };

        if (settings.selectionMode === 'instant') {
          openPopover(text, settings.targetLang, rect);
        } else {
          showTrigger(rect);
        }
      }, 10);
    }

    function handleMouseDown(e) {
      if (rootContainer && rootContainer.contains(e.target)) return;
      hideTrigger();
      if (popoverEl && !popoverEl.classList.contains('wt-hidden')) {
        closePopover();
      }
      if (fabOpen) {
        fabOpen = false;
        syncFloatingBallPanel();
      }
    }

    function handleFocusIn(e) {
      if (e && isFocusablePageEditable(e.target, rootContainer)) {
        lastFocusedEditable = e.target;
      }
    }

    function handleKeyDown(e) {
      if (!e) return;
      if (e.key === 'Escape') {
        hideTrigger();
        closePopover();
        if (fabOpen) {
          fabOpen = false;
          syncFloatingBallPanel();
        }
        if (sidebarOpen) {
          toggleSidebar({ open: false });
        }
        return;
      }

      if (
        !isExcluded &&
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        ((e.key && e.key.toLowerCase() === 's') || e.code === 'KeyS')
      ) {
        if (typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
        toggleSidebar();
      }
    }

    function bindEvents() {
      if (listenersBound || typeof document === 'undefined') return;
      listenersBound = true;
      document.addEventListener('mouseup', handleMouseUp, true);
      document.addEventListener('mousedown', handleMouseDown, true);
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('focusin', handleFocusIn, true);
    }

    function showSelectionTranslation(payload) {
      const data = payload || {};
      const sel = global.getSelection ? global.getSelection() : null;
      const selected = sel ? sel.toString().trim() : '';
      const text = (data.text || selected || '').trim();
      if (!text) return false;
      const rect = getCurrentSelectionRect();
      openPopover(text, data.targetLang || settings.targetLang, rect);
      return true;
    }

    function updateSettings(nextSettings, nextExcluded) {
      if (typeof nextExcluded === 'boolean') {
        isExcluded = nextExcluded;
      }
      if (nextSettings) {
        const mergedLoom = Object.assign(
          {},
          settings.loomConfig || baseLoomConfig,
          nextSettings.loomConfig || {}
        );
        const mergedOpenAI = Object.assign(
          {},
          settings.openaiConfig || baseOpenAIConfig,
          nextSettings.openaiConfig || {}
        );
        const mergedCodex = Object.assign(
          {},
          settings.codexConfig || baseCodexConfig,
          nextSettings.codexConfig || {}
        );
        settings = Object.assign({}, settings, nextSettings, {
          loomConfig: mergedLoom,
          openaiConfig: mergedOpenAI,
          codexConfig: mergedCodex
        });
      }
      if (settings.selectionMode === 'off' || isExcluded) {
        hideTrigger();
      }
      syncFloatingBallVisibility();
      syncFloatingBallState();
      syncSidebarModelSelect();
    }

    function syncPageStatus(nextStatus) {
      if (nextStatus) {
        pageStatus = Object.assign({}, pageStatus, nextStatus);
      }
      syncFloatingBallState();
    }

    function destroy() {
      stopSpeaking();
      chatRequestId += 1;
      summaryRequestId += 1;
      writeRequestId += 1;
      if (copyTimer) {
        clearTimeout(copyTimer);
        copyTimer = null;
      }
      if (progressHideTimer) {
        clearTimeout(progressHideTimer);
        progressHideTimer = null;
      }
      if (modelHintTimer) {
        clearTimeout(modelHintTimer);
        modelHintTimer = null;
      }
      if (sidebarNoticeTimer) {
        clearTimeout(sidebarNoticeTimer);
        sidebarNoticeTimer = null;
      }
      while (extraCleanupCallbacks.length > 0) {
        const fn = extraCleanupCallbacks.pop();
        try {
          fn();
        } catch (_) {
          // Ignore
        }
      }
      if (listenersBound && typeof document !== 'undefined') {
        document.removeEventListener('mouseup', handleMouseUp, true);
        document.removeEventListener('mousedown', handleMouseDown, true);
        document.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('focusin', handleFocusIn, true);
        listenersBound = false;
      }
      if (rootContainer && rootContainer.parentNode) {
        rootContainer.parentNode.removeChild(rootContainer);
      }
      rootContainer = null;
      progressEl = null;
      progressBarEl = null;
      sidebarEl = null;
      lastFocusedEditable = null;
    }

    ensureRoot();
    bindEvents();

    return {
      showSelectionTranslation,
      openPopover,
      closePopover,
      updateSettings,
      syncPageStatus,
      toggleSidebar,
      openSidebarAction,
      isSidebarOpen,
      extractPageContext,
      destroy
    };
  }

  WTContent.createSelectionUI = createSelectionUI;
})(typeof globalThis !== 'undefined' ? globalThis : window);
