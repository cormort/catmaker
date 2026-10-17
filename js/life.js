// life.js — 電子雞式的貓咪生活：隨時間變化的需求、生病與看醫生、在客廳自己走動，以及需要玩家回應的隨機事件
import { audio } from "../audio.js";
import { handleDailyCare } from "./academy.js";
import {
  activePetKey,
  addCoins,
  celebrateChapter,
  checkGrowthUpgrade,
  growthStage,
  petAffection,
  petCoins,
  petData,
  petMoodValue,
  recordStoryEvent,
  petQuickStatusBarHtml,
  petStatus,
  savePetData,
  showPetHome,
  updatePetHeroStats,
} from "./pet.js";
import { addLitterClump, getRoomCatSprite, setRoomCatPose, spawnRoomHeart } from "./room.js";
import { $, escapeHtml, showSheet } from "./ui.js";

// 月曆制之後不再隨真實時間變餓、變髒、生病（時間只在排行程時往前走，見 schedule.js）
export const ILLNESSES = {
  cold: { name: "感冒", icon: "🤧", cure: "pill", desc: "一直打噴嚏、流鼻水，精神不太好。" },
  stomach: { name: "腸胃炎", icon: "🤢", cure: "pill", desc: "肚子太餓又亂吃東西，腸胃不舒服。" },
  hairball: { name: "毛球症", icon: "🤮", cure: "paste", desc: "肚子裡卡了太多毛球，一直想吐。" },
  fever: { name: "發燒", icon: "🤒", cure: "shot", desc: "感冒太久沒治療，燒起來了！需要打針。" },
};
const CURES = {
  pill: { icon: "💊", name: "餵藥", cost: 80 },
  paste: { icon: "🌿", name: "餵化毛膏", cost: 60 },
  shot: { icon: "💉", name: "打針", cost: 150 },
};
const clamp = (v) => Math.max(0, Math.min(100, v));

export function sickInfo(key = activePetKey()) {
  const sick = petStatus(key).sick;
  return sick ? ILLNESSES[sick.id] : null;
}

// 數值變了就重畫小屋頂端的狀態列
function refreshStatusBar() {
  const bar = document.querySelector("#petView .pet-quick-status-bar");
  if (bar) bar.outerHTML = petQuickStatusBarHtml();
}

// ---------- 看醫生 ----------
function befriend(affection, mood) {
  const key = activePetKey(),
    before = growthStage(petAffection(key)).index;
  petData.affection[key] = Math.max(0, (petData.affection[key] || 0) + affection);
  petData.mood[key] = clamp(petMoodValue(key) + mood);
  savePetData();
  checkGrowthUpgrade(key, before);
  updatePetHeroStats(key);
}


let pillPaid = false;
export function showClinic() {
  const ill = sickInfo();
  if (!ill) {
    showSheet("🏥 貓咪診所", "醫生說：健康得很！記得按時吃飯、保持乾淨、別太累喔。", "好的");
    return;
  }
  const cure = CURES[ill.cure];
  showSheet(
    `🏥 貓咪診所・${ill.icon} ${ill.name}`,
    `<div class="clinic-box"><p>${ill.desc}</p><button class="primary" data-life-event="treat">${cure.icon} ${cure.name}（🪙 ${pillPaid && ill.cure !== "shot" ? "已付費" : cure.cost}）</button><small>目前金幣 🪙 ${petCoins()}</small></div>`,
    "先不要",
  );
}

function treat() {
  const ill = sickInfo();
  if (!ill) return;
  const cure = CURES[ill.cure];
  if (!pillPaid) {
    if (petCoins() < cure.cost) {
      showSheet("金幣不足 🪙", `${cure.name}需要 ${cure.cost} 金幣喵！先去學院上課賺錢吧。`, "知道了");
      return;
    }
    addCoins(-cure.cost);
    pillPaid = true;
  }
  // 餵藥有機會被吐出來（不用再付錢，再試一次）；打針一定成功但貓咪會不開心
  if (ill.cure !== "shot" && Math.random() < 0.4) {
    audio.playError();
    navigator.vibrate?.(40);
    showSheet("呸！😾", `${cure.icon} 被吐出來了…再試一次吧！`, "再餵一次", treat, "等一下", () => {});
    return;
  }
  pillPaid = false;
  const s = petStatus(activePetKey());
  s.sick = null;
  if (ill.cure === "paste") s.hairballs = 0;
  savePetData();
  if (ill.cure === "shot") {
    audio.playMeow(0.7);
    befriend(-2, 10);
  } else {
    audio.playMeow(1.15);
    befriend(2, 12);
  }
  showSheet(
    "康復了！🎉",
    ill.cure === "shot" ? "💉 嗚…好痛，但是身體舒服多了！（好感度 -2）" : `${cure.icon} 乖乖吃藥，馬上就有精神了！`,
    "太好了",
    showPetHome,
  );
}

