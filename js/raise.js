// raise.js — 美少女夢工廠式的養成：月曆、每月 3 旬的行程、女孩的能力值與壓力
// 這裡只有純資料與純函式（方便測試）；畫面與流程在 schedule.js。
//
// 時間軸：四年級 9 月 → 九年級 6 月，共 70 個月（7、8 月是暑假）。
// 每年的 11 月／1 月／4 月／6 月是期中考／期末考，對應 story.js 的 24 章。

export const TOTAL_MONTHS = 70;
export const SLOTS = ["上旬", "中旬", "下旬"];
const CAL = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
const GRADE_LABEL = { 4: "四年級", 5: "五年級", 6: "六年級", 7: "七年級", 8: "八年級", 9: "九年級" };
// 學年內第幾個月（0＝9 月）→ 考試；章節序號 = 學年 × 4 + slot
const EXAM_AT = { 2: { kind: "mid", sem: 1, slot: 0 }, 4: { kind: "final", sem: 1, slot: 1 }, 7: { kind: "mid", sem: 2, slot: 2 }, 9: { kind: "final", sem: 2, slot: 3 } };

export function monthInfo(m) {
  const index = Math.max(0, Math.min(TOTAL_MONTHS - 1, m)),
    year = Math.floor(index / 12),
    within = index % 12,
    grade = 4 + year,
    calMonth = CAL[within],
    summer = within >= 10,
    sem = within <= 4 ? 1 : 2, // 暑假沿用下學期的題目範圍
    ex = EXAM_AT[within];
  return {
    index,
    grade,
    calMonth,
    summer,
    term: `${grade}-${sem}`,
    label: `${GRADE_LABEL[grade]}・${calMonth} 月${summer ? "（暑假）" : sem === 1 ? "・上學期" : "・下學期"}`,
    exam: ex ? { kind: ex.kind, chapterIndex: year * 4 + ex.slot, name: ex.kind === "mid" ? "期中考" : "期末考" } : null,
  };
}
// 第 k 章考試所在的月份（舊存檔換算用）
export function examMonth(k) {
  const year = Math.floor(k / 4),
    within = Number(Object.keys(EXAM_AT).find((w) => EXAM_AT[w].slot === k % 4));
  return year * 12 + within;
}
// 舊存檔：主線停在第 k 章 → 從上一場考試的下個月開始；24 章全考完＝已畢業（TOTAL_MONTHS）
export function startMonthForChapter(k) {
  return k <= 0 ? 0 : Math.min(TOTAL_MONTHS, examMonth(k - 1) + 1);
}

// ===== 女孩的能力值 =====
// 學科五項沿用題庫 id（語文／邏輯／科學／博學／外語），另加體力、藝術、氣質
export const STATS = {
  chinese: { name: "語文", icon: "📖" },
  math: { name: "邏輯", icon: "📐" },
  science: { name: "科學", icon: "🔬" },
  social: { name: "博學", icon: "🌏" },
  english: { name: "外語", icon: "🔤" },
  stamina: { name: "體力", icon: "💪" },
  art: { name: "藝術", icon: "🎨" },
  grace: { name: "氣質", icon: "🌸" },
};
export const STAT_MAX = 999;
export const STRESS_HIGH = 80; // 壓力太大：上課學不進去（能力值增加減半）

