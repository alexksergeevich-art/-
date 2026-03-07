const VER = "dragon-queue-lvl4-hotfix-20260307b";

const stage = document.getElementById("stage");
const ringsLayer = document.getElementById("ringsLayer");
const entitiesLayer = document.getElementById("entitiesLayer");
const fxLayer = document.getElementById("fxLayer");
const dragonEl = document.getElementById("dragon");
const dragonSpriteEl = document.getElementById("dragonSprite");
const dragonHPFill = document.getElementById("dragonHP");
const dragonLabel = document.getElementById("dragonLabel");
const moveMarker = document.getElementById("moveMarker");
const statusText = document.getElementById("statusText");
const spawnButtons = [...document.querySelectorAll(".spawnBtn")];

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
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + duration);
}
function noiseBurst(duration = 0.12, gainValue = 0.05, highpass = 420){
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = highpass;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  src.stop(ctx.currentTime + duration);
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
  }
}
function unlockAudio(){
  if (audioUnlocked) return;
  audioUnlocked = true;
  ensureAudioCtx();
  for (const audio of audioPool){
    try{
      audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
    }catch{}
  }
}
document.addEventListener("pointerdown", unlockAudio, { once:true });
document.addEventListener("touchstart", unlockAudio, { once:true, passive:true });
function playQuick(audio){
  try{ audio.currentTime = 0; audio.play().catch(() => {}); }catch{}
}

const BG_ANALYSIS = {
  size: { w: 832, h: 1248 },
  rings: [
    { level: 1, x: 0.142, y: 0.829, w: 0.107, h: 0.036, power: 1.0 },
    { level: 2, x: 0.327, y: 0.827, w: 0.120, h: 0.037, power: 1.32 },
    { level: 3, x: 0.500, y: 0.825, w: 0.121, h: 0.037, power: 1.56 },
    { level: 4, x: 0.673, y: 0.827, w: 0.115, h: 0.036, power: 1.84 },
    { level: 5, x: 0.858, y: 0.829, w: 0.109, h: 0.035, power: 2.1 },
  ],
  dragon: { x: 0.636, y: 0.377 },
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
    down:      { url:`assets/LVL4/sprite_lvl4_idledown.png?v=${VER}`,         frameW:464, frameH:724, frames:9, fps:9 },
    right:     { url:`assets/LVL4/sprite_right_lvl4.png?v=${VER}`,             frameW:688, frameH:519, frames:9, fps:10 },
    downRight: { url:`assets/LVL4/sprite_lvl4_downright.png?v=${VER}`,         frameW:464, frameH:726, frames:9, fps:10 },
    upRight:   { url:`assets/LVL4/sprite_lvl4_rightup.png?v=${VER}`,           frameW:464, frameH:778, frames:9, fps:10 },
    up:        { url:`assets/LVL4/sprite_lvl4_up.png?v=${VER}`,                frameW:464, frameH:701, frames:9, fps:10 },
    idleFront: { url:`assets/LVL4/sprite_lvl4_idledown.png?v=${VER}`,          frameW:464, frameH:724, frames:9, fps:9 },
    idleBack:  { url:`assets/LVL4/sprite_lvl4_idleup.png?v=${VER}`,            frameW:464, frameH:695, frames:9, fps:9 },
    attack:    { url:`assets/LVL4/sprite_lvl4_attack.png?v=${VER}`,            frameW:464, frameH:575, frames:9, fps:14, renderScale:1.10 },
    death:     { url:`assets/LVL4/sprite_lvl4_death_frames_row.png?v=${VER}`,  frameW:464, frameH:781, frames:9, fps:11 },
    winner:    { url:`assets/LVL4/sprite_lvl4_winner.png?v=${VER}`,            frameW:464, frameH:692, frames:9, fps:8 },
    uiName: "LVL 4"
  },
  dragon: {
    idle:      { url:`assets/dragon/sprite_dragon.png?v=${VER}`, frameW:256, frameH:256, frames:24, fps:12 },
    drawScale: 0.90,
    uiName: "Dragon"
  }
};

const HERO_CONFIG = {
  1: { id:"lvl1", ringIndex:0, maxHp:120, damage:16, speed:185, attackRange:82,  attackCooldown:0.92, dragonThreat:19 },
  2: { id:"lvl2", ringIndex:1, maxHp:180, damage:28, speed:170, attackRange:88,  attackCooldown:0.84, dragonThreat:28 },
  3: { id:"lvl3", ringIndex:2, maxHp:260, damage:42, speed:162, attackRange:96,  attackCooldown:0.76, dragonThreat:36 },
  4: { id:"lvl4", ringIndex:3, maxHp:360, damage:58, speed:166, attackRange:104, attackCooldown:0.72, dragonThreat:44 },
};

