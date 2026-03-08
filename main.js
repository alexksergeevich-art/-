const VER = "dragon-fsm-devpanel-20260308";

const stage = document.getElementById("stage");
const ringsLayer = document.getElementById("ringsLayer");
const entitiesLayer = document.getElementById("entitiesLayer");
const fxLayer = document.getElementById("fxLayer");
const debugLayer = document.getElementById("debugLayer");
const dragonEl = document.getElementById("dragon");
const dragonSpriteEl = document.getElementById("dragonSprite");
const dragonHPFill = document.getElementById("dragonHP");
const dragonLabel = document.getElementById("dragonLabel");
const moveMarker = document.getElementById("moveMarker");
const statusText = document.getElementById("statusText");
const spawnButtons = [...document.querySelectorAll(".spawnBtn")];
const devToggleBtn = document.getElementById("devToggleBtn");
const devPanel = document.getElementById("devPanel");
const devTarget = document.getElementById("devTarget");
const devTargetName = document.getElementById("devTargetName");
const devX = document.getElementById("devX");
const devY = document.getElementById("devY");
const devExport = document.getElementById("devExport");
const devCopyBtn = document.getElementById("devCopyBtn");
const devSaveBtn = document.getElementById("devSaveBtn");
const devResetBtn = document.getElementById("devResetBtn");
const devStat = document.getElementById("devStat");
const devInputs = {
  heroScale1: document.getElementById("heroScale1"),
  heroScale2: document.getElementById("heroScale2"),
  heroScale3: document.getElementById("heroScale3"),
  heroScale4: document.getElementById("heroScale4"),
  heroScale5: document.getElementById("heroScale5"),
  dragonScale: document.getElementById("dragonScale"),
  heroNearScale: document.getElementById("heroNearScale"),
  heroFarScale: document.getElementById("heroFarScale"),
  dragonNearScale: document.getElementById("dragonNearScale"),
  dragonFarScale: document.getElementById("dragonFarScale"),
  perspectiveNearShift: document.getElementById("perspectiveNearShift"),
  perspectiveFarShift: document.getElementById("perspectiveFarShift"),
  aoeRadiusX: document.getElementById("aoeRadiusX"),
  aoeRadiusY: document.getElementById("aoeRadiusY"),
  sideRadiusX: document.getElementById("sideRadiusX"),
  sideRadiusY: document.getElementById("sideRadiusY"),
};

const hitSfx = new Audio(`assets/sound/hit.mp3?v=${VER}`);
const dragonHitSfx = new Audio(`assets/sound/dragon_hit.mp3?v=${VER}`);
const dragonRoarSfx = new Audio(`assets/sound/dragon_roar.mp3?v=${VER}`);
const audioPool = [hitSfx, dragonHitSfx, dragonRoarSfx];
audioPool.forEach((audio) => { audio.preload = "auto"; audio.load(); });
hitSfx.volume = 0.52;
dragonHitSfx.volume = 0.70;
dragonRoarSfx.volume = 0.78;
let audioUnlocked = false;
let audioCtx = null;
let heroUid = 1;

function ensureAudioCtx(){
  if (!audioCtx){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx?.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}
function toneAt(time, freqStart, freqEnd, duration, gainStart, gainEnd, type = "sine"){
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), time + duration);
  gain.gain.setValueAtTime(gainStart, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainEnd), time + duration);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(time); osc.stop(time + duration);
}
function noiseBurst(duration = 0.12, gainValue = 0.05, highpass = 420){
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = highpass;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  src.start(); src.stop(ctx.currentTime + duration);
}
function playSynth(kind){
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime + 0.005;
  if (kind === "spawn"){
    toneAt(t, 140, 260, 0.18, 0.001, 0.055, "triangle");
    toneAt(t + 0.03, 280, 520, 0.22, 0.001, 0.038, "sine");
    noiseBurst(0.16, 0.018, 600);
  } else if (kind === "move"){
    toneAt(t, 420, 520, 0.06, 0.001, 0.018, "triangle");
  } else if (kind === "slash"){
    toneAt(t, 600, 180, 0.07, 0.001, 0.035, "sawtooth");
    noiseBurst(0.06, 0.02, 900);
  } else if (kind === "death"){
    toneAt(t, 180, 70, 0.26, 0.001, 0.045, "sawtooth");
    noiseBurst(0.22, 0.026, 260);
  } else if (kind === "evolve"){
    toneAt(t, 180, 700, 0.42, 0.001, 0.065, "triangle");
    noiseBurst(0.28, 0.03, 400);
  }
}
function unlockAudio(){
  if (audioUnlocked) return;
  audioUnlocked = true;
  ensureAudioCtx();
  for (const audio of audioPool){
    try{ audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {}); }catch{}
  }
}
document.addEventListener("pointerdown", unlockAudio, { once:true });
document.addEventListener("touchstart", unlockAudio, { once:true, passive:true });
function playQuick(audio){ try{ audio.currentTime = 0; audio.play().catch(() => {}); }catch{} }

const BG_ANALYSIS = {
  size: { w: 832, h: 1248 },
  walkable: { minY: 0.34, maxY: 0.87 }
};