export function newRaiseState({ month = 0, academic = {} } = {}) {
  const stats = { stamina: 20, art: 10, grace: 10 };
  for (const k of ["chinese", "math", "science", "social", "english"]) stats[k] = Math.round(academic[k] ?? 10);
  return { month, stats, stress: 0, examResults: {}, pending: null };
}
export function normalizeRaise(r) {
  if (!r || typeof r !== "object") return null;
  const base = newRaiseState({ month: r.month });
  return {
    month: Number.isInteger(r.month) ? Math.max(0, Math.min(TOTAL_MONTHS, r.month)) : 0,
    stats: { ...base.stats, ...(r.stats || {}) },
    stress: clamp(Number(r.stress) || 0, 0, 100),
    examResults: { ...(r.examResults || {}) },
    pending: r.pending && Array.isArray(r.pending.slots) ? { ...r.pending } : null,
  };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ===== 行程 =====
// kind：lesson（真的考題）／class（才藝課，自動結算）／job（打工）／rest（休息、出遊）
// fee＝花費（負數＝賺錢）；gain＝能力值；stress＝壓力增減；need＝條件
export const LESSON_SUBJECTS = ["chinese", "math", "science", "social", "english"];
export const ACTIVITIES = [
  ...LESSON_SUBJECTS.map((s) => ({ id: `lesson:${s}`, kind: "lesson", subject: s, name: `${STATS[s].name}課`, icon: STATS[s].icon, stress: 6 })),
  { id: "piano", kind: "class", name: "鋼琴課", icon: "🎹", fee: 80, gain: { art: 5, grace: 1 }, stress: 5 },
  { id: "drawing", kind: "class", name: "繪畫教室", icon: "🖌️", fee: 60, gain: { art: 4 }, stress: 4 },
  { id: "etiquette", kind: "class", name: "禮儀課", icon: "🫖", fee: 80, gain: { grace: 5 }, stress: 5 },
  { id: "sports", kind: "class", name: "運動社團", icon: "🏃", fee: 30, gain: { stamina: 6 }, stress: 3 },
  { id: "store", kind: "job", name: "便利商店", icon: "🏪", fee: -120, gain: { stamina: 1 }, stress: 10 },
  { id: "cafejob", kind: "job", name: "貓咪咖啡廳", icon: "☕", fee: -150, gain: { grace: 1 }, stress: 9, need: { grace: 20 } },
  { id: "tutor", kind: "job", name: "小老師家教", icon: "🧑‍🏫", fee: -260, gain: { social: 1 }, stress: 8, need: { social: 40 } },
  { id: "home", kind: "rest", name: "在家休息", icon: "🛋️", fee: 0, stress: -15 },
  // 出遊：跟 trip.js 的 TRIPS 同 id，會拍一張相片收進相簿
  { id: "trip:park", kind: "rest", trip: "park", name: "公園散步", icon: "🌳", fee: 0, stress: -18 },
  { id: "trip:cafe", kind: "rest", trip: "cafe", name: "咖啡廳", icon: "☕", fee: 60, stress: -24 },
  { id: "trip:beach", kind: "rest", trip: "beach", name: "海邊玩水", icon: "🏖️", fee: 180, stress: -35, summer: true },
  { id: "trip:onsen", kind: "rest", trip: "onsen", name: "溫泉旅行", icon: "♨️", fee: 260, stress: -40 },
];
export const KIND_LABEL = { lesson: "📚 上課（答題）", class: "🎨 才藝課", job: "💼 打工", rest: "🌿 休息・出遊" };
export const activityById = (id) => ACTIVITIES.find((a) => a.id === id) || null;

// 上課學費：年級越高越貴
export function feeOf(a, month) {
  if (!a) return 0;
  if (a.kind === "lesson") return 30 + 10 * (monthInfo(month).grade - 4);
  return a.fee || 0;
}
// 這個月能不能選：條件、季節；回傳不能選的原因（null＝可以）
export function blockReason(a, raise) {
  if (a.summer && !monthInfo(raise.month).summer) return "只在暑假";
  for (const [k, v] of Object.entries(a.need || {}))
    if ((raise.stats[k] || 0) < v) return `${STATS[k].name}需 ${v}`;
  return null;
}
// 整個月要先準備的錢（打工的收入要做了才拿得到，所以不抵）
export function monthCost(ids, month) {
  return ids.reduce((sum, id) => sum + Math.max(0, feeOf(activityById(id), month)), 0);
}
// 上課的能力值：照答對比例給 2～10 點，年級越高略多；壓力太大減半
export function lessonGain(correct, total, month, stress) {
  const ratio = total ? correct / total : 0,
    base = 2 + Math.round(8 * ratio) + Math.floor((monthInfo(month).grade - 4) / 2);
  return Math.max(1, stress >= STRESS_HIGH ? Math.floor(base / 2) : base);
}
// 套用一格行程的結果（純函式，回傳新的 raise 與這格的變化，給畫面顯示）
// quiz：上課才有 { correct, total }
export function applySlot(raise, id, quiz = null) {
  const a = activityById(id);
  const r = normalizeRaise(raise);
  const delta = { money: -feeOf(a, r.month), stats: {}, stress: 0 };
  if (!a) return { raise: r, delta };
  if (a.kind === "lesson") delta.stats[a.subject] = lessonGain(quiz?.correct || 0, quiz?.total || 0, r.month, r.stress);
  else
    for (const [k, v] of Object.entries(a.gain || {}))
      delta.stats[k] = r.stress >= STRESS_HIGH && a.kind === "class" ? Math.max(1, Math.floor(v / 2)) : v;
  for (const [k, v] of Object.entries(delta.stats)) r.stats[k] = clamp((r.stats[k] || 0) + v, 0, STAT_MAX);
  const before = r.stress;
  r.stress = clamp(before + (a.stress || 0), 0, 100);
  delta.stress = r.stress - before;
  return { raise: r, delta };
}
// 一個月的格子：考試月的下旬固定是考試
export function slotPlan(month) {
  const exam = monthInfo(month).exam;
  return SLOTS.map((label, i) => ({ label, fixed: exam && i === 2 ? "exam" : null }));
}
