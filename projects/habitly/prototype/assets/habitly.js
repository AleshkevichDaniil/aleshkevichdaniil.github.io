/* Habitly prototype — working states only.
   Each block is scoped by a data-screen hook, so one file serves every screen. */

(function () {
  'use strict';

  var STORE = 'habitly.created';

  var ICONS = {
    water: '<path d="M12 3c3.2 3.4 6 6.7 6 10a6 6 0 0 1-12 0c0-3.3 2.8-6.6 6-10z" />',
    sun: '<circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M7 7h8M7 10.5h5" />',
    leaf: '<path d="M5 19c0-7.5 5.5-12.5 13-12.5C18 14 12.5 19 5 19z" /><path d="M8.5 15.5c1.8-2.4 4-4 6.5-5" />',
    journal: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" />'
  };

  var TILES = { sand: 't-accent', clay: 't-clay', sage: 't-sage', butter: 't-butter', sky: 't-sky' };
  var ICON_TILES = { water: 't-sky', sun: 't-clay', book: 't-butter', leaf: 't-sage', journal: 't-accent' };

  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>';

  function iconMarkup(key) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONS[key] || ICONS.sun) + '</svg>';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function load() {
    try {
      var list = JSON.parse(sessionStorage.getItem(STORE) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (error) {
      return [];
    }
  }

  function save(list) {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(list));
    } catch (error) {
      /* storage can be unavailable — the prototype still navigates */
    }
  }

  function setDone(id, done) {
    var list = load();
    list.forEach(function (habit) {
      if (habit.id === id) habit.done = done;
    });
    save(list);
  }

  /* ---------- generic switches ---------- */
  document.querySelectorAll('[data-switch]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-checked') === 'true';
      btn.setAttribute('aria-checked', String(!on));
      var row = btn.closest('.row-card');
      if (row) row.classList.toggle('is-off', on);
    });
  });

  /* ---------- today: created habits, marks + progress ---------- */
  var today = document.querySelector('[data-screen="today"]');
  if (today) {
    var morning = today.querySelector('[data-od-id="today-morning"]');
    var firstRow = morning ? morning.querySelector('.habit') : null;

    load().forEach(function (habit) {
      if (!morning || !habit || !habit.id) return;
      var row = document.createElement('article');
      row.className = 'habit' + (habit.done ? ' is-done' : '');
      row.setAttribute('data-habit-id', habit.id);
      row.setAttribute('data-od-id', 'habit-' + habit.id);
      row.innerHTML =
        '<a class="habit-link" href="04-habit-detail.html?h=' + encodeURIComponent(habit.id) + '">' +
          '<span class="tile ' + (TILES[habit.color] || 't-accent') + '">' + iconMarkup(habit.icon) + '</span>' +
          '<span class="habit-text">' +
            '<span class="habit-title">' + esc(habit.title) + '</span>' +
            '<span class="habit-meta">' + esc(habit.meta) + '</span>' +
          '</span>' +
        '</a>' +
        '<button class="check" type="button" aria-pressed="' + (habit.done ? 'true' : 'false') + '" aria-label="Отметить «' + esc(habit.title) + '»">' + CHECK + '</button>';

      if (firstRow) morning.insertBefore(row, firstRow);
      else morning.appendChild(row);
    });

    var checks = [].slice.call(today.querySelectorAll('.check'));
    var countEl = today.querySelector('[data-count]');
    var totalEl = today.querySelector('[data-total]');
    var fillEl = today.querySelector('[data-fill]');
    var noteEl = today.querySelector('[data-note]');
    var total = checks.length;

    var sync = function () {
      var done = checks.filter(function (c) {
        return c.getAttribute('aria-pressed') === 'true';
      }).length;
      countEl.textContent = String(done);
      if (totalEl) totalEl.textContent = 'из ' + total;
      fillEl.style.width = (done / total * 100) + '%';
      var left = total - done;
      noteEl.textContent = left === 0 ? 'День закрыт' : (left === 1 ? 'Остался 1' : 'Осталось ' + left);
    };

    checks.forEach(function (check) {
      check.addEventListener('click', function () {
        var pressed = check.getAttribute('aria-pressed') === 'true';
        check.setAttribute('aria-pressed', String(!pressed));
        var habit = check.closest('.habit');
        if (habit) {
          habit.classList.toggle('is-done', !pressed);
          var id = habit.getAttribute('data-habit-id');
          if (id) setDone(id, !pressed);
        }
        sync();
      });
    });

    sync();
  }

  /* ---------- habit detail: static cards + a card for a created habit ---------- */
  var detail = document.querySelector('[data-screen="detail"]');
  if (detail) {
    var library = {
      water: {
        title: 'Вода 2 литра',
        meta: 'Каждый день · напоминание 09:00',
        streak: '31',
        note: '<strong>22 из 22</strong> дней в декабре',
        memo: 'Держу бутылку на рабочем столе и допиваю до обеда.',
        pct: 100,
        done: true,
        icon: 'water'
      },
      stretch: {
        title: 'Утренняя растяжка',
        meta: '10 минут · каждый день · 08:00',
        streak: '28',
        note: '<strong>22 из 22</strong> дней в декабре',
        memo: 'Тянусь под утренний подкаст: десяти минут хватает.',
        pct: 100,
        done: true,
        icon: 'sun'
      },
      reading: {
        title: 'Чтение 20 страниц',
        meta: 'Каждый день · напоминание 21:30',
        streak: '12',
        note: '<strong>18 из 22</strong> дней в декабре',
        memo: 'Двадцать страниц перед сном вместо ленты.',
        pct: 82,
        done: true,
        icon: 'book'
      },
      walk: {
        title: 'Прогулка 30 минут',
        meta: 'Каждый день · без напоминаний',
        streak: '5',
        note: '<strong>15 из 22</strong> дней в декабре',
        memo: 'Выхожу после обеда, даже если всего десять минут.',
        pct: 68,
        done: false,
        icon: 'leaf'
      },
      journal: {
        title: 'Дневник вечером',
        meta: 'По будням · напоминание 22:00',
        streak: '3',
        note: '<strong>9 из 22</strong> дней в декабре',
        memo: 'Три строки о дне: что получилось и что мешает.',
        pct: 41,
        done: false,
        icon: 'journal'
      }
    };

    var key = new URLSearchParams(location.search).get('h');
    var custom = null;
    if (key) {
      load().some(function (item) {
        if (item.id === key) {
          custom = item;
          return true;
        }
        return false;
      });
    }

    var habit;
    if (custom) {
      habit = {
        title: custom.title,
        meta: custom.meta,
        streak: custom.done ? '1' : '0',
        note: custom.done ? '<strong>1 из 22</strong> дней в декабре' : 'Серия начнётся с первого дня',
        memo: custom.note || '',
        pct: custom.done ? 100 / 22 : 0,
        done: !!custom.done,
        icon: custom.icon
      };
    } else {
      habit = library[key] || library.stretch;
    }

    var iconBox = detail.querySelector('[data-detail="icon"]');
    if (iconBox) {
      var tileClass = custom ? (TILES[custom.color] || 't-accent') : (ICON_TILES[habit.icon] || 't-clay');
      iconBox.className = 'tile ' + tileClass;
      iconBox.innerHTML = iconMarkup(habit.icon);
    }

    detail.querySelector('[data-detail="title"]').textContent = habit.title;
    detail.querySelector('[data-detail="meta"]').textContent = habit.meta;
    detail.querySelector('[data-detail="streak"]').textContent = habit.streak;
    detail.querySelector('[data-detail="note"]').innerHTML = habit.note;

    var memoEl = detail.querySelector('[data-detail="memo"]');
    var memoCard = detail.querySelector('.note-card');
    if (memoEl) {
      if (habit.memo) {
        memoEl.textContent = habit.memo;
      } else if (memoCard) {
        memoCard.hidden = true;
      }
    }

    if (custom) {
      [].slice.call(detail.querySelectorAll('.week-strip .week-day')).forEach(function (day) {
        var dot = day.querySelector('.week-dot');
        if (!dot) return;
        dot.classList.remove('on');
        if (!dot.hasAttribute('data-detail-week')) dot.classList.add('future');
      });
    }

    var ring = detail.querySelector('[data-detail="ring"]');
    if (ring) {
      var radius = 70;
      var len = 2 * Math.PI * radius;
      ring.setAttribute('stroke-dasharray', len.toFixed(1));
      ring.setAttribute('stroke-dashoffset', (len * (1 - habit.pct / 100)).toFixed(1));
    }

    var action = detail.querySelector('[data-detail-action]');
    var setAction = function (done) {
      action.dataset.done = String(done);
      action.classList.toggle('btn-done', done);
      action.classList.toggle('btn-primary', !done);
      action.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>' +
        (done ? 'Выполнено сегодня' : 'Отметить на сегодня');
      detail.querySelector('[data-detail-week="today"]').classList.toggle('on', done);
    };

    setAction(habit.done);
    action.addEventListener('click', function () {
      var next = action.dataset.done !== 'true';
      setAction(next);
      if (custom) {
        setDone(custom.id, next);
        var streakEl = detail.querySelector('[data-detail="streak"]');
        var noteEl = detail.querySelector('[data-detail="note"]');
        if (streakEl) streakEl.textContent = next ? '1' : '0';
        if (noteEl) {
          noteEl.innerHTML = next
            ? '<strong>1 из 22</strong> дней в декабре'
            : 'Серия начнётся с первого дня';
        }
        if (ring) {
          ring.setAttribute('stroke-dashoffset', (len * (1 - (next ? 100 / 22 : 0) / 100)).toFixed(1));
        }
      }
    });
  }

  /* ---------- create habit ---------- */
  var create = document.querySelector('[data-screen="create"]');
  if (create) {
    var form = create.querySelector('form');
    var nameInput = create.querySelector('#habit-name');
    var err = create.querySelector('#name-error');
    var preview = create.querySelector('[data-preview]');
    var reminderText = create.querySelector('[data-reminder-text]');
    var settings = create.querySelector('[data-switch]');
    var previewIcon = 'sun';
    var previewColor = 'clay';

    if (settings) settings.setAttribute('aria-checked', 'true');

    create.querySelectorAll('[data-fill]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        nameInput.value = chip.getAttribute('data-fill');
        err.classList.remove('show');
        nameInput.focus();
      });
    });

    create.querySelectorAll('[data-icon-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        create.querySelectorAll('[data-icon-choice]').forEach(function (b) {
          b.setAttribute('aria-pressed', 'false');
        });
        btn.setAttribute('aria-pressed', 'true');
        previewIcon = btn.getAttribute('data-icon') || 'sun';
        preview.innerHTML = iconMarkup(previewIcon);
      });
    });

    create.querySelectorAll('.swatch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        create.querySelectorAll('.swatch').forEach(function (b) {
          b.setAttribute('aria-pressed', 'false');
        });
        btn.setAttribute('aria-pressed', 'true');
        previewColor = btn.getAttribute('data-color') || 'clay';
        preview.setAttribute('data-color', previewColor);
      });
    });

    create.querySelectorAll('.seg button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        create.querySelectorAll('.seg button').forEach(function (b) {
          b.setAttribute('aria-pressed', 'false');
        });
        btn.setAttribute('aria-pressed', 'true');
        if (reminderText) {
          var meta = btn.getAttribute('data-meta') || 'каждый день';
          reminderText.textContent = meta.charAt(0).toUpperCase() + meta.slice(1) + ' в 08:00';
        }
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var title = nameInput.value.trim();
      if (!title) {
        err.classList.add('show');
        nameInput.focus();
        return;
      }
      var activeSeg = create.querySelector('.seg button[aria-pressed="true"]');
      var frequency = activeSeg ? (activeSeg.getAttribute('data-meta') || 'каждый день') : 'каждый день';
      var reminderOn = settings ? settings.getAttribute('aria-checked') === 'true' : true;
      var noteInput = create.querySelector('#habit-note');
      var list = load();
      list.push({
        id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        title: title,
        icon: previewIcon,
        color: previewColor,
        meta: frequency.charAt(0).toUpperCase() + frequency.slice(1) + (reminderOn ? ' · 08:00' : ''),
        note: noteInput ? noteInput.value.trim() : '',
        done: false
      });
      save(list);
      location.href = '02-today.html';
    });
  }

  /* ---------- profile: habit count stays true after creating one ---------- */
  var profile = document.querySelector('[data-od-id="profile-screen"]');
  if (profile) {
    var habitCount = profile.querySelector('[data-stat="habits"]');
    if (habitCount) habitCount.textContent = String(5 + load().length);

    var plusKey = 'habitly.plus';
    var plusActive = new URLSearchParams(location.search).get('plus') === '1';
    try {
      if (plusActive) sessionStorage.setItem(plusKey, '1');
      else plusActive = sessionStorage.getItem(plusKey) === '1';
    } catch (error) {
      /* keep the value derived from the URL */
    }
    if (plusActive) {
      var plusPill = profile.querySelector('.pill-plus');
      if (plusPill) {
        plusPill.textContent = 'Активен';
        plusPill.classList.add('is-active');
      }
    }
  }

  /* ---------- paywall: plan choice ---------- */
  var paywall = document.querySelector('[data-screen="paywall"]');
  if (paywall) {
    var plans = [].slice.call(paywall.querySelectorAll('.plan'));
    var terms = paywall.querySelector('.micro[data-terms]');
    plans.forEach(function (plan) {
      plan.addEventListener('click', function () {
        plans.forEach(function (p) { p.setAttribute('aria-pressed', 'false'); });
        plan.setAttribute('aria-pressed', 'true');
        if (terms) terms.innerHTML = plan.getAttribute('data-terms');
      });
    });
  }
})();