const HERO_VISIBLE_BASE = { lvl1:312, lvl2:315, lvl3:312, lvl4:330 };
const ROUTES = {
  1: [
    [[0.20,0.79],[0.29,0.69],[0.37,0.59],[0.46,0.51],[0.55,0.45]],
    [[0.16,0.80],[0.24,0.71],[0.31,0.63],[0.41,0.54],[0.53,0.46]],
    [[0.19,0.78],[0.23,0.66],[0.35,0.60],[0.45,0.52],[0.54,0.45]],
  ],
  2: [
    [[0.35,0.78],[0.38,0.68],[0.43,0.59],[0.49,0.52],[0.56,0.45]],
    [[0.32,0.78],[0.34,0.69],[0.39,0.61],[0.47,0.54],[0.55,0.46]],
    [[0.30,0.77],[0.33,0.66],[0.41,0.58],[0.50,0.51],[0.57,0.45]],
  ],
  3: [
    [[0.50,0.77],[0.50,0.68],[0.51,0.60],[0.55,0.52],[0.60,0.45]],
    [[0.49,0.77],[0.47,0.66],[0.50,0.58],[0.56,0.50],[0.60,0.44]],
    [[0.51,0.77],[0.54,0.67],[0.55,0.59],[0.58,0.51],[0.61,0.45]],
  ],
  4: [
    [[0.66,0.78],[0.62,0.68],[0.59,0.60],[0.59,0.52],[0.61,0.45]],
    [[0.68,0.79],[0.62,0.71],[0.58,0.64],[0.57,0.55],[0.60,0.46]],
    [[0.70,0.79],[0.65,0.70],[0.60,0.62],[0.58,0.54],[0.60,0.46]],
  ]
};