const SPRITES = {
  lvl1: {
    down:      { url:`assets/LVL1/sprite_down_lvl1.png?v=${VER}`,       frameW:354, frameH:346, frames:6,  fps:10 },
    right:     { url:`assets/LVL1/sprite_right_lvl1.png?v=${VER}`,      frameW:398, frameH:356, frames:6,  fps:10 },
    downRight: { url:`assets/LVL1/sprite_downright_lvl1.png?v=${VER}`,  frameW:493, frameH:358, frames:6,  fps:10 },
    upRight:   { url:`assets/LVL1/sprite_upright_lvl1.png?v=${VER}`,    frameW:306, frameH:306, frames:6,  fps:10 },
    up:        { url:`assets/LVL1/sprite_up_lvl1.png?v=${VER}`,         frameW:284, frameH:326, frames:8,  fps:10 },
    idleFront: { url:`assets/LVL1/sprite_idlefront_lvl1.png?v=${VER}`,  frameW:287, frameH:344, frames:6,  fps:6 },
    idleBack:  { url:`assets/LVL1/sprite_idleback_lvl1.png?v=${VER}`,   frameW:237, frameH:338, frames:6,  fps:6 },
    attack:    { url:`assets/LVL1/sprite_attack_lvl1.png?v=${VER}`,     frameW:251, frameH:386, frames:8, fps:16, renderScale:1.58 },
    death:     { url:`assets/LVL1/sprite_death_lvl1.png?v=${VER}`,      frameW:344, frameH:400, frames:10, fps:12, renderScale:1.02 },
    uiName: "LVL 1"
  },
  lvl2: {
    down:      { url:`assets/LVL2/sprite_down.png?v=${VER}`,            frameW:688, frameH:464, frames:10, fps:12 },
    right:     { url:`assets/LVL2/sprite_righ.png?v=${VER}`,            frameW:292, frameH:293, frames:30, fps:12 },
    downRight: { url:`assets/LVL2/sprite_down_right.png?v=${VER}`,      frameW:688, frameH:464, frames:6,  fps:12 },
    upRight:   { url:`assets/LVL2/sprite_up_right.png?v=${VER}`,        frameW:688, frameH:464, frames:24, fps:14 },
    up:        { url:`assets/LVL2/sprite_up.png?v=${VER}`,              frameW:332, frameH:302, frames:12, fps:12 },
    idleFront: { url:`assets/LVL2/sprite_idle_front.png?v=${VER}`,      frameW:688, frameH:464, frames:7,  fps:6 },
    idleBack:  { url:`assets/LVL2/sprite_idle_back.png?v=${VER}`,       frameW:353, frameH:342, frames:12, fps:6 },
    attack:    { url:`assets/LVL2/sprite_attack.png?v=${VER}`,          frameW:459, frameH:392, frames:24, fps:16, renderScale:1.05 },
    death:     { url:`assets/LVL2/sprite_death.png?v=${VER}`,           frameW:688, frameH:464, frames:23, fps:12 },
    uiName: "LVL 2"
  },
  lvl3: {
    atlasCols: 8,
    atlasRows: 10,
    down:      { url:`assets/LVL3/lvl3_master_sprite_atlas_scaled.png?v=${VER}`, frameW:464, frameH:554, frames:8, fps:10, row:0, atlas:true },
    up:        { url:`assets/LVL3/lvl3_master_sprite_atlas_scaled.png?v=${VER}`, frameW:464, frameH:554, frames:8, fps:10, row:1, atlas:true },
    upRight:   { url:`assets/LVL3/lvl3_master_sprite_atlas_scaled.png?v=${VER}`, frameW:464, frameH:554, frames:8, fps:10, row:2, atlas:true },
    downRight: { url:`assets/LVL3/lvl3_master_sprite_atlas_scaled.png?v=${VER}`, frameW:464, frameH:554, frames:8, fps:10, row:3, atlas:true },
    right:     { url:`assets/LVL3/lvl3_master_sprite_atlas_scaled.png?v=${VER}`, frameW:464, frameH:554, frames:8, fps:10, row:4, atlas:true },
    idleFront: { url:`assets/LVL3/lvl3_master_sprite_atlas_scaled.png?v=${VER}`, frameW:464, frameH:554, frames:8, fps:6,  row:5, atlas:true, frameScaleComp:[1.130,1.051,1.057,1.000,1.005,0.951,0.926,0.909] },
    idleBack:  { url:`assets/LVL3/lvl3_master_sprite_atlas_scaled.png?v=${VER}`, frameW:464, frameH:554, frames:8, fps:6,  row:6, atlas:true, frameScaleComp:[1.054,1.044,1.006,1.000,1.000,0.976,0.982,0.972] },
    attack:    { url:`assets/LVL3/lvl3_master_sprite_atlas_scaled.png?v=${VER}`, frameW:464, frameH:554, frames:8, fps:14, row:7, atlas:true },
    death:     { url:`assets/LVL3/lvl3_master_sprite_atlas_scaled.png?v=${VER}`, frameW:464, frameH:554, frames:8, fps:11, row:8, atlas:true },
    winner:    { url:`assets/LVL3/lvl3_master_sprite_atlas_scaled.png?v=${VER}`, frameW:464, frameH:554, frames:8, fps:8, row:9, atlas:true },
    uiName: "LVL 3"
  },
  lvl4: {
    down:      { url:`assets/LVL4/sprite_lvl4_idledown.png?v=${VER}`,         frameW:464, frameH:724, frames:9, fps:9, footOffsetPx:107 },
    right:     { url:`assets/LVL4/sprite_right_lvl4.png?v=${VER}`,             frameW:688, frameH:519, frames:9, fps:10, footOffsetPx:92 },
    downRight: { url:`assets/LVL4/sprite_lvl4_downright.png?v=${VER}`,         frameW:464, frameH:726, frames:9, fps:10, footOffsetPx:181 },
    upRight:   { url:`assets/LVL4/sprite_lvl4_rightup.png?v=${VER}`,           frameW:464, frameH:778, frames:9, fps:10, footOffsetPx:172 },
    up:        { url:`assets/LVL4/sprite_lvl4_up.png?v=${VER}`,                frameW:464, frameH:701, frames:9, fps:10, footOffsetPx:209 },
    idleFront: { url:`assets/LVL4/sprite_lvl4_idledown.png?v=${VER}`,          frameW:464, frameH:724, frames:9, fps:9, footOffsetPx:107 },
    idleBack:  { url:`assets/LVL4/sprite_lvl4_idleup.png?v=${VER}`,            frameW:464, frameH:695, frames:9, fps:9, footOffsetPx:223 },
    attack:    { url:`assets/LVL4/sprite_lvl4_attack.png?v=${VER}`,            frameW:464, frameH:575, frames:9, fps:14, renderScale:1.10, footOffsetPx:96 },
    death:     { url:`assets/LVL4/sprite_lvl4_death_frames_row.png?v=${VER}`,  frameW:464, frameH:781, frames:9, fps:11, footOffsetPx:242 },
    winner:    { url:`assets/LVL4/sprite_lvl4_winner.png?v=${VER}`,            frameW:464, frameH:692, frames:9, fps:8, footOffsetPx:33 },
    uiName: "LVL 4"
  },
  lvl5: {
    down:      { url:`assets/LVL5/LVL5_down_sprite.png?v=${VER}`,      frameW:464, frameH:688, frames:12, fps:10, footOffsetPx:103 },
    right:     { url:`assets/LVL5/LVL5_right_sprite.png?v=${VER}`,     frameW:464, frameH:688, frames:12, fps:10, footOffsetPx:123 },
    downRight: { url:`assets/LVL5/LVL5_rightdown_sprite.png?v=${VER}`, frameW:464, frameH:688, frames:12, fps:10, footOffsetPx:173 },
    upRight:   { url:`assets/LVL5/LVL5_upright_sprite.png?v=${VER}`,   frameW:464, frameH:688, frames:12, fps:10, footOffsetPx:105 },
    up:        { url:`assets/LVL5/LVL5_up_sprite.png?v=${VER}`,        frameW:464, frameH:688, frames:12, fps:10, footOffsetPx:75 },
    idleFront: { url:`assets/LVL5/LVL5_idledown_sprite.png?v=${VER}`,  frameW:464, frameH:688, frames:12, fps:8, footOffsetPx:103 },
    idleBack:  { url:`assets/LVL5/LVL5_idleup_sprite.png?v=${VER}`,    frameW:464, frameH:688, frames:12, fps:8, footOffsetPx:51 },
    attack:    { url:`assets/LVL5/LVL5_attack_sprite.png?v=${VER}`,    frameW:464, frameH:688, frames:12, fps:15, renderScale:1.14, footOffsetPx:9 },
    death:     { url:`assets/LVL5/LVL5_death_sprite.png?v=${VER}`,     frameW:464, frameH:688, frames:12, fps:11, footOffsetPx:1 },
    winner:    { url:`assets/LVL5/LVL5_winner_sprite.png?v=${VER}`,    frameW:464, frameH:688, frames:12, fps:8, footOffsetPx:61 },
    uiName: "LVL 5"
  }
};

const DRAGON_SPRITES = {
  lvl1: {
    idle:    { url:`assets/dragon/sprite_dragon.png?v=${VER}`,               frameW:256, frameH:256, frames:24, fps:12 },
    attack:  { url:`assets/dragon/dragon_attack_lvl1_sprite.png?v=${VER}`,   frameW:560, frameH:560, frames:12, fps:14, renderScale:1.04 },
    death:   { url:`assets/dragon/dragon_death_lvl1_sprite.png?v=${VER}`,    frameW:560, frameH:560, frames:11, fps:11, renderScale:1.04 },
    evolve:  { url:`assets/dragon/dragon_sprite_evo1lvl_sprite.png?v=${VER}`,frameW:560, frameH:560, frames:12, fps:12, renderScale:1.05 },
  },
  lvl2: {
    idle:    { url:`assets/dragon/dragon_idle_lvl2_sprite.png?v=${VER}`,     frameW:607, frameH:607, frames:12, fps:10, renderScale:1.08 },
    circle:  { url:`assets/dragon/dragon_attack_lvl2_sprit.png?v=${VER}`,    frameW:607, frameH:607, frames:12, fps:12, renderScale:1.08 },
    left:    { url:`assets/dragon/dragon_attack_lvl2_left_sprite.png?v=${VER}`, frameW:560, frameH:560, frames:11, fps:11, renderScale:1.06 },
    right:   { url:`assets/dragon/dragon_attack_lvl2_right_sprite.png?v=${VER}`,frameW:560, frameH:560, frames:11, fps:11, renderScale:1.06 },
    death:   { url:`assets/dragon/dragon_death_lvl2_sprite.png?v=${VER}`,    frameW:560, frameH:560, frames:12, fps:11, renderScale:1.05 },
    evolve:  { url:`assets/dragon/dragon_evo_lvl2_sprite.png?v=${VER}`,      frameW:607, frameH:607, frames:12, fps:12, renderScale:1.08 },
  }
};