// ---------- 客廳裡的自主行為 ----------
const BEHAVIORS = [
  { id: "walk", weight: 5 },
  { id: "zoomies", weight: 1 },
  { id: "jump", weight: 2 },
  { id: "lick", weight: 3, text: "舔舔腳掌～", fx: "👅" },
  { id: "wash", weight: 2, text: "洗洗臉，變帥了喵", fx: "✨" },
  { id: "stretch", weight: 2, text: "伸～懶～腰～", fx: "💫" },
  { id: "spin", weight: 1, text: "尾巴！別跑！", fx: "🌀" },
  { id: "yawn", weight: 2, text: "哈～啊～🥱", fx: "💤" },
  { id: "nap", weight: 1 },
  { id: "poop", weight: 1 },
];
const ANIM_CLASSES = ["cat-walk", "cat-jump", "cat-lick", "cat-stretch", "cat-spin", "cat-scratch"];
// 自主行為對應的立繪姿勢（有專門圖的就用，沒有的維持 idle + CSS 動畫）
const BEHAVIOR_POSES = {
  walk: "walk",
  poop: "walk",
  zoomies: "run",
  jump: "jump",
  lick: "lick",
  wash: "wash",
  stretch: "stretch",
  spin: "tail",
  yawn: "yawn",
};

