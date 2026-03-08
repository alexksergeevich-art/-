const VER = "dragon-evo-solid-stream-build-20260308i";

const stage = document.getElementById("stage");
const ringsLayer = document.getElementById("ringsLayer");
const entitiesLayer = document.getElementById("entitiesLayer");
const fxLayer = document.getElementById("fxLayer");
const noticeLayer = document.getElementById("noticeLayer");
const combatNoticeLayer = document.getElementById("combatNoticeLayer");
const dragonEl = document.getElementById("dragon");
const dragonSpriteEl = document.getElementById("dragonSprite");
const dragonHPFill = document.getElementById("dragonHP");
const dragonLabel = document.getElementById("dragonLabel");
const moveMarker = document.getElementById("moveMarker");
const statusText = document.getElementById("statusText");
const spawnButtons = [...document.querySelectorAll(".spawnBtn")];
const editorLayer = document.getElementById("editorLayer");
const devWidget = document.getElementById("devWidget");
const devWidgetToggle = document.getElementById("devWidgetToggle");
const devWidgetClose = document.getElementById("devWidgetClose");
const devHandlesToggle = document.getElementById("devHandlesToggle");
const devCompactToggle = document.getElementById("devCompactToggle");
const devResetView = document.getElementById("devResetView");
const devWidgetSections = document.getElementById("devWidgetSections");
const devExportBox = document.getElementById("devExportBox");

const audioUnlockedPool = [];
function makeAudio(src, volume = 1, loop = false){
  const audio = new Audio(`${src}?v=${VER}`);
  audio.preload = "auto";
  audio.loop = loop;
  audio.volume = volume;
  audioUnlockedPool.push(audio);
  try{ audio.load(); }catch{}
  return audio;
}
function makePool(src, size, volume = 1){
  return Array.from({ length:size }, () => makeAudio(src, volume, false));
}
function playFromPool(pool, volumeMul = 1, rate = 1){
  if (!pool?.length) return;
  const audio = pool.find((item) => item.paused || item.ended) || pool[0];
  try{
    audio.pause();
    audio.currentTime = 0;
    audio.playbackRate = rate;
    audio.volume = Math.min(1, (audio.datasetBaseVolume ? Number(audio.datasetBaseVolume) : audio.volume) * volumeMul);
    audio.play().catch(() => {});
  }catch{}
}
const BGM = {
  explorer: makeAudio('assets/sound/explorer_fonk.mp3', 0.42, true),
  suspense: makeAudio('assets/sound/suspence_fonk.mp3', 0.42, true),
  combat: makeAudio('assets/sound/combat_fonk.mp3', 0.46, true),
};
const SFX = {
  heroSpawn: makePool('assets/sound/hero_spawn.mp3', 3, 0.34),
  heroHit: makePool('assets/sound/hero_hit.mp3', 5, 0.12),
  hit: makePool('assets/sound/hit.mp3', 5, 0.10),
  dragonHit: makePool('assets/sound/dragon_hit.mp3', 5, 0.15),
  critical: makePool('assets/sound/critikal_hit.mp3', 3, 0.26),
  dragonAttack: makePool('assets/sound/dragon_attack.mp3', 4, 0.18),
  dragonRoar: makePool('assets/sound/dragon_roar.mp3', 3, 0.20),
  dragonDie: makePool('assets/sound/dragon_die.mp3', 2, 0.30),
  dragonEvolve: makePool('assets/sound/dragon_evolve.mp3', 2, 0.28),
  dragonFly: makePool('assets/sound/dragon_flysound.mp3', 2, 0.16),
  dragonSpawn: makePool('assets/sound/dragon_spawn.mp3', 2, 0.26),
  powerUp: makePool('assets/sound/power_up.mp3', 2, 0.24),
  victory: makePool('assets/sound/victory.mp3', 2, 0.26),
  combo2: makePool('assets/sound/combo_2.mp3', 2, 0.24),
  combo3: makePool('assets/sound/combo_3.mp3', 2, 0.24),
  combo5: makePool('assets/sound/combo_5.mp3', 2, 0.26),
  combo10: makePool('assets/sound/combo_10.mp3', 2, 0.28),
  combo20: makePool('assets/sound/combo_20.mp3', 2, 0.30),
};
for (const audio of [...Object.values(BGM), ...Object.values(SFX).flat()]) audio.datasetBaseVolume = String(audio.volume);
let currentMusicState = "";
let audioUnlocked = false;
let audioCtx = null;
let heroUid = 1;
let recentSummons = [];
let bgmDuckUntil = 0;
let bgmDuckAmount = 0;
const MAX_NOTICES = 6;
const NOTICE_LIFETIME_MS = 3000;
const ALL_TIME_STORAGE_KEY = "dragon_arena_all_time_v1";
const RECORD_DEFS = [
  { key:"topSummoner", stat:"summonCount", format:(v) => `${Math.round(v || 0)}` },
  { key:"topDamage", stat:"totalDamage", format:(v) => `${Math.round(v || 0)}` },
  { key:"topSlayer", stat:"dragonKills", format:(v) => `${Math.round(v || 0)}` },
  { key:"topCrit", stat:"crits", format:(v) => `${Math.round(v || 0)}` },
  { key:"topWinner", stat:"wins", format:(v) => `${Math.round(v || 0)}` },
];

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
  for (const audio of audioUnlockedPool){
    try{
      audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
    }catch{}
  }
  setMusicState(resolveMusicState(), true);
}
document.addEventListener("pointerdown", unlockAudio, { once:true });
document.addEventListener("touchstart", unlockAudio, { once:true, passive:true });
function stopAllBgm(){
  Object.values(BGM).forEach((track) => { try{ track.pause(); }catch{} });
}
function triggerBgmDuck(amount = 0.05, duration = 180){
  bgmDuckAmount = Math.max(bgmDuckAmount, clamp(amount, 0, 0.14));
  bgmDuckUntil = Math.max(bgmDuckUntil, performance.now() + duration);
}
function effectiveBgmVolume(track){
  const base = Number(track?.datasetBaseVolume || track?.volume || 0.4);
  const activeDuck = performance.now() < bgmDuckUntil ? bgmDuckAmount : bgmDuckAmount * 0.86;
  return clamp(base * (1 - activeDuck), 0.04, 1);
}
function refreshBgmMix(){
  if (performance.now() >= bgmDuckUntil) bgmDuckAmount *= 0.88;
  if (bgmDuckAmount < 0.005) bgmDuckAmount = 0;
  const current = BGM[currentMusicState];
  if (current && !current.paused){
    current.volume = effectiveBgmVolume(current);
  }
}
function fadeTo(audio, target, duration = 260){
  const start = Number(audio.volume || 0);
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / duration);
    audio.volume = start + (target - start) * k;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function setMusicState(state, immediate = false){
  if (!state || currentMusicState === state) return;
  const next = BGM[state];
  if (!next) return;
  Object.entries(BGM).forEach(([key, track]) => {
    if (key === state) return;
    try{ track.pause(); }catch{}
    track.currentTime = 0;
  });
  if (immediate){
    next.volume = effectiveBgmVolume(next);
    next.currentTime = 0;
    next.play().catch(() => {});
  } else {
    next.volume = 0.01;
    next.currentTime = 0;
    next.play().catch(() => {});
    fadeTo(next, effectiveBgmVolume(next), 220);
  }
  currentMusicState = state;
}
function resolveMusicState(){
  const activeHeroes = [...state.heroes.values()].filter((hero) => hero.alive);
  if (!activeHeroes.length || !state.dragon.alive) return 'explorer';
  const moving = activeHeroes.some((hero) => performance.now() < hero.spawnHoldUntil || ['spawnHold','route','engage','winnerTravel','championWinnerTravel','championReturn'].includes(hero.aiState) || hero.mode === 'walk');
  if (moving) return 'suspense';
  const fighting = activeHeroes.some((hero) => hero.mode === 'attack' || hero.aiState === 'championWinner');
  if (fighting) return 'combat';
  return 'explorer';
}
function updateMusicState(){
  const nextState = resolveMusicState();
  if (nextState !== currentMusicState) setMusicState(nextState);
}
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

