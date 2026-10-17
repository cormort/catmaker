// story.js — 主線劇情、考試章節、任務進度與貓咪提醒
// 設定：貓咪是「星讀學園」派來的見習學習貓，來陪你讀書、提醒你複習。
// 主線每一章就是一場考試（期中考／期末考），考過就進下一章。
// 這裡只有純資料與純函式，方便測試；UI 由 pet.js / academy.js 呈現。

// 主線＝從四年級一路到九年級：每個學期兩場考試（期中考考前半冊、期末考考整冊），
// 六個年級 × 上下學期 × 期中／期末 = 共 24 章。
export const STORY_YEARS = [4, 5, 6, 7, 8, 9];

// 各年級的考試規模與獎勵（年級越高題數與及格線越高、獎勵越好）
export const YEAR_PLAN = {
  4: { mid: { count: 5, pass: 3, coins: 150, affection: 10 }, final: { count: 6, pass: 4, coins: 220, affection: 12 } },
  5: { mid: { count: 6, pass: 4, coins: 260, affection: 14 }, final: { count: 8, pass: 5, coins: 340, affection: 16 } },
  6: { mid: { count: 8, pass: 5, coins: 400, affection: 18 }, final: { count: 10, pass: 6, coins: 500, affection: 20 } },
  7: { mid: { count: 10, pass: 6, coins: 620, affection: 22 }, final: { count: 12, pass: 8, coins: 760, affection: 24 } },
  8: { mid: { count: 10, pass: 7, coins: 900, affection: 26 }, final: { count: 12, pass: 8, coins: 1050, affection: 28 } },
  9: { mid: { count: 12, pass: 8, coins: 1200, affection: 30 }, final: { count: 12, pass: 9, coins: 1500, affection: 40 } },
};

const TERM_LABELS = {
  "4-1": "四上", "4-2": "四下", "5-1": "五上", "5-2": "五下", "6-1": "六上", "6-2": "六下",
  "7-1": "七上", "7-2": "七下", "8-1": "八上", "8-2": "八下", "9-1": "九上", "9-2": "九下",
};

// 每一章的貓咪台詞（依章序 1~24）
const CHAPTER_LINES = [
  // 四年級
  ["喵——！終於找到你了！我是星讀學園派來的見習學習貓。",
    "從今天開始，每一章就是一場考試：期中考考前半冊、期末考考整冊。",
    "第一場是「四上期中考」，5 題答對 3 題就通過。我們一起加油喵！"],
  ["期中考過了喵！但期末考才是整冊的總驗收。",
    "期末考會多一題、及格線也提高，答錯的題目記得回錯題本練一下。"],
  ["四下開學喵！上學期你已經證明自己會讀書了，這次換一點新花樣。",
    "先照顧好我——吃飯、洗澡、梳毛，我才有力氣陪你考試。"],
  ["四下期末考來啦！這次我想看到你把錯題都變會。",
    "考完就帶我出門走走吧，看看課本裡的東西在真實世界的樣子。"],
  // 五年級
  ["五年級喵！東西會難一點點，但你的腦袋也長大了。",
    "考前先挑一科你最沒把握的，去學院單科練一輪再上場。"],
  ["五上期末考：這次題目變多了，考驗的是你有沒有耐心一題一題看完。",
    "看不懂的題目先跳過，別讓一題拖垮整場考試喵。"],
  ["五下開學！這次我想教你一件事——把不會的記下來，比一直寫會的更重要。",
    "錯題本裡每一題都是你的寶藏喵。"],
  ["五下期末考，小學生活已經過一半了喵。",
    "考完我們去溫泉放鬆一下，泡完再繼續衝。"],
  // 六年級
  ["六年級喵！你已經比我第一次見到你的時候厲害太多了。",
    "這一年考試會變長，記得分配體力，累了就讓我陪你睡一下。"],
  ["六上期末考，小學最後一年的上半場。",
    "每次答對我都會記在心裡喵——不是記分數，是記你努力的樣子。"],
  ["六下開學！再過半年你就要上國中了。",
    "國中的考試題目會更長，我們現在開始練「讀完題目再作答」。"],
  ["六下期末考：小學階段的最後一場考試喵。",
    "考過它，你就是準備好上國中的孩子了。"],
  // 七年級（國中）
  ["恭喜上國中喵！制服、新同學、還有——更難的考試。",
    "國中的題目會考驗理解，不要只背答案，要知道為什麼。"],
  ["七上期末考：第一次國中期末考，題數直接翻倍喵。",
    "別慌，一場考試只是一場對話，一題一題慢慢來。"],
  ["七下開學！你已經適應國中生活了。",
    "這次我準備了跨科目的題目，考驗你會不會把學到的東西連起來。"],
  ["七下期末考：這學期的總驗收喵。",
    "考完帶你去海邊走走，看看課本外的世界有多大。"],
  // 八年級
  ["八年級喵！這是國中最容易鬆懈的一年，撐住就贏一半。",
    "我把及格線提高了，因為我相信你辦得到。"],
  ["八上期末考：題目變得更靈活，會有需要想一下的題目。",
    "想一下不是不會，是腦袋正在長肌肉喵。"],
  ["八下開學！離會考只剩一年多，我們開始把錯題當成複習清單。",
    "每清掉一題錯題，我就多陪你玩十分鐘。"],
  ["八下期末考：這次考完，你就是準九年級考生了喵。",
    "考前把錯題本翻一遍，你會發現自己真的進步很多。"],
  // 九年級
  ["九年級喵！！最後一年，也是最關鍵的一年。",
    "我不會逼你，我只會每天在你旁邊提醒你：今天讀一點，明天就輕鬆一點。"],
  ["九上期末考：會考前的最後一次大考。",
    "把它當成模擬考，錯了剛好，錯在這裡比錯在會考好喵。"],
  ["九下開學！剩下最後一個學期了。",
    "這段時間我會把你所有錯題再出給你一次，把洞補起來。"],
  ["最後一場了喵——九下期末考，考過它，這趟旅程就完成了。",
    "不管分數如何，你已經養成了一個習慣：不會的東西，你會去把它學會。",
    "這才是星讀學園想送你的禮物。"],
];

