/* Pure state helpers shared by the approved browser extension and Node tests. */
const ConvoViewerState = (() => {
  "use strict";

  const SCHEMA_VERSION = 1;
  const SUPPORTED_ENGINE_VERSIONS = Object.freeze([]);
  const MAX_PRESETS = 40;
  const MAX_PRESET_NAME_LENGTH = 40;
  const PRESET_FILE_KIND = "marinara.conversation-viewer-presets";
  const PRESET_FILE_VERSION = 1;
  const MAX_ROOMS = 500;
  const SAFE_CHAT_ID = /^[A-Za-z0-9_-]{1,256}$/u;
  const SAFE_COLOR = /^#[0-9a-f]{3,8}$/iu;
  const UNSAFE_FONT_CONTROL = /[\u0000-\u001F\u007F]/u;
  const SAFE_BACKGROUND_REF = /^\/(?:api\/backgrounds\/file\/|api\/game-assets\/file\/)[^\s"'()]+$/u;
  const BORDER_MODES = ["theme", "none", "custom"];
  const BORDER_STYLES = ["solid", "dotted", "dashed"];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, fallback, min, max) {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? Math.min(max, Math.max(min, Math.round(numeric))) : fallback;
  }

  function clampTenth(value, fallback, min, max) {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? Math.min(max, Math.max(min, Math.round(numeric * 10) / 10)) : fallback;
  }

  function cleanColor(value) {
    return typeof value === "string" && SAFE_COLOR.test(value.trim()) ? value.trim() : null;
  }

  function cleanFontFamily(value) {
    const font = typeof value === "string" ? value.trim() : "";
    return font && font.length <= 120 && !UNSAFE_FONT_CONTROL.test(font) ? font : null;
  }

  function cleanImageRef(value) {
    return typeof value === "string" && SAFE_BACKGROUND_REF.test(value) ? value : null;
  }

  function defaultRoomSettings() {
    return {
      enabled: true,
      theme: {
        ownBubbleColor: null,
        otherBubbleColor: null,
        ownTextColor: null,
        otherTextColor: null,
        ownBubbleBorderMode: "theme",
        ownBubbleBorderColor: null,
        ownBubbleBorderStyle: "solid",
        ownBubbleBorderWidthPt: 1,
        otherBubbleBorderMode: "theme",
        otherBubbleBorderColor: null,
        otherBubbleBorderStyle: "solid",
        otherBubbleBorderWidthPt: 1,
        bubbleShape: "round",
        splitBubbles: false,
      },
      text: { fontFamily: null, fontSizePx: 18, applyFontToInput: false },
      background: { color: null, imageRef: null, imageOpacity: 100, topBarHidden: false, hideCharacterAvatars: false },
    };
  }

  function cleanRoomSettings(value) {
    const input = value && typeof value === "object" ? value : {};
    const theme = input.theme && typeof input.theme === "object" ? input.theme : {};
    const text = input.text && typeof input.text === "object" ? input.text : {};
    const background = input.background && typeof input.background === "object" ? input.background : {};
    return {
      enabled: input.enabled !== false,
      theme: {
        ownBubbleColor: cleanColor(theme.ownBubbleColor),
        otherBubbleColor: cleanColor(theme.otherBubbleColor),
        ownTextColor: cleanColor(theme.ownTextColor),
        otherTextColor: cleanColor(theme.otherTextColor),
        ownBubbleBorderMode: theme.ownBubbleBorderMode === "color" ? "custom" : (BORDER_MODES.includes(theme.ownBubbleBorderMode) ? theme.ownBubbleBorderMode : "theme"),
        ownBubbleBorderColor: cleanColor(theme.ownBubbleBorderColor),
        ownBubbleBorderStyle: BORDER_STYLES.includes(theme.ownBubbleBorderStyle) ? theme.ownBubbleBorderStyle : "solid",
        ownBubbleBorderWidthPt: clampTenth(theme.ownBubbleBorderWidthPt, 1, 0.1, 10),
        otherBubbleBorderMode: theme.otherBubbleBorderMode === "color" ? "custom" : (BORDER_MODES.includes(theme.otherBubbleBorderMode) ? theme.otherBubbleBorderMode : "theme"),
        otherBubbleBorderColor: cleanColor(theme.otherBubbleBorderColor),
        otherBubbleBorderStyle: BORDER_STYLES.includes(theme.otherBubbleBorderStyle) ? theme.otherBubbleBorderStyle : "solid",
        otherBubbleBorderWidthPt: clampTenth(theme.otherBubbleBorderWidthPt, 1, 0.1, 10),
        bubbleShape: theme.bubbleShape === "square" || theme.bubbleShape === "droplet" ? theme.bubbleShape : "round",
        splitBubbles: theme.splitBubbles === true,
      },
      text: { fontFamily: cleanFontFamily(text.fontFamily), fontSizePx: clamp(text.fontSizePx, 18, 12, 32), applyFontToInput: text.applyFontToInput === true },
      background: {
        color: cleanColor(background.color),
        imageRef: cleanImageRef(background.imageRef),
        imageOpacity: clamp(background.imageOpacity, 100, 0, 100),
        topBarHidden: background.topBarHidden === true,
        hideCharacterAvatars: background.hideCharacterAvatars === true,
      },
    };
  }

  function normalizePreset(value, index) {
    if (!value || typeof value !== "object") return null;
    const name = typeof value.name === "string" ? value.name.trim() : "";
    if (!name || name.length > MAX_PRESET_NAME_LENGTH) return null;
    const id = typeof value.id === "string" && /^[A-Za-z0-9_-]{6,80}$/u.test(value.id) ? value.id : `preset-${index + 1}`;
    const includeBackgroundImageRef = value.includeBackgroundImageRef === true;
    const settings = cleanRoomSettings(value.settings);
    if (!includeBackgroundImageRef) settings.background.imageRef = null;
    return { id, name, includeBackgroundImageRef, settings };
  }

  function normalizeState(value) {
    const input = value && typeof value === "object" ? value : {};
    const roomsInput = input.rooms && typeof input.rooms === "object" ? input.rooms : {};
    const rooms = {};
    for (const [chatId, settings] of Object.entries(roomsInput).slice(0, MAX_ROOMS)) {
      if (SAFE_CHAT_ID.test(chatId)) rooms[chatId] = cleanRoomSettings(settings);
    }
    const seenNames = new Set();
    const presets = [];
    for (const [index, value] of (Array.isArray(input.presets) ? input.presets : []).entries()) {
      const preset = normalizePreset(value, index);
      const key = preset?.name.toLocaleLowerCase();
      if (!preset || seenNames.has(key) || presets.length >= MAX_PRESETS) continue;
      seenNames.add(key);
      presets.push(preset);
    }
    return { schemaVersion: SCHEMA_VERSION, engineCompatibility: [...SUPPORTED_ENGINE_VERSIONS], rooms, presets };
  }

  function nextPresetId(presets) {
    let index = presets.length + 1;
    const used = new Set(presets.map((preset) => preset.id));
    while (used.has(`preset-${index}`)) index += 1;
    return `preset-${index}`;
  }

  function addPreset(state, name, settings, includeBackgroundImageRef) {
    const next = normalizeState(state);
    const cleanName = typeof name === "string" ? name.trim() : "";
    if (!cleanName || cleanName.length > MAX_PRESET_NAME_LENGTH) throw new Error("프리셋 이름은 1~40자로 입력해 주세요.");
    if (next.presets.some((preset) => preset.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) throw new Error("같은 이름의 프리셋이 이미 있습니다.");
    if (next.presets.length >= MAX_PRESETS) throw new Error(`프리셋은 최대 ${MAX_PRESETS}개까지 저장할 수 있습니다.`);
    const saved = cleanRoomSettings(settings);
    if (includeBackgroundImageRef !== true) saved.background.imageRef = null;
    const preset = { id: nextPresetId(next.presets), name: cleanName, includeBackgroundImageRef: includeBackgroundImageRef === true, settings: saved };
    next.presets.push(preset);
    return { state: next, preset };
  }

  function updatePreset(state, id, settings, includeBackgroundImageRef) {
    const next = normalizeState(state);
    const preset = next.presets.find((candidate) => candidate.id === id);
    if (!preset) throw new Error("선택한 프리셋을 찾을 수 없습니다.");
    preset.includeBackgroundImageRef = includeBackgroundImageRef === true;
    preset.settings = cleanRoomSettings(settings);
    if (!preset.includeBackgroundImageRef) preset.settings.background.imageRef = null;
    return next;
  }

  function renamePreset(state, id, name) {
    const next = normalizeState(state);
    const preset = next.presets.find((candidate) => candidate.id === id);
    if (!preset) throw new Error("선택한 프리셋을 찾을 수 없습니다.");
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed || trimmed.length > MAX_PRESET_NAME_LENGTH) throw new Error("프리셋 이름은 1~40자로 입력해 주세요.");
    if (next.presets.some((candidate) => candidate.id !== id && candidate.name.localeCompare(trimmed, undefined, { sensitivity: "accent" }) === 0)) {
      throw new Error("같은 이름의 프리셋이 이미 있습니다.");
    }
    preset.name = trimmed;
    return next;
  }

  function deletePreset(state, id) {
    const next = normalizeState(state);
    const index = next.presets.findIndex((preset) => preset.id === id);
    if (index < 0) throw new Error("선택한 프리셋을 찾을 수 없습니다.");
    next.presets.splice(index, 1);
    return next;
  }

  function applyPreset(preset) {
    if (!preset || typeof preset !== "object") throw new Error("선택한 프리셋을 찾을 수 없습니다.");
    return cleanRoomSettings(preset.settings);
  }

  function exportPresets(state) {
    const normalized = normalizeState(state);
    return {
      kind: PRESET_FILE_KIND,
      version: PRESET_FILE_VERSION,
      presets: normalized.presets,
    };
  }

  function importPresets(state, value) {
    if (!value || typeof value !== "object" || value.kind !== PRESET_FILE_KIND || value.version !== PRESET_FILE_VERSION || !Array.isArray(value.presets)) {
      throw new Error("콘보모드 뷰어 설정에서 내려받은 프리셋 파일만 가져올 수 있습니다.");
    }
    let next = normalizeState(state);
    let imported = 0;
    let skipped = 0;
    for (const preset of value.presets) {
      const name = typeof preset?.name === "string" ? preset.name.trim() : "";
      try {
        const added = addPreset(next, name, preset?.settings, preset?.includeBackgroundImageRef === true);
        next = added.state;
        imported += 1;
      } catch {
        skipped += 1;
      }
    }
    return { state: next, imported, skipped };
  }

  return Object.freeze({ SUPPORTED_ENGINE_VERSIONS, MAX_PRESETS, PRESET_FILE_KIND, PRESET_FILE_VERSION, defaultRoomSettings, cleanFontFamily, cleanRoomSettings, normalizeState, addPreset, updatePreset, renamePreset, deletePreset, applyPreset, exportPresets, importPresets, clone });
})();


/* Inserted by Marinara into the approved asynchronous full-page extension callback. */
const ROOT_ID = "mari-convo-viewer-root";
const TRIGGER_SELECTOR = "[data-mari-convo-viewer-trigger]";
const INSTANCE_KEY = "__marinaraConvoViewerInstance";
const SETTINGS_KEY = "convoViewerSettings";
const SPLIT_SOURCE_ATTR = "data-mari-convo-viewer-split-source";
const SPLIT_DISPLAY_CLASS = "mari-convo-viewer-split-display";
const SPLIT_BUBBLE_CLASS = "mari-convo-viewer-split-bubble";
const MESSAGE_CONTAINER_SELECTOR = '.mari-message-user, .mari-message-assistant, [data-component="ConversationMessage.Grouped"][data-message-role="user"], [data-component="ConversationMessage.Grouped"][data-message-role="assistant"]';
const HOST_REQUEST_PATHS = new Set(["/api/fonts", "/api/backgrounds", "/api/backgrounds/upload"]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_PRESET_IMPORT_BYTES = 1024 * 1024;
const TOPBAR_REVEAL_MS = 6000;
const SCROLL_BOTTOM_TOLERANCE_PX = 2;
const stateApi = ConvoViewerState;
const FONT_FACE_REGISTRY_KEY = "__marinaraConvoViewerFontFaces";
const registeredFontFaceKeys = globalThis[FONT_FACE_REGISTRY_KEY] instanceof Set ? globalThis[FONT_FACE_REGISTRY_KEY] : new Set();
globalThis[FONT_FACE_REGISTRY_KEY] = registeredFontFaceKeys;

function toCssFontFamilyValue(value) {
  const family = stateApi.cleanFontFamily(value);
  if (!family) return null;
  const escaped = family.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}", sans-serif`;
}

