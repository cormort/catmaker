// pet.js — 貓咪小屋（首頁）：養成資料、客廳、圖鑑、稱號、紀念日、節日活動，以及各分頁的切換與點擊委派
import { audio } from "../audio.js";
import { academyPageHtml, clearMistakeBook, handleDailyCare, handleQuizAnswer, openMistakeExport, openMistakeImport, setQuizPublisher, setQuizTerm, startExamSession, startMistakeSession, startQuizSession, statsPageHtml } from "./academy.js";
import { DIRT_LABEL, STORY, STUDY_BUFF_MINUTES, STUDY_BUFF_RATE, TALK_CHOICES, applyEvent, currentChapter, dirtLevel, newStoryState, normalizeStory, reminderLine, storyFinished, talkLines, taskProgress, timeGreeting } from "./story.js";
import { AVATAR_PARTS, avatarLabel, defaultAvatar, gradeOfTerm, normalizeAvatar, randomAvatar, renderAvatar, stageLabel } from "./avatar.js";
import { bindRoomStageInteractions, captureRoomPhoto, getRoomCatSprite, renderRoomLitter, roomCatPose, roomLitterClumps, roomToolMode, scoopLitterClump, setRoomCatPose, setRoomToolMode, spawnRoomHeart, triggerWandPlay } from "./room.js";
import { buyShopItem, gachaPageHtml, pullGacha, setShopTab, shopPageHtml } from "./shop.js";
import { handleLifeEvent, sickInfo } from "./life.js";
import { handleTripClick, tripPageHtml } from "./trip.js";
import { $, LS, escapeHtml, hideSheet, localDay, playSkinArrivalSound, showSheet } from "./ui.js";
const FOODS = {
  fish: { icon: "🐟", name: "小魚乾", affection: 4, mood: 4 },
  chicken: { icon: "🍗", name: "雞肉條", affection: 7, mood: 6 },
  tuna: { icon: "🥫", name: "鮪魚罐罐", affection: 11, mood: 9 },
  premium: { icon: "🍰", name: "豪華貓點心", affection: 18, mood: 14 },
};
const PET_LEVELS = [0, 20, 55, 105, 170, 250, 350, 470, 610, 770];
// 可互動的貓：小屋只有這 4 隻（白貓 / 橘貓 / 黑貓 / 三花），每個品種都有 14 種全身姿勢立繪。
// 臉圖示刻意挑與品種相符的（icons/cats.webp 第 0 / 2 / 1 / 4 張），
export const INTERACTIVE_CATS = ["0", "2", "1", "4"];
const CAT_LABELS = { "0": "白貓", "2": "橘貓", "1": "黑貓", "4": "三花" };
// 舊存檔的 key 可能不在名單內：先用舊對應表換算品種，再取同名單品種的 key
const LEGACY_BREED_BY_KEY = {
  0: "white",
  1: "black",
  2: "orange",
  3: "orange",
  4: "calico",
  5: "white",
  6: "white",
  7: "calico",
  8: "orange",
  9: "white",
  10: "white",
  11: "orange",
  12: "black",
};
const ROSTER_BY_BREED = { white: "0", orange: "2", black: "1", calico: "4" };
function normalizeCatKey(key) {
  const k = String(key ?? "");
  if (INTERACTIVE_CATS.includes(k)) return k;
  const breed =
    LEGACY_BREED_BY_KEY[k] || ["white", "orange", "calico", "black"][(Number(k) || 0) % 4];
  return ROSTER_BY_BREED[breed] || INTERACTIVE_CATS[0];
}
// 貓臉 sprite（icons/cats.webp，9×9 格）的座標
function facePos(k) {
  return `${(k % 9) * 12.5}% ${Math.floor(k / 9) * 12.5}%`;
}
const STARTER_CATS = INTERACTIVE_CATS;
// 其餘 3 隻隨完成測驗次數解鎖
const UNLOCK_WINS = {
  2: 3,
  1: 8,
  4: 15,
};
const GROWTH_STAGES = [
  { name: "幼貓", icon: "🐾", min: 0 },
  { name: "探索期", icon: "🌱", min: 35 },
  { name: "成長期", icon: "🌿", min: 105 },
  { name: "成熟期", icon: "🌟", min: 250 },
  { name: "傳奇夥伴", icon: "👑", min: 470 },
];
let collectionFilter = "all",
  collectionSort = "index";
export function growthStage(value = petAffection()) {
  let stage = GROWTH_STAGES[0],
    index = 0;
  GROWTH_STAGES.forEach((x, i) => {
    if (value >= x.min) {
      stage = x;
      index = i;
    }
  });
  return { ...stage, index };
}
const TITLE_RULES = [
  {
    name: "初次搭檔",
    label: "和貓咪完成 1 次測驗",
    value: (k) => petRecord(k).total,
    target: 1,
  },
  {
    name: "解謎新星",
    label: "完成 10 關簡單難度",
    value: (k) => petRecord(k).easy,
    target: 10,
  },
  {
    name: "邏輯高手",
    label: "完成 10 關普通難度",
    value: (k) => petRecord(k).normal,
    target: 10,
  },
  {
    name: "困難征服者",
    label: "完成 5 關困難難度",
    value: (k) => petRecord(k).hard,
    target: 5,
  },
  {
    name: "謎題大師",
    label: "完成 20 關困難難度",
    value: (k) => petRecord(k).hard,
    target: 20,
  },
  {
    name: "每日守護者",
    label: "完成 7 次每日挑戰",
    value: (k) => petRecord(k).daily,
    target: 7,
  },
  {
    name: "晨星旅伴",
    label: "完成 30 次每日挑戰",
    value: (k) => petRecord(k).daily,
    target: 30,
  },
  {
    name: "百戰夥伴",
    label: "累積完成 50 次測驗",
    value: (k) => petRecord(k).total,
    target: 50,
  },
  {
    name: "傳奇拍檔",
    label: "累積完成 100 次測驗",
    value: (k) => petRecord(k).total,
    target: 100,
  },
  { name: "心靈相通", label: "好感度達到 250", value: (k) => petAffection(k), target: 250 },
  { name: "永恆羈絆", label: "好感度達到 470", value: (k) => petAffection(k), target: 470 },
  { name: "幸福滿滿", label: "心情達到 90", value: (k) => petMoodValue(k), target: 90 },
];
function titleConditionsHtml(key) {
  return `<details class="title-panel"><summary>查看稱號解鎖條件</summary><div class="title-condition-list">${TITLE_RULES.map(
    (rule) => {
      const value = Math.min(rule.value(key), rule.target),
        done = value >= rule.target,
        percent = Math.min(100, (value / rule.target) * 100);
      return `<div class="title-condition ${done ? "unlocked" : "locked"}"><span><b>${done ? "✓" : "🔒"} ${rule.name}</b><small>${rule.label}</small></span><span class="title-state">${value}/${rule.target}</span><span class="title-progress"><i style="--title-progress:${percent}%"></i></span></div>`;
    },
  ).join("")}</div></details>`;
}
function knownGrowthStage(key) {
  return Number(petData.growthStages?.[key] ?? growthStage(petAffection(key)).index);
}
export function syncGrowthStages() {
  petData.growthStages = petData.growthStages || {};
  for (const key of petData.unlocked) {
    if (petData.growthStages[key] === undefined)
      petData.growthStages[key] = growthStage(petAffection(key)).index;
  }
  savePetData();
}
export function checkGrowthUpgrade(key, beforeIndex) {
  const after = growthStage(petAffection(key));
  petData.growthStages = petData.growthStages || {};
  petData.growthStages[key] = after.index;
  savePetData();
  if (after.index > beforeIndex) setTimeout(() => showGrowthUpgrade(key, after), 120);
}
function showGrowthUpgrade(key, stage) {
  const layer = document.createElement("div");
  layer.className = "growth-up-overlay";
  layer.innerHTML = `<button class="growth-skip" type="button">跳過</button><div class="growth-up-card">${petFaceHtml(key, "growth-up-cat face")}<div class="growth-up-stage">${stage.icon} 成長為「${stage.name}」</div><div class="growth-up-title">${escapeHtml(petName(key))} 的羈絆更深了！</div></div>${[...Array(12)].map((_, i) => `<span class="growth-spark" style="--a:${i * 30}deg">${i % 2 ? "✨" : "⭐"}</span>`).join("")}`;
  document.body.append(layer);
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    layer.classList.add("skipping");
    setTimeout(() => layer.remove(), 170);
  };
  layer.querySelector(".growth-skip").addEventListener("click", remove, { once: true });
  playSkinArrivalSound();
  navigator.vibrate?.([25, 30, 35]);
  setTimeout(remove, 2050);
}
export function earnedTitles(key = activePetKey()) {
  const rec = petRecord(key),
    aff = petAffection(key),
    mood = petMoodValue(key),
    titles = [];
  if (rec.total >= 1) titles.push("初次搭檔");
  if (rec.easy >= 10) titles.push("解謎新星");
  if (rec.normal >= 10) titles.push("邏輯高手");
  if (rec.hard >= 5) titles.push("困難征服者");
  if (rec.hard >= 20) titles.push("謎題大師");
  if (rec.daily >= 7) titles.push("每日守護者");
  if (rec.daily >= 30) titles.push("晨星旅伴");
  if (rec.total >= 50) titles.push("百戰夥伴");
  if (rec.total >= 100) titles.push("傳奇拍檔");
  if (aff >= 250) titles.push("心靈相通");
  if (aff >= 470) titles.push("永恆羈絆");
  if (mood >= 90) titles.push("幸福滿滿");
  return titles.length ? titles : ["初來乍到"];
}
export function primaryTitle(key = activePetKey()) {
  const list = earnedTitles(key),
    equipped = petData.equippedTitles?.[key];
  return equipped && list.includes(equipped) ? equipped : list[list.length - 1];
}
function growthTrackHtml(key) {
  const current = growthStage(petAffection(key)).index;
  return `<div class="growth-track">${GROWTH_STAGES.map((g, i) => `<div class="growth-step${i <= current ? " done" : ""}${i === current ? " current" : ""}"><span class="growth-icon">${g.icon}</span>${g.name}</div>`).join("")}</div>`;
}