const state = {
  width: 0,
  height: 0,
  selectedLevel: null,
  heroes: new Map(),
  activeHeroes: new Map(),
  ringEls: new Map(),
  queueCounts: new Map(),
  now: performance.now(),
  dragon: {
    x: 0,
    y: 0,
    level: 1,
    baseMaxHp: 800,
    maxHp: 800,
    hp: 800,
    baseDamage: 18,
    damage: 18,
    alive: true,
    respawnAt: 0,
    frame: 0,
    frameAcc: 0,
    hitFx: 0,
    attackTimer: 0,
  }
};
for (const level of Object.keys(HERO_CONFIG).map(Number)) state.queueCounts.set(level, 0);

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t){ return a + (b - a) * t; }
function distance(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
function worldToStage(x, y){ return { x: x * state.width, y: y * state.height }; }
function status(text){ statusText.textContent = text; }
function depthNorm(yPx){ return clamp(yPx / Math.max(state.height, 1), 0, 1); }
function normY(yPx){ return clamp(yPx / Math.max(state.height, 1), 0, 1); }
function sampleTrack(yN, points){
  if (yN <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++){
    const [y1, v1] = points[i - 1];
    const [y2, v2] = points[i];
    if (yN <= y2){
      const t = clamp((yN - y1) / Math.max(y2 - y1, 0.0001), 0, 1);
      return lerp(v1, v2, t);
    }
  }
  return points[points.length - 1][1];
}
function laneCenterX(yPx){
  return sampleTrack(normY(yPx), [[0.34,0.58],[0.42,0.59],[0.52,0.55],[0.64,0.505],[0.76,0.50],[0.87,0.50]]) * state.width;
}
function laneHalfWidth(yPx){
  return sampleTrack(normY(yPx), [[0.34,0.090],[0.42,0.095],[0.52,0.060],[0.64,0.082],[0.76,0.200],[0.87,0.390]]) * state.width;
}
function clampToWalkable(pos){
  const minY = BG_ANALYSIS.walkable.minY * state.height;
  const maxY = BG_ANALYSIS.walkable.maxY * state.height;
  const y = clamp(pos.y, minY, maxY);
  const centerX = laneCenterX(y);
  const halfWidth = laneHalfWidth(y);
  return { x: clamp(pos.x, centerX - halfWidth, centerX + halfWidth), y };
}
function isDesktopSizeBoost(){ return window.matchMedia('(min-width: 921px)').matches; }
function heroVisibleTargetPx(){ return isDesktopSizeBoost() ? 168 : 100; }
function heroBaseScale(hero){
  const baseVisible = HERO_VISIBLE_BASE[hero.cfg.id] || 320;
  return heroVisibleTargetPx() / baseVisible;
}
function heroDepthScale(yPx){
  const t = depthNorm(yPx);
  const mobile = !isDesktopSizeBoost();
  const curve = mobile
    ? [[0.00,0.15],[0.20,0.17],[0.34,0.21],[0.48,0.34],[0.58,0.48],[0.70,0.66],[0.82,1.00],[1.00,1.00]]
    : [[0.00,0.18],[0.20,0.20],[0.34,0.24],[0.48,0.38],[0.58,0.50],[0.70,0.68],[0.82,1.00],[1.00,1.00]];
  return clamp(sampleTrack(t, curve), mobile ? 0.15 : 0.18, 1.00);
}
function dragonDepthScale(yPx){
  return clamp(sampleTrack(depthNorm(yPx), [[0.00,0.64],[0.18,0.68],[0.30,0.72],[0.40,0.78],[0.56,0.86],[0.72,0.94],[1.00,1.00]]), 0.64, 1.00);
}
function depthSpeed(yPx){
  const mobile = !isDesktopSizeBoost();
  return sampleTrack(depthNorm(yPx), mobile
    ? [[0.00,0.30],[0.18,0.36],[0.34,0.45],[0.48,0.57],[0.58,0.70],[0.70,0.83],[0.82,0.94],[1.00,1.00]]
    : [[0.00,0.34],[0.18,0.40],[0.34,0.48],[0.48,0.60],[0.58,0.72],[0.70,0.84],[0.82,0.94],[1.00,1.00]]);
}
function diabloPerspectiveShift(yPx){
  const t = depthNorm(yPx);
  const mobileMul = isDesktopSizeBoost() ? 1.0 : 1.16;
  return lerp(-state.width * 0.012 * mobileMul, state.width * 0.010 * mobileMul, t);
}
function snapStableScale(entity, nextScale, holdStable = false){
  const prev = entity._stableScale;
  const minScale = entity._minScale ?? 0.001;
  const maxScale = entity._maxScale ?? Number.POSITIVE_INFINITY;
  let scale = clamp(nextScale, minScale, maxScale);
  if (holdStable && prev !== undefined && Math.abs(scale - prev) < 0.0035) scale = prev;
  scale = Math.round(scale * (holdStable ? 1000 : 10000)) / (holdStable ? 1000 : 10000);
  entity._stableScale = clamp(scale, minScale, maxScale);
  return entity._stableScale;
}
function combatRange(baseRange){ return baseRange / 2.5; }
function dir8FromVector(dx, dy){
  const ang = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  let idx = Math.floor((ang + step / 2) / step);
  idx = (idx % 8 + 8) % 8;
  return idx;
}
function spriteForDir8(dir8){
  switch(dir8){
    case 0: return { key:"right", flipX:false };
    case 1: return { key:"downRight", flipX:false };
    case 2: return { key:"down", flipX:false };
    case 3: return { key:"downRight", flipX:true  };
    case 4: return { key:"right", flipX:true  };
    case 5: return { key:"upRight", flipX:true  };
    case 6: return { key:"up", flipX:false };
    case 7: return { key:"upRight", flipX:false };
    default:return { key:"down", flipX:false };
  }
}
function levelGradient(level){
  if (level === 1) return 'linear-gradient(180deg, #4b331e, #2b1b12)';
  if (level === 2) return 'linear-gradient(180deg, #7a2f22, #431712)';
  if (level === 3) return 'linear-gradient(180deg, #21507e, #142a43)';
  if (level === 4) return 'linear-gradient(180deg, #7d6215, #4e3708)';
  return 'linear-gradient(180deg, #313948, #1c2230)';
}

function makeRingAnchors(){
  ringsLayer.innerHTML = "";
  state.ringEls.clear();
  for (const ring of BG_ANALYSIS.rings){
    const el = document.createElement("div");
    el.className = "ring-anchor";
    const count = document.createElement("div");
    count.className = "queue-count";
    count.textContent = "x0";
    el.appendChild(count);
    positionRingEl(el, ring);
    ringsLayer.appendChild(el);
    state.ringEls.set(ring.level, { root: el, count });
  }
  syncAllQueueBadges();
}
function positionRingEl(el, ring){
  el.style.left = `${ring.x * state.width}px`;
  el.style.top = `${ring.y * state.height}px`;
  el.style.width = `${ring.w * state.width}px`;
  el.style.height = `${ring.h * state.height}px`;
}
function syncQueueBadge(level){
  const ring = state.ringEls.get(level);
  if (!ring) return;
  const n = state.queueCounts.get(level) || 0;
  ring.count.textContent = `x${n}`;
  ring.root.classList.toggle('hasQueue', n > 0 || !!state.activeHeroes.get(level));
}
function syncAllQueueBadges(){ for (const level of Object.keys(HERO_CONFIG).map(Number)) syncQueueBadge(level); }

function makeHeroDom(level){
  const heroEl = document.createElement("div");
  heroEl.className = "entity hero";
  heroEl.dataset.level = String(level);
  const label = document.createElement("div");
  label.className = "hplabel";
  const hpbar = document.createElement("div");
  hpbar.className = "hpbar";
  const hpfill = document.createElement("div");
  hpfill.className = "hpfill";
  hpbar.appendChild(hpfill);
  const selectionCircle = document.createElement("div");
  selectionCircle.className = "selectionCircle";
  const spawnGlow = document.createElement("div");
  spawnGlow.className = "spawnGlow";
  const teleportRays = document.createElement("div");
  teleportRays.className = "teleportRays";
  const sprite = document.createElement("div");
  sprite.className = "sprite";
  heroEl.append(label, hpbar, selectionCircle, spawnGlow, teleportRays, sprite);
  entitiesLayer.appendChild(heroEl);
  return { heroEl, labelEl:label, hpBarEl:hpbar, hpFillEl:hpfill, spriteEl:sprite, selectionCircleEl:selectionCircle };
}

function pickRoute(level){
  const variants = ROUTES[level] || [];
  if (!variants.length) return [];
  const prev = state.activeHeroes.get(level)?._routeVariant ?? -1;
  let idx = Math.floor(Math.random() * variants.length);
  if (variants.length > 1 && idx === prev) idx = (idx + 1) % variants.length;
  return { idx, points: variants[idx].map(([x,y]) => clampToWalkable(worldToStage(x, y))) };
}
function makeDragonApproachPoint(level){
  const offsets = { 1:[-84, 26], 2:[-56, 22], 3:[16, 18], 4:[28, 20] };
  const [ox, oy] = offsets[level] || [0, 18];
  return clampToWalkable({ x: state.dragon.x + ox, y: state.dragon.y + oy });
}
function makeHero(level){
  const heroCfg = HERO_CONFIG[level];
  const spriteCfg = SPRITES[heroCfg.id];
  const ring = BG_ANALYSIS.rings[heroCfg.ringIndex];
  const spawnPos = worldToStage(ring.x, ring.y);
  const dom = makeHeroDom(level);
  const route = pickRoute(level);
  return {
    uid: heroUid++,
    level,
    cfg: heroCfg,
    sprites: spriteCfg,
    ...dom,
    x: spawnPos.x,
    y: spawnPos.y,
    spawnX: spawnPos.x,
    spawnY: spawnPos.y,
    targetX: spawnPos.x,
    targetY: spawnPos.y,
    routePoints: route.points,
    routeIndex: 0,
    _routeVariant: route.idx,
    dir8: 6,
    mode: "walk",
    aiState: "route",
    flipX: false,
    hp: heroCfg.maxHp,
    maxHp: heroCfg.maxHp,
    alive: true,
    spawningUntil: performance.now() + 620,
    attackCd: 0,
    spriteKey: "idleFront",
    frame: 0,
    frameAcc: 0,
    frameFrozen: false,
    baseScale: heroVisibleTargetPx() / (HERO_VISIBLE_BASE[heroCfg.id] || 320),
  };
}
function destroyHero(hero){
  if (!hero) return;
  hero.heroEl.remove();
  state.heroes.delete(hero.uid);
  if (state.activeHeroes.get(hero.level)?.uid === hero.uid) state.activeHeroes.delete(hero.level);
  syncQueueBadge(hero.level);
}
function spawnHeroFromQueue(level){
  const current = state.activeHeroes.get(level);
  if (current) destroyHero(current);
  const hero = makeHero(level);
  state.heroes.set(hero.uid, hero);
  state.activeHeroes.set(level, hero);
  syncQueueBadge(level);
  spawnRingGlow(level);
  spawnTeleportFx(hero.x, hero.y + 2, hero.level);
  playSynth("spawn");
  selectLevel(level);
  status(`LVL ${level} вышел из очереди и сам идет к дракону.`);
  return hero;
}
function trySpawnNextFromQueue(level){
  const current = state.activeHeroes.get(level);
  if (current && current.alive) return;
  const queued = state.queueCounts.get(level) || 0;
  if (queued <= 0) return;
  state.queueCounts.set(level, queued - 1);
  spawnHeroFromQueue(level);
}
function selectLevel(level){
  state.selectedLevel = level;
  spawnButtons.forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.level) === level));
  for (const [ringLevel, ring] of state.ringEls){ ring.root.classList.toggle("selected", ringLevel === level); }
}
function spawnRingGlow(level){
  const ring = BG_ANALYSIS.rings[level - 1];
  const ringObj = state.ringEls.get(level);
  if (!ringObj) return;
  const ringEl = ringObj.root;
  ringEl.classList.remove("activeGlow");
  void ringEl.offsetWidth;
  ringEl.classList.add("activeGlow");
  ringEl.style.filter = `brightness(${1 + ring.power * 0.18}) saturate(${1 + ring.power * 0.12})`;
  setTimeout(() => { ringEl.style.filter = ""; ringEl.classList.remove("activeGlow"); }, 900);
}

