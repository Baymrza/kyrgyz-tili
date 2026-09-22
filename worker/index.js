/* ============================================================
   Cloudflare Worker: раздаёт сайт, переводит текст через Workers AI
   и хранит отзывы гостей в Workers KV.
   Всё, кроме /api/*, отдаётся как обычные файлы сайта.
   ============================================================ */

const LANGS = {
  ky: 'Kyrgyz', ru: 'Russian', en: 'English', tr: 'Turkish', de: 'German',
  fr: 'French', es: 'Spanish', it: 'Italian', kk: 'Kazakh', uz: 'Uzbek',
  ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', hi: 'Hindi'
};

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign(
      { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      extraHeaders || {}
    )
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

/* ============================================================
   ОТЗЫВЫ ГОСТЕЙ
   Ключ в KV: review:<инверсия времени>:<случайное> — при таком
   порядке список KV.list() сам возвращает новые отзывы первыми.
   ============================================================ */

const REVIEW_TEXT_MAX  = 500;
const REVIEW_NAME_MAX  = 60;
const REVIEW_PHOTO_MAX = 300 * 1024;   // ~300 КБ на строку data:URL
const REVIEW_LIST_MAX  = 60;
const THROTTLE_SECONDS = 25;           // не чаще одного отзыва раз в 25 секунд с одного IP

function reviewKey(ts, rand) {
  const inv = String(9999999999999 - ts).padStart(13, '0');
  return 'review:' + inv + ':' + rand;
}

function randomId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

async function ipHash(request) {
  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('kgt-salt-' + ip));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

function isAdmin(request, env) {
  const key = request.headers.get('x-admin-key');
  return !!(env.ADMIN_KEY && key && key === env.ADMIN_KEY);
}

async function listReviews(request, env) {
  if (!env.REVIEWS) return json({ error: 'kv-unavailable' }, 503);
  const admin = isAdmin(request, env);

  const page = await env.REVIEWS.list({ prefix: 'review:', limit: REVIEW_LIST_MAX });
  const items = await Promise.all(page.keys.map(async k => {
    const raw = await env.REVIEWS.get(k.name);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }));

  const visible = items
    .filter(Boolean)
    .filter(r => admin || !r.hidden)
    .map(r => admin ? r : { id: r.id, name: r.name, place: r.place, text: r.text, photo: r.photo, ts: r.ts });

  return json({ reviews: visible, admin: admin });
}

async function createReview(request, env) {
  if (!env.REVIEWS) return json({ error: 'kv-unavailable' }, 503);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad-request' }, 400); }

  // невидимая ловушка для ботов: настоящий человек это поле не заполнит
  if (body.website) return json({ ok: true }, 201);

  const text = String(body.text || '').trim().slice(0, REVIEW_TEXT_MAX);
  const name = String(body.name || '').trim().slice(0, REVIEW_NAME_MAX);
  const place = String(body.place || 'general').trim().slice(0, 40);
  let photo = typeof body.photo === 'string' ? body.photo : '';

  if (!text) return json({ error: 'empty-text' }, 400);
  if (photo && (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(photo) || photo.length > REVIEW_PHOTO_MAX)) {
    return json({ error: 'photo-too-big' }, 413);
  }

  const hash = await ipHash(request);
  const throttleKey = 'throttle:' + hash;
  if (await env.REVIEWS.get(throttleKey)) {
    return json({ error: 'too-fast' }, 429);
  }
  await env.REVIEWS.put(throttleKey, '1', { expirationTtl: THROTTLE_SECONDS });

  const ts = Date.now();
  const id = randomId();
  const record = { id: id, name: name, place: place, text: text, photo: photo || null, ts: ts, hidden: false };

  await env.REVIEWS.put(reviewKey(ts, id), JSON.stringify(record));

  return json({ review: record }, 201);
}

async function findReviewFullKey(env, id) {
  const page = await env.REVIEWS.list({ prefix: 'review:', limit: 1000 });
  const hit = page.keys.find(k => k.name.endsWith(':' + id));
  return hit ? hit.name : null;
}

async function setHidden(request, env, id, hidden) {
  if (!env.REVIEWS) return json({ error: 'kv-unavailable' }, 503);
  if (!isAdmin(request, env)) return json({ error: 'forbidden' }, 403);

  const key = await findReviewFullKey(env, id);
  if (!key) return json({ error: 'not-found' }, 404);

  const raw = await env.REVIEWS.get(key);
  if (!raw) return json({ error: 'not-found' }, 404);

  const record = JSON.parse(raw);
  record.hidden = hidden;
  await env.REVIEWS.put(key, JSON.stringify(record));

  return json({ review: record });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

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

    // /api/reviews
    if (parts[0] === 'api' && parts[1] === 'reviews') {
      if (parts.length === 2) {
        if (request.method === 'GET')  return listReviews(request, env);
        if (request.method === 'POST') return createReview(request, env);
        return json({ error: 'method-not-allowed' }, 405);
      }
      if (parts.length === 4 && parts[3] === 'hide' && request.method === 'POST') {
        return setHidden(request, env, parts[2], true);
      }
      if (parts.length === 4 && parts[3] === 'unhide' && request.method === 'POST') {
        return setHidden(request, env, parts[2], false);
      }
      return json({ error: 'not-found' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