export let petData = loadPetData();
window.petData = petData;
collectionFilter = petData.collectionFilter || "all";
collectionSort = petData.collectionSort || "index";
function defaultPetData() {
  return {
    initialized: false,
    coins: 500,
    food: { fish: 0, chicken: 0, tuna: 0, premium: 0 },
    affection: {},
    mood: {},
    names: {},
    selected: null,
    unlocked: [],
    wins: 0,
    records: {},
    dailyFeedDate: null,
    interactDate: null,
    interactions: 0,
    collectionFilter: "all",
    collectionSort: "index",
    growthStages: {},
    birthdays: {},
    anniversaries: {},
    petView: "home",
    equippedTitles: {},
    reminderSeen: {},
    unlockedCostumes: ["default"],
    equippedCostumes: {},
    eventProgress: {},
    eventClaims: {},
    stats: {},
    status: {},
    inventory: {},
    avatar: null, // 主角造型（見 js/avatar.js）
    story: null, // 主線劇情進度（見 js/story.js）
    studyBuff: null, // 陪讀加成：{ until }
    lastGreetDate: null, // 每天第一次開遊戲時打招呼
    lastPlayDate: null, // 用來計算連續上線天數
    loginStreak: 0,
    trips: {},
    album: [],
  };
}
function loadPetData() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS.pet) || "null"),
      d = defaultPetData();
    if (raw) {
      Object.assign(d, raw);
      d.coins = Number(raw.coins ?? 500);
      d.food = { ...defaultPetData().food, ...raw.food };
      d.affection = { ...raw.affection };
      d.mood = { ...raw.mood };
      d.names = { ...raw.names };
      d.records = { ...raw.records };
      d.unlocked = [...new Set((raw.unlocked || []).map(normalizeCatKey))];
      if (raw.selected != null) d.selected = normalizeCatKey(raw.selected);
      d.growthStages = { ...(raw.growthStages || {}) };
      d.collectionFilter = raw.collectionFilter || "all";
      d.collectionSort = raw.collectionSort || "index";
      d.birthdays = { ...(raw.birthdays || {}) };
      d.anniversaries = { ...(raw.anniversaries || {}) };
      d.petView = raw.petView || "home";
      d.equippedTitles = { ...(raw.equippedTitles || {}) };
      d.reminderSeen = { ...(raw.reminderSeen || {}) };
      d.unlockedCostumes = [...(raw.unlockedCostumes || ["default"])];
      if (!d.unlockedCostumes.includes("default")) d.unlockedCostumes.unshift("default");
      d.equippedCostumes = { ...(raw.equippedCostumes || {}) };
      d.eventProgress = { ...(raw.eventProgress || {}) };
      d.eventClaims = { ...(raw.eventClaims || {}) };
      d.stats = { ...(raw.stats || {}) };
      d.status = { ...(raw.status || {}) };
      d.inventory = { ...(raw.inventory || {}) };
      d.trips = { ...(raw.trips || {}) };
      d.album = [...(raw.album || [])];
    }
    return d;
  } catch {
    return defaultPetData();
  }
}
export function savePetData() {
  try {
    localStorage.setItem(LS.pet, JSON.stringify(petData));
  } catch {}
}
export function petCoins() {
  return Number(petData.coins ?? 500);
}
export function addCoins(n) {
  petData.coins = Math.max(0, petCoins() + n);
  savePetData();
  if (n > 0 && typeof audio !== "undefined") audio.playCoin?.();
}
// 學院五科能力初始值（key＝題庫 id，見 quizzes/README.md）
const STAT_SEED = { chinese: 12, math: 15, science: 10, social: 10, english: 10 };
// 舊版學院科目 → 新學科：換題庫時把玩家已累積的能力值帶過去，不要讓既有進度歸零
const STAT_LEGACY = { chinese: "literacy", english: "language", social: "art" };
export function petStats(key = activePetKey()) {
  petData.stats = petData.stats || {};
  const s = petData.stats[key];
  if (!s) {
    petData.stats[key] = { ...STAT_SEED };
  } else {
    let changed = false;
    for (const [now, old] of Object.entries(STAT_LEGACY))
      if (s[now] === undefined && typeof s[old] === "number") {
        s[now] = s[old];
        changed = true;
      }
    for (const k of Object.keys(STAT_SEED))
      if (typeof s[k] !== "number") {
        s[k] = STAT_SEED[k];
        changed = true;
      }
    if (changed) savePetData();
  }
  return petData.stats[key];
}
export function addPetStat(key, statKey, amount = 1) {
  const stats = petStats(key);
  stats[statKey] = (stats[statKey] || 0) + amount;
  savePetData();
}
export function petStatus(key = activePetKey()) {
  petData.status = petData.status || {};
  if (!petData.status[key]) {
    petData.status[key] = {
      hunger: 80,
      energy: 100,
      fatigue: 10,
      cleanliness: 90,
    };
  }
  return petData.status[key];
}
export function updatePetStatus(key, delta = {}) {
  const s = petStatus(key);
  if (delta.hunger !== undefined) s.hunger = Math.max(0, Math.min(100, s.hunger + delta.hunger));
  if (delta.energy !== undefined) s.energy = Math.max(0, Math.min(100, s.energy + delta.energy));
  if (delta.fatigue !== undefined) s.fatigue = Math.max(0, Math.min(100, s.fatigue + delta.fatigue));
  if (delta.cleanliness !== undefined) s.cleanliness = Math.max(0, Math.min(100, s.cleanliness + delta.cleanliness));
  savePetData();
}
export function petQuickStatusBarHtml(key = activePetKey()) {
  const st = petStatus(key);
  return `
    <div class="pet-quick-status-bar">
      <span class="coin-badge" title="金幣：可用於上課、商店、家具與高階扭蛋">🪙 ${petCoins()}</span>
      <span class="pet-quick-pill" title="飽食度">🍖 ${st.hunger}%</span>
      <span class="pet-quick-pill" title="體力值">⚡ ${st.energy}%</span>
      <span class="pet-quick-pill" title="疲勞度">💤 ${st.fatigue}%</span>
      <span class="pet-quick-pill" title="清潔度">🧼 ${st.cleanliness}%</span>
      ${sickInfo(key) ? `<button class="pet-quick-pill sick" data-life-event="clinic" title="點我看醫生">${sickInfo(key).icon} ${sickInfo(key).name}</button>` : ""}
    </div>
  `;
}
export function activePetKey() {
  return String(petData.selected ?? "0");
}
export function petName(key = activePetKey()) {
  return petData.names[key] || CAT_LABELS[String(key)] || `貓咪 ${Number(key) + 1}`;
}
export function petAffection(key = activePetKey()) {
  return Number(petData.affection[key] || 0);
}
export function petMoodValue(key = activePetKey()) {
  return Math.max(0, Math.min(100, Number(petData.mood[key] ?? 65)));
}
function moodInfo(value = petMoodValue()) {
  if (value >= 85) return { icon: "😻", label: "超開心" };
  if (value >= 65) return { icon: "😺", label: "心情很好" };
  if (value >= 40) return { icon: "😸", label: "還不錯" };
  if (value >= 20) return { icon: "😿", label: "有點寂寞" };
  return { icon: "🙀", label: "需要陪伴" };
}
export function petLevel(value = petAffection()) {
  let level = 1;
  for (let i = 1; i < PET_LEVELS.length; i++) if (value >= PET_LEVELS[i]) level = i + 1;
  return level;
}
function affectionProgress(value = petAffection()) {
  const level = petLevel(value),
    start = PET_LEVELS[level - 1] || 0,
    end = PET_LEVELS[level] ?? start + 200;
  return Math.max(0, Math.min(100, ((value - start) / (end - start)) * 100));
}
function petFaceHtml(key, cls = "pet-avatar") {
  const k = Math.max(0, Math.min(80, Number(key) || 0));
  return `<i class="${cls} face" style="background-position:${facePos(k)}"></i>`;
}
export function updatePetHeroStats(key = activePetKey()) {
  const aff = petAffection(key),
    level = petLevel(aff),
    progress = affectionProgress(aff),
    mood = moodInfo();
  const fill = document.querySelector(".affection-fill");
  if (fill) fill.style.setProperty("--affection", `${progress}%`);
  const affText = document.querySelector(".pet-affection");
  if (affText)
    affText.textContent = `💕 好感度 ${aff}${level < PET_LEVELS.length ? `／${PET_LEVELS[level]}` : "（最高等級）"}`;
  const moodPill = document.querySelector(".mood-pill");
  if (moodPill) moodPill.innerHTML = `${mood.icon} ${mood.label}`;
  const moodVal = document.querySelector(".mood-val");
  if (moodVal) moodVal.textContent = `心情 ${petMoodValue(key)}/100`;
  const nameLvl = document.querySelector(".pet-name-title");
  if (nameLvl) nameLvl.textContent = `${escapeHtml(petName(key))}　Lv.${level}`;
}
function isUnlocked(key) {
  return petData.unlocked.includes(String(key));
}
function refreshUnlocks() {
  for (const [k, wins] of Object.entries(UNLOCK_WINS))
    if (petData.wins >= wins && !isUnlocked(k)) petData.unlocked.push(String(k));
}
export function showStarterSetup() {
  let selected = STARTER_CATS[0];
  $("overlayTitle").textContent = "🐾 領養第一隻貓";
  $("overlayBody").innerHTML =
    `<p class="starter-intro">小屋一共有 4 隻可以互動的貓咪，每一隻都有自己的全身動作立繪。先選一隻當夥伴，其他 3 隻會在完成學院測驗後陸續認識。</p><div class="starter-preview-stage"><img id="starterPreviewImg" class="room-cat-img" src="${getRoomCatSprite(selected, "idle")}" alt="候選貓咪" onerror="this.onerror=null; this.src=this.src.replace('.webp', '.png');"></div><div class="starter-cats">${STARTER_CATS.map((k) => `<button class="starter-cat${k === selected ? " selected" : ""}" data-starter="${k}">${petFaceHtml(k, "face")}<span class="starter-name">${CAT_LABELS[k] || `貓咪 ${Number(k) + 1}`}</span></button>`).join("")}</div><label class="name-field"><span>替貓咪取名字</span><input id="starterName" maxlength="12" placeholder="輸入 1～12 個字" autocomplete="off"></label>`;
  const primary = $("overlayPrimary");
  primary.textContent = "開始一起冒險";
  primary.onclick = () => {
    const input = $("starterName"),
      name = input.value.trim();
    if (!name) {
      input.focus();
      input.style.borderColor = "var(--warn)";
      return;
    }
    petData.initialized = true;
    petData.selected = selected;
    petData.unlocked = [selected];
    petData.names[selected] = name;
    petData.affection[selected] = 0;
    petData.mood[selected] = 72;
    petData.anniversaries[selected] = localDay();
    petData.petView = "home";
    savePetData();
    hideSheet();
    showPetHome();
  };
  $("overlaySecondary").style.display = "none";
  $("overlay").classList.remove("hidden");
  $("overlayBody").onclick = (e) => {
    const b = e.target.closest("[data-starter]");
    if (!b) return;
    selected = b.dataset.starter;
    const previewImg = $("starterPreviewImg");
    if (previewImg) previewImg.src = getRoomCatSprite(selected, "idle");
    $("overlayBody")
      .querySelectorAll(".starter-cat")
      .forEach((x) => x.classList.toggle("selected", x === b));
  };
}
function petRecord(key = activePetKey()) {
  return { total: 0, easy: 0, normal: 0, hard: 0, daily: 0, ...petData.records[key] };
}
export function awardFood({ n, daily }) {
  const rolls = n === 5 ? 1 : n === 7 ? 2 : 3,
    bonus = daily ? 1 : 0;
  const pool =
    n === 5
      ? ["fish", "fish", "chicken"]
      : n === 7
        ? ["fish", "chicken", "chicken", "tuna"]
        : ["chicken", "tuna", "tuna", "premium"];
  const gained = {};
  for (let i = 0; i < rolls + bonus; i++) {
    const type = pool[Math.floor(Math.random() * pool.length)];
    petData.food[type] = (petData.food[type] || 0) + 1;
    gained[type] = (gained[type] || 0) + 1;
  }
  const key = activePetKey(),
    beforeStage = growthStage(petAffection(key)).index,
    gain = 2 + Math.floor(n / 2);
  petData.affection[key] = (petData.affection[key] || 0) + gain;
  petData.mood[key] = Math.min(100, petMoodValue(key) + 5);
  petData.wins++;
  const rec = petRecord(key);
  rec.total++;
  if (daily) rec.daily++;
  else if (n === 5) rec.easy++;
  else if (n === 7) rec.normal++;
  else rec.hard++;
  petData.records[key] = rec;
  const before = new Set(petData.unlocked);
  refreshUnlocks();
  const unlocked = petData.unlocked.filter((k) => !before.has(k));
  savePetData();
  checkGrowthUpgrade(key, beforeStage);
  return { gained, key, affection: gain, unlocked };
}
export function rewardHtml(r) {
  return `<div class="reward-box"><b>🎁 額外獎勵</b><div class="reward-foods">${Object.entries(
    r.gained,
  )
    .map(
      ([k, v]) => `<span class="reward-food">${FOODS[k].icon} ${FOODS[k].name} ×${v}</span>`,
    )
    .join(
      "",
    )}</div><div style="margin-top:7px">💕 ${escapeHtml(petName(r.key))} 好感度 +${r.affection}</div>${r.unlocked.length ? `<div style="margin-top:7px">✨ 新認識 ${r.unlocked.length} 隻貓咪！</div>` : ""}</div>`;
}
function dailyFeedAvailable() {
  return petData.dailyFeedDate !== localDay();
}
function claimDailyFeed() {
  if (!dailyFeedAvailable()) return;
  const key = activePetKey(),
    beforeStage = growthStage(petAffection(key)).index;
  petData.dailyFeedDate = localDay();
  petData.food.fish = (petData.food.fish || 0) + 1;
  petData.affection[key] = (petData.affection[key] || 0) + 5;
  petData.mood[key] = Math.min(100, petMoodValue(key) + 10);
  savePetData();
  checkGrowthUpgrade(key, beforeStage);
  playSkinArrivalSound();
  navigator.vibrate?.([15, 20, 20]);
  showPetHome();
  requestAnimationFrame(() => animatePet("pet-bounce", "今天也要一起加油！"));
}
function dateParts(dateText) {
  if (!dateText) return null;
  const parts = dateText.split("-").map(Number);
  return parts.length === 3 ? { year: parts[0], month: parts[1], day: parts[2] } : null;
}
function isSameMonthDay(dateText, date = new Date()) {
  const p = dateParts(dateText);
  return !!p && p.month === date.getMonth() + 1 && p.day === date.getDate();
}
function daysSince(dateText) {
  if (!dateText) return 0;
  const start = new Date(`${dateText}T00:00:00`),
    now = new Date();
  return Math.max(
    0,
    Math.floor(
      (new Date(now.getFullYear(), now.getMonth(), now.getDate()) - start) / 86400000,
    ),
  );
}
function nextSpecialDay(dateText) {
  const p = dateParts(dateText);
  if (!p) return null;
  const now = new Date(),
    today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), p.month - 1, p.day);
  if (target < today) target = new Date(now.getFullYear() + 1, p.month - 1, p.day);
  return Math.ceil((target - today) / 86400000);
}
const FESTIVAL_COSTUMES = [
  {
    id: "default",
    name: "經典造型",
    icon: "🐱",
    desc: "貓咪原本的可愛模樣",
    permanent: true,
  },
  {
    id: "newyear",
    name: "新年限定",
    icon: "🧨",
    start: [1, 1],
    end: [1, 7],
    hat: "🧨",
    left: "🧧",
    right: "✨",
    desc: "完成新年活動任務解鎖",
  },
  {
    id: "lantern",
    name: "元宵限定",
    icon: "🏮",
    start: [2, 10],
    end: [2, 18],
    hat: "🏮",
    left: "✨",
    right: "🏮",
    desc: "完成元宵活動任務解鎖",
  },
  {
    id: "catday",
    name: "貓咪日限定",
    icon: "👑",
    start: [8, 1],
    end: [8, 10],
    hat: "👑",
    left: "🐾",
    right: "🐾",
    desc: "完成貓咪日活動任務解鎖",
  },
  {
    id: "halloween",
    name: "萬聖節限定",
    icon: "🎃",
    start: [10, 20],
    end: [10, 31],
    hat: "🎃",
    left: "🦇",
    right: "🍬",
    desc: "完成萬聖節活動任務解鎖",
  },
  {
    id: "christmas",
    name: "聖誕限定",
    icon: "🎅",
    start: [12, 15],
    end: [12, 31],
    hat: "🎅",
    left: "🎄",
    right: "🎁",
    desc: "完成聖誕活動任務解鎖",
  },
  {
    id: "costume_wizard",
    name: "大魔法師套裝",
    icon: "🧙‍♂️",
    image: "./icons/room/costume_wizard.webp",
    desc: "🌟 SSR 扭蛋傳奇！奧術星輝法袍與星月尖帽",
    permanent: true,
  },
  {
    id: "costume_royal",
    name: "皇家至尊套裝",
    icon: "👑",
    image: "./icons/room/costume_royal.webp",
    desc: "🌟 SSR 扭蛋傳奇！純金鑲鑽王冠與雍容披風",
    permanent: true,
  },
  {
    id: "costume_detective",
    name: "名偵探套裝",
    icon: "🕵️",
    image: "./icons/room/costume_detective.webp",
    desc: "✨ SR 扭蛋限定！英倫格紋獵鹿帽與放大鏡",
    permanent: true,
  },
  {
    id: "costume_sailor",
    name: "青春水手服",
    icon: "⚓",
    image: "./icons/room/costume_sailor.webp",
    desc: "✨ SR 扭蛋限定！蔚藍水手領巾與海軍帽",
    permanent: true,
  },
];
const EVENT_MISSIONS = [
  {
    id: "wins",
    icon: "🧩",
    name: "節日讀書",
    desc: "活動期間完成 3 次測驗",
    target: 3,
    value: () => eventRecord().wins,
    reward: "🐟×2",
  },
  {
    id: "hard",
    icon: "⭐",
    name: "挑戰高手",
    desc: "完成 1 場考試",
    target: 1,
    value: () => eventRecord().hard,
    reward: "🥫×1",
  },
  {
    id: "feed",
    icon: "🍗",
    name: "節日款待",
    desc: "餵食貓咪 3 次",
    target: 3,
    value: () => eventRecord().feed,
    reward: "🍗×2",
  },
  {
    id: "play",
    icon: "🧶",
    name: "歡樂互動",
    desc: "與貓咪互動 5 次",
    target: 5,
    value: () => eventRecord().play,
    reward: "💕+10",
  },
];
function monthDayNumber(month, day) {
  return month * 100 + day;
}
function activeFestival(date = new Date()) {
  const md = monthDayNumber(date.getMonth() + 1, date.getDate());
  return (
    FESTIVAL_COSTUMES.find(
      (f) => f.start && md >= monthDayNumber(...f.start) && md <= monthDayNumber(...f.end),
    ) || null
  );
}
export function selectedCostume(key = activePetKey()) {
  const selected = petData.equippedCostumes?.[key];
  if (selected && petData.unlockedCostumes.includes(selected))
    return FESTIVAL_COSTUMES.find((f) => f.id === selected) || FESTIVAL_COSTUMES[0];
  const festival = activeFestival();
  if (festival && petData.unlockedCostumes.includes(festival.id)) return festival;
  return FESTIVAL_COSTUMES[0];
}
function festivalCostumeHtml(key = activePetKey()) {
  const f = selectedCostume(key);
  if (!f || f.id === "default") return "";
  if (f.image) {
    return `<span class="festival-costume"><img class="costume-layer-sprite" src="${f.image}" alt="${escapeHtml(f.name)}"><span class="costume-label">${f.name}</span></span>`;
  }
  return `<span class="festival-costume"><span class="costume-hat">${f.hat || "✨"}</span><span class="costume-left">${f.left || ""}</span><span class="costume-right">${f.right || ""}</span><span class="costume-label">${f.name}</span></span>`;
}
function festivalWrapClass(key = activePetKey()) {
  const f = selectedCostume(key);
  return f && f.id !== "default" ? ` festival-${f.id}` : "";
}
function festivalPreviewHtml(key = activePetKey()) {
  const f = selectedCostume(key),
    event = activeFestival();
  return `<div class="festival-preview"><span style="font-size:1.45rem">${f.icon}</span><span><b>${f.name}${f.id !== "default" ? "服裝展示中" : "造型"}</b><small>${event ? `目前活動：${event.name}。前往活動頁可解鎖限定服裝。` : "可在服裝圖鑑自由切換已收藏的造型。"}</small></span></div>`;
}

