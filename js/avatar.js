// avatar.js — 主角（玩家自己）的角色與裝扮外觀
// 用分層 SVG 畫出角色，每個部位都能換（膚色、髮型、髮色、上衣、褲裙、鞋子、帽子、配件），
// 存進 petData.avatar。這裡只有資料與純函式，UI 由 pet.js 呈現。

export const AVATAR_PARTS = {
  skin: [
    { id: "light", name: "白皙", value: "#ffe1c9" },
    { id: "warm", name: "健康", value: "#f7cba4" },
    { id: "tan", name: "小麥", value: "#e0a878" },
    { id: "deep", name: "深色", value: "#b57a52" },
  ],
  hair: [
    { id: "short", name: "短髮" },
    { id: "bob", name: "妹妹頭" },
    { id: "twin", name: "雙馬尾" },
    { id: "pony", name: "馬尾" },
    { id: "curly", name: "捲捲頭" },
    { id: "straight", name: "長直髮" },
  ],
  hairColor: [
    { id: "black", name: "黑", value: "#3a2f2a" },
    { id: "brown", name: "棕", value: "#8a5a34" },
    { id: "blonde", name: "金", value: "#e0b45c" },
    { id: "pink", name: "粉", value: "#e88aa8" },
    { id: "blue", name: "藍", value: "#5d86d8" },
    { id: "mint", name: "薄荷", value: "#5cc9a7" },
  ],
  top: [
    { id: "tshirt", name: "T 恤", value: "#ffffff" },
    { id: "hoodie", name: "連帽外套", value: "#6fa8dc" },
    { id: "shirt", name: "襯衫", value: "#dbe7f5" },
    { id: "sailor", name: "水手服", value: "#f4f7fb" },
    { id: "sweater", name: "毛衣", value: "#f2b880" },
    { id: "vest", name: "背心", value: "#a8d5a2" },
  ],
  bottom: [
    { id: "jeans", name: "牛仔褲", value: "#4a6fa5" },
    { id: "shorts", name: "短褲", value: "#7a5c46" },
    { id: "skirt", name: "百褶裙", value: "#d46a8a" },
    { id: "pleat", name: "長裙", value: "#8c6bb1" },
    { id: "sport", name: "運動褲", value: "#4f6b52" },
  ],
  shoes: [
    { id: "sneaker", name: "運動鞋", value: "#f0f0f0" },
    { id: "boots", name: "短靴", value: "#6b4a35" },
    { id: "loafer", name: "皮鞋", value: "#3f3a36" },
    { id: "sandal", name: "涼鞋", value: "#c98a5b" },
    { id: "rainboot", name: "雨鞋", value: "#f2c744" },
  ],
  hat: [
    { id: "none", name: "不戴" },
    { id: "cap", name: "棒球帽", value: "#e0574f" },
    { id: "beanie", name: "毛帽", value: "#7fb0d8" },
    { id: "straw", name: "草帽", value: "#e8c97a" },
    { id: "beret", name: "貝雷帽", value: "#b07fc0" },
    { id: "bow", name: "蝴蝶結", value: "#ef7fa8" },
  ],
  accessory: [
    { id: "none", name: "不戴" },
    { id: "glasses", name: "眼鏡" },
    { id: "scarf", name: "圍巾" },
    { id: "backpack", name: "背包" },
    { id: "headphone", name: "耳機" },
    { id: "badge", name: "名牌" },
  ],
};

export function defaultAvatar() {
  return {
    skin: "light",
    hair: "bob",
    hairColor: "black",
    top: "tshirt",
    bottom: "jeans",
    shoes: "sneaker",
    hat: "none",
    accessory: "none",
  };
}
export function normalizeAvatar(a) {
  const base = defaultAvatar();
  const out = { ...base };
  if (a && typeof a === "object") {
    const hair = a.hair === "bowl" ? "straight" : a.hair;
    for (const key of Object.keys(base)) {
      const val = key === "hair" ? hair : a[key];
      if (typeof val === "string" && AVATAR_PARTS[key].some((o) => o.id === val)) out[key] = val;
    }
  }
  return out;
}
function partValue(key, id, fallback) {
  const item = AVATAR_PARTS[key].find((o) => o.id === id);
  return item?.value || fallback;
}
export function randomAvatar(rng = Math.random) {
  const pick = (key) => AVATAR_PARTS[key][Math.floor(rng() * AVATAR_PARTS[key].length)].id;
  return { ...defaultAvatar(), hair: pick("hair"), hairColor: pick("hairColor"), top: pick("top"), bottom: pick("bottom"), shoes: pick("shoes"), hat: pick("hat"), accessory: pick("accessory"), skin: pick("skin") };
}