export const STORY = buildStory();

function buildStory() {
  const chapters = [];
  let n = 0;
  for (const year of STORY_YEARS) {
    for (const sem of [1, 2]) {
      for (const kind of ["mid", "final"]) {
        const term = `${year}-${sem}`;
        const plan = YEAR_PLAN[year][kind];
        const name = `${TERM_LABELS[term]}${kind === "mid" ? "期中考" : "期末考"}`;
        n++;
        chapters.push({
          id: `ch${n}`,
          title: `第 ${n} 章・${name}`,
          exam: { name, term, kind, count: plan.count, pass: plan.pass },
          lines: CHAPTER_LINES[n - 1],
          task: { type: "exam", target: 1, label: `通過${name}（答對 ${plan.pass} / ${plan.count} 題）` },
          reward: {
            coins: plan.coins,
            affection: plan.affection,
            ...(n === CHAPTER_LINES.length ? { title: "星讀學園畢業生" } : {}),
          },
        });
      }
    }
  }
  return {
    id: "starlight",
    title: "星讀學園的委託",
    intro:
      "夜空裡有一間「星讀學園」，專門訓練學習貓去幫助世界各地的小朋友。今天，一隻見習學習貓來到了你家——牠的任務，就是陪你從四年級一路讀到九年級。",
    chapters,
  };
}

export function newStoryState() {
  return { chapterIndex: 0, progress: {}, done: [] };
}
export function normalizeStory(story) {
  const base = newStoryState();
  if (!story || typeof story !== "object") return base;
  return {
    chapterIndex: Number.isInteger(story.chapterIndex) ? story.chapterIndex : 0,
    progress: story.progress && typeof story.progress === "object" ? { ...story.progress } : {},
    done: Array.isArray(story.done) ? [...story.done] : [],
  };
}
export function currentChapter(story) {
  const s = normalizeStory(story);
  return STORY.chapters[s.chapterIndex] || null;
}
export function storyFinished(story) {
  return normalizeStory(story).chapterIndex >= STORY.chapters.length;
}
export function chapterIndex(story) {
  return normalizeStory(story).chapterIndex;
}
export function examOf(chapter) {
  return chapter?.exam || null;
}
export function examPassed(correct, exam) {
  return !!exam && correct >= exam.pass;
}
// 目前任務的進度（給 UI 畫進度條）
export function taskProgress(story) {
  const s = normalizeStory(story);
  const ch = currentChapter(s);
  if (!ch) return null;
  const have = Math.min(s.progress[ch.task.type] || 0, ch.task.target);
  return {
    type: ch.task.type,
    label: ch.task.label,
    have,
    need: ch.task.target,
    percent: Math.round((have / ch.task.target) * 100),
    complete: have >= ch.task.target,
  };
}
// 記錄事件；若達成目標就自動進到下一章。回傳 { story, completed }
export function applyEvent(story, type, n = 1) {
  const s = normalizeStory(story);
  const ch = currentChapter(s);
  if (!ch || !type) return { story: s, completed: null };
  const progress = { ...s.progress, [type]: (s.progress[type] || 0) + n };
  // 只有「這一章任務要求的類型」累計到目標才算完成（其他事件只是累加進度）
  if ((progress[ch.task.type] || 0) < ch.task.target) return { story: { ...s, progress }, completed: null };
  return {
    story: { ...s, chapterIndex: s.chapterIndex + 1, progress: {}, done: [...s.done, ch.id] },
    completed: ch,
  };
}

