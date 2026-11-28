// Draws the screens from the design export. It reads only the View (see core/contract.js) and the app's
// device status. Text from the camera, the user or the cloud is always inserted as text, never as HTML.
import { render as sentence } from '../core/templates.js';

const PATHS = {
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  micOff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 11.5 5.3M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18"/>',
  torch: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  warning: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  left: '<path d="M19 12H5M12 5l-7 7 7 7"/>',
  right: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  flip: '<path d="M12 3v18M16 7l5 5-5 5V7zM8 7l-5 5 5 5V7z"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
};

function icon(name, size = 24, className = '') {
  const holder = document.createElement('template');
  holder.innerHTML = `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
  return holder.content.firstChild;
}

export function h(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));

export function createRenderer({ onAction }) {
  const $ = (id) => document.getElementById(id);
  const button = (key, label, variant = 'secondary', extra = {}) => h('button', { type: 'button', class: `btn ${variant}`, 'data-key': key, onclick: () => onAction(key), ...extra }, label);

  const card = (...children) => h('div', { class: 'card' }, ...children);
  const caps = (text) => h('div', { class: 'caps' }, text);
  const said = (view) => h('div', { class: 'spoken' }, view.spoken);

  function tiles(view, t) {
    if (!view.tiles) return [];
    const { expiry, expiryPrinted, count } = view.tiles;
    const tile = (label, value, detail, highlight) => h('div', { class: `tile${highlight ? ' highlight' : ''}` },
      h('dt', {}, label), h('dd', {}, value, detail ? h('span', { class: 'tile-detail' }, detail) : null));
    // As in the design export, the medicine name is on the camera chip.
    return [h('dl', { class: 'tiles' },
      tile(t.expiryTile, expiry ?? t.notRead, expiryPrinted, true),
      tile(t.countTile, count ?? t.notCounted, null, false))];
  }

  function riskCard(view, t) {
    if (!view.risk) return null;
    return h('div', { class: 'card risk' },
      h('div', { class: 'risk-question' }, sentence({ id: 'risk.question' }, view.lang)),
      h('div', { class: 'row' }, button('yes', t.yes, 'primary big'), button('no_repeat', t.noRepeat, 'secondary big')),
      h('div', { class: 'small' }, t.repeatNote));
  }

  function micBlock(view, ui, t, paused) {
    const label = paused ? t.pausedBody : t.micLabel;
    const status = paused ? t.stillListening : ui.partial ? fill(t.heard, { text: ui.partial }) : ui.muted ? t.muted : t.waiting;
    return [
      h('button', { type: 'button', class: 'mic-button', 'data-key': 'mic', 'aria-label': label, onclick: () => onAction(paused ? 'continue' : 'mic') }, icon(paused ? 'pause' : 'mic', 110)),
      h('div', { class: 'status', role: 'status' }, status),
    ];
  }

  const notices = (ui, t) => ui.notices.map((key) => h('div', { class: 'notice', role: 'status' }, t[key]));

  const home = {
    1: (view, ui, t) => [...micBlock(view, ui, t), button('mute', ui.muted ? t.unmute : t.mute, 'secondary small-button', { 'aria-pressed': String(ui.muted) })],
    '1b': (view, ui, t) => [
      h('div', { class: 'card soft centred' }, h('div', { class: 'lead' }, t.finishTitle), h('div', { class: 'sub' }, t.finishBody)),
      ...micBlock(view, ui, t),
    ],
    '5d': (view, ui, t) => [
      h('div', { class: 'card soft centred' }, h('div', { class: 'lead' }, sentence({ id: 'paused' }, view.lang)), h('div', { class: 'sub' }, t.pausedBody)),
      ...micBlock(view, ui, t, true),
      h('div', { class: 'row narrow' }, button('continue', t.continue, 'primary big'), button('start_over', t.startOver, 'secondary big')),
    ],
  };

  function answerScreen(view, ui, t) {
    return [
      view.asked ? h('div', { class: 'asked' }, fill(t.youAsked, { text: view.asked })) : null,
      card(said(view)),
      ...tiles(view, t),
      view.tiles ? h('div', { class: 'note' }, t.labelNote) : null,
      riskCard(view, t),
    ];
  }

  function warningScreen(view, ui, t) {
    const emergency = view.tone === 'emergency';
    return [
      view.asked ? h('div', { class: 'asked' }, fill(t.youAsked, { text: view.asked })) : null,
      h('div', { class: 'alert' },
        h('div', { class: 'alert-label' }, icon('warning', 32), emergency ? t.emergencyLabel : t.expiredLabel),
        h('div', { class: 'alert-text' }, view.spoken)),
      view.dial ? h('a', { class: 'btn primary big call', href: `tel:${view.dial}`, 'data-key': 'call' }, t.call108) : null,
      emergency ? null : h('div', { class: 'note' }, t.expiredNote),
      ...tiles(view, t),
      riskCard(view, t),
    ];
  }

  const task = {
    reading: (view, ui, t) => [
      view.asked ? h('div', { class: 'asked' }, fill(t.youAsked, { text: view.asked })) : null,
      h('h1', { role: 'status' }, t.reading),
      card(h('div', { class: 'lead' }, t.readingHint)),
      h('div', { class: 'card note' }, t.cleanNote),
    ],
    2: (view, ui, t) => [
      h('h1', {}, t.heardTitle),
      h('div', { class: 'card waveform', 'aria-hidden': 'true' }, [30, 70, 46, 84, 54, 78, 36, 64, 28].map((height) => h('span', { style: `height:${height}px` }))),
      card(caps(t.voaiSays), said(view)),
      h('ol', { class: 'steps' }, [t.step1, t.step2, t.step3].map((text, i) => h('li', { class: i < view.step ? 'done' : '' }, h('span', { class: 'step-number' }, String(i + 1)), text))),
      ...tiles(view, t),
    ],
    3: answerScreen,
    4: warningScreen,
    5: (view, ui, t) => [
      h('h1', {}, view.cue === 'show_strip' ? t.stripTitle : t.cantReadTitle),
      card(said(view)),
      view.cue === 'show_strip' ? null : h('div', { class: 'card note' }, t.cleanNote),
      retryButtons(view, t),
    ],
    '5b': (view, ui, t) => [
      h('h1', {}, view.final ? t.checkTitle : t.anotherSideTitle),
      card(said(view)),
      card(
        h('div', { class: 'dots', 'aria-hidden': 'true' }, [1, 2, 3].map((n) => h('span', { class: n <= view.attempt ? 'filled' : '' }))),
        view.final ? null : h('div', { class: 'small' }, fill(t.attemptOf, { n: view.attempt }))),
      retryButtons(view, t),
    ],
    '5c': (view, ui, t) => [
      h('h1', {}, t.holdStillTitle),
      card(said(view), h('div', { class: 'lead' }, t.photoHint)),
      h('div', { class: 'dots', 'aria-hidden': 'true' }, [1, 2, 3].map((n) => h('span', { class: n <= view.attempt ? 'filled' : '' }))),
      h('div', { class: 'small' }, fill(t.attemptOf, { n: view.attempt })),
    ],
  };

  function retryButtons(view, t) {
    if (view.final || view.cue === 'show_strip') return null;
    return h('div', { class: 'row' }, button('take_photo', t.takePhoto, 'primary big'), button('later', t.comeBackLater, 'secondary big'));
  }

  function toggle(key, title, hint, on, t, extra) {
    return h('div', { class: 'setting' },
      h('div', {}, h('div', { class: 'setting-title', id: `${key}-title` }, title), h('div', { class: 'setting-hint' }, hint), extra),
      h('button', { type: 'button', class: `toggle${on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(on), 'aria-labelledby': `${key}-title`, 'data-key': key, onclick: () => onAction(key) },
        h('span', { class: 'knob' }), h('span', { class: 'sr-only' }, on ? t.on : t.off)));
  }

  function settingsScreen(view, ui, t) {
    const rate = ui.settings.speechRate;
    return [
      h('section', { class: 'card settings-card' },
        h('div', { class: 'speed-head' }, h('div', { class: 'setting-title' }, t.speed), h('div', { class: 'speed-value' }, `${rate.toFixed(2).replace(/0$/, '')}×`)),
        h('div', { class: 'speed-row' },
          button('slower', '−', 'secondary square', { 'aria-label': t.slower }),
          h('div', { class: 'track', 'aria-hidden': 'true' }, h('div', { style: `width:${((rate - 0.5) / 1) * 100}%` })),
          button('faster', '+', 'secondary square', { 'aria-label': t.faster })),
        button('sample', t.hearSample, 'outline big')),
      h('section', { class: 'card settings-card' },
        toggle('cloudHelp', t.cloudHelp, t.cloudHint, ui.settings.cloudHelp, t, ui.keyNotSet ? h('div', { class: 'notice', role: 'status' }, t.keyNotSet) : null),
        toggle('alwaysListening', t.alwaysListening, t.alwaysHint, ui.settings.alwaysListening, t),
        toggle('torchAtStart', t.torchAtStart, t.torchHint, ui.settings.torchAtStart, t)),
    ];
  }

  function header(view, ui, t) {
    if (view.screen === '6') {
      return [h('div', { class: 'title-row' }, h('button', { type: 'button', class: 'back-button', 'aria-label': t.back, 'data-key': 'back', onclick: () => onAction('back') }, icon('back', 28)), h('h1', {}, t.settings))];
    }
    return [
      h('div', { class: 'wordmark' }, 'VoAI ', ['1', '1b', '5d'].includes(view.screen) ? null : h('span', { class: 'wordmark-sub' }, t.subtitle)),
      h('button', { type: 'button', class: 'pill', 'data-key': 'open_settings', onclick: () => onAction('open_settings') }, t.settings),
    ];
  }

  function nav(view, ui, t) {
    const back = button('back', `‹ ${t.back}`, 'outline');
    const startOver = button('start_over', t.startOver, 'primary');
    const hint = (text) => h('div', { class: 'hint' }, text);
    if (['1', '1b', '5d'].includes(view.screen)) return [hint(t.hintHome)];
    if (view.screen === '6') return [back, hint(t.hintBack)];
    return [back, startOver, hint(t.hintBack)];
  }

  // The camera pane is never re-created, so the preview keeps running on every screen.
  function cameraPane(view, ui, t) {
    $('camera').setAttribute('aria-label', t.cameraLabel);
    $('camera').classList.toggle('warn', view.tone === 'warn' || view.tone === 'emergency');
    const chip = view.screen === 'reading' ? t.reading
      : view.screen === '4' && view.tiles?.expiryPrinted && view.tone === 'warn' ? fill(t.chipExpiry, { date: view.tiles.expiryPrinted })
      : view.screen === '5c' ? t.chipPhoto
        : ['5', '5b'].includes(view.screen) && view.attempt ? fill(t.chipAttempt, { n: view.attempt })
          : view.tiles?.name ? fill(t.chipName, { name: view.tiles.name })
            : ui.cameraState === 'on' ? t.cameraOn : t.cameraOff;
    $('chip').textContent = chip;

    const overlay = [];
    if (view.screen === '5' && view.direction) overlay.push(icon(view.direction, 56, `arrow arrow-${view.direction}`));
    if (view.screen === '5b' && view.cue === 'turn_over' && !view.final) overlay.push(icon('flip', 72, 'arrow arrow-left'), icon('rotate', 72, 'arrow arrow-right'));
    if (view.screen === '5c') overlay.push(h('div', { class: 'frame' }), view.countdown ? h('div', { class: 'countdown', role: 'timer' }, String(view.countdown)) : null);
    $('overlay').replaceChildren(...overlay.filter(Boolean));

    $('controls').replaceChildren(
      h('button', { type: 'button', class: 'btn control', 'data-key': 'torch', 'aria-pressed': String(ui.torchOn), onclick: () => onAction('torch') }, icon('torch'), ui.torchOn ? t.torchOnLabel : t.torch),
      h('button', { type: 'button', class: 'btn control', 'data-key': 'mute', 'aria-pressed': String(ui.muted), onclick: () => onAction('mute') }, icon(ui.muted ? 'micOff' : 'mic'), ui.muted ? t.unmute : t.mute),
      button('back_to_answer', t.backToAnswer, 'control phone-only'));
  }

  function draw(view, ui, t) {
    const focused = document.activeElement?.dataset?.key;
    const isHome = view.screen in home;
    document.documentElement.lang = view.lang;
    document.body.dataset.screen = view.screen;
    document.body.dataset.panel = ui.panel;
    $('header').replaceChildren(...header(view, ui, t));
    $('main').className = isHome ? 'home' : view.screen === '6' ? 'settings' : 'panes';
    cameraPane(view, ui, t);
    $('assistant').setAttribute('aria-label', t.assistantLabel);
    const body = isHome ? home[view.screen](view, ui, t) : view.screen === '6' ? settingsScreen(view, ui, t) : task[view.screen](view, ui, t);
    const showCamera = isHome || view.screen === '6' ? null : button('show_camera', t.showCamera, 'secondary phone-only');
    $('assistant').replaceChildren(...[...notices(ui, t), ...body, showCamera].filter(Boolean));
    $('nav').setAttribute('aria-label', t.voiceNav);
    $('nav').replaceChildren(...nav(view, ui, t));
    // One persistent live region, so each new answer is announced once.
    const announce = $('announce');
    announce.setAttribute('aria-live', view.tone === 'warn' || view.tone === 'emergency' ? 'assertive' : 'polite');
    if (announce.textContent !== view.spoken) announce.textContent = view.spoken;
    if (focused) document.querySelector(`[data-key="${focused}"]`)?.focus();
  }

  return { draw };
}