function animateSpriteFrame(entity, spriteMeta, dt){
  if (entity.frameFrozen) return;
  entity.frameAcc += dt;
  const frameDuration = 1 / spriteMeta.fps;
  while (entity.frameAcc >= frameDuration){
    entity.frameAcc -= frameDuration;
    entity.frame += 1;
    if (entity.mode === "death"){
      if (entity.frame >= spriteMeta.frames - 1){
        entity.frame = spriteMeta.frames - 1;
        entity.frameFrozen = true;
        break;
      }
    } else if (entity.mode === "attack"){
      if (entity.frame >= spriteMeta.frames) entity.frame = 0;
    } else {
      entity.frame %= spriteMeta.frames;
    }
  }
}
function applySpriteToEl(spriteEl, spriteMeta, scale, frame, flipX){
  const frameScaleComp = spriteMeta.frameScaleComp?.[frame] || 1;
  const renderScale = scale * (spriteMeta.renderScale || 1) * frameScaleComp;
  spriteEl.style.width = `${spriteMeta.frameW * renderScale}px`;
  spriteEl.style.height = `${spriteMeta.frameH * renderScale}px`;
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
  if (hero.mode === "winner" && hero.sprites.winner) return { key:"winner", flipX:hero.flipX };
  if (hero.dir8 === 6 || hero.dir8 === 7 || hero.dir8 === 5) return { key:"idleBack", flipX:hero.flipX };
  return { key:"idleFront", flipX:hero.flipX };
}