const DEV_STORAGE_KEY = "dragon_dev_widget_v2";
const DEV_CONFIG_FILE_NAME = "dragon_stage_config.json";
const DEFAULT_ATTACK_SLOT_OFFSETS = [
  { x:-0.0856, y:-0.0038 },
  { x:-0.0549, y: 0.0138 },
  { x:-0.0213, y: 0.0255 },
  { x: 0.0049, y: 0.0405 },
  { x: 0.0533, y: 0.0362 },
];
const DEFAULT_WINNER_POSITIONS = [
  { x:0.4159, y:0.5547 },
  { x:0.4466, y:0.6434 },
  { x:0.5749, y:0.5713 },
  { x:0.3986, y:0.7253 },
  { x:0.6219, y:0.7334 },
];
const DEFAULT_DEV_TUNING = {
  desktopHeroVisible: 153,
  mobileHeroVisible: 94,
  desktopNearScale: 0.18,
  mobileNearScale: 0.15,
  desktopPerspective: 1.00,
  mobilePerspective: 1.16,
  dragonDrawScale: 0.76,
};
const DEFAULT_DEV_CONFIG = {
  version: 2,
  dragon: { x: 0.6016, y: 0.4825 },
  rings: [
    { level:1, x:0.1498, y:0.7938 },
    { level:2, x:0.3281, y:0.7942 },
    { level:3, x:0.5044, y:0.7932 },
    { level:4, x:0.6846, y:0.7949 },
    { level:5, x:0.8580, y:0.7962 },
  ],
  attackSlots: DEFAULT_ATTACK_SLOT_OFFSETS.map((slot, index) => ({ id:index + 1, x:slot.x, y:slot.y })),
  winnerSlots: DEFAULT_WINNER_POSITIONS.map((slot, index) => ({ id:index + 1, x:slot.x, y:slot.y })),
  tuning: { ...DEFAULT_DEV_TUNING },
  showHandles: true,
  compactSections: false
};
function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }
function loadDevConfig(){
  try{
    const raw = localStorage.getItem(DEV_STORAGE_KEY);
    if (!raw) return deepClone(DEFAULT_DEV_CONFIG);
    const parsed = JSON.parse(raw);
    return {
      dragon: {
        x: Number(parsed?.dragon?.x ?? DEFAULT_DEV_CONFIG.dragon.x),
        y: Number(parsed?.dragon?.y ?? DEFAULT_DEV_CONFIG.dragon.y),
      },
      rings: DEFAULT_DEV_CONFIG.rings.map((ring, idx) => ({
        level: ring.level,
        x: Number(parsed?.rings?.[idx]?.x ?? ring.x),
        y: Number(parsed?.rings?.[idx]?.y ?? ring.y),
      })),
      attackSlots: DEFAULT_DEV_CONFIG.attackSlots.map((slot, idx) => ({
        id: slot.id,
        x: Number(parsed?.attackSlots?.[idx]?.x ?? slot.x),
        y: Number(parsed?.attackSlots?.[idx]?.y ?? slot.y),
      })),
      winnerSlots: DEFAULT_DEV_CONFIG.winnerSlots.map((slot, idx) => ({
        id: slot.id,
        x: Number(parsed?.winnerSlots?.[idx]?.x ?? slot.x),
        y: Number(parsed?.winnerSlots?.[idx]?.y ?? slot.y),
      })),
      tuning: {
        desktopHeroVisible: clamp(Number(parsed?.tuning?.desktopHeroVisible ?? DEFAULT_DEV_TUNING.desktopHeroVisible), 120, 240),
        mobileHeroVisible: clamp(Number(parsed?.tuning?.mobileHeroVisible ?? DEFAULT_DEV_TUNING.mobileHeroVisible), 70, 180),
        desktopNearScale: clamp(Number(parsed?.tuning?.desktopNearScale ?? DEFAULT_DEV_TUNING.desktopNearScale), 0.08, 0.50),
        mobileNearScale: clamp(Number(parsed?.tuning?.mobileNearScale ?? DEFAULT_DEV_TUNING.mobileNearScale), 0.08, 0.50),
        desktopPerspective: clamp(Number(parsed?.tuning?.desktopPerspective ?? DEFAULT_DEV_TUNING.desktopPerspective), 0.2, 2.0),
        mobilePerspective: clamp(Number(parsed?.tuning?.mobilePerspective ?? DEFAULT_DEV_TUNING.mobilePerspective), 0.2, 2.0),
        dragonDrawScale: clamp(Number(parsed?.tuning?.dragonDrawScale ?? DEFAULT_DEV_TUNING.dragonDrawScale), 0.40, 1.60),
      },
      showHandles: parsed?.showHandles !== false,
      compactSections: !!parsed?.compactSections
    };
  }catch{
    return deepClone(DEFAULT_DEV_CONFIG);
  }
}
function saveDevConfig(){
  try{
    localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify({
      dragon: state.dev.dragon,
      rings: state.dev.rings,
      attackSlots: state.dev.attackSlots,
      winnerSlots: state.dev.winnerSlots,
      tuning: state.dev.tuning,
      showHandles: state.dev.showHandles,
      compactSections: state.dev.compactSections
    }));
  }catch{}
}
function clamp01(v){ return Math.max(0, Math.min(1, Number(v) || 0)); }
function clampAttackOffset(v, axis = "x"){
  return axis === "x" ? Math.max(-0.25, Math.min(0.25, Number(v) || 0)) : Math.max(-0.12, Math.min(0.16, Number(v) || 0));
}

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
    idleFront: { url:`assets/LVL5/LVL5_idledown_sprite.png?v=${VER}`,  frameW:464, frameH:688, frames:12, fps:8,  footOffsetPx:103 },
    idleBack:  { url:`assets/LVL5/LVL5_idleup_sprite.png?v=${VER}`,    frameW:464, frameH:688, frames:12, fps:8,  footOffsetPx:51 },
    attack:    { url:`assets/LVL5/LVL5_attack_sprite.png?v=${VER}`,    frameW:464, frameH:688, frames:12, fps:15, renderScale:1.14, footOffsetPx:9 },
    death:     { url:`assets/LVL5/LVL5_death_sprite.png?v=${VER}`,     frameW:464, frameH:688, frames:12, fps:11, footOffsetPx:1 },
    winner:    { url:`assets/LVL5/LVL5_winner_sprite.png?v=${VER}`,    frameW:464, frameH:688, frames:12, fps:8,  footOffsetPx:61 },
    uiName: "LVL 5"
  },
  dragon: {
    lvl1: {
      idle:   { url:`assets/dragon/sprite_dragon.png?v=${VER}`,                frameW:256, frameH:256, frames:24, fps:12 },
      attack: { url:`assets/dragon/dragon_attack_lvl1_sprite.png?v=${VER}`,    frameW:560, frameH:560, frames:12, fps:12, renderScale:0.46 },
      death:  { url:`assets/dragon/dragon_death_lvl1_sprite.png?v=${VER}`,     frameW:560, frameH:560, frames:11, fps:12, renderScale:0.46 },
      evo:    { url:`assets/dragon/dragon_sprite_evo1lvl_sprite.png?v=${VER}`, frameW:560, frameH:560, frames:12, fps:12, renderScale:0.46 },
    },
    lvl2: {
      idle:   { url:`assets/dragon/dragon_idle_lvl2_sprite.png?v=${VER}`,      frameW:607, frameH:607, frames:12, fps:12, renderScale:0.42 },
      attack: { url:`assets/dragon/dragon_attack_lvl2_sprit.png?v=${VER}`,     frameW:607, frameH:607, frames:12, fps:12, renderScale:0.42 },
      death:  { url:`assets/dragon/dragon_death_lvl2_sprite.png?v=${VER}`,     frameW:560, frameH:560, frames:12, fps:12, renderScale:0.46 },
      evo:    { url:`assets/dragon/dragon_evo_lvl2_sprite.png?v=${VER}`,       frameW:607, frameH:607, frames:12, fps:12, renderScale:0.42 },
    },
    drawScale: 0.90,
    uiName: "Dragon"
  }
};

const HERO_CONFIG = {
  1: { id:"lvl1", ringIndex:0, maxHp:120, damage:16, speed:185, attackRange:138, attackCooldown:0.92, dragonThreat:19 },
  2: { id:"lvl2", ringIndex:1, maxHp:180, damage:28, speed:170, attackRange:128, attackCooldown:0.84, dragonThreat:28 },
  3: { id:"lvl3", ringIndex:2, maxHp:260, damage:42, speed:162, attackRange:122, attackCooldown:0.76, dragonThreat:36 },
  4: { id:"lvl4", ringIndex:3, maxHp:360, damage:74, speed:166, attackRange:126, attackCooldown:0.70, dragonThreat:50 },
  5: { id:"lvl5", ringIndex:4, maxHp:520, damage:118, speed:170, attackRange:132, attackCooldown:0.62, dragonThreat:68 },
};

const HERO_VISIBLE_BASE = { lvl1:312, lvl2:315, lvl3:312, lvl4:330, lvl5:346 };
const HERO_SLOT_BY_LEVEL = { 1:0, 2:1, 3:2, 4:3, 5:4 };
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
  ],
  5: [
    [[0.84,0.79],[0.76,0.72],[0.69,0.64],[0.65,0.55],[0.63,0.46]],
    [[0.86,0.80],[0.79,0.72],[0.71,0.64],[0.66,0.56],[0.64,0.46]],
    [[0.88,0.80],[0.81,0.72],[0.73,0.64],[0.67,0.56],[0.64,0.47]],
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
  queueEntries: new Map(),
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
    frame: 0,
    frameAcc: 0,
    hitFx: 0,
    attackTimer: 0,
    animKey: "idle",
    animLocked: false,
    pendingLevel: 1,
    nextPhaseAt: 0,
    flashFx: 0,
    killerHeroUid: null,
    roundWinnerUids: [],
    championHeroUid: null,
  },
  allTime: loadAllTimeStats(),
  dev: {
    ...loadDevConfig(),
    selectedKey: "dragon",
    selectedType: "dragon",
    handles: new Map(),
    panelOpen: false
  }
};
for (const level of Object.keys(HERO_CONFIG).map(Number)) { state.queueCounts.set(level, 0); state.queueEntries.set(level, []); }