const HERO_CONFIG = {
  1: { id:"lvl1", ringIndex:0, maxHp:120, damage:16, speed:185, attackRange:138, attackCooldown:0.92 },
  2: { id:"lvl2", ringIndex:1, maxHp:180, damage:28, speed:170, attackRange:128, attackCooldown:0.84 },
  3: { id:"lvl3", ringIndex:2, maxHp:260, damage:42, speed:162, attackRange:122, attackCooldown:0.76 },
  4: { id:"lvl4", ringIndex:3, maxHp:360, damage:74, speed:166, attackRange:126, attackCooldown:0.70 },
  5: { id:"lvl5", ringIndex:4, maxHp:520, damage:118, speed:170, attackRange:132, attackCooldown:0.62 },
};

const HERO_VISIBLE_BASE = { lvl1:312, lvl2:315, lvl3:312, lvl4:330, lvl5:346 };
const HERO_SLOT_BY_LEVEL = { 1:0, 2:1, 3:2, 4:3, 5:4 };
const DEFAULT_SETTINGS = {
  rings: [
    { x:0.142, y:0.829, w:0.107, h:0.036 },
    { x:0.327, y:0.827, w:0.120, h:0.037 },
    { x:0.500, y:0.825, w:0.121, h:0.037 },
    { x:0.673, y:0.827, w:0.115, h:0.036 },
    { x:0.858, y:0.829, w:0.109, h:0.035 },
  ],
  dragon: { x:0.636, y:0.329 },
  attackSlots: [
    { x:0.544, y:0.430 },
    { x:0.585, y:0.408 },
    { x:0.636, y:0.395 },
    { x:0.687, y:0.408 },
    { x:0.728, y:0.430 },
  ],
  winnerSlots: [
    { x:0.48, y:0.585 },
    { x:0.53, y:0.605 },
    { x:0.58, y:0.620 },
    { x:0.63, y:0.605 },
    { x:0.68, y:0.585 },
  ],
  heroScaleByLevel: { 1:1, 2:1, 3:1, 4:1, 5:1 },
  dragonScale: 0.92,
  perspective: {
    heroNearScale: 1.0,
    heroFarScale: 0.20,
    dragonNearScale: 1.0,
    dragonFarScale: 0.70,
    nearShift: 0.010,
    farShift: -0.012,
  },
  zones: {
    aoe: { rx:0.16, ry:0.072 },
    side: { rx:0.11, ry:0.050, leftCx:-0.11, rightCx:0.11, cy:0.01 },
  }
};

const ROUTES = {
  1: [ [[0.20,0.79],[0.29,0.69],[0.37,0.59],[0.46,0.51],[0.55,0.45]], [[0.16,0.80],[0.24,0.71],[0.31,0.63],[0.41,0.54],[0.53,0.46]], [[0.19,0.78],[0.23,0.66],[0.35,0.60],[0.45,0.52],[0.54,0.45]] ],
  2: [ [[0.35,0.78],[0.38,0.68],[0.43,0.59],[0.49,0.52],[0.56,0.45]], [[0.32,0.78],[0.34,0.69],[0.39,0.61],[0.47,0.54],[0.55,0.46]], [[0.30,0.77],[0.33,0.66],[0.41,0.58],[0.50,0.51],[0.57,0.45]] ],
  3: [ [[0.50,0.77],[0.50,0.68],[0.51,0.60],[0.55,0.52],[0.60,0.45]], [[0.49,0.77],[0.47,0.66],[0.50,0.58],[0.56,0.50],[0.60,0.44]], [[0.51,0.77],[0.54,0.67],[0.55,0.59],[0.58,0.51],[0.61,0.45]] ],
  4: [ [[0.66,0.78],[0.62,0.68],[0.59,0.60],[0.59,0.52],[0.61,0.45]], [[0.68,0.79],[0.62,0.71],[0.58,0.64],[0.57,0.55],[0.60,0.46]], [[0.70,0.79],[0.65,0.70],[0.60,0.62],[0.58,0.54],[0.60,0.46]] ],
  5: [ [[0.84,0.79],[0.76,0.72],[0.69,0.64],[0.65,0.55],[0.63,0.46]], [[0.86,0.80],[0.79,0.72],[0.71,0.64],[0.66,0.56],[0.64,0.46]], [[0.88,0.80],[0.81,0.72],[0.73,0.64],[0.67,0.56],[0.64,0.47]] ]
};

