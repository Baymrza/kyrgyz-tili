/* ============================================================
   Кыргызча сүйлөшөлү — переводчик и разговорник для гостей
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));

  /* ---------- языки интерфейса ---------- */
  let lang = 'kg';
  try {
    const saved = localStorage.getItem('kgt-lang');
    if (['kg', 'ru', 'en'].indexOf(saved) !== -1) lang = saved;
  } catch (e) {}

  const i18nNodes = $$('[data-ru]');
  i18nNodes.forEach(n => { if (!n.dataset.kg) n.dataset.kg = n.textContent.trim(); });
  const t = (kg, ru, en) => (lang === 'kg' ? kg : lang === 'ru' ? ru : en);

  function applyLang() {
    i18nNodes.forEach(n => { const v = n.dataset[lang]; if (v) n.textContent = v; });
    document.documentElement.lang = lang === 'kg' ? 'ky' : lang;
    $$('.lang__b').forEach(b => b.classList.toggle('is-on', b.dataset.lang === lang));
    const inp = $('#trIn');
    inp.placeholder = inp.dataset['ph' + (lang === 'kg' ? 'Kg' : lang === 'ru' ? 'Ru' : 'En')];
    $('#trOut').dataset.ph = t('Котормо ушул жерде чыгат',
                               'Здесь появится перевод',
                               'The translation will appear here');
    renderCats();
    renderPhrases();
    updateGoogleLink();
    updateMicState();
  }

  $$('.lang__b').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.lang === lang) return;
    lang = b.dataset.lang;
    try { localStorage.setItem('kgt-lang', lang); } catch (e) {}
    applyLang();
  }));

  /* ============================================================
     ПЕРЕВОДЧИК
     ============================================================ */
  const LANGS = [
    { c: 'ky', n: 'Кыргызча',  s: null      },
    { c: 'ru', n: 'Русский',   s: 'ru-RU'   },
    { c: 'en', n: 'English',   s: 'en-US'   },
    { c: 'tr', n: 'Türkçe',    s: 'tr-TR'   },
    { c: 'de', n: 'Deutsch',   s: 'de-DE'   },
    { c: 'fr', n: 'Français',  s: 'fr-FR'   },
    { c: 'es', n: 'Español',   s: 'es-ES'   },
    { c: 'it', n: 'Italiano',  s: 'it-IT'   },
    { c: 'kk', n: 'Қазақша',   s: 'kk-KZ'   },
    { c: 'uz', n: "O'zbekcha", s: 'uz-UZ'   },
    { c: 'ar', n: 'العربية',    s: 'ar-SA'   },
    { c: 'zh', n: '中文',       s: 'zh-CN'   },
    { c: 'ja', n: '日本語',      s: 'ja-JP'   },
    { c: 'ko', n: '한국어',      s: 'ko-KR'   },
    { c: 'hi', n: 'हिन्दी',       s: 'hi-IN'   }
  ];
  const byCode = c => LANGS.filter(l => l.c === c)[0];

  const selFrom = $('#trFrom'), selTo = $('#trTo');
  LANGS.forEach(l => {
    [selFrom, selTo].forEach(sel => {
      const o = document.createElement('option');
      o.value = l.c; o.textContent = l.n;
      sel.appendChild(o);
    });
  });
  selFrom.value = 'ky';
  selTo.value = 'en';

  function setStatus(msg, bad) {
    const el = $('#trStatus');
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.textContent = msg;
    el.classList.toggle('is-bad', !!bad);
    el.hidden = false;
  }

  function updateGoogleLink() {
    const a = $('#trGoogle');
    const txt = $('#trIn').value.trim();
    a.href = 'https://translate.google.com/?op=translate&sl=' + selFrom.value +
             '&tl=' + selTo.value + (txt ? '&text=' + encodeURIComponent(txt) : '');
  }

  $('#trSwap').addEventListener('click', () => {
    const a = selFrom.value, b = selTo.value;
    selFrom.value = b; selTo.value = a;
    const inp = $('#trIn'), out = $('#trOut');
    const prev = out.textContent.trim();
    if (prev) { inp.value = prev; out.textContent = ''; updateCount(); }
    updateGoogleLink(); updateMicState();
  });

  [selFrom, selTo].forEach(s => s.addEventListener('change', () => {
    if (selFrom.value === selTo.value) {
      selTo.value = selFrom.value === 'ky' ? 'en' : 'ky';
    }
    updateGoogleLink(); updateMicState();
  }));

  function updateCount() {
    const v = $('#trIn').value;
    $('#trCount').textContent = v.length + ' / 1000';
  }
  $('#trIn').addEventListener('input', () => { updateCount(); updateGoogleLink(); });
  $('#trClear').addEventListener('click', () => {
    $('#trIn').value = ''; $('#trOut').textContent = ''; updateCount(); setStatus(''); updateGoogleLink();
  });

  $('#trCopy').addEventListener('click', async () => {
    const txt = $('#trOut').textContent.trim();
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      setStatus(t('Көчүрүлдү.', 'Скопировано.', 'Copied.'), false);
    } catch (e) {
      setStatus(t('Көчүрүү мүмкүн болбоду — колдон белгилеп алыңыз.',
                  'Не удалось скопировать — выделите текст вручную.',
                  'Could not copy — select the text by hand.'), true);
    }
  });

  let busy = false;
  async function translate() {
    if (busy) return;
    const text = $('#trIn').value.trim();
    if (!text) {
      setStatus(t('Алгач текстти жазыңыз.', 'Сначала введите текст.', 'Enter some text first.'), true);
      return;
    }
    busy = true;
    const go = $('#trGo');
    go.disabled = true;
    setStatus(t('Которулууда…', 'Перевожу…', 'Translating…'), false);
    $('#trOut').textContent = '';
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text, from: selFrom.value, to: selTo.value })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.translation) throw new Error(data.error || res.status);
      const out = $('#trOut');
      out.textContent = data.translation;
      out.classList.toggle('is-big', data.translation.length < 90);
      setStatus(t('Машина котормосу — маанисин түшүнүүгө жетиштүү, расмий кагаз үчүн эмес.',
                  'Машинный перевод — смысл передаёт, но для официальных бумаг не годится.',
                  'Machine translation — good enough to be understood, not for official papers.'), false);
    } catch (e) {
      setStatus(t('Котормо иштебей калды. Интернетти текшериңиз же Google котормочусун ачыңыз.',
                  'Перевод не сработал. Проверьте интернет или откройте Google Переводчик.',
                  'Translation failed. Check your connection or open Google Translate.'), true);
    } finally {
      busy = false;
      go.disabled = false;
    }
  }
  $('#trGo').addEventListener('click', translate);
  $('#trIn').addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') translate();
  });

  /* ---------- озвучка ---------- */
  function speak(text, code, node) {
    if (!('speechSynthesis' in window) || !text) return false;
    const voices = speechSynthesis.getVoices();
    let want = code === 'ky' ? 'ru' : code;           // кыргызского голоса в браузерах нет
    let voice = voices.filter(v => v.lang.toLowerCase().indexOf(want) === 0)[0];
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = code === 'ky' ? 0.85 : 0.95;
    if (node) {
      node.classList.add('is-playing');
      u.onend = u.onerror = () => node.classList.remove('is-playing');
    }
    speechSynthesis.speak(u);
    return true;
  }
  if ('speechSynthesis' in window) speechSynthesis.getVoices();

  $('#trPlay').addEventListener('click', () => {
    const txt = $('#trOut').textContent.trim();
    if (!txt) return;
    const ok = speak(txt, selTo.value, null);
    if (!ok) setStatus(t('Бул браузерде үн жок.', 'В этом браузере нет озвучки.', 'This browser has no speech output.'), true);
    else if (selTo.value === 'ky') {
      setStatus(t('Кыргыз үнү браузерлерде жок — орус үнү менен болжолдуу окулду.',
                  'Кыргызского голоса в браузерах нет — прочитано русским голосом, приблизительно.',
                  'Browsers have no Kyrgyz voice — read approximately with a Russian one.'), false);
    }
  });

  /* ---------- микрофон ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false;

  function updateMicState() {
    const mic = $('#trMic');
    const l = byCode(selFrom.value);
    const can = !!SR && l && l.s;
    mic.disabled = !can;
    mic.title = can
      ? t('Микрофонго сүйлөңүз', 'Говорите в микрофон', 'Speak into the microphone')
      : (!SR
          ? t('Бул браузер микрофонду колдобойт', 'Этот браузер не поддерживает микрофон', 'This browser does not support speech input')
          : t('Кыргыз кебин браузерлер азырынча тааныбайт — колдон жазыңыз',
              'Кыргызскую речь браузеры пока не распознают — наберите текст',
              'Browsers cannot yet recognise spoken Kyrgyz — please type'));
  }

  $('#trMic').addEventListener('click', () => {
    const l = byCode(selFrom.value);
    if (!SR || !l || !l.s) return;
    if (listening && rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = l.s;
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onstart = () => {
      listening = true;
      $('#trMic').classList.add('is-live');
      setStatus(t('Угуп жатам…', 'Слушаю…', 'Listening…'), false);
    };
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      $('#trIn').value = (finalText + interim).trim();
      updateCount(); updateGoogleLink();
    };
    rec.onerror = ev => {
      setStatus(ev.error === 'not-allowed'
        ? t('Микрофонго уруксат берилген жок.', 'Доступ к микрофону не разрешён.', 'Microphone access was denied.')
        : t('Микрофон иштебей калды.', 'Микрофон не сработал.', 'Speech input failed.'), true);
    };
    rec.onend = () => {
      listening = false;
      $('#trMic').classList.remove('is-live');
      if ($('#trIn').value.trim()) translate();
      else setStatus('');
    };
    try { rec.start(); } catch (e) {}
  });

  /* ============================================================
     РАЗГОВОРНИК
     ============================================================ */
  const CATS = [
    { id: 'hi',   kg: 'Саламдашуу',  ru: 'Приветствия',   en: 'Greetings' },
    { id: 'meet', kg: 'Таанышуу',    ru: 'Знакомство',    en: 'Getting acquainted' },
    { id: 'road', kg: 'Жол',         ru: 'Дорога',        en: 'Getting around' },
    { id: 'shop', kg: 'Базар',       ru: 'Базар',         en: 'At the bazaar' },
    { id: 'food', kg: 'Тамак',       ru: 'Еда',           en: 'Food' },
    { id: 'help', kg: 'Конокчулук',  ru: 'В гостях',      en: 'Hospitality & help' }
  ];

  const PHRASES = [
    { c:'hi',   kg:'Салам!',                      lat:'Salam!',                       ru:'Привет!',                     en:'Hi!' },
    { c:'hi',   kg:'Саламатсызбы?',               lat:'Salamatsyzby?',                ru:'Здравствуйте!',               en:'Hello! (polite)' },
    { c:'hi',   kg:'Кош келиңиз!',                lat:'Kosh keliŋiz!',                ru:'Добро пожаловать!',           en:'Welcome!' },
    { c:'hi',   kg:'Рахмат!',                     lat:'Rahmat!',                      ru:'Спасибо!',                    en:'Thank you!' },
    { c:'hi',   kg:'Кечиресиз',                   lat:'Kechiresiz',                   ru:'Извините',                    en:'Excuse me / Sorry' },
    { c:'hi',   kg:'Жакшы калыңыз',               lat:'Jakshy kalyŋyz',               ru:'До свидания (остающимся)',    en:'Goodbye (to those staying)' },

    { c:'meet', kg:'Менин атым…',                 lat:'Menin atym…',                  ru:'Меня зовут…',                 en:'My name is…' },
    { c:'meet', kg:'Сиздин атыңыз ким?',          lat:'Sizdin atyŋyz kim?',           ru:'Как вас зовут?',              en:'What is your name?' },
    { c:'meet', kg:'Мен туристмин',               lat:'Men turistmin',                ru:'Я турист',                    en:'I am a tourist' },
    { c:'meet', kg:'Мен кыргызча билбейм',        lat:'Men kyrgyzcha bilbeym',        ru:'Я не говорю по-кыргызски',    en:'I do not speak Kyrgyz' },
    { c:'meet', kg:'Англисче билесизби?',         lat:'Angliische bilesizbi?',        ru:'Вы говорите по-английски?',   en:'Do you speak English?' },
    { c:'meet', kg:'Түшүнбөй жатам',              lat:'Tüshünböy jatam',              ru:'Я не понимаю',                en:'I do not understand' },

    { c:'road', kg:'… кайда?',                    lat:'… kayda?',                     ru:'Где …?',                      en:'Where is …?' },
    { c:'road', kg:'Бул жер кайсы жер?',          lat:'Bul jer kaysy jer?',           ru:'Что это за место?',           en:'What place is this?' },
    { c:'road', kg:'Оңго / солго',                lat:'Oŋgo / solgo',                 ru:'Направо / налево',            en:'Right / left' },
    { c:'road', kg:'Түз барыңыз',                 lat:'Tüz baryŋyz',                  ru:'Идите прямо',                 en:'Go straight ahead' },
    { c:'road', kg:'Алыспы?',                     lat:'Alyspy?',                      ru:'Далеко?',                     en:'Is it far?' },
    { c:'road', kg:'Мага жардам бере аласызбы?',  lat:'Maga jardam bere alasyzby?',   ru:'Вы можете мне помочь?',       en:'Could you help me?' },

    { c:'shop', kg:'Бул канча турат?',            lat:'Bul kancha turat?',            ru:'Сколько это стоит?',          en:'How much is this?' },
    { c:'shop', kg:'Кымбат экен',                 lat:'Kymbat eken',                  ru:'Дороговато',                  en:'That is expensive' },
    { c:'shop', kg:'Арзандатып бериңизчи',        lat:'Arzandatyp beriŋizchi',        ru:'Сделайте скидку, пожалуйста', en:'Could you lower the price?' },
    { c:'shop', kg:'Мен муну алам',               lat:'Men munu alam',                ru:'Я возьму это',                en:'I will take this' },
    { c:'shop', kg:'Карта менен төлөсө болобу?',  lat:'Karta menen tölösö bolobu?',   ru:'Можно оплатить картой?',      en:'Can I pay by card?' },
    { c:'shop', kg:'Дагы бирөө бериңиз',          lat:'Dagy biröö beriŋiz',           ru:'Дайте ещё один',              en:'One more, please' },

    { c:'food', kg:'Меню бар бекен?',             lat:'Menyu bar beken?',             ru:'Есть меню?',                  en:'Do you have a menu?' },
    { c:'food', kg:'Даамдуу экен!',               lat:'Daamduu eken!',                ru:'Очень вкусно!',               en:'This is delicious!' },
    { c:'food', kg:'Мен эт жебейм',               lat:'Men et jebeym',                ru:'Я не ем мясо',                en:'I do not eat meat' },
    { c:'food', kg:'Бир чыны чай',                lat:'Bir chyny chay',               ru:'Одну пиалу чая',              en:'A bowl of tea, please' },
    { c:'food', kg:'Суу, сураныч',                lat:'Suu, suranych',                ru:'Воды, пожалуйста',            en:'Water, please' },
    { c:'food', kg:'Эсебин алып келиңиз',         lat:'Esebin alyp keliŋiz',          ru:'Счёт, пожалуйста',            en:'The bill, please' },

    { c:'help', kg:'Конок келсе, кут келет',      lat:'Konok kelse, kut kelet',       ru:'Гость в дом — благодать в дом', en:'A guest brings blessing' },
    { c:'help', kg:'Үйгө кириңиз',                lat:'Üygö kiriŋiz',                 ru:'Проходите в дом',             en:'Please come in' },
    { c:'help', kg:'Кымыз ичип көрүңүз',          lat:'Kymyz ichip körüŋüz',          ru:'Попробуйте кумыс',            en:'Try some kymyz' },
    { c:'help', kg:'Жардам бериңиз!',             lat:'Jardam beriŋiz!',              ru:'Помогите!',                   en:'Help, please!' },
    { c:'help', kg:'Дарыгер керек',               lat:'Daryger kerek',                ru:'Нужен врач',                  en:'I need a doctor' },
    { c:'help', kg:'Полиция чакырыңыз',           lat:'Politsiya chakyryŋyz',         ru:'Вызовите полицию',            en:'Call the police' }
  ];

  let activeCat = CATS[0].id;

  function renderCats() {
    const box = $('#cats');
    box.innerHTML = '';
    CATS.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cat' + (c.id === activeCat ? ' is-on' : '');
      b.textContent = t(c.kg, c.ru, c.en);
      b.addEventListener('click', () => {
        activeCat = c.id;
        renderCats();
        renderPhrases();
      });
      box.appendChild(b);
    });
  }

  function renderPhrases() {
    const box = $('#phrases-list');
    box.innerHTML = '';
    PHRASES.filter(p => p.c === activeCat).forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ph';
      b.innerHTML =
        '<span class="ph__play" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>' +
          '</svg>' +
        '</span>' +
        '<span class="ph__kg"></span><span class="ph__lat"></span><span class="ph__tr"></span>';
      $('.ph__kg', b).textContent  = p.kg;
      $('.ph__lat', b).textContent = p.lat;
      $('.ph__tr', b).textContent  = lang === 'en' ? p.en : lang === 'ru' ? p.ru : p.ru + ' · ' + p.en;
      b.addEventListener('click', () => speak(p.kg, 'ky', b));
      box.appendChild(b);
    });
  }

  /* ============================================================
     ЛОКАЦИИ: фото и видео подставляются, если файл лежит в папке
     ============================================================ */
  function loadPlaces() {
    $$('.place').forEach(card => {
      const media = $('.place__media', card);
      const name  = ($('.place__name', card) || {}).textContent || '';
      const imgSrc = card.dataset.img;
      const vidSrc = card.dataset.video;
      if (!media) return;

      if (imgSrc) {
        const probe = new Image();
        probe.onload = () => {
          if ($('video', media)) return;           // видео уже победило
          const el = document.createElement('img');
          el.src = imgSrc; el.alt = name; el.loading = 'lazy';
          media.appendChild(el);
        };
        probe.src = imgSrc;
      }

      if (vidSrc) {
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true;
        v.setAttribute('playsinline', ''); v.preload = 'metadata';
        v.addEventListener('loadeddata', () => {
          const img = $('img', media);
          if (img) img.remove();
          media.appendChild(v);
          const play = () => v.play().catch(() => {});
          play();
        }, { once: true });
        v.src = vidSrc;
      }
    });
  }

  /* ---------- старт ---------- */
  updateCount();
  applyLang();
  loadPlaces();
})();
