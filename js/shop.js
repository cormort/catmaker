// shop.js — 貓咪生活館（商品、裝修）與扭蛋機
import { audio } from "../audio.js";
import { activePetKey, addCoins, animatePet, earnedTitles, equipCostume, petCoins, petData, petQuickStatusBarHtml, petStatus, petSubnavHtml, savePetData, setPetView, showPetHome, updatePetStatus } from "./pet.js";
import { $, escapeHtml, showSheet } from "./ui.js";
const SHOP_ITEMS = [
  {
    id: "premium_snack",
    cat: "goods",
    name: "特級營養罐頭",
    icon: "🥫",
    thumb: "./icons/room/litter_box.webp",
    cost: 100,
    desc: "極致鮮美！飽食度 +60，體力 +30",
    effect: (key) => {
      updatePetStatus(key, { hunger: 60, energy: 30 });
      petData.food.premium = (petData.food.premium || 0) + 1;
    },
  },
  {
    id: "catnip_spray",
    cat: "goods",
    name: "天然特級貓薄荷",
    icon: "🌿",
    thumb: "./icons/room/teaser_wand.webp",
    cost: 120,
    desc: "舒緩身心！疲勞度瞬間歸零，心情滿分",
    effect: (key) => {
      const s = petStatus(key);
      s.fatigue = 0;
      savePetData();
      animatePet("pet-wiggle", "貓薄荷太嗨了喵～！");
    },
  },
  {
    id: "clean_shampoo",
    cat: "goods",
    name: "極上貓咪香波",
    icon: "🧴",
    thumb: "./icons/room/poop_clump.webp",
    cost: 80,
    desc: "清潔度立即補滿 100%，好感度 +15",
    effect: (key) => {
      const s = petStatus(key);
      s.cleanliness = 100;
      petData.affection[key] = (petData.affection[key] || 0) + 15;
      savePetData();
    },
  },
  {
    id: "furniture_cattree",
    cat: "furniture",
    name: "北歐原木貓跳台",
    icon: "🪵",
    thumb: "./icons/room/furniture_cat_tree.webp",
    cost: 400,
    desc: "放置於客廳左側，讓貓咪攀爬俯瞰客廳",
    furnitureKey: "cattree",
  },
  {
    id: "furniture_kotatsu",
    cat: "furniture",
    name: "日式暖被桌",
    icon: "🍵",
    thumb: "./icons/room/furniture_kotatsu.webp",
    cost: 600,
    desc: "放置於客廳右側，寒冬裡最溫暖的被爐",
    furnitureKey: "kotatsu",
  },
  {
    id: "wallpaper_tatami",
    cat: "wallpaper",
    name: "和風榻榻米壁紙",
    icon: "🌸",
    thumb: "./icons/room/wallpaper_tatami.webp",
    cost: 500,
    desc: "切換為溫馨日式和風客廳壁紙",
    wallpaperKey: "tatami",
  },
];