function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t){ return a + (b - a) * t; }
function distance(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
function status(text){ statusText.textContent = text; }
function sampleTrack(yN, points){
  if (yN <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++){
    const [y1, v1] = points[i - 1]; const [y2, v2] = points[i];
    if (yN <= y2) return lerp(v1, v2, clamp((yN - y1) / Math.max(0.0001, y2 - y1), 0, 1));
  }
  return points.at(-1)[1];
}

const state = {
  width: 0,
  height: 0,
  now: performance.now(),
  selectedLevel: null,
  settings: loadSettings(),
  ringEls: new Map(),
  queueCounts: new Map([[1,0],[2,0],[3,0],[4,0],[5,0]]),
  heroes: new Map(),
  activeHeroes: new Map(),
  dragon: createDragonState(),
  dev: { open:false, selectedKey:"dragon", handles:new Map(), dragging:null },
};

function loadSettings(){
  try{
    const saved = JSON.parse(localStorage.getItem("dragon_dev_settings_v2") || "null");
    if (!saved) return deepClone(DEFAULT_SETTINGS);
    return { ...deepClone(DEFAULT_SETTINGS), ...saved, perspective:{ ...DEFAULT_SETTINGS.perspective, ...(saved.perspective || {}) }, zones:{ ...DEFAULT_SETTINGS.zones, ...(saved.zones || {}), aoe:{ ...DEFAULT_SETTINGS.zones.aoe, ...(saved.zones?.aoe || {}) }, side:{ ...DEFAULT_SETTINGS.zones.side, ...(saved.zones?.side || {}) } }, heroScaleByLevel:{ ...DEFAULT_SETTINGS.heroScaleByLevel, ...(saved.heroScaleByLevel || {}) } };
  }catch{ return deepClone(DEFAULT_SETTINGS); }
}
function saveSettings(){ localStorage.setItem("dragon_dev_settings_v2", JSON.stringify(state.settings)); syncDevExport(); }
function createDragonState(){
  return {
    x:0, y:0, level:1, alive:true,
    maxHp:900, hp:900,
    damage:22,
    phase:"idle", animKey:"idle", animFrame:0, animAcc:0,
    attackTimer:0.85,
    actionClock:0,
    attackKind:null,
    damageApplied:false,
    hitFx:0,
  };
}
function getDragonSet(level){ return level === 1 ? DRAGON_SPRITES.lvl1 : DRAGON_SPRITES.lvl2; }
function getDragonMeta(level, key){ return getDragonSet(level)[key] || getDragonSet(level).idle; }

function normalizedToStage(p){ return { x:p.x * state.width, y:p.y * state.height }; }
function stageToNormalized(p){ return { x:clamp(p.x / Math.max(1,state.width),0,1), y:clamp(p.y / Math.max(1,state.height),0,1) }; }
function depthNorm(yPx){ return clamp(yPx / Math.max(state.height, 1), 0, 1); }
function laneCenterX(yPx){ return sampleTrack(depthNorm(yPx), [[0.34,0.58],[0.42,0.59],[0.52,0.55],[0.64,0.505],[0.76,0.50],[0.87,0.50]]) * state.width; }
function laneHalfWidth(yPx){ return sampleTrack(depthNorm(yPx), [[0.34,0.090],[0.42,0.095],[0.52,0.060],[0.64,0.082],[0.76,0.200],[0.87,0.390]]) * state.width; }
function clampToWalkable(pos){
  const minY = BG_ANALYSIS.walkable.minY * state.height;
  const maxY = BG_ANALYSIS.walkable.maxY * state.height;
  const y = clamp(pos.y, minY, maxY);
  const centerX = laneCenterX(y);
  const halfWidth = laneHalfWidth(y);
  return { x: clamp(pos.x, centerX - halfWidth, centerX + halfWidth), y };
}
function heroVisibleTargetPx(){ return window.matchMedia('(min-width: 921px)').matches ? 168 : 100; }
function heroBaseScale(hero){
  const baseVisible = HERO_VISIBLE_BASE[hero.cfg.id] || 320;
  const levelMul = Number(state.settings.heroScaleByLevel[hero.level] || 1);
  return (heroVisibleTargetPx() / baseVisible) * levelMul;
}
function heroDepthScale(yPx){
  const t = depthNorm(yPx); const p = state.settings.perspective;
  return clamp(lerp(p.heroFarScale, p.heroNearScale, t), 0.08, 1.6);
}
function dragonDepthScale(yPx){
  const t = depthNorm(yPx); const p = state.settings.perspective;
  return clamp(lerp(p.dragonFarScale, p.dragonNearScale, t), 0.35, 1.6);
}
function depthSpeed(yPx){ return sampleTrack(depthNorm(yPx), [[0.00,0.34],[0.18,0.40],[0.34,0.48],[0.48,0.60],[0.58,0.72],[0.70,0.84],[0.82,0.94],[1.00,1.00]]); }
function diabloPerspectiveShift(yPx){ const t = depthNorm(yPx); const p = state.settings.perspective; return lerp(state.width * p.farShift, state.width * p.nearShift, t); }
function snapStableScale(entity, nextScale, holdStable = false){
  const prev = entity._stableScale;
  let scale = clamp(nextScale, entity._minScale ?? 0.001, entity._maxScale ?? 99);
  if (holdStable && prev !== undefined && Math.abs(scale - prev) < 0.0035) scale = prev;
  scale = Math.round(scale * (holdStable ? 1000 : 10000)) / (holdStable ? 1000 : 10000);
  entity._stableScale = scale;
  return scale;
}
function combatRange(baseRange){ return baseRange / 2.5; }
function dragonCombatCenter(){ return { x:state.dragon.x, y:state.dragon.y - state.height * 0.025 }; }
function dir8FromVector(dx, dy){
  const ang = Math.atan2(dy, dx); const step = Math.PI / 4;
  let idx = Math.floor((ang + step / 2) / step); idx = (idx % 8 + 8) % 8; return idx;
}
function spriteForDir8(dir8){
  switch(dir8){
    case 0: return { key:"right", flipX:false };
    case 1: return { key:"downRight", flipX:false };
    case 2: return { key:"down", flipX:false };
    case 3: return { key:"downRight", flipX:true };
    case 4: return { key:"right", flipX:true };
    case 5: return { key:"upRight", flipX:true };
    case 6: return { key:"up", flipX:false };
    case 7: return { key:"upRight", flipX:false };
    default:return { key:"down", flipX:false };
  }
}

function positionRingEl(el, ring){
  el.style.left = `${ring.x * state.width}px`;
  el.style.top = `${ring.y * state.height}px`;
  el.style.width = `${ring.w * state.width}px`;
  el.style.height = `${ring.h * state.height}px`;
}
function makeRingAnchors(){
  ringsLayer.innerHTML = ""; state.ringEls.clear();
  state.settings.rings.forEach((ring, idx) => {
    const el = document.createElement("div"); el.className = "ring-anchor";
    const count = document.createElement("div"); count.className = "queue-count"; count.textContent = "x0";
    el.appendChild(count); positionRingEl(el, ring); ringsLayer.appendChild(el);
    state.ringEls.set(idx + 1, { root:el, count });
  });
  syncAllQueueBadges();
}
function syncQueueBadge(level){
  const ring = state.ringEls.get(level); if (!ring) return;
  const n = state.queueCounts.get(level) || 0;
  ring.count.textContent = `x${n}`;
  ring.root.classList.toggle('hasQueue', n > 0 || !!state.activeHeroes.get(level));
}
function syncAllQueueBadges(){ for (const level of Object.keys(HERO_CONFIG).map(Number)) syncQueueBadge(level); }
function spawnRingGlow(level){
  const ringObj = state.ringEls.get(level); if (!ringObj) return;
  const ringEl = ringObj.root; ringEl.classList.remove("activeGlow"); void ringEl.offsetWidth; ringEl.classList.add("activeGlow");
}

function makeHeroDom(level){
  const heroEl = document.createElement("div"); heroEl.className = "entity hero"; heroEl.dataset.level = String(level);
  const label = document.createElement("div"); label.className = "hplabel";
  const hpbar = document.createElement("div"); hpbar.className = "hpbar";
  const hpfill = document.createElement("div"); hpfill.className = "hpfill"; hpbar.appendChild(hpfill);
  const selectionCircle = document.createElement("div"); selectionCircle.className = "selectionCircle";
  const spawnGlow = document.createElement("div"); spawnGlow.className = "spawnGlow";
  const teleportRays = document.createElement("div"); teleportRays.className = "teleportRays";
  const sprite = document.createElement("div"); sprite.className = "sprite";
  heroEl.append(label, hpbar, selectionCircle, spawnGlow, teleportRays, sprite);
  entitiesLayer.appendChild(heroEl);
  return { heroEl, labelEl:label, hpBarEl:hpbar, hpFillEl:hpfill, spriteEl:sprite, selectionCircleEl:selectionCircle };
}
function pickRoute(level){
  const variants = ROUTES[level] || []; if (!variants.length) return { idx:0, points:[] };
  let idx = Math.floor(Math.random() * variants.length); return { idx, points: variants[idx].map(([x,y]) => clampToWalkable(normalizedToStage({x,y}))) };
}
function getAttackSlot(level){
  const idx = HERO_SLOT_BY_LEVEL[level] ?? 2;
  return clampToWalkable(normalizedToStage(state.settings.attackSlots[idx] || state.settings.attackSlots[2]));
}
function getWinnerSlot(level){
  const idx = HERO_SLOT_BY_LEVEL[level] ?? 2;
  return clampToWalkable(normalizedToStage(state.settings.winnerSlots[idx] || state.settings.winnerSlots[2]));
}
function makeHero(level){
  const heroCfg = HERO_CONFIG[level]; const spriteCfg = SPRITES[heroCfg.id];
  const ring = state.settings.rings[heroCfg.ringIndex]; const spawnPos = normalizedToStage(ring);
  const dom = makeHeroDom(level); const route = pickRoute(level);
  return {
    uid: heroUid++, level, cfg: heroCfg, sprites: spriteCfg, ...dom,
    x:spawnPos.x, y:spawnPos.y, spawnX:spawnPos.x, spawnY:spawnPos.y,
    targetX:spawnPos.x, targetY:spawnPos.y, routePoints:route.points, routeIndex:0, _routeVariant:route.idx,
    dir8:6, mode:"walk", aiState:"route", flipX:false,
    hp:heroCfg.maxHp, maxHp:heroCfg.maxHp, alive:true, spawningUntil:performance.now() + 620,
    attackCd:0, spriteKey:"idleFront", frame:0, frameAcc:0, frameFrozen:false,
    baseScale:1,
  };
}
function destroyHero(hero){
  if (!hero) return; hero.heroEl.remove(); state.heroes.delete(hero.uid);
  if (state.activeHeroes.get(hero.level)?.uid === hero.uid) state.activeHeroes.delete(hero.level);
  syncQueueBadge(hero.level);
}
function spawnHeroFromQueue(level){
  const current = state.activeHeroes.get(level); if (current) destroyHero(current);
  const hero = makeHero(level); state.heroes.set(hero.uid, hero); state.activeHeroes.set(level, hero);
  syncQueueBadge(level); spawnRingGlow(level); spawnTeleportFx(hero.x, hero.y + 2, hero.level); playSynth("spawn"); selectLevel(level);
  status(`LVL ${level} вышел из очереди и сам идет к дракону.`); return hero;
}
function trySpawnNextFromQueue(level){
  const current = state.activeHeroes.get(level); if (current && current.alive) return;
  const queued = state.queueCounts.get(level) || 0; if (queued <= 0) return;
  state.queueCounts.set(level, queued - 1); spawnHeroFromQueue(level);
}
function selectLevel(level){
  state.selectedLevel = level;
  spawnButtons.forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.level) === level));
  for (const [ringLevel, ring] of state.ringEls) ring.root.classList.toggle("selected", ringLevel === level);
}
function onSpawnButton(level){
  selectLevel(level);
  const current = state.activeHeroes.get(level);
  if (!current){
    spawnHeroFromQueue(level);
    const p = getAttackSlot(level); updateMoveMarker(p.x, p.y); return;
  }
  state.queueCounts.set(level, (state.queueCounts.get(level) || 0) + 1);
  syncQueueBadge(level); spawnRingGlow(level);
  status(`LVL ${level} добавлен в очередь. Ожидают: x${state.queueCounts.get(level)}.`);
}