function safeFontFaceUrl(value) {
  return typeof value === "string" && /^\/api\/fonts\/file\/[^\s"'()]+$/u.test(value) ? value : null;
}

function registerFontFaces(list) {
  if (!Array.isArray(list) || typeof FontFace === "undefined" || !document.fonts) return;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const family = stateApi.cleanFontFamily(item.family);
    const url = safeFontFaceUrl(item.url);
    if (!family || !url) continue;
    const weight = typeof item.weight === "string" && /^(?:normal|bold|[1-9]00)$/u.test(item.weight) ? item.weight : "400";
    const style = typeof item.style === "string" && /^(?:normal|italic|oblique)$/u.test(item.style) ? item.style : "normal";
    const unicodeRange = typeof item.unicodeRange === "string" && item.unicodeRange.length <= 2000 ? item.unicodeRange : null;
    const key = `${family}|${url}|${weight}|${style}|${unicodeRange ?? ""}`;
    if (registeredFontFaceKeys.has(key)) continue;
    try {
      const face = new FontFace(family, `url("${url}")`, { display: "swap", weight, style, ...(unicodeRange ? { unicodeRange } : {}) });
      document.fonts.add(face);
      registeredFontFaceKeys.add(key);
    } catch {
      // Ignore malformed font-face descriptors returned by the host.
    }
  }
}

function refreshFonts() {
  if (fontRefreshPromise) return fontRefreshPromise;
  fontRefreshPromise = (async () => {
    try {
      const response = await hostRequest("/api/fonts", { cache: "no-store" });
      if (!response.ok || instance.stopped) return false;
      const listed = await response.json();
      if (!Array.isArray(listed) || instance.stopped) return false;
      const changed = JSON.stringify(fonts) !== JSON.stringify(listed);
      fonts = listed;
      registerFontFaces(fonts);
      return changed;
    } catch {
      return false;
    }
  })().finally(() => { fontRefreshPromise = null; });
  return fontRefreshPromise;
}

const previous = globalThis[INSTANCE_KEY];
if (previous?.stop) previous.stop();
const instance = { stopped: false, stop: () => { instance.stopped = true; } };
globalThis[INSTANCE_KEY] = instance;

const storageRecord = await marinara.storage.get();
if (instance.stopped) return () => {};
let savedState = stateApi.normalizeState(storageRecord[SETTINGS_KEY]);
let activeChatId = null;
let draft = stateApi.defaultRoomSettings();
let panelOpen = false;
let activeTab = "theme";
let selectedPresetId = "room";
let fonts = [];
let fontRefreshPromise = null;
let backgrounds = [];
let appliedRoot = null;
let trigger = null;
// Placement is private extension data, separate from room styles/preset exports.
let viewerLayouts = Object.fromEntries(Object.entries(storageRecord.convoViewerLayouts ?? {}).filter(([id, layout]) =>
  /^[a-zA-Z0-9_-]{1,256}$/u.test(id) && layout && typeof layout === "object"
).map(([id, layout]) => [id, {
  docked: layout.docked === true,
  ...(Number.isFinite(layout.bubble?.x) && Number.isFinite(layout.bubble?.y) && Math.abs(layout.bubble.x) <= 100000 && Math.abs(layout.bubble.y) <= 100000 ? { bubble: { x: layout.bubble.x, y: layout.bubble.y } } : {}),
  ...(Number.isFinite(layout.width) && Number.isFinite(layout.height) ? {
    width: Math.max(240, Math.min(4096, layout.width)),
    height: Math.max(180, Math.min(4096, layout.height)),
  } : {}),
}]));
let dockSection = null;
let dragCleanup = null;
let dockDragCleanup = null;
let resizeCleanup = null;
let viewportFrame = 0;
let layoutSaveQueue = Promise.resolve();
const DOCK_SELECTOR = '[data-chat-control-dock]';
const TRIGGER_HOST_SELECTOR = '[data-mari-convo-viewer-trigger-host]';
const desktopToolbarMedia = window.matchMedia('(min-width: 768px)');
let triggerHost = null;
let navigationFrame = 0;
let presetImportInput = null;
let structureObserver = null;
let contentObserver = null;
let observedTranscript = null;
let structureTargets = new Map();
const visibilityStyle = document.createElement("div").style;
let appliedSettingsKey = null;
let stateSaveQueue = Promise.resolve();
const splitSignatures = new WeakMap();
let splitFrame = 0;
let pendingSplitScopes = new Set();

let frame = 0;
let temporaryHeaderVisible = false;
let headerTimer = 0;

function create(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.type) node.type = options.type;
  if (options.title) node.title = options.title;
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
  if (options.attrs) for (const [name, value] of Object.entries(options.attrs)) node.setAttribute(name, String(value));
  return node;
}

function makeButton(label, onClick, options = {}) {
  const node = create("button", { className: `mari-chrome-control mari-convo-viewer-button ${options.variant === "primary" ? "mari-chrome-control--primary" : ""} ${options.variant ?? ""}`, text: label, type: "button" });
  node.disabled = Boolean(options.disabled);
  if (options.title) node.title = options.title;
  node.addEventListener("click", () => { Promise.resolve().then(onClick).catch(error => notice(error instanceof Error ? error.message : "작업을 완료하지 못했습니다.", true)); });
  return node;
}

function field(label, control, help) {
  const wrapper = create("label", { className: "mari-convo-viewer-field" });
  wrapper.append(create("span", { className: "mari-convo-viewer-label", text: label }), control);
  if (help) wrapper.append(create("span", { className: "mari-convo-viewer-help", text: help }));
  return wrapper;
}

function selectInput(value, options, onChange) {
  const control = create("select");
  for (const option of options) {
    const item = create("option", { text: option.label, attrs: { value: option.value } });
    item.selected = option.value === value;
    control.append(item);
  }
  control.addEventListener("change", () => onChange(control.value));
  return control;
}

function colorControl(value, fallback, label, onChange) {
  const row = create("div", { className: "mari-convo-viewer-color" });
  const color = create("input", { attrs: { type: "color", value: value ?? fallback, "aria-label": `${label} 색상` } });
  const enabled = create("input", { attrs: { type: "checkbox", "aria-label": `${label} 사용` } });
  enabled.checked = Boolean(value);
  color.addEventListener("input", () => { enabled.checked = true; onChange(color.value); });
  enabled.addEventListener("change", () => onChange(enabled.checked ? color.value : null));
  const toggle = create("label", { className: "mari-convo-viewer-check" });
  toggle.append(enabled, document.createTextNode(`${label} 사용`));
  row.append(color, toggle);
  return row;
}

function borderControl(mode, color, style, width, label, onChange) {
  const row = create("div", { className: "mari-convo-viewer-border-control" });
  const options = [
    { value: "theme", label: "현재 테마 선" },
    { value: "none", label: "선 없음" },
    { value: "custom", label: "사용자 지정" },
  ];
  const picker = create("input", { attrs: { type: "color", value: color || "#808080", "aria-label": `${label} 색상` } });
  const styleOptions = [
    { value: "solid", label: "실선" },
    { value: "dotted", label: "점선" },
    { value: "dashed", label: "파선" },
  ];
  let currentWidth = Number.isFinite(Number(width)) ? Number(width) : 1;
  const styleChoice = selectInput(style, styleOptions, (nextStyle) => onChange("custom", picker.value || "#808080", nextStyle, currentWidth));
  const widthControl = stepper("선 두께", currentWidth, 0.1, 10, "pt", (nextWidth) => { currentWidth = nextWidth; onChange("custom", picker.value || "#808080", styleChoice.value, currentWidth); }, 0.1, 1);
  const choice = selectInput(mode, options, (nextMode) => {
    const custom = nextMode === "custom";
    picker.hidden = !custom;
    styleChoice.hidden = !custom;
    widthControl.hidden = !custom;
    onChange(nextMode, custom ? (picker.value || "#808080") : null, styleChoice.value, currentWidth);
  });
  const custom = mode === "custom";
  picker.hidden = !custom;
  styleChoice.hidden = !custom;
  widthControl.hidden = !custom;
  picker.addEventListener("input", () => onChange("custom", picker.value, styleChoice.value, currentWidth));
  row.append(choice, styleChoice, picker, widthControl);
  return row;
}

function themeGroup(title, children) {
  const section = create("section", { className: "mari-convo-viewer-theme-group" });
  section.append(create("h3", { text: title }));
  section.append(...children);
  return section;
}

function stepper(label, value, min, max, unit, onChange, step = 1, decimals = 0) {
  const row = create("div", { className: "mari-convo-viewer-stepper" });
  const name = create("span", { className: "mari-convo-viewer-label", text: label });
  const format = (number) => decimals > 0 ? number.toFixed(decimals) : String(number);
  const output = create("output", { text: `${format(Number(value))}${unit}`, attrs: { "aria-live": "polite" } });
  const actions = create("div", { className: "mari-convo-viewer-stepper-actions" });
  let current = Number(value);
  const update = (delta) => {
    const factor = 10 ** decimals;
    current = Math.round(Math.min(max, Math.max(min, current + delta)) * factor) / factor;
    output.textContent = `${format(current)}${unit}`;
    minus.disabled = current <= min;
    plus.disabled = current >= max;
    onChange(current);
  };
  const minus = makeButton("−", () => update(-step), { variant: "stepper", title: `${label} 줄이기` });
  const plus = makeButton("+", () => update(step), { variant: "stepper", title: `${label} 늘리기` });
  minus.disabled = current <= min;
  plus.disabled = current >= max;
  actions.append(minus, plus);
  row.append(name, output, actions);
  return row;
}

function checkbox(checked, label, onChange) {
  const wrapper = create("label", { className: "mari-convo-viewer-check" });
  const control = create("input", { attrs: { type: "checkbox" } });
  control.checked = checked;
  control.addEventListener("change", () => onChange(control.checked));
  wrapper.append(control, document.createTextNode(label));
  return wrapper;
}

function currentChatId() {
  try {
    const id = localStorage.getItem("marinara-active-chat-id");
    return id && /^[A-Za-z0-9_-]{1,256}$/u.test(id) ? id : null;
  } catch {
    return null;
  }
}

function conversationRoot() {
  const roots = [...document.querySelectorAll('div.mari-chat-area[data-chat-mode="conversation"]')].filter((node) => node.getClientRects().length > 0);
  return roots.length === 1 ? roots[0] : null;
}

function conversationScroll(root) {
  const scroll = root?.querySelector(":scope > .mari-messages-scroll");
  return scroll instanceof HTMLElement ? scroll : null;
}

function captureScrollPosition(root) {
  const scroll = conversationScroll(root);
  if (!scroll) return null;
  const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
  const distanceFromBottom = maxTop - scroll.scrollTop;
  return { scroll, top: scroll.scrollTop, atBottom: distanceFromBottom <= SCROLL_BOTTOM_TOLERANCE_PX };
}

function restoreScrollPosition(snapshot) {
  const scroll = snapshot?.scroll;
  if (!scroll?.isConnected) return;
  const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
  // Preserve the user's mode: a bottom-anchored view follows the new bottom,
  // while any other view keeps its previous scrollTop. Do this synchronously
  // after the split DOM changes so a later user scroll is never overwritten.
  scroll.scrollTop = snapshot.atBottom ? maxTop : Math.min(snapshot.top, maxTop);
}

async function hostRequest(path, init) {
  if (!HOST_REQUEST_PATHS.has(path)) throw new Error("허용되지 않은 Marinara 내부 요청입니다.");
  const headers = new Headers(init?.headers);
  if ((init?.method ?? "GET") !== "GET") headers.set("x-marinara-csrf", "1");
  return fetch(path, { ...init, headers, credentials: "same-origin" });
}

function loadResources() {
  // Optional libraries must never delay the local launcher/settings. Load each
  // independently, and ignore late responses after this instance is disabled.
  const fontTask = refreshFonts().then(changed => {
    if (changed && !instance.stopped && panelOpen && activeTab === "text") renderPanel();
  });
  const backgroundTask = (async () => {
    try {
      const response = await hostRequest("/api/backgrounds");
      if (!response.ok || instance.stopped) return;
      const listed = await response.json();
      if (!Array.isArray(listed) || instance.stopped) return;
      const changed = JSON.stringify(backgrounds) !== JSON.stringify(listed);
      backgrounds = listed;
      if (changed && panelOpen && activeTab === "background") renderPanel();
    } catch {
      // A failed background request does not disable room styles or font choices.
    }
  })();
  return Promise.allSettled([fontTask, backgroundTask]);
}