function catEl() {
  return document.querySelector(".pet-room-cat-wrap");
}
function catXPercent() {
  const stage = $("petRoomStage"),
    x = parseFloat(catEl()?.style.getPropertyValue("--cat-x")) || 0;
  return stage ? 50 + (x / stage.clientWidth) * 100 : 50;
}
function animate(cls, ms = 900) {
  const el = catEl();
  if (!el) return;
  el.classList.remove(...ANIM_CLASSES);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
function walkTo(px, speed = 1) {
  const el = catEl();
  if (!el) return 900;
  const from = parseFloat(el.style.getPropertyValue("--cat-x")) || 0;
  const ms = (Math.abs(px - from) * 14) / speed + 300;
  el.style.setProperty("--cat-flip", px < from ? "-1" : "1");
  el.style.setProperty("--cat-walk-ms", `${Math.round(ms)}ms`);
  el.style.setProperty("--cat-x", `${px}px`);
  animate("cat-walk", ms);
  return ms;
}
function randomSpot() {
  const w = $("petRoomStage")?.clientWidth || 320,
    range = Math.max(0, w / 2 - 95);
  return Math.round((Math.random() * 2 - 1) * range);
}
function say(text) {
  const speech = $("petSpeech");
  if (!speech) return;
  speech.textContent = text;
  speech.classList.remove("show");
  void speech.offsetWidth;
  speech.classList.add("show");
}

function doBehavior() {
  const s = petStatus(activePetKey());
  if (s.sick) {
    // 生病時大多趴著，偶爾打噴嚏
    const ill = sickInfo();
    setRoomCatPose("sleep", null, "pet-sleep");
    if (Math.random() < 0.5) {
      spawnRoomHeart(catXPercent(), 55, ill.icon);
      say(ill.id === "cold" || ill.id === "fever" ? "哈啾！" : "嗚…不舒服…");
    }
    return;
  }
  const tired = s.energy < 25 || s.fatigue > 80;
  const pool = BEHAVIORS.map((b) => ({ ...b, weight: b.id === "nap" && tired ? 8 : b.weight }));
  let r = Math.random() * pool.reduce((t, b) => t + b.weight, 0),
    b = pool[0];
  for (b of pool) if ((r -= b.weight) < 0) break;
  if (b.id !== "nap") setRoomCatPose(BEHAVIOR_POSES[b.id] || "idle", null, "");
  switch (b.id) {
    case "walk": {
      const ms = walkTo(randomSpot());
      setRoomCatPose("walk", null, "", ms + 400);
      break;
    }
    case "zoomies": {
      say("暴衝時間！💨");
      walkTo(randomSpot(), 3);
      setRoomCatPose("run", null, "", 1500);
      setTimeout(() => walkTo(randomSpot(), 3), 700);
      break;
    }
    case "jump":
      animate("cat-jump", 800);
      if (petData.roomFurniture?.cattree) {
        say("跳上貓跳台！");
        walkTo(-Math.round(($("petRoomStage")?.clientWidth || 320) / 2 - 95));
      }
      break;
    case "nap":
      setRoomCatPose("sleep", "呼嚕…呼嚕…", "pet-sleep");
      spawnRoomHeart(catXPercent(), 60, "💤");
      break;
    case "poop":
      say("去一下廁所…");
      walkTo(Math.round(($("petRoomStage")?.clientWidth || 320) / 2 - 95));
      setTimeout(addLitterClump, 2200);
      break;
    default:
      animate(`cat-${b.id === "wash" ? "lick" : b.id === "yawn" ? "stretch" : b.id}`, 1100);
      say(b.text);
      spawnRoomHeart(catXPercent(), 55, b.fx);
  }
}

// ---------- 需要玩家回應的隨機事件 ----------
// 每個事件：出現在客廳的按鈕（emoji、提示文字、位置），點了做什麼，沒點會怎樣
const EVENTS = {
  gift: {
    icon: "🐭",
    label: "叼來禮物",
    weight: 2,
    pos: () => [catXPercent() + 12, 18],
    start: () => {
      setRoomCatPose("walk", null, "", 3200);
      say("送你的禮物喵！");
    },
    tap: () => {
      const coins = 10 + Math.floor(Math.random() * 21);
      addCoins(coins);
      audio.playCoin();
      befriend(2, 4);
      say(`收到禮物！🪙 +${coins}`);
    },
  },
  cuddle: {
    icon: "🥺",
    label: "討摸摸",
    weight: 3,
    pos: () => [catXPercent(), 72],
    start: () => say("摸摸我嘛～"),
    tap: () => {
      audio.startPurr();
      setTimeout(() => audio.stopPurr(), 1600);
      setRoomCatPose("pet", "呼嚕呼嚕～最喜歡你了", "pet-bounce");
      befriend(4, 6);
      spawnRoomHeart(catXPercent(), 60, "💕");
    },
    miss: () => say("哼，不理你了…"),
  },
  scratch: {
    when: () => !recently("nailsAt", 7 * DAY), // 剪過指甲一週內不太會抓
    icon: "🙅",
    label: "在抓地毯！制止",
    weight: 2,
    pos: () => [catXPercent(), 72],
    start: () => {
      setRoomCatPose("scratch", null, "");
      animate("cat-scratch", 6000);
      say("磨爪爪～嘿嘿");
    },
    tap: () => {
      catEl()?.classList.remove("cat-scratch");
      setRoomCatPose("idle", null, "");
      say("好啦不抓了…😿");
      befriend(1, -1);
    },
    miss: () => {
      petStatus(activePetKey()).cleanliness = clamp(petStatus(activePetKey()).cleanliness - 5);
      savePetData();
      say("地毯抓花了，好舒服～（清潔 -5）");
    },
  },
  hairball: {
    icon: "🟤",
    label: "吐毛球了，清掉",
    weight: 2,
    pos: () => [catXPercent() + 14, 12],
    start: () => {
      setRoomCatPose("play", "嘔…嘔…噗！", "pet-wiggle");
      const s = petStatus(activePetKey());
      s.hairballs = (s.hairballs || 0) + 1;
      savePetData();
    },
    tap: () => {
      audio.playSand();
      const s = petStatus(activePetKey());
      s.cleanliness = clamp(s.cleanliness + 5);
      savePetData();
      befriend(1, 2);
      say("謝謝鏟屎官～（毛球太多會生病喔）");
    },
    miss: () => say("毛球還在地上…"),
  },
  wantBrush: {
    icon: "🪮",
    label: "掉毛了，幫我梳",
    weight: 2,
    when: () => (petStatus(activePetKey()).hairballs || 0) > 0,
    pos: () => [catXPercent() - 14, 30],
    start: () => say("身上好癢…想梳毛喵"),
    tap: () => startCare("brush"),
  },
  muddy: {
    icon: "🪴",
    label: "滾得髒兮兮，洗澡",
    weight: 1,
    pos: () => [catXPercent() + 14, 30],
    start: () => {
      const s = petStatus(activePetKey());
      s.cleanliness = clamp(s.cleanliness - 15);
      savePetData();
      setRoomCatPose("tail", null, "", 1200);
      animate("cat-spin", 1100);
      say("在盆栽裡打滾～好好玩！（清潔 -15）");
    },
    tap: () => startCare("bath"),
    miss: () => say("沾著土到處走…"),
  },
  hungry: {
    icon: "🍽️",
    label: "肚子餓，餵飯",
    weight: 0, // 只在飽食度低時出現
    pos: () => [catXPercent() - 14, 30],
    start: () => {
      audio.playMeow(1.3);
      say("飯飯！飯飯！喵～");
    },
    tap: () => handleDailyCare("feed"),
  },
  butterfly: {
    icon: "🦋",
    label: "窗外有蝴蝶",
    weight: 2,
    pos: () => [20 + Math.random() * 60, 82],
    start: () => say("咔咔咔咔…（盯）"),
    tap: () => {
      walkTo(randomSpot(), 2);
      setRoomCatPose("jump", null, "", 1300);
      animate("cat-jump", 800);
      say("飛撲！差一點就抓到了！");
      befriend(1, 5);
    },
  },
};
const EVENT_MS = 8000;
let activeEvent = null;

function startEvent() {
  const s = petStatus(activePetKey());
  const ids = Object.keys(EVENTS).filter((id) => EVENTS[id].weight > 0 && (EVENTS[id].when?.() ?? true));
  const id =
    s.hunger < 35 && Math.random() < 0.6
      ? "hungry"
      : ids[Math.floor(Math.random() * ids.length)];
  const ev = EVENTS[id],
    [x, y] = ev.pos();
  const btn = document.createElement("button");
  btn.className = "room-event";
  btn.dataset.lifeEvent = `ev:${id}`;
  btn.style.left = `${Math.max(8, Math.min(92, x))}%`;
  btn.style.bottom = `${y}%`;
  btn.innerHTML = `<span>${ev.icon}</span><small>${ev.label}</small>`;
  $("petRoomStage").append(btn);
  ev.start();
  activeEvent = {
    id,
    btn,
    timer: setTimeout(() => {
      btn.remove();
      activeEvent = null;
      ev.miss?.();
      refreshStatusBar();
    }, EVENT_MS),
  };
}

// pet.js 的點擊委派會把 [data-life-event] 交給這裡
export function handleLifeEvent(action) {
  if (action === "clinic") return showClinic();
  if (action === "treat") return treat();
  if (action.startsWith("care:")) return startCare(action.slice(5));
  if (!action.startsWith("ev:") || !activeEvent) return;
  clearTimeout(activeEvent.timer);
  activeEvent.btn.remove();
  const ev = EVENTS[activeEvent.id];
  activeEvent = null;
  navigator.vibrate?.(15);
  ev.tap();
  refreshStatusBar();
}

// 生病時在客廳顯示「看醫生」按鈕
function syncSickBadge() {
  const stage = $("petRoomStage");
  if (!stage) return;
  const ill = sickInfo(),
    badge = $("roomSickBadge");
  if (!ill) return badge?.remove();
  if (badge) return;
  stage.insertAdjacentHTML(
    "beforeend",
    `<button class="room-sick-badge" id="roomSickBadge" data-life-event="clinic">${ill.icon} ${escapeHtml(ill.name)}・🏥 看醫生</button>`,
  );
}

// ---------- 照護小遊戲：梳毛、洗澡、剪指甲 ----------
// 放大貓咪，身上的部位會輪流亮起，要在它消失前點到；每個階段有倒數計時，時間到還沒點滿就失敗。
// 越點越快（目標存活時間從 life[0] 縮到 life[1]）；每次成功照護等級 +1，倒數時間跟著變短（最多 Lv.5）。
const DAY = 24 * 3600 * 1000;
function recently(field, ms) {
  return Date.now() - (petStatus(activePetKey())[field] || 0) < ms;
}
// 部位座標：貓咪圖片的百分比位置（各品種坐姿略不同，取大致位置）
const PARTS = {
  head: [50, 16, "頭頂"],
  earL: [30, 9, "左耳"],
  earR: [71, 9, "右耳"],
  cheek: [40, 40, "臉頰"],
  chin: [55, 50, "下巴"],
  chest: [53, 63, "胸口"],
  back: [33, 66, "背"],
  waist: [62, 80, "腰"],
  tail: [80, 86, "尾巴"],
};
const BODY = ["head", "cheek", "chin", "chest", "back", "waist", "tail"];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const say1 = (arr) => arr[Math.floor(Math.random() * arr.length)];
// 從清單裡隨機挑 n 個（不重複）
function pickN(list, n) {
  const pool = [...list],
    out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
// 描／擦的方向：每個目標隨機，玩家要順著箭頭拖
const DIRS = ["down", "up", "left", "right"];
const CARES = {
  brush: {
    title: "🪮 梳毛",
    // 每場隨機挑 3 個部位、梳的方向也隨機；偶爾出現要梳兩下的毛球
    makePhases: () => {
      const zones = pickN(BODY, 3),
        goal = rand(5, 6);
      return [
        {
          label: `順著箭頭，從${zones.map((z) => PARTS[z][2]).join("、")}梳下去`,
          parts: zones,
          mode: "stroke",
          bonus: true,
          icon: "🪮",
          fx: "✨",
          goal,
          time: goal * 3, // 描一次要拖一段距離，比連點慢，時間給寬一點
          life: [3000, 1900],
          flinch: 0,
        },
      ];
    },
    start: () => say1(["呼嚕～要梳毛了嗎", "今天想梳哪裡喵？", "來吧，輕輕梳就好～"]),
    finish: (s) => {
      const annoyed = recently("brushedAt", 2 * 3600 * 1000);
      s.brushedAt = Date.now();
      s.hairballs = Math.max(0, (s.hairballs || 0) - 1);
      s.cleanliness = clamp(s.cleanliness + 10);
      if (annoyed) {
        befriend(0, -3);
        return "梳太多次了啦！😾（清潔 +10）";
      }
      audio.startPurr();
      setTimeout(() => audio.stopPurr(), 1800);
      befriend(3, 6);
      return `${say1(["毛毛蓬鬆又柔順～", "梳完像換了一隻貓！", "呼嚕嚕～舒服吧"])}（清潔 +10、毛球 -1）`;
    },
    abort: () => "梳到一半跑掉了…",
  },
  bath: {
    title: "🛁 洗澡",
    // 三段玩法都不同：搓泡泡＝連點、沖水＝按住沖、吹乾＝順箭頭擦，部位每場隨機
    makePhases: () => {
      const scrub = pickN(BODY, rand(3, 4)),
        rinse = pickN(BODY, 3),
        dry = pickN([...BODY, "earL", "earR"], 3);
      return [
        {
          label: "搓泡泡！連點亮起來的地方把泡泡搓開",
          parts: scrub,
          mode: "tap",
          icon: "🧽",
          fx: "🫧",
          goal: scrub.length,
          time: scrub.length * 3.2,
          life: [1700, 1100],
          flinch: 0.12,
        },
        {
          label: "沖水！按住亮起來的地方，沖到乾淨",
          parts: rinse,
          mode: "hold",
          hold: 700,
          icon: "🚿",
          fx: "💧",
          goal: rinse.length,
          time: rinse.length * 4.6,
          life: [2400, 1800],
          flinch: 0.15,
        },
        {
          label: "吹乾！順著箭頭把毛擦乾",
          parts: dry,
          mode: "stroke",
          icon: "💨",
          fx: "💨",
          goal: dry.length,
          time: dry.length * 4.2,
          life: [2600, 1900],
          flinch: 0,
        },
      ];
    },
    start: () => say1(["咦？水？！不要啊喵——", "又要洗澡？說好只沖一下喔…", "泡泡的味道好奇怪喵"]),
    finish: (s) => {
      const again = recently("bathedAt", 3 * DAY);
      s.bathedAt = Date.now();
      s.cleanliness = 100;
      befriend(2, again ? -15 : -6);
      animate("cat-spin", 1100);
      if (again) return "又洗澡！？三天內洗太多次了…😿（清潔 100%）";
      return `${say1(["抖抖抖～香噴噴的！", "沖完泡泡香香的～", "洗完毛超軟！"])}（清潔 100%）`;
    },
    abort: (s) => {
      s.cleanliness = clamp(s.cleanliness + 20);
      befriend(0, -8);
      return "濕答答地逃走了！🙀（清潔 +20）";
    },
  },
  nails: {
    title: "✂️ 剪指甲",
    // 放大鏡：一次放大一隻腳，剪完 3 個爪尖鏡頭移到下一隻腳
    phases: [
      {
        label: "放大鏡對準貓掌，點亮起來的爪尖喀擦！（會縮手）",
        loupe: { zoom: 3.2, claws: [[-13, 12], [0, 16], [13, 12]] }, // 腳掌位置見 BREED_PAWS
        icon: "✂️",
        fx: "✨",
        goal: 12, // 4 隻腳 × 3 爪；看得到的腳較少的品種，目標數與時間等比例減少
        time: 16,
        life: [1300, 700],
        flinch: 0.3,
      },
    ],
    refuse: () => (recently("nailsAt", 7 * DAY) ? "指甲還很短喵，一週後再剪吧" : null),
    start: () => "剪指甲…要輕輕的喔",
    finish: (s) => {
      s.nailsAt = Date.now();
      befriend(2, -2);
      return "剪好了！這週比較不會亂抓了✨";
    },
    abort: () => {
      befriend(0, -4);
      return "掙脫了，剩下的下次再剪…";
    },
  },
};
const MAX_CARE_LV = 5;
// 照護完成後要顯示的姿勢立繪
const CARE_POSES = { brush: "lick", bath: "wash", nails: "lick" };
const careLevel = (id) => petData.careLevels?.[id] || 1;
let care = null;

export function startCare(id) {
  const cfg = CARES[id];
  if (!cfg || care || !$("petRoomStage")) return;
  if (sickInfo()) return say("不舒服…先帶我去看醫生嘛");
  const refuse = cfg.refuse?.();
  if (refuse) return say(refuse);
  if (activeEvent) {
    clearTimeout(activeEvent.timer);
    activeEvent.btn.remove();
    activeEvent = null;
  }
  const lv = careLevel(id),
    sprite = getRoomCatSprite(activePetKey(), "idle"),
    el = document.createElement("div");
  el.className = "care-overlay";
  el.innerHTML = `<div class="care-card"><div class="care-head"><b>${cfg.title}</b><small class="care-lv">Lv.${lv}</small><small class="care-phase"></small><button class="care-stop">結束</button></div><div class="care-label"></div><div class="care-meta"><b class="care-count"></b><div class="care-timer"><i></i></div><span class="care-sec"></span></div><div class="care-cat"><div class="care-lens"><img src="${sprite}" alt=""></div><div class="care-minimap"><img src="${sprite}" alt=""><i></i></div><span class="care-say"></span></div></div>`;
  document.body.append(el);
  el.querySelector(".care-stop").onclick = () => endCare(false);
  const cat = el.querySelector(".care-cat");
  cat.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".care-target");
    if (!t) return;
    e.preventDefault();
    beginTarget(e, t);
  });
  // 描／擦：拖到指定方向就完成；按住：時間到才完成。中途放開＝取消，目標壽命重新計算
  cat.addEventListener("pointermove", (e) => {
    const a = care?.acting;
    if (!a || a.done || a.mode !== "stroke") return;
    const dx = e.clientX - a.x0,
      dy = e.clientY - a.y0,
      need = 26;
    const ok =
      a.dir === "down" ? dy >= need : a.dir === "up" ? dy <= -need : a.dir === "right" ? dx >= need : dx <= -need;
    if (ok) {
      a.done = true;
      completeTarget(a.t);
    }
  });
  const release = () =>
    cancelActing(care?.acting?.mode === "stroke" ? "順著箭頭拖～" : "要按住喔～");
  cat.addEventListener("pointerup", release);
  cat.addEventListener("pointercancel", release);
  cat.addEventListener("pointerleave", release);
  care = {
    id,
    cfg,
    el,
    lv,
    phase: -1,
    timers: new Set(),
    breed: sprite.match(/room\/(\w+)_/)?.[1],
    phases: cfg.makePhases ? cfg.makePhases() : cfg.phases,
    acting: null,
  };
  careSay(cfg.start());
  nextPhase();
}

