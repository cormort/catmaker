// trip.js — 出遊地點與相簿：行程排「休息・出遊」時（schedule.js）拍一張相片（場景底圖 + 該品種立繪合成）收進相簿
import { audio } from "../audio.js";
import { activePetKey, checkGrowthUpgrade, growthStage, petAffection, petData, petName, petSubnavHtml, savePetData } from "./pet.js";
import { getRoomCatSprite } from "./room.js";
import { escapeHtml, localDay } from "./ui.js";
const HOUR = 3600e3;
export const MAX_ALBUM = 30;
// cost＝金幣；energy＝消耗體力；clean＝清潔度增減；photoPose＝相片裡要用哪個姿勢立繪
export const TRIPS = [
  {
    id: "park",
    name: "公園散步",
    icon: "🌳",
    scene: "park",
    cost: 0,
    energy: 15,
    clean: -8,
    aff: 3,
    mood: 6,
    cool: 1 * HOUR,
    photoPose: "walk",
    lines: ["沿著池塘走了一圈，追了兩隻蝴蝶。", "在草皮上曬太陽，翻肚肚打滾。", "遇到別的貓，隔著欄杆互看很久。"],
  },
  {
    id: "cafe",
    name: "咖啡廳",
    icon: "☕",
    scene: "cafe",
    cost: 60,
    energy: 15,
    clean: -4,
    aff: 6,
    mood: 8,
    cool: 2 * HOUR,
    photoPose: "idle",
    lines: ["蹲在窗邊看路人，被說很可愛。", "偷舔了一口鮮奶油（不可以喔）。", "在沙發上睡著，醒來發現被蓋了小毯子。"],
  },
  {
    id: "shopping",
    name: "逛街購物",
    icon: "🛍️",
    scene: "street",
    cost: 90,
    energy: 20,
    clean: -6,
    aff: 8,
    mood: 10,
    cool: 2.5 * HOUR,
    photoPose: "walk",
    lines: ["買了一條新項圈，走路有風。", "在寵物店門口跟店貓對峙了三秒。", "提著紙袋回家，袋子比貓還大。"],
  },
  {
    id: "movie",
    name: "看電影",
    icon: "🎬",
    scene: "cinema",
    cost: 120,
    energy: 20,
    clean: -4,
    aff: 10,
    mood: 12,
    cool: 3 * HOUR,
    photoPose: "eat",
    lines: ["爆米花吃光光，一粒都沒留給我。", "演到感人處，悄悄靠過來蹭手。", "看到一半在腿上睡著，劇情應該是錯過了。"],
  },
  {
    id: "beach",
    name: "海邊玩水",
    icon: "🏖️",
    scene: "beach",
    cost: 180,
    energy: 30,
    clean: -18,
    aff: 13,
    mood: 15,
    cool: 6 * HOUR,
    photoPose: "run",
    lines: ["追浪花追了半小時，全身都是沙。", "撿到一顆貝殼，堅持要帶回家。", "被浪嚇到彈起來，尾巴整根炸開。"],
  },
  {
    id: "onsen",
    name: "溫泉旅行",
    icon: "♨️",
    scene: "onsen",
    cost: 260,
    energy: 25,
    clean: 10,
    aff: 16,
    mood: 18,
    cool: 8 * HOUR,
    photoPose: "sleep",
    lines: ["泡到耳朵紅紅，瞇著眼呼嚕。", "在浴衣上滾來滾去，不肯起來。", "旅館晚餐一口氣吃完，還想再來一盤。"],
  },
];
const tripById = (id) => TRIPS.find((t) => t.id === id);
function tripLog(key = activePetKey()) {
  petData.trips = petData.trips || {};
  petData.trips[key] = petData.trips[key] || {};
  return petData.trips[key];
}
export function tripAlbum() {
  petData.album = petData.album || [];
  return petData.album;
}
function photoHtml(p, i = 0) {
  const t = tripById(p.id);
  if (!t) return "";
  return `<figure class="trip-photo" style="--scene:url(./icons/scenes/${t.scene}.webp);--tilt:${(((i % 3) - 1) * 0.7).toFixed(1)}deg">
    <div class="trip-shot"><img class="trip-cat" src="${getRoomCatSprite(p.key, t.photoPose)}" alt="${escapeHtml(p.catName || "")}" onerror="this.onerror=null;this.src=this.src.replace('.webp','.png')"></div>
    <figcaption><b>${t.icon} ${t.name}</b><small>${escapeHtml(p.caption)}</small><em>${escapeHtml(p.catName || "")}・${escapeHtml(p.day || "")}</em></figcaption>
  </figure>`;
}
// 行程裡的出遊：只拍照收進相簿、貓咪好感 +（不檢查體力與冷卻，花費與壓力由 schedule.js 處理）
export function tripPhoto(id, key = activePetKey(), day = localDay()) {
  const t = tripById(id);
  if (!t) return "";
  const name = petName(key),
    beforeStage = growthStage(petAffection(key)).index;
  petData.affection[key] = Math.max(0, petAffection(key) + t.aff);
  checkGrowthUpgrade(key, beforeStage);
  const log = tripLog(key);
  log[id] = { count: (log[id]?.count || 0) + 1, lastAt: Date.now() };
  const caption = t.lines[Math.floor(Math.random() * t.lines.length)];
  const entry = { id, key, caption, catName: name, at: Date.now(), day };
  const album = tripAlbum();
  album.push(entry);
  if (album.length > MAX_ALBUM) album.splice(0, album.length - MAX_ALBUM);
  savePetData();
  audio.playShutter();
  return `<div class="trip-result">${photoHtml(entry)}</div><p class="trip-result-line">${escapeHtml(caption)}</p><p class="trip-result-gain">💕 ${escapeHtml(name)} 好感 +${t.aff}</p>`;
}
export function tripPageHtml(key = activePetKey()) {
  const log = tripLog(key),
    album = tripAlbum(),
    done = TRIPS.reduce((n, t) => n + (log[t.id]?.count || 0), 0);
  const photos = album.length
    ? album
        .slice()
        .reverse()
        .map((p, i) => photoHtml(p, i))
        .join("")
    : `<p class="trip-empty">相簿還是空的，帶 ${escapeHtml(petName(key))} 出門走走吧！</p>`;
  return `${petSubnavHtml("trip")}<div class="trip-panel">
    <div class="trip-hero"><b>📸 相簿</b><small>出遊改成在「📅 排行程」裡安排（休息・出遊），每次都會拍一張・已出遊 ${done} 次</small></div>
    <div class="trip-album-title"><span>📸 相簿 ${album.length} 張</span><small>每次出門都會拍一張</small></div>
    <div class="trip-album">${photos}</div>
  </div>`;
}