const GACHA_POOL = {
  ssr: [
    { id: "costume_wizard", name: "星空大魔法師套裝", type: "costume", rarity: "SSR", thumb: "./icons/room/costume_wizard.webp", desc: "傳奇魔法學徒披風與巫師帽" },
    { id: "costume_royal", name: "皇家加冕金冠王袍", type: "costume", rarity: "SSR", thumb: "./icons/room/costume_royal.webp", desc: "尊貴無比的皇室金冠與貂皮披風" },
  ],
  sr: [
    { id: "costume_detective", name: "福爾摩斯名偵探風衣", type: "costume", rarity: "SR", thumb: "./icons/room/costume_detective.webp", desc: "千鳥格斗篷與獵鹿帽" },
    { id: "costume_sailor", name: "高校青春水手服", type: "costume", rarity: "SR", thumb: "./icons/room/costume_sailor.webp", desc: "元氣滿滿的水手領與紅領結" },
    { id: "furniture_kotatsu", name: "日式暖被桌", type: "furniture", rarity: "SR", thumb: "./icons/room/furniture_kotatsu.webp", desc: "擺放在客廳的暖暖被爐" },
    { id: "furniture_cattree", name: "北歐原木貓跳台", type: "furniture", rarity: "SR", thumb: "./icons/room/furniture_cat_tree.webp", desc: "客廳豪華原木貓爬架" },
  ],
  r: [
    { id: "title_gacha_king", name: "🏅 稱號【扭蛋大富豪】", type: "title", rarity: "R", title: "扭蛋大富豪" },
    { id: "title_lucky_cat", name: "🏅 稱號【幸運招財貓】", type: "title", rarity: "R", title: "幸運招財貓" },
    { id: "bundle_catnip", name: "特級貓薄荷 ×2", type: "item", rarity: "R", icon: "🌿", count: 2 },
    { id: "bundle_tuna", name: "頂級鮪魚大餐 ×3", type: "item", rarity: "R", icon: "🐟", count: 3 },
  ],
  n: [
    { id: "item_fish", name: "香酥小魚乾 ×5", type: "food", rarity: "N", foodId: "fish", count: 5, icon: "🐟" },
    { id: "item_chicken", name: "鮮嫩雞胸肉 ×3", type: "food", rarity: "N", foodId: "chicken", count: 3, icon: "🍗" },
  ],
};

let activeShopTab = "goods";
export function setShopTab(tab) {
  activeShopTab = tab;
}

export function shopPageHtml(key = activePetKey()) {
  const coins = petCoins();
  const tabs = [
    { id: "goods", name: "🛒 道具雜貨" },
    { id: "furniture", name: "🛋️ 家具工坊" },
    { id: "wallpaper", name: "🖼️ 和風壁紙" },
  ];

  const tabHtml = `<div class="shop-tabs">${tabs.map((t) => `<button class="shop-tab-btn${activeShopTab === t.id ? " active" : ""}" data-shop-tab="${t.id}">${t.name}</button>`).join("")}</div>`;

  const items = SHOP_ITEMS.filter((it) => it.cat === activeShopTab);
  const gridHtml = `<div class="shop-grid">${items
    .map((it) => {
      const isFurniture = it.cat === "furniture";
      const isWallpaper = it.cat === "wallpaper";
      const owned = isFurniture
        ? !!(petData.roomFurniture && petData.roomFurniture[it.furnitureKey])
        : isWallpaper
          ? petData.roomWallpaper === it.wallpaperKey
          : false;
      const canBuy = coins >= it.cost && !owned;
      const label = owned ? "已擁有" : `🪙 ${it.cost} 購買`;

      return `
      <div class="shop-item-card">
        <img class="shop-item-thumb" src="${it.thumb || "./icons/room/litter_box.webp"}" alt="${escapeHtml(it.name)}">
        <span class="shop-item-name">${escapeHtml(it.name)}</span>
        <span class="shop-item-desc">${escapeHtml(it.desc)}</span>
        <button class="shop-buy-btn" data-buy-item="${it.id}" ${canBuy ? "" : "disabled"}>${label}</button>
      </div>
    `;
    })
    .join("")}</div>`;

  return `
    ${petSubnavHtml("shop")}
    ${petQuickStatusBarHtml(key)}
    <div class="shop-panel">
      <div class="academy-hero" style="color:#0f766e; background:linear-gradient(135deg, #f0fdfa, #ccfbf1); border-color:#99f6e4;">
        <b>🛍️ 貓咪生活館・雜貨與裝修</b><br>
        使用測驗與打工累積的 <b>金幣 🪙</b> 購買美味點心、貓薄荷，以及打造專屬溫馨貓咪小屋！
      </div>
      ${tabHtml}
      ${gridHtml}
    </div>
  `;
}

