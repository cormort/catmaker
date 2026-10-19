// split_avatar_hair.mjs — 把每種髮型拆成「前髮」與「後髮」兩層
// - 後髮 hairback_<id>.png：前髮輪廓補洞、在頭部高度逐列左右填滿（後腦勺的頭髮量），
//   畫成中灰色（遊戲裡 multiply 上色後比前髮深一階）加深色外框，疊在身體後面；
//   臉和脖子會蓋住中間，只有頭的兩側、髮絲縫隙、脖子兩旁露出來。
// - 前髮 hair_<id>.png：補上頭頂沒蓋到的光頭（馬尾頭頂比頭髮大一圈），
//   短髮、西瓜皮清掉下緣垂到臉頰的細雜線，短髮剪掉捲到右臉頰的髮尾。
// 用法：node tools/split_avatar_hair.mjs [--fresh] [--grade N] [--dir 資料夾] [id ...]（需要 ImageMagick）
//   --grade：哪個年級的身體（預設 4），讀寫 icons/avatar/gN/
//   --fresh：前髮是 avatar_redraw.py 剛摳出來的新圖，跳過只針對舊圖的修補（清雜線、剪髮尾）
//   --dir：讀寫別的資料夾（預覽用；身體圖仍讀 icons/avatar/base_gN.png）
//   沒有 --fresh 時請對原始前髮跑一次，髮尾漸淡那步重跑會再淡一次
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { STAGE_METRICS } from "../js/avatar.js";

const AV = fileURLToPath(new URL("../icons/avatar/", import.meta.url));
const argv = process.argv.slice(2);
const FRESH = argv.includes("--fresh");
const dirAt = argv.indexOf("--dir");
const gradeAt = argv.indexOf("--grade");
const GRADE = gradeAt >= 0 ? Number(argv[gradeAt + 1]) : 4;
const DIR = dirAt >= 0 ? argv[dirAt + 1].replace(/\/?$/, "/") : `${AV}g${GRADE}/`;
const ONLY = argv.filter((a, i) => !a.startsWith("--") && !(dirAt >= 0 && i === dirAt + 1) && !(gradeAt >= 0 && i === gradeAt + 1));
// 下面的列號都是 g4 量的；其他年級頭比較小，照「頭頂到脖子」的比例換算
const G4 = STAGE_METRICS.g4, GM = STAGE_METRICS[`g${GRADE}`];
const gy = (y) => Math.round(GM.headTop + ((y - G4.headTop) * (GM.neck - GM.headTop)) / (G4.neck - G4.headTop));
const W = 512, H = 512;
const read = (f) => execFileSync("convert", [f, "-depth", "8", "rgba:-"], { maxBuffer: 1 << 24 });
const write = (f, buf) => execFileSync("convert", ["-size", `${W}x${H}`, "-depth", "8", "rgba:-", f], { input: buf });

// 後髮在頭部高度要左右填滿到哪一列（g4 座標）：馬尾、雙馬尾只填到太陽穴，辮子之間保持鏤空
// 新髮型沒列在這裡時，填到頭髮最下緣（短髮、鮑伯頭類）
const BACK_FILL_TO = { short: 193, bob: 217, twin: 140, pony: 140, curly: 195, straight: 240, bowl: 169 };
const CAP_LINE = 95; // 這條線以上，頭頂沒被頭髮蓋到的地方補成頭髮
const STRAY_FROM = 140; // 這條線以下清掉細雜線（只對 short、bowl）
const STRAY = new Set(["short", "bowl"]);
const OUTLINE = [92, 88, 90];
// 垂到臉頰上的髮尾：新版由 AI 生成柔順邊緣，不再做矩形硬切
const TRIM = {};

const n4 = (i) => {
  const x = i % W, y = (i / W) | 0;
  return [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
};
function grow(mask, r, val) {
  let cur = mask;
  for (let k = 0; k < r; k++) {
    const next = new Uint8Array(cur);
    for (let i = 0; i < W * H; i++) if (cur[i] !== val && n4(i).some((j) => j >= 0 && cur[j] === val)) next[i] = val;
    cur = next;
  }
  return cur;
}
// 從畫布邊緣 flood fill 找出 mask 以外的「外面」，其餘＝mask 加上它圍起來的洞
function fillHoles(mask) {
  const out = new Uint8Array(W * H);
  const st = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) {
    const i = st.pop();
    if (out[i] || mask[i]) continue;
    out[i] = 1;
    for (const j of n4(i)) if (j >= 0) st.push(j);
  }
  return out.map((v) => (v ? 0 : 1));
}