// ── 隨年級長大 ──
// 每個年級一個身體（base_g4 … base_g9），每個年級也有自己一整套換裝圖層（icons/avatar/g4/ … g9/），
// 都是直接畫在該年級身體上再摳出來的（tools/avatar_redraw.py），所以不用縮放對位，原圖疊上去就合身。
export const GROWTH_GRADES = [4, 5, 6, 7, 8, 9];

// 各階段錨點（512x512 畫布的像素座標），由 tools/measure_avatar.mjs 從身體 PNG 量出來：
// headTop/neck/headL/headR＝頭頂、脖子、頭左右（含耳朵）；neckL/neckR＝脖子最細處左右；collar/crotch＝連身衣領口、胯下；
// armL/armR＝軀幹含手臂的最外側；hipL/hipR＝臀寬；ankle/feet＝腳踝、腳底；feetL/feetR＝兩腳外側
export const STAGE_METRICS = {
  g4: { label: "四年級", headTop: 57, neck: 207, neckL: 242, neckR: 268, headL: 185, headR: 325, collar: 219, crotch: 345, armL: 193, armR: 319, hipL: 210, hipR: 300, ankle: 463, feet: 494, feetL: 218, feetR: 292 },
  g5: { label: "五年級", headTop: 57, neck: 158, neckL: 245, neckR: 266, headL: 211, headR: 300, collar: 172, crotch: 326, armL: 195, armR: 317, hipL: 217, hipR: 295, ankle: 453, feet: 494, feetL: 224, feetR: 287 },
  g6: { label: "六年級", headTop: 57, neck: 170, neckL: 244, neckR: 267, headL: 202, headR: 308, collar: 185, crotch: 317, armL: 193, armR: 319, hipL: 213, hipR: 297, ankle: 456, feet: 494, feetL: 216, feetR: 295 },
  g7: { label: "七年級", headTop: 57, neck: 148, neckL: 245, neckR: 266, headL: 215, headR: 296, collar: 164, crotch: 289, armL: 197, armR: 314, hipL: 219, hipR: 292, ankle: 451, feet: 494, feetL: 227, feetR: 284 },
  g8: { label: "八年級", headTop: 57, neck: 141, neckL: 246, neckR: 265, headL: 221, headR: 290, collar: 160, crotch: 287, armL: 198, armR: 313, hipL: 219, hipR: 292, ankle: 467, feet: 494, feetL: 232, feetR: 280 },
  g9: { label: "九年級", headTop: 57, neck: 150, neckL: 247, neckR: 264, headL: 214, headR: 296, collar: 163, crotch: 287, armL: 199, armR: 311, hipL: 222, hipR: 288, ankle: 451, feet: 494, feetL: 227, feetR: 284 },
};
export function gradeOfTerm(term) {
  const g = parseInt(String(term || "").split("-")[0], 10);
  return Number.isFinite(g) ? Math.min(9, Math.max(4, g)) : 4;
}
export function avatarStage(gradeOrTerm) {
  const g = typeof gradeOrTerm === "string" && gradeOrTerm.includes("-") ? gradeOfTerm(gradeOrTerm) : Number(gradeOrTerm);
  const g2 = Number.isFinite(g) ? Math.min(9, Math.max(4, g)) : 4;
  return `g${g2}`;
}
export function stageLabel(gradeOrTerm) {
  return STAGE_METRICS[avatarStage(gradeOrTerm)]?.label || "";
}
// ── 角色繪製（PNG 分層）──
// 素材在 icons/avatar/：Nano Banana 重繪的 PNG（512x512 對齊，白色／灰階底稿；身體 base_gN.png，換裝 gN/<部位>.png），
// 顏色在遊戲裡用 mix-blend-mode: multiply 疊上去，所以一種形狀一張圖、顏色可換、AI 的陰影保留。
const ACC_COLOR = { glasses: "#333333", scarf: "#e0574f", backpack: "#8a5a34", headphone: "#3a3a3a", badge: "#c9a227" };

