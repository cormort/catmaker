// schedule.js — 📅 排行程：美少女夢工廠式的月份回合
// 每個月排 3 旬（上課＝真的答題、才藝課、打工、休息・出遊），按「開始這個月」才會往前走；
// 考試月的下旬固定是期中／期末考。資料與計算在 raise.js，這裡只有畫面與流程。
import { audio } from "../audio.js";
import { startExamSession, startLessonQuiz } from "./academy.js";
import { defaultAvatar, normalizeAvatar, renderAvatar } from "./avatar.js";
import { activePetKey, celebrateChapter, petCoins, petData, petName, petStats, petSubnavHtml, recordStoryEvent, savePetData, showPetHome } from "./pet.js";
import { ACTIVITIES, KIND_LABEL, SLOTS, STATS, STRESS_HIGH, TOTAL_MONTHS, activityById, applySlot, blockReason, feeOf, monthCost, monthInfo, newRaiseState, normalizeRaise, slotPlan, startMonthForChapter } from "./raise.js";
import { STORY, currentChapter, examPassed, normalizeStory, skipChapter } from "./story.js";
import { tripPhoto } from "./trip.js";
import { $, escapeHtml, showSheet } from "./ui.js";

// 第一次進入（或舊存檔）：女孩的學科能力沿用原本貓咪的五科，月份從主線停的那一章換算
export function raiseState() {
  let r = normalizeRaise(petData.raise);
  if (!r) {
    const academic = petData.initialized ? petStats(activePetKey()) : {};
    r = newRaiseState({ month: startMonthForChapter(normalizeStory(petData.story).chapterIndex), academic });
  }
  petData.raise = r;
  return r;
}
export function raiseMonth() {
  return raiseState().month;
}
function saveRaise(r) {
  petData.raise = r;
  savePetData();
}
const graduated = (r) => r.month >= TOTAL_MONTHS;
const STAT_BAR_MAX = 200; // 計量表滿格（數值可以超過，條就是滿的）

// 草稿：這個月每一旬選了什麼（考試格是 "exam"）；換月時沿用上個月的選擇，省得每次重排
function draftOf(r) {
  const plan = slotPlan(r.month),
    prev = Array.isArray(petData.raiseDraft) ? petData.raiseDraft : [];
  return plan.map((p, i) => (p.fixed ? "exam" : activityById(prev[i]) && !blockReason(activityById(prev[i]), r) ? prev[i] : ""));
}

function statsHtml(r) {
  const rows = Object.entries(STATS)
    .map(([k, s]) => {
      const v = r.stats[k] || 0;
      return `<div class="pm-gauge"><span>${s.icon} ${s.name}</span><i style="--pm-pct:${Math.min(100, (v / STAT_BAR_MAX) * 100)}%"></i><b>${v}</b></div>`;
    })
    .join("");
  return `<div class="sched-stats">${rows}
    <div class="pm-gauge sched-stress${r.stress >= STRESS_HIGH ? " high" : ""}"><span>😣 壓力</span><i style="--pm-pct:${r.stress}%"></i><b>${r.stress}</b></div>
  </div>`;
}
function optionLabel(a, month) {
  const fee = feeOf(a, month);
  const money = fee > 0 ? `−${fee}G` : fee < 0 ? `+${-fee}G` : "免費";
  const gain = a.kind === "lesson" ? `${STATS[a.subject].name}↑（看答對幾題）` : Object.entries(a.gain || {}).map(([k, v]) => `${STATS[k].name}+${v}`).join(" ");
  const stress = a.stress ? `壓力${a.stress > 0 ? "+" : ""}${a.stress}` : "";
  return `${a.icon} ${a.name}｜${money}${gain ? `・${gain}` : ""}${stress ? `・${stress}` : ""}`;
}
function slotSelectHtml(i, value, r) {
  const groups = Object.entries(KIND_LABEL)
    .map(([kind, label]) => {
      const opts = ACTIVITIES.filter((a) => a.kind === kind)
        .map((a) => {
          const why = blockReason(a, r);
          return `<option value="${a.id}"${a.id === value ? " selected" : ""}${why ? " disabled" : ""}>${escapeHtml(optionLabel(a, r.month))}${why ? `（${why}）` : ""}</option>`;
        })
        .join("");
      return `<optgroup label="${label}">${opts}</optgroup>`;
    })
    .join("");
  return `<select data-sched-slot="${i}" aria-label="${SLOTS[i]}的行程"><option value="">— 選擇行程 —</option>${groups}</select>`;
}