function roomSettings() {
  return activeChatId && savedState.rooms[activeChatId] ? stateApi.clone(savedState.rooms[activeChatId]) : stateApi.defaultRoomSettings();
}

async function persist(next) {
  savedState = stateApi.normalizeState(next);
  const snapshot = stateApi.clone(savedState);
  stateSaveQueue = stateSaveQueue.catch(() => {}).then(() => marinara.storage.patch({ [SETTINGS_KEY]: snapshot }));
  await stateSaveQueue;
}

function updateDraft(mutator) {
  const next = stateApi.clone(draft);
  mutator(next);
  draft = stateApi.cleanRoomSettings(next);
  scheduleRefresh(false);
}

function setStyle(root, name, value) {
  if (value == null) { if (root.style.getPropertyValue(name)) root.style.removeProperty(name); }
  else if (root.style.getPropertyValue(name) !== String(value)) root.style.setProperty(name, String(value));
}

function clearApplied(root = appliedRoot) {
  document.documentElement.removeAttribute("data-mari-convo-viewer-topbar-hidden");
  if (!root) return;
  clearBubbleSplits(root);
  appliedSettingsKey = null;
  root.removeAttribute("data-mari-convo-viewer-active");
  root.removeAttribute("data-mari-convo-viewer-background");
  root.removeAttribute("data-mari-convo-viewer-custom-background-color");
  root.removeAttribute("data-mari-convo-viewer-own-bubble");
  root.removeAttribute("data-mari-convo-viewer-other-bubble");
  root.removeAttribute("data-mari-convo-viewer-own-border");
  root.removeAttribute("data-mari-convo-viewer-other-border");
  root.removeAttribute("data-mari-convo-viewer-own-text");
  root.removeAttribute("data-mari-convo-viewer-other-text");
  root.removeAttribute("data-mari-convo-viewer-input-font");
  root.removeAttribute("data-mari-convo-viewer-split-bubbles");
  root.removeAttribute("data-mari-convo-viewer-hide-character-avatars");
  for (const name of [...root.style]) if (name.startsWith("--mari-convo-viewer-")) root.style.removeProperty(name);
  if (root === appliedRoot) appliedRoot = null;
}

function borderValue(mode, color, style, width) {
  if (mode === "none") return "none";
  if (mode === "custom") return `${width || 1}pt ${style || "solid"} ${color || "var(--border)"}`;
  return null;
}

function isStreamingMessage(source) {
  const message = source.closest(".mari-message-assistant");
  return Boolean(message?.className.includes("bg-[var(--secondary)]/20"));
}

function plainBubbleText(source) {
  // innerText depends on the active theme's computed CSS (notably white-space),
  // so the same message could split in one theme but not another. Read the DOM
  // content instead and turn explicit line/paragraph boundaries into newlines.
  const clone = source.cloneNode(true);
  if (!(clone instanceof HTMLElement)) return "";
  clone.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  clone.querySelectorAll("p").forEach((node) => node.append("\n"));
  return (clone.textContent ?? "").replace(/\r/g, "").replace(/\u00a0/g, " ");
}

function splitLines(source) {
  const text = plainBubbleText(source);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length > 1 ? lines : null;
}

function messageRoleFor(source) {
  const container = source.closest(MESSAGE_CONTAINER_SELECTOR);
  if (!container) return "assistant";
  if (container.classList.contains("mari-message-user") || container.getAttribute("data-message-role") === "user") return "user";
  return "assistant";
}

function canSplitBubble(source) {
  if (!(source instanceof HTMLElement) || source.classList.contains(SPLIT_BUBBLE_CLASS)) return false;
  if (isStreamingMessage(source)) return false;
  if (!source.closest(MESSAGE_CONTAINER_SELECTOR)) return false;
  // v2.4.4 group-chat speaker bubbles already contain a name row plus message
  // body; treating that internal name/body boundary as a line break would make
  // a fake extra bubble. Leave those engine-managed segments untouched.
  if ([...source.children].some((child) => child instanceof HTMLElement && child.classList.contains("mb-0.5"))) return false;
  if (source.querySelector("a, button, code, del, em, img, input, mark, pre, strong, table, ul, ol, blockquote, .mari-message-typing, .mari-pending-typing-dots")) return false;
  return true;
}

function clearBubbleSplits(root) {
  const displays = root?.querySelectorAll(`.${SPLIT_DISPLAY_CLASS}`) ?? [];
  const sources = root?.querySelectorAll(`[${SPLIT_SOURCE_ATTR}]`) ?? [];
  displays.forEach((node) => node.remove());
  sources.forEach((node) => node.removeAttribute(SPLIT_SOURCE_ATTR));
  return displays.length > 0 || sources.length > 0;
}

function addBubbleSplit(source, lines = splitLines(source)) {
  if (!lines || source.nextElementSibling?.classList.contains(SPLIT_DISPLAY_CLASS)) return false;
  const display = create("div", {
    className: SPLIT_DISPLAY_CLASS,
    attrs: { "aria-hidden": "true", "data-mari-convo-viewer-split-role": messageRoleFor(source) },
  });
  for (const line of lines) {
    // Retain the host's full bubble class list and inline message style. This
    // keeps padding, line height, corner treatment, and shadow identical to
    // a single unsplit bubble in the current Marinara theme.
    const bubble = create("div", { className: `${source.className} ${SPLIT_BUBBLE_CLASS}` });
    bubble.style.cssText = source.style.cssText;
    bubble.textContent = line;
    display.append(bubble);
  }
  source.setAttribute(SPLIT_SOURCE_ATTR, "true");
  source.after(display);
  return true;
}

function syncBubbleSplits(root, enabled) {
  if (!enabled) return clearBubbleSplits(root);
  let changed = false;
  for (const source of root.querySelectorAll('.mari-message-bubble:not(.mari-convo-viewer-split-bubble)')) {
    const display = source.nextElementSibling?.classList.contains(SPLIT_DISPLAY_CLASS) ? source.nextElementSibling : null;
    const lines = canSplitBubble(source) ? splitLines(source) : null;
    const signature = lines ? JSON.stringify([lines, source.className, source.style.cssText]) : null;
    if (signature && display && splitSignatures.get(source) === signature) continue;
    if (display) { display.remove(); changed = true; }
    if (source.hasAttribute(SPLIT_SOURCE_ATTR)) { source.removeAttribute(SPLIT_SOURCE_ATTR); changed = true; }
    splitSignatures.delete(source);
    if (signature) { changed = addBubbleSplit(source, lines) || changed; splitSignatures.set(source, signature); }
  }
  return changed;
}

function apply(root, settings) {
  if (!settings.enabled) return clearApplied(root);
  root.setAttribute("data-mari-convo-viewer-active", "true");
  setStyle(root, "--mari-convo-viewer-font-family", toCssFontFamilyValue(settings.text.fontFamily));
  setStyle(root, "--mari-convo-viewer-font-size", `${settings.text.fontSizePx}px`);
  setStyle(root, "--mari-convo-viewer-own-bubble", settings.theme.ownBubbleColor);
  setStyle(root, "--mari-convo-viewer-other-bubble", settings.theme.otherBubbleColor);
  setStyle(root, "--mari-convo-viewer-own-border", borderValue(settings.theme.ownBubbleBorderMode, settings.theme.ownBubbleBorderColor, settings.theme.ownBubbleBorderStyle, settings.theme.ownBubbleBorderWidthPt));
  setStyle(root, "--mari-convo-viewer-other-border", borderValue(settings.theme.otherBubbleBorderMode, settings.theme.otherBubbleBorderColor, settings.theme.otherBubbleBorderStyle, settings.theme.otherBubbleBorderWidthPt));
  setStyle(root, "--mari-convo-viewer-own-text", settings.theme.ownTextColor);
  setStyle(root, "--mari-convo-viewer-other-text", settings.theme.otherTextColor);
  root.toggleAttribute("data-mari-convo-viewer-own-text", Boolean(settings.theme.ownTextColor));
  root.toggleAttribute("data-mari-convo-viewer-other-text", Boolean(settings.theme.otherTextColor));
  root.toggleAttribute("data-mari-convo-viewer-input-font", settings.text.applyFontToInput === true);
  root.toggleAttribute("data-mari-convo-viewer-own-bubble", Boolean(settings.theme.ownBubbleColor));
  root.toggleAttribute("data-mari-convo-viewer-other-bubble", Boolean(settings.theme.otherBubbleColor));
  root.toggleAttribute("data-mari-convo-viewer-own-border", settings.theme.ownBubbleBorderMode !== "theme");
  root.toggleAttribute("data-mari-convo-viewer-other-border", settings.theme.otherBubbleBorderMode !== "theme");
  setStyle(root, "--mari-convo-viewer-bubble-radius", settings.theme.bubbleShape === "square" ? "0.45rem" : "1.25rem");
  // CSS uses the host's existing message roles; no per-message work is needed.
  setStyle(root, "--mari-convo-viewer-bubble-tip-radius", settings.theme.bubbleShape === "droplet" ? "0" : null);
  setStyle(root, "--mari-convo-viewer-background-color", settings.background.color);
  setStyle(root, "--mari-convo-viewer-background-image", settings.background.imageRef ? `url("${settings.background.imageRef}")` : null);
  setStyle(root, "--mari-convo-viewer-background-opacity", settings.background.imageOpacity / 100);
  root.toggleAttribute("data-mari-convo-viewer-background", Boolean(settings.background.color || settings.background.imageRef));
  root.toggleAttribute("data-mari-convo-viewer-custom-background-color", Boolean(settings.background.color));
  root.toggleAttribute("data-mari-convo-viewer-hide-character-avatars", settings.background.hideCharacterAvatars);
  const splitChanged = root.hasAttribute("data-mari-convo-viewer-split-bubbles") !== settings.theme.splitBubbles;
  root.toggleAttribute("data-mari-convo-viewer-split-bubbles", settings.theme.splitBubbles);
  if (splitChanged) {
    const snapshot = captureScrollPosition(root);
    if (syncBubbleSplits(root, settings.theme.splitBubbles)) restoreScrollPosition(snapshot);
  }
  document.documentElement.toggleAttribute("data-mari-convo-viewer-topbar-hidden", Boolean(settings.background.topBarHidden && !temporaryHeaderVisible));
  appliedRoot = root;
}

function makeIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "14"); svg.setAttribute("height", "14"); svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2"); svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M12 3v18M3 12h18M5.64 5.64l12.72 12.72M18.36 5.64 5.64 18.36");
  path.setAttribute("stroke-linecap", "round");
  svg.append(path);
  return svg;
}

/* Lucide v0.513.0 SVG definitions. ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */
function makePresetActionIcon(kind) {
  // Lucide icons used by ChatSettingsDrawer's profile toolbar.
  const nodes = {
  "save": [
    [
      "path",
      {
        "d": "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
      }
    ],
    [
      "path",
      {
        "d": "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"
      }
    ],
    [
      "path",
      {
        "d": "M7 3v4a1 1 0 0 0 1 1h7"
      }
    ]
  ],
  "rename": [
    [
      "path",
      {
        "d": "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
      }
    ],
    [
      "path",
      {
        "d": "m15 5 4 4"
      }
    ]
  ],
  "create": [
    [
      "path",
      {
        "d": "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"
      }
    ],
    [
      "path",
      {
        "d": "M14 2v4a2 2 0 0 0 2 2h4"
      }
    ],
    [
      "path",
      {
        "d": "M3 15h6"
      }
    ],
    [
      "path",
      {
        "d": "M6 12v6"
      }
    ]
  ],
  "import": [
    [
      "path",
      {
        "d": "M12 15V3"
      }
    ],
    [
      "path",
      {
        "d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
      }
    ],
    [
      "path",
      {
        "d": "m7 10 5 5 5-5"
      }
    ]
  ],
  "export": [
    [
      "path",
      {
        "d": "M12 3v12"
      }
    ],
    [
      "path",
      {
        "d": "m17 8-5-5-5 5"
      }
    ],
    [
      "path",
      {
        "d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
      }
    ]
  ],
  "delete": [
    [
      "path",
      {
        "d": "M3 6h18"
      }
    ],
    [
      "path",
      {
        "d": "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
      }
    ],
    [
      "path",
      {
        "d": "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
      }
    ],
    [
      "line",
      {
        "x1": "10",
        "x2": "10",
        "y1": "11",
        "y2": "17"
      }
    ],
    [
      "line",
      {
        "x1": "14",
        "x2": "14",
        "y1": "11",
        "y2": "17"
      }
    ]
  ]
};
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", width: "0.875rem", height: "0.875rem", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(key, String(value));
  for (const [tag, attributes] of nodes[kind]) {
    const shape = document.createElementNS(svg.namespaceURI, tag);
    for (const [name, value] of Object.entries(attributes)) shape.setAttribute(name, value);
    svg.append(shape);
  }
  return svg;
}