function updateHeroAI(hero){
  if (!hero.alive || !state.dragon.alive) return;
  if (hero.aiState === "route"){
    const point = hero.routePoints[hero.routeIndex];
    if (!point){
      hero.aiState = "engage";
    } else {
      const safePoint = clampToWalkable(point);
      hero.targetX = safePoint.x;
      hero.targetY = safePoint.y;
      if (distance(hero, point) <= 14) hero.routeIndex += 1;
      return;
    }
  }
  if (hero.aiState === "engage"){
    const approach = makeDragonApproachPoint(hero.level);
    const safeApproach = clampToWalkable(approach);
    hero.targetX = safeApproach.x;
    hero.targetY = safeApproach.y;
  }
}
function updateHero(hero, dt){
  const dragon = state.dragon;
  hero.heroEl.classList.toggle("spawning", performance.now() < hero.spawningUntil);
  hero.attackCd = Math.max(0, hero.attackCd - dt);
  if (hero.alive){
    updateHeroAI(hero);
    const dx = hero.targetX - hero.x;
    const dy = hero.targetY - hero.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 5 && hero.mode !== "attack"){
      hero.mode = "walk";
      hero.dir8 = dir8FromVector(dx, dy);
      const move = Math.min(dist, hero.cfg.speed * dt * depthSpeed(hero.y));
      hero.x += (dx / dist) * move;
      hero.y += (dy / dist) * move;
      const clamped = clampToWalkable(hero);
      hero.x = clamped.x;
      hero.y = clamped.y;
    } else if (hero.mode !== "attack") {
      hero.mode = hero.aiState === 'winner' ? 'winner' : 'idle';
    }

    if (dragon.alive){
      const distToDragon = distance(hero, dragon);
      if (distToDragon <= combatRange(hero.cfg.attackRange) && hero.attackCd <= 0){
        hero.mode = "attack";
        hero.attackCd = hero.cfg.attackCooldown;
        hero.frame = 0;
        hero.frameAcc = 0;
        hero.frameFrozen = false;
        hero.flipX = hero.x > dragon.x;
        hero.dir8 = hero.y > dragon.y ? 6 : 2;
        const damage = hero.cfg.damage;
        dragon.hp = Math.max(0, dragon.hp - damage);
        dragon.hitFx = 0.18;
        playSynth("slash");
        playQuick(hitSfx);
        playQuick(dragonHitSfx);
        spawnDamageFx(dragon.x, dragon.y - 66, damage, true);
        spawnImpactFx(dragon.x + (hero.flipX ? -18 : 18), dragon.y - 34, "enemy");
        if (dragon.hp <= 0) handleDragonDeath(hero);
      }
    }
  }

  const spriteState = heroCurrentSprite(hero);
  hero.spriteKey = spriteState.key;
  hero.flipX = spriteState.flipX;
  const spriteMeta = hero.sprites[spriteState.key];
  animateSpriteFrame(hero, spriteMeta, dt);
  if (hero.mode === "attack" && hero.alive && hero.attackCd < hero.cfg.attackCooldown * 0.52) hero.mode = hero.aiState === 'winner' ? 'winner' : 'idle';

  hero.baseScale = heroBaseScale(hero);
  hero._minScale = hero.baseScale * 0.18;
  hero._maxScale = hero.baseScale;
  const rawScale = heroDepthScale(hero.y) * hero.baseScale;
  const holdStable = hero.mode !== "walk";
  const scale = snapStableScale(hero, rawScale, holdStable);
  const perspectiveShift = diabloPerspectiveShift(hero.y);
  hero.heroEl.style.left = `${hero.x + perspectiveShift}px`;
  hero.heroEl.style.top = `${Math.round(hero.y)}px`;
  hero.heroEl.style.zIndex = String(Math.round(hero.y));
  hero.labelEl.textContent = `${hero.sprites.uiName} · ${Math.max(0, Math.ceil(hero.hp))}/${hero.maxHp}`;
  hero.hpFillEl.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
  const frameScaleComp = spriteMeta.frameScaleComp?.[hero.frame] || 1;
  const spriteHeight = spriteMeta.frameH * scale * (spriteMeta.renderScale || 1) * frameScaleComp;
  hero.hpBarEl.style.top = `${-spriteHeight - 16}px`;
  hero.labelEl.style.top = `${-spriteHeight - 34}px`;
  hero.selectionCircleEl.style.bottom = `${Math.max(-10, -spriteHeight * 0.045)}px`;
  applySpriteToEl(hero.spriteEl, spriteMeta, scale, hero.frame, hero.flipX);
  hero.spriteEl.style.filter = hero.level >= 3
    ? 'drop-shadow(0 0 8px rgba(120,220,255,.95)) drop-shadow(0 0 18px rgba(70,185,255,.72)) drop-shadow(0 0 30px rgba(255,255,255,.38))'
    : '';
}
function killHero(hero){
  hero.alive = false;
  hero.aiState = 'dead';
  hero.mode = "death";
  hero.frame = 0;
  hero.frameAcc = 0;
  hero.frameFrozen = false;
  hero.targetX = hero.x;
  hero.targetY = hero.y;
  hero.heroEl.classList.add("dead");
  playSynth("death");
  spawnDamageFx(hero.x, hero.y - 56, 0, false, "ПОВЕРЖЕН");
  spawnImpactFx(hero.x, hero.y - 18, "death");
  status(`LVL ${hero.level} пал. Следующий выйдет из очереди.`);
}
function handleDragonDeath(hero){
  state.dragon.alive = false;
  state.dragon.attackTimer = 999;
  state.dragon.respawnAt = performance.now() + 1100;
  hero.aiState = 'winner';
  hero.mode = hero.sprites.winner ? 'winner' : 'idle';
  hero.frame = 0;
  hero.frameAcc = 0;
  spawnDamageFx(state.dragon.x, state.dragon.y - 100, 0, true, 'УБИТ');
  spawnImpactFx(state.dragon.x, state.dragon.y - 30, 'death');
  status(`Дракон повержен. Он возродится сильнее: lvl ${state.dragon.level + 1}.`);
}
function respawnDragonStronger(){
  state.dragon.level += 1;
  state.dragon.maxHp = Math.round(state.dragon.baseMaxHp * Math.pow(1.26, state.dragon.level - 1));
  state.dragon.hp = state.dragon.maxHp;
  state.dragon.damage = Math.round(state.dragon.baseDamage * Math.pow(1.18, state.dragon.level - 1));
  state.dragon.alive = true;
  state.dragon.respawnAt = 0;
  state.dragon.attackTimer = 0.72;
  state.dragon.hitFx = 0.28;
  playQuick(dragonRoarSfx);
  spawnImpactFx(state.dragon.x, state.dragon.y - 20, 'hero');
  status(`Дракон стал сильнее: lvl ${state.dragon.level}. HP ${state.dragon.maxHp}, урон ${state.dragon.damage}.`);
}