function animateLoop(entity, spriteMeta, dt, loop = true){
  entity.animAcc += dt; const fd = 1 / spriteMeta.fps;
  while (entity.animAcc >= fd){
    entity.animAcc -= fd; entity.animFrame += 1;
    if (loop) entity.animFrame %= spriteMeta.frames;
    else if (entity.animFrame >= spriteMeta.frames - 1){ entity.animFrame = spriteMeta.frames - 1; return true; }
  }
  return false;
}
function animateSpriteFrame(entity, spriteMeta, dt){
  if (entity.frameFrozen) return;
  entity.frameAcc += dt; const frameDuration = 1 / spriteMeta.fps;
  while (entity.frameAcc >= frameDuration){
    entity.frameAcc -= frameDuration; entity.frame += 1;
    if (entity.mode === "death"){
      if (entity.frame >= spriteMeta.frames - 1){ entity.frame = spriteMeta.frames - 1; entity.frameFrozen = true; break; }
    } else if (entity.mode === "attack" || entity.mode === "winner"){
      entity.frame %= spriteMeta.frames;
    } else { entity.frame %= spriteMeta.frames; }
  }
}
function applySpriteToEl(spriteEl, spriteMeta, scale, frame, flipX){
  const frameScaleComp = spriteMeta.frameScaleComp?.[frame] || 1;
  const renderScale = scale * (spriteMeta.renderScale || 1) * frameScaleComp;
  const footOffsetPx = spriteMeta.footOffsetPx || 0;
  spriteEl.style.width = `${spriteMeta.frameW * renderScale}px`;
  spriteEl.style.height = `${spriteMeta.frameH * renderScale}px`;
  spriteEl.style.bottom = `${-footOffsetPx * renderScale}px`;
  spriteEl.style.backgroundImage = `url("${spriteMeta.url}")`;
  if (spriteMeta.atlas){
    const cols = SPRITES.lvl3.atlasCols || spriteMeta.frames;
    const rows = SPRITES.lvl3.atlasRows || 1;
    spriteEl.style.backgroundSize = `${spriteMeta.frameW * cols * renderScale}px ${spriteMeta.frameH * rows * renderScale}px`;
    spriteEl.style.backgroundPosition = `${-frame * spriteMeta.frameW * renderScale}px ${-(spriteMeta.row || 0) * spriteMeta.frameH * renderScale}px`;
  } else {
    spriteEl.style.backgroundSize = `${spriteMeta.frameW * spriteMeta.frames * renderScale}px ${spriteMeta.frameH * renderScale}px`;
    spriteEl.style.backgroundPosition = `${-frame * spriteMeta.frameW * renderScale}px 0px`;
  }
  spriteEl.style.transform = `translateX(-50%) scaleX(${flipX ? -1 : 1})`;
}
function heroCurrentSprite(hero){
  if (!hero.alive) return { key:"death", flipX:hero.flipX };
  if (hero.mode === "attack") return { key:"attack", flipX:hero.flipX };
  if (hero.mode === "walk") return spriteForDir8(hero.dir8);
  if (hero.mode === "winner" && hero.sprites.winner) return { key:"winner", flipX:false };
  if (hero.dir8 === 6 || hero.dir8 === 7 || hero.dir8 === 5) return { key:"idleBack", flipX:hero.flipX };
  return { key:"idleFront", flipX:hero.flipX };
}