function makeIconButton(label, onClick, icon) {
  const button = makeButton("", onClick, { variant: "icon", title: label });
  button.setAttribute("aria-label", label);
  button.append(icon);
  return button;
}

function downloadPresets() {
  const preset = selectedPreset();
  if (!preset) return;
  const payload = JSON.stringify(stateApi.exportPresets({ ...savedState, presets: [preset] }), null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const anchor = create("a", { attrs: { href: url, download: `${preset.name.replace(/[\\/:*?"<>|]/g, "_")}.convo-viewer-preset.json` } });
  document.body.append(anchor); anchor.click(); anchor.remove();
  marinara.setTimeout(() => URL.revokeObjectURL(url), 0);
  notice(`“${preset.name}” 프리셋을 내보냈습니다.`);
}

function requestPresetImport() {
  // Marinara's embedded browser reliably dispatches the file change event only
  // when this temporary picker is connected to the document.
  presetImportInput?.remove();
  const input = create("input", { attrs: { type: "file", accept: ".json,application/json", hidden: "true", "aria-label": "프리셋 파일 가져오기" } });
  presetImportInput = input;
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    try {
      if (!file) return;
      if (file.size > MAX_PRESET_IMPORT_BYTES) return notice("프리셋 파일은 1MB 이하만 가져올 수 있습니다.", true);
      const parsed = JSON.parse(await file.text());
      const result = stateApi.importPresets(savedState, parsed);
      await persist(result.state);
      selectedPresetId = "room";
      renderPanel();
      const skipped = result.skipped > 0 ? `, ${result.skipped}개는 같은 이름·형식 오류·저장 한도로 건너뛰었습니다.` : "";
      notice(`${result.imported}개 프리셋을 추가했습니다${skipped}`);
    } catch (error) {
      notice(error instanceof Error ? error.message : "프리셋 파일을 가져오지 못했습니다.", true);
    } finally {
      input.remove();
      if (presetImportInput === input) presetImportInput = null;
    }
  }, { once: true });
  input.addEventListener("cancel", () => { input.remove(); if (presetImportInput === input) presetImportInput = null; }, { once: true });
  document.body.append(input);
  input.click();
}

function syncTriggerOpenState() {
  if (!trigger) return;
  trigger.setAttribute("aria-expanded", String(panelOpen));
  if (panelOpen) trigger.setAttribute("data-open", "true"); else trigger.removeAttribute("data-open");
}

// External full-page addons cannot access React's private window/menu stores.
// Use the native DOM surfaces and keep placement in the addon's own storage.
let launcherFrame = 0;
let launcherResize = null;
let launcherRoot = null;
let launcherResizeTargets = new Set();
let launcherDrag = null;
let launcherSuppressClick = false;
let launcherTouchHandled = false;
let launcherPoint = null;
let menuRow = null;
let compactLauncher = null;
let compactMenu = null;
let compactOpen = false;

function launcherBounds() {
  const root = launcherRoot;
  const area = (root?.closest('[data-component="CenterContent"]') ?? root)?.getBoundingClientRect();
  const top = document.querySelector('[data-component="TopBar"]')?.getBoundingClientRect().bottom ?? 0;
  const composer = root?.querySelector('.chat-input-container, [data-chat-input-container], [data-chat-composer]')?.getBoundingClientRect();
  const viewport = window.visualViewport;
  return { left: Math.max(0, area?.left ?? 0) + 8, top: Math.max(top, area?.top ?? 0) + 8,
    right: Math.min(window.innerWidth, area?.right ?? window.innerWidth) - 8,
    bottom: Math.min(window.innerHeight, area?.bottom ?? window.innerHeight,
      viewport ? viewport.offsetTop + viewport.height : Infinity, composer?.height ? composer.top : Infinity) - 8 };
}
function clampLauncher(point, bounds, size) {
  return { x: Math.max(bounds.left, Math.min(Math.max(bounds.left, bounds.right - size), point.x)),
    y: Math.max(bounds.top, Math.min(Math.max(bounds.top, bounds.bottom - size), point.y)) };
}
function otherLauncherRects() {
  // Only at placement/gesture boundaries; pointermove uses the frozen snapshot.
  return [...document.querySelectorAll('.mari-window-bubble')].filter(node => node !== trigger && node !== compactLauncher &&
    !node.closest('[data-chat-tools-menu], [data-mari-convo-viewer-compact-menu]') && node.getClientRects().length)
    .map(node => { const r = node.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
}
function dropLauncher(raw, others, bounds, size, snap = true) {
  let point = clampLauncher(raw, bounds, size);
  if (snap) for (const axis of ['x', 'y']) {
    const cross = axis === 'x' ? 'y' : 'x';
    const dimension = axis === 'x' ? 'width' : 'height';
    const crossDimension = axis === 'x' ? 'height' : 'width';
    let best = null;
    for (const other of others) {
      const beside = point[cross] < other[cross] + other[crossDimension] + 8 && other[cross] < point[cross] + size + 8;
      const candidates = [other[axis], other[axis] + (other[dimension] - size) / 2, other[axis] + other[dimension] - size];
      if (beside) candidates.unshift(other[axis] + other[dimension] + 8, other[axis] - size - 8);
      for (const value of candidates) if (Math.abs(value - point[axis]) <= 8 && (!best || Math.abs(value - point[axis]) < best.distance))
        best = { value, distance: Math.abs(value - point[axis]) };
    }
    if (best) point[axis] = best.value;
  }
  point = clampLauncher(point, bounds, size);
  const free = p => others.every(o => p.x + size <= o.x || p.x >= o.x + o.width || p.y + size <= o.y || p.y >= o.y + o.height);
  if (free(point)) return point;
  for (const gap of [8, 0]) {
    const xs = new Set([point.x, bounds.left, bounds.right - size]);
    const ys = new Set([point.y, bounds.top, bounds.bottom - size]);
    for (const other of others) { xs.add(other.x - size - gap); xs.add(other.x + other.width + gap); ys.add(other.y - size - gap); ys.add(other.y + other.height + gap); }
    const candidates = [...xs].flatMap(x => [...ys].map(y => ({ x, y }))).sort((a,b) =>
      (a.x-raw.x)**2+(a.y-raw.y)**2 - ((b.x-raw.x)**2+(b.y-raw.y)**2));
    const available = candidates.find(p => p.x >= bounds.left && p.y >= bounds.top && p.x + size <= bounds.right && p.y + size <= bounds.bottom && free(p));
    if (available) return available;
  }
  return point;
}
function paintLauncher(point) {
  launcherPoint = point;
  trigger.style.left = `${point.x}px`;
  trigger.style.top = `${point.y}px`;
}
function saveLauncherPoint(point) {
  if (!activeChatId || instance.stopped) return;
  viewerLayouts[activeChatId] = { ...viewerLayouts[activeChatId], bubble: point };
  saveViewerLayout().catch(() => notice('버튼 위치를 저장하지 못했습니다.', 'error'));
}
function cancelLauncherDrag() {
  if (launcherDrag) {
    trigger?.releasePointerCapture?.(launcherDrag.pointerId);
    launcherDrag = null;
  }
  trigger?.removeAttribute('data-dragging');
  if (launcherFrame) cancelAnimationFrame(launcherFrame);
  launcherFrame = 0;
}
function attachLauncherMovement(node) {
  node.addEventListener('pointerdown', event => {
    launcherTouchHandled = false;
    launcherSuppressClick = false;
    if (!desktopToolbarMedia.matches || event.button !== 0 || launcherDrag) return;
    event.preventDefault(); node.focus({ preventScroll: true });
    const r = node.getBoundingClientRect();
    launcherDrag = { pointerId: event.pointerId, chatId: activeChatId, startX: event.clientX, startY: event.clientY,
      start: { x: r.left, y: r.top }, bounds: launcherBounds(), size: Math.max(r.width, r.height),
      others: otherLauncherRects(), moved: false, threshold: event.pointerType === 'mouse' ? 4 : 10 };
    node.setPointerCapture?.(event.pointerId);
  });
  const readDrop = (drag, event) => dropLauncher({ x: drag.start.x + event.clientX - drag.startX,
    y: drag.start.y + event.clientY - drag.startY }, event.altKey ? [] : drag.others, drag.bounds, drag.size, !event.altKey);
  node.addEventListener('pointermove', event => {
    const drag = launcherDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY) < drag.threshold) return;
    drag.moved = true;
    node.setAttribute('data-dragging','true');
    drag.next = readDrop(drag, event);
    if (!launcherFrame) launcherFrame = requestAnimationFrame(() => { launcherFrame = 0; if (launcherDrag === drag) paintLauncher(drag.next); });
  });
  const end = event => {
    const drag = launcherDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = readDrop(drag, event);
    cancelLauncherDrag();
    if (event.type === 'pointercancel' || drag.chatId !== activeChatId) { launcherSuppressClick=drag.moved;paintLauncher(drag.start);if(drag.boundsChanged) scheduleLauncherPlacement();return; }
    if (drag.moved) { launcherSuppressClick = true; paintLauncher(point); saveLauncherPoint(point); }
    if(drag.boundsChanged) scheduleLauncherPlacement();
    if (event.pointerType === 'touch') {
      launcherTouchHandled = true;
      if (!drag.moved) openViewerFromLauncher();
    }
  };
  node.addEventListener('pointerup',end);
  node.addEventListener('pointercancel',end);
  node.addEventListener('lostpointercapture', () => { if (launcherDrag) { const start=launcherDrag.start;launcherSuppressClick=launcherDrag.moved;cancelLauncherDrag();paintLauncher(start); } });
  node.addEventListener('touchend', event => { if (launcherTouchHandled && event.cancelable) event.preventDefault(); }, { passive: false });
  node.addEventListener('keydown', event => {
    launcherSuppressClick = false; launcherTouchHandled = false;
    if (!desktopToolbarMedia.matches) return;
    const step = event.shiftKey ? 50 : 10;
    const delta = { ArrowLeft: [-step,0], ArrowRight: [step,0], ArrowUp: [0,-step], ArrowDown: [0,step] }[event.key];
    if (!delta || !launcherPoint) return;
    event.preventDefault(); event.stopPropagation();
    const r=node.getBoundingClientRect();
    const next = dropLauncher({x:launcherPoint.x+delta[0],y:launcherPoint.y+delta[1]},otherLauncherRects(),launcherBounds(),Math.max(r.width,r.height),false);
    paintLauncher(next);saveLauncherPoint(next);
  });
}
function openViewerFromLauncher() {
  panelOpen = !panelOpen;
  if (!panelOpen) draft = roomSettings();
  syncTriggerOpenState();renderPanel();refreshForPage({ renderPanel: false, remountIcon: false });
  const roomId = activeChatId;
  if (panelOpen) void refreshFonts().then(changed => { if (changed && panelOpen && activeTab === "text" && activeChatId === roomId && !instance.stopped) renderPanel(); });
}
function bindLauncherBounds(root) {
  launcherRoot = root;
  if (!root) { launcherResize?.disconnect();launcherResize=null;launcherResizeTargets.clear();return; }
  if (!launcherResize && typeof ResizeObserver !== 'undefined') launcherResize=new ResizeObserver(scheduleLauncherPlacement);
  const targets = new Set([root, root.closest('[data-component="CenterContent"]'), document.querySelector('[data-component="TopBar"]'),
    root.querySelector('.chat-input-container, [data-chat-input-container], [data-chat-composer]'), trigger].filter(Boolean));
  for (const target of launcherResizeTargets) if (!targets.has(target)) launcherResize?.unobserve(target);
  for (const target of targets) if (!launcherResizeTargets.has(target)) launcherResize?.observe(target);
  launcherResizeTargets=targets;
}
function scheduleLauncherPlacement() {
  if (instance.stopped) return;
  if (launcherDrag) { launcherDrag.boundsChanged = true;return; }
  if (launcherFrame) return;
  launcherFrame = requestAnimationFrame(() => { launcherFrame = 0; positionLauncher(); });
}
function positionLauncher() {
  if (launcherDrag) return;
  if (!desktopToolbarMedia.matches) {
    if (!compactLauncher?.isConnected || !triggerHost?.contains(compactLauncher)) return;
    const r = compactLauncher.getBoundingClientRect();
    const size = Math.max(r.width, r.height) || 32;
    const bounds = launcherBounds();
    const point = dropLauncher({ x: bounds.right - size - (size + 8), y: bounds.top }, otherLauncherRects(), bounds, size, false);
    triggerHost.style.left = `${point.x}px`;
    triggerHost.style.top = `${point.y}px`;
    return;
  }
  if (!trigger?.isConnected) return;
  const r = trigger.getBoundingClientRect();
  const size = Math.max(r.width,r.height) || 32;
  const bounds = launcherBounds();
  const stored = viewerLayouts[activeChatId]?.bubble;
  const point = stored ?? { x: bounds.right - size - (size + 8), y: bounds.top };
  paintLauncher(dropLauncher(point,otherLauncherRects(),bounds,size,false));
}
function removeCompactSurface() {
  menuRow?.remove();compactLauncher?.remove();compactMenu?.remove();compactOpen=false;
}
function closeCompactMenu() {
  if (compactMenu?.isConnected) { compactOpen=false;compactMenu.remove();compactLauncher?.setAttribute('aria-expanded','false'); }
  else document.querySelector('[data-chat-tools-menu-button]')?.click();
}
function syncCompactLauncher() {
  if (!menuRow) menuRow = create('div',{ className: 'mari-convo-viewer-menu-row relative flex min-h-[44px] shrink-0 items-center justify-center',
    attrs: { 'data-mari-convo-viewer-menu-row': 'true', 'data-chat-tools-menu-item': 'extension:convo-viewer' } });
  trigger.style.left = '';trigger.style.top = '';
  trigger.classList.add('mari-chat-tools-button');trigger.setAttribute('data-presentation','sheet');
  trigger.setAttribute('data-chat-tools-menu-tool','extension:convo-viewer');
  if (trigger.parentElement !== menuRow) menuRow.append(trigger);
  const nativeLauncher = document.querySelector('[data-chat-tools-menu-button]');
  const nativeMenu = document.querySelector('[data-chat-tools-menu]');
  if (nativeLauncher) {
    compactLauncher?.remove();compactMenu?.remove();compactOpen=false;
    const list = nativeMenu?.lastElementChild;
    if (list && menuRow.parentElement !== list) list.append(menuRow);
    else if (!list) menuRow.remove();
    return;
  }
  // The engine hides its menu when it has no native tools. Supply the same single
  // ellipsis entry point for this addon; relinquish it as soon as native tools mount.
  const host=ensureFallbackTriggerHost();
  if (!compactLauncher) {
    compactLauncher=create('button',{className:'mari-window-bubble relative',type:'button',title:'채팅 도구',
      attrs:{'data-mari-convo-viewer-compact-launcher':'true','data-dock-ignore':'true','data-presentation':'sheet','aria-label':'채팅 도구','aria-expanded':'false'}});
    const paint=create('span',{className:'mari-window-bubble__paint pointer-events-none',attrs:{'aria-hidden':'true'}});
    const icon=create('span',{className:'mari-window-bubble__icon'});
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor','stroke-width':2,'aria-hidden':'true'})) svg.setAttribute(key,String(value));
    for(const x of [12,19,5]) { const circle=document.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx',String(x));circle.setAttribute('cy','12');circle.setAttribute('r','1');svg.append(circle); }
    icon.append(svg);compactLauncher.append(paint,icon);
    compactLauncher.addEventListener('click',()=>{compactOpen=!compactOpen;syncCompactLauncher();});
  }
  if(compactLauncher.parentElement!==host) host.append(compactLauncher);
  compactLauncher.setAttribute('aria-expanded',String(compactOpen));
  scheduleLauncherPlacement();
  if (!compactOpen) { compactMenu?.remove();menuRow.remove();return; }
  if(!compactMenu) compactMenu=create('div',{className:'mari-convo-viewer-compact-menu',attrs:{'data-mari-convo-viewer-compact-menu':'true',role:'group','aria-label':'채팅 도구'}});
  if(compactMenu.parentElement!==host) host.append(compactMenu);
  if(menuRow.parentElement!==compactMenu) compactMenu.append(menuRow);
}
function handleLauncherOutside(event) {
  if(compactOpen && !triggerHost?.contains(event.target)) closeCompactMenu();
}
function handleCompactEscape(event) {
  if (compactOpen && event.key === 'Escape') { event.preventDefault();event.stopPropagation();closeCompactMenu();compactLauncher?.focus({preventScroll:true}); }
}
function handleNativeBubbleRelease(event) {
  if (event.target instanceof Element && event.target.closest('.mari-window-bubble') && !isExtensionOwnedNode(event.target)) scheduleLauncherPlacement();
}

function makeToolbarTrigger() {
  // Button Dock's public opt-out keeps this native-style movable launcher on the
  // chat surface. Without it the collector writes display:none !important.
  const node = create("button", { className: "mari-window-bubble mari-convo-viewer-trigger", type: "button", title: "콘보모드 뷰어 설정 — 드래그로 이동",
    attrs: { "data-mari-convo-viewer-trigger": "true", "data-dock-ignore": "true", "data-window": "extension:convo-viewer", "aria-label": "콘보모드 뷰어 설정", "aria-expanded": String(panelOpen) } });
  const paint = create("span", { className: "mari-window-bubble__paint pointer-events-none", attrs: { "aria-hidden": "true" } });
  const icon = create("span", { className: "mari-window-bubble__icon" });icon.append(makeIcon());node.append(paint,icon);
  attachLauncherMovement(node);
  node.addEventListener("click", event => {
    event.preventDefault();event.stopPropagation();
    if (launcherSuppressClick || launcherTouchHandled) { launcherSuppressClick=false;launcherTouchHandled=false;return; }
    if (!desktopToolbarMedia.matches) closeCompactMenu();
    openViewerFromLauncher();
  });
  return node;
}

function ensureFallbackTriggerHost() {
  // The chat's overflow/transform/container ancestors can clip fixed descendants
  // or change their coordinate system. Keep viewport controls beside the panel.
  const owner = document.getElementById(ROOT_ID);
  if (triggerHost?.isConnected && triggerHost.parentElement === owner) return triggerHost;
  triggerHost?.remove();
  triggerHost = create("div", {
    className: "mari-convo-viewer-trigger-host",
    attrs: { "data-mari-convo-viewer-trigger-host": "true" },
  });
  owner.append(triggerHost);
  return triggerHost;
}

function mountIcon(root) {
  if (!root) {
    cancelLauncherDrag();bindLauncherBounds(null);removeCompactSurface();
    trigger?.remove();triggerHost?.remove();triggerHost=null;
    dockDragCleanup?.();dockSection?.remove();dockSection=null;return;
  }
  // ChatSettingsDrawer unmounts its dock when closed. Placement stays docked
  // until the user pops it out, including startup before that drawer mounts.
  if (viewerLayouts[activeChatId]?.docked) {
    cancelLauncherDrag();bindLauncherBounds(null);removeCompactSurface();
    trigger?.remove();triggerHost?.remove();triggerHost=null;
    syncDockSection(root);return;
  }
  if (!trigger) trigger=makeToolbarTrigger();
  bindLauncherBounds(root);
  dockDragCleanup?.();dockSection?.remove();dockSection=null;
  if (desktopToolbarMedia.matches) {
    removeCompactSurface();trigger.removeAttribute('data-presentation');
    trigger.removeAttribute('data-chat-tools-menu-tool');trigger.classList.remove('mari-chat-tools-button');
    const host=ensureFallbackTriggerHost();
    if(trigger.parentElement!==host) host.append(trigger);
    scheduleLauncherPlacement();
  } else { cancelLauncherDrag();syncCompactLauncher(); }
  syncTriggerOpenState();
}

function makeActionIcon(kind) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const size = kind === "dock" ? 14 : "0.75rem";
  for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(key, String(value));
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", kind === "dock" ? "M9 10 4 5l5-5 M4 5h10a6 6 0 0 1 0 12h-2"
    : kind === "chevron" ? "m6 9 6 6 6-6"
    : "M15 3h6v6 M10 14 21 3 M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6");
  svg.append(path);
  return svg;
}

