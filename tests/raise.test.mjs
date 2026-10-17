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