function updateHeroAI(hero){
  if (!hero.alive) return;
  if (hero.aiState === "route"){
    const point = hero.routePoints[hero.routeIndex];
    if (!point){ hero.aiState = state.dragon.phase === "idle" && state.dragon.alive ? "engage" : "winnerHold"; }
    else {
      hero.targetX = point.x; hero.targetY = point.y;
      if (distance(hero, point) <= 14) hero.routeIndex += 1; return;
    }
  }
  if (hero.aiState === "engage"){
    const attackPoint = getAttackSlot(hero.level); hero.targetX = attackPoint.x; hero.targetY = attackPoint.y;
  } else if (hero.aiState === "winnerRun" || hero.aiState === "winnerHold"){
    const winnerPoint = getWinnerSlot(hero.level); hero.targetX = winnerPoint.x; hero.targetY = winnerPoint.y;
    if (distance(hero, winnerPoint) <= 10) hero.aiState = "winnerHold";
  } else if (hero.aiState === "reengage"){
    const attackPoint = getAttackSlot(hero.level); hero.targetX = attackPoint.x; hero.targetY = attackPoint.y;
    if (distance(hero, attackPoint) <= 10) hero.aiState = "engage";
  }
}
function killHero(hero){
  hero.alive = false; hero.aiState = 'dead'; hero.mode = "death"; hero.frame = 0; hero.frameAcc = 0; hero.frameFrozen = false; hero.targetX = hero.x; hero.targetY = hero.y;
  hero.heroEl.classList.add("dead"); playSynth("death"); spawnDamageFx(hero.x, hero.y - 56, 0, false, "ПОВЕРЖЕН"); spawnImpactFx(hero.x, hero.y - 18, "death");
}
function livingHeroes(){ return [...state.activeHeroes.values()].filter((hero) => hero.alive); }
function heroesInEllipse(cx, cy, rx, ry){
  return livingHeroes().filter((hero) => {
    const nx = (hero.x - cx) / Math.max(1, rx); const ny = (hero.y - cy) / Math.max(1, ry);
    return nx * nx + ny * ny <= 1;
  });
}
function getZoneShapes(){
  const c = dragonCombatCenter(); const z = state.settings.zones;
  return {
    aoe: { cx:c.x, cy:c.y, rx:z.aoe.rx * state.width, ry:z.aoe.ry * state.height },
    left: { cx:c.x + z.side.leftCx * state.width, cy:c.y + z.side.cy * state.height, rx:z.side.rx * state.width, ry:z.side.ry * state.height },
    right:{ cx:c.x + z.side.rightCx * state.width, cy:c.y + z.side.cy * state.height, rx:z.side.rx * state.width, ry:z.side.ry * state.height },
  };
}
function chooseDragonAttack(){
  const zones = getZoneShapes();
  if (state.dragon.level === 1) return { kind:"attack", targets: heroesInEllipse(zones.aoe.cx, zones.aoe.cy, zones.aoe.rx * 0.72, zones.aoe.ry * 0.70).slice(0,1) };
  const aoeTargets = heroesInEllipse(zones.aoe.cx, zones.aoe.cy, zones.aoe.rx, zones.aoe.ry);
  const leftTargets = heroesInEllipse(zones.left.cx, zones.left.cy, zones.left.rx, zones.left.ry);
  const rightTargets = heroesInEllipse(zones.right.cx, zones.right.cy, zones.right.rx, zones.right.ry);
  if (aoeTargets.length > 3) return { kind:"circle", targets: aoeTargets };
  if (leftTargets.length && rightTargets.length) return leftTargets.length >= rightTargets.length ? { kind:"left", targets:leftTargets } : { kind:"right", targets:rightTargets };
  if (leftTargets.length) return { kind:"left", targets:leftTargets };
  if (rightTargets.length) return { kind:"right", targets:rightTargets };
  const nearest = livingHeroes().sort((a,b) => distance(a, state.dragon) - distance(b, state.dragon))[0];
  if (!nearest) return null;
  return nearest.x < state.dragon.x ? { kind:"left", targets:[nearest] } : { kind:"right", targets:[nearest] };
}
function dragonAttackImpactFrame(kind){ return kind === "circle" ? 6 : kind === "attack" ? 6 : 5; }
function dragonAttackDamage(kind){
  if (state.dragon.level === 1) return state.dragon.damage;
  if (kind === "circle") return Math.round(state.dragon.damage * 0.90);
  return state.dragon.damage;
}
function dragonAttackCooldown(){ return state.dragon.level === 1 ? 1.35 : 1.08; }
function startDragonAttack(plan){
  if (!plan || !plan.targets.length) return;
  state.dragon.phase = "attack"; state.dragon.attackKind = plan.kind; state.dragon.animKey = plan.kind; state.dragon.animFrame = 0; state.dragon.animAcc = 0; state.dragon.damageApplied = false; state.dragon.cachedTargets = plan.targets.map((h) => h.uid);
  playQuick(dragonRoarSfx);
}
function applyDragonAttackDamage(){
  const targets = state.dragon.cachedTargets.map((uid) => state.heroes.get(uid)).filter((hero) => hero?.alive);
  if (!targets.length) return;
  const damage = dragonAttackDamage(state.dragon.attackKind);
  for (const target of targets){
    target.hp = Math.max(0, target.hp - damage);
    spawnDamageFx(target.x, target.y - 68, damage, false);
    spawnImpactFx(target.x, target.y - 36, "hero");
    if (target.hp <= 0) killHero(target);
  }
}
function retreatHeroesToWinner(){
  for (const hero of livingHeroes()){
    hero.aiState = "winnerRun"; hero.mode = hero.sprites.winner ? "winner" : "idle"; hero.frame = 0; hero.frameAcc = 0; hero.flipX = false; hero.dir8 = 2;
  }
}
function reengageHeroes(){
  for (const hero of livingHeroes()){
    hero.aiState = "reengage"; hero.mode = "walk"; hero.frame = 0; hero.frameAcc = 0;
  }
}
function setupDragonStats(){
  const d = state.dragon;
  if (d.level === 1){ d.maxHp = 900; d.damage = 22; }
  else if (d.level === 2){ d.maxHp = 1380; d.damage = 34; }
  else { d.maxHp = 1680; d.damage = 42; }
  d.hp = d.maxHp;
}
function handleDragonDeath(){
  if (!state.dragon.alive) return;
  state.dragon.alive = false;
  state.dragon.phase = "dead";
  state.dragon.animKey = "death"; state.dragon.animFrame = 0; state.dragon.animAcc = 0; state.dragon.actionClock = 0; state.dragon.damageApplied = false; state.dragon.attackTimer = 999;
  retreatHeroesToWinner();
  spawnDamageFx(state.dragon.x, state.dragon.y - 100, 0, true, 'УБИТ');
  spawnImpactFx(state.dragon.x, state.dragon.y - 30, 'death');
  status(state.dragon.level === 1 ? 'Дракон 1 уровня пал. Герои отходят. Начинается эволюция во 2 уровень.' : 'Дракон пал. Герои отходят к мосту. Запускается новая стадия возрождения.');
}
function finishDragonEvolution(){
  if (state.dragon.level === 1) state.dragon.level = 2;
  // 2 level respawns as 2; level 3 can be switched manually in dev panel if needed
  setupDragonStats();
  state.dragon.alive = true;
  state.dragon.phase = "idle"; state.dragon.animKey = "idle"; state.dragon.animFrame = 0; state.dragon.animAcc = 0; state.dragon.actionClock = 0; state.dragon.attackTimer = 0.9; state.dragon.damageApplied = false; state.dragon.hitFx = 0.32;
  playSynth("evolve"); playQuick(dragonRoarSfx); spawnImpactFx(state.dragon.x, state.dragon.y - 20, 'hero'); spawnFlashFx(state.dragon.x, state.dragon.y - 44);
  reengageHeroes();
  status(state.dragon.level === 2 ? 'Дракон 2 уровня возрожден. Герои возвращаются в бой.' : `Дракон ${state.dragon.level} уровня возрожден.`);
}
function updateDragon(dt){
  const d = state.dragon;
  d.hitFx = Math.max(0, d.hitFx - dt);
  if (d.phase === "idle"){
    const meta = getDragonMeta(d.level, "idle"); animateLoop(d, meta, dt, true);
    if (d.alive){
      d.attackTimer -= dt;
      if (d.attackTimer <= 0){
        const plan = chooseDragonAttack();
        if (plan) startDragonAttack(plan); else d.attackTimer = 0.35;
      }
    }
  } else if (d.phase === "attack"){
    const meta = getDragonMeta(d.level, d.animKey);
    animateLoop(d, meta, dt, false);
    if (!d.damageApplied && d.animFrame >= dragonAttackImpactFrame(d.attackKind)){
      d.damageApplied = true; applyDragonAttackDamage();
    }
    if (d.animFrame >= meta.frames - 1){
      d.phase = "idle"; d.animKey = "idle"; d.animFrame = 0; d.animAcc = 0; d.attackTimer = dragonAttackCooldown(); d.damageApplied = false;
    }
  } else if (d.phase === "dead"){
    const meta = getDragonMeta(d.level, "death");
    animateLoop(d, meta, dt, false);
    d.actionClock += dt;
    if (d.animFrame >= meta.frames - 1 && d.actionClock >= 2.2){
      d.phase = "evolve"; d.animKey = "evolve"; d.animFrame = 0; d.animAcc = 0; d.actionClock = 0; d.damageApplied = false; playSynth("evolve");
    }
  } else if (d.phase === "evolve"){
    const meta = getDragonMeta(d.level, "evolve");
    animateLoop(d, meta, dt, false);
    if (!d.damageApplied && d.animFrame >= meta.frames - 1){ d.damageApplied = true; spawnFlashFx(d.x, d.y - 42); }
    if (d.animFrame >= meta.frames - 1 && d.animAcc < (1 / meta.fps) * 0.4) finishDragonEvolution();
  }

  const currentMeta = getDragonMeta(d.level, d.animKey);
  d._minScale = state.settings.dragonScale * 0.58;
  d._maxScale = state.settings.dragonScale * 1.3;
  const rawDragonScale = dragonDepthScale(d.y) * state.settings.dragonScale;
  const scale = snapStableScale(d, rawDragonScale, d.phase !== "attack");
  const perspectiveShift = diabloPerspectiveShift(d.y) * 0.65;
  dragonEl.style.left = `${d.x + perspectiveShift}px`;
  dragonEl.style.top = `${Math.round(d.y)}px`;
  dragonEl.style.zIndex = String(Math.round(d.y) + 2);
  dragonLabel.textContent = `Dragon (${d.level}lvl) ${Math.max(0, Math.ceil(d.hp))}/${d.maxHp}`;
  dragonHPFill.style.width = `${(d.hp / d.maxHp) * 100}%`;
  const spriteHeight = currentMeta.frameH * scale * (currentMeta.renderScale || 1);
  const dragonHpBar = dragonEl.querySelector('.hpbar'); dragonHpBar.style.top = `${-spriteHeight - 8}px`; dragonLabel.style.top = `${-spriteHeight - 24}px`;
  const aura = d.level === 2
    ? 'drop-shadow(0 0 14px rgba(255,76,76,.98)) drop-shadow(0 0 30px rgba(255,0,0,.62))'
    : d.level >= 3
      ? 'drop-shadow(0 0 16px rgba(90,190,255,.98)) drop-shadow(0 0 30px rgba(70,110,255,.62))'
      : '';
  const hitFx = d.hitFx > 0 ? ' brightness(1.34) saturate(1.10) drop-shadow(0 0 20px rgba(255,255,255,.48))' : '';
  dragonSpriteEl.style.filter = `${aura}${hitFx}`.trim();
  applySpriteToEl(dragonSpriteEl, currentMeta, scale, d.animFrame, false);
}