function revealChatSettings() {
  const slot = document.querySelector(DOCK_SELECTOR);
  const windowNode = slot?.closest(".mari-window");
  if (slot && windowNode && !windowNode.hidden && windowNode.getClientRects().length) return;
  document.querySelector('[data-chat-settings-button], [data-chat-toolbar-panel-action="settings"]')?.click();
}

async function setDocked(docked) {
  if (!activeChatId || instance.stopped) return;
  viewerLayouts[activeChatId] = { ...viewerLayouts[activeChatId], docked };
  panelOpen = true;
  if (docked) revealChatSettings();
  // Layout writes are serialized, so a fast put-in/take-out cannot restore an old state.
  const saving = saveViewerLayout();
  refreshForPage({ renderPanel: true, remountIcon: true });
  if (!docked) document.querySelector(".mari-convo-viewer-panel .mari-window__title")?.focus({ preventScroll: true });
  try { await saving; }
  catch { notice("버튼 배치를 저장하지 못했습니다. 다시 시도해 주세요.", "error"); }
}

function saveViewerLayout() {
  const snapshot = stateApi.clone(viewerLayouts);
  layoutSaveQueue = layoutSaveQueue.catch(() => {}).then(() => marinara.storage.patch({ convoViewerLayouts: snapshot }));
  return layoutSaveQueue;
}

function syncDockSectionState() {
  dockSection?.querySelector("[data-mari-convo-viewer-dock-toggle]")?.setAttribute("aria-expanded", String(panelOpen));
  dockSection?.querySelector(".mari-drawer__arrow")?.classList.toggle("rotate-180", panelOpen);
  const body = dockSection?.querySelector("[data-mari-convo-viewer-dock-body]");
  if (body) body.hidden = !panelOpen;
}

function syncDockSection(root) {
  const slot = document.querySelector(DOCK_SELECTOR);
  const list = slot?.parentElement;
  if (!list || !(root ?? conversationRoot())) return false;
  if (!dockSection) {
    dockSection = create("section", { className: "mari-drawer mari-convo-viewer-dock", attrs: { "data-mari-convo-viewer-dock": "true" } });
    const header = create("div", { className: "mari-drawer__header mari-convo-viewer-dock-header" });
    const toggle = create("button", {
      className: "mari-convo-viewer-dock-toggle flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
      type: "button",
      attrs: { "aria-controls": "mari-convo-viewer-dock-body", "data-mari-convo-viewer-dock-toggle": "true" },
    });
    const icon = create("span", { className: "mari-drawer__icon" });
    icon.append(makeIcon());
    toggle.append(icon, create("span", { className: "mari-drawer__title flex-1 text-xs font-semibold", text: "콘보모드 뷰어 설정" }));
    const actions = create("span", { className: "mari-drawer__actions flex items-center" });
    const popOut = makeIconButton("채팅 설정에서 꺼내기", () => void setDocked(false), makeActionIcon("popout"));
    // Same classes, ExternalLink path and 0.75rem size as Marinara's Drawer.
    popOut.className = "mari-drawer__popout inline-flex h-5 w-5 items-center max-md:-my-2 max-md:h-11 max-md:w-11 justify-center rounded-md text-[var(--mari-drawer-icon-color,var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";
    popOut.setAttribute("data-drawer-control", "pop-out");
    actions.append(popOut);
    actions.addEventListener("click", (event) => event.stopPropagation());
    const arrow = makeActionIcon("chevron");
    arrow.classList.add("mari-drawer__arrow", "transition-transform");
    header.append(toggle, actions, arrow);
    header.addEventListener("click", () => {
      panelOpen = !panelOpen;
      if (!panelOpen) draft = roomSettings();
      renderPanel();
      refreshForPage({ remountIcon: false });
    });
    const body = create("div", { className: "mari-drawer__body", attrs: { id: "mari-convo-viewer-dock-body", "data-mari-convo-viewer-dock-body": "true" } });
    dockSection.append(header, body);
    attachPanelDrag(dockSection, header, true);
  }
  // Keep the shared dock untouched; only our own section is placed at the end
  // of the ordered settings list. No theme/layout reads are needed here.
  if (dockSection.parentElement !== list) list.append(dockSection);
  syncDockSectionState();
  return true;
}