export function buyShopItem(itemId) {
  const it = SHOP_ITEMS.find((x) => x.id === itemId);
  if (!it) return;
  if (petCoins() < it.cost) {
    showSheet("金幣不足 🪙", `購買「${it.name}」需要 ${it.cost} 金幣喵！請先前往「學院」測驗排課賺取金幣！`, "前往學院", () => setPetView("academy"));
    return;
  }

  addCoins(-it.cost);
  audio.playCoin?.();
  navigator.vibrate?.([20, 20]);

  const key = activePetKey();
  if (it.cat === "goods" && it.effect) {
    it.effect(key);
  } else if (it.cat === "furniture") {
    petData.roomFurniture = petData.roomFurniture || {};
    petData.roomFurniture[it.furnitureKey] = true;
    savePetData();
  } else if (it.cat === "wallpaper") {
    petData.roomWallpaper = it.wallpaperKey;
    savePetData();
  }

  showPetHome();
}
window.buyShopItem = buyShopItem;
window.pullGacha = pullGacha;
window.showPetHome = showPetHome;
window.equipCostume = equipCostume;

// 學院測驗掉落的扭蛋券殘頁：集滿 SCRAPS_PER_TICKET 張可免費單抽一次
export const SCRAPS_PER_TICKET = 5;
export function gachaPageHtml(key = activePetKey()) {
  const coins = petCoins(),
    scraps = petData.ticketScraps || 0;
  petData.gachaPity = petData.gachaPity || { total: 0, sinceSR: 0, sinceSSR: 0 };
  const pity = petData.gachaPity;

  return `
    ${petSubnavHtml("gacha")}
    ${petQuickStatusBarHtml(key)}
    <div class="gacha-stage">
      <div class="gacha-rates-badge">🌟 SSR 3% · ✨ SR 15% · 🔹 R 32% · 🍪 N 50%</div>
      <div class="gacha-machine-wrap" id="gachaMachineWrap">
        <img class="gacha-machine-img" id="gachaMachineImg" src="./icons/room/gacha_machine.webp" alt="豪華招財貓扭蛋機">
      </div>
      <div class="gacha-pity-text">
        ✨ 距下次保底 SR：<b>${Math.max(1, 10 - (pity.sinceSR % 10))}</b> 抽<br>
        🌟 距下次保底 SSR 限定時裝：<b>${Math.max(1, 40 - (pity.sinceSSR % 40))}</b> 抽
      </div>
      <div class="gacha-actions-row">
        <button class="gacha-pull-btn single" data-pull-gacha="1" ${coins >= 300 ? "" : "disabled"}>
          <span>單抽扭蛋</span>
          <small>🪙 300 金幣</small>
        </button>
        <button class="gacha-pull-btn multi" data-pull-gacha="10" ${coins >= 2700 ? "" : "disabled"}>
          <span>十連保底抽 🎁</span>
          <small>🪙 2,700 金幣 (9折)</small>
        </button>
      </div>
      <button class="gacha-pull-btn ticket" data-pull-gacha="ticket" ${scraps >= SCRAPS_PER_TICKET ? "" : "disabled"}>
        <span>🎫 殘頁兌換單抽</span>
        <small>扭蛋券殘頁 ${scraps}／${SCRAPS_PER_TICKET}（學院測驗滿分有機會掉落）</small>
      </button>
    </div>
  `;
}