function updateHero(hero, dt){
  hero.heroEl.classList.toggle("spawning", performance.now() < hero.spawningUntil);
  hero.attackCd = Math.max(0, hero.attackCd - dt);
  if (hero.alive){
    updateHeroAI(hero);
    const dx = hero.targetX - hero.x; const dy = hero.targetY - hero.y; const dist = Math.hypot(dx, dy);
    const shouldAttack = state.dragon.alive && state.dragon.phase !== "evolve" && hero.aiState === "engage";
    if (dist > 5 && hero.mode !== "attack"){
      hero.mode = hero.aiState.includes("winner") ? (hero.sprites.winner ? "winner" : "walk") : "walk";
      if (hero.mode === "walk") hero.dir8 = dir8FromVector(dx, dy);
      const move = Math.min(dist, hero.cfg.speed * dt * depthSpeed(hero.y));
      hero.x += (dx / dist) * move; hero.y += (dy / dist) * move;
      const clamped = clampToWalkable(hero); hero.x = clamped.x; hero.y = clamped.y;
    } else if (hero.mode !== "attack") {
      hero.mode = hero.aiState.includes("winner") ? (hero.sprites.winner ? "winner" : "idle") : "idle";
    }
    if (shouldAttack){
      const combatCenter = dragonCombatCenter();
      const distToDragon = Math.hypot(hero.x - combatCenter.x, hero.y - combatCenter.y);
      if (distToDragon <= combatRange(hero.cfg.attackRange) && hero.attackCd <= 0 && state.dragon.phase === "idle"){
        hero.mode = "attack"; hero.attackCd = hero.cfg.attackCooldown; hero.frame = 0; hero.frameAcc = 0; hero.frameFrozen = false; hero.flipX = hero.x > state.dragon.x; hero.dir8 = hero.y > state.dragon.y ? 6 : 2;
        const damage = hero.cfg.damage;
        state.dragon.hp = Math.max(0, state.dragon.hp - damage); state.dragon.hitFx = 0.18;
        playSynth("slash"); playQuick(hitSfx); playQuick(dragonHitSfx);
        spawnDamageFx(state.dragon.x, state.dragon.y - 66, damage, true); spawnImpactFx(state.dragon.x + (hero.flipX ? -18 : 18), state.dragon.y - 34, "enemy");
        if (state.dragon.hp <= 0) handleDragonDeath();
      }
    }
  }
  const spriteState = heroCurrentSprite(hero); hero.spriteKey = spriteState.key; hero.flipX = spriteState.flipX;
  const spriteMeta = hero.sprites[spriteState.key]; animateSpriteFrame(hero, spriteMeta, dt);
  if (hero.mode === "attack" && hero.alive && hero.attackCd < hero.cfg.attackCooldown * 0.50) hero.mode = hero.aiState.includes("winner") ? "winner" : "idle";
  hero.baseScale = heroBaseScale(hero); hero._minScale = hero.baseScale * 0.18; hero._maxScale = hero.baseScale * 1.25;
  const rawScale = heroDepthScale(hero.y) * hero.baseScale; const holdStable = hero.mode !== "walk"; const scale = snapStableScale(hero, rawScale, holdStable);
  const perspectiveShift = diabloPerspectiveShift(hero.y);
  hero.heroEl.style.left = `${hero.x + perspectiveShift}px`; hero.heroEl.style.top = `${Math.round(hero.y)}px`; hero.heroEl.style.zIndex = String(Math.round(hero.y));
  hero.labelEl.textContent = `${hero.sprites.uiName} · ${Math.max(0, Math.ceil(hero.hp))}/${hero.maxHp}`; hero.hpFillEl.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
  const frameScaleComp = spriteMeta.frameScaleComp?.[hero.frame] || 1; const spriteHeight = spriteMeta.frameH * scale * (spriteMeta.renderScale || 1) * frameScaleComp;
  hero.hpBarEl.style.top = `${-spriteHeight - 12}px`; hero.labelEl.style.top = `${-spriteHeight - 26}px`; hero.selectionCircleEl.style.bottom = `${Math.max(-10, -spriteHeight * 0.045)}px`;
  applySpriteToEl(hero.spriteEl, spriteMeta, scale, hero.frame, hero.flipX);
  hero.spriteEl.style.filter = hero.level === 5
    ? 'drop-shadow(0 0 12px rgba(255,120,120,.98)) drop-shadow(0 0 26px rgba(255,50,50,.94)) drop-shadow(0 0 48px rgba(255,0,0,.72))'
    : hero.level === 4
      ? 'drop-shadow(0 0 10px rgba(255,214,84,.98)) drop-shadow(0 0 22px rgba(255,190,40,.88))'
      : hero.level === 3
        ? 'drop-shadow(0 0 8px rgba(120,220,255,.95)) drop-shadow(0 0 18px rgba(70,185,255,.72))'
        : '';
}

function spawnDamageFx(x, y, amount, enemy = false, customText = ""){
  const el = document.createElement("div"); el.className = `damage-float${enemy ? " enemy" : ""}`; el.textContent = customText || `-${Math.round(amount)}`; el.style.left = `${x}px`; el.style.top = `${y}px`;
  fxLayer.appendChild(el); el.addEventListener("animationend", () => el.remove(), { once:true });
}
function spawnImpactFx(x, y, kind = "enemy"){
  const burst = document.createElement("div"); burst.className = `impact-burst ${kind}`; burst.style.left = `${x}px`; burst.style.top = `${y}px`; fxLayer.appendChild(burst); burst.addEventListener("animationend", () => burst.remove(), { once:true });
}
function spawnTeleportFx(x, y, level){
  const pulse = document.createElement("div"); pulse.className = `teleport-pulse lvl${Math.min(level, 5)}`; pulse.style.left = `${x}px`; pulse.style.top = `${y}px`; fxLayer.appendChild(pulse); pulse.addEventListener("animationend", () => pulse.remove(), { once:true });
}
function spawnFlashFx(x, y){
  const flash = document.createElement("div"); flash.className = 'evolve-flash'; flash.style.left = `${x}px`; flash.style.top = `${y}px`; fxLayer.appendChild(flash); flash.addEventListener('animationend', () => flash.remove(), { once:true });
}
function updateMoveMarker(x, y){
  moveMarker.style.left = `${x}px`; moveMarker.style.top = `${y}px`; moveMarker.classList.remove("show"); void moveMarker.offsetWidth; moveMarker.classList.add("show"); playSynth("move");
}

function buildHandleData(){
  const items = [{ key:"dragon", label:"Дракон", ref:state.settings.dragon, type:"point" }];
  state.settings.rings.forEach((p, i) => items.push({ key:`ring-${i+1}`, label:`Спавн ${i+1}`, ref:p, type:"point" }));
  state.settings.attackSlots.forEach((p, i) => items.push({ key:`attack-${i+1}`, label:`Удар героя ${i+1}`, ref:p, type:"point" }));
  state.settings.winnerSlots.forEach((p, i) => items.push({ key:`winner-${i+1}`, label:`Winner ${i+1}`, ref:p, type:"point" }));
  return items;
}
function ensureHandle(key, label){
  let el = state.dev.handles.get(key);
  if (!el){
    el = document.createElement('button'); el.type = 'button'; el.className = 'debug-handle'; el.dataset.key = key; el.textContent = label; debugLayer.appendChild(el); state.dev.handles.set(key, el);
    el.addEventListener('pointerdown', (e) => startHandleDrag(e, key));
  }
  return el;
}
function renderDebugLayer(){
  debugLayer.innerHTML = '';
  state.dev.handles.clear();
  if (!state.dev.open) return;
  for (const item of buildHandleData()){
    const el = ensureHandle(item.key, item.label.replace(/^[^ ]+ /,''));
    el.style.left = `${item.ref.x * state.width}px`; el.style.top = `${item.ref.y * state.height}px`;
    el.classList.toggle('selected', item.key === state.dev.selectedKey);
    debugLayer.appendChild(el);
  }
  renderDebugZones();
}
function renderDebugZones(){
  const zones = getZoneShapes();
  for (const [key, zone] of Object.entries(zones)){
    const el = document.createElement('div'); el.className = `debug-zone ${key}`;
    el.style.left = `${zone.cx}px`; el.style.top = `${zone.cy}px`; el.style.width = `${zone.rx * 2}px`; el.style.height = `${zone.ry * 2}px`;
    debugLayer.appendChild(el);
  }
}
function startHandleDrag(e, key){
  if (!state.dev.open) return;
  unlockAudio();
  state.dev.dragging = key; state.dev.selectedKey = key; syncSelectedDevTarget();
  e.preventDefault();
}
function updateDraggedHandle(clientX, clientY){
  if (!state.dev.dragging) return;
  const rect = stage.getBoundingClientRect();
  const x = clamp(clientX - rect.left, 0, rect.width); const y = clamp(clientY - rect.top, 0, rect.height);
  const n = stageToNormalized({ x, y });
  const key = state.dev.dragging;
  const item = buildHandleData().find((h) => h.key === key); if (!item) return;
  item.ref.x = n.x; item.ref.y = n.y;
  syncSelectedDevTarget(); syncDevExport(); saveSettings(); resize();
}
function stopHandleDrag(){ state.dev.dragging = null; }
window.addEventListener('pointermove', (e) => updateDraggedHandle(e.clientX, e.clientY));
window.addEventListener('pointerup', stopHandleDrag);
window.addEventListener('pointercancel', stopHandleDrag);