function updateDragon(dt){
  const dragonMeta = SPRITES.dragon.idle;
  state.dragon.frameAcc += dt;
  const frameDuration = 1 / dragonMeta.fps;
  while (state.dragon.frameAcc >= frameDuration){
    state.dragon.frameAcc -= frameDuration;
    state.dragon.frame = (state.dragon.frame + 1) % dragonMeta.frames;
  }
  state.dragon.hitFx = Math.max(0, state.dragon.hitFx - dt);
  if (!state.dragon.alive && state.dragon.respawnAt && performance.now() >= state.dragon.respawnAt) respawnDragonStronger();

  if (state.dragon.alive){
    state.dragon.attackTimer -= dt;
    if (state.dragon.attackTimer <= 0){
      const livingHeroes = [...state.activeHeroes.values()].filter((hero) => hero.alive);
      const target = livingHeroes.sort((a, b) => distance(a, state.dragon) - distance(b, state.dragon))[0];
      if (target && distance(target, state.dragon) < combatRange(112)){
        const damage = state.dragon.damage;
        target.hp = Math.max(0, target.hp - damage);
        playQuick(dragonRoarSfx);
        spawnDamageFx(target.x, target.y - 70, damage, false);
        spawnImpactFx(target.x, target.y - 36, "hero");
        if (target.hp <= 0) killHero(target);
      }
      state.dragon.attackTimer = Math.max(0.72, 1.18 - (state.dragon.level - 1) * 0.025);
    }
  }

  state.dragon._minScale = SPRITES.dragon.drawScale * 0.60;
  state.dragon._maxScale = SPRITES.dragon.drawScale * 1.00;
  const rawDragonScale = dragonDepthScale(state.dragon.y) * SPRITES.dragon.drawScale * 1.04;
  const scale = snapStableScale(state.dragon, rawDragonScale);
  const dragonPerspectiveShift = diabloPerspectiveShift(state.dragon.y) * 0.65;
  dragonEl.style.left = `${state.dragon.x + dragonPerspectiveShift}px`;
  dragonEl.style.top = `${Math.round(state.dragon.y)}px`;
  dragonEl.style.zIndex = String(Math.round(state.dragon.y) + 2);
  dragonLabel.textContent = `Dragon (${state.dragon.level}lvl) ${Math.max(0, Math.ceil(state.dragon.hp))}/${state.dragon.maxHp}`;
  dragonHPFill.style.width = `${(state.dragon.hp / state.dragon.maxHp) * 100}%`;
  const dragonSpriteHeight = dragonMeta.frameH * scale * (dragonMeta.renderScale || 1);
  const dragonHpBar = dragonEl.querySelector('.hpbar');
  dragonHpBar.style.top = `${-dragonSpriteHeight - 18}px`;
  dragonLabel.style.top = `${-dragonSpriteHeight - 38}px`;
  const dragonDepthT = depthNorm(state.dragon.y);
  const dragonDepthFilter = `brightness(${lerp(0.9, 1.02, dragonDepthT).toFixed(3)}) saturate(${lerp(0.84, 1.0, dragonDepthT).toFixed(3)}) drop-shadow(0 12px 18px rgba(0,0,0,.22))`;
  dragonSpriteEl.style.filter = state.dragon.hitFx > 0
    ? `brightness(1.4) saturate(1.08) drop-shadow(0 0 18px rgba(255,90,70,.6)) ${dragonDepthFilter}`
    : dragonDepthFilter;
  applySpriteToEl(dragonSpriteEl, dragonMeta, scale, state.dragon.frame, false);
}