function defaultAllTimeStats(){
  return {
    players: {},
    records: {
      topSummoner: null,
      topDamage: null,
      topSlayer: null,
      topCrit: null,
      topWinner: null,
      maxDragonLevel: 1
    }
  };
}
function loadAllTimeStats(){
  try{
    const raw = localStorage.getItem(ALL_TIME_STORAGE_KEY);
    if (!raw) return defaultAllTimeStats();
    const parsed = JSON.parse(raw);
    return { ...defaultAllTimeStats(), ...parsed, records:{ ...defaultAllTimeStats().records, ...(parsed?.records || {}) }, players: parsed?.players || {} };
  }catch{
    return defaultAllTimeStats();
  }
}
function saveAllTimeStats(){
  try{ localStorage.setItem(ALL_TIME_STORAGE_KEY, JSON.stringify(state.allTime)); }catch{}
}
function levelBadgeDataUri(level = 1){
  const colors = { 1:['#6f4b2a','#362112'], 2:['#9f4131','#4a1611'], 3:['#2d66b1','#152847'], 4:['#bf9224','#57390a'], 5:['#c52834','#51090d'] };
  const [c1,c2] = colors[level] || colors[1];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><circle cx="64" cy="64" r="61" fill="url(#g)" stroke="#f4d38a" stroke-width="4"/><text x="64" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="800" fill="#fff6da">L${level}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
function ensurePlayerStats(id, displayName = '---', level = 1){
  if (!state.allTime.players[id]){
    state.allTime.players[id] = {
      id, displayName, avatar: levelBadgeDataUri(level), highestLevel: level,
      summonCount:0, totalDamage:0, dragonKills:0, wins:0, crits:0, bestHit:0
    };
  }
  const p = state.allTime.players[id];
  p.displayName = displayName || p.displayName;
  p.avatar = p.avatar || levelBadgeDataUri(level);
  p.highestLevel = Math.max(p.highestLevel || 1, level || 1);
  return p;
}
function refreshAllTimeRecords(){
  for (const def of RECORD_DEFS){
    let best = null;
    for (const p of Object.values(state.allTime.players)){
      if (!best || (p[def.stat] || 0) > (best[def.stat] || 0)) best = p;
    }
    state.allTime.records[def.key] = best ? best.id : null;
  }
  state.allTime.records.maxDragonLevel = Math.max(state.allTime.records.maxDragonLevel || 1, state.dragon.level || 1, state.dragon.pendingLevel || 1);
}
function renderAllTimeStats(){
  for (const def of RECORD_DEFS){
    const id = state.allTime.records[def.key];
    const p = id ? state.allTime.players[id] : null;
    const avatar = document.getElementById(`recordAvatar-${def.key}`);
    const name = document.getElementById(`recordName-${def.key}`);
    const value = document.getElementById(`recordValue-${def.key}`);
    if (avatar) avatar.src = p?.avatar || levelBadgeDataUri(1);
    if (name) name.textContent = p?.displayName || '---';
    if (value) value.textContent = p ? def.format(p[def.stat]) : '0';
  }
  const dragonValue = document.getElementById('recordDragonValue');
  const dragonAvatar = document.getElementById('recordDragonAvatar');
  if (dragonValue) dragonValue.textContent = `${Math.max(1, Math.round(state.allTime.records.maxDragonLevel || 1))}`;
  if (dragonAvatar && !dragonAvatar.getAttribute('src')) dragonAvatar.src = `assets/ui/dragon_record.png?v=${VER}`;
}
function commitAllTimeChange(){
  refreshAllTimeRecords();
  renderAllTimeStats();
  saveAllTimeStats();
}
function playerStatsFromHero(hero){
  return ensurePlayerStats(`lvl-${hero.level}-${hero.displayName}`, hero.displayName, hero.level);
}

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t){ return a + (b - a) * t; }
function distance(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
function worldToStage(x, y){ return { x: x * state.width, y: y * state.height }; }
function status(text){ statusText.textContent = text; }
function dragonInTransition(){ return !state.dragon.alive || state.dragon.animKey === "death" || state.dragon.animKey === "evo"; }
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
function heroVisibleTargetPx(){
  return isDesktopSizeBoost() ? state.dev.tuning.desktopHeroVisible : state.dev.tuning.mobileHeroVisible;
}
function heroBaseScale(hero){
  const baseVisible = HERO_VISIBLE_BASE[hero.cfg.id] || 320;
  return heroVisibleTargetPx() / baseVisible;
}
function heroDepthScale(yPx){
  const t = depthNorm(yPx);
  const mobile = !isDesktopSizeBoost();
  const nearScale = mobile ? state.dev.tuning.mobileNearScale : state.dev.tuning.desktopNearScale;
  const curve = mobile
    ? [[0.00,nearScale],[0.20,nearScale + 0.02],[0.34,nearScale + 0.06],[0.48,nearScale + 0.19],[0.58,nearScale + 0.33],[0.70,nearScale + 0.51],[0.82,1.00],[1.00,1.00]]
    : [[0.00,nearScale],[0.20,nearScale + 0.02],[0.34,nearScale + 0.06],[0.48,nearScale + 0.20],[0.58,nearScale + 0.32],[0.70,nearScale + 0.50],[0.82,1.00],[1.00,1.00]];
  return clamp(sampleTrack(t, curve), nearScale, 1.00);
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
  const strength = isDesktopSizeBoost() ? state.dev.tuning.desktopPerspective : state.dev.tuning.mobilePerspective;
  return lerp(-state.width * 0.012 * strength, state.width * 0.010 * strength, t);
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
function dragonCombatCenter(){
  return {
    x: state.dragon.x,
    y: state.dragon.y - state.height * 0.028,
  };
}
function dragonSpriteSetForLevel(level = state.dragon.level){
  return level <= 1 ? SPRITES.dragon.lvl1 : SPRITES.dragon.lvl2;
}
function dragonSpriteMeta(level = state.dragon.level, animKey = state.dragon.animKey || "idle"){
  const set = dragonSpriteSetForLevel(level);
  return set[animKey] || set.idle;
}
function setDragonAnim(animKey, { restart = false, lock = false } = {}){
  if (!restart && state.dragon.animKey === animKey && state.dragon.animLocked === lock) return;
  state.dragon.animKey = animKey;
  state.dragon.animLocked = lock;
  state.dragon.frame = 0;
  state.dragon.frameAcc = 0;
}
function makeWinnerPoint(level){
  const slotIndex = HERO_SLOT_BY_LEVEL[level] ?? 2;
  const slot = state.dev.winnerSlots[slotIndex] || state.dev.winnerSlots[2] || DEFAULT_DEV_CONFIG.winnerSlots[2];
  return clampToWalkable(worldToStage(slot.x, slot.y));
}
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

function exportDevJson(){
  return JSON.stringify({
    version: DEFAULT_DEV_CONFIG.version,
    file: DEV_CONFIG_FILE_NAME,
    savedAt: new Date().toISOString(),
    dragon: {
      x: +state.dev.dragon.x.toFixed(4),
      y: +state.dev.dragon.y.toFixed(4),
    },
    rings: state.dev.rings.map((ring) => ({
      level: ring.level,
      x: +ring.x.toFixed(4),
      y: +ring.y.toFixed(4),
    })),
    attackSlots: state.dev.attackSlots.map((slot) => ({
      id: slot.id,
      x: +slot.x.toFixed(4),
      y: +slot.y.toFixed(4),
    })),
    winnerSlots: state.dev.winnerSlots.map((slot) => ({
      id: slot.id,
      x: +slot.x.toFixed(4),
      y: +slot.y.toFixed(4),
    })),
    tuning: Object.fromEntries(Object.entries(state.dev.tuning).map(([k,v]) => [k, +(Number(v).toFixed(4))]))
  }, null, 2);
}
function syncDevExportBox(){
  devExportBox?.removeAttribute("readonly");
  if (!devExportBox) return;
  devExportBox.value = exportDevJson();
}
function applyDevConfigToScene(){
  BG_ANALYSIS.dragon.x = clamp01(state.dev.dragon.x);
  BG_ANALYSIS.dragon.y = clamp01(state.dev.dragon.y);
  BG_ANALYSIS.rings.forEach((ring, idx) => {
    ring.x = clamp01(state.dev.rings[idx]?.x ?? ring.x);
    ring.y = clamp01(state.dev.rings[idx]?.y ?? ring.y);
  });
  state.dev.tuning.desktopHeroVisible = clamp(Number(state.dev.tuning.desktopHeroVisible), 120, 240);
  state.dev.tuning.mobileHeroVisible = clamp(Number(state.dev.tuning.mobileHeroVisible), 70, 180);
  state.dev.tuning.desktopNearScale = clamp(Number(state.dev.tuning.desktopNearScale), 0.08, 0.50);
  state.dev.tuning.mobileNearScale = clamp(Number(state.dev.tuning.mobileNearScale), 0.08, 0.50);
  state.dev.tuning.desktopPerspective = clamp(Number(state.dev.tuning.desktopPerspective), 0.20, 2.00);
  state.dev.tuning.mobilePerspective = clamp(Number(state.dev.tuning.mobilePerspective), 0.20, 2.00);
  state.dev.tuning.dragonDrawScale = clamp(Number(state.dev.tuning.dragonDrawScale), 0.40, 1.60);
  saveDevConfig();
  syncDevExportBox();
}
function mergeImportedDevConfig(parsed){
  if (!parsed || typeof parsed !== "object") throw new Error("Пустой конфиг.");
  state.dev.dragon.x = clamp01(Number(parsed?.dragon?.x ?? state.dev.dragon.x));
  state.dev.dragon.y = clamp01(Number(parsed?.dragon?.y ?? state.dev.dragon.y));
  state.dev.rings.forEach((ring, idx) => {
    ring.x = clamp01(Number(parsed?.rings?.[idx]?.x ?? ring.x));
    ring.y = clamp01(Number(parsed?.rings?.[idx]?.y ?? ring.y));
  });
  state.dev.attackSlots.forEach((slot, idx) => {
    slot.x = clampAttackOffset(Number(parsed?.attackSlots?.[idx]?.x ?? slot.x), "x");
    slot.y = clampAttackOffset(Number(parsed?.attackSlots?.[idx]?.y ?? slot.y), "y");
  });
  state.dev.winnerSlots.forEach((slot, idx) => {
    slot.x = clamp01(Number(parsed?.winnerSlots?.[idx]?.x ?? slot.x));
    slot.y = clamp01(Number(parsed?.winnerSlots?.[idx]?.y ?? slot.y));
  });
  state.dev.tuning = {
    desktopHeroVisible: clamp(Number(parsed?.tuning?.desktopHeroVisible ?? state.dev.tuning.desktopHeroVisible), 120, 240),
    mobileHeroVisible: clamp(Number(parsed?.tuning?.mobileHeroVisible ?? state.dev.tuning.mobileHeroVisible), 70, 180),
    desktopNearScale: clamp(Number(parsed?.tuning?.desktopNearScale ?? state.dev.tuning.desktopNearScale), 0.08, 0.50),
    mobileNearScale: clamp(Number(parsed?.tuning?.mobileNearScale ?? state.dev.tuning.mobileNearScale), 0.08, 0.50),
    desktopPerspective: clamp(Number(parsed?.tuning?.desktopPerspective ?? state.dev.tuning.desktopPerspective), 0.20, 2.00),
    mobilePerspective: clamp(Number(parsed?.tuning?.mobilePerspective ?? state.dev.tuning.mobilePerspective), 0.20, 2.00),
    dragonDrawScale: clamp(Number(parsed?.tuning?.dragonDrawScale ?? state.dev.tuning.dragonDrawScale), 0.40, 1.60),
  };
  applyDevConfigToScene();
  buildDevWidget();
  resize();
  updateHandlePositionsOnly();
  status("Конфиг загружен: точки, размеры и перспектива восстановлены.");
}
function applyDevJsonFromTextarea(){
  try{
    const parsed = JSON.parse(devExportBox?.value || "{}");
    mergeImportedDevConfig(parsed);
  }catch(err){
    status(`Ошибка JSON конфига: ${err?.message || err}`);
  }
}
function downloadDevConfigFile(){
  try{
    const blob = new Blob([exportDevJson()], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = DEV_CONFIG_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    status("Конфиг сохранён в JSON-файл.");
  }catch(err){
    status(`Не удалось скачать конфиг: ${err?.message || err}`);
  }
}
function promptImportDevConfigFile(){
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try{
      const text = await file.text();
      devExportBox.value = text;
      applyDevJsonFromTextarea();
    }catch(err){
      status(`Не удалось прочитать файл конфига: ${err?.message || err}`);
    }
  }, { once:true });
  input.click();
}
function editorItems(){
  return [
    { key:"dragon", type:"dragon", label:"Dragon", get:() => state.dev.dragon },
    ...state.dev.rings.map((ring, idx) => ({ key:`ring-${ring.level}`, type:"spawn", label:`Spawn LVL ${ring.level}`, get:() => state.dev.rings[idx] })),
    ...state.dev.attackSlots.map((slot, idx) => ({ key:`attack-${slot.id}`, type:"attack", label:`Attack Slot ${slot.id}`, get:() => state.dev.attackSlots[idx] })),
    ...state.dev.winnerSlots.map((slot, idx) => ({ key:`winner-${slot.id}`, type:"winner", label:`Winner LVL ${slot.id}`, get:() => state.dev.winnerSlots[idx] })),
  ];
}
function selectedEditorItem(){
  return editorItems().find((item) => item.key === state.dev.selectedKey) || editorItems()[0];
}
function setSelectedEditorItem(key){
  state.dev.selectedKey = key;
  state.dev.selectedType = key.split("-")[0] === "ring" ? "spawn" : key.split("-")[0] === "attack" ? "attack" : key.split("-")[0] === "winner" ? "winner" : "dragon";
  refreshDevPanelState();
  renderEditorHandles();
}
function editorHandleStagePos(item){
  const pos = item.get();
  if (item.type === "attack"){
    const center = dragonCombatCenter();
    return {
      x: center.x + pos.x * state.width,
      y: center.y + pos.y * state.height,
    };
  }
  return { x: pos.x * state.width, y: pos.y * state.height };
}
function renderEditorHandles(){
  if (!editorLayer) return;
  editorLayer.innerHTML = "";
  if (!state.dev.showHandles) return;
  for (const item of editorItems()){
    const pos = editorHandleStagePos(item);
    const el = document.createElement("button");
    el.type = "button";
    el.className = `editor-handle ${item.type}${state.dev.selectedKey === item.key ? " selected" : ""}`;
    el.dataset.key = item.key;
    el.dataset.label = item.label;
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    el.addEventListener("pointerdown", onEditorHandlePointerDown);
    editorLayer.appendChild(el);
    state.dev.handles.set(item.key, el);
  }
}
function updateHandlePositionsOnly(){
  if (!state.dev.showHandles) return;
  for (const item of editorItems()){
    const el = state.dev.handles.get(item.key);
    if (!el) continue;
    const pos = editorHandleStagePos(item);
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    el.classList.toggle("selected", state.dev.selectedKey === item.key);
  }
}
function updateDevButtons(){
  if (devHandlesToggle) devHandlesToggle.textContent = `Точки: ${state.dev.showHandles ? "ON" : "OFF"}`;
  if (devCompactToggle) devCompactToggle.textContent = state.dev.compactSections ? "Развернуть секции" : "Свернуть секции";
}
function refreshDevPanelState(){
  updateDevButtons();
  if (!devWidgetSections) return;
  devWidgetSections.querySelectorAll("[data-editor-key]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.editorKey === state.dev.selectedKey);
  });
}
function makeSliderRow({ label, value, min, max, step, suffix = "", onInput }){
  const row = document.createElement("label");
  row.className = "dev-slider-row";
  const top = document.createElement("div");
  top.className = "dev-slider-top";
  const name = document.createElement("span");
  name.textContent = label;
  const out = document.createElement("output");
  out.textContent = `${Number(value).toFixed(step < 1 ? 2 : 0)}${suffix}`;
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.className = "dev-slider";
  input.addEventListener("input", () => {
    const next = Number(input.value);
    out.textContent = `${next.toFixed(step < 1 ? 2 : 0)}${suffix}`;
    onInput(next);
  });
  top.append(name, out);
  row.append(top, input);
  return row;
}
function makeTuningSection(){
  const sec = document.createElement("section");
  sec.className = "dev-sec";
  const head = document.createElement("div");
  head.className = "dev-sec-head";
  head.innerHTML = `<span>Размеры и перспектива</span><span>LIVE</span>`;
  const body = document.createElement("div");
  body.className = "dev-sec-body";
  body.append(
    makeSliderRow({ label:"Hero size PC", value:state.dev.tuning.desktopHeroVisible, min:120, max:240, step:1, suffix:"px", onInput:(v)=>{ state.dev.tuning.desktopHeroVisible = v; applyDevConfigToScene(); resize(); }}),
    makeSliderRow({ label:"Hero size Mobile", value:state.dev.tuning.mobileHeroVisible, min:70, max:180, step:1, suffix:"px", onInput:(v)=>{ state.dev.tuning.mobileHeroVisible = v; applyDevConfigToScene(); resize(); }}),
    makeSliderRow({ label:"Near scale PC", value:state.dev.tuning.desktopNearScale, min:0.08, max:0.50, step:0.01, onInput:(v)=>{ state.dev.tuning.desktopNearScale = v; applyDevConfigToScene(); resize(); }}),
    makeSliderRow({ label:"Near scale Mobile", value:state.dev.tuning.mobileNearScale, min:0.08, max:0.50, step:0.01, onInput:(v)=>{ state.dev.tuning.mobileNearScale = v; applyDevConfigToScene(); resize(); }}),
    makeSliderRow({ label:"Perspective PC", value:state.dev.tuning.desktopPerspective, min:0.20, max:2.00, step:0.01, onInput:(v)=>{ state.dev.tuning.desktopPerspective = v; applyDevConfigToScene(); resize(); }}),
    makeSliderRow({ label:"Perspective Mobile", value:state.dev.tuning.mobilePerspective, min:0.20, max:2.00, step:0.01, onInput:(v)=>{ state.dev.tuning.mobilePerspective = v; applyDevConfigToScene(); resize(); }}),
    makeSliderRow({ label:"Dragon scale", value:state.dev.tuning.dragonDrawScale, min:0.40, max:1.60, step:0.01, onInput:(v)=>{ state.dev.tuning.dragonDrawScale = v; applyDevConfigToScene(); resize(); }}),
  );
  sec.append(head, body);
  return sec;
}
function makeActionsSection(){
  const sec = document.createElement("section");
  sec.className = "dev-sec";
  const head = document.createElement("div");
  head.className = "dev-sec-head";
  head.innerHTML = `<span>Конфиг</span><span>JSON</span>`;
  const body = document.createElement("div");
  body.className = "dev-sec-body";
  const hint = document.createElement("div");
  hint.className = "dev-hint";
  hint.textContent = "Настройки уже сохраняются в браузере автоматически. Ниже можно скачать JSON-файл, чтобы перенести точки, размеры и перспективу после перезапуска или на другое устройство.";
  const row = document.createElement("div");
  row.className = "dev-actions-row";
  const btnApply = document.createElement("button");
  btnApply.type = "button";
  btnApply.className = "dev-action-btn";
  btnApply.textContent = "Применить JSON";
  btnApply.addEventListener("click", applyDevJsonFromTextarea);
  const btnImport = document.createElement("button");
  btnImport.type = "button";
  btnImport.className = "dev-action-btn";
  btnImport.textContent = "Загрузить файл";
  btnImport.addEventListener("click", promptImportDevConfigFile);
  const btnDownload = document.createElement("button");
  btnDownload.type = "button";
  btnDownload.className = "dev-action-btn";
  btnDownload.textContent = "Скачать конфиг";
  btnDownload.addEventListener("click", downloadDevConfigFile);
  row.append(btnApply, btnImport, btnDownload);
  body.append(hint, row);
  sec.append(head, body);
  return sec;
}
function makeDevSection(title, hint, items){
  const sec = document.createElement("section");
  sec.className = `dev-sec${state.dev.compactSections ? " collapsed" : ""}`;
  const head = document.createElement("button");
  head.type = "button";
  head.className = "dev-sec-head";
  head.innerHTML = `<span>${title}</span><span>${state.dev.compactSections ? "▸" : "▾"}</span>`;
  const body = document.createElement("div");
  body.className = "dev-sec-body";
  if (hint){
    const hintEl = document.createElement("div");
    hintEl.className = "dev-hint";
    hintEl.textContent = hint;
    body.appendChild(hintEl);
  }
  const list = document.createElement("div");
  list.className = "dev-list";
  for (const item of items){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dev-item-btn";
    btn.dataset.editorKey = item.key;
    btn.textContent = item.label;
    btn.addEventListener("click", () => setSelectedEditorItem(item.key));
    list.appendChild(btn);
  }
  body.appendChild(list);
  head.addEventListener("click", () => {
    sec.classList.toggle("collapsed");
    head.lastElementChild.textContent = sec.classList.contains("collapsed") ? "▸" : "▾";
  });
  sec.append(head, body);
  return sec;
}
function buildDevWidget(){
  if (!devWidgetSections) return;
  devWidgetSections.innerHTML = "";
  const dragonItems = editorItems().filter((item) => item.type === "dragon");
  const spawnItems = editorItems().filter((item) => item.type === "spawn");
  const attackItems = editorItems().filter((item) => item.type === "attack");
  const winnerItems = editorItems().filter((item) => item.type === "winner");
  devWidgetSections.append(
    makeTuningSection(),
    makeActionsSection(),
    makeDevSection("Dragon", "Выбери точку и перетаскивай её прямо на сцене. Красная точка показывает место постановки.", dragonItems),
    makeDevSection("Spawn points", "Точки спавна героев. Их можно скрыть кнопкой «Точки».", spawnItems),
    makeDevSection("Attack slots", "Пять боевых точек вокруг дракона для LVL 1–5.", attackItems),
    makeDevSection("Winner slots", "Пять позиций победителя после убийства дракона для LVL 1–5.", winnerItems),
  );
  refreshDevPanelState();
  syncDevExportBox();
}
function resetDevView(){
  state.dev.showHandles = true;
  state.dev.compactSections = false;
  state.dev.panelOpen = true;
  updateDevButtons();
  buildDevWidget();
  renderEditorHandles();
}
function onEditorHandlePointerDown(event){
  event.preventDefault();
  event.stopPropagation();
  const key = event.currentTarget.dataset.key;
  setSelectedEditorItem(key);
  const selected = selectedEditorItem();
  const target = selected.get();
  const move = (ev) => {
    const rect = stage.getBoundingClientRect();
    const x = clamp01((ev.clientX - rect.left) / Math.max(rect.width, 1));
    const y = clamp01((ev.clientY - rect.top) / Math.max(rect.height, 1));
    if (selected.type === "attack"){
      const dx = x - state.dev.dragon.x;
      const dy = y - state.dev.dragon.y;
      target.x = clampAttackOffset(dx, "x");
      target.y = clampAttackOffset(dy, "y");
    }else{
      target.x = x;
      target.y = y;
    }
    applyDevConfigToScene();
    resize();
    updateHandlePositionsOnly();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up, { once:true });
}

