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
    renderRegions();
    renderPlaces();
    renderPhrases();
    updateGoogleLink();
    updateMicState();
    rvFillPlaceSelect();
    rvRenderList();
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
     ЛОКАЦИИ ПО ОБЛАСТЯМ
     Фото и видео подставляются сами, если файл лежит в assets/places.
     ============================================================ */
  const REGIONS = [
    { id: 'all',    kg: 'Баары',      ru: 'Все области',  en: 'All regions' },
    { id: 'chuy',   kg: 'Чүй',        ru: 'Чуй',          en: 'Chuy' },
    { id: 'issyk',  kg: 'Ысык-Көл',   ru: 'Иссык-Куль',   en: 'Issyk-Kul' },
    { id: 'naryn',  kg: 'Нарын',      ru: 'Нарын',        en: 'Naryn' },
    { id: 'talas',  kg: 'Талас',      ru: 'Талас',        en: 'Talas' },
    { id: 'jalal',  kg: 'Жалал-Абад', ru: 'Джалал-Абад',  en: 'Jalal-Abad' },
    { id: 'osh',    kg: 'Ош',         ru: 'Ош',           en: 'Osh' },
    { id: 'batken', kg: 'Баткен',     ru: 'Баткен',       en: 'Batken' }
  ];

  /* v — короткое значение (строка или [kg,ru,en]); u — единица; l — подпись */
  const PLACES = [

    /* ---------------- ЧҮЙ ---------------- */
    {
      id: 'birch', reg: 'chuy', img: 'birch.jpg',
      season: ['Сентябрдын ортосунан октябрдын аягына чейин', 'С середины сентября до конца октября', 'Mid-September to late October'],
      name: 'Кайың токой',
      sub: ['Бойрок урочищеси, Кашка-Суу тарап', 'Берёзовая роща, урочище Бойрок', 'The birch grove, Boyrok'],
      txt: [
        'Бишкекке эң жакын кооздук: эки жумада токой саргарып, жарык жалбырактардын арасынан өтүп, ак дарактар ичинен жаркырагандай көрүнөт. Кашка-Суу тарапка 25 чакырым, жарым саат жол. Жумуш күндөрү тынч, дем алышта эл көп.',
        'Ближайшая к Бишкеку красота: за пару недель роща становится золотой, и свет идёт сквозь листву так, что белые стволы будто светятся изнутри. Ехать примерно 25 километров в сторону Кашка-Суу, дорога занимает полчаса. В будний день здесь тихо, в выходные людно.',
        'The closest beauty to Bishkek. Within a couple of weeks the grove turns gold, and the light comes through the leaves until the white trunks seem lit from inside. About 25 km towards Kashka-Suu, half an hour by car. Quiet on weekdays, crowded at weekends.'
      ],
      f: [
        { v: '25', u: ['км', 'км', 'km'], l: ['Бишкектен', 'от Бишкека', 'from Bishkek'] },
        { v: '30–40', u: ['мүн', 'мин', 'min'], l: ['унаа менен', 'на машине', 'by car'] },
        { v: ['Жарым күн', 'Полдня', 'Half a day'], l: ['сейилдөөгө жетет', 'хватит на прогулку', 'is enough for the walk'] }
      ]
    },
    {
      id: 'koltor', reg: 'chuy', img: 'koltor.jpg',
      season: ['Жайында — жөө сапар, кышында — коньки', 'Летом — поход, зимой — коньки', 'A hike in summer, skates in winter'],
      name: 'Көл-Тор',
      sub: ['Кегети капчыгайы', 'Озеро Кол-Тор, ущелье Кегети', 'Lake Kol-Tor, Kegeti gorge'],
      txt: [
        'Кегети капчыгайындагы көгүлтүр көл, 2733 метр бийикте. Жайында сегиз чакырым өйдө, үч сааттай жол. Кышында көл тоңуп, табигый муз аянтчасына айланат — коньки көтөрүп чыгып, кар баскан чокулардын ортосунда тайгаланышат. Кышкы жол алда канча оор: эрте чыгып, жол башчы жана кошки менен баруу керек.',
        'Бирюзовое озеро в ущелье Кегети, на высоте 2733 метра. Летом — восемь километров вверх, около трёх часов. Зимой озеро замерзает и превращается в природный каток: коньки несут наверх, чтобы кататься в кольце заснеженных вершин. Зимний подъём куда серьёзнее летнего — выходить рано, с проводником и в кошках.',
        'A turquoise lake in the Kegeti gorge at 2,733 metres. In summer it is eight kilometres up, about three hours. In winter the lake freezes into a natural rink and people carry skates all the way up to glide inside a ring of snowy peaks. The winter ascent is far harder: start early, take a guide and crampons.'
      ],
      f: [
        { v: '80', u: ['км', 'км', 'km'], l: ['Бишкектен', 'от Бишкека', 'from Bishkek'] },
        { v: '2733', u: ['м', 'м', 'm'], l: ['көлдүн бийиктиги', 'высота озера', 'lake altitude'] },
        { v: '8', u: ['км', 'км', 'km'], l: ['жөө өйдө', 'подъём пешком', 'of climb on foot'] }
      ]
    },
    {
      id: 'flooded', reg: 'chuy', img: 'flooded.jpg',
      season: ['Жаз мезгилинде гана, бир айга жакын', 'Только весной, окно около месяца', 'Spring only, a window of about a month'],
      name: 'Суу баскан токой',
      sub: ['Ала-Арча суу сактагычы', 'Затопленный лес, Ала-Арчинское водохранилище', 'The flooded forest, Ala-Archa reservoir'],
      txt: [
        'Жазында Бишкектин жанындагы суу сактагыч сугат үчүн толтурулуп, жээктеги дарактар белине чейин сууда калат. Күзгүдөн өсүп чыккан токой пайда болот. Бир нече жумадан кийин суу агызылып, баары кийинки жылга чейин жоголот. Жолго чыгаардан мурун суу көтөрүлдүбү деп сурап коюңуз.',
        'Весной водохранилище под Бишкеком наполняют для полива, и деревья по берегу оказываются по пояс в воде. Получается лес, растущий прямо из зеркала. Через несколько недель воду спускают, и всё исчезает до следующего года. Это не постоянная достопримечательность, а короткое весеннее явление — перед поездкой спросите у местных, поднялась ли вода.',
        'Each spring the reservoir near Bishkek is filled for irrigation and the trees along the bank end up waist-deep in water — a forest growing straight out of a mirror. A few weeks later the water is released and it all vanishes until next year. Not a permanent sight but a short spring event: ask locals whether the water is up before you drive out.'
      ],
      f: [
        { v: ['Жаз', 'Весна', 'Spring'], l: ['суу толгондо', 'когда наполняют', 'when it is filled'] },
        { v: ['~1 ай', '~1 месяц', '~1 month'], l: ['кубулуш созулат', 'длится явление', 'the window lasts'] },
        { v: '< 1', u: ['с', 'ч', 'h'], l: ['Бишкектен жол', 'езды от Бишкека', 'drive from Bishkek'] }
      ]
    },
    {
      id: 'konorchok', reg: 'chuy', img: 'konorchok.jpg',
      season: ['Апрель — октябрь, эрте эртең менен', 'Апрель — октябрь, лучше рано утром', 'April to October, best early in the morning'],
      name: 'Коңорчок каньондору',
      sub: ['Боом капчыгайы, Ысык-Көл жолунда', 'Каньоны Конорчок, Боомское ущелье', 'Konorchok canyons, Boom gorge'],
      txt: [
        'Ысык-Көлгө бара жаткан жолдун жанындагы кызыл чопо мунаралар менен жарлар. Марска окшош жер: тар кургак нуктар, адамдан бир нече эсе бийик дубалдар, бир да дарак жок. Күндүз ысык жана көлөкө жок, ошондуктан эртең менен же кечинде барган жакшы.',
        'Красные глиняные башни и обрывы прямо у трассы на Иссык-Куль. Место похоже на Марс: узкие сухие русла, стены в несколько человеческих ростов, ни одного дерева. Днём здесь жарко и нет тени, поэтому идти лучше утром или под вечер.',
        'Red clay towers and cliffs right beside the road to Issyk-Kul. The place looks like Mars: narrow dry gullies, walls several times a person’s height, not a single tree. It is hot and shadeless at midday, so come early or towards evening.'
      ],
      f: [
        { v: ['Боом', 'Боом', 'Boom'], l: ['капчыгай', 'ущелье', 'gorge'] },
        { v: '2–3', u: ['с', 'ч', 'h'], l: ['жөө сейилдөө', 'прогулка пешком', 'of walking'] },
        { v: ['Көлөкө жок', 'Нет тени', 'No shade'], l: ['суу алыңыз', 'берите воду', 'bring water'] }
      ]
    },

    /* ---------------- ЫСЫК-КӨЛ ---------------- */
    {
      id: 'alakul', reg: 'issyk', img: 'alakul.jpg',
      season: ['Июль — сентябрь', 'Июль — сентябрь', 'July to September'],
      name: 'Ала-Көл',
      sub: ['3560 метр бийиктиктеги көл, Каракол', 'Озеро на 3560 м, Каракол', 'A lake at 3,560 m, Karakol'],
      txt: [
        'Өлкөдөгү эң популярдуу жөө маршрут: эки күн капчыгай менен өйдө, палаткада же Алтын-Арашандын үйчөлөрүндө түнөп, эртең менен ашуунун астында көгүлтүр көл ачылат. Жол техникалык жактан татаал эмес, бирок узун жана бийиктик көп. Июнда ашууда дагы эле кар жатат.',
        'Самый популярный треккинг страны: два дня вверх по ущелью, ночёвка в палатке или в домиках Алтын-Арашана, а наутро под перевалом открывается озеро цвета бирюзы. Тропа не техническая, но длинная и с серьёзным набором высоты. В июне на перевале ещё лежит снег.',
        'The most popular trek in the country: two days up the gorge, a night in a tent or in the huts of Altyn-Arashan, and in the morning a turquoise lake opens below the pass. The trail is not technical but it is long, with a serious climb. In June there is still snow on the pass.'
      ],
      f: [
        { v: '3560', u: ['м', 'м', 'm'], l: ['көлдүн бийиктиги', 'высота озера', 'lake altitude'] },
        { v: '2–3', u: ['күн', 'дня', 'days'], l: ['маршрут', 'на маршрут', 'on the trail'] },
        { v: ['Палатка', 'Палатка', 'A tent'], l: ['же үйчө керек', 'или домик', 'or a hut is needed'] }
      ]
    },
    {
      id: 'arashan', reg: 'issyk', img: 'arashan.jpg',
      season: ['Жыл бою, жайында жеңил', 'Круглый год, летом проще', 'All year, easier in summer'],
      name: 'Алтын-Арашан',
      sub: ['Ысык булактуу капчыгай, Каракол', 'Горячие источники в ущелье, Каракол', 'Hot springs in a gorge, Karakol'],
      txt: [
        'Караколдон жогору көтөрүлгөн капчыгай: жол ушунчалык оор, даярдалган УАЗ гана өтөт. Жогоруда жыгач үйчөлөр, дарыянын үстүндөгү ысык минералдуу ванналар жана Палатка чокусунун көрүнүшү. Ала-Көлдөн кийин бул жакка жылынганы келишет.',
        'Ущелье с горячими источниками выше Каракола. Дорога такая, что доезжают только подготовленные УАЗы. Наверху — деревянные домики, ванны с горячей минеральной водой прямо над рекой и вид на пик Палатка. Сюда приходят отогреться после Ала-Кёля.',
        'A gorge with hot springs above Karakol. The track is rough enough that only prepared 4x4s get through. At the top there are wooden huts, baths of hot mineral water right above the river, and a view of Palatka peak. People come here to thaw out after Ala-Kul.'
      ],
      f: [
        { v: '~2500', u: ['м', 'м', 'm'], l: ['бийиктик', 'высота', 'altitude'] },
        { v: ['УАЗ', 'УАЗ', '4x4'], l: ['же жөө басуу', 'или пешком', 'or on foot'] },
        { v: ['Ванналар', 'Ванны', 'Baths'], l: ['жыл бою ысык', 'горячие круглый год', 'hot all year'] }
      ]
    },
    {
      id: 'skazka', reg: 'issyk', img: 'skazka.jpg',
      season: ['Жыл бою, эң жакшысы — күн батканда', 'Круглый год, лучше всего на закате', 'All year round, best at sunset'],
      name: '«Жомок» каньону',
      sub: ['Ысык-Көлдүн түштүк жээги, Тосор', 'Каньон Сказка, южный берег Иссык-Куля', 'Skazka canyon, southern shore of Issyk-Kul'],
      txt: [
        'Шамал менен суу кызыл жана кызгылт сары чопо кабыргаларын мунараларга, кырларга, жаныбарлардын келбетине окшотуп чегип койгон — аты ошондон. Каньон чакан, бир-бир жарым саатта айланып чыгасың. Күн батканда чопо от алгандай жанат. Бут кийимиңиз жабык болсун: топурак борпоң, кырлар тар.',
        'Красные и оранжевые глиняные стены, которые ветер и вода выточили в башни, гребни и фигуры зверей — отсюда и название. Каньон небольшой, обойти можно за час-полтора, и он идеально ложится в дорогу вдоль южного берега. На закате глина загорается так, что уезжать не хочется. Обувь берите закрытую: грунт сыпучий, гребни узкие.',
        'Red and orange clay walls that wind and water have carved into towers, ridges and animal shapes — hence the name, “Fairy Tale”. The canyon is small, an hour or so to walk, and it fits perfectly into a drive along the southern shore. At sunset the clay catches fire and nobody wants to leave. Wear closed shoes: the ground is loose and the ridges are narrow.'
      ],
      f: [
        { v: '1–2', u: ['с', 'ч', 'h'], l: ['кароого жетет', 'хватит на осмотр', 'is enough to see it'] },
        { v: ['Кеч', 'Закат', 'Sunset'], l: ['эң жакшы жарык', 'лучший свет', 'the best light'] },
        { v: ['Тосор', 'Тосор', 'Tosor'], l: ['жакынкы айыл', 'ближайшее село', 'the nearest village'] }
      ]
    },
    {
      id: 'kyrchyn', reg: 'issyk', img: 'kyrchyn.jpg',
      season: ['Жайында, өзгөчө Дүйнөлүк көчмөндөр оюндарында', 'Летом, особенно во время Всемирных игр кочевников', 'Summer, especially during the World Nomad Games'],
      name: 'Кырчын жайлоосу',
      sub: ['Көчмөндөр ааламы этногородогу, Ысык-Көлдүн түндүгү', 'Этногородок «Вселенная кочевников», север Иссык-Куля', 'The “Universe of Nomads” ethno-town, northern shore of Issyk-Kul'],
      txt: [
        'Ала-Тоонун этегиндеги кең жайлоо, Дүйнөлүк көчмөндөр оюндарынын башкы аянтчасы. Бул жерде дасторкон, оймо-чийме жана акындардын төкмө ырлары бир жерге чогулат, ат чабыш менен көк бөрү өтөт. Балчыктан курулган этногородокто боз үйлөр менен заманбап капсула үйлөр катар турат. Оюндардан тышкары да жайлоо жашайт: малчылар малын жаят, ал эми конокторго боз үйдө түнөп кетүү сунушталат.',
        'Просторное джайлоо у подножия Ала-Тоо, главная площадка Всемирных игр кочевников. Здесь сходятся вместе ремёсла, национальная кухня и импровизационная поэзия акынов, проходят конные скачки и кок-бору. В глинобитном этногородке юрты стоят рядом с современными капсульными домиками. Джайлоо живёт и без Игр: скот пасут круглое лето, а гостям предлагают переночевать в юрте.',
        'A wide summer pasture at the foot of the Ala-Too range, the main venue of the World Nomad Games. Crafts, national cuisine and the improvised poetry of akyns all come together here, alongside horse racing and kok-boru. In the clay-walled ethno-town, yurts stand next to modern capsule cabins. The jailoo lives on outside the Games too: herders graze their animals all summer, and guests can spend the night in a yurt.'
      ],
      f: [
        { v: ['Оюндар', 'Игры', 'Games'], l: ['негизги аянтча', 'главная площадка', 'the main venue'] },
        { v: ['Боз үй', 'Юрта', 'A yurt'], l: ['түнөп чыгууга болот', 'можно переночевать', 'you can stay overnight'] },
        { v: ['Ала-Тоо', 'Ала-Тоо', 'Ala-Too'], l: ['тоо кыркасынын этегинде', 'у подножия хребта', 'at the foot of the range'] }
      ]
    },

    /* ---------------- НАРЫН ---------------- */
    {
      id: 'sonkul', reg: 'naryn', img: 'sonkul.jpg',
      season: ['Июнь — сентябрь', 'Июнь — сентябрь', 'June to September'],
      name: 'Соң-Көл',
      sub: ['3016 метрдеги көл жана жайлоо', 'Озеро-джайлоо на 3016 м', 'A lake and summer pasture at 3,016 m'],
      txt: [
        'Жайында жээкке боз үйлөр тигилип, жылкы багылат, ал эми түнкүсүн көлдүн үстүндө бир да шаардын жарыгы жок Саманчынын жолу көрүнөт. Электр жок, байланыш сейрек кармайт — маңызы ушунда. Кышында ашуулар жабылып, жетүү мүмкүн эмес.',
        'Летом на берегах ставят юрты и пасут лошадей, а ночью над озером встаёт Млечный Путь — без единого городского огня. Электричества нет, связь ловит редко, и в этом весь смысл. Зимой перевалы закрыты, добраться невозможно.',
        'In summer yurts go up along the shore and horses graze, and at night the Milky Way rises over the lake with not a single city light anywhere. There is no electricity and almost no signal — that is the point. In winter the passes close and the lake is unreachable.'
      ],
      f: [
        { v: '3016', u: ['м', 'м', 'm'], l: ['бийиктик', 'высота', 'altitude'] },
        { v: ['Боз үй', 'Юрты', 'Yurts'], l: ['июнь — сентябрь', 'июнь — сентябрь', 'June to September'] },
        { v: ['Байланыш жок', 'Нет связи', 'No signal'], l: ['электр да жок', 'и электричества', 'and no power'] }
      ]
    },
    {
      id: 'kelsuu', reg: 'naryn', img: 'kelsuu.jpg',
      season: ['Июнь — сентябрь · чек ара уруксаты керек', 'Июнь — сентябрь · нужен погранпропуск', 'June to September · border permit required'],
      name: 'Көл-Суу',
      sub: ['Ак-Сай өрөөнү, Ат-Башы району', 'Ак-Сайская долина, Ат-Башинский район', 'Ak-Sai valley, At-Bashy district'],
      txt: [
        'Көл тик аскалардын ортосунда, 3514 метр бийикте жатат, суусу нефриттей кара, тынчтыгы ушунчалык — өз деминди угасың. Аты «келген суу» дегенди билдирет: көл бирде толот, бирде кетет. Ак-Сай өрөөнү аркылуу өткөн жол — кечүүлөр менен саздар. Чек ара уруксаты бир жумадай даярдалат.',
        'Озеро зажато между отвесными скалами на высоте 3514 метров, вода тёмная, как нефрит, а тишина такая, что слышно собственное дыхание. Название переводят как «приходящая вода»: озеро то наполняется, то уходит. Дорога через Ак-Сайскую долину — броды и болотины, нужен внедорожник и водитель, который здесь бывал. Пропуск оформляют около недели, подавать лучше недели за две.',
        'The lake is wedged between sheer cliffs at 3,514 metres; the water is dark as jade and the silence deep enough to hear your own breathing. The name means roughly “water that comes”: it fills and drains again. The track across the Ak-Sai valley crosses fords and marshes — you need a 4x4 and a driver who has been there. The permit takes about a week, so apply a couple of weeks ahead.'
      ],
      f: [
        { v: '3514', u: ['м', 'м', 'm'], l: ['деңиз деңгээлинен', 'над уровнем моря', 'above sea level'] },
        { v: ['~7 күн', '~7 дней', '~7 days'], l: ['уруксат кагазга', 'оформление пропуска', 'to get the permit'] },
        { v: '4x4', l: ['жөнөкөй унаа өтпөйт', 'без внедорожника не проехать', 'no way through without one'] }
      ]
    },
    {
      id: 'kyzyl-asker', reg: 'naryn', img: 'kyzyl-asker.jpg',
      season: ['Экспедиция, июль — август', 'Экспедиция, июль — август', 'An expedition, July to August'],
      name: 'Кызыл-Аскер мөңгүсү',
      sub: ['Кокшаал-Тоо кырка тоосу', 'Хребет Кокшаал-Тоо, Нарынская область', 'Kokshaal-Too range, Naryn region'],
      txt: [
        'Тизмедеги эң катаал чекит. Бийиктиги 5842 метр болгон Кызыл-Аскер чокусу Кытай чек арасында турат жана кырка тоодо Данков чокусунан (5982 м) кийинки экинчи орунда; түндүк капталынан мөңгү ылдый жылат. Бул жерге дем алышка барышпайт: уруксат, даярдалган унаа жана жол башчы менен бир нече күндүк экспедиция керек.',
        'Самая суровая точка списка. Пик Кызыл-Аскер высотой 5842 метра стоит прямо на границе с Китаем и уступает в хребте только пику Данкова (5982 м); по северному склону сползает ледник. Сюда не ездят на выходные: это многодневная экспедиция с пропуском в погранзону, подготовленной машиной и проводником. Стены Кызыл-Аскера знают альпинисты всего мира.',
        'The harshest point on this list. Kyzyl-Asker peak, 5,842 metres, stands right on the Chinese border and is second in the range only to Pik Dankov (5,982 m); a glacier slides down its northern slope. This is no weekend trip — it is a multi-day expedition with a border permit, a capable vehicle and a guide. Climbers worldwide know these walls.'
      ],
      f: [
        { v: '5842', u: ['м', 'м', 'm'], l: ['чокунун бийиктиги', 'высота пика', 'peak altitude'] },
        { v: ['Уруксат', 'Пропуск', 'Permit'], l: ['Кытай чек арасы', 'погранзона у границы', 'border zone'] },
        { v: ['Күндөр', 'Дни', 'Days'], l: ['бир тарапка жол', 'дорога в один конец', 'one way on the road'] }
      ]
    },

    /* ---------------- ТАЛАС ---------------- */
    {
      id: 'beshtash', reg: 'talas', img: 'beshtash.jpg',
      season: ['Май — октябрь', 'Май — октябрь', 'May to October'],
      name: 'Беш-Таш',
      sub: ['Улуттук парк, Талас өрөөнү', 'Национальный парк, Таласская долина', 'National park, Talas valley'],
      txt: [
        'Арча токойлору, шаркыратмалар жана жогорку жагында көлдөр бар капчыгай, туристтер дээрлик жок. Бул жерде илбирс, аркар жана бүркүт жашайт. Талас шаарынан жол кыска, ал эми эл ушунчалык аз — тоолор өзүңүздүкүндөй сезилет.',
        'Ущелье с арчовыми лесами, водопадами и озёрами в верховьях, где почти нет туристов. Здесь водятся снежный барс, архар и беркут. Дорога от города Талас короткая, а людей так мало, что горы кажутся личными.',
        'A gorge of juniper forest, waterfalls and lakes in its upper reaches, with almost no tourists. Snow leopard, argali and golden eagle live here. The drive from Talas town is short, and there are so few people that the mountains feel like your own.'
      ],
      f: [
        { v: '1996', l: ['жылдан бери парк', 'с этого года парк', 'a park since then'] },
        { v: ['Арча', 'Арча', 'Juniper'], l: ['байыркы токой', 'древний лес', 'ancient forest'] },
        { v: ['Эл аз', 'Мало людей', 'Few people'], l: ['тынч капчыгай', 'тихое ущелье', 'a quiet gorge'] }
      ]
    },
    {
      id: 'kirov', reg: 'talas', img: 'kirov.jpg',
      season: ['Жай айлары', 'Летом', 'Summer'],
      name: 'Киров суу сактагычы',
      sub: ['Чоң-Капка капчыгайы, Талас', 'Ущелье Чон-Капка, Талас', 'Chon-Kapka gorge, Talas'],
      txt: [
        'Кургак кызгылт адырлардын ортосундагы көгүлтүр суу — Таластан күтпөгөн көрүнүш. Өлкөдөгү экинчи чоң суу сактагыч, жайында сууга түшүп, балык уулашат, жээктери дээрлик бош. Эң жакшы убакыт — суу күзгүдөй турган эртең менен.',
        'Бирюзовая вода среди сухих рыжих холмов — вид, которого не ждёшь в Таласе. Второе по величине водохранилище страны: летом сюда приезжают купаться и ловить рыбу, берега почти пустые. Лучшее время — утро, пока вода зеркальная.',
        'Turquoise water among dry ochre hills — not a view you expect in Talas. It is the country’s second largest reservoir: in summer people come to swim and fish, and the shores stay almost empty. Come in the morning, while the water is still a mirror.'
      ],
      f: [
        { v: '2', l: ['өлкөдө чоңдугу боюнча', 'по величине в стране', 'largest in the country'] },
        { v: ['Жай', 'Лето', 'Summer'], l: ['сууга түшүү мезгили', 'сезон купания', 'the swimming season'] },
        { v: ['Эртең менен', 'Утро', 'Morning'], l: ['суу тынч болот', 'вода зеркальная', 'the water is still'] }
      ]
    },

    /* ---------------- ЖАЛАЛ-АБАД ---------------- */
    {
      id: 'sarychelek', reg: 'jalal', img: 'sarychelek.jpg',
      season: ['Июнь — октябрь', 'Июнь — октябрь', 'June to October'],
      name: 'Сары-Челек',
      sub: ['ЮНЕСКОнун биосфералык коругу', 'Биосферный заповедник ЮНЕСКО', 'A UNESCO biosphere reserve'],
      txt: [
        'Токойлуу капталдар менен аскалардын ортосундагы зумуруттай көл — ЮНЕСКОнун биосфералык коругунун бир бөлүгү. Айланасында дагы алты кичине көл, жаңгак, жапайы алма жана алча бар. Бул корук, эрежелери катуу: бардык жерде сууга түшүп, палатка тигүүгө болбойт.',
        'Изумрудное озеро, зажатое между лесистыми склонами и скалами, — часть биосферного заповедника ЮНЕСКО. Вокруг ещё шесть озёр поменьше, орешник, дикие яблони и алыча. Купаться и ставить палатки можно не везде: это заповедник, правила строгие.',
        'An emerald lake held between wooded slopes and cliffs, part of a UNESCO biosphere reserve. Six smaller lakes lie around it, along with walnut groves, wild apple and cherry-plum. Swimming and camping are not allowed everywhere: this is a reserve and the rules are strict.'
      ],
      f: [
        { v: 'UNESCO', l: ['биосфералык корук', 'биосферный заповедник', 'biosphere reserve'] },
        { v: '7', l: ['көл бир өрөөндө', 'озёр в одной долине', 'lakes in one valley'] },
        { v: ['Корук', 'Заповедник', 'Reserve'], l: ['эрежелери катуу', 'правила строгие', 'strict rules'] }
      ]
    },
    {
      id: 'arslanbob', reg: 'jalal', img: 'arslanbob.jpg',
      season: ['Сентябрь — октябрь, жаңгак терүү', 'Сентябрь — октябрь, сбор ореха', 'September to October, the walnut harvest'],
      name: 'Арсланбоб',
      sub: ['Дүйнөдөгү эң чоң реликт жаңгак токою', 'Крупнейший в мире реликтовый ореховый лес', 'The largest relict walnut forest in the world'],
      txt: [
        'Дарактарга жүздөгөн жыл, күзүндө бүтүн үй-бүлөлөр жаңгак терүүгө чыгат. Айылдын үстүндө эки шаркыратма бар, жогоркусунан бүт өрөөн көрүнөт. Конуу үчүн үй-бүлөлүк конок үйлөрү эң жакшы — бул жерде ал бүтүндөй тутум.',
        'Деревьям сотни лет, а осенью сюда выходят целыми семьями собирать орех. Над селом два водопада, с верхнего видно всю долину. Жить лучше в семейных гостевых домах — здесь это целая отлаженная система.',
        'The trees are centuries old, and in autumn whole families come out to gather walnuts. Two waterfalls hang above the village; from the upper one you see the entire valley. Stay in a family guesthouse — here that is a whole established system.'
      ],
      f: [
        { v: ['Эң чоң', 'Крупнейший', 'The largest'], l: ['дүйнөдөгү жаңгак токою', 'ореховый лес в мире', 'walnut forest on earth'] },
        { v: '2', l: ['шаркыратма', 'водопада', 'waterfalls'] },
        { v: ['Сентябрь', 'Сентябрь', 'September'], l: ['жаңгак терүү', 'сбор ореха', 'the harvest'] }
      ]
    },

    /* ---------------- ОШ ---------------- */
    {
      id: 'lenin', reg: 'osh', img: 'lenin.jpg',
      season: ['Июль — август', 'Июль — август', 'July to August'],
      name: 'Тулпар-Көл жана Ленин чокусу',
      sub: ['Алай өрөөнү, Ачык-Таш базалык лагери', 'Алайская долина, лагерь Ачик-Таш', 'Alai valley, Achik-Tash base camp'],
      txt: [
        'Үч жарым миң метрдеги көл, жээгинде боз үй лагери, ал эми так үстүндө — 7134 метрлик Ленин чокусу. Жер жүзүндө мындай тоону боз үйдүн босогосунан көрө турган жерлер аз. Альпинист болуунун кереги жок: көлгө чейин унаа менен жетип, андан ары моренада сейилдесе болот.',
        'Озеро на трёх с половиной тысячах метров, юрточный лагерь на берегу и прямо над ним — семитысячник Ленина (7134 м). Одно из немногих мест на земле, где такую гору видно с порога юрты. Альпинистом быть не обязательно: до озера доезжают на машине, а дальше гуляют по моренам.',
        'A lake at three and a half thousand metres, a yurt camp on its shore, and directly above it Lenin Peak, 7,134 metres. One of the few places on earth where a mountain like that is visible from a yurt doorway. You need not be a climber: cars reach the lake, and from there you walk the moraines.'
      ],
      f: [
        { v: '7134', u: ['м', 'м', 'm'], l: ['Ленин чокусу', 'высота пика Ленина', 'Lenin Peak'] },
        { v: '~3500', u: ['м', 'м', 'm'], l: ['көлдүн бийиктиги', 'высота озера', 'lake altitude'] },
        { v: ['Боз үй', 'Юрты', 'Yurts'], l: ['июль — август', 'июль — август', 'July to August'] }
      ]
    },
    {
      id: 'abshyr', reg: 'osh', img: 'abshyr.jpg',
      season: ['Май — сентябрь', 'Май — сентябрь', 'May to September'],
      name: 'Абшыр-Сай',
      sub: ['Аскадан атылып чыккан шаркыратма', 'Водопад, бьющий прямо из скалы', 'A waterfall bursting out of a cliff'],
      txt: [
        'Суу тик аскадагы тешиктен атылып чыгып, ылдый кулайт — тоо тешилип кеткендей көрүнөт. Жанында көлөкөлүү капчыгай жана эс алууга ыңгайлуу жерлер бар, Оштон жол эки сааттай.',
        'Вода вырывается прямо из отверстия в отвесной скале и падает вниз — выглядит так, будто гора дала течь. Рядом тенистое ущелье и места для пикника, дорога от Оша занимает пару часов.',
        'Water bursts straight out of a hole in a sheer cliff and falls — as though the mountain had sprung a leak. There is a shaded gorge beside it and good picnic spots; the drive from Osh takes a couple of hours.'
      ],
      f: [
        { v: '~2', u: ['с', 'ч', 'h'], l: ['Оштон жол', 'от Оша', 'from Osh'] },
        { v: ['Аскадан', 'Из скалы', 'From the rock'], l: ['суу атылып чыгат', 'бьёт вода', 'the water bursts'] },
        { v: ['Май', 'Май', 'May'], l: ['сезон башталат', 'начало сезона', 'the season starts'] }
      ]
    },
    {
      id: 'laglan', reg: 'osh', img: 'laglan.jpg',
      season: ['Жаз жана күз, жашыл беткей менен кызыл аска карама-каршы турганда', 'Весна и осень, когда зелёный склон контрастирует с красной скалой', 'Spring and autumn, when the green slope sets off the red rock'],
      name: 'Лаглан',
      sub: ['Мады айыл аймагы, Кара-Суу району', 'Мадынский айыльный аймак, Кара-Сууский район', 'Madi rural district, Kara-Suu district'],
      txt: [
        'Ош областындагы Кара-Суу районунун тоо этегиндеги айыл жана анын жанындагы кызыл аска дубалдары. Катмар-катмар чегилген аскалар өрөөндүн үстүнөн мунара сыяктанып туруп, түбүндөгү жашыл жайыт менен кескин карама-каршылык жаратат. Бул жер али көпчүлүккө белгисиз — салттуу маршруттардын арасында эмес, ошондуктан тынч. Так маалымат аз болгондуктан, жол каралоочу же жергиликтүү жашоочудан сурап алганы оң.',
        'Село у подножия гор в Кара-Суйском районе Ошской области и стена красных скальных каньонов рядом с ним. Слоистые обрывы стоят над долиной, как крепостные башни, и резко контрастируют с зелёными пастбищами у подножия. Место пока малоизвестное, не входит в привычные туристические маршруты — оттого и тихое. Точных данных о расстоянии и высоте немного, поэтому дорогу лучше уточнить у гида или у местных.',
        'A village at the foot of the mountains in the Kara-Suu district of Osh region, beside a wall of red rock canyons. Layered cliffs rise above the valley like fortress towers, in sharp contrast with the green pasture below. The place is still little known and lies outside the usual tourist routes, which is exactly why it stays quiet. Reliable distance and altitude figures are scarce, so it is worth checking the road with a guide or a local before you go.'
      ],
      f: [
        { v: ['Ош', 'Ош', 'Osh'], l: ['областы', 'область', 'region'] },
        { v: ['Кара-Суу', 'Кара-Суу', 'Kara-Suu'], l: ['району', 'район', 'district'] },
        { v: ['Тынч', 'Малолюдно', 'Uncrowded'], l: ['белгилүү маршрут эмес', 'не туристический маршрут', 'off the usual route'] }
      ]
    },


    /* ---------------- БАТКЕН ---------------- */
    {
      id: 'karavshin', reg: 'batken', img: 'karavshin.jpg',
      season: ['Июль — август · чек араны тактаңыз', 'Июль — август · уточните обстановку на границе', 'July to August · check the border situation'],
      name: 'Каравшин',
      sub: ['Ак-Суу жана Сабах аскалары, Лайлак району', 'Стены Ак-Суу и Сабах, Ляйлякский район', 'The Ak-Suu and Sabah walls, Lailak district'],
      txt: [
        'Бийиктиги бир чакырымга жеткен гранит дубалдар — альпинисттер аны «Азиянын Патагониясы» деп аташат. Бул жакка чоң дубалдар жана жаңы жолдор үчүн келишет; өйдө чыгуу аттар менен бир нече күн алат. Жолго чыгаардан мурун чек арадагы абалды сөзсүз тактаңыз.',
        'Гранитные стены высотой до километра, которые альпинисты называют «Патагонией Азии». Сюда идут за большими стенами и первопрохождениями; заход занимает несколько дней с лошадьми. Перед поездкой обязательно уточните обстановку на границе.',
        'Granite walls up to a kilometre high that climbers call “the Patagonia of Asia”. People come here for big walls and first ascents; the approach takes several days with horses. Always check the border situation before you set out.'
      ],
      f: [
        { v: ['1 км', 'до 1 км', 'up to 1 km'], l: ['дубалдын бийиктиги', 'высота стен', 'of wall' ] },
        { v: ['Аттар', 'Лошади', 'Horses'], l: ['жүк ташуу үчүн', 'для заброски', 'to carry the loads'] },
        { v: ['Чек ара', 'Граница', 'Border'], l: ['абалды тактаңыз', 'уточните обстановку', 'check the situation'] }
      ]
    },
    {
      id: 'aigul', reg: 'batken', img: 'aigul.jpg',
      season: ['Апрель — май, гүлдөгөндө', 'Апрель — май, пока цветёт', 'April to May, while it blooms'],
      name: 'Айгүл-Таш',
      sub: ['Айгүл гүлүнүн тоосу, Баткенден 19 км', 'Гора цветка айгуль, 19 км от Баткена', 'The mountain of the aigul flower, 19 km from Batken'],
      txt: [
        'Жазында капталдар айгүлгө оролот — бул гүл ушул жерде гана өсөт жана Кызыл китепке киргизилген. Гүлдөө кыска, үч жумадай. Тоону Баткендин жүрөгү деп аташат, ал эми атында Айгүл деген кыз жөнүндө уламыш бар.',
        'Весной склоны покрываются айгулем — цветком, который растёт только здесь и занесён в Красную книгу. Цветение короткое, недели три. Гору называют сердцем Баткена, а с её названием связана легенда о девушке Айгуль.',
        'In spring the slopes fill with aigul, a flower that grows only here and is listed in the Red Book. The bloom is short, about three weeks. The mountain is called the heart of Batken, and its name carries the legend of a girl named Aigul.'
      ],
      f: [
        { v: '2200', u: ['м', 'м', 'm'], l: ['бийиктик', 'высота', 'altitude'] },
        { v: ['~3 жума', '~3 недели', '~3 weeks'], l: ['гүлдөө мезгили', 'длится цветение', 'the bloom lasts'] },
        { v: '19', u: ['км', 'км', 'km'], l: ['Баткенден', 'от Баткена', 'from Batken'] }
      ]
    }
  ];

  let activeReg = 'all';

  function pick(v) {
    return Array.isArray(v) ? t(v[0], v[1], v[2]) : v;
  }

  function renderRegions() {
    const box = $('#regions');
    box.innerHTML = '';
    REGIONS.forEach(r => {
      const count = r.id === 'all' ? PLACES.length : PLACES.filter(p => p.reg === r.id).length;
      if (!count) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'reg' + (r.id === activeReg ? ' is-on' : '');
      b.innerHTML = '<span class="reg__n"></span><span class="reg__c"></span>';
      $('.reg__n', b).textContent = t(r.kg, r.ru, r.en);
      $('.reg__c', b).textContent = count;
      b.addEventListener('click', () => {
        activeReg = r.id;
        renderRegions();
        renderPlaces();
      });
      box.appendChild(b);
    });
  }

  function renderPlaces() {
    const box = $('#places-list');
    box.innerHTML = '';
    const list = PLACES.filter(p => activeReg === 'all' || p.reg === activeReg);

    list.forEach((p, i) => {
      const reg = REGIONS.filter(r => r.id === p.reg)[0];
      const card = document.createElement('article');
      card.className = 'place' + (i % 2 ? ' is-flip' : '') + (p.soon ? ' place--soon' : '');

      const facts = p.f.map(f =>
        '<li><b>' + pick(f.v) + (f.u ? ' <span>' + pick(f.u) + '</span>' : '') +
        '</b><span>' + pick(f.l) + '</span></li>').join('');

      card.innerHTML =
        '<div class="place__media">' +
          '<span class="place__ph"><svg viewBox="0 0 300 300"><use href="#orn-big"/></svg></span>' +
          '<span class="place__reg"></span>' +
        '</div>' +
        '<div class="place__body">' +
          '<p class="place__season"></p>' +
          '<h3 class="place__name"></h3>' +
          '<p class="place__name2"></p>' +
          '<p class="place__txt"></p>' +
          (facts ? '<ul class="place__facts">' + facts + '</ul>' : '') +
        '</div>';

      $('.place__reg', card).textContent    = reg ? t(reg.kg, reg.ru, reg.en) : '';
      $('.place__season', card).textContent = pick(p.season);
      $('.place__name', card).textContent   = p.name;
      $('.place__name2', card).textContent  = pick(p.sub);
      $('.place__txt', card).textContent    = pick(p.txt);

      box.appendChild(card);
      loadMedia(card, p);
    });
  }

  /* фото и видео подставляются, если файл лежит в assets/places.
     Результат проверки запоминаем, чтобы при смене языка не дёргать сервер заново. */
  const mediaSeen = {};   // src -> true (есть) / false (нет)

  function loadMedia(card, p) {
    const media = $('.place__media', card);
    if (!media || !p.img) return;
    const base = 'assets/places/';
    const imgSrc = base + p.img;
    const vidSrc = base + p.img.replace(/\.[a-z0-9]+$/i, '.mp4');

    const addImg = () => {
      if ($('video', media) || $('img', media)) return;
      const el = document.createElement('img');
      el.src = imgSrc; el.alt = p.name; el.loading = 'lazy';
      media.appendChild(el);
    };
    const addVid = () => {
      if ($('video', media)) return;
      const img = $('img', media);
      if (img) img.remove();
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('playsinline', ''); v.preload = 'auto';
      v.src = vidSrc;
      media.appendChild(v);
      v.play().catch(() => {});
    };

    if (mediaSeen[imgSrc] === true) addImg();
    else if (mediaSeen[imgSrc] === undefined) {
      const probe = new Image();
      probe.onload  = () => { mediaSeen[imgSrc] = true;  addImg(); };
      probe.onerror = () => { mediaSeen[imgSrc] = false; };
      probe.src = imgSrc;
    }

    if (mediaSeen[vidSrc] === true) addVid();
    else if (mediaSeen[vidSrc] === undefined) {
      const probe = document.createElement('video');
      probe.muted = true; probe.preload = 'metadata';
      probe.addEventListener('loadeddata', () => { mediaSeen[vidSrc] = true;  addVid(); }, { once: true });
      probe.addEventListener('error',      () => { mediaSeen[vidSrc] = false; }, { once: true });
      probe.src = vidSrc;
    }
  }

  /* ============================================================
     ОТЗЫВЫ ГОСТЕЙ
     ============================================================ */
  const RV_MAX_TEXT  = 500;
  const RV_MAX_PHOTO = 300 * 1024;      // байт в base64-строке, с запасом под лимит сервера
  const RV_ADMIN_KEY_STORE = 'kgt-admin-key';

  let rvAdminKey = '';
  try { rvAdminKey = localStorage.getItem(RV_ADMIN_KEY_STORE) || ''; } catch (e) {}
  let rvPendingPhoto = '';   // сжатое фото в виде data:URL, ждёт отправки

  function rvPlaceName(id) {
    if (id === 'general' || !id) return t('Жалпы пикир', 'Общее впечатление', 'General impression');
    const p = PLACES.filter(x => x.id === id)[0];
    return p ? p.name : id;
  }

  function rvFillPlaceSelect() {
    const sel = $('#rvPlace');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    const gOpt = document.createElement('option');
    gOpt.value = 'general';
    gOpt.textContent = t('Жалпы пикир', 'Общее впечатление', 'General impression');
    sel.appendChild(gOpt);

    REGIONS.filter(r => r.id !== 'all').forEach(r => {
      const list = PLACES.filter(p => p.reg === r.id);
      if (!list.length) return;
      const grp = document.createElement('optgroup');
      grp.label = t(r.kg, r.ru, r.en);
      list.forEach(p => {
        const o = document.createElement('option');
        o.value = p.id; o.textContent = p.name;
        grp.appendChild(o);
      });
      sel.appendChild(grp);
    });

    if (prev) sel.value = prev;
  }

  function rvUpdateCount() {
    const ta = $('#rvText');
    $('#rvCount').textContent = ta.value.length + ' / ' + RV_MAX_TEXT;
  }

  function rvSetStatus(msg, kind) {
    const el = $('#rvStatus');
    el.textContent = msg || '';
    el.classList.remove('is-ok', 'is-bad');
    if (kind) el.classList.add(kind === 'ok' ? 'is-ok' : 'is-bad');
  }

  /* сжимаем фото в браузере, чтобы не гонять по сети мегабайты */
  function rvCompressPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) { reject(new Error('not-image')); return; }
      const img = new Image();
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read-failed'));
      reader.onload = () => {
        img.onerror = () => reject(new Error('decode-failed'));
        img.onload = () => {
          const maxW = 900;
          const scale = Math.min(1, maxW / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);

          let quality = 0.75;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > RV_MAX_PHOTO && quality > 0.35) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          if (dataUrl.length > RV_MAX_PHOTO) { reject(new Error('too-big')); return; }
          resolve(dataUrl);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  $('#rvPhoto').addEventListener('change', async () => {
    const file = $('#rvPhoto').files[0];
    if (!file) return;
    rvSetStatus(t('Сүрөт кысылууда…', 'Сжимаю фото…', 'Compressing the photo…'));
    try {
      const dataUrl = await rvCompressPhoto(file);
      rvPendingPhoto = dataUrl;
      $('#rvPreview').src = dataUrl;
      $('#rvPreview').hidden = false;
      $('#rvPhotoName').textContent = file.name;
      $('#rvPhotoClear').hidden = false;
      rvSetStatus('');
    } catch (e) {
      rvPendingPhoto = '';
      $('#rvPhoto').value = '';
      rvSetStatus(t('Бул сүрөттү кысуу мүмкүн болбоду, башкасын тандаңыз.',
                    'Не удалось обработать это фото, выберите другое.',
                    'Could not process this photo — please choose another.'), 'bad');
    }
  });

  $('#rvPhotoClear').addEventListener('click', () => {
    rvPendingPhoto = '';
    $('#rvPhoto').value = '';
    $('#rvPreview').hidden = true;
    $('#rvPreview').src = '';
    $('#rvPhotoName').textContent = '';
    $('#rvPhotoClear').hidden = true;
  });

  $('#rvText').addEventListener('input', rvUpdateCount);

  function rvDate(ts) {
    try {
      return new Date(ts).toLocaleString(
        lang === 'kg' ? 'ru-RU' : (lang === 'ru' ? 'ru-RU' : 'en-GB'),
        { day: '2-digit', month: '2-digit', year: 'numeric' }
      );
    } catch (e) { return ''; }
  }

  function rvCard(r) {
    const card = document.createElement('article');
    card.className = 'rv' + (r.hidden ? ' is-hidden' : '');

    if (r.photo) {
      const img = document.createElement('img');
      img.className = 'rv__photo'; img.src = r.photo; img.alt = '';
      card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'rv__body';

    const head = document.createElement('div');
    head.className = 'rv__head';
    const name = document.createElement('span');
    name.className = 'rv__name';
    name.textContent = r.name || t('Аты жок конок', 'Гость без имени', 'A guest');
    const place = document.createElement('span');
    place.className = 'rv__place';
    place.textContent = rvPlaceName(r.place);
    const date = document.createElement('span');
    date.className = 'rv__date';
    date.textContent = rvDate(r.ts);
    head.appendChild(name); head.appendChild(place); head.appendChild(date);

    const text = document.createElement('p');
    text.className = 'rv__text';
    text.textContent = r.text;

    body.appendChild(head);
    body.appendChild(text);

    if (rvAdminKey) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rv__hideBtn' + (r.hidden ? ' is-restore' : '');
      btn.textContent = r.hidden
        ? t('Кайра көрсөтүү', 'Вернуть', 'Restore')
        : t('Жашыруу', 'Скрыть', 'Hide');
      btn.addEventListener('click', () => rvToggleHide(r.id, !r.hidden));
      body.appendChild(btn);
    }

    card.appendChild(body);
    return card;
  }

  async function rvToggleHide(id, hidden) {
    try {
      const res = await fetch('/api/reviews/' + id + '/' + (hidden ? 'hide' : 'unhide'), {
        method: 'POST',
        headers: { 'x-admin-key': rvAdminKey }
      });
      if (!res.ok) throw new Error(String(res.status));
      rvLoadList();
    } catch (e) {
      rvSetStatus(t('Аракет ишке ашкан жок.', 'Действие не выполнено.', 'The action failed.'), 'bad');
    }
  }

  let rvCache = [];

  async function rvLoadList() {
    const list = $('#rvList');
    try {
      const res = await fetch('/api/reviews', { headers: rvAdminKey ? { 'x-admin-key': rvAdminKey } : {} });
      if (res.status === 503) {
        list.innerHTML = '';
        $('#rvEmpty').hidden = false;
        $('#rvEmpty').textContent = t(
          'Пикир китепчеси азырынча даярдалып жатат — бир аздан кийин кайрылып көрүңүз.',
          'Раздел отзывов пока настраивается — загляните чуть позже.',
          'The review board is still being set up — please check back soon.');
        return;
      }
      const data = await res.json();
      rvCache = data.reviews || [];
      rvRenderList();
    } catch (e) {
      list.innerHTML = '';
      $('#rvEmpty').hidden = false;
      $('#rvEmpty').textContent = t('Пикирлерди жүктөө мүмкүн болбоду.',
                                     'Не удалось загрузить отзывы.',
                                     'Could not load the reviews.');
    }
  }

  function rvRenderList() {
    const list = $('#rvList');
    list.innerHTML = '';
    if (!rvCache.length) {
      $('#rvEmpty').hidden = false;
      $('#rvEmpty').textContent = t('Азырынча пикир жок — биринчи болуңуз.',
                                     'Пока отзывов нет — станьте первым.',
                                     'No reviews yet — be the first.');
      return;
    }
    $('#rvEmpty').hidden = true;
    rvCache.forEach(r => list.appendChild(rvCard(r)));
  }

  $('#rvForm').addEventListener('submit', async e => {
    e.preventDefault();
    const text = $('#rvText').value.trim();
    if (!text) {
      rvSetStatus(t('Пикириңизди жазыңыз.', 'Напишите текст отзыва.', 'Please write your review.'), 'bad');
      return;
    }
    const btn = $('#rvSubmit');
    btn.disabled = true;
    rvSetStatus(t('Жөнөтүлүүдө…', 'Отправляю…', 'Sending…'));

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: $('#rvName').value.trim(),
          place: $('#rvPlace').value,
          text: text,
          photo: rvPendingPhoto || null,
          website: $('#rvWebsite').value   // honeypot — у людей всегда пусто
        })
      });

      if (res.status === 503) {
        rvSetStatus(t('Пикир китепчеси азырынча даярдалып жатат.',
                      'Раздел отзывов пока настраивается.',
                      'The review board is still being set up.'), 'bad');
        return;
      }
      if (res.status === 429) {
        rvSetStatus(t('Бир аз аста — бир мүнөттөн кийин кайра аракет кылыңыз.',
                      'Чуть помедленнее — попробуйте ещё раз через минуту.',
                      'A little slower — try again in a minute.'), 'bad');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));

      $('#rvForm').reset();
      rvPendingPhoto = '';
      $('#rvPreview').hidden = true;
      $('#rvPhotoName').textContent = '';
      $('#rvPhotoClear').hidden = true;
      rvUpdateCount();
      rvFillPlaceSelect();
      rvSetStatus(t('Рахмат! Пикириңиз жарыяланды.', 'Спасибо! Ваш отзыв опубликован.', 'Thank you! Your review is live.'), 'ok');
      rvLoadList();
    } catch (e) {
      rvSetStatus(t('Жөнөтүү ишке ашкан жок, кайра аракет кылыңыз.',
                    'Не удалось отправить, попробуйте ещё раз.',
                    'Sending failed — please try again.'), 'bad');
    } finally {
      btn.disabled = false;
    }
  });

  $('#rvAdminBtn').addEventListener('click', () => {
    if (rvAdminKey) {
      rvAdminKey = '';
      try { localStorage.removeItem(RV_ADMIN_KEY_STORE); } catch (e) {}
      $('#rvAdminBtn').classList.remove('is-on');
      rvLoadList();
      return;
    }
    const val = window.prompt(t('Модератор ачкычы:', 'Ключ модератора:', 'Moderator key:'));
    if (!val) return;
    rvAdminKey = val.trim();
    try { localStorage.setItem(RV_ADMIN_KEY_STORE, rvAdminKey); } catch (e) {}
    $('#rvAdminBtn').classList.add('is-on');
    rvLoadList();
  });

  if (rvAdminKey) $('#rvAdminBtn').classList.add('is-on');

  /* ---------- старт ---------- */
  updateCount();
  rvUpdateCount();
  applyLang();
  rvLoadList();
})();
