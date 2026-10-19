// tests/raise.test.mjs — 養成月曆與行程：node tests/raise.test.mjs
import assert from "node:assert/strict";
import { ACTIVITIES, STRESS_HIGH, TOTAL_MONTHS, applySlot, blockReason, examMonth, monthCost, monthInfo, newRaiseState, slotPlan, startMonthForChapter } from "../js/raise.js";
import { STORY } from "../js/story.js";

// 月曆：四年級 9 月開始、九年級 6 月結束；24 場考試一一對應主線章節，而且順序不亂
assert.equal(monthInfo(0).label, "四年級・9 月・上學期");
assert.equal(monthInfo(TOTAL_MONTHS - 1).grade, 9);
assert.equal(monthInfo(TOTAL_MONTHS - 1).calMonth, 6);
assert.ok(monthInfo(10).summer && monthInfo(11).summer && !monthInfo(12).summer);
const exams = [];
for (let m = 0; m < TOTAL_MONTHS; m++) if (monthInfo(m).exam) exams.push([m, monthInfo(m).exam.chapterIndex]);
assert.equal(exams.length, STORY.chapters.length);
exams.forEach(([m, k], i) => {
  assert.equal(k, i, `第 ${i} 場考試的章節序號`);
  assert.equal(examMonth(k), m);
  assert.equal(monthInfo(m).term, STORY.chapters[k].exam.term, `${STORY.chapters[k].exam.name} 的冊次`);
  assert.equal(monthInfo(m).exam.kind, STORY.chapters[k].exam.kind);
});
// 舊存檔：停在第 k 章 → 從第 k-1 場考試的下個月開始，而且第 k 場考試還在前面
assert.equal(startMonthForChapter(0), 0);
for (let k = 1; k < 24; k++) {
  const m = startMonthForChapter(k);
  assert.ok(m > examMonth(k - 1) && m <= examMonth(k), `第 ${k} 章換算到第 ${m} 月`);
}
assert.equal(startMonthForChapter(24), TOTAL_MONTHS, "24 章都考完＝已畢業");
// 考試月的下旬固定是考試
assert.equal(slotPlan(2)[2].fixed, "exam");
assert.equal(slotPlan(0)[2].fixed, null);

// 行程結算
let r = newRaiseState({ academic: { math: 15 } });
assert.equal(r.stats.math, 15);
let out = applySlot(r, "piano");
assert.deepEqual(out.delta.stats, { art: 5, grace: 1 });
assert.equal(out.delta.money, -80);
assert.equal(out.raise.stress, 5);
assert.equal(r.stress, 0, "applySlot 不改原物件");
out = applySlot(r, "store");
assert.equal(out.delta.money, 120, "打工賺錢");
// 上課：全對比全錯多；壓力太大減半
const full = applySlot(r, "lesson:math", { correct: 3, total: 3 }).delta.stats.math,
  none = applySlot(r, "lesson:math", { correct: 0, total: 3 }).delta.stats.math,
  stressed = applySlot({ ...r, stress: STRESS_HIGH }, "lesson:math", { correct: 3, total: 3 }).delta.stats.math;
assert.ok(full > none && none >= 1);
assert.equal(stressed, Math.floor(full / 2));
// 休息：壓力不會低於 0
assert.equal(applySlot(r, "home").raise.stress, 0);
// 學費：年級越高越貴；只算要先付的錢
assert.ok(monthCost(["lesson:math"], 60) > monthCost(["lesson:math"], 0));
assert.equal(monthCost(["store", "piano", "home"], 0), 80);
// 條件與季節
assert.equal(blockReason(ACTIVITIES.find((a) => a.id === "tutor"), r), "博學需 40");
assert.equal(blockReason(ACTIVITIES.find((a) => a.id === "trip:beach"), { ...r, month: 0 }), "只在暑假");
assert.equal(blockReason(ACTIVITIES.find((a) => a.id === "trip:beach"), { ...r, month: 10 }), null);
console.log("raise ✅");

// 每月隨機事件
{
  const { EVENTS, applyEventChoice, choiceBlocked, eventById, monthInfo: mi, pickMonthEvent } = await import("../js/raise.js");
  const base = newRaiseState();
  assert.ok(EVENTS.every((e) => e.choices.length === 2), "每個事件都是二選一");
  assert.equal(new Set(EVENTS.map((e) => e.id)).size, EVENTS.length);
  // 平常月份：亂數沒過門檻就沒事
  assert.equal(pickMonthEvent(base, 3, () => 0.99), null, "12 月沒有季節事件");
  assert.ok(pickMonthEvent(base, 3, () => 0));
  // 季節事件：2 月一定有事件，而且只會抽到條件成立的
  const feb = 5;
  assert.equal(mi(feb).calMonth, 2);
  assert.ok(pickMonthEvent(base, feb, () => 0.99));
  for (let x = 0; x < 1; x += 0.05) {
    const e = pickMonthEvent(base, 1, () => x);
    if (e) assert.ok(e.when(base, mi(1)), `${e.id} 條件成立`);
  }
  assert.ok(!eventById("cold").when(base, mi(1)) && eventById("cold").when({ ...base, stress: 70 }, mi(1)));
  // 選項效果：能力值不會變負的、壓力夾在 0～100、不改原物件
  const weak = { ...base, stats: { ...base.stats, stamina: 1 }, stress: 95 };
  const out = applyEventChoice(weak, "cold", 1);
  assert.equal(out.raise.stats.stamina, 0);
  assert.equal(out.delta.stats.stamina, -1);
  assert.equal(out.raise.stress, 100);
  assert.equal(weak.stress, 95);
  assert.equal(applyEventChoice(base, "redenvelope", 0).delta.money, 300);
  assert.ok(choiceBlocked(eventById("cold").choices[0], 50) && !choiceBlocked(eventById("cold").choices[0], 80));
  assert.equal(applyEventChoice({ ...base, event: "cold" }, "wallet", 0).raise.event, "cold", "event 欄位由 schedule.js 清掉");
  console.log("events ✅");
}

// 畢業結局
{
  const { ENDINGS, ENDING_STAT_MIN, graduationEnding: end, normalizeRaise: norm } = await import("../js/raise.js");
  const g = (stats = {}, extra = {}) => ({ ...newRaiseState(), stats: { ...newRaiseState().stats, ...stats }, ...extra });
  assert.equal(end(g()).id, "ordinary");
  assert.equal(end(g({ art: ENDING_STAT_MIN })).id, "art");
  assert.equal(end(g({ art: ENDING_STAT_MIN - 1 })).id, "ordinary");
  assert.equal(end(g({ math: 300, english: 200 })).id, "math", "最高的那項");
  assert.equal(end(g({ math: 300 }, { stress: 95 })).id, "burnout", "壓力太大優先");
  const allA = { chinese: 160, math: 160, science: 160, social: 160, english: 160 },
    passes = Object.fromEntries(Array.from({ length: 20 }, (_, k) => [k, { pass: true }]));
  assert.equal(end(g(allA, { examResults: passes })).id, "honors");
  assert.equal(end(g(allA)).id, "chinese", "考試沒過夠就不是榮譽畢業");
  assert.equal(end(g({ grace: 60 }), 3000).id, "cafeowner");
  // 每個能力值都有對應的專長結局
  for (const k of Object.keys(newRaiseState().stats)) assert.ok(ENDINGS.some((e) => e.id === k), k);
  assert.equal(norm({ month: 70, ending: "art" }).ending, "art");
  console.log("endings ✅");
}