function syncDevTargetList(){
  devTarget.innerHTML = '';
  for (const item of buildHandleData()){
    const opt = document.createElement('option'); opt.value = item.key; opt.textContent = item.label; devTarget.appendChild(opt);
  }
  devTarget.value = state.dev.selectedKey;
}
function getDevSelectedItem(){ return buildHandleData().find((h) => h.key === state.dev.selectedKey) || buildHandleData()[0]; }
function syncSelectedDevTarget(){
  const item = getDevSelectedItem(); if (!item) return;
  devTargetName.textContent = item.label; devX.value = item.ref.x.toFixed(3); devY.value = item.ref.y.toFixed(3); devTarget.value = item.key;
  syncDevExport(); renderDebugLayer();
}
function syncDevInputs(){
  const s = state.settings;
  devInputs.heroScale1.value = s.heroScaleByLevel[1]; devInputs.heroScale2.value = s.heroScaleByLevel[2]; devInputs.heroScale3.value = s.heroScaleByLevel[3]; devInputs.heroScale4.value = s.heroScaleByLevel[4]; devInputs.heroScale5.value = s.heroScaleByLevel[5];
  devInputs.dragonScale.value = s.dragonScale; devInputs.heroNearScale.value = s.perspective.heroNearScale; devInputs.heroFarScale.value = s.perspective.heroFarScale;
  devInputs.dragonNearScale.value = s.perspective.dragonNearScale; devInputs.dragonFarScale.value = s.perspective.dragonFarScale; devInputs.perspectiveNearShift.value = s.perspective.nearShift; devInputs.perspectiveFarShift.value = s.perspective.farShift;
  devInputs.aoeRadiusX.value = s.zones.aoe.rx; devInputs.aoeRadiusY.value = s.zones.aoe.ry; devInputs.sideRadiusX.value = s.zones.side.rx; devInputs.sideRadiusY.value = s.zones.side.ry;
}
function syncDevExport(){
  devExport.textContent = JSON.stringify(state.settings, null, 2);
  devStat.textContent = `dragon=${state.dragon.level}lvl · phase=${state.dragon.phase}`;
}
function bindDevPanel(){
  devToggleBtn.addEventListener('click', () => {
    state.dev.open = !state.dev.open; devPanel.hidden = !state.dev.open; debugLayer.classList.toggle('visible', state.dev.open); devToggleBtn.classList.toggle('active', state.dev.open);
    if (state.dev.open){ syncDevTargetList(); syncDevInputs(); syncSelectedDevTarget(); renderDebugLayer(); }
    else renderDebugLayer();
  });
  devTarget.addEventListener('change', () => { state.dev.selectedKey = devTarget.value; syncSelectedDevTarget(); });
  [devX, devY].forEach((input) => input.addEventListener('change', () => {
    const item = getDevSelectedItem(); if (!item) return;
    item.ref.x = clamp(Number(devX.value) || 0, 0, 1); item.ref.y = clamp(Number(devY.value) || 0, 0, 1);
    saveSettings(); resize(); syncSelectedDevTarget();
  }));
  for (const [id, input] of Object.entries(devInputs)){
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (id.startsWith('heroScale')) state.settings.heroScaleByLevel[id.at(-1)] = v;
      else if (id === 'dragonScale') state.settings.dragonScale = v;
      else if (id === 'heroNearScale') state.settings.perspective.heroNearScale = v;
      else if (id === 'heroFarScale') state.settings.perspective.heroFarScale = v;
      else if (id === 'dragonNearScale') state.settings.perspective.dragonNearScale = v;
      else if (id === 'dragonFarScale') state.settings.perspective.dragonFarScale = v;
      else if (id === 'perspectiveNearShift') state.settings.perspective.nearShift = v;
      else if (id === 'perspectiveFarShift') state.settings.perspective.farShift = v;
      else if (id === 'aoeRadiusX') state.settings.zones.aoe.rx = v;
      else if (id === 'aoeRadiusY') state.settings.zones.aoe.ry = v;
      else if (id === 'sideRadiusX') state.settings.zones.side.rx = v;
      else if (id === 'sideRadiusY') state.settings.zones.side.ry = v;
      saveSettings(); syncDevExport(); renderDebugLayer();
    });
  }
  devCopyBtn.addEventListener('click', async () => { try{ await navigator.clipboard.writeText(devExport.textContent); devStat.textContent = 'JSON скопирован'; }catch{ devStat.textContent = 'Не удалось скопировать'; } });
  devSaveBtn.addEventListener('click', () => { saveSettings(); devStat.textContent = 'Позиции сохранены в localStorage'; });
  devResetBtn.addEventListener('click', () => {
    state.settings = deepClone(DEFAULT_SETTINGS); saveSettings(); syncDevInputs(); syncDevTargetList(); resize(); syncSelectedDevTarget();
  });
}

function resize(){
  const prevW = state.width || stage.clientWidth; const prevH = state.height || stage.clientHeight;
  state.width = stage.clientWidth; state.height = stage.clientHeight;
  makeRingAnchors();
  const dragonPos = normalizedToStage(state.settings.dragon); state.dragon.x = dragonPos.x; state.dragon.y = dragonPos.y;
  for (const hero of state.heroes.values()){
    const ring = state.settings.rings[hero.level - 1]; const spawnPos = normalizedToStage(ring);
    hero.spawnX = spawnPos.x; hero.spawnY = spawnPos.y;
    hero.x = clamp(hero.x / Math.max(prevW, 1) * state.width, 0, state.width);
    hero.y = clamp(hero.y / Math.max(prevH, 1) * state.height, 0, state.height);
    hero.routePoints = (ROUTES[hero.level]?.[hero._routeVariant] || []).map(([x, y]) => clampToWalkable(normalizedToStage({ x, y })));
    hero.targetX = clamp(hero.targetX / Math.max(prevW, 1) * state.width, 0, state.width);
    hero.targetY = clamp(hero.targetY / Math.max(prevH, 1) * state.height, 0, state.height);
  }
  renderDebugLayer();
}
function bindUi(){
  spawnButtons.forEach((btn) => btn.addEventListener("click", () => onSpawnButton(Number(btn.dataset.level))));
  stage.addEventListener("pointerdown", () => unlockAudio());
  window.addEventListener("resize", resize, { passive:true }); window.visualViewport?.addEventListener("resize", resize, { passive:true });
  bindDevPanel();
}
function tick(now){
  const dt = clamp((now - state.now) / 1000, 0, 0.033); state.now = now;
  updateDragon(dt);
  for (const hero of [...state.heroes.values()]) updateHero(hero, dt);
  for (const level of Object.keys(HERO_CONFIG).map(Number)) trySpawnNextFromQueue(level);
  syncDevExport();
  requestAnimationFrame(tick);
}

bindUi();
resize();
setupDragonStats();
syncAllQueueBadges();
status('Логика дракона внедрена: lvl1 бьет одним ударом, после смерти идет эволюция; lvl2 умеет круговой, левый и правый удары. DEV-кнопка открывает редактор сцены.');
syncDevTargetList(); syncDevInputs(); syncSelectedDevTarget();
requestAnimationFrame((t) => { state.now = t; requestAnimationFrame(tick); });