function isBirthdayToday(key) {
  return isSameMonthDay(petData.birthdays[key]);
}
function birthdayDressHtml(key) {
  return `${isBirthdayToday(key) ? '<span class="birthday-cape"></span><span class="birthday-hat"></span>' : ""}${festivalCostumeHtml(key)}`;
}
function petAvatarWrapClass(key) {
  return `pet-avatar-wrap${isBirthdayToday(key) ? " birthday-dress" : ""}${festivalWrapClass(key)}`;
}
function countdownText(days) {
  if (days === null) return "尚未設定";
  if (days === 0) return "就是今天！";
  if (days === 1) return "明天";
  return `${days} 天`;
}
function countdownPanelHtml(key) {
  const birthday = petData.birthdays[key],
    anniversary = petData.anniversaries[key],
    bd = nextSpecialDay(birthday),
    ad = nextSpecialDay(anniversary);
  return `<div class="countdown-panel"><div class="countdown-card"><span class="countdown-icon">🎂</span><span><b>${escapeHtml(petName(key))} 的生日</b><small>${birthday || "尚未設定日期"}</small></span><span class="countdown-days${bd === 0 ? " today" : ""}">${countdownText(bd)}</span></div><div class="countdown-card"><span class="countdown-icon">🎉</span><span><b>相遇紀念日</b><small>${anniversary ? `已陪伴 ${daysSince(anniversary)} 天` : "尚未設定日期"}</small></span><span class="countdown-days${ad === 0 ? " today" : ""}">${countdownText(ad)}</span></div><div class="reminder-note">🔔 倒數提醒會在紀念日頁面持續顯示；日期進入 7 天內時會標示為即將到來。${(bd !== null && bd <= 7) || (ad !== null && ad <= 7) ? '<span class="reminder-badge">即將到來</span>' : ""}</div></div>`;
}
function specialDayHtml(key) {
  const birthday = petData.birthdays[key],
    anniversary = petData.anniversaries[key],
    messages = [];
  if (isSameMonthDay(birthday))
    messages.push(`🎂 今天是 ${escapeHtml(petName(key))} 的生日！`);
  if (isSameMonthDay(anniversary))
    messages.push(`🎉 今天是相遇紀念日！已陪伴 ${daysSince(anniversary)} 天`);
  return messages.length ? `<div class="special-day">${messages.join("<br>")}</div>` : "";
}
/* ---------- 美少女夢工廠風格：頂部資訊面板與磚塊儀表板 ---------- */
const PM_GAUGES = [
  ["好感", (k) => Math.min(100, Math.round((petAffection(k) / (PET_LEVELS[PET_LEVELS.length - 1] || 1)) * 100))],
  ["心情", (k) => Math.round(petMoodValue(k))],
  ["體力", (k) => Math.round(petStatus(k).energy ?? 100)],
  ["飽食", (k) => Math.round(petStatus(k).hunger ?? 80)],
  ["清潔", (k) => Math.round(petStatus(k).cleanliness ?? 90)],
];
export function pmTopHtml(key = activePetKey()) {
  const st = petStatus(key),
    level = petLevel(petAffection(key)),
    stage = growthStage(petAffection(key)),
    mood = moodInfo(),
    face = facePos(Number(key) || 0);
  const gauges = PM_GAUGES.map(
    ([label, fn]) =>
      `<div class="pm-gauge"><span>${label}</span><i style="--pm-pct:${Math.max(0, Math.min(100, fn(key)))}%"></i><b>${fn(key)}</b></div>`,
  ).join("");
  return `<div class="pm-panel pm-top">
    <div class="pm-strip"><span>🐾 ${escapeHtml(petName(key))}</span><span>${stage.icon} ${stage.name}・Lv.${level}</span></div>
    <div class="pm-faceline">
      <i class="face" style="background-position:${face}"></i>
      <div class="pm-bubble">${mood.icon} ${mood.label}・測驗 ${petRecord(key).total} 次${st.sick ? "・😿 生病中" : ""}</div>
    </div>
    <div class="pm-goldrow">
      <span class="pm-label">GOLD</span><span class="pm-vals">${petCoins()} G</span>
      <span class="pm-label">EXP</span><span class="pm-vals">${petAffection(key)}</span>
    </div>
    <div class="pm-gauges">${gauges}</div>
  </div>`;
}
const PM_TILES = [
  ["academy", "📚", "學院", "park"],
  ["stats", "📊", "屬性", null],
  ["shop", "🛍️", "商店", "cafe"],
  ["gacha", "🎰", "扭蛋", null],
  ["titles", "🏅", "稱號", "onsen"],
  ["dates", "🎂", "紀念", "cinema"],
  ["events", "🎊", "活動", "street"],
  ["trip", "📸", "相簿", "beach"],
];
export function pmTilesHtml() {
  return `<div class="pm-tiles">${PM_TILES.map(
    ([view, icon, label, scene]) =>
      `<button class="pm-tile${scene ? " has-scene" : ""}" data-pet-view="${view}">${
        scene ? `<span class="pm-scene" style="--pm-scene:url(./icons/scenes/${scene}.webp)"></span>` : ""
      }<b>${icon}</b><small>${label}</small></button>`,
  ).join("")}
    <button class="pm-bigbtn pm-hero-btn" data-avatar-open="1">🧍 我的角色（換裝・${stageLabel(avatarGrade())}）</button>
    <button class="pm-bigbtn" data-pet-view="trip">🎒 帶貓咪出門</button>
  </div>`;
}
export function petSubnavHtml(view) {
  return `<div class="pet-subnav"><button data-pet-view="home" class="${view === "home" ? "active" : ""}">🏠 小屋</button><button data-pet-view="trip" class="${view === "trip" ? "active" : ""}">🎒 出門</button><button data-pet-view="academy" class="${view === "academy" ? "active" : ""}">📚 學院</button><button data-pet-view="stats" class="${view === "stats" ? "active" : ""}">📊 屬性</button><button data-pet-view="shop" class="${view === "shop" ? "active" : ""}">🛍️ 商店</button><button data-pet-view="gacha" class="${view === "gacha" ? "active" : ""}">🎰 扭蛋</button><button data-pet-view="titles" class="${view === "titles" ? "active" : ""}">🏅 稱號</button><button data-pet-view="dates" class="${view === "dates" ? "active" : ""}">🎂 紀念</button><button data-pet-view="events" class="${view === "events" ? "active" : ""}">🎊 活動</button></div>`;
}
function eventKey() {
  const f = activeFestival();
  return f ? `${new Date().getFullYear()}-${f.id}` : null;
}
function eventRecord() {
  const key = eventKey();
  if (!key) return { wins: 0, hard: 0, feed: 0, play: 0 };
  return { wins: 0, hard: 0, feed: 0, play: 0, ...petData.eventProgress[key] };
}
export function addEventProgress(type, amount = 1) {
  const key = eventKey();
  if (!key) return;
  petData.eventProgress[key] = eventRecord();
  petData.eventProgress[key][type] = (petData.eventProgress[key][type] || 0) + amount;
  savePetData();
}
function missionDone(m) {
  return Math.min(m.value(), m.target) >= m.target;
}
function allMissionsClaimed() {
  const key = eventKey();
  return key && EVENT_MISSIONS.every((m) => petData.eventClaims[`${key}:${m.id}`]);
}
function claimEventMission(id) {
  const event = activeFestival(),
    key = eventKey(),
    mission = EVENT_MISSIONS.find((m) => m.id === id);
  if (!event || !mission || !missionDone(m) || petData.eventClaims[`${key}:${id}`]) return;
  petData.eventClaims[`${key}:${id}`] = true;
  if (id === "wins") petData.food.fish = (petData.food.fish || 0) + 2;
  if (id === "hard") petData.food.tuna = (petData.food.tuna || 0) + 1;
  if (id === "feed") petData.food.chicken = (petData.food.chicken || 0) + 2;
  if (id === "play")
    petData.affection[activePetKey()] = (petData.affection[activePetKey()] || 0) + 10;
  if (allMissionsClaimed() && !petData.unlockedCostumes.includes(event.id))
    petData.unlockedCostumes.push(event.id);
  savePetData();
  playSkinArrivalSound();
  navigator.vibrate?.([15, 20, 25]);
  showPetHome();
}
export function equipCostume(id) {
  if (!petData.unlockedCostumes.includes(id)) return;
  petData.equippedCostumes[activePetKey()] = id;
  savePetData();
  playSkinArrivalSound();
  showPetHome();
  requestAnimationFrame(() => animatePet("pet-wiggle", "新造型好看嗎？"));
}
function costumeCollectionHtml(key) {
  const owned = FESTIVAL_COSTUMES.filter((c) =>
      petData.unlockedCostumes.includes(c.id),
    ).length,
    total = FESTIVAL_COSTUMES.length,
    percent = Math.round((owned / total) * 100),
    selected = selectedCostume(key);
  return `<div class="collection-progress"><div class="collection-progress-head"><span>👗 服裝收藏進度</span><span>${owned}/${total}</span></div><div class="collection-progress-bar"><i style="--collection-progress:${percent}%"></i></div><small>轉動扭蛋機或完成活動任務，即可永久收藏並自由更換造型！</small></div><div class="costume-collection">${FESTIVAL_COSTUMES.map(
    (c) => {
      const unlocked = c.id === "default" || petData.unlockedCostumes.includes(c.id),
        equipped = selected.id === c.id;
      const thumb = c.image
        ? `<img class="costume-thumb-img" src="${c.image}" alt="${escapeHtml(c.name)}">`
        : `<span class="costume-thumb">${c.icon}</span>`;
      return `<div class="costume-card${unlocked ? "" : " locked"}${equipped ? " equipped" : ""}">${thumb}<span><b>${c.name}</b><small>${c.desc}</small></span>${!unlocked ? '<span class="costume-lock">🔒</span>' : ""}${equipped ? '<span class="costume-equipped">穿著中</span>' : ""}${unlocked ? `<button data-equip-costume="${c.id}" ${equipped ? "disabled" : ""}>${equipped ? "✓ 目前穿著" : "換上服裝"}</button>` : ""}</div>`;
    },
  ).join("")}</div>`;
}
function eventPageHtml(key) {
  const event = activeFestival();
  if (!event)
    return `${petSubnavHtml("events")}<div class="no-event">目前沒有進行中的節日活動。<br>已收藏服裝仍可在下方自由切換。</div>${costumeCollectionHtml(key)}`;
  const eventId = eventKey();
  const missions = EVENT_MISSIONS.map((m) => {
    const value = Math.min(m.value(), m.target),
      done = value >= m.target,
      claimed = petData.eventClaims[`${eventId}:${m.id}`],
      percent = Math.min(100, (value / m.target) * 100);
    return `<div class="event-mission${done ? " done" : ""}"><span class="mission-icon">${m.icon}</span><span><b>${m.name}</b><small>${m.desc}・${value}/${m.target}</small><span class="mission-progress"><i style="--mission-progress:${percent}%"></i></span></span><span class="mission-reward">${m.reward}${done ? `<br><button data-claim-mission="${m.id}" ${claimed ? "disabled" : ""}>${claimed ? "已領取" : "領取"}</button>` : ""}</span></div>`;
  }).join("");
  const complete = allMissionsClaimed();
  return `${petSubnavHtml("events")}<div class="event-panel"><div class="event-hero"><span class="event-hero-icon">${event.icon}</span><span><b>${event.name}活動</b><small>完成全部任務即可永久收藏「${event.name}服裝」。${complete ? "服裝已解鎖，可於下方手動切換。" : ""}</small></span></div><div class="event-missions">${missions}</div>${costumeCollectionHtml(key)}</div>`;
}
function titleWallHtml(key) {
  const unlocked = new Set(earnedTitles(key)),
    cards = TITLE_RULES.map((rule, i) => {
      const value = Math.min(rule.value(key), rule.target),
        done = value >= rule.target,
        percent = Math.min(100, (value / rule.target) * 100);
      return `<div class="title-card ${done ? "unlocked" : "locked"}"><span class="title-medal">${done ? ["🏅", "🎖️", "🏆", "🌟"][i % 4] : "🔒"}</span><span><b>${rule.name}</b><small>${rule.label}<br>${value}/${rule.target}</small></span><span class="wall-progress"><i style="--p:${percent}%"></i></span>${done ? `<button class="title-equip" data-equip-title="${escapeHtml(rule.name)}" ${primaryTitle(key) === rule.name ? "disabled" : ""}>${primaryTitle(key) === rule.name ? "✓ 裝備中" : "裝備稱號"}</button>${primaryTitle(key) === rule.name ? '<span class="equipped-mark">使用中</span>' : ""}` : ""}</div>`;
    }).join("");
  return `${petSubnavHtml("titles")}<div class="title-wall-summary"><div class="title-wall-stat"><b>${unlocked.size}</b><small>已解鎖稱號</small></div><div class="title-wall-stat"><b>${TITLE_RULES.length - unlocked.size}</b><small>待解鎖</small></div><div class="title-wall-stat"><b>${Math.round((unlocked.size / TITLE_RULES.length) * 100)}%</b><small>完成度</small></div></div><div class="title-wall">${cards}</div>`;
}
function datesHtml(key) {
  const birthday = petData.birthdays[key] || "",
    anniversary = petData.anniversaries[key] || "",
    birthdayNext = nextSpecialDay(birthday),
    anniversaryDays = daysSince(anniversary);
  return `${petSubnavHtml("dates")}${specialDayHtml(key)}${countdownPanelHtml(key)}<div class="date-panel"><div class="date-card"><label>🎂 ${escapeHtml(petName(key))} 的生日<input id="petBirthday" type="date" value="${birthday}"></label><div class="date-note">${birthday ? (birthdayNext === 0 ? "今天就是生日！" : `距離下次生日還有 ${birthdayNext} 天`) : "設定生日後，每年當天會顯示生日祝福。"}</div></div><div class="date-card"><label>🎉 相遇紀念日<input id="petAnniversary" type="date" value="${anniversary}"></label><div class="date-note">${anniversary ? `已經一起冒險 ${anniversaryDays} 天。` : "預設為領養日，也可以自行調整。"}</div></div><div class="date-actions"><button data-save-dates class="primary">儲存日期</button><button data-clear-birthday>清除生日</button></div></div>`;
}
function equipTitle(title) {
  const key = activePetKey(),
    titles = earnedTitles(key);
  if (!titles.includes(title)) return;
  petData.equippedTitles = petData.equippedTitles || {};
  petData.equippedTitles[key] = title;
  savePetData();
  playSkinArrivalSound();
  navigator.vibrate?.(16);
  showPetHome();
}
export function setPetView(view) {
  petData.petView = view;
  savePetData();
  showPetHome();
}
window.setPetView = setPetView;
function savePetDates() {
  const key = activePetKey(),
    birthday = $("petBirthday")?.value || "",
    anniversary = $("petAnniversary")?.value || "";
  if (birthday) petData.birthdays[key] = birthday;
  else delete petData.birthdays[key];
  if (anniversary) petData.anniversaries[key] = anniversary;
  else delete petData.anniversaries[key];
  savePetData();
  showPetHome();
  requestAnimationFrame(() => animatePet("pet-bounce", "重要的日子記住了！"));
}
function clearPetBirthday() {
  delete petData.birthdays[activePetKey()];
  savePetData();
  showPetHome();
}
function claimSpecialDayBonus(key) {
  const today = localDay(),
    token = `${key}:${today}`;
  petData.reminderSeen = petData.reminderSeen || {};
  if (petData.reminderSeen[token]) return;
  let changed = false;
  if (isBirthdayToday(key)) {
    petData.food.premium = (petData.food.premium || 0) + 1;
    petData.affection[key] = (petData.affection[key] || 0) + 8;
    petData.mood[key] = Math.min(100, petMoodValue(key) + 15);
    changed = true;
  }
  if (isSameMonthDay(petData.anniversaries[key])) {
    petData.food.tuna = (petData.food.tuna || 0) + 1;
    petData.affection[key] = (petData.affection[key] || 0) + 5;
    changed = true;
  }
  if (changed) {
    petData.reminderSeen[token] = true;
    savePetData();
    setTimeout(() => animatePet("pet-bounce", "今天是特別的日子！"), 250);
  }
}
// ===== 主線劇情（貓咪是星讀學園派來的學習夥伴） =====
function storyStateOf() {
  const data = petData;
  if (!data.story) data.story = newStoryState();
  return normalizeStory(data.story);
}
function mistakeBookCount() {
  try {
    return (JSON.parse(localStorage.getItem("meowdoku.mistakes") || "[]") || []).length;
  } catch {
    return 0;
  }
}
// 記錄劇情事件；達標就自動進下一章並發獎勵。回傳 { story, completed }
export function recordStoryEvent(type, n = 1) {
  const data = petData;
  data.story = normalizeStory(data.story);
  const { story, completed } = applyEvent(data.story, type, n);
  data.story = story;
  if (completed) {
    data.coins = (data.coins || 0) + (completed.reward.coins || 0);
    const k = activePetKey();
    if (k) {
      data.affection = data.affection || {};
      data.affection[k] = (data.affection[k] || 0) + (completed.reward.affection || 0);
    }
    savePetData();
    return { story, completed };
  }
  savePetData();
  return { story, completed: null };
}
export function celebrateChapter(completed) {
  if (!completed) return;
  audio.playCoin?.();
  showSheet(
    `🎉 完成 ${completed.title}`,
    `<p class="story-congrats">喵嗚——！你完成了「${escapeHtml(completed.title)}」！</p>
     <div class="quiz-rewards-row">
       <span class="quiz-reward-pill">🪙 +${completed.reward.coins} 金幣</span>
       <span class="quiz-reward-pill">💗 好感 +${completed.reward.affection}</span>
       ${completed.reward.title ? `<span class="quiz-reward-pill">🏅 解鎖稱號：${escapeHtml(completed.reward.title)}</span>` : ""}
     </div>
     <p class="unit-hint">下一章的任務已經在首頁的「📜 主線任務」裡等你喵。</p>`,
    "繼續加油！",
  );
}
function syncStatTask(key) {
  const s = storyStateOf();
  const ch = currentChapter(s);
  if (!ch || ch.task.type !== "subject_stat") return s;
  const best = Math.max(0, ...Object.values(petStats(key)));
  if (best < ch.task.target) return s;
  return recordStoryEvent("subject_stat", ch.task.target).story;
}
function storyPanelHtml(key) {
  const s = syncStatTask(key);
  const ch = currentChapter(s);
  if (!ch) {
    return `<div class="pm-panel story-panel">
      <div class="story-head"><b>📜 ${STORY.title}</b><span class="story-ch">全部完成 🎉</span></div>
      <p class="unit-hint">你已經完成全部 ${s.done.length} 章，${escapeHtml(petName(key))}正式成為你的專屬學習夥伴了喵！</p>
    </div>`;
  }
  const p = taskProgress(s);
  const exam = ch.exam;
  return `<div class="pm-panel story-panel">
    <div class="story-head"><b>📜 ${STORY.title}</b><span class="story-ch">第 ${s.chapterIndex + 1} / ${STORY.chapters.length} 章</span></div>
    <div class="story-title">${escapeHtml(ch.title)}${exam ? `　<span class="story-exam">${exam.kind === "mid" ? "期中考" : "期末考"}</span>` : ""}</div>
    <div class="story-task">任務：${escapeHtml(p.label)}
      <div class="story-bar"><i style="width:${p.percent}%"></i></div>
      <span class="story-num">${p.have} / ${p.need}</span>
    </div>
    <div class="story-btn-row">
      <button class="academy-action-btn story-btn" data-story-start="1">📖 劇情</button>
      ${exam ? `<button class="academy-action-btn story-btn exam-btn" data-exam-start="1">📝 開始考試</button>` : ""}
    </div>
  </div>`;
}
function openStorySheet() {
  const s = storyStateOf();
  const ch = currentChapter(s);
  if (!ch) {
    showSheet("📜 主線任務", `<p>《${STORY.title}》全部章節都完成了喵！<br>接下來想練哪一科都可以，我會一直陪著你。</p>`, "好耶");
    return;
  }
  const p = taskProgress(s);
  const exam = ch.exam;
  showSheet(
    `📜 ${ch.title}`,
    `<div class="talk-lines">${ch.lines.map((l) => `<p>🐱 ${escapeHtml(l)}</p>`).join("")}</div>
     <div class="story-task">任務：${escapeHtml(p.label)}（目前 ${p.have} / ${p.need}）</div>
     <div class="unit-hint">完成後可獲得 🪙 ${ch.reward.coins} 金幣、好感 +${ch.reward.affection}${
       ch.reward.title ? `，並解鎖稱號「${escapeHtml(ch.reward.title)}」` : ""
     }。</div>`,
    exam ? "📝 開始考試" : "接下任務！",
    exam ? () => startExamSession() : null,
    "稍後再說",
  );
}
function openTalkSheet() {
  const key = activePetKey();
  const lines = talkLines({ mood: petMoodValue(key), affection: petAffection(key), hour: new Date().getHours() });
  showSheet(
    `💬 跟${escapeHtml(petName(key))}說話`,
    `<div class="talk-lines">${lines.map((l) => `<p>🐱 ${escapeHtml(l)}</p>`).join("")}</div>
     <div class="talk-choices">${TALK_CHOICES.map(
       (c) => `<button class="academy-action-btn talk-choice" data-talk-choice="${c.id}">${c.label}</button>`,
     ).join("")}</div>`,
    "結束對話",
  );
}
function handleTalkChoice(id) {
  const c = TALK_CHOICES.find((x) => x.id === id);
  if (!c) return;
  const key = activePetKey();
  const data = petData;
  data.mood = data.mood || {};
  data.affection = data.affection || {};
  data.mood[key] = Math.min(100, (data.mood[key] || 0) + (c.mood || 0));
  data.affection[key] = (data.affection[key] || 0) + (c.affection || 0);
  if (c.buff) data.studyBuff = { until: Date.now() + STUDY_BUFF_MINUTES * 60000 };
  savePetData();
  audio.playPurr?.();
  showPetHome();
  showSheet(
    `🐱 ${escapeHtml(petName(key))}`,
    `<p class="talk-reply">${escapeHtml(c.reply)}</p>${c.buff ? `<p class="unit-hint">📖 陪讀中：${STUDY_BUFF_MINUTES} 分鐘內完成測驗，金幣 +${Math.round((STUDY_BUFF_RATE - 1) * 100)}%！</p>` : ""}`,
    "好耶",
  );
}
export function studyBuff() {
  const data = petData;
  const active = petData.studyBuff && petData.studyBuff.until > Date.now();
  return active ? STUDY_BUFF_RATE : 1;
}