const base = read(`${AV}base_g${GRADE}.png`);
for (const id of ONLY.length ? ONLY : Object.keys(BACK_FILL_TO)) {
  const file = `${DIR}hair_${id}.png`;
  const px = read(file);
  const A = (i) => px[i * 4 + 3];

  // ── 前髮：清細雜線（opening 半徑 2，只在 STRAY_FROM 以下）──
  let fixed = 0;
  if (!FRESH && STRAY.has(id)) {
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) solid[i] = A(i) >= 128 ? 1 : 0;
    const keep = grow(grow(solid, 2, 0), 2 + 2, 1);
    for (let i = gy(STRAY_FROM) * W; i < W * H; i++) if (A(i) && !keep[i]) { px[i * 4 + 3] = 0; fixed++; }
  }
  const trim = !FRESH && TRIM[id];
  if (trim) {
    for (let y = trim.y0 - trim.fade; y < H; y++)
      for (let x = trim.x0; x <= trim.x1; x++) {
        const i = y * W + x;
        if (!A(i)) continue;
        const a = y >= trim.y0 ? 0 : Math.round(A(i) * ((trim.y0 - y) / (trim.fade + 1)));
        if (a !== A(i)) { px[i * 4 + 3] = a; fixed++; }
      }
  }
  // ── 前髮：補頭頂 ──
  const head = (i) => base[i * 4 + 3] > 128;
  const cap = new Uint8Array(W * H);
  for (let i = 0; i < gy(CAP_LINE) * W; i++) if (head(i) && A(i) < 128) cap[i] = 1;
  const hair = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) hair[i] = A(i) >= 128 ? 1 : 0;
  // 補的顏色取頭頂附近頭髮的平均亮度
  let sum = 0, cnt = 0;
  for (let i = 0; i < gy(CAP_LINE) * W; i++) if (A(i) === 255) { sum += px[i * 4]; cnt++; }
  const tone = cnt ? Math.round(sum / cnt) : 235;
  for (let i = 0; i < W * H; i++) {
    if (!cap[i]) continue;
    const edge = n4(i).some((j) => j >= 0 && !head(j) && !hair[j]);
    const c = edge ? OUTLINE : [tone, tone, tone];
    const a = A(i) / 255;
    for (let k = 0; k < 3; k++) px[i * 4 + k] = Math.round(px[i * 4 + k] * a + c[k] * (1 - a));
    px[i * 4 + 3] = 255;
    fixed++;
  }
  write(file, px);

  // ── 後髮 ──
  const sil = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) sil[i] = A(i) >= 100 ? 1 : 0;
  const back = fillHoles(sil);
  const fillTo = id in BACK_FILL_TO ? gy(BACK_FILL_TO[id]) : H - 1;
  // 計算頭部與身體在每一列的左右邊界（避免雙馬尾、馬尾在頭頂上方橫跨天空填滿）
  const bodyL = new Int16Array(H).fill(-1);
  const bodyR = new Int16Array(H).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (head(y * W + x)) {
        if (bodyL[y] < 0) bodyL[y] = x;
        bodyR[y] = x;
      }
    }
  }
  for (let y = 0; y <= fillTo; y++) {
    if (bodyL[y] < 0) continue;
    const hl = bodyL[y], hr = bodyR[y];
    let l = -1, r = -1;
    for (let x = hl; x <= hr; x++) if (back[y * W + x]) { if (l < 0) l = x; r = x; }
    if (l >= 0) for (let x = l; x <= r; x++) back[y * W + x] = 1;
  }
  // 填滿後再補一次洞（逐列填滿可能圍出新的洞），邊緣往內 1.5px 畫外框
  const filled = fillHoles(back);
  const inner = grow(filled, 2, 0);
  const out = Buffer.alloc(W * H * 4);
  let area = 0;
  for (let i = 0; i < W * H; i++) {
    if (!filled[i]) continue;
    const c = inner[i] ? [176, 176, 180] : OUTLINE;
    out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
    area++;
  }
  write(`${DIR}hairback_${id}.png`, out);
  console.log(`hair_${id}: 前髮修補 ${fixed} px；後髮 ${area} px`);
}