export function schedulePageHtml() {
  const r = raiseState(),
    name = petName(activePetKey());
  if (graduated(r))
    return `${petSubnavHtml("schedule")}<div class="pm-panel sched-panel"><div class="pm-strip"><span>🎓 畢業了</span><span>${TOTAL_MONTHS}/${TOTAL_MONTHS} 月</span></div>
      <p class="unit-hint">九年級畢業了！${escapeHtml(name)}陪你走完六年。結局會在之後的版本加入喵。</p>${statsHtml(r)}</div>`;
  const info = monthInfo(r.month),
    draft = draftOf(r),
    chosen = draft.filter((id) => id && id !== "exam"),
    cost = monthCost(chosen, r.month),
    ready = draft.every(Boolean),
    poor = cost > petCoins(),
    exam = info.exam ? STORY.chapters[info.exam.chapterIndex]?.exam : null;
  const slots = slotPlan(r.month)
    .map(
      (p, i) =>
        `<div class="sched-slot"><b>${p.label}</b>${
          p.fixed ? `<div class="sched-fixed">📝 ${escapeHtml(exam?.name || "考試")}（${exam?.count} 題答對 ${exam?.pass} 題及格）</div>` : slotSelectHtml(i, draft[i], r)
        }</div>`,
    )
    .join("");
  const avatar = renderAvatar(normalizeAvatar(petData.avatar || defaultAvatar()), { size: 120, grade: info.grade });
  const resume = r.pending ? `<button class="pm-bigbtn" data-sched-resume="1">▶ 繼續這個月（${SLOTS[r.pending.idx] || "結算"}）</button>` : "";
  return `${petSubnavHtml("schedule")}<div class="pm-panel sched-panel">
    <div class="pm-strip"><span>📅 ${escapeHtml(info.label)}</span><span>第 ${r.month + 1}/${TOTAL_MONTHS} 月</span></div>
    <div class="sched-hero"><div class="sched-avatar">${avatar}</div>${statsHtml(r)}</div>
    <div class="pm-goldrow"><span class="pm-label">GOLD</span><span class="pm-vals">${petCoins()} G</span><span class="pm-label">本月花費</span><span class="pm-vals">${cost} G</span></div>
    ${info.exam ? `<p class="sched-note">📝 這個月下旬是 <b>${escapeHtml(exam?.name || "")}</b>，前兩旬可以先上課衝刺喵！</p>` : ""}
    ${r.stress >= STRESS_HIGH ? `<p class="sched-note warn">😣 壓力太大了，上課和才藝課只學得進一半，先排休息吧。</p>` : ""}
    ${resume || `<div class="sched-slots">${slots}</div>
    <button class="pm-bigbtn" data-sched-run="1"${ready && !poor ? "" : " disabled"}>${!ready ? "先把三旬都排好" : poor ? "🪙 金幣不夠，改排打工吧" : "▶ 開始這個月"}</button>`}
    <p class="unit-hint">🐱 ${escapeHtml(name)}：上課會出這個月的課本範圍（${escapeHtml(info.term)}）的題目，答對越多長越多；打工賺錢但壓力大，記得排休息。</p>
  </div>`;
}