function makeHeroDom(level){
  const heroEl = document.createElement("div");
  heroEl.className = `entity hero level${level}`;
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
  const heroAura = document.createElement("div");
  heroAura.className = "heroAura";
  const championAura = document.createElement("div");
  championAura.className = "championAura";
  const sprite = document.createElement("div");
  sprite.className = "sprite";
  heroEl.append(label, hpbar, selectionCircle, spawnGlow, teleportRays, heroAura, championAura, sprite);
  entitiesLayer.appendChild(heroEl);
  return { heroEl, labelEl:label, hpBarEl:hpbar, hpFillEl:hpfill, spriteEl:sprite, selectionCircleEl:selectionCircle, heroAuraEl:heroAura, championAuraEl:championAura };
}

function pickRoute(level){
  const variants = ROUTES[level] || [];
  if (!variants.length) return [];
  const prev = state.activeHeroes.get(level)?._routeVariant ?? -1;
  let idx = Math.floor(Math.random() * variants.length);
  if (variants.length > 1 && idx === prev) idx = (idx + 1) % variants.length;
  return { idx, points: variants[idx].map(([x,y]) => clampToWalkable(worldToStage(x, y))) };
}
function makeDragonApproachSlots(){
  const center = dragonCombatCenter();
  return state.dev.attackSlots.map((slot) => clampToWalkable({
    x: center.x + slot.x * state.width,
    y: center.y + slot.y * state.height
  }));
}
function makeDragonApproachPoint(level){
  const slots = makeDragonApproachSlots();
  const slotIndex = HERO_SLOT_BY_LEVEL[level] ?? 2;
  return slots[slotIndex] || slots[2] || clampToWalkable({ x: state.dragon.x, y: state.dragon.y });
}
function makeHero(level, entry = {}){
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
    mode: "idle",
    aiState: "spawnHold",
    winnerTargetX: spawnPos.x,
    winnerTargetY: spawnPos.y,
    isChampion: false,
    championAura: false,
    defenseMul: 1,
    flipX: false,
    hp: heroCfg.maxHp,
    maxHp: heroCfg.maxHp,
    alive: true,
    spawningUntil: performance.now() + 900,
    spawnHoldUntil: performance.now() + 1450,
    displayName: String(entry.displayName || `LVL ${level} HERO`),
    avatar: String(entry.avatar || levelBadgeDataUri(level)),
    playerId: String(entry.playerId || `lvl-${level}-${entry.displayName || `LVL ${level} HERO`}`),
    summonSource: String(entry.source || 'ui'),
    attackCd: 0,
    spriteKey: "idleFront",
    frame: 0,
    frameAcc: 0,
    frameFrozen: false,
    baseScale: heroVisibleTargetPx() / (HERO_VISIBLE_BASE[heroCfg.id] || 320),
    _lastLabelText: "",
    _lastHpWidth: "",
    _lastLeft: "",
    _lastTop: "",
    _lastZ: "",
    _lastHpTop: "",
    _lastLabelTop: "",
    _lastAuraSize: "",
    _lastChampionState: false,
  };
}
function destroyHero(hero){
  if (!hero) return;
  hero.heroEl.remove();
  state.heroes.delete(hero.uid);
  if (state.activeHeroes.get(hero.level)?.uid === hero.uid) state.activeHeroes.delete(hero.level);
  syncQueueBadge(hero.level);
}
function registerSummonCombo(hero){
  const now = performance.now();
  recentSummons = recentSummons.filter((item) => now - item.time <= 2600);
  recentSummons.push({ time:now, level:hero.level, name:hero.displayName });
  const combo = recentSummons.length;
  const key = combo >= 20 ? 'combo20' : combo >= 10 ? 'combo10' : combo >= 5 ? 'combo5' : combo >= 3 ? 'combo3' : combo >= 2 ? 'combo2' : '';
  if (!key) return;
  playFromPool(SFX[key], 1, 1);
  triggerBgmDuck(combo >= 10 ? 0.07 : 0.05, 220);
  const title = combo >= 20 ? 'WORLD BREAKER' : combo >= 10 ? 'GODLIKE COMBO' : combo >= 5 ? 'LEGENDARY COMBO' : combo >= 3 ? 'TRIPLE STRIKE' : 'DOUBLE POWER';
  spawnBattleNotice(`${combo}x COMBO`, title, 'combo');
}
function dequeueEntry(level){
  const queue = state.queueEntries.get(level) || [];
  const entry = queue.shift() || null;
  state.queueCounts.set(level, queue.length);
  syncQueueBadge(level);
  return entry;
}
function spawnHeroFromQueue(level, entry = null){
  const current = state.activeHeroes.get(level);
  if (current) destroyHero(current);
  const hero = makeHero(level, entry || {});
  state.heroes.set(hero.uid, hero);
  state.activeHeroes.set(level, hero);
  syncQueueBadge(level);
  spawnRingGlow(level);
  spawnTeleportFx(hero.x, hero.y + 2, hero.level);
  playFromPool(SFX.heroSpawn, 1, 1);
  triggerBgmDuck(0.04, 160);
  playSynth("spawn");
  registerSummonCombo(hero);
  selectLevel(level);
  const stats = ensurePlayerStats(hero.playerId, hero.displayName, hero.level);
  stats.avatar = hero.avatar || stats.avatar;
  stats.summonCount += 1;
  commitAllTimeChange();
  status(`${hero.displayName} призван и готовится к выходу к дракону.`);
  return hero;
}
function trySpawnNextFromQueue(level){
  if (dragonInTransition()) return;
  const current = state.activeHeroes.get(level);
  if (current && current.alive) return;
  const queued = state.queueCounts.get(level) || 0;
  if (queued <= 0) return;
  const entry = dequeueEntry(level);
  spawnHeroFromQueue(level, entry);
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
  if (hero.mode === "winner" && hero.isChampion && hero.sprites.winner) return { key:"winner", flipX:hero.flipX };
  if (hero.aiState === "winner" || hero.aiState === "winnerTravel") return { key:"idleFront", flipX:false };
  if (hero.dir8 === 6 || hero.dir8 === 7 || hero.dir8 === 5) return { key:"idleBack", flipX:hero.flipX };
  return { key:"idleFront", flipX:hero.flipX };
}