function handleNavigation(event) {
  // Plain text editing cannot navigate rooms. Preserve Enter/Escape, arrows
  // and modifier shortcuts, which can activate native navigation controls.
  const target = event.target;
  if (event.type === "keyup" && !event.ctrlKey && !event.metaKey && !event.altKey &&
      (event.key?.length === 1 || event.key === "Backspace" || event.key === "Delete") &&
      target instanceof Element &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
  if (isExtensionOwnedNode(target)) return;
  // A same-tab localStorage write has no storage event. Read the chat key once
  // after a navigation interaction; do work only when it actually changed.
  if (instance.stopped || navigationFrame) return;
  navigationFrame = requestAnimationFrame(() => {
    navigationFrame = 0;
    if (!instance.stopped && currentChatId() !== activeChatId) scheduleRefresh();
  });
}

function attachPanelDrag(panel, header, docked = false) {
  let drag = null;
  let frame = 0;
  let latest = null;
  let suppressClick = false;
  const clear = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    drag?.target?.removeAttribute("data-mari-convo-viewer-drop-target");
    panel.removeAttribute("data-dragging");
    drag = null;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
  const down = (event) => {
    if (event.button !== 0 || event.target.closest(docked ? "button:not([data-mari-convo-viewer-dock-toggle]),input,select,a" : "button,input,select,a") || !desktopToolbarMedia.matches) return;
    const target = document.querySelector(DOCK_SELECTOR)?.closest(".mari-window");
    const rect = target && !target.hidden && target.getClientRects().length ? target.getBoundingClientRect() : null;
    event.preventDefault();
    const own = panel.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, own, target, rect, moved: false };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const over = (event) => !!drag?.rect && event.clientX >= drag.rect.left && event.clientX <= drag.rect.right && event.clientY >= drag.rect.top && event.clientY <= drag.rect.bottom;
  const move = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    if (!drag.moved) header.setPointerCapture?.(event.pointerId);
    drag.moved = true;
    latest = { x: event.clientX, y: event.clientY, over: over(event) };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!drag) return;
      if (!docked) {
        panel.style.left = `${Math.max(0, Math.min(window.innerWidth - drag.own.width, drag.own.left + latest.x - drag.x))}px`;
        panel.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, drag.own.top + latest.y - drag.y))}px`;
        panel.style.right = "auto";
      }
      panel.setAttribute("data-dragging", "true");
      drag.target?.toggleAttribute("data-mari-convo-viewer-drop-target", latest.over);
    });
  };
  const up = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved;
    const inside = over(event);
    // Commit the release position even when it arrives before the pending frame.
    if (!docked && moved && event.type !== "pointercancel") {
      panel.style.left = `${Math.max(0, Math.min(window.innerWidth - drag.own.width, drag.own.left + event.clientX - drag.x))}px`;
      panel.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, drag.own.top + event.clientY - drag.y))}px`;
      panel.style.right = "auto";
    }
    clear();
    if (event.type === "pointercancel" || !moved) return;
    suppressClick = true;
    if (!docked && inside) void setDocked(true);
    if (docked && !inside) void setDocked(false);
  };
  const click = (event) => { if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopPropagation(); } };
  header.addEventListener("click", click, true);
  header.addEventListener("pointerdown", down);
  // Both headers live in extension-owned nodes. Only a window rerender needs
  // explicit cancellation; disconnected dock nodes are collected with handlers.
  const cleanup = () => {
    clear();
    header.removeEventListener("click", click, true);
    header.removeEventListener("pointerdown", down);
    if (docked) dockDragCleanup = null; else dragCleanup = null;
  };
  if (docked) dockDragCleanup = cleanup; else dragCleanup = cleanup;
}

function clampPanelGeometry(value) {
  const maxWidth = Math.max(1, window.innerWidth - 16);
  const maxHeight = Math.max(1, window.innerHeight - 16);
  const width = Math.max(Math.min(240, maxWidth), Math.min(value.width, maxWidth));
  const height = Math.max(Math.min(180, maxHeight), Math.min(value.height, maxHeight));
  return {
    left: Math.max(8, Math.min(value.left, window.innerWidth - width - 8)),
    top: Math.max(8, Math.min(value.top, window.innerHeight - height - 8)),
    width, height,
  };
}

function writePanelGeometry(panel, geometry) {
  panel.style.left = `${geometry.left}px`;
  panel.style.top = `${geometry.top}px`;
  panel.style.right = "auto";
  panel.style.width = `${geometry.width}px`;
  panel.style.height = `${geometry.height}px`;
  panel.style.maxHeight = "calc(100dvh - 1rem)";
}

function restorePanelSize(panel) {
  const layout = viewerLayouts[activeChatId];
  if (!desktopToolbarMedia.matches || !layout?.width || !layout?.height) return;
  panel.style.width = `${Math.min(layout.width, window.innerWidth - 32)}px`;
  panel.style.height = `${Math.min(layout.height, Math.max(180, window.innerHeight - 88))}px`;
  panel.style.maxHeight = "calc(100dvh - 1rem)";
}

function attachPanelResize(panel) {
  const handle = create("button", {
    className: "mari-window__resize-handle",
    type: "button",
    attrs: { "data-edge": "se", "aria-label": "뷰어 창 크기 조절", title: "뷰어 창 크기 조절" },
  });
  handle.append(create("span", { className: "mari-window__resize-grip", attrs: { "aria-hidden": "true" } }));
  panel.append(handle);
  const roomId = activeChatId;
  let session = null;
  let frame = 0;
  let pending = null;
  let keyboardGeometry = null;
  const saveSize = (geometry) => {
    if (!geometry || instance.stopped || activeChatId !== roomId) return;
    viewerLayouts[roomId] = { ...viewerLayouts[roomId], width: geometry.width, height: geometry.height };
    void saveViewerLayout().catch(() => notice("창 크기를 저장하지 못했습니다. 다시 시도해 주세요.", "error"));
  };
  const resizeFrom = (start, dx, dy) => clampPanelGeometry({
    ...start,
    width: Math.min(start.width + dx, window.innerWidth - start.left - 8),
    height: Math.min(start.height + dy, window.innerHeight - start.top - 8),
  });
  const clear = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pending = null;
    session = null;
    panel.removeAttribute("data-resizing");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
  const down = (event) => {
    if (!desktopToolbarMedia.matches || event.button !== 0 || session) return;
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture?.(event.pointerId);
    handle.focus({ preventScroll: true });
    // Read layout once per user gesture, never from a DOM mutation callback.
    const rect = panel.getBoundingClientRect();
    session = { id: event.pointerId, x: event.clientX, y: event.clientY, start: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, style: panel.getAttribute("style") };
    panel.setAttribute("data-resizing", "true");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const move = (event) => {
    if (!session || session.id !== event.pointerId) return;
    pending = resizeFrom(session.start, event.clientX - session.x, event.clientY - session.y);
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      if (pending && session) writePanelGeometry(panel, pending);
    });
  };
  const up = (event) => {
    if (!session || session.id !== event.pointerId) return;
    const previous = session;
    const geometry = resizeFrom(session.start, event.clientX - session.x, event.clientY - session.y);
    clear();
    if (event.type === "pointercancel") {
      if (previous.style === null) panel.removeAttribute("style"); else panel.setAttribute("style", previous.style);
      return;
    }
    if (geometry.width === previous.start.width && geometry.height === previous.start.height) return;
    writePanelGeometry(panel, geometry);
    saveSize(geometry);
  };
  const keydown = (event) => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta || !desktopToolbarMedia.matches) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = panel.getBoundingClientRect();
    const step = event.shiftKey ? 32 : 8;
    keyboardGeometry = resizeFrom({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }, delta[0] * step, delta[1] * step);
    writePanelGeometry(panel, keyboardGeometry);
  };
  const commitKeyboard = () => {
    if (!keyboardGeometry) return;
    saveSize(keyboardGeometry);
    keyboardGeometry = null;
  };
  handle.addEventListener("pointerdown", down);
  handle.addEventListener("keydown", keydown);
  handle.addEventListener("keyup", commitKeyboard);
  handle.addEventListener("blur", commitKeyboard);
  resizeCleanup = () => {
    clear();
    commitKeyboard();
    handle.removeEventListener("pointerdown", down);
    handle.removeEventListener("keydown", keydown);
    handle.removeEventListener("keyup", commitKeyboard);
    handle.removeEventListener("blur", commitKeyboard);
    resizeCleanup = null;
  };
}

function handlePanelViewportResize() {
  if (viewportFrame || instance.stopped) return;
  viewportFrame = requestAnimationFrame(() => {
    viewportFrame = 0;
    if (instance.stopped) return;
    const panel = document.querySelector(".mari-convo-viewer-panel");
    if (!panel) return;
    if (!desktopToolbarMedia.matches) {
      // The phone sheet uses its responsive default, preserving desktop size.
      for (const property of ["width", "height", "left", "right", "top", "max-height"]) panel.style.removeProperty(property);
    } else if (panel.style.width) {
      const rect = panel.getBoundingClientRect();
      writePanelGeometry(panel, clampPanelGeometry({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }));
    } else restorePanelSize(panel);
  });
}

function selectedPreset() { return savedState.presets.find((preset) => preset.id === selectedPresetId) ?? null; }
function notice(text, error = false) { const node = document.querySelector("[data-mari-convo-viewer-notice]"); if (node) { node.textContent = text; node.dataset.kind = error === true || error === "error" ? "error" : "info"; } }

function renderPresets(container) {
  const section = create("section", { className: "mari-convo-viewer-preset-section" });
  section.append(create("h3", { text: "뷰어 프리셋" }));
  const select = selectInput(
    selectedPresetId,
    [{ value: "room", label: "이 채팅방 설정 유지" }, ...savedState.presets.map((preset) => ({ value: preset.id, label: preset.name }))],
    (value) => {
      selectedPresetId = value;
      draft = selectedPreset() ? stateApi.applyPreset(selectedPreset()) : roomSettings();
      refreshForPage({ renderPanel: false, remountIcon: false });
      renderPanel();
      notice("프리셋을 불러왔습니다. ‘적용’을 누르면 현재 방에 저장됩니다.");
    },
  );
  select.setAttribute("aria-label", "뷰어 프리셋");
  const selection = create("div", { className: "mari-convo-viewer-preset-selection" });
  selection.append(select);
  section.append(selection);
  const actions = create("div", { className: "mari-convo-viewer-preset-actions flex items-center gap-1" });
  const preset = selectedPreset();
  const action = (label, kind, callback, disabled = false) => {
    const node = create("button", {
      className: `mari-convo-viewer-preset-action flex-1 flex items-center justify-center rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors ${kind === "delete" ? "hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]" : "hover:bg-[var(--accent)] hover:text-[var(--foreground)]"} disabled:cursor-not-allowed disabled:opacity-40`,
      type: "button", title: label, disabled, attrs: { "aria-label": label, "data-preset-action": kind },
    });
    node.append(makePresetActionIcon(kind));
    node.addEventListener("click", () => {
      Promise.resolve().then(callback).catch((error) => notice(error instanceof Error ? error.message : "프리셋 작업을 완료하지 못했습니다.", "error"));
    });
    return node;
  };
  actions.append(
    action("저장", "save", async () => {
      const preset = selectedPreset();
      if (!preset) return;
      await persist(stateApi.updatePreset(savedState, preset.id, draft, preset.includeBackgroundImageRef));
      notice("선택한 프리셋을 저장했습니다.");
    }, !preset),
    action("수정", "rename", () => {
      const preset = selectedPreset();
      if (!preset || selection.querySelector("input")) return;
      const input = create("input", { attrs: { type: "text", value: preset.name, maxlength: 40, "aria-label": "프리셋 이름 수정" } });
      let finished = false;
      const finish = async (cancel = false) => {
        if (finished) return;
        finished = true;
        try {
          if (!cancel && input.value.trim() !== preset.name) await persist(stateApi.renamePreset(savedState, preset.id, input.value));
          if (instance.stopped || !section.isConnected) return;
          renderPanel();
          if (!cancel) notice("프리셋 이름을 수정했습니다.");
        } catch (error) {
          if (section.isConnected) { renderPanel(); notice(error instanceof Error ? error.message : "이름을 수정하지 못했습니다.", "error"); }
        }
      };
      input.addEventListener("blur", () => void finish());
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== "Escape") return;
        event.preventDefault(); event.stopPropagation();
        void finish(event.key === "Escape");
      });
      selection.replaceChildren(input);
      input.focus({ preventScroll: true }); input.select();
    }, !preset),
    action("새 프리셋", "create", async () => {
      const name = window.prompt("새 프리셋 이름을 입력해 주세요. (1~40자)", preset ? `${preset.name} 복사` : "");
      if (name == null) return;
      const result = stateApi.addPreset(savedState, name, draft, false);
      await persist(result.state);
      selectedPresetId = result.preset.id;
      renderPanel();
      notice("새 프리셋을 저장했습니다.");
    }),
    create("span", { className: "mari-convo-viewer-preset-divider mx-1 h-4 w-px shrink-0 bg-[var(--border)]", attrs: { "aria-hidden": "true" } }),
    action("프리셋 가져오기", "import", requestPresetImport),
    action("프리셋 내보내기", "export", downloadPresets, !preset),
    action("삭제", "delete", async () => {
      const preset = selectedPreset();
      if (!preset || !window.confirm(`“${preset.name}” 프리셋만 삭제할까요? 이미 방에 적용한 설정은 유지됩니다.`)) return;
      await persist(stateApi.deletePreset(savedState, preset.id));
      selectedPresetId = "room";
      draft = roomSettings();
      refreshForPage({ renderPanel: false, remountIcon: false });
      renderPanel();
      notice("선택한 프리셋을 삭제했습니다.");
    }, !preset),
  );
  section.append(actions);
  container.append(section);
}