// 首頁貓咪說的話：每天第一次開會先打招呼（並記錄連續上線天數），再依狀態給提醒
function catSpeechLine(key) {
  const data = petData;
  const today = new Date().toISOString().slice(0, 10);
  let prefix = "";
  if (data.lastPlayDate !== today) {
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    data.loginStreak = data.lastPlayDate === yesterday ? (data.loginStreak || 0) + 1 : 1;
    data.lastPlayDate = today;
    data.lastGreetDate = today;
    prefix = `${timeGreeting()}`;
    if (data.loginStreak >= 2) prefix += `（連續第 ${data.loginStreak} 天來看我喵！）`;
    prefix += "　";
    savePetData();
  }
  const st = petStatus(key);
  return (
    prefix +
    reminderLine({
      name: petName(key),
      hunger: st.hunger,
      energy: st.energy,
      mood: petMoodValue(key),
      cleanliness: st.cleanliness,
      mistakes: mistakeBookCount(),
      story: storyStateOf(),
      streak: data.loginStreak || 0,
    })
  );
}

// ===== 主角（我的角色）與換裝 =====
let avatarCat = "hair";
// 主角目前的年級：跟著主線章節的冊次（四上 → 九年級），所以會隨劇情長大
function avatarGrade() {
  const ch = currentChapter(storyStateOf());
  const term = ch?.exam?.term;
  return term ? gradeOfTerm(term) : 4;
}
function avatarState() {
  if (!petData.avatar) petData.avatar = defaultAvatar();
  return normalizeAvatar(petData.avatar);
}
function setAvatarPart(part, id) {
  const a = avatarState();
  if (!AVATAR_PARTS[part]?.some((o) => o.id === id)) return a;
  petData.avatar = { ...a, [part]: id };
  savePetData();
  return petData.avatar;
}
export function openAvatarSheet() {
  const a = avatarState();
  const cat = avatarCat;
  const items = AVATAR_PARTS[cat]
    .map(
      (o) =>
        `<button class="avatar-item${a[cat] === o.id ? " active" : ""}" data-avatar-pick="${cat}:${o.id}">${
          o.value ? `<span class="avatar-swatch" style="background:${o.value}"></span>` : ""
        }${escapeHtml(o.name)}</button>`,
    )
    .join("");
  const tabs = [
    ["hair", "髮型"],
    ["hairColor", "髮色"],
    ["skin", "膚色"],
    ["top", "上衣"],
    ["bottom", "褲裙"],
    ["shoes", "鞋子"],
    ["hat", "帽子"],
    ["accessory", "配件"],
  ]
    .map(([k, label]) => `<button class="avatar-tab${k === cat ? " active" : ""}" data-avatar-cat="${k}">${label}</button>`)
    .join("");
  showSheet(
    "🧍 我的角色",
    `<div class="avatar-wrap">${renderAvatar(a, { size: 168, grade: avatarGrade() })}</div>
     <p class="unit-hint">🧒 身體：${stageLabel(avatarGrade())}（隨主線年級長大）</p>
     <div class="avatar-tabs">${tabs}</div>
     <div class="avatar-items">${items}</div>
     <div class="avatar-actions">
       <button class="academy-action-btn" data-avatar-random="1">🎲 隨機</button>
       <button class="academy-action-btn" data-avatar-reset="1">↩️ 回復預設</button>
     </div>
     <p class="unit-hint">目前造型：${escapeHtml(avatarLabel(a))}</p>`,
    "完成",
  );
}