// 膚色用濾鏡調整基本身體（AI 重繪的膚色為預設「白皙」）
export const SKIN_FILTER = {
  light: "",
  warm: "saturate(1.12) brightness(0.98) sepia(0.1)",
  tan: "saturate(1.3) brightness(0.9) sepia(0.24)",
  deep: "saturate(1.45) brightness(0.76) sepia(0.4)",
};

// 帽子／耳機／蝴蝶結是在各年級的「妹妹頭」上畫的；換成其他髮型時依髮型輪廓微調（tools/fit_head_items.py 量出來寫進來）。
// 每項 [sx, sy, dx, dy, ox, oy]：以 (ox, oy) 為原點寬縮 sx、高縮 sy，再平移 (dx, dy)（512 畫布像素）。妹妹頭不用調。
export const HEAD_FIT = {
  g4: {
    short: { bow: [1, 1, 4, -5, 256, 0], hat: [1.05, 1.05, 0, 0, 256, 110], headphone: [0.87, 1.049, 0, 0, 256, 147] },
    bob: { bow: [1, 1, 4, 0, 256, 0] },
    twin: { bow: [1, 1, 16, 0, 256, 0], hat: [1.05, 1.0, 0, 0, 256, 110], headphone: [1.1, 1.0, 0, 0, 256, 147] },
    pony: { bow: [1, 1, 12, 12, 256, 0], hat: [1.05, 0.85, 0, 0, 256, 110], headphone: [0.977, 0.883, 0, 0, 256, 147] },
    curly: { bow: [1, 1, 4, -5, 256, 0], hat: [1.05, 1.05, 0, 0, 256, 110], headphone: [1.1, 1.049, 0, 0, 256, 147] },
    straight: { bow: [1, 1, 4, 3, 256, 0], hat: [0.955, 0.955, 0, 0, 256, 110], headphone: [0.893, 0.971, 0, 0, 256, 147] },
  },
  g5: {
    short: { bow: [1, 1, 14, 0, 256, 0], hat: [0.939, 1.0, 0, 0, 256, 92], headphone: [0.82, 1.0, 0, 0, 256, 118] },
    bob: { bow: [1, 1, 14, 0, 256, 0] },
    twin: { bow: [1, 1, 14, 4, 256, 0], hat: [1.05, 0.9, 0, 0, 256, 92], headphone: [1.0, 0.939, 0, 0, 256, 118] },
    pony: { bow: [1, 1, 14, 5, 256, 0], hat: [0.983, 0.875, 0, 0, 256, 92], headphone: [0.8, 0.924, 0, 0, 256, 118] },
    curly: { bow: [1, 1, 14, 4, 256, 0], hat: [0.913, 0.9, 0, 0, 256, 92], headphone: [0.91, 0.939, 0, 0, 256, 118] },
    straight: { bow: [1, 1, 14, 5, 256, 0], hat: [0.85, 0.875, 0, 0, 256, 92], headphone: [0.8, 0.924, 0, 0, 256, 118] },
  },
  g6: {
    short: { bow: [1, 1, -16, -1, 256, 0], hat: [0.974, 1.025, 0, 0, 256, 97], headphone: [0.87, 1.015, 0, 0, 256, 125] },
    bob: { bow: [1, 1, -16, 0, 256, 0] },
    twin: { bow: [1, 1, -16, -4, 256, 0], hat: [1.05, 1.05, 0, 0, 256, 97], headphone: [1.1, 1.059, 0, 0, 256, 125] },
    pony: { bow: [1, 1, -16, 1, 256, 0], hat: [1.05, 0.975, 0, 0, 256, 97], headphone: [0.992, 0.985, 0, 0, 256, 125] },
    curly: { bow: [1, 1, -16, -7, 256, 0], hat: [1.05, 1.05, 0, 0, 256, 97], headphone: [1.076, 1.103, 0, 0, 256, 125] },
    straight: { bow: [1, 1, -16, 0, 256, 0], hat: [0.93, 1.0, 0, 0, 256, 97], headphone: [0.878, 1.0, 0, 0, 256, 125] },
  },
  g7: {
    short: { bow: [1, 1, 5, -11, 256, 0], hat: [1.05, 1.05, 0, 0, 256, 89], headphone: [0.923, 1.2, 0, 0, 256, 112] },
    bob: { bow: [1, 1, 5, 0, 256, 0] },
    twin: { bow: [1, 1, 5, 1, 256, 0], hat: [1.05, 0.969, 0, 0, 256, 89], headphone: [1.1, 0.982, 0, 0, 256, 112] },
    pony: { bow: [1, 1, 5, -1, 256, 0], hat: [1.05, 1.031, 0, 0, 256, 89], headphone: [0.8, 1.018, 0, 0, 256, 112] },
    curly: { bow: [1, 1, 5, -7, 256, 0], hat: [1.05, 1.05, 0, 0, 256, 89], headphone: [1.1, 1.127, 0, 0, 256, 112] },
    straight: { bow: [1, 1, 5, -1, 256, 0], hat: [0.967, 1.031, 0, 0, 256, 89], headphone: [0.913, 1.018, 0, 0, 256, 112] },
  },
  g8: {
    short: { bow: [1, 1, 1, 1, 256, 0], hat: [0.85, 0.968, 0, 0, 256, 86], headphone: [0.8, 0.981, 0, 0, 256, 107] },
    bob: { bow: [1, 1, 1, 0, 256, 0] },
    twin: { bow: [1, 1, 1, 1, 256, 0], hat: [1.02, 0.968, 0, 0, 256, 86], headphone: [0.8, 0.981, 0, 0, 256, 107] },
    pony: { bow: [1, 1, 1, 1, 256, 0], hat: [0.911, 0.968, 0, 0, 256, 86], headphone: [0.893, 0.981, 0, 0, 256, 107] },
    curly: { bow: [1, 1, 1, -13, 256, 0], hat: [1.02, 1.05, 0, 0, 256, 86], headphone: [1.0, 1.2, 0, 0, 256, 107] },
    straight: { bow: [1, 1, 1, 2, 256, 0], hat: [0.85, 0.935, 0, 0, 256, 86], headphone: [0.8, 0.962, 0, 0, 256, 107] },
  },
  g9: {
    short: { bow: [1, 1, 8, -1, 256, 0], hat: [0.961, 1.024, 0, 0, 256, 90], headphone: [0.8, 1.016, 0, 0, 256, 113] },
    bob: { bow: [1, 1, 8, 0, 256, 0] },
    twin: { bow: [1, 1, 8, 5, 256, 0], hat: [1.05, 0.878, 0, 0, 256, 90], headphone: [0.881, 0.922, 0, 0, 256, 113] },
    pony: { bow: [1, 1, 8, 8, 256, 0], hat: [0.971, 0.85, 0, 0, 256, 90], headphone: [0.847, 0.875, 0, 0, 256, 113] },
    curly: { bow: [1, 1, 8, 2, 256, 0], hat: [1.0, 0.951, 0, 0, 256, 90], headphone: [0.949, 0.969, 0, 0, 256, 113] },
    straight: { bow: [1, 1, 8, 6, 256, 0], hat: [0.864, 0.854, 0, 0, 256, 90], headphone: [0.805, 0.906, 0, 0, 256, 113] },
  },
};
export function headFit(file, hair, gradeOrTerm) {
  const kind = file === "hat_bow" ? "bow" : file === "acc_headphone" ? "headphone" : file.startsWith("hat_") ? "hat" : null;
  const f = kind && HEAD_FIT[avatarStage(gradeOrTerm)]?.[hair]?.[kind];
  return f ? { sx: f[0], sy: f[1], dx: f[2], dy: f[3], ox: f[4], oy: f[5] } : null;
}