function careSay(text) {
  const b = care?.el.querySelector(".care-say");
  if (!b) return;
  b.textContent = text;
  b.classList.remove("show");
  void b.offsetWidth;
  b.classList.add("show");
}
function careLater(fn, ms) {
  const t = setTimeout(() => {
    care?.timers.delete(t);
    fn();
  }, ms);
  care.timers.add(t);
  return t;
}
function nextPhase() {
  const c = care;
  c.phase++;
  if (c.phase >= c.phases.length) return endCare(true);
  const p = c.phases[c.phase];
  c.hits = 0;
  c.goal = p.loupe ? (BREED_PAWS[c.breed] || BREED_PAWS.cat).paws.length * p.loupe.claws.length : p.goal;
  c.total = p.time * (c.goal / p.goal) * 1000 * (1 - (c.lv - 1) * 0.08); // 等級越高倒數越短
  c.deadline = performance.now() + c.total;
  c.el.querySelector(".care-label").textContent = p.label;
  c.el.querySelector(".care-phase").textContent = c.phases.length > 1 ? `${c.phase + 1}／${c.phases.length}` : "";
  c.el.querySelectorAll(".care-target").forEach((t) => t.remove());
  c.el.querySelector(".care-cat").classList.toggle("loupe", !!p.loupe);
  if (p.loupe) {
    c.paw = 0;
    c.clawsLeft = p.loupe.claws.map((_, i) => String(i));
    aimLoupe(true); // 一打開就對準，不要從左上角滑過來
  }
  updateCareHud();
  clearInterval(c.clock);
  c.clock = setInterval(() => {
    if (updateCareHud() <= 0) endCare(false);
  }, 100);
  spawnTarget();
}
function updateCareHud() {
  const c = care,
    p = c.phases[c.phase],
    left = Math.max(0, c.deadline - performance.now());
  c.el.querySelector(".care-count").textContent = `${c.hits}／${c.goal}`;
  c.el.querySelector(".care-sec").textContent = `${(left / 1000).toFixed(1)}s`;
  const bar = c.el.querySelector(".care-timer i");
  bar.style.width = `${(left / c.total) * 100}%`;
  bar.classList.toggle("hurry", left < 3000);
  return left;
}
// 放大鏡要精準對到腳掌：各品種立繪坐姿與比例不同，看得到的腳掌也不同，分別量測
// paws：[名稱, x%, y%]（爪尖所在位置，圖片寬高的百分比）；ratio＝圖片高/寬
const BREED_PAWS = {
  cat: { ratio: 401 / 318, paws: [["左後腳", 24, 93], ["左前腳", 37, 94], ["右前腳", 54, 94], ["右後腳", 66, 93]] },
  black: { ratio: 432 / 345, paws: [["左前腳", 45, 93], ["右前腳", 60, 93], ["右後腳", 73, 92]] },
  calico: { ratio: 405 / 400, paws: [["左後腳", 23, 93], ["左前腳", 33, 94], ["右前腳", 42, 94], ["右後腳", 53, 94]] },
  orange: { ratio: 445 / 350, paws: [["左前腳", 60, 94], ["右前腳", 72, 92]] }, // 後腳藏在身體下
};
// 放大鏡對準目前這隻腳：圖片放大 zoom 倍，讓腳掌落在鏡片（正方形）正中央；左上小地圖標出位置
function aimLoupe(instant = false) {
  const c = care,
    { zoom } = c.phases[c.phase].loupe,
    breed = BREED_PAWS[c.breed] || BREED_PAWS.cat,
    [, x, toeY] = breed.paws[c.paw],
    y = toeY - 3, // 鏡頭略高於爪尖，讓整隻腳掌落在鏡片中央（爪尖目標再往下偏移）
    img = c.el.querySelector(".care-lens img");
  img.style.transition = instant ? "none" : "";
  Object.assign(img.style, {
    width: `${zoom * 100}%`,
    height: `${zoom * 100 * breed.ratio}%`,
    left: `${50 - x * zoom}%`,
    top: `${50 - y * zoom * breed.ratio}%`,
  });
  c.el.querySelector(".care-minimap").style.aspectRatio = `1 / ${breed.ratio}`;
  Object.assign(c.el.querySelector(".care-minimap i").style, { left: `${x}%`, top: `${y}%` });
}
// 亮起一個部位（放大鏡模式是這隻腳還沒剪的爪尖）；存活時間隨進度縮短；沒點到就扣時間
function armLife(t, life) {
  t.expire = careLater(() => {
    if (!t.isConnected) return;
    const c = care;
    if (c.acting?.t === t) c.acting = null;
    t.remove();
    c.deadline -= 600;
    careSay(say1(["慢吞吞的～", "這邊啦！", "喵？"]));
    spawnTarget(t.dataset.part);
  }, life);
}
function spawnTarget(avoid) {
  const c = care,
    p = c.phases[c.phase],
    mode = p.mode || "tap",
    life = Math.round(p.life[0] - (p.life[0] - p.life[1]) * (c.hits / c.goal));
  let key, x, y, name;
  if (p.loupe) {
    const others = c.clawsLeft.filter((k) => k !== avoid),
      pool = others.length ? others : c.clawsLeft;
    key = pool[Math.floor(Math.random() * pool.length)];
    const [dx, dy] = p.loupe.claws[key];
    [x, y, name] = [50 + dx, 50 + dy, ""];
  } else {
    const choices = p.parts.filter((k) => k !== avoid);
    key = choices[Math.floor(Math.random() * choices.length)];
    [x, y, name] = PARTS[key];
  }
  const t = document.createElement("button");
  t.className = `care-target${mode === "tap" ? "" : ` ${mode}`}`;
  t.dataset.part = key;
  t.dataset.mode = mode;
  t.style.cssText = `left:${x}%;top:${y}%;--life:${life}ms`;
  if (mode === "stroke") {
    const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    t.dataset.dir = dir;
    // 偶爾混進一顆毛球：要梳兩下、算兩點
    if (p.bonus && !c.bonusDone && Math.random() < 0.4) {
      c.bonusDone = true;
      t.dataset.bonus = "1";
      t.innerHTML = `<span>🟤</span><i class="dir ${dir}"></i><small>毛球</small>`;
    } else {
      t.innerHTML = `<span>${p.icon}</span><i class="dir ${dir}"></i><small>${name}</small>`;
    }
  } else if (mode === "hold") {
    t.style.setProperty("--hold", `${p.hold}ms`);
    t.innerHTML = `<span>${p.icon}</span><i class="ring"></i><small>${name}</small>`;
  } else {
    t.innerHTML = `<span>${p.icon}</span><small>${name}</small>`;
  }
  c.el.querySelector(".care-cat").append(t);
  armLife(t, life);
}
// 貓咪掙扎：這下不算，換個位置
function flinchAway(t) {
  const c = care;
  clearTimeout(t.expire);
  c.timers.delete(t.expire);
  t.remove();
  audio.playMeow(1.4);
  navigator.vibrate?.(30);
  careSay(say1(["喵嗚！不要！", "嘶——", "放開我喵！"]));
  const lens = c.el.querySelector(".care-lens");
  lens.classList.remove("flinch");
  void lens.offsetWidth;
  lens.classList.add("flinch");
  spawnTarget(t.dataset.part);
}
// 完成一次（點到／按滿／描對方向）
function completeTarget(t) {
  const c = care,
    p = c.phases[c.phase];
  if (c.acting) {
    clearTimeout(c.holdTimer);
    c.timers.delete(c.holdTimer);
    c.acting = null;
  }
  clearTimeout(t.expire);
  c.timers.delete(t.expire);
  t.remove();
  c.hits += t.dataset.bonus === "1" ? 2 : 1;
  navigator.vibrate?.(8);
  const fx = document.createElement("span");
  fx.className = "care-fx";
  fx.textContent = t.dataset.bonus === "1" ? "🟤" : p.fx;
  fx.style.cssText = t.style.cssText;
  c.el.querySelector(".care-cat").append(fx);
  setTimeout(() => fx.remove(), 700);
  updateCareHud();
  if (c.hits >= c.goal) return nextPhase();
  if (p.loupe) {
    c.clawsLeft = c.clawsLeft.filter((k) => k !== t.dataset.part);
    if (!c.clawsLeft.length) {
      // 這隻腳剪完了：鏡頭移到下一隻腳，等移動動畫結束再亮爪尖
      const paws = (BREED_PAWS[c.breed] || BREED_PAWS.cat).paws;
      c.paw = (c.paw + 1) % paws.length;
      c.clawsLeft = p.loupe.claws.map((_, i) => String(i));
      aimLoupe();
      careSay(`換${paws[c.paw][0]}～`);
      return careLater(spawnTarget, 450);
    }
  }
  spawnTarget(t.dataset.part);
}
// 按下去：tap 直接算完成；hold 要按滿、stroke 要拖對方向 —— 先暫停壽命，讓玩家有時間完成動作
function beginTarget(e, t) {
  const c = care,
    p = c.phases[c.phase],
    mode = t.dataset.mode || "tap";
  if (Math.random() < p.flinch) return flinchAway(t);
  if (mode === "tap") return completeTarget(t);
  clearTimeout(t.expire);
  c.timers.delete(t.expire);
  try {
    t.setPointerCapture?.(e.pointerId);
  } catch {}
  c.acting = { t, mode, x0: e.clientX, y0: e.clientY, dir: t.dataset.dir, done: false };
  t.classList.add("acting");
  if (mode === "hold") c.holdTimer = careLater(() => completeTarget(t), p.hold);
}
// 中途放開：不算數，目標重新計時（比原本短一點）
function cancelActing(hint) {
  const c = care;
  if (!c?.acting || c.acting.done) return;
  const t = c.acting.t;
  c.acting = null;
  clearTimeout(c.holdTimer);
  c.timers.delete(c.holdTimer);
  t.classList.remove("acting");
  if (t.isConnected) armLife(t, Math.round(c.phases[c.phase].life[0] * 0.9));
  if (hint) careSay(hint);
}
function endCare(done) {
  const c = care;
  if (!c) return;
  care = null;
  clearInterval(c.clock);
  c.timers.forEach(clearTimeout);
  const s = petStatus(activePetKey()),
    msg = done ? c.cfg.finish(s) : c.cfg.abort(s);
  if (done) {
    petData.careLevels = { ...petData.careLevels, [c.id]: Math.min(MAX_CARE_LV, c.lv + 1) };
    audio.playVictory();
    // 主線任務：照顧貓咪的次數
    try {
      const { completed } = recordStoryEvent("care", 1);
      if (completed) celebrateChapter(completed);
    } catch {
      /* 劇情系統不影響照護流程 */
    }
  }
  savePetData();
  // 在放大畫面上顯示結果，稍等再關，避免最後一下點擊穿透到客廳
  c.el.querySelectorAll(".care-target").forEach((t) => t.remove());
  c.el.querySelector(".care-label").textContent = done
    ? `完成！${c.lv < MAX_CARE_LV ? `下次 Lv.${c.lv + 1}，時間更短` : "已經是最高難度"}`
    : "時間到／放棄了…";
  c.el.classList.add(done ? "done" : "failed");
  setTimeout(() => c.el.remove(), 1100);
  say(msg);
  // 照護完成後換上對應姿勢：梳毛／剪指甲＝舔毛理毛，洗澡＝洗臉
  if (done) setRoomCatPose(CARE_POSES[c.id] || "pet", null, "", 2800);
  refreshStatusBar();
}

// ---------- 主迴圈 ----------
const TICK_MS = 7000;
function tick() {
  const stage = $("petRoomStage");
  if (!stage || document.hidden || $("homeScreen")?.hidden) return;
  syncSickBadge();
  if (activeEvent && !stage.contains(activeEvent.btn)) {
    clearTimeout(activeEvent.timer); // 小屋重繪過，事件按鈕已不在畫面上
    activeEvent = null;
  }
  if (care) return; // 照護中不亂跑
  if (!activeEvent && !petStatus(activePetKey()).sick && Math.random() < 0.2) startEvent();
  else doBehavior();
}
export function startLife() {
  setInterval(tick, TICK_MS);
}
