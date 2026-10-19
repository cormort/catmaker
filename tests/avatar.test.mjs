// tests/avatar.test.mjs — 驗證主角造型的資料與 PNG 分層繪製（Nano Banana 重繪素材）
// 用法：node tests/avatar.test.mjs
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AVATAR_PARTS, GROWTH_GRADES, SKIN_FILTER, STAGE_METRICS, avatarLabel, avatarLayerUrl, avatarLayers, avatarStage, defaultAvatar, gradeOfTerm, normalizeAvatar, randomAvatar, renderAvatar, stageLabel, HEAD_FIT } from "../js/avatar.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const check = (ok, label) => {
  console.log(`  ${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failures++;
};

console.log("=== 造型資料 ===");
check(Object.keys(AVATAR_PARTS).length === 8, "有 8 個可換部位（膚色/髮型/髮色/上衣/褲裙/鞋/帽/配件）");
check(
  AVATAR_PARTS.hair.length >= 5 && AVATAR_PARTS.top.length >= 5 && AVATAR_PARTS.hat.length >= 5,
  "髮型、上衣、帽子都有 5 種以上可選",
);
check(AVATAR_PARTS.hat.some((o) => o.id === "none") && AVATAR_PARTS.accessory.some((o) => o.id === "none"), "帽子和配件可以不戴");
check(
  ["hairColor", "skin", "top", "bottom", "shoes"].every((k) => AVATAR_PARTS[k].every((o) => /^#[0-9a-f]{6}$/i.test(o.value))),
  "顏色類的部位都是合法色碼",
);
check(Object.keys(SKIN_FILTER).length === AVATAR_PARTS.skin.length, "每個膚色都有對應的調整濾鏡");

console.log("=== 造型存取 ===");
check(normalizeAvatar(null).hair === defaultAvatar().hair, "沒有造型時用預設值");
check(normalizeAvatar({ hair: "不存在的髮型", top: "hoodie" }).top === "hoodie", "保留合法部位");
check(normalizeAvatar({ hair: "不存在的髮型" }).hair === defaultAvatar().hair, "不合法的部位會被換回預設");
const rnd = randomAvatar(() => 0.5);
check(Object.keys(rnd).length === 8 && normalizeAvatar(rnd).hair === rnd.hair, "隨機造型是合法的");
check(avatarLabel({ ...defaultAvatar(), hat: "cap", accessory: "glasses" }).includes("棒球帽"), "造型描述包含帽子");
check(avatarLabel(defaultAvatar()).includes("牛仔褲"), "造型描述包含褲子");

console.log("=== 圖層順序 ===");
const files = avatarLayers({ ...defaultAvatar(), top: "sailor", hat: "straw", accessory: "glasses" }).map((l) => l.file);
check(files[0] === "g4/hairback_bob" && files[1] === "base_g4", "最底是後髮，接著是基本身體（預設四年級）");
check(
  files.join(",") === "g4/hairback_bob,base_g4,g4/bottom_jeans,g4/shoes_sneaker,g4/top_sailor,base_g4,g4/hair_bob,g4/hat_straw,g4/acc_glasses",
  `疊圖順序正確（${files.join(" → ")}）`,
);
check(files.indexOf("g4/top_sailor") > files.indexOf("g4/bottom_jeans"), "上衣蓋在褲裙之上");
check(files.indexOf("g4/hair_bob") > files.indexOf("g4/top_sailor"), "頭髮疊在上衣之上");
const withPack = avatarLayers({ ...defaultAvatar(), accessory: "backpack" }).map((l) => l.file);
check(withPack[0] === "g4/acc_backpack" && withPack[1] === "g4/hairback_bob" && withPack[2] === "base_g4", "背包畫在後髮和身體後面");
check(withPack.indexOf("g4/acc_backpack_front") === withPack.indexOf("g4/top_tshirt") + 1, "背包背帶疊在上衣前面");
check(!avatarLayers(defaultAvatar()).some((l) => l.file.includes("hat_")), "沒戴帽子時不會有帽子圖層");

console.log("=== 上色 ===");
const layers = avatarLayers({ ...defaultAvatar(), hairColor: "pink", top: "hoodie" });
check(layers.find((l) => l.file.startsWith("base_g")).tint === false, "基本身體不上色（自帶膚色，改用濾鏡）");
check(layers.find((l) => l.file.includes("/hair_")).color === "#e88aa8", "頭髮帶出髮色");
check(layers.find((l) => l.file.includes("/hairback_")).color === "#e88aa8", "後髮和前髮同色");
check(layers.find((l) => l.file.includes("/top_")).color === "#6fa8dc", "上衣帶出衣服色");
check(layers.filter((l) => !l.file.startsWith("base_g")).every((l) => l.tint), "除了身體以外每一層都會上色");
check(layers.every((l) => l.alpha > 0 && l.alpha <= 1), "每層都有合法透明度");

console.log("=== 隨年級長大 ===");
check(GROWTH_GRADES.join(",") === "4,5,6,7,8,9", "四個年級到九年級都有對應身體");
check(avatarStage(4) === "g4" && avatarStage(9) === "g9" && avatarStage(12) === "g9" && avatarStage(1) === "g4", "年級會夾在 4~9");
check(avatarStage("6-1") === "g6" && gradeOfTerm("8-2") === 8, "冊次可以換算年級");
check(stageLabel("7-1") === "七年級", "有年級名稱");
check(
  GROWTH_GRADES.every((g) => STAGE_METRICS[`g${g}`] && STAGE_METRICS[`g${g}`].headR > STAGE_METRICS[`g${g}`].headL && STAGE_METRICS[`g${g}`].feet > STAGE_METRICS[`g${g}`].ankle),
  "每個階段都有量測資料",
);
const hw = (m) => m.headR - m.headL;
check(hw(STAGE_METRICS.g9) < hw(STAGE_METRICS.g4) && STAGE_METRICS.g9.collar < STAGE_METRICS.g4.collar, "年級越高頭越小、肩膀越高（比例變成熟）");
for (const g of GROWTH_GRADES) {
  const ls = avatarLayers({ ...defaultAvatar(), hat: "cap", accessory: "backpack" }, g).filter((l) => !l.file.startsWith("base_"));
  check(ls.every((l) => l.file.startsWith(`g${g}/`)), `${g} 年級的換裝圖層全部用 g${g}/ 那一套（不跨年級共用、不縮放）`);
}
check(!renderAvatar({ ...defaultAvatar(), hat: "cap" }, { grade: 8 }).includes("transform:"), "衣服圖層不再靠 CSS 縮放對位（每個年級各自畫好；妹妹頭配帽子也不用調）");
// 帽子／耳機／蝴蝶結是畫在妹妹頭上的，其他髮型依 HEAD_FIT 微調（tools/fit_head_items.py）
check(
  GROWTH_GRADES.every((g) => AVATAR_PARTS.hair.map((o) => o.id).every((h) => HEAD_FIT[`g${g}`]?.[h]?.bow && (h === "bob" || (HEAD_FIT[`g${g}`][h].hat && HEAD_FIT[`g${g}`][h].headphone)))),
  "每個年級每種髮型都有帽子／耳機／蝴蝶結的微調",
);
check(
  Object.values(HEAD_FIT).every((st) => Object.values(st).every((f) => Object.values(f).every((v) => v.length === 6 && v[0] >= 0.8 && v[0] <= 1.15 && v[1] >= 0.8 && v[1] <= 1.2))),
  "微調幅度合理（縮放 0.8～1.2）",
);
const capShort = avatarLayers({ ...defaultAvatar(), hair: "short", hat: "cap", accessory: "headphone" }, 8);
check(capShort.find((l) => l.file === "g8/hat_cap").fit && capShort.find((l) => l.file === "g8/acc_headphone").fit, "短髮戴帽子、耳機會套微調");
check(!capShort.find((l) => l.file === "g8/top_tshirt").fit && !capShort.find((l) => l.file === "g8/hair_short").fit, "衣服、頭髮本身不套微調");
check(renderAvatar({ ...defaultAvatar(), hair: "short", hat: "cap" }, { grade: 8 }).includes("transform-origin:"), "微調用 CSS transform 套在帽子圖層上");
const big = avatarLayers(defaultAvatar(), 9).map((l) => l.file);
check(big[1] === "base_g9", "九年級用 base_g9 身體");
check(avatarLayers(defaultAvatar(), "5-1").some((l) => l.file === "base_g5"), "冊次 5-1 用 base_g5 身體");

console.log("=== 圖層檔案都在 ===");
// 每個年級都要有自己一整套：前後髮、上衣、褲裙、鞋、帽、配件（加背帶）
const layerNames = [];
for (const hair of AVATAR_PARTS.hair) layerNames.push(`hair_${hair.id}`, `hairback_${hair.id}`);
for (const t of AVATAR_PARTS.top) layerNames.push(`top_${t.id}`);
for (const b of AVATAR_PARTS.bottom) layerNames.push(`bottom_${b.id}`);
for (const sh of AVATAR_PARTS.shoes) layerNames.push(`shoes_${sh.id}`);
for (const h of AVATAR_PARTS.hat) if (h.id !== "none") layerNames.push(`hat_${h.id}`);
for (const ac of AVATAR_PARTS.accessory) if (ac.id !== "none") layerNames.push(`acc_${ac.id}`);
layerNames.push("acc_backpack_front");
check(layerNames.length === 39, `每個年級需要 ${layerNames.length} 張換裝圖層`);
for (const g of GROWTH_GRADES) {
  const missing = [`base_g${g}`, ...layerNames.map((f) => `g${g}/${f}`)].filter((f) => !existsSync(join(ROOT, avatarLayerUrl(f))));
  check(missing.length === 0, `${g} 年級：身體＋每個可選項目都有 PNG（缺 ${missing.length} 張${missing.length ? ": " + missing.join(", ") : ""}）`);
  const extra = readdirSync(join(ROOT, "icons/avatar", `g${g}`)).filter((f) => !layerNames.includes(f.replace(/\.png$/, "")));
  check(extra.length === 0, `${g} 年級資料夾沒有多餘的檔案${extra.length ? "：" + extra.join(", ") : ""}`);
}
// 每張圖層都列進 sw.js 的快取清單（離線也能換裝）
const sw = (await import("node:fs")).readFileSync(join(ROOT, "sw.js"), "utf8");
const notCached = GROWTH_GRADES.flatMap((g) => [`base_g${g}`, ...layerNames.map((f) => `g${g}/${f}`)]).filter((f) => !sw.includes(`'./${avatarLayerUrl(f)}'`));
check(notCached.length === 0, `每張角色圖層都在 sw.js 快取清單裡（缺 ${notCached.length} 張${notCached.length ? "：" + notCached.slice(0, 5).join(", ") : ""}）`);

console.log("=== 角色輸出 ===");
const html = renderAvatar({ ...defaultAvatar(), top: "sailor", hat: "straw" }, { size: 200 });
check(html.startsWith('<div class="avatar-png"'), "輸出是可縮放的 div 容器");
const count = (html.match(/class="av-layer"/g) || []).length;
check(count === 8, `八個圖層疊起來（後髮／身體／褲／鞋／上衣／頭脖子／前髮／帽，實際 ${count}）`);
const order = avatarLayers({ ...defaultAvatar(), top: "sailor" }, 7);
const headIdx = order.findIndex((l) => l.clip);
check(
  headIdx > order.findIndex((l) => l.file === "g7/top_sailor") && headIdx < order.findIndex((l) => l.file === "g7/hair_bob") && order[headIdx].file === "base_g7",
  "頭和脖子（同年級身體裁切）疊在上衣前面、頭髮後面",
);
check(html.includes("clip-path:polygon("), "頭脖子圖層用 clip-path 只留脖子以上");
check(renderAvatar({ ...defaultAvatar(), accessory: "glasses" }).includes("g4/acc_glasses.png"), "戴眼鏡會多一層配件圖層");
check(html.includes("--av-w:200px"), "可以指定尺寸");
check(html.includes("icons/avatar/g4/hair_bob.png") && html.includes('class="av-img"'), "用 img 載入 AI 重繪的圖層");
check(html.includes("av-tint"), "上色層用 .av-tint（CSS 走 multiply，保留 AI 的陰影）");
check(html.includes("mask-image:url(") && (html.match(/hair_bob\.png/g) || []).length >= 2, "上色層拿同一張圖當遮罩，顏色只落在圖案上");
check((renderAvatar({ ...defaultAvatar(), skin: "deep" }).match(/filter:saturate\(1\.45\)/g) || []).length === 2, "深色膚色會套濾鏡（身體和頭脖子兩層都要）");
check(!/<img[^>]*filter:/.test(renderAvatar(defaultAvatar())), "預設膚色不加濾鏡");
check(html.includes("aria-label"), "帶有無障礙描述");

console.log(failures ? `\n${failures} 項失敗` : "\n全部通過");
process.exit(failures ? 1 : 0);