function renderTheme(panel) {
  panel.append(themeGroup("내 말풍선", [
    field("글자 색", colorControl(draft.theme.ownTextColor, "#202028", "내 글자색", (value) => updateDraft((next) => { next.theme.ownTextColor = value; }))),
    field("말풍선 배경색", colorControl(draft.theme.ownBubbleColor, "#d8e2ff", "내 말풍선 배경색", (value) => updateDraft((next) => { next.theme.ownBubbleColor = value; })), "Bubbles 형에서만 보입니다."),
    field("말풍선 선", borderControl(draft.theme.ownBubbleBorderMode, draft.theme.ownBubbleBorderColor, draft.theme.ownBubbleBorderStyle, draft.theme.ownBubbleBorderWidthPt, "내 말풍선 선", (mode, color, style, widthPt) => updateDraft((next) => { next.theme.ownBubbleBorderMode = mode; next.theme.ownBubbleBorderColor = color; next.theme.ownBubbleBorderStyle = style; next.theme.ownBubbleBorderWidthPt = widthPt; }))),
  ]));
  panel.append(themeGroup("상대 말풍선", [
    field("글자 색", colorControl(draft.theme.otherTextColor, "#202028", "상대 글자색", (value) => updateDraft((next) => { next.theme.otherTextColor = value; }))),
    field("말풍선 배경색", colorControl(draft.theme.otherBubbleColor, "#eeeeee", "상대 말풍선 배경색", (value) => updateDraft((next) => { next.theme.otherBubbleColor = value; })), "Bubbles 형에서만 보입니다."),
    field("말풍선 선", borderControl(draft.theme.otherBubbleBorderMode, draft.theme.otherBubbleBorderColor, draft.theme.otherBubbleBorderStyle, draft.theme.otherBubbleBorderWidthPt, "상대 말풍선 선", (mode, color, style, widthPt) => updateDraft((next) => { next.theme.otherBubbleBorderMode = mode; next.theme.otherBubbleBorderColor = color; next.theme.otherBubbleBorderStyle = style; next.theme.otherBubbleBorderWidthPt = widthPt; }))),
  ]));
  panel.append(themeGroup("공통 말풍선", [
    field("말풍선 모양", selectInput(draft.theme.bubbleShape, [{ value: "round", label: "원형" }, { value: "square", label: "사각형" }, { value: "droplet", label: "물방울형" }], (value) => updateDraft((next) => { next.theme.bubbleShape = value; }))),
    field("말풍선 분리하기", checkbox(draft.theme.splitBubbles, "줄바꿈마다 분리", (checked) => updateDraft((next) => { next.theme.splitBubbles = checked; }))),
  ]));
}

function renderText(panel) {
  const knownFonts = [...new Set(fonts.map((font) => typeof font === "string" ? font : font?.family).map((font) => stateApi.cleanFontFamily(font)).filter(Boolean))];
  panel.append(field("글꼴", selectInput(draft.text.fontFamily ?? "", [{ value: "", label: "현재 테마 글꼴" }, ...knownFonts.map((font) => ({ value: font, label: font }))], (value) => updateDraft((next) => { next.text.fontFamily = value || null; }))));
  panel.append(checkbox(draft.text.applyFontToInput, "인풋창에 글꼴 적용하기", (checked) => updateDraft((next) => { next.text.applyFontToInput = checked; })));
  panel.append(stepper("글자 크기", draft.text.fontSizePx, 12, 32, "px", (value) => updateDraft((next) => { next.text.fontSizePx = value; })));
}

function safeUploadName(file) {
  const extension = (/\.(jpe?g|png|gif|webp|avif)$/iu.exec(file.name)?.[0] ?? ".png").toLowerCase();
  let token = "";
  try {
    token = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : "";
  } catch {
    token = "";
  }
  if (!token) token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  return `convo-background-${token}${extension}`;
}

function renderBackground(panel) {
  panel.append(field("배경색", colorControl(draft.background.color, "#28283a", "배경색", (value) => updateDraft((next) => { next.background.color = value; })), "끄면 현재 테마의 배경색을 사용합니다."));
  const choices = [{ value: "", label: "사진 없음" }, ...backgrounds.filter((item) => item?.url && item?.filename).map((item) => ({ value: item.url, label: item.filename }))];
  panel.append(field("배경 사진", selectInput(draft.background.imageRef ?? "", choices, (value) => updateDraft((next) => { next.background.imageRef = value || null; }))));
  const opacity = create("input", { attrs: { type: "range", min: 0, max: 100, step: 1, value: draft.background.imageOpacity, "aria-label": "사진 투명도" } });
  opacity.addEventListener("input", () => { updateDraft((next) => { next.background.imageOpacity = Number(opacity.value); }); document.querySelector("[data-mari-convo-viewer-opacity]")?.replaceChildren(document.createTextNode(`${opacity.value}%`)); });
  const opacityRow = create("div", { className: "mari-convo-viewer-range" }); opacityRow.append(create("span", { text: "사진 투명도" }), create("output", { text: `${draft.background.imageOpacity}%`, attrs: { "data-mari-convo-viewer-opacity": "true" } }), opacity); panel.append(opacityRow);
  const upload = create("input", { attrs: { type: "file", accept: ".jpg,.jpeg,.png,.gif,.webp,.avif,image/*", "aria-label": "새 배경 사진 올리기" } });
  upload.addEventListener("change", async () => {
    const roomId = activeChatId;
    const file = upload.files?.[0]; if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) return notice("배경 사진은 20MB 이하만 올릴 수 있습니다.", true);
    try {
      const form = new FormData(); form.append("file", file, safeUploadName(file));
      notice("사진을 Marinara 배경 라이브러리에 저장하고 있습니다.");
      const response = await hostRequest("/api/backgrounds/upload", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || !result?.url || !/^\/api\/backgrounds\/file\//u.test(result.url)) throw new Error(result?.error || "사진을 올리지 못했습니다.");
      backgrounds = [...backgrounds, { filename: result.filename, url: result.url }];
      if (instance.stopped || activeChatId !== roomId) return;
      updateDraft((next) => { next.background.imageRef = result.url; }); renderPanel(); notice("사진을 선택했습니다. ‘적용’을 눌러 저장해 주세요.");
    } catch (error) { notice(error instanceof Error ? error.message : "사진을 올리지 못했습니다.", true); }
  });
  panel.append(field("새 배경 사진 올리기", upload, "JPG, PNG, GIF, WebP, AVIF만 20MB까지 가능합니다. 사진 원본은 Marinara에 저장되며 위치정보가 남을 수 있습니다."));
  panel.append(checkbox(draft.background.topBarHidden, "이 콘보방에서 상단바 숨기기", (checked) => updateDraft((next) => { next.background.topBarHidden = checked; })));
  panel.append(checkbox(draft.background.hideCharacterAvatars, "캐릭터 아바타 숨기기", (checked) => updateDraft((next) => { next.background.hideCharacterAvatars = checked; })));
}

function renderPanel() {
  if (instance.stopped) return;
  const panelHost = document.querySelector("[data-mari-convo-viewer-panel-host]");
  if (!panelHost) return;
  const previousPanel = panelHost.querySelector(".mari-convo-viewer-panel");
  dragCleanup?.();
  resizeCleanup?.();
  const previousBody = previousPanel?.querySelector(".mari-convo-viewer-panel-body") ?? dockSection?.querySelector(".mari-convo-viewer-panel-body");
  const previousStyle = previousPanel?.getAttribute("style");
  const previousScrollTop = previousBody?.scrollTop ?? 0;
  const previousScrollLeft = previousBody?.scrollLeft ?? 0;
  panelHost.replaceChildren();
  dockSection?.querySelector("[data-mari-convo-viewer-dock-body]")?.replaceChildren();
  if (!panelOpen) { syncDockSectionState(); return; }
  if (viewerLayouts[activeChatId]?.docked && !syncDockSection()) return;
  const panel = create("aside", { className: "mari-window marinara-chat-popover mari-convo-viewer-panel", attrs: { tabindex: "-1", role: "dialog", "aria-modal": "false", "aria-label": "콘보모드 뷰어 설정", "data-presentation": desktopToolbarMedia.matches ? "window" : "sheet" } });
  const header = create("div", { className: "mari-window__header mari-convo-viewer-header" });
  const closeButton = makeButton("×", () => {
    draft = roomSettings();
    temporaryHeaderVisible = false;
    panelOpen = false;
    syncTriggerOpenState();
    renderPanel();
    refreshForPage({ renderPanel: false, remountIcon: false });
    trigger?.focus({ preventScroll: true });
  }, { variant: "close", title: "닫기" });
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeButton.click();
  });
  closeButton.className = "mari-window__control";
  closeButton.setAttribute("aria-label", "닫기");
  const controls = create("div", { className: "mari-window__controls mari-convo-viewer-window-controls" });
  const dockButton = makeIconButton("채팅 설정에 넣기", () => void setDocked(true), makeActionIcon("dock"));
  dockButton.className = "mari-window__control";
  controls.append(dockButton, closeButton);
  const title = create("h2", { className: "mari-window__title", attrs: { tabindex: "-1" }, text: "콘보모드 뷰어 설정" });
  header.append(title, controls);
  panel.append(header);
  const noticeNode = create("p", { className: "mari-convo-viewer-notice", attrs: { "data-mari-convo-viewer-notice": "true", "aria-live": "polite" } });
  panel.append(noticeNode);
  const body = create("div", { className: "mari-window__body marinara-chat-popover__scroll mari-convo-viewer-panel-body" });
  panel.append(body);
  if (!activeChatId || !conversationRoot()) {
    noticeNode.textContent = "콘보 채팅방을 연 뒤 사용할 수 있습니다.";
    panelHost.append(panel);
    return;
  }
  const enabled = checkbox(draft.enabled, "이 방에서 뷰어 사용", (checked) => updateDraft((next) => { next.enabled = checked; }));
  body.append(enabled);
  renderPresets(body);
  const tabs = create("div", { className: "mari-convo-viewer-tabs", attrs: { role: "tablist", "aria-label": "뷰어 설정 탭" } });
  for (const [id, label] of [["theme", "테마"], ["text", "텍스트"], ["background", "배경"]]) {
    const tab = makeButton(label, () => { activeTab = id; renderPanel(); }, { variant: activeTab === id ? "active" : "" });
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(activeTab === id));
    tabs.append(tab);
  }
  body.append(tabs);
  const content = create("div", { className: "mari-convo-viewer-tab-content" });
  if (activeTab === "theme") renderTheme(content);
  if (activeTab === "text") renderText(content);
  if (activeTab === "background") renderBackground(content);
  body.append(content);
  const footer = create("div", { className: "mari-convo-viewer-footer" });
  footer.append(
    makeButton("적용", async () => {
      const next = stateApi.normalizeState(savedState);
      next.rooms[activeChatId] = stateApi.cleanRoomSettings(draft);
      await persist(next);
      notice("현재 방에 설정을 저장했습니다.");
    }, { variant: "primary" }),
    makeButton("초기화", async () => {
      if (!window.confirm("현재 방의 뷰어 설정만 초기화할까요? 다른 방과 프리셋은 유지됩니다.")) return;
      const roomId = activeChatId;
      const next = stateApi.normalizeState(savedState);
      delete next.rooms[roomId];
      await persist(next);
      if (activeChatId !== roomId || instance.stopped) return;
      draft = stateApi.defaultRoomSettings();
      refreshForPage({ renderPanel: false, remountIcon: false });
      renderPanel();
    }, { variant: "danger" }),
  );
  body.append(footer);
  panelHost.append(panel);
  if (viewerLayouts[activeChatId]?.docked) {
    dockSection.querySelector("[data-mari-convo-viewer-dock-body]").append(noticeNode, body);
    panel.remove();
  } else {
    if (previousStyle && desktopToolbarMedia.matches) panel.setAttribute("style", previousStyle);
    else restorePanelSize(panel);
    attachPanelDrag(panel, header);
    attachPanelResize(panel);
  }
  body.scrollTop = previousScrollTop;
  body.scrollLeft = previousScrollLeft;
}

