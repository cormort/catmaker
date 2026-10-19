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
  return { month, stats, stress: 0, examResults: {}, pending: null, event: null };
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
    event: typeof r.event === "string" ? r.event : null, // 月底抽到、還沒選的事件
    ending: typeof r.ending === "string" ? r.ending : null, // 畢業那一刻定下的結局
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
  const before = r.stress,
    add = a.stress > 0 ? Math.max(1, a.stress - staminaRelief(r)) : a.stress || 0;
  r.stress = clamp(before + add, 0, 100);
  delta.stress = r.stress - before;
  return { raise: r, delta };
}
// 體力好比較不累：每 50 點體力，上課／才藝／打工的壓力 −1（最多 −4，至少還是 +1）
export const staminaRelief = (raise) => Math.min(4, Math.floor((raise.stats.stamina || 0) / 50));
// 一個月的格子：考試月的下旬固定是考試
export function slotPlan(month) {
  const exam = monthInfo(month).exam;
  return SLOTS.map((label, i) => ({ label, fixed: exam && i === 2 ? "exam" : null }));
}

// ===== 每月隨機事件 =====
// 月底結算後有機會遇到一件事，二選一。when(r, info)＝能不能發生；weight 越大越常抽到。
// 選項效果：stats（可以是負的）、stress、money
export const EVENT_CHANCE = 0.4;
export const EVENTS = [
  { id: "cold", icon: "🤧", title: "感冒了", text: "壓力太大，身體撐不住，喉嚨好痛…", weight: 6, when: (r) => r.stress >= 60,
    choices: [{ label: "去看醫生、好好睡", money: -80, stress: -20 }, { label: "硬撐著上學", stats: { stamina: -3 }, stress: 10 }] },
  { id: "redenvelope", icon: "🧧", title: "過年領紅包", text: "阿公阿嬤包了大紅包！", weight: 20, when: (r, i) => i.calMonth === 2,
    choices: [{ label: "存起來", money: 300 }, { label: "買新年禮物送貓咪", money: 150, stress: -10 }] },
  { id: "moon", icon: "🥮", title: "中秋烤肉", text: "鄰居邀請一起在社區烤肉賞月。", weight: 20, when: (r, i) => i.calMonth === 9,
    choices: [{ label: "幫忙烤肉", stats: { stamina: 2 }, stress: -10 }, { label: "在旁邊讀月亮的故事", stats: { chinese: 2 }, stress: -6 }] },
  { id: "sportsday", icon: "🏅", title: "運動會", text: "班上的大隊接力還缺一個人！", weight: 12, when: (r, i) => i.calMonth === 10,
    choices: [{ label: "報名接力", stats: { stamina: 5 }, stress: 4 }, { label: "當啦啦隊", stats: { grace: 2 }, stress: -4 }] },
  { id: "talentshow", icon: "🎤", title: "才藝表演會", text: "老師問你要不要上台表演。", weight: 5, when: (r, i) => !i.summer && r.stats.art >= 30,
    choices: [{ label: "上台表演", stats: { art: 4, grace: 2 }, stress: 6 }, { label: "在台下欣賞", stats: { art: 1 }, stress: -4 }] },
  { id: "scout", icon: "☕", title: "咖啡廳店長的邀請", text: "貓咪咖啡廳店長覺得你很有氣質，想請你週末來幫忙。", weight: 4, when: (r) => r.stats.grace >= 40,
    choices: [{ label: "去試做一天", money: 200, stats: { grace: 2 }, stress: 8 }, { label: "婉拒，專心念書", stress: -2 }] },
  { id: "wallet", icon: "👛", title: "撿到錢包", text: "放學路上撿到一個錢包，裡面有學生證。", weight: 4, when: () => true,
    choices: [{ label: "交給老師", stats: { grace: 3 } }, { label: "照學生證去找失主", stats: { social: 2 }, stress: 2 }] },
  { id: "library", icon: "📚", title: "圖書館的新書", text: "圖書館進了一整櫃新書。", weight: 5, when: (r, i) => !i.summer,
    choices: [{ label: "借一疊回家讀", stats: { chinese: 3, social: 1 }, stress: 3 }, { label: "借一本圖鑑就好", stats: { science: 1 }, stress: -2 }] },
  { id: "penpal", icon: "✉️", title: "外國筆友", text: "英文老師幫班上配對了外國筆友。", weight: 4, when: (r, i) => i.grade >= 5,
    choices: [{ label: "認真寫一封長信", stats: { english: 3 }, stress: 3 }, { label: "畫一張圖寄過去", stats: { art: 2 } }] },
  { id: "catgift", icon: "🐟", title: "貓咪的禮物", text: "貓咪叼了一條小魚乾放在你的枕頭上。", weight: 5, when: () => true,
    choices: [{ label: "抱抱貓咪", stress: -8 }, { label: "陪牠玩一下午", stats: { stamina: 1 }, stress: -12 }] },
  { id: "summercamp", icon: "🏕️", title: "科學夏令營", text: "暑假有一個三天兩夜的科學營。", weight: 10, when: (r, i) => i.summer,
    choices: [{ label: "參加（−200G）", money: -200, stats: { science: 4, stamina: 2 }, stress: -5 }, { label: "在家看星星", stats: { science: 1 }, stress: -8 }] },
];
export const eventById = (id) => EVENTS.find((e) => e.id === id) || null;
// rand：0～1 的亂數函式（測試可以傳固定的）
export function pickMonthEvent(raise, month, rand = Math.random) {
  const info = monthInfo(month),
    pool = EVENTS.filter((e) => e.when(raise, info));
  const seasonal = pool.some((e) => e.weight >= 10); // 節日、季節事件一定會發生
  if (!pool.length || (!seasonal && rand() >= EVENT_CHANCE)) return null;
  let roll = rand() * pool.reduce((s, e) => s + e.weight, 0);
  return pool.find((e) => (roll -= e.weight) < 0) || pool[pool.length - 1];
}
// 錢不夠就不能選要花錢的選項
export const choiceBlocked = (choice, coins) => (choice.money || 0) < 0 && coins < -choice.money;
export function applyEventChoice(raise, eventId, idx) {
  const r = normalizeRaise(raise),
    c = eventById(eventId)?.choices[idx],
    delta = { money: c?.money || 0, stats: {}, stress: 0 };
  if (!c) return { raise: r, delta };
  for (const [k, v] of Object.entries(c.stats || {})) {
    const before = r.stats[k] || 0;
    r.stats[k] = clamp(before + v, 0, STAT_MAX);
    delta.stats[k] = r.stats[k] - before;
  }
  const before = r.stress;
  r.stress = clamp(before + (c.stress || 0), 0, 100);
  delta.stress = r.stress - before;
  return { raise: r, delta };
}