export function pullGacha(count, useScraps = false) {
  const cost = useScraps ? 0 : count === 1 ? 300 : 2700;
  if (useScraps) {
    if ((petData.ticketScraps || 0) < SCRAPS_PER_TICKET) return;
    petData.ticketScraps -= SCRAPS_PER_TICKET;
  } else if (petCoins() < cost) {
    showSheet("金幣不足 🪙", `扭蛋需要 ${cost} 金幣喵！請先前往「學院」排課測驗賺取金幣！`, "前往學院", () => setPetView("academy"));
    return;
  }

  addCoins(-cost);
  audio.playCoin?.();
  navigator.vibrate?.([30, 40, 50]);

  const machineWrap = $("gachaMachineWrap");
  if (machineWrap) machineWrap.classList.add("cranking");

  petData.gachaPity = petData.gachaPity || { total: 0, sinceSR: 0, sinceSSR: 0 };
  const results = [];

  for (let i = 0; i < count; i++) {
    petData.gachaPity.total++;
    petData.gachaPity.sinceSR++;
    petData.gachaPity.sinceSSR++;

    let poolKey = "n";
    // Check SSR pity (40)
    if (petData.gachaPity.sinceSSR >= 40) {
      poolKey = "ssr";
      petData.gachaPity.sinceSSR = 0;
      petData.gachaPity.sinceSR = 0;
    }
    // Check SR pity (10)
    else if (petData.gachaPity.sinceSR >= 10 || (count === 10 && i === 9 && !results.some((r) => r.rarity === "SR" || r.rarity === "SSR"))) {
      poolKey = "sr";
      petData.gachaPity.sinceSR = 0;
    } else {
      const rand = Math.random();
      if (rand < 0.03) {
        poolKey = "ssr";
        petData.gachaPity.sinceSSR = 0;
        petData.gachaPity.sinceSR = 0;
      } else if (rand < 0.18) {
        poolKey = "sr";
        petData.gachaPity.sinceSR = 0;
      } else if (rand < 0.50) {
        poolKey = "r";
      } else {
        poolKey = "n";
      }
    }

    const pool = GACHA_POOL[poolKey];
    const item = pool[Math.floor(Math.random() * pool.length)];
    results.push(item);

    // Apply item unlock
    if (item.type === "costume") {
      if (!petData.unlockedCostumes.includes(item.id)) petData.unlockedCostumes.push(item.id);
    } else if (item.type === "furniture") {
      petData.roomFurniture = petData.roomFurniture || {};
      petData.roomFurniture[item.id.replace("furniture_", "")] = true;
    } else if (item.type === "title") {
      earnedTitles(activePetKey());
    } else if (item.type === "food") {
      petData.food[item.foodId] = (petData.food[item.foodId] || 0) + item.count;
    }
  }

  savePetData();

  setTimeout(() => {
    if (machineWrap) machineWrap.classList.remove("cranking");
    showGachaResultModal(results);
  }, 850);
}

function showGachaResultModal(results) {
  audio.playVictory?.();
  const hasSSR = results.some((r) => r.rarity === "SSR");
  const hasSR = results.some((r) => r.rarity === "SR");

  const cards = results
    .map((r) => {
      const thumb = r.thumb ? `<img class="gacha-res-thumb" src="${r.thumb}" alt="${escapeHtml(r.name)}">` : `<span style="font-size:1.8rem;">${r.icon || "🎁"}</span>`;
      return `
        <div class="gacha-res-card ${r.rarity.toLowerCase()}">
          <span style="font-weight:900; color:${r.rarity === "SSR" ? "#f59e0b" : r.rarity === "SR" ? "#8b5cf6" : "#64748b"}">${r.rarity}</span>
          ${thumb}
          <span>${escapeHtml(r.name)}</span>
        </div>
      `;
    })
    .join("");

  const body = `
    <div class="gacha-reveal-wrap">
      <img class="gacha-capsule-anim" src="./icons/room/gacha_capsule_ssr.webp" alt="彩虹扭蛋開出">
      <div style="font-size:1.15rem; font-weight:900; color:var(--ink);">
        ${hasSSR ? "🌟 奇蹟爆發！獲得傳奇 SSR 時裝！🌟" : hasSR ? "✨ 金光閃耀！獲得 SR 稀有獎勵！✨" : "🎉 扭蛋結果揭曉！"}
      </div>
      <div class="gacha-results-grid">
        ${cards}
      </div>
    </div>
  `;

  showSheet("🎰 扭蛋開獎結果", body, "再抽一次", () => setPetView("gacha"), "返回客廳", () => setPetView("home"));
}