function refreshForPage({ renderPanel: rebuild = false, remountIcon = true } = {}) {
  refresh(rebuild, remountIcon);
}

function refresh(render = false, remountIcon = true) {
  if (instance.stopped) return;
  const root = conversationRoot();
  const nextId = currentChatId();
  if (!root && panelOpen) { panelOpen = false; renderPanel(); }
  const changedChat = nextId !== activeChatId;
  const changedRoot = root !== appliedRoot;
  if (changedChat) {
    cancelLauncherDrag(); dragCleanup?.(); resizeCleanup?.(); dockDragCleanup?.();
    dockSection?.remove(); dockSection = null;
    activeChatId = nextId; draft = roomSettings(); selectedPresetId = "room";
    temporaryHeaderVisible = false;
    if (headerTimer) marinara.clearTimeout(headerTimer);
    headerTimer = 0;
  }
  if (appliedRoot && appliedRoot !== root) clearApplied(appliedRoot);
  const showPreview = root && activeChatId && (panelOpen || savedState.rooms[activeChatId]);
  const shouldApply = showPreview && draft.enabled;
  const settingsKey = shouldApply ? JSON.stringify(draft) : null;
  if (shouldApply && (changedRoot || appliedSettingsKey !== settingsKey)) {
    contentObserver?.disconnect();
    apply(root, draft);
    appliedSettingsKey = settingsKey;
  } else if (!shouldApply && appliedRoot) clearApplied();
  // Header visibility changes do not require reapplying settings or scanning messages.
  document.documentElement.toggleAttribute("data-mari-convo-viewer-topbar-hidden", Boolean(showPreview && draft.enabled && draft.background.topBarHidden && !temporaryHeaderVisible));
  if (remountIcon || changedChat) mountIcon(root);
  observeRuntime(root, Boolean(showPreview && draft.enabled && draft.theme.splitBubbles));
  const bodyMissing = panelOpen && (viewerLayouts[activeChatId]?.docked
    ? dockSection?.isConnected && !dockSection.querySelector('.mari-convo-viewer-panel-body')
    : !document.querySelector('.mari-convo-viewer-panel-body'));
  if (render || changedChat || bodyMissing) renderPanel();
}

let refreshRemount = false;
function scheduleRefresh(remountIcon = true) {
  if (instance.stopped) return;
  refreshRemount ||= remountIcon;
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const remount = refreshRemount; refreshRemount = false;
    refresh(false, remount);
  });
}

function revealHeaderFromTopEdge(event) {
  if (event.clientY > 48 || !draft.enabled || !draft.background.topBarHidden || !conversationRoot()) return;
  if (event.target instanceof Element && event.target.closest("button,input,select,textarea,a,[role=button]")) return;
  temporaryHeaderVisible = true;
  if (headerTimer) marinara.clearTimeout(headerTimer);
  headerTimer = marinara.setTimeout(() => { temporaryHeaderVisible = false; headerTimer = 0; refresh(false, false); }, TOPBAR_REVEAL_MS);
  refresh(false, false);
}

function isExtensionOwnedNode(node) {
  if (!(node instanceof Element)) return node?.parentElement ? isExtensionOwnedNode(node.parentElement) : false;
  return Boolean(node.closest(`#${ROOT_ID}, ${TRIGGER_SELECTOR}, ${TRIGGER_HOST_SELECTOR}, [data-mari-convo-viewer-dock], [data-mari-convo-viewer-menu-row], .${SPLIT_DISPLAY_CLASS}`));
}

// Track direct children along host paths, including the two persistent v2.5.0
// backing panes. They exist before Home/RestoringChat/lazy chat surfaces mount.
// Visibility attributes are limited to these panes and conversation ancestors;
// composer keystrokes, streaming and AppShell theme changes stay outside them.
function observeRuntime(root, splitEnabled) {
  const targets = new Map([[document.body, false]]);
  const center = document.querySelector('[data-component="CenterContent"]');
  const panes = center ? [...center.querySelectorAll(':scope > .mari-app-background-paint, :scope > .mari-app-background-paint > .mari-app-background-paint')] : [];
  const surface = document.querySelector('[data-component="ChatArea.Conversation"]');
  const nativeMenu = document.querySelector('[data-chat-tools-menu]');
  const anchors = [root, surface, ...panes,
    document.querySelector('[data-component="ChatArea.Roleplay"]'), document.getElementById('root'), document.querySelector('[data-component="AppShell"]'),
    center, document.querySelector(DOCK_SELECTOR),
    document.querySelector('[data-chat-settings-button]'), document.querySelector('[data-chat-tools-menu-button]'),
    nativeMenu, nativeMenu?.lastElementChild];
  // An already registered node's ancestors are registered too. Keep every
  // anchor, but walk each shared path only once.
  for (const anchor of anchors) for (let node = anchor; node && node !== document.body && !targets.has(node); node = node.parentElement) targets.set(node, false);
  // A hidden conversation is excluded by conversationRoot(), but must still be
  // watched so removing React Suspense's display:none can reveal its launcher.
  const conversation = root ?? surface?.querySelector('div.mari-chat-area[data-chat-mode="conversation"]');
  for (const anchor of [conversation, surface, ...panes]) {
    for (let node = anchor; node && node !== center && node !== document.body && node.dataset.component !== 'AppShell'; node = node.parentElement) targets.set(node, true);
  }
  if (targets.size !== structureTargets.size || [...targets].some(([node, visibility]) => structureTargets.get(node) !== visibility)) {
    structureObserver?.disconnect();
    structureTargets = targets;
    for (const [target, visibility] of targets) structureObserver?.observe(target, visibility
      ? { childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'], attributeOldValue: true }
      : { childList: true });
  }
  const transcript = splitEnabled ? conversationScroll(root) : null;
  if (transcript !== observedTranscript) {
    contentObserver?.disconnect();
    pendingSplitScopes.clear();
    observedTranscript = transcript;
  }
  // Only the optional split-bubble feature needs transcript mutations. Class
  // records are filtered to message surfaces before any work is scheduled.
  if (transcript) contentObserver?.observe(transcript, { childList: true, characterData: true, attributes: true, attributeFilter: ['class'], subtree: true });
}

function queueSplitScope(node) {
  if (!(node instanceof Element) || isExtensionOwnedNode(node)) return;
  const message = node.closest(MESSAGE_CONTAINER_SELECTOR);
  if (message) { pendingSplitScopes.add(message); return; }
  for (const message of node.querySelectorAll(MESSAGE_CONTAINER_SELECTOR)) pendingSplitScopes.add(message);
}

function scheduleSplits(records) {
  for (const record of records) {
    const target = record.target instanceof Element ? record.target : record.target.parentElement;
    if (isExtensionOwnedNode(target)) continue;
    if (record.type === 'attributes' && !target?.matches(`${MESSAGE_CONTAINER_SELECTOR}, .mari-message-bubble`)) continue;
    if (record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].every(isExtensionOwnedNode)) continue;
    if (target?.closest(MESSAGE_CONTAINER_SELECTOR)) queueSplitScope(target);
    for (const node of record.addedNodes) if (node instanceof Element) queueSplitScope(node);
  }
  if (splitFrame || !pendingSplitScopes.size) return;
  splitFrame = requestAnimationFrame(() => {
    splitFrame = 0;
    if (instance.stopped || !observedTranscript?.isConnected) return;
    const scopes = [...pendingSplitScopes]; pendingSplitScopes.clear();
    contentObserver.disconnect();
    const snapshot = captureScrollPosition(appliedRoot);
    let changed = false;
    for (const scope of scopes) if (observedTranscript.contains(scope)) changed = syncBubbleSplits(scope, true) || changed;
    if (changed) restoreScrollPosition(snapshot);
    contentObserver.observe(observedTranscript, { childList: true, characterData: true, attributes: true, attributeFilter: ['class'], subtree: true });
  });
}

function mountHost() {
  document.getElementById(ROOT_ID)?.remove();
  const root = create("div", { attrs: { id: ROOT_ID } });
  root.append(create("div", { attrs: { "data-mari-convo-viewer-panel-host": "true" } }));
  document.body.append(root);
}

function visibilityChanged(record) {
  if (record.attributeName === 'class') return (record.oldValue ?? '').split(/\s+/u).includes('hidden') !== record.target.classList.contains('hidden');
  if (record.attributeName === 'hidden') return (record.oldValue !== null) !== record.target.hasAttribute('hidden');
  if (record.attributeName === 'style') {
    // No inline display before or after means visibility cannot have changed.
    // Escaped CSS property names still take the full CSS parser path.
    if (!record.target.style.display && !/display|\\/iu.test(record.oldValue ?? '')) return false;
    visibilityStyle.cssText = record.oldValue ?? '';
    return visibilityStyle.display !== record.target.style.display;
  }
  return false;
}

structureObserver = new MutationObserver(records => {
  if (instance.stopped) return;
  if (records.some(record => record.type === 'attributes' ? visibilityChanged(record)
    : [...record.addedNodes, ...record.removedNodes].some(node => !isExtensionOwnedNode(node)))) scheduleRefresh();
});
contentObserver = new MutationObserver(records => {
  if (instance.stopped) return;
  if (currentChatId() !== activeChatId) { scheduleRefresh(); return; }
  scheduleSplits(records);
});
function handleToolbarViewportChange() {
  if (instance.stopped) return;
  cancelLauncherDrag();
  refresh(false, true);
  handlePanelViewportResize();
  document.querySelector('.mari-convo-viewer-panel')?.setAttribute('data-presentation', desktopToolbarMedia.matches ? 'window' : 'sheet');
}

instance.stop = stopRuntime;
mountHost();
activeChatId = currentChatId(); draft = roomSettings();
desktopToolbarMedia.addEventListener?.('change', handleToolbarViewportChange);
document.addEventListener('click', revealHeaderFromTopEdge, true);
document.addEventListener('click', handleNavigation, true);
document.addEventListener('keyup', handleNavigation, true);
window.addEventListener('storage', handleNavigation);
window.addEventListener('resize', handlePanelViewportResize);
window.addEventListener('resize', scheduleLauncherPlacement);
window.visualViewport?.addEventListener('resize', scheduleLauncherPlacement);
document.addEventListener('pointerup', handleNativeBubbleRelease, true);
document.addEventListener('pointerdown', handleLauncherOutside, true);
document.addEventListener('keydown', handleCompactEscape, true);
refresh();
void loadResources();

function stopRuntime() {
  if (instance.stopped) return;
  instance.stopped = true;
  for (const id of [frame, navigationFrame, splitFrame, viewportFrame]) if (id) cancelAnimationFrame(id);
  if (headerTimer) marinara.clearTimeout(headerTimer);
  presetImportInput?.remove(); presetImportInput = null;
  cancelLauncherDrag(); bindLauncherBounds(null); removeCompactSurface();
  structureObserver?.disconnect(); contentObserver?.disconnect();
  pendingSplitScopes.clear(); structureTargets.clear();
  dragCleanup?.(); resizeCleanup?.(); dockDragCleanup?.();
  dockSection?.remove(); trigger?.remove(); triggerHost?.remove();
  desktopToolbarMedia.removeEventListener?.('change', handleToolbarViewportChange);
  document.removeEventListener('click', revealHeaderFromTopEdge, true);
  document.removeEventListener('click', handleNavigation, true);
  document.removeEventListener('keyup', handleNavigation, true);
  window.removeEventListener('storage', handleNavigation);
  window.removeEventListener('resize', handlePanelViewportResize);
  window.removeEventListener('resize', scheduleLauncherPlacement);
  window.visualViewport?.removeEventListener('resize', scheduleLauncherPlacement);
  document.removeEventListener('pointerup', handleNativeBubbleRelease, true);
  document.removeEventListener('pointerdown', handleLauncherOutside, true);
  document.removeEventListener('keydown', handleCompactEscape, true);
  clearApplied(); document.getElementById(ROOT_ID)?.remove();
  if (globalThis[INSTANCE_KEY] === instance) delete globalThis[INSTANCE_KEY];
}
return stopRuntime;