// 考試沒過：時間照樣往前走（月曆制），這章不給獎勵，直接進下一章
export function skipChapter(story) {
  const s = normalizeStory(story);
  return { ...s, chapterIndex: s.chapterIndex + 1, progress: {} };
}

// ===== 貓咪說的話 =====
export function timeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6) return "這麼晚還沒睡喵？要注意作息喔。";
  if (h < 11) return "早安喵！今天想先練哪一科？";
  if (h < 17) return "午安喵～休息一下再繼續，效率更好。";
  if (h < 22) return "晚安喵，今天學到的東西複習一下就不會忘囉。";
  return "夜深了喵，早點休息，明天我再陪你。";
}
// 依貓咪狀態與任務進度挑一句最需要的提醒
export function reminderLine({
  name = "貓咪",
  hunger = 100,
  energy = 100,
  mood = 80,
  cleanliness = 80,
  mistakes = 0,
  story = null,
  streak = 0,
} = {}) {
  const ch = currentChapter(story);
  const p = taskProgress(story);
  if (hunger < 30) return `${name}肚子餓了喵…先餵我吃點東西好不好？`;
  if (energy < 25) return `${name}有點累了喵，讓我睡一下再陪你讀書好嗎？`;
  if (cleanliness < 25) return `${name}身上髒兮兮的喵…（毛都黏在一起了）帶我去洗個澡好不好？`;
  if (mood < 30) return `${name}今天心情不太好喵，陪我玩一下好不好？`;
  if (mistakes >= 3) return `錯題本裡還有 ${mistakes} 題等你喵，我們一起把它們變會吧！`;
  if (p && !p.complete) return `今天的任務是「${p.label}」——目前 ${p.have}/${p.need}，加油喵！`;
  if (mistakes > 0) return `還有 ${mistakes} 題錯題待複習喵，練完我給你一個抱抱！`;
  if (ch) return `${ch.title}開始了喵！按下面的按鈕看看我要說什麼。`;
  if (streak >= 3) return `連續 ${streak} 天都來看我，你真的很棒喵！`;
  return `今天也想跟你一起學習喵！（先去學院排一次隨堂測驗吧）`;
}
// 貓咪有多髒：0＝乾淨、1＝有點髒、2＝髒、3＝該洗澡了
export function dirtLevel(cleanliness = 80) {
  const c = Number.isFinite(cleanliness) ? cleanliness : 80;
  if (c >= 60) return 0;
  if (c >= 40) return 1;
  if (c >= 20) return 2;
  return 3;
}
export const DIRT_LABEL = ["", "毛有點亂喵", "身上開始有味道了喵", "好髒喵！快帶我去洗澡！"];
// 「說說話」：依狀態給不同回應
export function talkLines({ mood = 80, affection = 0, hour = 12 } = {}) {
  const lines = [];
  if (affection >= 200) lines.push("跟你在一起的時候，我覺得自己是最幸運的學習貓喵。");
  else if (affection >= 80) lines.push("我們已經是很好的夥伴了喵！");
  else lines.push("嗨嗨，今天想聊什麼喵？");
  if (mood >= 70) lines.push("我今天精神很好，可以陪你讀很多題！");
  else if (mood >= 40) lines.push("還可以喵，陪我玩一下會更有精神。");
  else lines.push("有點提不起勁喵…摸摸我好不好？");
  if (hour >= 22) lines.push("不過等等記得早點睡喵。");
  return lines;
}
// 互動選項（說說話時的三個按鈕）
export const TALK_CHOICES = [
  { id: "pat", label: "🤲 摸摸頭", mood: 8, affection: 2, reply: "呼嚕嚕～好舒服喵。" },
  { id: "praise", label: "🌟 稱讚牠", mood: 10, affection: 1, reply: "嘿嘿，被誇獎了喵！我會更努力陪你的。" },
  { id: "study", label: "📖 一起讀書", mood: 4, affection: 3, reply: "好！我把書翻開，你專心讀，我在旁邊看著喵。", buff: true },
];
// 陪讀加成：下一次測驗金幣 +20%（存在 petData.studyBuff = { until }）
export const STUDY_BUFF_MINUTES = 30;
export const STUDY_BUFF_RATE = 1.2;
export function studyBuffActive(buff, now = Date.now()) {
  return !!(buff && buff.until && buff.until > now);
}