function spawnDamageFx(x, y, amount, enemy = false, customText = ""){
  const el = document.createElement("div");
  el.className = `damage-float${enemy ? " enemy" : ""}`;
  el.textContent = customText || `-${Math.round(amount)}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  fxLayer.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once:true });
}
function spawnImpactFx(x, y, kind = "enemy"){
  const burst = document.createElement("div");
  burst.className = `impact-burst ${kind}`;
  burst.style.left = `${x}px`;
  burst.style.top = `${y}px`;
  fxLayer.appendChild(burst);
  burst.addEventListener("animationend", () => burst.remove(), { once:true });
  const sparks = kind === "death" ? 10 : 6;
  for (let i = 0; i < sparks; i++){
    const spark = document.createElement("div");
    spark.className = `spark ${kind}`;
    const ang = (-0.9 + (i / Math.max(1, sparks - 1)) * 1.8) + (Math.random() - 0.5) * 0.35;
    const dist = (kind === "death" ? 42 : 28) + Math.random() * (kind === "death" ? 30 : 16);
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
    spark.style.setProperty("--dy", `${Math.sin(ang) * dist - 12}px`);
    fxLayer.appendChild(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once:true });
  }
}
function spawnTeleportFx(x, y, level){
  const pulse = document.createElement("div");
  pulse.className = `teleport-pulse lvl${Math.min(level, 4)}`;
  pulse.style.left = `${x}px`;
  pulse.style.top = `${y}px`;
  fxLayer.appendChild(pulse);
  pulse.addEventListener("animationend", () => pulse.remove(), { once:true });
}
function updateMoveMarker(x, y){
  moveMarker.style.left = `${x}px`;
  moveMarker.style.top = `${y}px`;
  moveMarker.classList.remove("show");
  void moveMarker.offsetWidth;
  moveMarker.classList.add("show");
  playSynth("move");
}

function resize(){
  const prevW = state.width || stage.clientWidth;
  const prevH = state.height || stage.clientHeight;
  state.width = stage.clientWidth;
  state.height = stage.clientHeight;
  makeRingAnchors();
  const dragonPos = worldToStage(BG_ANALYSIS.dragon.x, BG_ANALYSIS.dragon.y);
  state.dragon.x = dragonPos.x;
  state.dragon.y = dragonPos.y - state.height * 0.048;

  for (const hero of state.heroes.values()){
    const ring = BG_ANALYSIS.rings[hero.level - 1];
    const targetRingPos = worldToStage(ring.x, ring.y);
    const ratioX = hero.x / Math.max(prevW, 1);
    const ratioY = hero.y / Math.max(prevH, 1);
    hero.spawnX = targetRingPos.x;
    hero.spawnY = targetRingPos.y;
    hero.x = clamp(ratioX * state.width, 0, state.width);
    hero.y = clamp(ratioY * state.height, 0, state.height);
    hero.routePoints = (ROUTES[hero.level]?.[hero._routeVariant] || []).map(([x, y]) => clampToWalkable(worldToStage(x, y)));
    const approach = makeDragonApproachPoint(hero.level);
    hero.targetX = clamp(hero.targetX / Math.max(prevW, 1) * state.width, 0, state.width);
    hero.targetY = clamp(hero.targetY / Math.max(prevH, 1) * state.height, 0, state.height);
    if (hero.aiState === 'engage') { hero.targetX = approach.x; hero.targetY = approach.y; }
  }
}
function validateSpriteManifest(){
  const groups = [SPRITES.lvl1, SPRITES.lvl2, SPRITES.lvl3, SPRITES.lvl4, SPRITES.dragon];
  for (const group of groups){
    for (const [key, meta] of Object.entries(group)){
      if (!meta || !meta.url || !meta.frameW || !meta.frameH || !meta.frames) continue;
      const img = new Image();
      img.onload = () => {
        const expectedW = meta.atlas ? meta.frameW * (group.atlasCols || meta.frames) : meta.frameW * meta.frames;
        const expectedH = meta.atlas ? meta.frameH * (group.atlasRows || 1) : meta.frameH;
        if (img.naturalWidth !== expectedW || img.naturalHeight !== expectedH){
          console.warn(`[sprite-manifest] ${key}: expected ${expectedW}x${expectedH}, got ${img.naturalWidth}x${img.naturalHeight}`);
        }
      };
      img.src = meta.url;
    }
  }
}

function onSpawnButton(level){
  if (!HERO_CONFIG[level]){ status(`Кнопка ${level} пока заглушка.`); return; }
  selectLevel(level);
  const current = state.activeHeroes.get(level);
  if (!current){
    spawnHeroFromQueue(level);
    updateMoveMarker(...Object.values(makeDragonApproachPoint(level)));
    return;
  }
  state.queueCounts.set(level, (state.queueCounts.get(level) || 0) + 1);
  syncQueueBadge(level);
  spawnRingGlow(level);
  status(`LVL ${level} добавлен в очередь. Ожидают: x${state.queueCounts.get(level)}.`);
}
function bindUi(){
  spawnButtons.forEach((btn) => btn.addEventListener("click", () => onSpawnButton(Number(btn.dataset.level))));
  stage.addEventListener("pointerdown", () => {
    unlockAudio();
    status("Герои теперь идут к дракону автоматически. Тап по экрану больше не управляет движением.");
  });
  window.addEventListener("resize", resize, { passive:true });
  window.visualViewport?.addEventListener("resize", resize, { passive:true });
}
function tick(now){
  const dt = clamp((now - state.now) / 1000, 0, 0.033);
  state.now = now;
  updateDragon(dt);
  for (const hero of [...state.heroes.values()]) updateHero(hero, dt);
  for (const level of Object.keys(HERO_CONFIG).map(Number)) trySpawnNextFromQueue(level);
  requestAnimationFrame(tick);
}

bindUi();
resize();
syncAllQueueBadges();
status(`LVL 1–4 подключены. Размер старта уменьшен, очередь у колец работает, герой сам ищет дракона, дракон усиливается после смерти.`);
validateSpriteManifest();
requestAnimationFrame((t) => { state.now = t; requestAnimationFrame(tick); });
