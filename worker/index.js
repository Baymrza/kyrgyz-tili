/* ============================================================
   Cloudflare Worker: раздаёт сайт и переводит текст через Workers AI.
   Всё, кроме /api/translate, отдаётся как обычные файлы сайта.
   ============================================================ */

const LANGS = {
  ky: 'Kyrgyz', ru: 'Russian', en: 'English', tr: 'Turkish', de: 'German',
  fr: 'French', es: 'Spanish', it: 'Italian', kk: 'Kazakh', uz: 'Uzbek',
  ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', hi: 'Hindi'
};

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function clean(s) {
  return String(s || '')
    .trim()
    .replace(/^["«»'`]+|["«»'`]+$/g, '')
    .replace(/^(Translation|Перевод|Котормо)\s*:\s*/i, '')
    .trim();
}

async function translate(env, text, from, to) {
  const system =
    'You are a translation engine. Translate the user message from ' + LANGS[from] +
    ' into ' + LANGS[to] + '. Reply with the translation only: no quotes, no transliteration, ' +
    'no explanations, no notes, no alternatives. Keep proper names, numbers and prices unchanged. ' +
    'Preserve the tone and politeness level. If the text is already in ' + LANGS[to] + ', repeat it unchanged.';

  const res = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: text }
    ],
    max_tokens: 800,
    temperature: 0.2
  });

  return clean(res && (res.response !== undefined ? res.response : res.result && res.result.response));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/translate') {
      if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad-request' }, 400); }

      const text = String(body.text || '').slice(0, 1000).trim();
      const from = LANGS[body.from] ? body.from : 'ky';
      const to   = LANGS[body.to]   ? body.to   : 'en';

      if (!text) return json({ error: 'empty-text' }, 400);
      if (from === to) return json({ translation: text });
      if (!env.AI) return json({ error: 'ai-unavailable' }, 503);

      try {
        const translation = await translate(env, text, from, to);
        if (!translation) return json({ error: 'empty-result' }, 502);
        return json({ translation: translation, model: MODEL });
      } catch (e) {
        return json({ error: 'ai-failed', detail: String((e && e.message) || e) }, 502);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
