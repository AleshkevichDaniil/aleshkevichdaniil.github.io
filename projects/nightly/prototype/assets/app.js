/* ============================================================
   Nightly — shared runtime: chrome, state, screen wiring
   ============================================================ */
(function () {
  'use strict';

  /* ---------- demo clock & data ---------- */
  var DEMO = new Date(2026, 10, 16, 22, 14); // 16 ноября 2026, 22:14 — фиксированное «сейчас»
  var MONTHS = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
  var WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  var WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  var DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  var SOUNDS = {
    rain: { name: 'Дождь', meta: 'Природный шум', icon: 'rain', free: true },
    ocean: { name: 'Океан', meta: 'Глубокие волны', icon: 'ocean', free: true },
    forest: { name: 'Лес', meta: 'Ночной лес', icon: 'forest', free: false },
    fire: { name: 'Камин', meta: 'Тёплый треск', icon: 'fire', free: false },
    fan: { name: 'Вентилятор', meta: 'Ровный гул', icon: 'fan', free: false },
    white: { name: 'Белый шум', meta: 'Широкий спектр', icon: 'noise', free: true }
  };

  var DEFAULTS = {
    plan: 'free',
    sound: 'rain',
    timer: 30,
    volume: 62,
    alarmOn: true,
    hour: 7,
    minute: 30,
    days: [0, 1, 2, 3, 4],
    window: 30,
    trialJustStarted: false
  };

  var KEY = 'nightly.demo.v1';

  function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src) continue;
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
      }
    }
    return target;
  }

  function readState() {
    var next;
    try {
      var raw = localStorage.getItem(KEY);
      next = raw ? extend({}, DEFAULTS, JSON.parse(raw)) : extend({}, DEFAULTS);
    } catch (e) {
      next = extend({}, DEFAULTS);
    }
    next.days = (next.days || []).slice();
    return next;
  }

  var state = readState();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable — прототип продолжает работать в памяти */
    }
  }

  /* ---------- helpers ---------- */
  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function timeText(h, m) {
    return pad(h) + ':' + pad(m);
  }

  function dateText(d) {
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  function greeting(d) {
    var h = d.getHours();
    if (h >= 5 && h < 12) return 'Доброе утро';
    if (h >= 12 && h < 18) return 'Добрый день';
    if (h >= 18 && h < 23) return 'Добрый вечер';
    return 'Доброй ночи';
  }

  function nextAlarmDate() {
    var days = state.days;
    if (!days.length) return null;
    for (var i = 0; i < 8; i++) {
      var d = new Date(DEMO.getFullYear(), DEMO.getMonth(), DEMO.getDate() + i, state.hour, state.minute, 0, 0);
      if (d.getTime() <= DEMO.getTime()) continue;
      var wd = (d.getDay() + 6) % 7;
      if (days.indexOf(wd) === -1) continue;
      return d;
    }
    return null;
  }

  function daysSummary() {
    var days = state.days.slice().sort();
    if (!days.length) return 'Дни не выбраны';
    if (days.length === 7) return 'Каждый день';
    if (days.join() === '0,1,2,3,4') return 'По будням';
    if (days.join() === '5,6') return 'По выходным';
    return days.map(function (d) {
      return DAY_LABELS[d];
    }).join(', ');
  }

  /* ---------- chrome ---------- */
  var STATUS_ICONS =
    '<span class="sb-icons" aria-hidden="true">' +
    '<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.6" width="3" height="6.4" rx="1"/><rect x="10" y="3.2" width="3" height="8.8" rx="1"/><rect x="15" y="0.8" width="3" height="11.2" rx="1"/></svg>' +
    '<svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M1.5 4.4a10 10 0 0 1 13 0"/><path d="M4 7.2a6.4 6.4 0 0 1 8 0"/><path d="M6.4 9.8a2.7 2.7 0 0 1 3.2 0"/></svg>' +
    '<svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.6" y="0.6" width="21" height="10.8" rx="3" stroke="currentColor" stroke-opacity="0.42"/><rect x="2.4" y="2.4" width="14.4" height="7.2" rx="1.8" fill="currentColor"/><path d="M22.8 4.3v3.4c1.1-.3 1.1-3.1 0-3.4Z" fill="currentColor" fill-opacity="0.5"/></svg>' +
    '</span>';

  var TABS = [
    { id: 'sounds', label: 'Звуки', icon: 'noise', href: '02-home.html' },
    { id: 'alarm', label: 'Будильник', icon: 'bell', href: '04-alarm.html' },
    { id: 'sleep', label: 'Сон', icon: 'chart', href: '05-sleep.html' }
  ];

  function tabbarHTML(active) {
    return (
      '<nav class="tabbar" aria-label="Основная навигация">' +
      TABS.map(function (t) {
        var current = t.id === active ? ' aria-current="page"' : '';
        return (
          '<a class="tab" href="' + t.href + '"' + current + ' data-od-id="tab-' + t.id + '">' +
          '<svg class="ico" aria-hidden="true"><use href="#i-' + t.icon + '"></use></svg>' +
          '<span>' + t.label + '</span></a>'
        );
      }).join('') +
      '</nav>'
    );
  }

  function mountChrome() {
    if (window.OD_ICONS && !document.getElementById('i-moon')) {
      document.body.insertAdjacentHTML('afterbegin', window.OD_ICONS);
    }

    var device = document.querySelector('.device');
    if (!device) return;

    if (!device.querySelector('.statusbar')) {
      device.insertAdjacentHTML(
        'afterbegin',
        '<div class="island" aria-hidden="true"></div>' +
          '<div class="statusbar" aria-hidden="true"><span class="sb-time">' +
          timeText(DEMO.getHours(), DEMO.getMinutes()) +
          '</span>' +
          STATUS_ICONS +
          '</div>'
      );
    }

    var nav = device.getAttribute('data-nav');
    if (nav && !device.querySelector('.tabbar')) {
      device.insertAdjacentHTML('beforeend', tabbarHTML(nav));
    }

    if (!device.querySelector('.home-indicator') && device.getAttribute('data-home-indicator') !== 'off') {
      device.insertAdjacentHTML('beforeend', '<div class="home-indicator" aria-hidden="true"></div>');
    }
  }

  /* ---------- toast ---------- */
  function toast(text) {
    var device = document.querySelector('.device');
    if (!device) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    device.appendChild(el);
    requestAnimationFrame(function () {
      el.classList.add('is-in');
    });
    setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () {
        el.remove();
      }, 280);
    }, 3400);
  }

  /* ---------- date & greeting bindings ---------- */
  function bindStaticText() {
    document.querySelectorAll('[data-greeting]').forEach(function (el) {
      el.textContent = greeting(DEMO);
    });
    document.querySelectorAll('[data-demo-date]').forEach(function (el) {
      el.textContent = dateText(DEMO);
    });
    document.querySelectorAll('[data-demo-weekday]').forEach(function (el) {
      el.textContent = WEEKDAYS[(DEMO.getDay() + 6) % 7];
    });
    document.querySelectorAll('[data-demo-year]').forEach(function (el) {
      el.textContent = String(DEMO.getFullYear());
    });
  }

  /* ---------- onboarding ---------- */
  function initOnboarding() {
    var track = document.getElementById('onboardingTrack');
    if (!track) return;
    var dots = Array.prototype.slice.call(document.querySelectorAll('[data-dot]'));
    var next = document.getElementById('onboardingNext');
    var counter = document.getElementById('slideCounter');
    var slides = track.children.length;
    var index = 0;

    function render() {
      track.style.transform = 'translateX(' + (-index * (100 / slides)) + '%)';
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === index);
        if (i === index) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      if (counter) counter.textContent = '0' + (index + 1) + ' / 0' + slides;
      Array.prototype.forEach.call(track.children, function (s, i) {
        s.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      });
    }

    function go(i) {
      index = Math.max(0, Math.min(slides - 1, i));
      render();
    }

    if (next) {
      next.addEventListener('click', function () {
        if (index < slides - 1) go(index + 1);
        else window.location.href = '02-home.html';
      });
    }

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () {
        go(i);
      });
    });

    var startX = null;
    track.addEventListener(
      'touchstart',
      function (e) {
        startX = e.touches[0].clientX;
      },
      { passive: true }
    );
    track.addEventListener(
      'touchend',
      function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 42) go(index + (dx < 0 ? 1 : -1));
        startX = null;
      },
      { passive: true }
    );

    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    });

    render();
  }

  /* ---------- home ---------- */
  function initHome() {
    var promo = document.getElementById('plusPromo');
    var plus = state.plan === 'plus';

    if (plus) {
      document.querySelectorAll('[data-lock]').forEach(function (el) {
        el.remove();
      });
      document.querySelectorAll('.sound-card[data-locked="true"]').forEach(function (card) {
        card.setAttribute('data-locked', 'false');
        card.setAttribute('href', '03-player.html?sound=' + card.getAttribute('data-sound'));
      });
    }

    if (promo) {
      promo.setAttribute(
        'href',
        plus ? '06-paywall.html' : '06-paywall.html'
      );
      if (plus) {
        promo.classList.add('is-plus');
        var title = promo.querySelector('[data-promo-title]');
        var text = promo.querySelector('[data-promo-text]');
        if (title) title.textContent = 'Nightly Plus активен';
        if (text) text.textContent = 'Пробный период · осталось 7 дней';
      }
    }

    var cont = document.querySelector('[data-continue]');
    if (cont) {
      var s = SOUNDS[state.sound] || SOUNDS.rain;
      var nameEl = cont.querySelector('[data-continue-name]');
      var metaEl = cont.querySelector('[data-continue-meta]');
      var iconEl = cont.querySelector('[data-continue-icon]');
      if (nameEl) nameEl.textContent = s.name;
      if (metaEl) metaEl.textContent = 'Таймер · ' + (state.timer === 'night' ? 'до утра' : state.timer + ' мин');
      if (iconEl) iconEl.setAttribute('href', '#i-' + s.icon);
      cont.setAttribute('href', '03-player.html?sound=' + (state.sound || 'rain'));
      cont.className = 'continue-card tone-' + (state.sound || 'rain');
    }

    if (state.trialJustStarted) {
      state.trialJustStarted = false;
      save();
      setTimeout(function () {
        toast('Пробный период активен · 7 дней');
      }, 500);
    }
  }

  /* ---------- player ---------- */
  function initPlayer() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('sound');
    if (id && SOUNDS[id]) {
      state.sound = id;
    }
    var sound = SOUNDS[state.sound] || SOUNDS.rain;
    var timerParam = params.get('timer');
    if (timerParam) state.timer = timerParam === 'night' ? 'night' : Number(timerParam);
    save();

    var orb = document.getElementById('orb');
    var icon = document.getElementById('orbIcon');
    var name = document.getElementById('soundName');
    var meta = document.getElementById('soundMeta');
    var toggle = document.getElementById('playToggle');
    var toggleIcon = document.getElementById('playIcon');
    var toggleLabel = document.getElementById('playLabel');
    var art = document.getElementById('playerArt');

    if (name) name.textContent = sound.name;
    if (meta) meta.textContent = sound.meta;
    if (icon) icon.setAttribute('href', '#i-' + sound.icon);
    if (orb) {
      orb.className = 'orb tone-' + state.sound;
    }
    if (art) art.className = 'player-art tone-' + state.sound;

    /* fade indicator */
    var fadeText = document.getElementById('fadeText');
    var chips = Array.prototype.slice.call(document.querySelectorAll('[data-timer]'));

    function fadeLabel() {
      if (state.timer === 'night') return 'Звук затихнет в ' + timeText(state.hour, state.minute);
      var remain = Number(state.timer) - 2;
      return 'Звук затихнет через ' + remain + ' мин';
    }

    function syncTimerChips() {
      chips.forEach(function (c) {
        var v = c.getAttribute('data-timer');
        var active = String(state.timer) === v || (v === 'night' && state.timer === 'night');
        c.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (fadeText) fadeText.textContent = fadeLabel();
    }

    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var v = c.getAttribute('data-timer');
        state.timer = v === 'night' ? 'night' : Number(v);
        save();
        syncTimerChips();
      });
    });
    syncTimerChips();

    /* volume */
    var range = document.getElementById('volume');
    var value = document.getElementById('volumeValue');
    if (range) {
      range.value = String(state.volume);
      if (value) value.textContent = state.volume + '%';
      range.style.setProperty('--fill', state.volume + '%');
      range.addEventListener('input', function () {
        state.volume = Number(range.value);
        if (value) value.textContent = state.volume + '%';
        range.style.setProperty('--fill', state.volume + '%');
        save();
      });
    }

    /* play / pause */
    var playing = true;

    function syncPlay() {
      if (toggle) toggle.setAttribute('aria-pressed', playing ? 'true' : 'false');
      if (toggleIcon) toggleIcon.setAttribute('href', playing ? '#i-pause' : '#i-play');
      if (toggleLabel) toggleLabel.textContent = playing ? 'Пауза' : 'Продолжить';
      if (orb) orb.classList.toggle('is-playing', playing);
      if (toggle) toggle.setAttribute('aria-label', playing ? 'Пауза' : 'Воспроизвести');
      var dot = document.getElementById('liveDot');
      if (dot) dot.classList.toggle('is-off', !playing);
    }

    if (toggle) {
      toggle.addEventListener('click', function () {
        playing = !playing;
        syncPlay();
      });
    }
    syncPlay();
  }

  /* ---------- alarm ---------- */
  function initAlarm() {
    var SHELL = 42;

    function setupWheel(el, key, max) {
      if (!el) return;
      var html = '<div class="wheel-spacer"></div>';
      for (var i = 0; i < max; i++) {
        html += '<div class="wheel-item" role="option" data-index="' + i + '" aria-selected="false">' + pad(i) + '</div>';
      }
      html += '<div class="wheel-spacer"></div>';
      el.innerHTML = html;
      el.scrollTop = state[key] * SHELL;

      function paint() {
        var items = el.querySelectorAll('.wheel-item');
        Array.prototype.forEach.call(items, function (c, i) {
          var on = i === state[key];
          c.classList.toggle('is-active', on);
          c.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      }

      var timer = null;
      el.addEventListener(
        'scroll',
        function () {
          if (timer) clearTimeout(timer);
          timer = setTimeout(function () {
            var idx = Math.round(el.scrollTop / SHELL);
            idx = Math.max(0, Math.min(max - 1, idx));
            if (idx !== state[key]) {
              state[key] = idx;
              save();
              paint();
              syncAlarmText();
            }
          }, 90);
        },
        { passive: true }
      );

      el.addEventListener('click', function (e) {
        var item = e.target.closest('.wheel-item');
        if (!item) return;
        el.scrollTo({ top: Number(item.getAttribute('data-index')) * SHELL, behavior: 'smooth' });
      });

      el.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        var idx = state[key] + (e.key === 'ArrowDown' ? 1 : -1);
        idx = Math.max(0, Math.min(max - 1, idx));
        el.scrollTo({ top: idx * SHELL, behavior: 'smooth' });
      });

      paint();
    }

    setupWheel(document.getElementById('wheelHour'), 'hour', 24);
    setupWheel(document.getElementById('wheelMinute'), 'minute', 60);

    var toggle = document.getElementById('alarmToggle');
    var body = document.getElementById('alarmBody');
    var summaryTime = document.getElementById('alarmSummaryTime');
    var summaryMeta = document.getElementById('alarmSummaryMeta');
    var summaryDays = document.getElementById('daysSummary');
    var stateLabel = document.getElementById('alarmState');
    var windowValue = document.getElementById('windowValue');
    var segButtons = Array.prototype.slice.call(document.querySelectorAll('[data-window]'));

    function syncAlarmText() {
      var next = nextAlarmDate();
      if (summaryTime) summaryTime.textContent = timeText(state.hour, state.minute);
      if (summaryMeta) {
        if (!state.alarmOn) summaryMeta.textContent = 'Будильник выключен';
        else if (!next) summaryMeta.textContent = 'Выберите дни недели';
        else summaryMeta.textContent = WEEKDAYS_SHORT[(next.getDay() + 6) % 7] + ', ' + dateText(next);
      }
      if (summaryDays) summaryDays.textContent = daysSummary();
      if (stateLabel) stateLabel.textContent = state.alarmOn ? 'Включён' : 'Выключен';
      if (body) body.classList.toggle('is-off', !state.alarmOn);
      if (toggle) toggle.setAttribute('aria-checked', state.alarmOn ? 'true' : 'false');
      if (windowValue) windowValue.textContent = 'за ' + state.window + ' минут до';
      segButtons.forEach(function (b) {
        var on = Number(b.getAttribute('data-window')) === state.window;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    if (toggle) {
      toggle.addEventListener('click', function () {
        state.alarmOn = !state.alarmOn;
        save();
        syncAlarmText();
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-day]'), function (btn) {
      btn.addEventListener('click', function () {
        var d = Number(btn.getAttribute('data-day'));
        var i = state.days.indexOf(d);
        if (i === -1) state.days.push(d);
        else state.days.splice(i, 1);
        state.days.sort();
        save();
        btn.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
        syncAlarmText();
      });
      var idx = state.days.indexOf(Number(btn.getAttribute('data-day')));
      btn.setAttribute('aria-pressed', idx === -1 ? 'false' : 'true');
    });

    segButtons.forEach(function (b) {
      b.addEventListener('click', function () {
        state.window = Number(b.getAttribute('data-window'));
        save();
        syncAlarmText();
      });
    });

    syncAlarmText();
  }

  /* ---------- sleep ---------- */
  function initSleep() {
    var bars = Array.prototype.slice.call(document.querySelectorAll('[data-bar]'));
    if (!bars.length) return;
    var dateEl = document.getElementById('barDate');
    var durEl = document.getElementById('barDuration');
    var scoreEl = document.getElementById('barScore');

    function select(bar) {
      bars.forEach(function (b) {
        b.setAttribute('aria-pressed', b === bar ? 'true' : 'false');
      });
      if (dateEl) dateEl.textContent = bar.getAttribute('data-date');
      if (durEl) durEl.textContent = bar.getAttribute('data-dur');
      if (scoreEl) scoreEl.textContent = bar.getAttribute('data-score');
    }

    bars.forEach(function (b) {
      b.addEventListener('click', function () {
        select(b);
      });
    });

    var initial = bars.filter(function (b) {
      return b.getAttribute('aria-pressed') === 'true';
    })[0];
    select(initial || bars[bars.length - 1]);
  }

  /* ---------- paywall ---------- */
  function initPaywall() {
    var plans = Array.prototype.slice.call(document.querySelectorAll('[data-plan]'));
    var cta = document.getElementById('paywallCta');
    var legal = document.getElementById('paywallLegal');
    var selected = 'year';

    var LEGAL = {
      year: '7 дней бесплатно, затем 1 990 ₽ в год. Отмена в любой момент в настройках Apple ID.',
      month: '7 дней бесплатно, затем 349 ₽ в месяц. Отмена в любой момент в настройках Apple ID.'
    };

    function syncPlans() {
      plans.forEach(function (p) {
        var on = p.getAttribute('data-plan') === selected;
        p.setAttribute('aria-checked', on ? 'true' : 'false');
        p.tabIndex = on ? 0 : -1;
      });
      if (legal) legal.textContent = LEGAL[selected] || LEGAL.year;
    }

    plans.forEach(function (p) {
      p.addEventListener('click', function () {
        selected = p.getAttribute('data-plan');
        syncPlans();
      });
      p.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        var idx = plans.indexOf(p);
        var nextIdx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + plans.length) % plans.length;
        plans[nextIdx].focus();
        selected = plans[nextIdx].getAttribute('data-plan');
        syncPlans();
      });
    });
    syncPlans();

    if (cta) {
      cta.addEventListener('click', function () {
        state.plan = 'plus';
        state.trialJustStarted = true;
        save();
        window.location.href = '02-home.html';
      });
    }
  }

  /* ---------- boot ---------- */
  function boot() {
    mountChrome();
    bindStaticText();

    var screen = document.body.getAttribute('data-screen');
    if (screen === 'onboarding') initOnboarding();
    if (screen === 'home') initHome();
    if (screen === 'player') initPlayer();
    if (screen === 'alarm') initAlarm();
    if (screen === 'sleep') initSleep();
    if (screen === 'paywall') initPaywall();
  }

  window.Nightly = {
    demo: DEMO,
    state: state,
    save: save,
    sounds: SOUNDS,
    toast: toast,
    reset: function () {
      state = extend({}, DEFAULTS);
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
      save();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