export function showPetHome() {
  if (!petData.initialized) return;
  const key = activePetKey();
  let view = petData.petView || "home";
  if (view === "room") view = "home";
  claimSpecialDayBonus(key);
  const pages = {
    titles: titleWallHtml,
    dates: datesHtml,
    events: eventPageHtml,
    academy: academyPageHtml,
    stats: statsPageHtml,
    shop: shopPageHtml,
    gacha: gachaPageHtml,
    trip: tripPageHtml,
  };
  if (pages[view]) return renderPetView(pages[view](key));
  const aff = petAffection(key),
    level = petLevel(aff),
    progress = affectionProgress(aff),
    mood = moodInfo(),
    rec = petRecord(key),
    stage = growthStage(aff),
    titles = earnedTitles(key);
  let cats = [...INTERACTIVE_CATS];
  if (collectionFilter === "unlocked") cats = cats.filter(isUnlocked);
  else if (collectionFilter === "locked") cats = cats.filter((k) => !isUnlocked(k));
  else if (collectionFilter === "raised")
    cats = cats.filter((k) => isUnlocked(k) && petAffection(k) > 0);
  else if (collectionFilter.startsWith("stage-")) {
    const target = Number(collectionFilter.split("-")[1]);
    cats = cats.filter((k) => isUnlocked(k) && growthStage(petAffection(k)).index === target);
  }
  const sorters = {
    index: (a, b) => Number(a) - Number(b),
    name: (a, b) => petName(a).localeCompare(petName(b), "zh-Hant"),
    level: (a, b) =>
      petLevel(petAffection(b)) - petLevel(petAffection(a)) || Number(a) - Number(b),
    affection: (a, b) => petAffection(b) - petAffection(a) || Number(a) - Number(b),
    cooperation: (a, b) => petRecord(b).total - petRecord(a).total || Number(a) - Number(b),
    stage: (a, b) =>
      growthStage(petAffection(b)).index - growthStage(petAffection(a)).index ||
      petAffection(b) - petAffection(a),
  };
  cats.sort(sorters[collectionSort] || sorters.index);
  const tatamiClass = petData.roomWallpaper === "tatami" ? " wallpaper-tatami" : "";
  const cattreeHtml = petData.roomFurniture?.cattree
    ? '<img class="room-furniture-cattree" id="roomFurnitureCattree" src="./icons/room/furniture_cat_tree.webp" alt="貓跳台" title="點擊在貓跳台玩耍">'
    : "";
  const kotatsuHtml = petData.roomFurniture?.kotatsu
    ? '<img class="room-furniture-kotatsu" id="roomFurnitureKotatsu" src="./icons/room/furniture_kotatsu.webp" alt="暖被桌" title="點擊在暖被桌旁打盹">'
    : "";
  const dirt = dirtLevel(petStatus(key).cleanliness);
  const body = `<div class="pet-home">${petSubnavHtml("home")}${pmTopHtml(key)}${pmTilesHtml()}${storyPanelHtml(key)}${festivalPreviewHtml(key)}${specialDayHtml(key)}<div class="pm-stage-tile"><div class="pet-room-stage${tatamiClass}" id="petRoomStage" data-interact-stage="true" title="互動客廳"><div class="pet-room-header-left"><div class="pet-room-badge" id="petRoomBadge">🏠 你的小屋</div><button class="room-snapshot-btn" id="roomSnapshotBtn" title="拍下角色與貓咪生活照留念">📸 拍照留念</button></div><span class="pet-speech" id="petSpeech">${escapeHtml(catSpeechLine(key))}</span>${dirt >= 2 ? `<div class="room-dirt-badge" id="roomDirtBadge">🧼 ${DIRT_LABEL[dirt]}</div>` : ""}<div class="room-hearts" id="roomHearts"></div><div class="pet-room-rug"></div>${cattreeHtml}${kotatsuHtml}<div class="pet-room-actors"><div class="room-hero-wrap" id="roomHeroWrap" data-avatar-open="1" title="點擊角色換裝・${stageLabel(avatarGrade())}"><div class="room-hero-avatar-box">${renderAvatar(avatarState(), { size: 195, grade: avatarGrade() })}</div><div class="room-hero-tag"><span class="room-hero-grade">${stageLabel(avatarGrade())}</span><span class="room-hero-action">👗 換裝</span></div></div><div class="pet-room-cat-wrap companion${dirt ? ` dirty-${dirt}` : ""}" id="roomCatWrap" data-interact-cat="true" title="摸摸${escapeHtml(petName(key))}">${birthdayDressHtml(key)}<img class="room-cat-img" id="roomCatImg" src="${getRoomCatSprite(key, roomCatPose)}" alt="${escapeHtml(petName(key))}" onerror="this.onerror=null; this.src=this.src.replace('.webp', '.png');"><div class="cat-dirt-layer" aria-hidden="true"></div><span class="cat-companion-label">🐾 ${escapeHtml(petName(key))}</span></div></div><div class="room-wand-follower" id="roomWandFollower"><img class="room-wand-img" src="./icons/room/teaser_wand.webp" alt="逗貓棒" onerror="this.onerror=null; this.src='./icons/room/teaser_wand.png';"></div><div class="room-litter-corner" id="roomLitterCorner" title="點擊清潔貓砂盆"><div class="room-litter-badge" id="roomLitterBadge">🧹 乾淨度 33%</div><div class="room-litter-tray" id="roomLitterTray"><img class="room-litter-img" src="./icons/room/litter_box.webp" alt="貓砂盆" onerror="this.onerror=null; this.src='./icons/room/litter_box.png';"><div class="room-litter-clumps" id="roomLitterClumps"></div></div></div><div class="pet-room-hint" id="petRoomHint">✨ 點擊角色換裝，輕觸身旁貓咪摸摸互動！</div></div><div class="interaction-row room-actions"><button data-room-mode="pet" class="${roomToolMode === 'pet' ? 'active' : ''}">👋 摸摸</button><button data-room-mode="wand" class="${roomToolMode === 'wand' ? 'active' : ''}">🪶 逗貓棒</button><button data-room-mode="litter" class="${roomToolMode === 'litter' ? 'active' : ''}">🧹 鏟貓砂</button><button data-room-mode="rest" class="${roomToolMode === 'rest' ? 'active' : ''}">💤 休息</button></div><div class="interaction-row room-care"><button data-life-event="care:brush">🪮 梳毛</button><button data-life-event="care:bath">🛁 洗澡</button><button data-life-event="care:nails">✂️ 剪指甲</button><button data-pet-talk="1">💬 說說話</button></div></div><div class="pm-panel pm-detail"><div class="pet-status-card"><div class="pet-status-head"><div class="pet-name-title">${escapeHtml(petName(key))}　Lv.${level}</div><div class="growth-badges"><span class="growth-badge">${stage.icon} ${stage.name}</span><span class="title-badge" title="前往稱號牆可更換">🏅 ${primaryTitle(key)}・已裝備</span></div></div><div class="title-list">${titles
    .slice(-4)
    .map((t) => `<span class="mini-title">${t}</span>`)
    .join(
      "",
    )}</div>${titleConditionsHtml(key)}<div class="mood-row"><span class="mood-pill">${mood.icon} ${mood.label}</span><span class="mood-val">心情 ${petMoodValue(key)}/100</span></div><div class="affection-bar"><div class="affection-fill" style="--affection:${progress}%"></div></div><div class="pet-affection">💕 好感度 ${aff}${level < PET_LEVELS.length ? `／${PET_LEVELS[level]}` : "（最高等級）"}</div>${growthTrackHtml(key)}<div class="rename-row"><input id="renameInput" maxlength="12" value="${escapeHtml(petName(key))}"><button data-rename>改名</button></div></div><div class="daily-feed"><span><b>📅 每日餵食獎勵</b><small>${dailyFeedAvailable() ? "今天可領取小魚乾與好感度" : "今天已經領過了"}</small></span><button data-daily-feed ${dailyFeedAvailable() ? "" : "disabled"}>${dailyFeedAvailable() ? "領取" : "已領取"}</button></div><div class="pet-stats"><div class="pet-stat"><b>${rec.total}</b><small>完成測驗</small></div><div class="pet-stat"><b>${rec.easy}/${rec.normal}</b><small>隨堂／考試</small></div></div><div class="food-grid">${Object.entries(
    FOODS,
  )
    .map(
      ([id, f]) =>
        `<button class="food-card" data-feed="${id}" ${(petData.food[id] || 0) <= 0 ? "disabled" : ""}><span class="food-icon">${f.icon}</span><span class="food-info"><b>${f.name}</b><small>好感度 +${f.affection}</small></span><span class="food-count">×${petData.food[id] || 0}</span></button>`,
    )
    .join(
      "",
    )}</div></div><div class="pm-panel pm-detail"><div class="pet-collection-title"><span>📖 貓咪圖鑑 ${petData.unlocked.length}/${INTERACTIVE_CATS.length}</span><small>完成測驗可認識新貓咪</small></div><div class="collection-tools"><label>篩選<select data-collection-filter><option value="all" ${collectionFilter === "all" ? "selected" : ""}>全部貓咪</option><option value="unlocked" ${collectionFilter === "unlocked" ? "selected" : ""}>已解鎖</option><option value="locked" ${collectionFilter === "locked" ? "selected" : ""}>未解鎖</option><option value="raised" ${collectionFilter === "raised" ? "selected" : ""}>培養中</option>${GROWTH_STAGES.map((g, i) => `<option value="stage-${i}" ${collectionFilter === `stage-${i}` ? "selected" : ""}>${g.icon} ${g.name}</option>`).join("")}</select></label><label>排序<select data-collection-sort><option value="index" ${collectionSort === "index" ? "selected" : ""}>圖鑑編號</option><option value="name" ${collectionSort === "name" ? "selected" : ""}>名稱</option><option value="stage" ${collectionSort === "stage" ? "selected" : ""}>成長階段</option><option value="level" ${collectionSort === "level" ? "selected" : ""}>等級高到低</option><option value="affection" ${collectionSort === "affection" ? "selected" : ""}>好感度高到低</option><option value="cooperation" ${collectionSort === "cooperation" ? "selected" : ""}>完成測驗多到少</option></select></label><div class="collection-saved-note">✓ 篩選與排序會自動保存</div></div><div class="pet-collection">${
    cats.length
      ? cats
          .map((k) => {
            const unlocked = isUnlocked(k),
              g = growthStage(petAffection(k));
            return `<button class="pet-cat${k === key ? " active" : ""}${unlocked ? "" : " locked"}" ${unlocked ? `data-pet-select="${k}"` : "disabled"} aria-label="${unlocked ? petName(k) : "尚未解鎖"}">${petFaceHtml(k, "face")}${unlocked ? `<span class="pet-cat-stage">${g.icon}</span><span class="pet-cat-level">Lv.${petLevel(petAffection(k))}</span><span class="pet-cat-title" title="裝備稱號：${escapeHtml(primaryTitle(k))}">🏅 ${escapeHtml(primaryTitle(k))}</span><span class="pet-cat-name">${escapeHtml(petName(k))}</span>` : '<span class="pet-lock">🔒</span>'}</button>`;
          })
          .join("")
      : '<div class="collection-empty">目前沒有符合條件的貓咪</div>'
  }</div></div></div>`;
  renderPetView(body);
  requestAnimationFrame(() => {
    renderRoomLitter();
    bindRoomStageInteractions();
    if (roomToolMode === "wand") {
      $("petRoomStage")?.classList.add("wand-active");
    }
  });
}
function renderPetView(html) {
  $("petView").innerHTML = html;
}
export function animatePet(cls, text) {
  // cls 可以是 "pose:<key>"，直接指定客廳立繪姿勢（例如 pose:eat）
  const poseCls = cls.startsWith("pose:") ? cls.slice(5) : null;
  const cssCls = poseCls ? "pet-bounce" : cls;
  const avatar = document.querySelector(".pet-avatar");
  if (avatar) {
    avatar.classList.remove("pet-bounce", "pet-wiggle", "pet-sleep");
    void avatar.offsetWidth;
    avatar.classList.add(cssCls);
  }
  let pose = "idle";
  if (poseCls) pose = poseCls;
  else if (cls === "pet-bounce") pose = "pet";
  else if (cls === "pet-wiggle") pose = "play";
  else if (cls === "pet-sleep") pose = "sleep";

  setRoomCatPose(pose, text, cssCls);

  if (pose === "pet") {
    for (let i = 0; i < 4; i++) {
      setTimeout(
        () =>
          spawnRoomHeart(
            38 + Math.random() * 25,
            25 + Math.random() * 35,
            ["❤️", "💖", "✨", "🌸"][i % 4],
          ),
        i * 150,
      );
    }
  } else if (pose === "play") {
    for (let i = 0; i < 3; i++) {
      setTimeout(
        () =>
          spawnRoomHeart(
            35 + Math.random() * 30,
            25 + Math.random() * 30,
            ["🧶", "⭐", "✨"][i % 3],
          ),
        i * 180,
      );
    }
  } else if (pose === "sleep") {
    for (let i = 0; i < 3; i++) {
      setTimeout(
        () =>
          spawnRoomHeart(
            45 + Math.random() * 20,
            35 + Math.random() * 30,
            ["💤", "✨", "☁️"][i % 3],
          ),
        i * 300,
      );
    }
  }
}
export function interactPet(type) {
  addEventProgress("play", 1);
  const key = activePetKey(),
    beforeStage = growthStage(petAffection(key)).index,
    today = localDay();
  if (petData.interactDate !== today) {
    petData.interactDate = today;
    petData.interactions = 0;
  }
  const limited = petData.interactions >= 6;
  if (!limited) {
    petData.interactions++;
    petData.affection[key] = (petData.affection[key] || 0) + (type === "play" ? 2 : 1);
    petData.mood[key] = Math.min(
      100,
      petMoodValue(key) + (type === "play" ? 7 : type === "pet" ? 4 : 3),
    );
    savePetData();
    checkGrowthUpgrade(key, beforeStage);
  }
  if (!limited && typeof audio !== "undefined") {
    if (audio.playMeow) audio.playMeow(type === "rest" ? 0.85 : 1.1);
    if (type === "pet" && audio.startPurr) {
      audio.startPurr();
      setTimeout(() => audio.stopPurr?.(), 1600);
    }
  }
  const petQuotes = [
    "呼嚕呼嚕...好舒服喵~",
    "最喜歡你了喵！",
    "摸摸下巴最開心了~",
    "喵嗚~ 幸福滿滿！",
  ];
  const playQuotes = [
    "抓到了！好開心喵！",
    "看我的貓貓無影拳！",
    "好好玩！再來一次喵！",
    "喵哈哈！抓住毛線球了！",
  ];
  const sleepQuotes = [
    "呼...呼...做個好夢喵...",
    "小睡一下充充電...💤",
    "呼嚕呼嚕...好溫暖...",
    "抱著尾巴睡著了...zZZ",
  ];
  const quote =
    type === "play"
      ? playQuotes[Math.floor(Math.random() * playQuotes.length)]
      : type === "rest"
        ? sleepQuotes[Math.floor(Math.random() * sleepQuotes.length)]
        : petQuotes[Math.floor(Math.random() * petQuotes.length)];
  const animCls =
    type === "play" ? "pet-wiggle" : type === "rest" ? "pet-sleep" : "pet-bounce";
  playSkinArrivalSound();
  navigator.vibrate?.([15, 20]);
  animatePet(animCls, limited ? "今天已經玩得很滿足了！" : quote);
  updatePetHeroStats(key);
}
function feedPet(type) {
  addEventProgress("feed", 1);
  const food = FOODS[type],
    key = activePetKey(),
    beforeStage = growthStage(petAffection(key)).index;
  if (!food || (petData.food[type] || 0) <= 0) return;
  petData.food[type]--;
  petData.affection[key] = (petData.affection[key] || 0) + food.affection;
  petData.mood[key] = Math.min(100, petMoodValue(key) + food.mood);
  savePetData();
  checkGrowthUpgrade(key, beforeStage);
  playSkinArrivalSound();
  navigator.vibrate?.(20);
  showPetHome();
  requestAnimationFrame(() =>
    animatePet("pose:eat", `${food.name}真好吃！最喜歡你了喵~`),
  );
}
function selectPet(key) {
  if (!isUnlocked(key)) return;
  petData.selected = String(key);
  savePetData();
  showPetHome();
}
function renamePet() {
  const input = $("renameInput"),
    name = input?.value.trim();
  if (!name) return;
  petData.names[activePetKey()] = name.slice(0, 12);
  savePetData();
  showPetHome();
  requestAnimationFrame(() => animatePet("pet-wiggle", `我叫${name.slice(0, 12)}！`));
}