function updateHeroAI(hero){
  if (!hero.alive) return;
  if (hero.aiState === "spawnHold"){
    hero.targetX = hero.spawnX;
    hero.targetY = hero.spawnY;
    if (performance.now() >= hero.spawnHoldUntil) hero.aiState = "route";
    return;
  }
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
  if (hero.aiState === "winnerTravel" || hero.aiState === "winner" || hero.aiState === "championWinnerTravel" || hero.aiState === "championWinner"){
    const winnerPoint = makeWinnerPoint(hero.level);
    hero.winnerTargetX = winnerPoint.x;
    hero.winnerTargetY = winnerPoint.y;
    hero.targetX = winnerPoint.x;
    hero.targetY = winnerPoint.y;
    if (distance(hero, winnerPoint) <= 10) hero.aiState = hero.isChampion ? "championWinner" : "winner";
    return;
  }
  if (hero.aiState === "championReturn"){
    hero.aiState = "engage";
  }
  if (!state.dragon.alive) return;
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
    if (performance.now() < hero.spawnHoldUntil){
      hero.mode = 'idle';
      hero.targetX = hero.spawnX;
      hero.targetY = hero.spawnY;
    }
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
      hero.mode = (hero.aiState === 'championWinner' || hero.aiState === 'championWinnerTravel') ? 'winner' : 'idle';
    }

    if (dragon.alive){
      const combatCenter = dragonCombatCenter();
      const distToDragon = Math.hypot(hero.x - combatCenter.x, hero.y - combatCenter.y);
      if (performance.now() >= hero.spawnHoldUntil && distToDragon <= combatRange(hero.cfg.attackRange) && hero.attackCd <= 0){
        hero.mode = "attack";
        hero.attackCd = hero.cfg.attackCooldown;
        hero.frame = 0;
        hero.frameAcc = 0;
        hero.frameFrozen = false;
        hero.flipX = hero.x > dragon.x;
        hero.dir8 = hero.y > dragon.y ? 6 : 2;
        const critical = hero.championAura || Math.random() < 0.12;
        const damage = hero.cfg.damage * (hero.championAura ? 2 : 1) * (critical ? 1.6 : 1);
        dragon.hp = Math.max(0, dragon.hp - damage);
        dragon.hitFx = critical ? 0.28 : 0.18;
        playSynth("slash");
        playFromPool(SFX.heroHit, 1, 0.98 + Math.random() * 0.06);
        playFromPool(SFX.hit, 1, 0.98 + Math.random() * 0.06);
        playFromPool(SFX.dragonHit, critical ? 1.16 : 1, 0.98 + Math.random() * 0.06);
        if (critical) playFromPool(SFX.critical, 1, 1);
        spawnDamageFx(dragon.x, dragon.y - 66, damage, true, critical ? 'CRITICAL HIT' : 'HIT');
        const heroStats = playerStatsFromHero(hero);
        heroStats.totalDamage += damage;
        heroStats.bestHit = Math.max(heroStats.bestHit || 0, damage);
        if (critical) heroStats.crits += 1;
        commitAllTimeChange();
        spawnCombatNotice(dragon.x, dragon.y - 128, hero.displayName, `${critical ? 'CRITICAL HIT' : 'hit a Dragon'}\n-${Math.round(damage)}HP`, critical ? 'critical' : 'hit');
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
  if (hero.mode === "attack" && hero.alive && hero.attackCd < hero.cfg.attackCooldown * 0.52) hero.mode = (hero.aiState === 'championWinner' || hero.aiState === 'championWinnerTravel') ? 'winner' : 'idle';

  hero.baseScale = heroBaseScale(hero);
  hero._minScale = hero.baseScale * 0.18;
  hero._maxScale = hero.baseScale;
  const rawScale = heroDepthScale(hero.y) * hero.baseScale;
  const holdStable = hero.mode !== "walk";
  const scale = snapStableScale(hero, rawScale, holdStable);
  const perspectiveShift = diabloPerspectiveShift(hero.y);
  const left = `${hero.x + perspectiveShift}px`;
  const top = `${Math.round(hero.y)}px`;
  const z = String(Math.round(hero.y));
  if (hero._lastLeft !== left){ hero.heroEl.style.left = left; hero._lastLeft = left; }
  if (hero._lastTop !== top){ hero.heroEl.style.top = top; hero._lastTop = top; }
  if (hero._lastZ !== z){ hero.heroEl.style.zIndex = z; hero._lastZ = z; }

  const labelText = `${hero.sprites.uiName}${hero.championAura ? " · x2 AURA" : ""} · ${Math.max(0, Math.ceil(hero.hp))}/${hero.maxHp}`;
  if (hero._lastLabelText !== labelText){ hero.labelEl.textContent = labelText; hero._lastLabelText = labelText; }
  const hpWidth = `${(hero.hp / hero.maxHp) * 100}%`;
  if (hero._lastHpWidth !== hpWidth){ hero.hpFillEl.style.width = hpWidth; hero._lastHpWidth = hpWidth; }

  const frameScaleComp = spriteMeta.frameScaleComp?.[hero.frame] || 1;
  const spriteHeight = spriteMeta.frameH * scale * (spriteMeta.renderScale || 1) * frameScaleComp;
  const hpTop = `${-spriteHeight - 12}px`;
  const labelTop = `${-spriteHeight - 26}px`;
  if (hero._lastHpTop !== hpTop){ hero.hpBarEl.style.top = hpTop; hero._lastHpTop = hpTop; }
  if (hero._lastLabelTop !== labelTop){ hero.labelEl.style.top = labelTop; hero._lastLabelTop = labelTop; }
  hero.selectionCircleEl.style.bottom = `${Math.max(-10, -spriteHeight * 0.045)}px`;

  const auraSize = `${Math.max(72, spriteHeight * 0.34)}px`;
  if (hero._lastAuraSize !== auraSize){
    hero.heroAuraEl.style.width = auraSize;
    hero.heroAuraEl.style.height = auraSize;
    hero.championAuraEl.style.width = auraSize;
    hero.championAuraEl.style.height = auraSize;
    hero._lastAuraSize = auraSize;
  }
  if (hero._lastChampionState !== hero.championAura){
    hero.heroEl.classList.toggle("champion", !!hero.championAura);
    hero._lastChampionState = hero.championAura;
  }

  applySpriteToEl(hero.spriteEl, spriteMeta, scale, hero.frame, hero.flipX);
  hero.spriteEl.style.filter = hero.alive ? "" : "saturate(.45) brightness(.74)";
}
function applyChampionAura(hero){
  if (!hero || !hero.alive || hero.championAura) return;
  hero.isChampion = true;
  hero.championAura = true;
  hero.maxHp *= 2;
  hero.hp = Math.min(hero.maxHp, hero.hp * 2);
  hero.defenseMul = 2;
  spawnImpactFx(hero.x, hero.y - 28, "hero");
  playFromPool(SFX.powerUp);
  spawnDamageFx(hero.x, hero.y - 92, 0, false, "x2 AURA");
  spawnBattleNotice(hero.displayName, 'POWER x2 AURA', 'power');
  triggerBgmDuck(0.08, 260);
}
function removeHeroWithFlash(hero){
  if (!hero) return;
  spawnTeleportFx(hero.x, hero.y - 4, hero.level);
  spawnImpactFx(hero.x, hero.y - 18, "hero");
  setTimeout(() => {
    if (state.heroes.has(hero.uid)){
      destroyHero(hero);
      trySpawnNextFromQueue(hero.level);
    }
  }, 180);
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
  hero.championAura = false;
  hero.defenseMul = 1;
  hero.isChampion = false;
  playSynth("death");
  spawnDamageFx(hero.x, hero.y - 56, 0, false, 'DEFEATED');
  spawnImpactFx(hero.x, hero.y - 18, 'death');
  spawnCombatNotice(hero.x, hero.y - 108, hero.displayName, 'DEFEATED', 'danger');
  triggerBgmDuck(0.05, 180);
  status(`LVL ${hero.level} пал. Следующий выйдет из очереди.`);
}
function handleDragonDeath(hero){
  state.dragon.alive = false;
  state.dragon.attackTimer = 999;
  state.dragon.pendingLevel = state.dragon.level + 1;
  state.dragon.killerHeroUid = hero.uid;
  state.dragon.championHeroUid = hero.uid;
  const deathMeta = dragonSpriteMeta(state.dragon.level, "death");
  setDragonAnim("death", { restart:true, lock:true });
  state.dragon.nextPhaseAt = performance.now() + ((Math.max(1, deathMeta.frames - 1) / deathMeta.fps) * 1000) + 3000;
  const livingParticipants = [...state.activeHeroes.values()].filter((unit) => unit?.alive);
  state.dragon.roundWinnerUids = livingParticipants.map((unit) => unit.uid);
  livingParticipants.forEach((unit) => {
    unit.frame = 0;
    unit.frameAcc = 0;
    unit.frameFrozen = false;
    unit.attackCd = 0;
    unit.dir8 = 2;
    if (unit.uid === hero.uid){
      unit.isChampion = true;
      unit.aiState = 'championWinnerTravel';
      unit.mode = 'walk';
    } else {
      unit.aiState = 'winnerTravel';
      unit.mode = 'walk';
      unit.flipX = false;
    }
  });
  playFromPool(SFX.dragonDie);
  playFromPool(SFX.victory);
  triggerBgmDuck(0.07, 320);
  stopAllBgm();
  spawnDamageFx(state.dragon.x, state.dragon.y - 100, 0, true, 'SLAIN');
  spawnImpactFx(state.dragon.x, state.dragon.y - 30, 'death');
  const killerStats = playerStatsFromHero(hero);
  killerStats.dragonKills += 1;
  for (const uid of state.dragon.roundWinnerUids){
    const unit = state.heroes.get(uid);
    if (!unit) continue;
    playerStatsFromHero(unit).wins += 1;
  }
  commitAllTimeChange();
  spawnBattleNotice(hero.displayName, 'WON', 'victory');
  status(`Дракон ${state.dragon.level} уровня повержен. Все выжившие уходят в winner-точки, труп держится 3 сек и начинается перерождение.`);
}
function respawnDragonStronger(){
  const prevChampionUid = state.dragon.championHeroUid;
  const roundWinnerUids = [...(state.dragon.roundWinnerUids || [])];
  state.dragon.level = state.dragon.pendingLevel || (state.dragon.level + 1);
  state.dragon.maxHp = Math.round(state.dragon.baseMaxHp * Math.pow(1.26, state.dragon.level - 1));
  state.dragon.hp = state.dragon.maxHp;
  state.dragon.damage = Math.round(state.dragon.baseDamage * Math.pow(1.18, state.dragon.level - 1));
  state.dragon.alive = true;
  state.dragon.attackTimer = 0.72;
  state.dragon.hitFx = 0.28;
  state.dragon.flashFx = 0.30;
  state.dragon.animLocked = false;
  setDragonAnim('idle', { restart:true });
  playFromPool(SFX.dragonSpawn);
  playFromPool(SFX.dragonRoar, 1, 1);
  spawnImpactFx(state.dragon.x, state.dragon.y - 20, 'hero');
  spawnBattleNotice(`DRAGON LVL ${state.dragon.level}`, 'RESPAWNED', 'system');

  roundWinnerUids.forEach((uid) => {
    const unit = state.heroes.get(uid);
    if (!unit || !unit.alive) return;
    if (uid === prevChampionUid){
      applyChampionAura(unit);
      unit.aiState = 'championReturn';
      unit.mode = 'walk';
      unit.frame = 0;
      unit.frameAcc = 0;
      unit.frameFrozen = false;
    } else {
      removeHeroWithFlash(unit);
    }
  });
  state.dragon.roundWinnerUids = [];
  state.dragon.killerHeroUid = null;
  state.dragon.championHeroUid = prevChampionUid;
  state.allTime.records.maxDragonLevel = Math.max(state.allTime.records.maxDragonLevel || 1, state.dragon.level);
  commitAllTimeChange();
  status(`Дракон переродился и стал сильнее: lvl ${state.dragon.level}. Победитель вернулся в бой с x2 аурой, остальные исчезли вспышкой.`);
}

function updateDragon(dt){
  const now = performance.now();
  const dragonMeta = dragonSpriteMeta(state.dragon.level, state.dragon.animKey);
  state.dragon.frameAcc += dt;
  const frameDuration = 1 / dragonMeta.fps;
  while (state.dragon.frameAcc >= frameDuration){
    state.dragon.frameAcc -= frameDuration;
    if (state.dragon.animKey === "death"){
      state.dragon.frame = Math.min(state.dragon.frame + 1, dragonMeta.frames - 1);
    } else if (state.dragon.animKey === "attack"){
      state.dragon.frame += 1;
      if (state.dragon.frame >= dragonMeta.frames){
        state.dragon.animLocked = false;
        setDragonAnim("idle", { restart:true });
        break;
      }
    } else if (state.dragon.animKey === "evo"){
      state.dragon.frame += 1;
      if (state.dragon.frame >= dragonMeta.frames){
        respawnDragonStronger();
        break;
      }
    } else {
      state.dragon.frame = (state.dragon.frame + 1) % dragonMeta.frames;
    }
  }
  state.dragon.hitFx = Math.max(0, state.dragon.hitFx - dt);
  state.dragon.flashFx = Math.max(0, state.dragon.flashFx - dt);

  if (!state.dragon.alive){
    if (state.dragon.animKey === "death" && state.dragon.nextPhaseAt && now >= state.dragon.nextPhaseAt){
      setDragonAnim('evo', { restart:true, lock:true });
      playFromPool(SFX.dragonEvolve);
      playFromPool(SFX.dragonFly, 0.9, 1);
      triggerBgmDuck(0.06, 260);
      spawnBattleNotice(`DRAGON LVL ${state.dragon.level + 1}`, 'EVOLVING', 'system');
      state.dragon.nextPhaseAt = 0;
    }
  }

  if (state.dragon.alive){
    state.dragon.attackTimer -= dt;
    if (state.dragon.attackTimer <= 0){
      const livingHeroes = [...state.activeHeroes.values()].filter((hero) => hero.alive && !["winner","winnerTravel","championWinner","championWinnerTravel"].includes(hero.aiState));
      const combatCenter = dragonCombatCenter();
      const target = livingHeroes.sort((a, b) => Math.hypot(a.x - combatCenter.x, a.y - combatCenter.y) - Math.hypot(b.x - combatCenter.x, b.y - combatCenter.y))[0];
      if (target && Math.hypot(target.x - combatCenter.x, target.y - combatCenter.y) < combatRange(118)){
        if (!state.dragon.animLocked) setDragonAnim("attack", { restart:true, lock:true });
        const damage = state.dragon.damage;
        const blockedDamage = damage / Math.max(1, target.defenseMul || 1);
        target.hp = Math.max(0, target.hp - blockedDamage);
        playFromPool(SFX.dragonAttack, 1, 0.98 + Math.random() * 0.05);
        playFromPool(SFX.dragonRoar, 1, 1);
        triggerBgmDuck(0.03, 150);
        spawnDamageFx(target.x, target.y - 70, blockedDamage, false, 'DRAGON HIT');
        spawnCombatNotice(target.x, target.y - 116, target.displayName, `took Dragon hit\n-${Math.round(blockedDamage)}HP`, 'danger');
        spawnImpactFx(target.x, target.y - 36, "hero");
        if (target.hp <= 0) killHero(target);
      }
      state.dragon.attackTimer = Math.max(0.72, 1.18 - (state.dragon.level - 1) * 0.025);
    }
  }

  state.dragon._minScale = state.dev.tuning.dragonDrawScale * 0.60;
  state.dragon._maxScale = state.dev.tuning.dragonDrawScale * 1.00;
  const rawDragonScale = dragonDepthScale(state.dragon.y) * state.dev.tuning.dragonDrawScale * 1.04;
  const scale = snapStableScale(state.dragon, rawDragonScale);
  const dragonPerspectiveShift = diabloPerspectiveShift(state.dragon.y) * 0.65;
  dragonEl.style.left = `${state.dragon.x + dragonPerspectiveShift}px`;
  dragonEl.style.top = `${Math.round(state.dragon.y)}px`;
  dragonEl.style.zIndex = String(Math.round(state.dragon.y) + 2);
  dragonLabel.textContent = `Dragon (${state.dragon.level}lvl) ${Math.max(0, Math.ceil(state.dragon.hp))}/${state.dragon.maxHp}`;
  dragonHPFill.style.width = `${(state.dragon.hp / state.dragon.maxHp) * 100}%`;
  const dragonSpriteHeight = dragonMeta.frameH * scale * (dragonMeta.renderScale || 1);
  const dragonHpBar = dragonEl.querySelector('.hpbar');
  dragonHpBar.style.top = `${-dragonSpriteHeight - 8}px`;
  dragonLabel.style.top = `${-dragonSpriteHeight - 24}px`;
  const dragonDepthT = depthNorm(state.dragon.y);
  const dragonDepthFilter = `brightness(${lerp(0.9, 1.02, dragonDepthT).toFixed(3)}) saturate(${lerp(0.84, 1.0, dragonDepthT).toFixed(3)}) drop-shadow(0 12px 18px rgba(0,0,0,.22))`;
  const extraFx = [];
  if (state.dragon.hitFx > 0) extraFx.push('brightness(1.4)', 'saturate(1.08)', 'drop-shadow(0 0 18px rgba(255,90,70,.6))');
  if (state.dragon.flashFx > 0) extraFx.push(`drop-shadow(0 0 ${Math.round(58 * state.dragon.flashFx + 8)}px rgba(255,255,255,.92))`, 'brightness(1.8)', 'saturate(1.25)');
  dragonSpriteEl.style.filter = `${extraFx.join(' ')} ${dragonDepthFilter}`.trim();
  applySpriteToEl(dragonSpriteEl, dragonMeta, scale, state.dragon.frame, false);
}

function spawnBattleNotice(title, subtitle = '', tone = 'hit'){
  if (!noticeLayer) return;
  const notices = [...noticeLayer.querySelectorAll('.battle-notice:not(.floating)')];
  if (notices.length >= MAX_NOTICES){
    notices[0].remove();
  }
  const el = document.createElement('div');
  el.className = `battle-notice ${tone}`;
  el.style.position = 'relative';
  const strong = document.createElement('strong');
  strong.textContent = title || 'SYSTEM';
  const span = document.createElement('span');
  span.textContent = subtitle || '';
  el.append(strong, span);
  noticeLayer.appendChild(el);
  window.setTimeout(() => {
    if (el.isConnected) el.remove();
  }, NOTICE_LIFETIME_MS);
}

function spawnCombatNotice(x, y, title, subtitle = '', tone = 'hit'){
  const layer = combatNoticeLayer || fxLayer;
  if (!layer) return;
  const el = document.createElement('div');
  el.className = `battle-notice floating ${tone}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  const strong = document.createElement('strong');
  strong.textContent = title || 'SYSTEM';
  const span = document.createElement('span');
  span.textContent = subtitle || '';
  el.append(strong, span);
  layer.appendChild(el);
  window.setTimeout(() => {
    if (el.isConnected) el.remove();
  }, 1700);
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
  const sparks = kind === "death" ? 7 : 4;
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
  pulse.className = `teleport-pulse lvl${Math.min(level, 5)}`;
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
  applyDevConfigToScene();
  makeRingAnchors();
  const dragonPos = worldToStage(state.dev.dragon.x, state.dev.dragon.y);
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
    if (['winner','winnerTravel','championWinner','championWinnerTravel'].includes(hero.aiState)) {
      const winnerPoint = makeWinnerPoint(hero.level);
      hero.winnerTargetX = winnerPoint.x;
      hero.winnerTargetY = winnerPoint.y;
      hero.targetX = winnerPoint.x;
      hero.targetY = winnerPoint.y;
    }
  }
  renderEditorHandles();
}
function validateSpriteManifest(){
  const groups = [SPRITES.lvl1, SPRITES.lvl2, SPRITES.lvl3, SPRITES.lvl4, SPRITES.lvl5, SPRITES.dragon.lvl1, SPRITES.dragon.lvl2];
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

function enqueueHero(level, entry = {}, reason = "queue"){
  const queue = state.queueEntries.get(level) || [];
  queue.push({ displayName: String(entry.displayName || `LVL ${level} HERO`), source: String(entry.source || 'ui'), avatar: String(entry.avatar || levelBadgeDataUri(level)), playerId: String(entry.playerId || `lvl-${level}-${entry.displayName || `LVL ${level} HERO`}`) });
  state.queueEntries.set(level, queue);
  state.queueCounts.set(level, queue.length);
  syncQueueBadge(level);
  spawnRingGlow(level);
  const queuedNow = queue.length;
  if (reason === "dragon"){
    status(`${entry.displayName || `LVL ${level} HERO`} поставлен в очередь до респавна дракона. В очереди: x${queuedNow}.`);
  } else {
    status(`${entry.displayName || `LVL ${level} HERO`} добавлен в очередь. Ожидают: x${queuedNow}.`);
  }
}
function onSpawnButton(level, entry = null){
  if (!HERO_CONFIG[level]){ status(`Кнопка ${level} пока заглушка.`); return; }
  selectLevel(level);
  const payload = entry || { displayName:`LVL ${level} HERO`, source:'ui', avatar: levelBadgeDataUri(level), playerId:`lvl-${level}-hero` };

  if (dragonInTransition()){
    enqueueHero(level, payload, "dragon");
    return;
  }

  const current = state.activeHeroes.get(level);
  if (!current){
    spawnHeroFromQueue(level, payload);
    updateMoveMarker(...Object.values(makeDragonApproachPoint(level)));
    return;
  }
  enqueueHero(level, payload, "busy");
}
function bindUi(){
  spawnButtons.forEach((btn) => btn.addEventListener("click", () => onSpawnButton(Number(btn.dataset.level))));
  stage.addEventListener("pointerdown", () => {
    unlockAudio();
    status("Герои теперь идут к дракону автоматически. Тап по экрану больше не управляет движением.");
  });
  devWidgetToggle?.addEventListener("click", () => {
    state.dev.panelOpen = !state.dev.panelOpen;
    devWidget.classList.toggle("hidden", !state.dev.panelOpen);
  });
  devWidgetClose?.addEventListener("click", () => {
    state.dev.panelOpen = false;
    devWidget.classList.add("hidden");
  });
  devHandlesToggle?.addEventListener("click", () => {
    state.dev.showHandles = !state.dev.showHandles;
    saveDevConfig();
    updateDevButtons();
    renderEditorHandles();
  });
  devCompactToggle?.addEventListener("click", () => {
    state.dev.compactSections = !state.dev.compactSections;
    saveDevConfig();
    buildDevWidget();
  });
  devResetView?.addEventListener("click", () => resetDevView());
  devExportBox?.addEventListener("focus", () => devExportBox.select());
  window.addEventListener("resize", resize, { passive:true });
  window.visualViewport?.addEventListener("resize", resize, { passive:true });
}
function tick(now){
  const dt = clamp((now - state.now) / 1000, 0, 0.033);
  state.now = now;
  updateDragon(dt);
  for (const hero of [...state.heroes.values()]) updateHero(hero, dt);
  for (const level of Object.keys(HERO_CONFIG).map(Number)) trySpawnNextFromQueue(level);
  updateMusicState();
  refreshBgmMix();
  requestAnimationFrame(tick);
}

bindUi();
buildDevWidget();
devWidget.classList.toggle("hidden", !state.dev.panelOpen);
resize();
syncAllQueueBadges();
commitAllTimeChange();
status(`LVL 1–5 подключены. После спавна герой 1.28 сек стоит на месте, боевые надписи теперь летят над драконом и героями, all-time панели готовы под сервер.`);
validateSpriteManifest();
requestAnimationFrame((t) => { state.now = t; requestAnimationFrame(tick); });
