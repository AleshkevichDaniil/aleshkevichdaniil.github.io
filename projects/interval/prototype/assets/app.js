/* Interval — многостраничный прототип: состояние, таймер, история, подписка. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const REF = new Date(2026, 10, 22, 18, 42);
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const WEEK = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];

  const PRESETS = {
    tabata: { name: 'Табата 20/10', work: 20, rest: 10, rounds: 8, prep: 10 },
    emom: { name: 'EMOM 10', work: 60, rest: 0, rounds: 10, prep: 0 },
    hiit: { name: 'HIIT 40/20', work: 40, rest: 20, rounds: 6, prep: 10 },
    ladder: { name: 'Лестница 30/15', work: 30, rest: 15, rounds: 12, prep: 10 },
    custom: { name: 'Своя тренировка', work: 30, rest: 15, rounds: 8, prep: 10 }
  };

  const LIMITS = {
    work: { min: 5, max: 300, step: 5 },
    rest: { min: 0, max: 300, step: 5 },
    rounds: { min: 1, max: 30, step: 1 },
    prep: { min: 0, max: 30, step: 5 }
  };

  const SEED_HISTORY = [
    { name: 'Табата 20/10', date: '2026-11-22', dur: 240, meta: '8 раундов · 20/10 с' },
    { name: 'HIIT 40/20', date: '2026-11-20', dur: 350, meta: '6 раундов · 40/20 с' },
    { name: 'EMOM 10', date: '2026-11-18', dur: 600, meta: '10 раундов · 60 с работы' },
    { name: 'Лестница 30/15', date: '2026-11-16', dur: 535, meta: '12 раундов · 30/15 с' }
  ];

  const KEY_SESSION = 'interval.session.v2';
  const KEY_RESULT = 'interval.result.v2';
  const KEY_HISTORY = 'interval.history.v2';
  const KEY_PRO = 'interval.pro.v2';

  const LOCAL_STORE = (() => {
    try { return window.localStorage; } catch (error) { return null; }
  })();

  const SESSION_STORE = (() => {
    try { return window.sessionStorage; } catch (error) { return null; }
  })();

  /* ===== Утилиты ===== */

  const fmt = (sec) => {
    const value = Math.max(0, Math.round(sec));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };

  const fmtDial = (sec) => {
    const value = Math.max(0, Math.round(sec));
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  };

  const plural = (n, forms) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
    return forms[2];
  };

  const escapeHTML = (str) => String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const dateLabel = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  const refDateLabel = () => `${REF.getDate()} ${MONTHS[REF.getMonth()]}, ${String(REF.getHours()).padStart(2, '0')}:${String(REF.getMinutes()).padStart(2, '0')}`;

  const readJSON = (store, key) => {
    if (!store) return null;
    try {
      const raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };

  const writeJSON = (store, key, value) => {
    if (!store) return;
    try { store.setItem(key, JSON.stringify(value)); } catch (error) { /* no-op */ }
  };

  const removeKey = (store, key) => {
    if (!store) return;
    try { store.removeItem(key); } catch (error) { /* no-op */ }
  };

  /* ===== Конфигурация и фазы ===== */

  const buildPhases = (cfg) => {
    const phases = [];
    if (cfg.prep > 0) phases.push({ type: 'prep', dur: cfg.prep, round: 0 });
    for (let r = 1; r <= cfg.rounds; r += 1) {
      phases.push({ type: 'work', dur: cfg.work, round: r });
      if (cfg.rest > 0 && r < cfg.rounds) phases.push({ type: 'rest', dur: cfg.rest, round: r });
    }
    return phases;
  };

  const totalOf = (cfg) => buildPhases(cfg).reduce((sum, phase) => sum + phase.dur, 0);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const configFromParams = (params) => {
    const preset = params.get('preset');
    if (preset && PRESETS[preset]) return { ...PRESETS[preset] };

    const hasExplicit = ['work', 'rest', 'rounds', 'prep'].some((key) => params.has(key));
    if (!hasExplicit) return { ...PRESETS.tabata };

    const number = (key, min, max, fallback) => {
      const value = Number(params.get(key));
      return Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback;
    };

    return {
      name: (params.get('name') || 'Своя тренировка').slice(0, 24),
      work: number('work', 5, 300, 30),
      rest: number('rest', 0, 300, 15),
      rounds: number('rounds', 1, 30, 8),
      prep: number('prep', 0, 30, 10)
    };
  };

  const timerUrl = (cfg) => {
    const params = new URLSearchParams();
    params.set('name', cfg.name);
    params.set('work', cfg.work);
    params.set('rest', cfg.rest);
    params.set('rounds', cfg.rounds);
    params.set('prep', cfg.prep);
    params.set('fresh', '1');
    return `timer.html?${params.toString()}`;
  };

  /* ===== Хранилище ===== */

  const getHistory = () => {
    const stored = readJSON(LOCAL_STORE, KEY_HISTORY);
    return Array.isArray(stored) && stored.length ? stored : SEED_HISTORY.map((entry) => ({ ...entry }));
  };

  const addHistory = (result) => {
    const list = getHistory();
    const meta = result.cfg.rest > 0
      ? `${result.roundsDone} ${plural(result.roundsDone, ['раунд', 'раунда', 'раундов'])} · ${result.cfg.work}/${result.cfg.rest} с`
      : `${result.roundsDone} ${plural(result.roundsDone, ['раунд', 'раунда', 'раундов'])} · ${result.cfg.work} с работы`;

    list.unshift({
      name: result.name,
      date: result.dateIso,
      dur: result.dur,
      meta
    });

    writeJSON(LOCAL_STORE, KEY_HISTORY, list);
  };

  const getPro = () => readJSON(LOCAL_STORE, KEY_PRO) === true;
  const setPro = () => writeJSON(LOCAL_STORE, KEY_PRO, true);

  const getSession = () => {
    const session = readJSON(SESSION_STORE, KEY_SESSION);
    if (!session || !session.cfg || !Array.isArray(session.phases)) return null;
    if (Date.now() - (session.savedAt || 0) > 6 * 60 * 60 * 1000) return null;
    return session;
  };

  const saveSession = (session) => {
    session.savedAt = Date.now();
    writeJSON(SESSION_STORE, KEY_SESSION, session);
  };

  const clearSession = () => removeKey(SESSION_STORE, KEY_SESSION);

  /* ===== Неделя ===== */

  const weekStats = (entries) => {
    const totals = WEEK.map((day) => entries
      .filter((entry) => entry.date === day)
      .reduce((sum, entry) => sum + entry.dur, 0));
    const weekEntries = entries.filter((entry) => WEEK.includes(entry.date));
    const total = weekEntries.reduce((sum, entry) => sum + entry.dur, 0);
    const avg = weekEntries.length ? Math.round(total / weekEntries.length) : 0;
    return { totals, entries: weekEntries, total, avg };
  };

  /* ===== Сессия и итоги ===== */

  const createSession = (cfg) => {
    const phases = buildPhases(cfg);
    return {
      cfg: { ...cfg },
      phases,
      i: 0,
      remaining: phases[0].dur,
      elapsed: 0,
      work: 0,
      rest: 0,
      roundsDone: 0,
      completed: [],
      running: true,
      paused: false,
      savedAt: Date.now()
    };
  };

  const resultFromSession = (session) => ({
    name: session.cfg.name,
    cfg: { ...session.cfg },
    dateIso: '2026-11-22',
    dateLabel: refDateLabel(),
    dur: session.elapsed,
    work: session.work,
    rest: session.rest,
    rounds: session.cfg.rounds,
    roundsDone: session.roundsDone,
    intervals: session.completed.filter((phase) => phase.type !== 'prep').length,
    phases: session.completed.map((phase) => ({ ...phase })),
    saved: false
  });

  const demoResult = () => {
    const cfg = { name: 'Спринт 40/20', work: 40, rest: 20, rounds: 8, prep: 10 };
    return {
      name: cfg.name,
      cfg,
      dateIso: '2026-11-21',
      dateLabel: '21 ноября, 19:20',
      dur: 470,
      work: 320,
      rest: 140,
      rounds: 8,
      roundsDone: 8,
      intervals: 15,
      phases: buildPhases(cfg),
      saved: false
    };
  };

  /* ===== Таймер ===== */

  const initTimer = () => {
    const params = new URLSearchParams(window.location.search);
    const fresh = params.get('fresh') === '1';
    const skipRequested = params.get('skip') === '1';
    let session = getSession();

    if (fresh) {
      clearSession();
      session = null;
      const url = new URL(window.location.href);
      url.searchParams.delete('fresh');
      url.searchParams.delete('skip');
      try {
        window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      } catch (error) { /* no-op */ }
    }

    if (skipRequested) {
      const url = new URL(window.location.href);
      url.searchParams.delete('skip');
      try {
        window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      } catch (error) { /* no-op */ }
    }

    if (!session || session.finished) session = createSession(configFromParams(params));

    session.running = true;
    session.paused = false;
    saveSession(session);

    const ring = $('#ringProgress');
    const roundTrack = $('#roundTrack');
    const ringCirc = 2 * Math.PI * 142;
    let handle = null;

    if (ring) ring.setAttribute('stroke-dasharray', ringCirc.toFixed(2));

    const phaseName = (type) => (type === 'work' ? 'РАБОТА' : type === 'rest' ? 'ОТДЫХ' : 'ПОДГОТОВКА');

    const render = () => {
      const phase = session.phases[session.i];
      const ratio = clamp(session.remaining / phase.dur, 0, 1);
      const atStart = session.remaining === phase.dur;

      if (ring) {
        if (atStart) ring.style.transition = 'none';
        ring.setAttribute('stroke-dashoffset', (ringCirc * (1 - ratio)).toFixed(2));
        if (atStart) {
          window.requestAnimationFrame(() => { ring.style.transition = ''; });
        }
      }

      const name = $('#timerName');
      const meta = $('#timerMeta');
      if (name) name.textContent = session.cfg.name;
      if (meta) meta.textContent = `${session.cfg.rounds} ${plural(session.cfg.rounds, ['раунд', 'раунда', 'раундов'])} · ${fmt(totalOf(session.cfg))}`;

      const phaseLabel = $('#phaseLabel');
      const dialTime = $('#dialTime');
      const dialSub = $('#dialSub');
      if (phaseLabel) phaseLabel.textContent = phaseName(phase.type);
      if (dialTime) dialTime.textContent = fmtDial(session.remaining);
      if (dialSub) dialSub.textContent = phase.type === 'prep' ? 'старт через' : `раунд ${phase.round} из ${session.cfg.rounds}`;

      const next = session.phases[session.i + 1];
      const nextPhase = $('#nextPhase');
      if (nextPhase) {
        nextPhase.textContent = next
          ? `${next.type === 'work' ? 'Работа' : next.type === 'rest' ? 'Отдых' : 'Подготовка'} · ${next.dur} с`
          : 'Финиш';
      }

      if (roundTrack) {
        if (roundTrack.children.length !== session.cfg.rounds) {
          roundTrack.innerHTML = Array.from({ length: session.cfg.rounds }, () => '<span></span>').join('');
        }
        Array.from(roundTrack.children).forEach((bar, idx) => {
          const round = idx + 1;
          bar.classList.toggle('is-done', round <= session.roundsDone);
          bar.classList.toggle('is-current', phase.round === round && round > session.roundsDone);
        });
      }
    };

    const persistResult = () => {
      if (!session) return;
      writeJSON(SESSION_STORE, KEY_RESULT, resultFromSession(session));
      clearSession();
    };

    const finishToResults = () => {
      if (handle) window.clearInterval(handle);
      handle = null;
      if (session) session.finished = true;
      persistResult();
      window.location.href = 'results.html';
    };

    const completePhase = () => {
      if (!session) return;
      const phase = session.phases[session.i];
      if (phase.type === 'work') session.roundsDone += 1;
      session.completed.push({ type: phase.type, dur: phase.dur });
      session.i += 1;

      if (session.i >= session.phases.length) {
        finishToResults();
        return;
      }

      session.remaining = session.phases[session.i].dur;
      saveSession(session);
      render();
    };

    const tick = () => {
      if (!session || !session.running) return;
      const phase = session.phases[session.i];
      session.remaining -= 1;
      session.elapsed += 1;
      if (phase.type === 'work') session.work += 1;
      if (phase.type === 'rest') session.rest += 1;
      saveSession(session);

      if (session.remaining <= 0) {
        completePhase();
      } else {
        render();
      }
    };

    render();

    if (params.get('skip') === '1') {
      completePhase();
      if (!session || session.finished) return;
    }

    handle = window.setInterval(tick, 1000);

    const pauseAndSave = () => {
      if (!session) return;
      session.running = false;
      session.paused = true;
      saveSession(session);
    };

    ['#pauseTop', '#pauseBtn'].forEach((selector) => {
      const link = $(selector);
      if (link) link.addEventListener('click', pauseAndSave);
    });

    const skip = $('#skipBtn');
    if (skip) skip.addEventListener('click', completePhase);

    const finish = $('#finishBtn');
    if (finish) {
      finish.addEventListener('click', () => {
        if (handle) window.clearInterval(handle);
        handle = null;
        if (session) session.finished = true;
        persistResult();
      });
    }
  };

  /* ===== Пауза ===== */

  const createDemoPaused = () => {
    const cfg = { ...PRESETS.tabata };
    const phases = buildPhases(cfg);
    return {
      cfg,
      phases,
      i: 3,
      remaining: 14,
      elapsed: 46,
      work: 26,
      rest: 10,
      roundsDone: 1,
      completed: [phases[0], phases[1], phases[2]].map((phase) => ({ ...phase })),
      running: false,
      paused: true,
      savedAt: Date.now()
    };
  };

  const initPause = () => {
    let session = getSession();
    if (!session || session.finished) {
      session = createDemoPaused();
      saveSession(session);
    }

    const ring = $('#pauseRing');
    const ringCirc = 2 * Math.PI * 142;
    if (ring) ring.setAttribute('stroke-dasharray', ringCirc.toFixed(2));

    const phase = session.phases[session.i];
    const ratio = clamp(session.remaining / phase.dur, 0, 1);

    if (ring) ring.setAttribute('stroke-dashoffset', (ringCirc * (1 - ratio)).toFixed(2));

    const phaseLabel = $('#pausePhase');
    const time = $('#pauseTime');
    const round = $('#pauseRound');
    const workout = $('#pauseWorkout');
    const track = $('#pauseTrack');

    if (phaseLabel) phaseLabel.textContent = phase.type === 'work' ? 'РАБОТА' : phase.type === 'rest' ? 'ОТДЫХ' : 'ПОДГОТОВКА';
    if (time) time.textContent = fmtDial(session.remaining);
    if (round) round.textContent = phase.type === 'prep' ? 'перед стартом' : `раунд ${phase.round} из ${session.cfg.rounds}`;
    if (workout) workout.textContent = `${session.cfg.name} · ${fmt(totalOf(session.cfg))}`;

    if (track) {
      if (track.children.length !== session.cfg.rounds) {
        track.innerHTML = Array.from({ length: session.cfg.rounds }, () => '<span></span>').join('');
      }
      Array.from(track.children).forEach((bar, idx) => {
        const value = idx + 1;
        bar.classList.toggle('is-done', value <= session.roundsDone);
        bar.classList.toggle('is-current', phase.round === value && value > session.roundsDone);
      });
    }

    const finish = $('#finishBtn');
    if (finish) {
      finish.addEventListener('click', () => {
        writeJSON(SESSION_STORE, KEY_RESULT, resultFromSession(session));
        clearSession();
      });
    }
  };

  /* ===== Итоги ===== */

  const renderResults = (result) => {
    const dateHead = $('#resultsDateHead');
    const time = $('#resultTime');
    const name = $('#resultName');
    const badge = $('#resultRoundsBadge');
    const statWork = $('#statWork');
    const statRest = $('#statRest');
    const statRounds = $('#statRounds');
    const statIntervals = $('#statIntervals');
    const strip = $('#resultStrip');

    if (dateHead) dateHead.textContent = result.dateLabel;
    if (time) time.textContent = fmtDial(result.dur);
    if (name) name.textContent = result.name;
    if (badge) badge.textContent = `${result.roundsDone} из ${result.rounds} ${plural(result.rounds, ['раунда', 'раундов', 'раундов'])}`;
    if (statWork) statWork.textContent = fmt(result.work);
    if (statRest) statRest.textContent = fmt(result.rest);
    if (statRounds) statRounds.textContent = `${result.roundsDone} / ${result.rounds}`;
    if (statIntervals) statIntervals.textContent = String(result.intervals);

    if (strip) {
      strip.innerHTML = result.phases
        .filter((phase) => phase.type !== 'prep')
        .slice(0, 40)
        .map((phase) => (phase.type === 'work'
          ? '<span class="is-work" style="flex-grow:2"></span>'
          : '<span style="flex-grow:1"></span>'))
        .join('');
    }

    const save = $('#saveBtn');
    if (save) {
      save.disabled = Boolean(result.saved);
      save.textContent = result.saved ? 'Сохранено' : 'Сохранить в историю';
    }
  };

  const initResults = () => {
    let result = readJSON(SESSION_STORE, KEY_RESULT);
    if (!result || !result.cfg || !Array.isArray(result.phases)) result = demoResult();
    renderResults(result);

    const save = $('#saveBtn');
    if (save) {
      save.addEventListener('click', () => {
        if (result.saved) return;
        addHistory(result);
        result.saved = true;
        writeJSON(SESSION_STORE, KEY_RESULT, result);
        save.disabled = true;
        save.textContent = 'Сохранено';
        window.location.href = 'history.html?saved=1';
      });
    }

    const again = $('#againBtn');
    if (again) again.href = timerUrl(result.cfg);
  };

  /* ===== История ===== */

  const initHistory = () => {
    const entries = getHistory();
    const list = $('#historyList');
    const empty = $('#historyEmpty');
    let filter = 'all';

    const renderWeek = () => {
      const stats = weekStats(entries);
      const max = Math.max(600, ...stats.totals);
      const bars = $$('.week-bar');

      bars.forEach((bar, idx) => {
        const value = stats.totals[idx];
        const percent = value > 0 ? Math.max(6, Math.round((value / max) * 100)) : 0;
        bar.style.setProperty('--h', `${percent}%`);
        bar.classList.toggle('is-empty', value === 0);
      });

      const total = $('#weekTotal');
      const avg = $('#weekAvg');
      const count = $('#weekCount');
      if (total) total.textContent = fmt(stats.total);
      if (avg) avg.textContent = stats.entries.length ? fmt(stats.avg) : '—';
      if (count) count.textContent = `${stats.entries.length} ${plural(stats.entries.length, ['тренировка', 'тренировки', 'тренировок'])}`;
    };

    const itemHTML = (entry) => `<article class="history-item">
      <div class="history-info">
        <h3>${escapeHTML(entry.name)}</h3>
        <p><time datetime="${entry.date}">${dateLabel(entry.date)}</time> · ${escapeHTML(entry.meta)}</p>
      </div>
      <span class="history-dur num">${fmt(entry.dur)}</span>
    </article>`;

    const render = () => {
      const visible = entries
        .filter((entry) => {
          if (filter === 'short') return entry.dur < 300;
          if (filter === 'long') return entry.dur >= 300;
          return true;
        })
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

      if (list) {
        list.innerHTML = visible.map(itemHTML).join('');
        list.hidden = visible.length === 0;
      }
      if (empty) empty.classList.toggle('is-on', visible.length === 0);
      renderWeek();
    };

    $$('.filter').forEach((button) => {
      button.addEventListener('click', () => {
        filter = button.dataset.filter;
        $$('.filter').forEach((item) => item.classList.toggle('is-active', item === button));
        render();
      });
    });

    const reset = $('#resetFilter');
    if (reset) {
      reset.addEventListener('click', () => {
        filter = 'all';
        $$('.filter').forEach((item) => item.classList.toggle('is-active', item.dataset.filter === 'all'));
        render();
      });
    }

    render();

    const params = new URLSearchParams(window.location.search);
    if (params.get('saved') === '1') {
      toast('Тренировка добавлена в историю');
      const url = new URL(window.location.href);
      url.searchParams.delete('saved');
      try {
        window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      } catch (error) { /* no-op */ }
    }
  };

  /* ===== Главная ===== */

  const initHome = () => {
    const stats = weekStats(getHistory());
    const count = $('#weekNoteCount');
    const total = $('#weekNoteTotal');
    const pro = $('#mainProTag');

    if (count) count.textContent = `${stats.entries.length} ${plural(stats.entries.length, ['тренировка', 'тренировки', 'тренировок'])}`;
    if (total) total.textContent = fmt(stats.total);
    if (pro) pro.hidden = !getPro();
  };

  /* ===== Конструктор ===== */

  const initBuilder = () => {
    const params = new URLSearchParams(window.location.search);
    const preset = params.get('preset');
    let config = { ...(preset && PRESETS[preset] ? PRESETS[preset] : PRESETS.custom) };

    const nameInput = $('#configName');
    const start = $('#startCustom');
    const strip = $('#structStrip');

    const render = () => {
      Object.keys(LIMITS).forEach((key) => {
        const output = $(`#out-${key}`);
        if (!output) return;
        output.textContent = key === 'rounds' ? String(config[key]) : `${config[key]} с`;
        const stepper = output.closest('.stepper');
        if (!stepper) return;
        const buttons = $$('button', stepper);
        buttons[0].disabled = config[key] <= LIMITS[key].min;
        buttons[1].disabled = config[key] >= LIMITS[key].max;
      });

      const total = $('#totalTime');
      if (total) total.textContent = fmt(totalOf(config));

      const intervals = buildPhases(config).filter((phase) => phase.type !== 'prep');
      const count = $('#structCount');
      if (count) count.textContent = `${intervals.length} ${plural(intervals.length, ['отрезок', 'отрезка', 'отрезков'])}`;

      if (strip) {
        strip.innerHTML = intervals.map((phase) => (
          `<span class="${phase.type === 'work' ? 'is-work' : ''}" style="flex-grow:${Math.max(1, phase.dur)}"></span>`
        )).join('');
      }

      $$('.chip[data-fill]').forEach((chip) => {
        const item = PRESETS[chip.dataset.fill];
        const match = item && ['work', 'rest', 'rounds', 'prep'].every((key) => item[key] === config[key]);
        chip.classList.toggle('is-on', Boolean(match));
      });

      if (start) start.href = timerUrl(config);
    };

    const setConfig = (next) => {
      config = { ...next };
      if (nameInput) nameInput.value = next.name;
      render();
    };

    if (nameInput) {
      nameInput.addEventListener('input', () => {
        config.name = nameInput.value.trim() || 'Своя тренировка';
        render();
      });
      nameInput.addEventListener('blur', () => {
        if (!nameInput.value.trim()) {
          nameInput.value = 'Своя тренировка';
          config.name = nameInput.value;
          render();
        }
      });
    }

    $$('.chip[data-fill]').forEach((chip) => {
      chip.addEventListener('click', () => setConfig(PRESETS[chip.dataset.fill]));
    });

    $$('[data-step]').forEach((button) => {
      button.addEventListener('click', () => {
        const field = button.dataset.step;
        const limit = LIMITS[field];
        if (!limit) return;
        config[field] = clamp(config[field] + Number(button.dataset.dir) * limit.step, limit.min, limit.max);
        render();
      });
    });

    const reset = $('#resetConfig');
    if (reset) {
      reset.addEventListener('click', () => {
        setConfig(PRESETS.custom);
        toast('Параметры сброшены');
      });
    }

    render();
  };

  /* ===== Подписка ===== */

  const initPaywall = () => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from') === 'history' ? 'history.html' : 'home.html';
    const close = $('#closePaywall');
    const continueLink = $('#proContinue');
    const buy = $('#buyBtn');
    const layer = $('#proLayer');

    if (close) close.href = from;
    if (continueLink) continueLink.href = from;

    if (getPro()) {
      if (buy) {
        buy.textContent = 'Pro уже активен';
        buy.addEventListener('click', () => { window.location.href = from; });
      }
    } else if (buy && layer) {
      buy.addEventListener('click', () => {
        layer.hidden = false;
        if (continueLink) continueLink.focus({ preventScroll: true });
      });
      if (continueLink) {
        continueLink.addEventListener('click', () => setPro());
      }
    }

    const restore = $('#restoreBtn');
    if (restore) {
      restore.addEventListener('click', () => {
        toast(getPro() ? 'Pro уже активен' : 'Действующих покупок нет');
      });
    }
  };

  /* ===== Toast ===== */

  let toastHandle = null;

  function toast(message) {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('is-on');
    window.clearTimeout(toastHandle);
    toastHandle = window.setTimeout(() => element.classList.remove('is-on'), 2600);
  }

  /* ===== Масштаб страницы ===== */

  const fitStage = () => {
    const page = $('.page');
    if (!page) return;
    const stacked = window.innerWidth <= 760;
    let scale = stacked
      ? Math.min(1, (window.innerWidth - 32) / 390)
      : Math.min(1, (window.innerHeight - 110) / 844);
    scale = Math.max(0.5, scale);
    page.style.setProperty('--s', scale.toFixed(4));
  };

  /* ===== Запуск ===== */

  const page = document.body.dataset.screen;

  if (page) {
    fitStage();
    window.addEventListener('resize', fitStage);

    const init = {
      onboarding: () => {},
      home: initHome,
      builder: initBuilder,
      timer: initTimer,
      pause: initPause,
      results: initResults,
      history: initHistory,
      paywall: initPaywall
    }[page];

    if (init) init();
  }
})();