function onPetChange(e) {
  const filter = e.target.closest("[data-collection-filter]");
  if (filter) {
    collectionFilter = filter.value;
    petData.collectionFilter = collectionFilter;
    savePetData();
    showPetHome();
    return;
  }
  const sort = e.target.closest("[data-collection-sort]");
  if (sort) {
    collectionSort = sort.value;
    petData.collectionSort = collectionSort;
    savePetData();
    showPetHome();
  }
}
function onPetClick(e) {
  const mission = e.target.closest("[data-claim-mission]");
  if (mission) {
    claimEventMission(mission.dataset.claimMission);
    return;
  }
  const costume = e.target.closest("[data-equip-costume]");
  if (costume) {
    equipCostume(costume.dataset.equipCostume);
    return;
  }
  const equip = e.target.closest("[data-equip-title]");
  if (equip) {
    equipTitle(equip.dataset.equipTitle);
    return;
  }
  const view = e.target.closest("[data-pet-view]");
  if (view) {
    setPetView(view.dataset.petView);
    return;
  }
  if (handleTripClick(e)) return;
  const shopTab = e.target.closest("[data-shop-tab]");
  if (shopTab) {
    setShopTab(shopTab.dataset.shopTab);
    showPetHome();
    return;
  }
  const buyItem = e.target.closest("[data-buy-item]");
  if (buyItem) {
    buyShopItem(buyItem.dataset.buyItem);
    return;
  }
  const pullGachaBtn = e.target.closest("[data-pull-gacha]");
  if (pullGachaBtn) {
    const v = pullGachaBtn.dataset.pullGacha;
    pullGacha(v === "ticket" ? 1 : Number(v), v === "ticket");
    return;
  }
  const cattreeClick = e.target.closest("#roomFurnitureCattree");
  if (cattreeClick) {
    setRoomCatPose("play", "在貓跳台上玩得超開心喵！", "pet-wiggle");
    spawnRoomHeart(25, 45, "🐾");
    return;
  }
  const kotatsuClick = e.target.closest("#roomFurnitureKotatsu");
  if (kotatsuClick) {
    setRoomCatPose("sleep", "暖被桌裡好溫暖喵～想睡了...", "pet-sleep");
    spawnRoomHeart(30, 70, "💤");
    return;
  }
  const termBtn = e.target.closest("[data-quiz-term]");
  if (termBtn) {
    setQuizTerm(termBtn.dataset.quizTerm);
    setPetView("academy"); // 重畫學院頁：題池數、對照單元跟著換冊次
    return;
  }
  const pubBtn = e.target.closest("[data-quiz-pub]");
  if (pubBtn) {
    setQuizPublisher(pubBtn.dataset.quizPub);
    setPetView("academy"); // 換教科書版本
    return;
  }
  const avatarOpen = e.target.closest("[data-avatar-open]");
  if (avatarOpen) {
    openAvatarSheet();
    return;
  }
  const avatarCatBtn = e.target.closest("[data-avatar-cat]");
  if (avatarCatBtn) {
    avatarCat = avatarCatBtn.dataset.avatarCat;
    openAvatarSheet();
    return;
  }
  const avatarPick = e.target.closest("[data-avatar-pick]");
  if (avatarPick) {
    const [part, id] = String(avatarPick.dataset.avatarPick).split(":");
    setAvatarPart(part, id);
    openAvatarSheet();
    return;
  }
  const avatarRandom = e.target.closest("[data-avatar-random]");
  if (avatarRandom) {
    petData.avatar = randomAvatar();
    savePetData();
    openAvatarSheet();
    return;
  }
  const avatarReset = e.target.closest("[data-avatar-reset]");
  if (avatarReset) {
    petData.avatar = defaultAvatar();
    savePetData();
    openAvatarSheet();
    return;
  }
  const examStart = e.target.closest("[data-exam-start]");
  if (examStart) {
    startExamSession(); // 📝 期中考／期末考
    return;
  }
  const mistakesExport = e.target.closest("[data-mistake-export]");
  if (mistakesExport) {
    openMistakeExport();
    return;
  }
  const mistakesImport = e.target.closest("[data-mistake-import]");
  if (mistakesImport) {
    openMistakeImport();
    return;
  }
  const talk = e.target.closest("[data-pet-talk]");
  if (talk) {
    openTalkSheet(); // 💬 說說話：依心情與好感給不同回應
    return;
  }
  const talkChoice = e.target.closest("[data-talk-choice]");
  if (talkChoice) {
    handleTalkChoice(talkChoice.dataset.talkChoice);
    return;
  }
  const storyStart = e.target.closest("[data-story-start]");
  if (storyStart) {
    openStorySheet(); // 📜 主線任務：看劇情／接任務
    return;
  }
  const drill = e.target.closest("[data-drill-subject]");
  if (drill) {
    startMistakeSession(drill.dataset.drillSubject); // 錯題本：直接練這一科的錯題
    return;
  }
  const clearMistakes = e.target.closest("[data-mistake-clear]");
  if (clearMistakes) {
    clearMistakeBook();
    setPetView("academy");
    return;
  }
  const startQuiz = e.target.closest("[data-start-quiz]");
  if (startQuiz) {
    startQuizSession(startQuiz.dataset.startQuiz);
    return;
  }
  const quizOpt = e.target.closest("[data-quiz-opt]");
  if (quizOpt) {
    handleQuizAnswer(quizOpt.dataset.quizOpt);
    return;
  }
  const careBtn = e.target.closest("[data-care]");
  if (careBtn) {
    handleDailyCare(careBtn.dataset.care);
    return;
  }
  const poseCard = e.target.closest("[data-pose-preview]");
  if (poseCard) {
    const stageImg = document.getElementById("poseStageImg"),
      tag = document.getElementById("poseStageTag");
    if (stageImg) stageImg.src = getRoomCatSprite(activePetKey(), poseCard.dataset.posePreview);
    if (tag) tag.textContent = poseCard.dataset.poseLabel || "";
    document.querySelectorAll(".pose-card.active").forEach((b) => b.classList.remove("active"));
    poseCard.classList.add("active");
    return;
  }
  const saveDates = e.target.closest("[data-save-dates]");
  if (saveDates) {
    savePetDates();
    return;
  }
  const clearBirthday = e.target.closest("[data-clear-birthday]");
  if (clearBirthday) {
    clearPetBirthday();
    return;
  }
  const daily = e.target.closest("[data-daily-feed]");
  if (daily) {
    claimDailyFeed();
    return;
  }
  const snapshot = e.target.closest("#roomSnapshotBtn");
  if (snapshot) {
    captureRoomPhoto();
    return;
  }
  const closePhoto = e.target.closest("#btnClosePhoto");
  if (closePhoto) {
    showPetHome();
    return;
  }
  const litterClump = e.target.closest(".room-sand-clump");
  if (litterClump) {
    scoopLitterClump(litterClump);
    return;
  }
  const litterCorner = e.target.closest("#roomLitterCorner");
  if (litterCorner) {
    scoopLitterClump();
    return;
  }
  const roomModeBtn = e.target.closest("[data-room-mode]");
  if (roomModeBtn) {
    setRoomToolMode(roomModeBtn.dataset.roomMode);
    return;
  }
  const lifeEvent = e.target.closest("[data-life-event]");
  if (lifeEvent) {
    handleLifeEvent(lifeEvent.dataset.lifeEvent);
    return;
  }
  const stageTouch = e.target.closest("[data-interact-stage], [data-interact-cat]");
  if (stageTouch && !e.target.closest("button") && !e.target.closest("input")) {
    if (roomToolMode === "wand") {
      triggerWandPlay(e);
    } else if (roomToolMode === "litter") {
      scoopLitterClump();
    } else {
      interactPet("pet");
    }
    return;
  }
  const interact = e.target.closest("[data-interact]");
  if (interact) {
    interactPet(interact.dataset.interact);
    return;
  }
  const rename = e.target.closest("[data-rename]");
  if (rename) {
    renamePet();
    return;
  }
  const feed = e.target.closest("[data-feed]");
  if (feed) {
    feedPet(feed.dataset.feed);
    return;
  }
  const pet = e.target.closest("[data-pet-select]");
  if (pet) {
    selectPet(pet.dataset.petSelect);
    return;
  }
}
for (const el of [$("petView"), $("overlayBody")]) {
  el.addEventListener("change", onPetChange);
  el.addEventListener("click", onPetClick);
}
