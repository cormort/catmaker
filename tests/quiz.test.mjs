// tests/quiz.test.mjs — 驗證 quizzes/ 下所有學科題庫符合標準格式
// 用法：node tests/quiz.test.mjs
import { readFileSync } from "node:fs";
import {
  GRADES,
  MISTAKE_LIMIT,
  buildExamQuestions,
  exportMistakes,
  importMistakes,
  PUBLISHERS,
  QUIZ_SUBJECTS,
  SUBJECT_PUBLISHERS,
  filterCount,
  TERMS,
  calculateQuizResult,
  gradeCounts,
  isCorrect,
  matchesFilter,
  mistakeCounts,
  mistakesFor,
  mistakesToQuestions,
  pickRound,
  publisherCounts,
  recordMistake,
  termCounts,
  validateSubject,
} from "../js/quiz.js";

const dir = new URL("../quizzes/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir), "utf8"));
let failures = 0;
const check = (cond, label) => {
  if (!cond) failures++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
};

console.log("=== 題庫格式 ===");
const ids = new Set();
for (const file of read("index.json").subjects) {
  const subject = read(file),
    errors = validateSubject(subject);
  check(!errors.length, `${file}（${subject.questions?.length ?? 0} 題）${errors.length ? "：" + errors.join("；") : ""}`);
  check(file === `${subject.id}.json` && !ids.has(subject.id), `${file} 檔名＝id 且不重複`);
  ids.add(subject.id);
  const round = pickRound(subject);
  check(round.length === subject.roundSize && new Set(round).size === round.length, `${file} 抽題數正確且不重複`);
  check(round.every((q) => isCorrect(q, q.answer)), `${file} 正解判定正確`);
}

console.log("=== 程度（年級）分佈 ===");
const gradeNums = GRADES.map((g) => g.grade);
for (const file of read("index.json").subjects) {
  const subject = read(file);
  const counts = gradeCounts(subject);
  check(
    gradeNums.every((g) => counts[g] >= subject.roundSize),
    `${file} 每個程度都有 ≥${subject.roundSize} 題（${gradeNums.map((g) => `${g}:${counts[g]}`).join(" ")}）`,
  );
  const g = gradeNums[1];
  const round = pickRound(subject, g);
  check(
    round.length === subject.roundSize && round.every((q) => q.grade === g) && new Set(round).size === round.length,
    `${file} 抽題只抽指定程度且不重複（${g}）`,
  );
  check(
    calculateQuizResult(subject.id, 3, 3, gradeNums[gradeNums.length - 1]).statGain >
      calculateQuizResult(subject.id, 3, 3, gradeNums[0]).statGain,
    `${file} 程度越高獎勵越多`,
  );
}

console.log("=== 冊次與版本 ===");
for (const file of read("index.json").subjects) {
  const subject = read(file);
  const pubs = SUBJECT_PUBLISHERS[subject.id] || PUBLISHERS;
  // 不限冊次、不限版本時，每個科目都要出得了題（沒選範圍時的保底）
  check(
    filterCount(subject, {}) >= subject.roundSize,
    `${file} 不限範圍時可出題（${filterCount(subject, {})} 題 ≥ roundSize ${subject.roundSize}）`,
  );
  let full = 0;
  const gaps = [];
  for (const { key } of TERMS) {
    for (const p of pubs) {
      const n = filterCount(subject, { term: key, publisher: p });
      if (n >= subject.roundSize) {
        full++;
        const round = pickRound(subject, { term: key, publisher: p });
        check(
          round.length === subject.roundSize &&
            round.every((q) => matchesFilter(q, { term: key, publisher: p })),
          `${file} ${key}・${p} 抽題只抽該範圍且不重複`,
        );
      } else {
        gaps.push(`${key}・${p}(${n})`);
      }
    }
  }
  check(full >= 1, `${file} 至少有一個（冊次,版本）組合能直接排課測驗`);
  console.log(`     ↳ 可直接排課的組合 ${full} 個／${TERMS.length * pubs.length}；題目不足的：${gaps.slice(0, 8).join(" ")}${gaps.length > 8 ? " …" : ""}`);
  // 版本過濾：標了 versions 的題目要被其他版本排除（terms 的題目由上面的組合測試涵蓋）
  const sample = { ...subject, questions: [{ ...subject.questions[0], versions: ["康軒"] }] };
  delete sample.questions[0].terms;
  delete sample.questions[0].term;
  check(
    matchesFilter(sample.questions[0], { publisher: "康軒" }) &&
      !matchesFilter(sample.questions[0], { publisher: "翰林" }),
    `${file} versions 標記會排除其他版本`,
  );
}

console.log("=== 驗證器會擋下錯誤題目 ===");
const good = read("science.json");
const bad = (patch) =>
  validateSubject({ ...good, questions: [{ ...good.questions[0], ...patch }, ...good.questions.slice(1)] }).length > 0;
check(!validateSubject(good).length, "合法題庫通過");
check(bad({ answer: 9 }), "answer 超出範圍");
check(bad({ type: "nope" }), "未知題型");
check(bad({ options: ["只有一個"] }), "選項少於 2 個");
check(bad({ options: ["a", "b", "c", "d", "e"] }), "選項超過 4 個");
check(bad({ id: good.questions[1].id }), "題目 id 重複");
check(bad({ explain: "" }), "缺少解說");
check(bad({ tip: "" }), "tip 空白");
check(bad({ grade: 99 }), "grade 超出範圍");
check(bad({ grade: undefined }), "缺少 grade（程度）");
check(validateSubject({ ...good, roundSize: 999 }).length > 0, "roundSize 大於題數");
check(validateSubject({ ...good, color: "red" }).length > 0, "顏色格式錯誤");

console.log("=== 結算 ===");
check(calculateQuizResult("math", 3, 3).perfect && calculateQuizResult("math", 2, 3).pass, "3 題答對 2 題算合格");
check(!calculateQuizResult("math", 1, 3).pass, "3 題答對 1 題不合格");

console.log("=== 錯題本 ===");
{
  const mk = (id, sub = "math", at = 1) => ({ subjectId: sub, questionId: id, at });
  let book = [];
  book = recordMistake(book, mk("math-001", "math", 1));
  book = recordMistake(book, mk("math-002", "math", 2));
  check(book.length === 2 && book[0].questionId === "math-002", "錯題依新到舊排序");
  book = recordMistake(book, mk("math-001", "math", 3));
  check(book.length === 2 && book[0].questionId === "math-001" && book[0].at === 3, "同一題再錯只留最新一次");
  book = recordMistake(book, mk("chinese-001", "chinese", 4));
  const counts = mistakeCounts(book);
  check(counts.math === 2 && counts.chinese === 1, "各科錯題數統計正確");
  check(mistakesFor(book, "math").length === 2, "可依科目篩選錯題");
  // 上限
  let big = [];
  for (let i = 0; i < MISTAKE_LIMIT + 20; i++) big = recordMistake(big, mk(`math-x${i}`));
  check(big.length === MISTAKE_LIMIT, `錯題本上限 ${MISTAKE_LIMIT} 筆`);
  check(recordMistake(book, {}).length === 3, "壞資料不會寫進錯題本");
  // 重練：過濾已刪除的題目、去重、依 roundSize 取前幾題
  const subject = read("math.json");
  const again = mistakesToQuestions([mk("math-001"), mk("不存在"), mk("math-001"), mk("math-002")], subject, 2);
  check(again.length === 2 && again[0].id === "math-001" && again[1].id === "math-002", "錯題重練只取存在的題目且不重複");
}

console.log("=== 錯題本匯出／匯入 ===");
{
  const book = [
    { subjectId: "math", questionId: "math-001", term: "6-1", publisher: "康軒", chosen: 1, at: 1000 },
    { subjectId: "chinese", questionId: "chinese-002", term: "4-1", publisher: "", chosen: 3, at: 2000 },
  ];
  const json = exportMistakes(book, new Date("2026-10-03T00:00:00Z"));
  const parsed = JSON.parse(json);
  check(parsed.app === "meowdoku" && parsed.kind === "mistakes" && parsed.mistakes.length === 2, "匯出檔含 app/kind 與 2 筆錯題");
  check(parsed.exportedAt === "2026-10-03T00:00:00.000Z", "匯出檔記錄時間");
  const empty = importMistakes(json, []);
  check(empty.added === 2 && empty.updated === 0 && empty.list.length === 2, "匯入到空的錯題本：新增 2 筆");
  const again = importMistakes(json, empty.list);
  check(again.added === 0 && again.updated === 2, "重複匯入同一份：只更新不重複");
  const merged = importMistakes(json, [{ subjectId: "math", questionId: "math-999", at: 1 }]);
  check(merged.list.length === 3, "匯入會與現有錯題合併");
  check(!!importMistakes("這不是 JSON", []).error, "不是 JSON 會回報錯誤");
  check(!!importMistakes('{"foo":1}', []).error, "找不到 mistakes 會回報錯誤");
  const messy = importMistakes('{"mistakes":[{"subjectId":"math","questionId":"math-001"},null,{"x":1}]}', []);
  check(messy.added === 1 && messy.skipped === 2, "無效的資料會被略過並計數");
  check(importMistakes(JSON.stringify([{ subjectId: "s", questionId: "q" }]), []).added === 1, "也接受單純的陣列格式");
}

console.log("=== 考試（期中考／期末考）===");
{
  // 測試環境沒有 fetch，直接把題庫塞進 QUIZ_SUBJECTS
  for (const f of read("index.json").subjects) {
    const sub = read(f);
    QUIZ_SUBJECTS[sub.id] = sub;
  }
  const exam = buildExamQuestions("4-1", 5, () => 0.42);
  check(exam.length === 5, "期中考抽 5 題");
  check(exam.every((q) => matchesFilter(q, { term: "4-1" })), "考試題目都屬於該冊次");
  check(new Set(exam.map((q) => q.id)).size === exam.length, "考試題目不重複");
  const subjects = new Set(exam.map((q) => q.examSubject));
  check(subjects.size >= 1 && [...subjects].every((s) => QUIZ_SUBJECTS[s]), "每題都標了科目且科目存在");
  const finals = buildExamQuestions("5-1", 6, () => 0.9);
  check(finals.length === 6, "期末考抽 6 題");
  check(buildExamQuestions("9-9", 5).length === 0, "沒有這個冊次時回傳空陣列");
  check(matchesFilter(QUIZ_SUBJECTS.science.questions[0], { term: "8-1" }) === false, "題庫沒有直接標八上");
  const jh = buildExamQuestions("8-1", 12, () => 0.3);
  check(jh.length === 12, "八上期中考可以抽到 12 題（退到國中題庫）");
  check(jh.every((q) => q.examSubject), "退到國中題庫的題目仍帶科目");
  check(buildExamQuestions("9-2", 12, () => 0.7).length === 12, "九下期末考可以抽到 12 題");
  check(buildExamQuestions("4-1", 6).length === 6, "四上期中考抽得到 6 題");
  {
    const sci = QUIZ_SUBJECTS.science;
    const shown = filterCount(sci, { term: "8-1", publisher: "翰林" });
    const shown82 = filterCount(sci, { term: "8-2", publisher: "翰林" });
    check(shown >= 12 && shown82 >= 12, `八上、八下各有自己的題目（${shown}／${shown82} 題）`);
    check(filterCount(sci, { term: "7-1", publisher: "翰林" }) > 0, "七上自然科有專屬題目");
    check(filterCount(sci, { term: "9-9" }) === 0, "不存在的冊次顯示 0 題");
  }
}

console.log(failures ? `\n${failures} 項失敗` : "\n全部通過");
process.exit(failures ? 1 : 0);