// ---------- 跑一個月 ----------
function runMonth() {
  const r = raiseState(),
    draft = draftOf(r);
  if (!draft.every(Boolean) || monthCost(draft.filter((id) => id !== "exam"), r.month) > petCoins()) return;
  r.pending = { month: r.month, slots: draft, idx: 0, log: [] };
  saveRaise(r);
  nextSlot();
}
function nextSlot() {
  const r = raiseState(),
    p = r.pending;
  if (!p) return showPetHome();
  if (p.idx >= p.slots.length) return finishMonth();
  const id = p.slots[p.idx];
  if (id === "exam") {
    // 主線已經考完（舊存檔進度比月曆快）就跳過這格
    if (!currentChapter(petData.story)?.exam) {
      r.pending = { ...p, idx: p.idx + 1 };
      saveRaise(r);
      return nextSlot();
    }
    return startExamSession({ onDone: doneExam });
  }
  const a = activityById(id);
  if (a?.kind === "lesson") return startLessonQuiz(a.subject, monthInfo(r.month).term, (quiz) => doneSlot(id, quiz));
  doneSlot(id, null);
}
function deltaHtml(delta) {
  const parts = Object.entries(delta.stats).map(([k, v]) => `${STATS[k].icon} ${STATS[k].name} +${v}`);
  if (delta.money) parts.push(`🪙 ${delta.money > 0 ? "+" : ""}${delta.money}G`);
  if (delta.stress) parts.push(`😣 壓力 ${delta.stress > 0 ? "+" : ""}${delta.stress}`);
  return `<div class="quiz-rewards-row">${parts.map((x) => `<span class="quiz-reward-pill">${x}</span>`).join("")}</div>`;
}
function doneSlot(id, quiz) {
  const before = raiseState(),
    a = activityById(id),
    slot = SLOTS[before.pending.idx];
  const { raise: r, delta } = applySlot(before, id, quiz);
  r.pending = { ...before.pending, idx: before.pending.idx + 1, log: [...before.pending.log, { id, delta }] };
  petData.coins = Math.max(0, petCoins() + delta.money);
  saveRaise(r);
  const photo = a?.trip ? tripPhoto(a.trip) : "";
  const quizLine = quiz ? `<p class="unit-hint">答對 ${quiz.correct} / ${quiz.total} 題${r.stress >= STRESS_HIGH ? "（壓力太大，只學進一半）" : ""}</p>` : "";
  if (delta.money > 0) audio.playCoin?.();
  showSheet(`${slot}・${a?.icon || ""} ${a?.name || ""}`, `${photo}${quizLine}${deltaHtml(delta)}`, "繼續", nextSlot);
}
function doneExam({ correct, total, exam }) {
  const r = raiseState(),
    k = normalizeStory(petData.story).chapterIndex,
    pass = examPassed(correct, exam);
  r.examResults[k] = { correct, total, pass };
  r.stress = Math.min(100, r.stress + 8); // 考試很累
  r.pending = { ...r.pending, idx: r.pending.idx + 1, log: [...r.pending.log, { id: "exam", pass }] };
  saveRaise(r);
  const body = `<div class="exam-banner ${pass ? "pass" : "fail"}">${pass ? "🎉 及格！" : "😿 不及格…"} ${escapeHtml(exam.name)}：答對 ${correct} / ${total} 題（及格需 ${exam.pass} 題）</div>
    <p class="unit-hint">${pass ? "考過了，有獎勵喵！" : "時間不會等人，下一場考試已經排上月曆。錯的題目都在錯題本裡喵。"}・😣 壓力 +8</p>`;
  if (pass) {
    const { completed } = recordStoryEvent("exam", 1);
    showSheet(`📝 ${exam.name}`, body, "領獎勵", () => celebrateChapter(completed, nextSlot));
  } else {
    petData.story = skipChapter(petData.story);
    savePetData();
    showSheet(`📝 ${exam.name}`, body, "繼續", nextSlot);
  }
}
function finishMonth() {
  const r = raiseState(),
    done = monthInfo(r.month),
    total = { money: 0, stats: {} };
  for (const { delta } of r.pending.log)
    if (delta) {
      total.money += delta.money;
      for (const [s, v] of Object.entries(delta.stats)) total.stats[s] = (total.stats[s] || 0) + v;
    }
  petData.raiseDraft = r.pending.slots;
  r.pending = null;
  r.month += 1;
  saveRaise(r);
  audio.playJingle?.();
  const next = graduated(r) ? "🎓 九年級畢業！" : `下個月：${monthInfo(r.month).label}`;
  showSheet(
    `🗓️ ${done.label} 結束`,
    `${deltaHtml({ ...total, stress: 0 })}<p class="unit-hint">😣 目前壓力 ${r.stress}・🪙 ${petCoins()}G</p><p class="unit-hint">${next}</p>`,
    "排下個月",
    showPetHome,
  );
}

// ---------- 事件 ----------
export function handleScheduleClick(e) {
  if (e.target.closest("[data-sched-run]")) {
    runMonth();
    return true;
  }
  if (e.target.closest("[data-sched-resume]")) {
    nextSlot();
    return true;
  }
  return false;
}
document.addEventListener("change", (e) => {
  const sel = e.target.closest?.("[data-sched-slot]");
  if (!sel) return;
  const r = raiseState(),
    draft = draftOf(r);
  draft[Number(sel.dataset.schedSlot)] = sel.value;
  petData.raiseDraft = draft;
  savePetData();
  showPetHome();
});