// 相對路徑（測試用）；實際載入用 avatarLayerSrc 解析成絕對網址，子路徑部署也正確
export function avatarLayerUrl(file) {
  return `icons/avatar/${file}.png`;
}
export function avatarLayerSrc(file) {
  return new URL(`../${avatarLayerUrl(file)}`, import.meta.url).href;
}

// 頭和下巴疊在上衣前面：只留脖子以上（頭頂到下巴處），避免高領角蓋到臉部
export function headClip(gradeOrTerm) {
  const m = STAGE_METRICS[avatarStage(gradeOrTerm)];
  const p = (v) => ((v / 512) * 100).toFixed(2) + "%";
  const n = m.neck;
  return `polygon(0 0,100% 0,100% ${p(n)},0 ${p(n)})`;
}

// 回傳 [{ file, color, alpha, tint, clip }]，順序＝疊圖順序（背包在最底、後髮在身體後面、臉已含在 base 裡）
export function avatarLayers(input, gradeOrTerm = 4) {
  const a = normalizeAvatar(input);
  const stage = avatarStage(gradeOrTerm);
  const out = [];
  const push = (file, color, alpha, tint = true, clip = "", fit = null) => out.push({ file, color, alpha: alpha ?? 1, tint, part: file, clip, fit });
  const own = (file, color, alpha) => push(`${stage}/${file}`, color, alpha, true, "", headFit(file, a.hair, gradeOrTerm)); // 該年級自己那一套
  if (a.accessory === "backpack") own("acc_backpack", ACC_COLOR.backpack, 0.94);
  own(`hairback_${a.hair}`, partValue("hairColor", a.hairColor, "#3a2f2a")); // 後髮在身體後面，臉和脖子蓋住中間
  push(`base_${stage}`, "#ffffff", 1, false); // 基本身體自帶膚色，不上色（依年級換身體）
  own(`bottom_${a.bottom}`, partValue("bottom", a.bottom, "#4a6fa5"));
  own(`shoes_${a.shoes}`, partValue("shoes", a.shoes, "#eeeeee"));
  own(`top_${a.top}`, partValue("top", a.top, "#ffffff"));
  if (a.accessory === "backpack") own("acc_backpack_front", ACC_COLOR.backpack, 0.94); // 背帶壓在上衣前面
  push(`base_${stage}`, "#ffffff", 1, false, headClip(gradeOrTerm)); // 頭和臉蓋在領口前面，頭髮再疊上去
  own(`hair_${a.hair}`, partValue("hairColor", a.hairColor, "#3a2f2a"));
  if (a.hat !== "none") own(`hat_${a.hat}`, partValue("hat", a.hat, "#e0574f"));
  if (a.accessory !== "none" && a.accessory !== "backpack") own(`acc_${a.accessory}`, ACC_COLOR[a.accessory] || "#8a5a34");
  return out;
}