// ===== 畢業結局 =====
// 九年級 6 月結束時依能力值、考試、壓力、存款決定，順序＝優先度
export const ENDING_STAT_MIN = 150; // 最高的那項要到這裡才算「專長」
const ACADEMIC = LESSON_SUBJECTS;
export const ENDINGS = [
  { id: "burnout", icon: "😴", title: "累壞了的畢業典禮", text: "撐到畢業了，可是好累好累…暑假先好好睡一覺，再慢慢想以後要做什麼吧。", cat: "辛苦了，這個暑假換我照顧你喵。" },
  { id: "honors", icon: "🏆", title: "星讀學園榮譽畢業生", text: "考試幾乎場場及格，每一科都很拿手，站上台領了榮譽畢業獎！", cat: "我就知道你做得到，我是全學園最驕傲的學習貓喵！" },
  { id: "cafeowner", icon: "☕", title: "貓咪咖啡廳的小老闆", text: "存下來的錢和打工學到的待客之道，讓你開了一間自己的貓咪咖啡廳。", cat: "我要當招牌貓，薪水是小魚乾喵。" },
  { id: "chinese", icon: "📖", title: "少女作家", text: "寫的故事得了文學獎，出版社說想幫你出第一本書。", cat: "書裡的貓咪是我對吧？要寫帥一點喵。" },
  { id: "math", icon: "📐", title: "數學競賽冠軍", text: "在數學競賽拿下金牌，老師推薦你進數理資優班。", cat: "你算題目的速度比我抓逗貓棒還快喵。" },
  { id: "science", icon: "🔬", title: "未來的科學家", text: "科展作品被選為全國第一名，研究室的教授邀請你暑假去參觀。", cat: "下次研究一下為什麼貓咪喜歡紙箱喵。" },
  { id: "social", icon: "🌏", title: "博學的小導覽員", text: "博物館請你當暑期小導覽員，什麼問題都難不倒你。", cat: "帶我去看古埃及的貓神像喵！" },
  { id: "english", icon: "🔤", title: "國際交換學生", text: "流利的外語讓你拿到出國交換的機會，要去認識全世界了。", cat: "記得每天視訊給我看喵，Meow!" },
  { id: "stamina", icon: "🏃", title: "運動校隊王牌", text: "高中的體育班搶著要你，下一個目標是全國運動會。", cat: "你跑得比我追蝴蝶還快了喵。" },
  { id: "art", icon: "🎨", title: "藝術新星", text: "畫作和琴聲都受到肯定，考上了藝術才能班。", cat: "可以幫我畫一張帥氣的肖像嗎喵？" },
  { id: "grace", icon: "🌸", title: "優雅的小淑女", text: "一舉一動都好有氣質，被選為畢業典禮的致詞代表。", cat: "連我都想學你怎麼優雅地喝水了喵。" },
  { id: "ordinary", icon: "🐱", title: "平凡又幸福的畢業", text: "沒有什麼驚天動地的大事，但每一天都過得很開心，最好的朋友一直都在身邊。", cat: "能陪你長大，是我最幸福的事喵。" },
];
export const endingById = (id) => ENDINGS.find((e) => e.id === id) || null;
export const examPasses = (raise) => Object.values(raise.examResults || {}).filter((x) => x?.pass).length;
// 專長：能力值最高的一項（同分取 STATS 的順序）
export function topStat(raise) {
  return Object.keys(STATS).reduce((best, k) => ((raise.stats[k] || 0) > (raise.stats[best] || 0) ? k : best));
}
export function graduationEnding(raise, coins = 0) {
  const s = raise.stats,
    top = topStat(raise),
    pick = (id) => endingById(id);
  if (raise.stress >= 90) return pick("burnout");
  if (examPasses(raise) >= 20 && ACADEMIC.every((k) => (s[k] || 0) >= 120)) return pick("honors");
  if (coins >= 3000 && (s.grace || 0) >= 60) return pick("cafeowner");
  if ((s[top] || 0) >= ENDING_STAT_MIN) return pick(top);
  return pick("ordinary");
}
