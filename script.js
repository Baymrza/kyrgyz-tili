/* ============================================================
   КЫРГЫЗ ТИЛИ — 23-сентябрь · script.js
   Тилдер / Языки / Languages: KG · RU · EN
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));

  /* ============================================================
     1. ТИЛ / ЯЗЫК / LANGUAGE
     ============================================================ */
  const LANGS = ['kg', 'ru', 'en'];
  let lang = 'kg';
  try {
    const saved = localStorage.getItem('kgt-lang');
    if (LANGS.indexOf(saved) !== -1) lang = saved;
  } catch (e) {}

  const i18nNodes = $$('[data-ru]');
  i18nNodes.forEach(n => { if (!n.dataset.kg) n.dataset.kg = n.textContent.trim(); });

  /* t('кыргызча', 'по-русски', 'in english') */
  const t = (kg, ru, en) => (lang === 'kg' ? kg : lang === 'ru' ? ru : en);

  function applyLang() {
    i18nNodes.forEach(n => {
      const v = n.dataset[lang];
      if (v) n.textContent = v;
    });
    document.documentElement.lang = lang === 'kg' ? 'ky' : lang;
    $$('.lang__b').forEach(b => b.classList.toggle('is-on', b.dataset.lang === lang));
    refreshCounters();
    renderWordCards();
    resetQuiz();
    initGame();
    updateCountdown();
  }

  $$('.lang__b').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.lang === lang) return;
    lang = b.dataset.lang;
    try { localStorage.setItem('kgt-lang', lang); } catch (e) {}
    applyLang();
  }));

  /* ============================================================
     2. НАВИГАЦИЯ, ПРОГРЕСС, ПАРАЛЛАКС
     ============================================================ */
  const nav      = $('#nav');
  const navLinks = $('.nav__links');
  const burger   = $('#burger');
  const bar      = $('.scroll-progress i');
  const toTop    = $('#toTop');
  const heroBg   = $('.hero__bg');

  burger.addEventListener('click', () => {
    navLinks.classList.toggle('is-open');
    burger.classList.toggle('is-open');
  });
  $$('.nav__links a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('is-open');
    burger.classList.remove('is-open');
  }));

  let ticking = false;
  function onScroll() {
    const y   = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle('is-stuck', y > 40);
    toTop.classList.toggle('is-on', y > 700);
    bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    if (heroBg && y < window.innerHeight) heroBg.style.transform = 'scale(1.06) translateY(' + (y * 0.28) + 'px)';
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* активная ссылка в меню */
  const sections = $$('section[id]');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        $$('.nav__links a').forEach(a =>
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => spy.observe(s));
  }

  /* ============================================================
     3. ПОЯВЛЕНИЕ БЛОКОВ + СЧЁТЧИКИ
     ============================================================ */
  function suffixOf(el) {
    if (lang === 'kg' && el.dataset.suffixKg) return el.dataset.suffixKg;
    if (lang === 'en' && el.dataset.suffixEn) return el.dataset.suffixEn;
    return el.dataset.suffix || '';
  }

  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const suffix = suffixOf(el);
    const dur = 1500;
    const t0 = performance.now();
    const fmt = n => (target >= 10000
      ? Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')
      : Math.round(n));
    function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * e) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* уже посчитанные цифры — обновить подпись при смене языка */
  function refreshCounters() {
    $$('b[data-count]').forEach(el => {
      if (!el.dataset.done) return;
      const target = parseFloat(el.dataset.count);
      const num = target >= 10000
        ? target.toLocaleString('ru-RU').replace(/ /g, ' ')
        : target;
      el.textContent = num + suffixOf(el);
    });
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        const num = $('b[data-count]', en.target);
        if (num && !num.dataset.done) { num.dataset.done = '1'; animateCount(num); }
        obs.unobserve(en.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-in'));
    $$('b[data-count]').forEach(animateCount);
  }

  /* ============================================================
     4. ОБРАТНЫЙ ОТСЧЁТ ДО 23 СЕНТЯБРЯ
     ============================================================ */
  const cdBox = $('#countdown');
  function nextHoliday() {
    const now = new Date();
    const y = now.getFullYear();
    const d = new Date(y, 8, 23, 0, 0, 0); // 8 = сентябрь
    if (now > new Date(y, 8, 23, 23, 59, 59)) d.setFullYear(y + 1);
    return d;
  }
  function updateCountdown() {
    const now = new Date();
    const isToday = now.getMonth() === 8 && now.getDate() === 23;
    if (isToday) {
      cdBox.classList.add('is-today');
      $('#cdLabel').textContent = t(
        'Бүгүн — Мамлекеттик тил күнү! Куттуктайбыз!',
        'Сегодня — День государственного языка! Поздравляем!',
        'Today is State Language Day. Congratulations!');
      return;
    }
    cdBox.classList.remove('is-today');
    $('#cdLabel').textContent = t(
      'Мамлекеттик тил күнүнө чейин',
      'до Дня государственного языка',
      'until State Language Day');
    let ms = nextHoliday() - now;
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const pad = n => String(n).padStart(2, '0');
    $('#cdD').textContent = Math.floor(s / 86400);
    $('#cdH').textContent = pad(Math.floor(s / 3600) % 24);
    $('#cdM').textContent = pad(Math.floor(s / 60) % 60);
    $('#cdS').textContent = pad(s % 60);
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);

  /* ============================================================
     5. СӨЗ КАЗЫНА — ПЕРЕВОРАЧИВАЮЩИЕСЯ КАРТОЧКИ
     ============================================================ */
  const WORDS = [
    { w: 'Ынтымак',
      kg: 'Биримдик, ырашкерлик, ичара ынтымактуулук',
      ru: 'Согласие, единство, лад между людьми',
      en: 'Concord, unity, harmony among people',
      ex: '«Ынтымагы жарашкан элдин иши оңунан чыгат.»' },
    { w: 'Кут',
      kg: 'Бакыт, ырыскы, үйгө конгон береке',
      ru: 'Благодать, счастье, благословение дома',
      en: 'Grace, good fortune, the blessing that settles on a home',
      ex: '«Кут конгон үйдөн береке кетпейт.»' },
    { w: 'Мээрим',
      kg: 'Жүрөктүн жылуулугу, ак көңүлдүк',
      ru: 'Нежность, ласка, сердечная теплота',
      en: 'Tenderness, warmth of heart, loving kindness',
      ex: '«Эненин мээрими — түгөнбөс байлык.»' },
    { w: 'Намыс',
      kg: 'Ар-намыс, адамдын абийири жана кадыры',
      ru: 'Честь, достоинство человека',
      en: 'Honour and personal dignity',
      ex: '«Намыс — жандан кымбат.»' },
    { w: 'Ыйман',
      kg: 'Ички тазалык, абийирдүүлүк, уяттуулук',
      ru: 'Совесть, нравственная чистота',
      en: 'Conscience, inner moral purity',
      ex: '«Ыйманы бардын — уяты бар.»' },
    { w: 'Санжыра',
      kg: 'Урук-тукумдун оозеки тарыхы',
      ru: 'Родословная, устная летопись рода',
      en: 'Genealogy, the oral chronicle of a clan',
      ex: '«Санжыра билбеген — тамырын билбейт.»' },
    { w: 'Кайрат',
      kg: 'Эрк, күч-кубат, чыдамкайлык',
      ru: 'Мужество, воля, стойкость',
      en: 'Courage, willpower, endurance',
      ex: '«Кайрат болсо, кайгы жеңилет.»' },
    { w: 'Береке',
      kg: 'Молчулук, ырыс, эмгектин жемиши',
      ru: 'Изобилие, достаток, плод труда',
      en: 'Abundance, plenty, the fruit of labour',
      ex: '«Ынтымак болгон жерде береке бар.»' }
  ];

  function renderWordCards() {
    const box = $('#wordCards');
    box.innerHTML = '';
    WORDS.forEach(item => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card';
      b.innerHTML =
        '<span class="card__f">' +
          '<span class="card__w"></span>' +
          '<span class="card__hint"></span>' +
        '</span>' +
        '<span class="card__b">' +
          '<span class="card__m"></span>' +
          '<span class="card__ex"></span>' +
        '</span>';
      $('.card__w', b).textContent    = item.w;
      $('.card__hint', b).textContent = t('маанисин көрүү', 'открыть значение', 'see the meaning');
      $('.card__m', b).textContent    = t(item.kg, item.ru, item.en);
      $('.card__ex', b).textContent   = item.ex;
      b.addEventListener('click', () => b.classList.toggle('is-flip'));
      box.appendChild(b);
    });
  }

  /* ============================================================
     6. ВИКТОРИНА
     ============================================================ */
  const QUIZ = [
    {
      q: ['Кайсы жылы кыргыз тили мамлекеттик тил статусун алган?',
          'В каком году кыргызский язык получил статус государственного?',
          'In what year did Kyrgyz become the state language?'],
      o: [['1989-жыл', '1989 год', '1989'],
          ['1991-жыл', '1991 год', '1991'],
          ['1993-жыл', '1993 год', '1993'],
          ['2004-жыл', '2004 год', '2004']],
      a: 0,
      e: ['1989-жылы 23-сентябрда Жогорку Кеңеш «Мамлекеттик тил жөнүндө» Мыйзамды кабыл алган.',
          '23 сентября 1989 года Верховный Совет принял Закон «О государственном языке».',
          'On 23 September 1989 the Supreme Soviet passed the Law “On the State Language”.']
    },
    {
      q: ['Мамлекеттик тил күнү качан белгиленет?',
          'Когда отмечается День государственного языка?',
          'When is State Language Day celebrated?'],
      o: [['31-август', '31 августа', '31 August'],
          ['23-сентябрь', '23 сентября', '23 September'],
          ['7-ноябрь', '7 ноября', '7 November'],
          ['21-март', '21 марта', '21 March']],
      a: 1,
      e: ['Майрам мыйзам кабыл алынган күнгө — 23-сентябрга туура келет.',
          'Праздник приходится на день принятия закона — 23 сентября.',
          'The holiday falls on the day the law was passed — 23 September.']
    },
    {
      q: ['Кыргыз алфавитинде канча тамга бар?',
          'Сколько букв в кыргызском алфавите?',
          'How many letters are there in the Kyrgyz alphabet?'],
      o: [['33', '33', '33'], ['35', '35', '35'], ['36', '36', '36'], ['40', '40', '40']],
      a: 2,
      e: ['33 орус тамгасы жана үч өзүнчө тамга: ң, ө, ү.',
          '33 русские буквы и три собственные: ң, ө, ү.',
          '33 Russian letters plus three of its own: ң, ө, ү.']
    },
    {
      q: ['Биринчи кыргыз алиппесин ким жазган?',
          'Кто написал первый кыргызский букварь?',
          'Who wrote the first Kyrgyz primer?'],
      o: [['Ишеналы Арабаев', 'Ишеналы Арабаев', 'Ishenaly Arabaev'],
          ['Касым Тыныстанов', 'Касым Тыныстанов', 'Kasym Tynystanov'],
          ['Хусаин Карасаев', 'Хусаин Карасаев', 'Husain Karasaev'],
          ['Токтогул Сатылганов', 'Токтогул Сатылганов', 'Toktogul Satylganov']],
      a: 0,
      e: ['Ишеналы Арабаевдин «Алиппе»си 1911-жылы араб графикасында жарык көргөн.',
          '«Алиппе» Ишеналы Арабаева вышла в 1911 году на арабской графике.',
          'Arabaev’s “Alippe” appeared in 1911, printed in Arabic script.']
    },
    {
      q: ['Кыргыз тил илиминин негиздөөчүсү, «Эне тилибиз» китебинин автору ким?',
          'Кто основоположник кыргызского языкознания, автор учебника «Эне тилибиз»?',
          'Who founded Kyrgyz linguistics and wrote the textbook “Ene tilibiz”?'],
      o: [['Болот Юнусалиев', 'Болот Юнусалиев', 'Bolot Yunusaliev'],
          ['Константин Юдахин', 'Константин Юдахин', 'Konstantin Yudakhin'],
          ['Касым Тыныстанов', 'Касым Тыныстанов', 'Kasym Tynystanov'],
          ['Алыкул Осмонов', 'Алыкул Осмонов', 'Alykul Osmonov']],
      a: 2,
      e: ['Касым Тыныстанов кыргыз грамматикасын, орфографиясын жана терминологиясын түзгөн.',
          'Касым Тыныстанов создал кыргызскую грамматику, орфографию и терминологию.',
          'Kasym Tynystanov created Kyrgyz grammar, spelling and terminology.']
    },
    {
      q: ['Саякбай Каралаевдин «Манас» вариантында канча сап бар?',
          'Сколько строк в варианте эпоса «Манас» Саякбая Каралаева?',
          'How many lines are there in Karalaev’s version of “Manas”?'],
      o: [['50 553', '50 553', '50,553'],
          ['150 000', '150 000', '150,000'],
          ['500 553', '500 553', '500,553'],
          ['1 000 000', '1 000 000', '1,000,000']],
      a: 2,
      e: ['500 553 сап — дүйнөдөгү эң чоң эпос жазмасы.',
          '500 553 строки — крупнейшая в мире запись эпоса.',
          '500,553 lines — the largest recording of an epic in the world.']
    },
    {
      q: ['«Куттуу билим» дастанынын автору ким?',
          'Кто автор поэмы «Кутадгу билиг» («Куттуу билим»)?',
          'Who wrote the poem “Kutadgu Bilig”?'],
      o: [['Махмуд Кашгари', 'Махмуд Кашгари', 'Mahmud Kashgari'],
          ['Жусуп Баласагын', 'Жусуп Баласагын', 'Jusup Balasagyn'],
          ['Токтогул', 'Токтогул', 'Toktogul'],
          ['Сагымбай Орозбаков', 'Сагымбай Орозбаков', 'Sagymbai Orozbakov']],
      a: 1,
      e: ['Жусуп Баласагын аны 1069-жылы жазган — түрк дүйнөсүнүн биринчи чоң дастаны.',
          'Жусуп Баласагын написал её в 1069 году — первая большая поэма тюркского мира.',
          'Jusup Balasagyn wrote it in 1069 — the first great poem of the Turkic world.']
    },
    {
      q: ['Кыргыз жазуусу 1940-жылы кайсы алфавитке өткөн?',
          'На какой алфавит кыргызская письменность перешла в 1940 году?',
          'Which alphabet did Kyrgyz writing adopt in 1940?'],
      o: [['Араб графикасына', 'На арабскую графику', 'Arabic script'],
          ['Латын алфавитине', 'На латиницу', 'The Latin alphabet'],
          ['Кирилл алфавитине', 'На кириллицу', 'The Cyrillic alphabet'],
          ['Руна жазуусуна', 'На руническое письмо', 'Runic writing']],
      a: 2,
      e: ['Араб графикасы → латын (1928) → кирилл (1940). Биз ушул алфавит менен жазабыз.',
          'Арабская графика → латиница (1928) → кириллица (1940). Ею мы пишем и сегодня.',
          'Arabic → Latin (1928) → Cyrillic (1940), the alphabet still in use today.']
    },
    {
      q: ['Биринчи кыргыз гезити кандай аталган?',
          'Как называлась первая кыргызская газета?',
          'What was the first Kyrgyz newspaper called?'],
      o: [['«Эркин Тоо»', '«Эркин Тоо»', '“Erkin Too”'],
          ['«Кыргыз Туусу»', '«Кыргыз Туусу»', '“Kyrgyz Tuusu”'],
          ['«Ала-Тоо»', '«Ала-Тоо»', '“Ala-Too”'],
          ['«Заман»', '«Заман»', '“Zaman”']],
      a: 0,
      e: ['«Эркин Тоо» 1924-жылы 7-ноябрда жарык көргөн.',
          '«Эркин Тоо» вышла 7 ноября 1924 года.',
          '“Erkin Too” first appeared on 7 November 1924.']
    },
    {
      q: ['Атактуу кыргызча-орусча сөздүктү ким түзгөн?',
          'Кто составил знаменитый кыргызско-русский словарь?',
          'Who compiled the famous Kyrgyz–Russian dictionary?'],
      o: [['Болот Юнусалиев', 'Болот Юнусалиев', 'Bolot Yunusaliev'],
          ['Константин Юдахин', 'Константин Юдахин', 'Konstantin Yudakhin'],
          ['Чынгыз Айтматов', 'Чынгыз Айтматов', 'Chinghiz Aitmatov'],
          ['Ишеналы Арабаев', 'Ишеналы Арабаев', 'Ishenaly Arabaev']],
      a: 1,
      e: ['К. К. Юдахиндин сөздүгү (1940, 1965) — бүгүнкү күнгө чейин тилдин башкы сөздүгү.',
          'Словарь К. К. Юдахина (1940, 1965) до сих пор остаётся главным словарём языка.',
          'Yudakhin’s dictionary (1940, 1965) is still the principal dictionary of the language.']
    },
    {
      q: ['«Манас» эпосу ЮНЕСКОнун тизмесине качан кирген?',
          'Когда эпос «Манас» был внесён в список ЮНЕСКО?',
          'When was the epic “Manas” inscribed on the UNESCO list?'],
      o: [['1995-жылы', 'В 1995 году', 'In 1995'],
          ['2003-жылы', 'В 2003 году', 'In 2003'],
          ['2013-жылы', 'В 2013 году', 'In 2013'],
          ['2020-жылы', 'В 2020 году', 'In 2020']],
      a: 2,
      e: ['2013-жылы «Манас», «Семетей», «Сейтек» үчилтиги тизмеге киргизилген.',
          'В 2013 году трилогия «Манас», «Семетей», «Сейтек» вошла в список наследия.',
          'In 2013 the trilogy “Manas”, “Semetey” and “Seytek” joined the heritage list.']
    },
    {
      q: ['Кыргыз тили кайсы тилдер үй-бүлөсүнө кирет?',
          'К какой языковой семье относится кыргызский язык?',
          'Which language family does Kyrgyz belong to?'],
      o: [['Түрк тилдерине', 'К тюркским языкам', 'The Turkic languages'],
          ['Иран тилдерине', 'К иранским языкам', 'The Iranian languages'],
          ['Славян тилдерине', 'К славянским языкам', 'The Slavic languages'],
          ['Монгол тилдерине', 'К монгольским языкам', 'The Mongolic languages']],
      a: 0,
      e: ['Кыргыз тили түрк тилдеринин кыпчак тобуна кирет.',
          'Кыргызский входит в кыпчакскую группу тюркских языков.',
          'Kyrgyz belongs to the Kipchak group of the Turkic languages.']
    }
  ];

  const qStart = $('#quizStart'), qPlay = $('#quizPlay'), qResult = $('#quizResult');
  let qi = 0, qScore = 0, qLocked = false;

  function resetQuiz() {
    qi = 0; qScore = 0; qLocked = false;
    qStart.hidden = false; qPlay.hidden = true; qResult.hidden = true;
  }

  function showScore() {
    $('#quizScore').textContent = t('Упай: ', 'Очки: ', 'Score: ') + qScore;
  }

  function renderQuestion() {
    const item = QUIZ[qi];
    qLocked = false;
    $('#quizCounter').textContent = (qi + 1) + ' / ' + QUIZ.length;
    $('#quizBar').style.width = (qi / QUIZ.length) * 100 + '%';
    showScore();
    $('#quizQ').textContent = t(item.q[0], item.q[1], item.q[2]);
    $('#quizExp').hidden = true;
    $('#quizNext').hidden = true;

    const box = $('#quizOpts');
    box.innerHTML = '';
    item.o.forEach((opt, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.innerHTML = '<span class="k"></span><span class="v"></span>';
      $('.k', b).textContent = lang === 'en'
        ? 'ABCD'.charAt(idx)
        : String.fromCharCode(1040 + idx); // А, Б, В, Г
      $('.v', b).textContent = t(opt[0], opt[1], opt[2]);
      b.addEventListener('click', () => answer(idx, b));
      box.appendChild(b);
    });
  }

  function answer(idx, btn) {
    if (qLocked) return;
    qLocked = true;
    const item = QUIZ[qi];
    $$('.opt', $('#quizOpts')).forEach((o, i) => {
      o.disabled = true;
      if (i === item.a) o.classList.add('is-right');
    });
    if (idx !== item.a) btn.classList.add('is-wrong');
    else qScore++;
    showScore();
    const exp = $('#quizExp');
    exp.textContent = t(item.e[0], item.e[1], item.e[2]);
    exp.hidden = false;
    const next = $('#quizNext');
    next.textContent = (qi === QUIZ.length - 1)
      ? t('Жыйынтыкты көрүү', 'Показать результат', 'See the result')
      : t('Кийинки', 'Дальше', 'Next');
    next.hidden = false;
    $('#quizBar').style.width = ((qi + 1) / QUIZ.length) * 100 + '%';
  }

  $('#quizStartBtn').addEventListener('click', () => {
    qi = 0; qScore = 0;
    qStart.hidden = true; qResult.hidden = true; qPlay.hidden = false;
    renderQuestion();
  });

  $('#quizNext').addEventListener('click', () => {
    if (qi < QUIZ.length - 1) { qi++; renderQuestion(); }
    else finishQuiz();
  });

  function finishQuiz() {
    qPlay.hidden = true;
    qResult.hidden = false;
    $('#quizFinal').textContent = qScore;
    const n = QUIZ.length;
    let head, txt;
    if (qScore === n) {
      head = t('Мыкты! Сиз — чыныгы тил күйөрманысыз',
               'Превосходно! Вы настоящий знаток языка',
               'Perfect! You really know this language');
      txt  = t('Бардык суроого туура жооп бердиңиз. Мындай билим менен айтышка да чыкса болот!',
               'Вы ответили верно на все вопросы. С такими знаниями можно выходить и на айтыш!',
               'Every answer correct. With knowledge like this you could step into an aitysh!');
    } else if (qScore >= n - 3) {
      head = t('Азамат! Абдан жакшы жыйынтык',
               'Отлично! Очень хороший результат',
               'Excellent — a very good result');
      txt  = t('Тилдин тарыхын жакшы билесиз. Бир-эки суроону кайра карап чыксаңыз — жүз пайыз болот.',
               'Вы хорошо знаете историю языка. Повторите пару вопросов — и будет сто процентов.',
               'You know the history well. Review a couple of questions and you will have it all.');
    } else if (qScore >= n / 2) {
      head = t('Жакшы башталыш!', 'Хорошее начало!', 'A good start!');
      txt  = t('Негизги фактыларды билесиз. «Тарых» жана «Инсандар» бөлүмдөрүн кайра окуп, дагы бир жолу аракет кылыңыз.',
               'Основные факты вы знаете. Перечитайте разделы «История» и «Личности» и попробуйте ещё раз.',
               'You know the basics. Reread the History and People sections and try again.');
    } else {
      head = t('Баштайлы!', 'Начало положено!', 'Everyone starts somewhere');
      txt  = t('Уялбаңыз — сайттагы маалыматты окуп чыгып, викторинаны кайра өтүңүз. Экинчи жолу алда канча жакшы болот.',
               'Не беда — прочитайте материалы сайта и пройдите викторину снова. Со второго раза будет намного лучше.',
               'No harm done — read through the page and take the quiz again. The second run will go much better.');
    }
    $('#quizVerdict').textContent = head;
    $('#quizVerdictTxt').textContent = txt;
  }

  $('#quizAgain').addEventListener('click', () => {
    qi = 0; qScore = 0;
    qResult.hidden = true; qPlay.hidden = false;
    renderQuestion();
  });

  /* ============================================================
     7. МИНИ-ОЮН «ТҮГӨЙҮН ТАП»
     Сөздөр ар бир оюнда жаңыдан тандалып, аралаштырылат.
     ============================================================ */
  const POOL = [
    { w: 'Түндүк',    kg: 'Боз үйдүн жогорку тегерек бөлүгү',   ru: 'Верхний круг купола юрты',            en: 'The crown ring of a yurt' },
    { w: 'Комуз',     kg: 'Үч кылдуу улуттук аспап',            ru: 'Трёхструнный национальный инструмент', en: 'A three-stringed national instrument' },
    { w: 'Жайлоо',    kg: 'Малды жайган бийик жайкы жайыт',     ru: 'Высокогорное летнее пастбище',        en: 'A high summer pasture' },
    { w: 'Манасчы',   kg: '«Манас» эпосун жатка айтуучу',       ru: 'Сказитель эпоса «Манас»',             en: 'A reciter of the “Manas” epic' },
    { w: 'Айтыш',     kg: 'Акындардын ыр менен сынашуусу',      ru: 'Состязание акынов в импровизации',    en: 'A contest of improvising poets' },
    { w: 'Шырдак',    kg: 'Оюм салынган кийиз килем',           ru: 'Войлочный ковёр с орнаментом',        en: 'A felt carpet with cut-out patterns' },
    { w: 'Ак калпак', kg: 'Кыргыздын улуттук баш кийими',       ru: 'Национальный головной убор кыргызов', en: 'The white national felt hat' },
    { w: 'Боорсок',   kg: 'Майга бышырылган майда нан',         ru: 'Кусочки теста, жаренные в масле',     en: 'Small pieces of dough fried in oil' },
    { w: 'Чыйырчык',  kg: 'Тоо жолундагы ийри-буйру из',        ru: 'Извилистая горная тропа',             en: 'A winding mountain trail' },
    { w: 'Көчмөн',    kg: 'Жайлоодон жайлоого көчүп жүргөн эл', ru: 'Кочевник, человек кочевой жизни',     en: 'A nomad who moves from pasture to pasture' },
    { w: 'Куржун',    kg: 'Атка артынган эки көзү бар баштык',  ru: 'Перемётная сума, вьючный мешок',      en: 'A double saddlebag carried by a horse' },
    { w: 'Кымыз',     kg: 'Бээнин сүтүнөн ачытылган суусундук', ru: 'Напиток из сквашенного кобыльего молока', en: 'A drink of fermented mare’s milk' },
    { w: 'Чарык',     kg: 'Терден жасалган эски бут кийим',     ru: 'Старинная кожаная обувь',             en: 'Traditional leather footwear' },
    { w: 'Тамга',     kg: 'Алфавиттеги белги, жазуу белгиси',   ru: 'Буква, письменный знак',              en: 'A letter, a written sign' }
  ];
  const PAIR_COUNT = 8;

  const board = $('#board');
  let first = null, lock = false, found = 0, moves = 0, timer = null, sec = 0, started = false;

  const fmtTime = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* карты одной пары не должны оказаться рядом — ни по горизонтали, ни по вертикали */
  function scatter(deck) {
    for (let attempt = 0; attempt < 3000; attempt++) {
      shuffle(deck);
      const pos = {};
      let ok = true;
      deck.forEach((c, i) => {
        if (pos[c.id] === undefined) pos[c.id] = i;
        else if (Math.abs(i - pos[c.id]) < 5) ok = false;
      });
      if (ok) return deck;
    }
    return deck;
  }

  function showBest() {
    let b = null;
    try { b = localStorage.getItem('kgt-best'); } catch (e) {}
    $('#gBest').textContent = b ? b : '—';
  }

  function initGame() {
    clearInterval(timer);
    timer = null; started = false; sec = 0; moves = 0; found = 0; first = null; lock = false;
    $('#gTime').textContent = '00:00';
    $('#gMoves').textContent = '0';
    $('#gPairs').textContent = '0 / ' + PAIR_COUNT;
    $('#gWin').hidden = true;
    showBest();

    const chosen = shuffle(POOL.slice()).slice(0, PAIR_COUNT);
    const deck = [];
    chosen.forEach((p, i) => {
      deck.push({ id: i, type: 'w', text: p.w });
      deck.push({ id: i, type: 'm', text: t(p.kg, p.ru, p.en) });
    });
    scatter(deck);

    board.innerHTML = '';
    deck.forEach(card => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile';
      b.dataset.id = card.id;
      b.innerHTML =
        '<span class="tile__f"><svg viewBox="0 0 300 300"><use href="#orn-big"/></svg></span>' +
        '<span class="tile__b' + (card.type === 'w' ? ' kg' : '') + '"></span>';
      $('.tile__b', b).textContent = card.text;
      b.addEventListener('click', () => flip(b));
      board.appendChild(b);
    });
  }

  function startTimer() {
    if (started) return;
    started = true;
    timer = setInterval(() => { sec++; $('#gTime').textContent = fmtTime(sec); }, 1000);
  }

  function flip(tile) {
    if (lock || tile.classList.contains('is-open') || tile.classList.contains('is-done')) return;
    startTimer();
    tile.classList.add('is-open');

    if (!first) { first = tile; return; }

    moves++;
    $('#gMoves').textContent = moves;

    if (first.dataset.id === tile.dataset.id) {
      first.classList.add('is-done');
      tile.classList.add('is-done');
      first = null;
      found++;
      $('#gPairs').textContent = found + ' / ' + PAIR_COUNT;
      if (found === PAIR_COUNT) win();
      return;
    }

    lock = true;
    const a = first;
    a.classList.add('is-miss');
    tile.classList.add('is-miss');
    setTimeout(() => {
      a.classList.remove('is-open', 'is-miss');
      tile.classList.remove('is-open', 'is-miss');
      first = null; lock = false;
    }, 850);
  }

  function win() {
    clearInterval(timer);
    let best = null, prevSec = null;
    try { best = localStorage.getItem('kgt-best'); } catch (e) {}
    if (best) {
      const m = best.match(/^(\d+):(\d+)/);
      if (m) prevSec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    }
    let isBest = false;
    if (prevSec === null || sec < prevSec) {
      isBest = true;
      try { localStorage.setItem('kgt-best', fmtTime(sec)); } catch (e) {}
    }
    showBest();
    $('#gWinTxt').textContent =
      t('Убакыт: ', 'Время: ', 'Time: ') + fmtTime(sec) + ' · ' +
      t('кадам: ', 'ходов: ', 'moves: ') + moves +
      (isBest ? ' — ' + t('жаңы рекорд!', 'новый рекорд!', 'a new record!') : '');
    $('#gWin').hidden = false;
  }

  $('#gRestart').addEventListener('click', initGame);
  $('#gAgain').addEventListener('click', initGame);

  /* ============================================================
     8. СТАРТ
     ============================================================ */
  applyLang();
})();