export function renderAvatar(input, { size = 150, grade = 4 } = {}) {
  const a = normalizeAvatar(input);
  const stage = avatarStage(grade);
  const layers = avatarLayers(a, grade)
    .map((l) => {
      const url = avatarLayerSrc(l.file);
      const isBase = l.file.startsWith("base_");
      const filter = isBase ? SKIN_FILTER[a.skin] || "" : "";
      const css = (filter ? `filter:${filter};` : "") + (l.clip ? `clip-path:${l.clip};` : "");
      const img = `<img class="av-img" src="${url}" alt=""${css ? ` style="${css}"` : ""}>`;
      const tint = l.tint
        ? `<i class="av-tint" style="background:${l.color};opacity:${l.alpha};-webkit-mask-image:url(${url});mask-image:url(${url})"></i>`
        : "";
      const f = l.fit;
      const pct = (v) => ((v / 512) * 100).toFixed(2) + "%";
      const tf = f ? ` style="transform-origin:${pct(f.ox)} ${pct(f.oy)};transform:translate(${pct(f.dx)},${pct(f.dy)}) scale(${f.sx},${f.sy})"` : "";
      return `<span class="av-layer"${tf}>${img}${tint}</span>`;
    })
    .join("");
  return `<div class="avatar-png" style="--av-w:${size}px" data-stage="${stage}" role="img" aria-label="我的角色（${stageLabel(grade)}）：${avatarLabel(a)}">${layers}</div>`;
}

// 造型的完整描述（給 UI 顯示目前穿什麼）
export function avatarLabel(input) {
  const n = normalizeAvatar(input);
  const name = (key, id) => AVATAR_PARTS[key].find((o) => o.id === id)?.name || "";
  return `${name("hair", n.hair)}／${name("hairColor", n.hairColor)}／${name("skin", n.skin)}／${name("top", n.top)}／${name("bottom", n.bottom)}／${name("shoes", n.shoes)}${
    n.hat !== "none" ? `／${name("hat", n.hat)}` : ""
  }${n.accessory !== "none" ? `／${name("accessory", n.accessory)}` : ""}`;
}
