/* Veil — прототип: общее состояние и интеракции */

(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem('veil.' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem('veil.' + key, JSON.stringify(value));
    } catch (e) { /* прототип продолжает работать без хранилища */ }
  }

  function clearDeviceState() {
    try {
      Object.keys(localStorage)
        .filter(function (k) { return k.indexOf('veil.') === 0 && k !== 'veil.plan'; })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* no-op */ }
  }

  var DEFAULT_CITY = { code: 'NL', city: 'Амстердам', country: 'Нидерланды', ping: 18, id: 'nl' };
  var plan = read('plan', 'free');

  /* ─── общие состояния плана ─────────────────────────────── */

  function applyPlan() {
    plan = read('plan', 'free');
    document.documentElement.setAttribute('data-plan', plan);

    $$('[data-plan-name]').forEach(function (el) {
      el.textContent = plan === 'pro' ? 'Veil Pro' : 'Базовый';
    });

    $$('[data-if-plan]').forEach(function (el) {
      el.hidden = el.getAttribute('data-if-plan') !== plan;
    });

    $$('[data-pro-chip]').forEach(function (el) {
      el.classList.toggle('is-on', plan === 'pro');
      el.setAttribute('href', plan === 'pro' ? 'included.html' : 'paywall.html');
    });

    $$('[data-plan-seal]').forEach(function (el) {
      el.classList.toggle('is-muted', plan !== 'pro');
    });
  }

  /* ─── шторки ────────────────────────────────────────────── */

  function openSheet(el) {
    if (!el) return;
    el.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('is-open'); });
    });
    var target = $('button', el);
    if (target) setTimeout(function () { target.focus({ preventScroll: true }); }, 280);
  }

  function closeSheet(el) {
    if (!el) return;
    el.classList.remove('is-open');
    setTimeout(function () { el.hidden = true; }, 260);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') $$('.scrim.is-open').forEach(closeSheet);
  });

  function bindSheetDismiss() {
    $$('.scrim').forEach(function (scrim) {
      scrim.addEventListener('click', function (e) {
        if (e.target === scrim) closeSheet(scrim);
      });
    });

    $$('[data-close-sheet]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeSheet(btn.closest('.scrim'));
      });
    });
  }

  /* ─── главный экран ─────────────────────────────────────── */

  function initHome() {
    var app = $('#homeApp');
    if (!app) return;

    var btn = $('#connectBtn');
    var label = $('[data-orb-label]');
    var sub = $('[data-orb-sub]');
    var meta = $('[data-orb-meta]');
    var status = $('[data-state-label]');
    var ip = $('[data-fact-ip]');
    var tip = $('[data-orb-tip]');
    var permSheet = $('#permSheet');
    var state = read('connection', 'off');
    var connectedAt = read('connectedAt', null);
    var tick = null;
    var pending = null;
    var resume = null;
    var city = read('city', DEFAULT_CITY);

    function renderCity() {
      var code = $('[data-loc-code]');
      var name = $('[data-loc-name]');
      var locSub = $('[data-loc-sub]');
      if (code) code.textContent = city.code;
      if (name) name.textContent = city.city;
      if (locSub) locSub.textContent = city.country + ' · ' + city.ping + ' мс';
      if (meta) meta.textContent = city.city + ' · ' + city.ping + ' мс';
    }

    function fmtDuration(ms) {
      var total = Math.max(0, Math.floor(ms / 1000));
      var h = String(Math.floor(total / 3600)).padStart(2, '0');
      var m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
      var s = String(total % 60).padStart(2, '0');
      return h + ':' + m + ':' + s;
    }

    function paint(next) {
      app.setAttribute('data-state', next);
      if (btn) btn.setAttribute('aria-pressed', next === 'on' ? 'true' : 'false');

      if (next === 'on') {
        if (status) status.textContent = 'Защита включена';
        if (label) label.textContent = 'Отключить';
        if (sub) sub.textContent = fmtDuration(Date.now() - (connectedAt || Date.now()));
        if (ip) ip.textContent = '185.42.••.17';
        if (tip) tip.textContent = 'Трафик зашифрован. Журналы активности не ведутся.';
      } else if (next === 'connecting') {
        if (status) status.textContent = 'Подключение';
        if (label) label.textContent = 'Отмена';
        if (sub) sub.textContent = 'Уходим в тень';
        if (ip) ip.textContent = 'Скрываем…';
        if (tip) tip.textContent = 'Устанавливаем защищённый туннель.';
      } else {
        if (status) status.textContent = 'Защита выключена';
        if (label) label.textContent = 'Подключить';
        if (sub) sub.textContent = 'Один тап';
        if (ip) ip.textContent = 'Не скрыт';
        if (tip) tip.textContent = 'Провайдер видит, какие сайты вы открываете.';
      }

      if (tick) { clearInterval(tick); tick = null; }
      if (next === 'on') {
        tick = setInterval(function () {
          if (sub && connectedAt) sub.textContent = fmtDuration(Date.now() - connectedAt);
        }, 1000);
      }
    }

    function goOff() {
      if (pending) { clearTimeout(pending); pending = null; }
      if (resume) { clearTimeout(resume); resume = null; }
      state = 'off';
      connectedAt = null;
      write('connection', 'off');
      write('connectedAt', null);
      write('pendingConnect', false);
      write('manualOff', true);
      paint('off');
    }

    function startConnecting() {
      if (state === 'connecting') return;
      if (resume) { clearTimeout(resume); resume = null; }
      state = 'connecting';
      write('manualOff', false);
      paint('connecting');
      if (pending) clearTimeout(pending);
      pending = setTimeout(function () {
        pending = null;
        state = 'on';
        connectedAt = Date.now();
        write('connection', 'on');
        write('connectedAt', connectedAt);
        write('pendingConnect', false);
        paint('on');
      }, 1700);
    }

    if (btn) {
      btn.addEventListener('click', function () {
        if (state === 'connecting') { goOff(); return; }
        if (state === 'on') { goOff(); return; }
        if (!read('permission', false)) {
          openSheet(permSheet);
          return;
        }
        startConnecting();
      });
    }

    var allow = $('#permAllow');
    if (allow) {
      allow.addEventListener('click', function () {
        write('permission', true);
        closeSheet(permSheet);
        startConnecting();
      });
    }

    var later = $('#permLater');
    if (later) later.addEventListener('click', function () { closeSheet(permSheet); });

    if (state === 'connecting') state = 'off';
    if (state === 'on' && !connectedAt) {
      connectedAt = Date.now();
      write('connectedAt', connectedAt);
    }

    renderCity();
    paint(state);

    if (state === 'on' && read('pendingConnect', false)) {
      write('pendingConnect', false);
      resume = setTimeout(startConnecting, 320);
    } else if (read('pendingConnect', false)) {
      write('pendingConnect', false);
      resume = setTimeout(startConnecting, 420);
    } else if (state === 'off' && !read('manualOff', false) && read('autoconnect', true) && read('permission', false)) {
      resume = setTimeout(startConnecting, 520);
    }
  }

  /* ─── локации ───────────────────────────────────────────── */

  function initLocations() {
    var input = $('#locSearch');
    var empty = $('#locEmpty');
    var rows = $$('[data-search]');
    var isPro = plan === 'pro';
    var current = read('city', DEFAULT_CITY);

    if (isPro) {
      $$('[data-locked="true"]').forEach(function (row) {
        row.removeAttribute('data-locked');
        row.setAttribute('href', 'home.html');
        var tag = row.querySelector('[data-pro-tag]');
        if (tag) tag.hidden = true;
        row.setAttribute('aria-label', row.getAttribute('data-city') + ', ' + row.getAttribute('data-country'));
      });
    }

    rows.forEach(function (row) {
      var selected = row.getAttribute('data-id') === current.id;
      row.classList.toggle('is-selected', selected);
      var check = row.querySelector('[data-check]');
      if (check) check.hidden = !selected;
      var ping = row.querySelector('[data-ping]');
      if (ping) ping.hidden = selected;
    });

    $$('[data-city]').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (row.getAttribute('data-locked') === 'true') return;
        e.preventDefault();
        write('city', {
          code: row.getAttribute('data-code'),
          city: row.getAttribute('data-city'),
          country: row.getAttribute('data-country'),
          ping: Number(row.getAttribute('data-ping')),
          id: row.getAttribute('data-id')
        });
        if (read('connection', 'off') === 'on') write('pendingConnect', true);
        window.location.href = 'home.html';
      });
    });

    if (input) {
      var filter = function () {
        var q = input.value.trim().toLowerCase();
        var shown = 0;

        rows.forEach(function (row) {
          var haystack = row.getAttribute('data-search') || '';
          var hit = !q || haystack.indexOf(q) !== -1;
          row.hidden = !hit;
          if (hit) shown += 1;
        });

        $$('.loc-group').forEach(function (el) { el.hidden = !!q; });
        if (empty) empty.hidden = shown !== 0;
      };

      input.addEventListener('input', filter);
      input.addEventListener('search', filter);

      var reset = $('#locReset');
      if (reset) {
        reset.addEventListener('click', function () {
          input.value = '';
          filter();
          input.focus();
        });
      }
    }
  }

  /* ─── paywall ───────────────────────────────────────────── */

  function initPaywall() {
    var buy = $('#buyBtn');
    var legal = $('#payLegal');
    var plans = $$('.plan');

    function selected() {
      return $('.plan[aria-pressed="true"]') || plans[0];
    }

    function updateLegal() {
      var card = selected();
      if (!card || !legal) return;
      var annual = card.getAttribute('data-plan') === 'year';
      legal.textContent = annual
        ? '7 дней бесплатно, затем 1\u00A0990\u00A0₽ в год. Первое списание — 29\u00A0ноября\u00A02026.'
        : '7 дней бесплатно, затем 299\u00A0₽ в месяц. Первое списание — 29\u00A0ноября\u00A02026.';
    }

    plans.forEach(function (card) {
      card.addEventListener('click', function () {
        plans.forEach(function (other) {
          other.setAttribute('aria-pressed', other === card ? 'true' : 'false');
        });
        updateLegal();
      });
    });

    updateLegal();

    if (buy) {
      buy.addEventListener('click', function () {
        write('plan', 'pro');
        buy.disabled = true;
        buy.textContent = 'Активируем…';
        setTimeout(function () { window.location.href = 'included.html?pro=1'; }, 650);
      });
    }
  }

  /* ─── настройки и аккаунт ───────────────────────────────── */

  function initSettings() {
    var deviceCount = $('[data-device-count]');
    var devicesEmpty = $('#devicesEmpty');

    function updateDeviceCount() {
      if (!deviceCount) return;
      var visible = $$('.device').filter(function (row) { return !row.hidden; }).length;
      var limit = plan === 'pro' ? 5 : 1;
      deviceCount.textContent = visible + ' из ' + limit;
      if (devicesEmpty) devicesEmpty.hidden = visible !== 1;
    }

    updateDeviceCount();

    $$('.switch[data-setting]').forEach(function (sw) {
      var key = sw.getAttribute('data-setting');
      var fallback = sw.getAttribute('aria-checked') === 'true';
      var value = read(key, fallback);
      sw.setAttribute('aria-checked', value ? 'true' : 'false');
      sw.addEventListener('click', function () {
        var next = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', next ? 'true' : 'false');
        write(key, next);
      });
    });

    $$('[data-open-signout]').forEach(function (el) {
      el.addEventListener('click', function () { openSheet($('#signoutSheet')); });
    });

    $$('[data-open-cancel]').forEach(function (el) {
      el.addEventListener('click', function () { openSheet($('#cancelSheet')); });
    });

    $$('[data-cancel-confirm]').forEach(function (el) {
      el.addEventListener('click', function () {
        var city = read('city', DEFAULT_CITY);
        if (city && (city.id === 'us' || city.id === 'jp')) write('city', DEFAULT_CITY);
        write('plan', 'free');
        write('connection', 'off');
        write('connectedAt', null);
        write('pendingConnect', false);
        window.location.href = 'settings.html';
      });
    });

    $$('[data-signout-confirm]').forEach(function (el) {
      el.addEventListener('click', function () {
        clearDeviceState();
        window.location.href = 'onboarding.html';
      });
    });

    $$('[data-remove-device]').forEach(function (el) {
      el.addEventListener('click', function () {
        var row = el.closest('.device');
        if (row) row.remove();
        updateDeviceCount();
      });
    });
  }

  /* ─── included param fallback ────────────────────────────── */

  if (new URLSearchParams(window.location.search).get('pro') === '1') {
    write('plan', 'pro');
    try { history.replaceState(null, '', 'included.html'); } catch (e) { /* no-op */ }
  }

  /* ─── запуск ───────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', function () {
    applyPlan();
    bindSheetDismiss();
    initHome();
    initLocations();
    initPaywall();
    initSettings();
  });
})();
