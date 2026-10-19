// gen_avatar_redraw.js — 用網頁版 Gemini（Nano Banana）重畫換裝圖層：直接畫在各年級身體上
// 先跑 python3 tools/avatar_redraw.py ref <kind> --grade N 產生參考圖（/tmp/avatar_ref/gN/<kind>.png：
// base_gN 穿淡藍上衣＋深藍短褲、戴棕色妹妹頭、純綠底）；
// 每個項目送一次，輸出 /tmp/avatar_gen/gN/<kind>/<id>.png，
// 再跑 python3 tools/avatar_redraw.py process <kind> --grade N 摳圖、對齊（頭髮另外產生後髮）。
// 參考圖的道具衣服用該年級自己那一套，所以照順序：bottom → top → hair → hat、acc、shoes。
// 用法：~/.local/bin/ego-browser nodejs < tools/gen_avatar_redraw.js
// 只想重畫其中一類就改 RUN；已經有輸出的項目會跳過，不滿意哪一張就刪掉那張再跑一次。
const fs = await import("node:fs");
// 要跑哪些類別。ego-browser 不繼承自訂環境變數，所以直接改這一行：
// 平常全部 ["hair", "acc", "hat", "shoes"]；只重畫某一類時暫時改成例如 ["shoes"]。
// 平常全部 ["hair", "acc", "hat", "shoes"]；只重畫某一類時暫時改成例如 ["shoes"]。
const RUN = ["bottom"];
const GRADES = [4, 5, 6, 7, 8, 9]; // 要畫哪些年級
const AGE = { 4: "10-year-old", 5: "11-year-old", 6: "12-year-old", 7: "13-year-old", 8: "14-year-old", 9: "15-year-old" };
const LOG = "/tmp/avatar_gen/log_redraw.txt";
fs.mkdirSync("/tmp/avatar_gen", { recursive: true });
const log = (m) => fs.appendFileSync(LOG, `[${new Date().toISOString().slice(11, 19)}] ${m}\n`);

// 上衣：key 要跟 AVATAR_PARTS.top 一致
const TOP = [
  { key: "tshirt", look: "a plain short-sleeved crew-neck T-shirt" },
  { key: "hoodie", look: "a cosy zip-up hooded sweatshirt (hoodie) with long sleeves to the wrists, the hood resting flat behind the neck, two drawstrings hanging in front" },
  { key: "shirt", look: "a neat button-up collared blouse with short puffed sleeves, buttoned all the way down the front" },
  { key: "sailor", look: "a Japanese school sailor-uniform blouse (セーラー服) with short sleeves, a big square sailor collar with two stripes along its edge, and a neckerchief bow tied at the chest" },
  { key: "sweater", look: "a soft chunky knit crew-neck sweater with long sleeves to the wrists and ribbed cuffs and hem" },
  {
    key: "vest",
    look: "a cute Japanese school knit sweater vest (學院風針織背心). It is a sleeveless V-neck vest worn over the upper body, fitting the shoulders and torso neatly. The armholes cleanly reveal the child's arms, and the ribbed hem ends at the waist, just over the waistband of the shorts (it does NOT hang down over the shorts). Symmetrical straight-on front view",
  },
];

// 褲裙：key 要跟 AVATAR_PARTS.bottom 一致
const BOTTOM = [
  { key: "jeans", look: "a pair of straight-leg long jeans reaching down to the ankles, with a waistband, belt loops and front pockets" },
  { key: "shorts", look: "a pair of casual cotton shorts ending just above the knees, with a waistband, slim regular fit hugging the hips and thighs (not baggy, not wide-legged)" },
  { key: "skirt", look: "a pleated school skirt with a waistband, fitted snugly at the waist and hips, hem just above the knees, the crisp pleats flaring only slightly below the hips" },
  { key: "pleat", look: "a long pleated maxi skirt with a waistband, fitted snugly at the waist and hips, then falling straight down and flaring only slightly toward the hem at the ankles, covering both legs" },
  { key: "sport", look: "a pair of track pants (jogging trousers) reaching down to the ankles, with an elastic waistband, a stripe down each side and elastic cuffs at the ankles" },
];
// 髮型：key 要跟 js/avatar.js 的 AVATAR_PARTS.hair 一致（新增髮型時兩邊都要加）
const HAIR = [
  {
    key: "bob",
    look: "a soft, natural Japanese anime bob hairstyle (初戀短髮鮑伯頭) with gentle, light air-bangs curving softly down to eyebrow level, and smooth rounded side hair curving gently along the cheeks down to the jawline. The side locks naturally frame the cheeks with soft curved contours (no harsh boxy cuts, no flat blunt horizontal edges). Clean, adorable anime aesthetic with cute curved sideburns that softly hug the round face",
  },
  {
    key: "short",
    look: "a stylish Japanese/Korean anime boyish layered short hair (日系碎蓋層次短髮) with soft, textured feathery bangs that stop just above the eyebrows, and delicate natural sideburns gently tapering down in front of the ears. The sideburns and edges softly frame the face with natural curved hair strands (NO blunt cuts, NO boxy horizontal cuts, NO flat ruler cuts). Adorable, clean anime look with natural hair volume",
  },
  {
    key: "twin",
    look: "an adorable anime twin-tails hairstyle (萌系雙馬尾) with soft air-bangs curving down to eyebrow level, and gentle curved side strands softly framing the cheeks down to chin level. Two fluffy, voluminous pigtails are tied high on the sides of the head with small hair ties, hanging down naturally beside the head to shoulder level. The cheek-framing side locks have smooth, organic curves (NO blunt cuts, NO vertical ruler lines)",
  },
  {
    key: "pony",
    look: "a cheerful, spirited high ponytail hairstyle (活力高馬尾) with soft, light see-through bangs at eyebrow level, and cute delicate wisps of hair naturally curving along the temples and cheeks. A high, perky ponytail is tied at the upper-back of the head with a small hair tie, sweeping gracefully out to one side. The hairline and side strands flow smoothly with soft anime lineart (NO harsh straight cuts)",
  },
  {
    key: "curly",
    look: "a charming, voluminous fluffy wavy hairstyle (浪漫蓬鬆微捲髮) with soft curly bangs at eyebrow level, and lush, bouncy shoulder-length waves naturally curving along and framing both cheeks down to the collarbone. The curls have organic, rounded volume and soft wavy tips (NO flat vertical cuts, NO harsh straight edges)",
  },
  {
    key: "straight",
    look: "an elegant anime long straight hairstyle (氣質長直髮) with neat, soft air-bangs at eyebrow level, and sleek, silky side locks flowing smoothly down along both cheeks past the shoulders. The side hair naturally and softly hugs the contours of the cheeks with gentle organic lines before draping down (NO harsh blunt vertical cuts, NO blocky edges)",
  },
];
// 配件：key 要跟 AVATAR_PARTS.accessory 一致
const ACC = [
  { key: "glasses", look: "a pair of round thin-rimmed glasses resting on the nose, the temples going back over the ears; the lenses are clear and see-through — do NOT fill the lenses, the eyes stay fully visible through them" },
  { key: "scarf", look: "a soft knitted winter scarf wrapped once around the neck on top of the T-shirt collar, with both ends hanging down the front of the chest; it does not cover the chin or mouth" },
  { key: "backpack", look: "a school backpack worn on both shoulders: two padded shoulder straps go over the shoulders and straight down the front of the chest to the waist; the bag itself is behind the back, only its sides peeking out beside the arms" },
  { key: "headphone", look: "over-ear headphones: a headband arching over the top of the hair and two big round ear cups covering the ears on both sides of the head, sitting on top of the hair" },
  { key: "badge", look: "a small rectangular blank name badge clipped onto the T-shirt on the upper chest, on the viewer's right side; no text on it" },
];
// 帽子：key 要跟 AVATAR_PARTS.hat 一致
const HAT = [
  {
    key: "cap",
    look: "a stylish anime baseball cap / peaked cap worn facing forward: the rounded solid crown fits snugly over the top and back of the head, completely covering the upper scalp and crown; the curved visor extends forward above the eyebrows. Cute, sporty chibi mobile-game design with clean panel seams",
  },
  {
    key: "beanie",
    look: "a warm, cozy knitted winter beanie / watch cap with a thick folded ribbed cuff and a cute fluffy pom-pom on top. The beanie fits snugly over the dome of the head, pulled down to just above the eyebrows, completely covering the top of the scalp. The front bangs and side hair emerge naturally from beneath the folded cuff",
  },
  {
    key: "straw",
    look: "a charming wide-brim straw sun hat: a rounded woven crown that sits comfortably on top of the head, wrapped with a cute fabric ribbon band, and a wide, gently curved circular brim that extends out around the head to shade the face while staying comfortably above the eyes",
  },
  {
    key: "beret",
    look: "an artistic French beret / painter's cap worn with a stylish tilt toward one side of the head, featuring a cute tiny stalk (stem) in the center. The beret has soft, puffy, pillowy circular volume sitting gracefully on top of the hair above the forehead",
  },
  {
    key: "bow",
    look: "a lovely large ribbon bow hair accessory (雙層立體大蝴蝶結) clipped securely onto the hair on the upper side of the head. It features full, plump ribbon loops with a neat center knot and two short fluttering ribbon tails, adding an adorable touch",
  },
];

// 鞋子：key 要跟 AVATAR_PARTS.shoes 一致。
const SHOES = [
  { key: "sneaker", look: "a pair of chunky lace-up sneakers with a thick rubber sole" },
  { key: "boots", look: "a pair of short lace-up ankle boots with a low heel" },
  { key: "loafer", look: "a pair of plain slip-on loafers with a low heel" },
  { key: "sandal", look: "a pair of flat sandals with two thin straps across the top of each foot, the toes visible under the straps" },
  { key: "rainboot", look: "a pair of tall rubber rain boots reaching just below the knee" },
];

const STYLE =
  " The new item is drawn PURE WHITE / very light silver-gray with soft gray cel shading and a clean thin dark-gray outline — no other colours in it at all (the game recolours it later)." +
  " Cute Japanese mobile-game art, the same lineart style as the character. No text, no watermark, no extra objects, no shadow on the background.";
const RULES = {
  bottom:
    " Keep EVERYTHING else exactly the same as the attached image: the same face, hair, cropped light-blue sleeveless top, arms, hands, legs, bare feet, skin, pose, size, position and framing, and the same perfectly flat pure green background." +
    " The new garment completely replaces the navy shorts (no navy left showing). It is high-waisted: its waistband sits at the natural waist, right at the bottom edge of the cropped light-blue top, covering the belly button (no bare midriff between the top and the waistband)." +
    " It fits this exact body's proportions at the right size: from the waistband down to the hips it hugs the body closely and is NO wider than the girl's own hips (it never sticks out sideways past the hips or under the arms, and the hands stay in front of it)." +
    " Trousers and shorts follow the outline of the legs (regular fit, not baggy, not flared); a skirt only flares out gently BELOW the hips." +
    " Symmetrical straight-on front view, legs in the same place. No shoes, no socks, no belt." +
    STYLE,
  top:
    " Keep EVERYTHING else exactly the same as the attached image: the same face, eyes, hair, skin, neck, hands, navy shorts, legs, pose, size, position and framing, and the same perfectly flat pure green background." +
    " The new garment completely replaces the light-blue sleeveless top (no light blue left showing anywhere). It fits this exact body's shoulders and torso at the right size, and its hem comes down over the waistband of the navy shorts, overlapping it a little (no skin showing between the top and the shorts)." +
    " Symmetrical straight-on front view, arms in the same place. Bare arms stay bare where the garment has no sleeves." +
    " Do NOT redraw, restyle, move or resize the girl; the shorts keep exactly the same medium denim-blue colour (do not darken them to navy or black)." +
    STYLE,
  hair:
    " Keep EVERYTHING else exactly the same as the attached image: the same face, eyes, expression, ears, neck, light-blue T-shirt, pose, size, position and framing, and the same perfectly flat pure green background. Only add the hair." +
    " The hair must fully cover the top and back of the scalp (no bald skin showing through the hair), sit naturally on this exact head, and must NOT cover the eyes; no loose strands lying across the eyes or cheeks." +
    " Crucial: The side locks and sideburns must have smooth, natural, organic curved contours framing the cheeks — absolutely NO blunt horizontal cuts, NO boxy square edges, NO straight vertical ruler cuts along the cheeks." +
    " No hat, no hair accessories other than the hair ties mentioned." +
    STYLE,
  acc:
    " Keep EVERYTHING else exactly the same as the attached image: the same face, eyes, expression, brown hair (keep it brown), light-blue T-shirt, navy shorts, arms, pose, size, position and framing, and the same perfectly flat pure green background. Only add this one item." +
    " The item fits this exact body at the right size and is not tilted. No other accessories, no hat." +
    STYLE,
  hat:
    " Keep EVERYTHING else exactly the same as the attached image: the same face, eyes, expression, brown hair, light-blue T-shirt, pose, size, position and framing, and the same perfectly flat pure green background. Only add this one hat." +
    " The hat is worn naturally on the child's head. The hat has a solid, opaque crown that covers the top of the scalp and upper hair snugly, while the front bangs and lower side locks flow out naturally from underneath the hat brim. The hat has natural 3D depth and volume fitting a chibi character. The hat must NOT cover the eyes." +
    STYLE,
  shoes:
    " Keep EVERYTHING else exactly the same as the attached image: the same legs, knees, skin, pose, size, position and framing, and the same perfectly flat pure green background. Only add these shoes." +
    " Both shoes are actually WORN ON the child's feet and cover the feet completely — no bare toes, no bare heel, no skin showing between the shoe and the leg, and no shoes floating beside or in front of the feet." +
    " The shoes point the same way as the feet (toward the viewer) and are drawn from the same straight-on front view as the legs — not a three-quarter or side view, not a pair of shoes lying on the ground." +
    " Each shoe is drawn a little LARGER than the bare foot underneath and completely encloses it, so not a single pixel of toe, heel or the side of the foot shows around the shoe; both shoes are the same size and stay exactly where the feet are." +
    " No socks, no other accessories." +
    STYLE,
};
const ITEMS0 = GRADES.flatMap((g) => [
  ...(RUN.includes("bottom") ? BOTTOM.map((s) => ({ kind: "bottom", key: s.key, prompt: `Edit the attached image: dress the ${AGE[g]} girl in ${s.look}.` })) : []),
  ...(RUN.includes("top") ? TOP.map((s) => ({ kind: "top", key: s.key, prompt: `Edit the attached image: dress the ${AGE[g]} girl in ${s.look}.` })) : []),
  ...(RUN.includes("hair") ? HAIR.map((s) => ({ kind: "hair", key: s.key, prompt: `Edit the attached image: give this bald ${AGE[g]} girl a new hairstyle — ${s.look}.` })) : []),
  ...(RUN.includes("acc") ? ACC.map((s) => ({ kind: "acc", key: s.key, prompt: `Edit the attached image: add ${s.look}.` })) : []),
  ...(RUN.includes("hat") ? HAT.map((s) => ({ kind: "hat", key: s.key, prompt: `Edit the attached image: give the ${AGE[g]} girl ${s.look}.` })) : []),
  ...(RUN.includes("shoes") ? SHOES.map((s) => ({ kind: "shoes", key: s.key, prompt: `Edit the attached image: put ${s.look} on the ${AGE[g]} girl's feet.` })) : []),
].map((it) => ({ ...it, grade: g, ref: `/tmp/avatar_ref/g${g}/${it.kind}.png`, out: `/tmp/avatar_gen/g${g}/${it.kind}/${it.key}.png`, prompt: it.prompt + RULES[it.kind] })));
const ITEMS = ITEMS0.map((it) => ({ ...it, key: `g${it.grade}/${it.kind}/${it.key}` })); // key 只用在 log
for (const g of GRADES) for (const k of RUN) fs.mkdirSync(`/tmp/avatar_gen/g${g}/${k}`, { recursive: true });

// 整批共用一個 TaskSpace：第一次建立後把 id 記在 SPACE_FILE，之後每輪都接續同一個（不再認領使用者的分頁）
const SPACE_FILE = "/tmp/avatar_gen/space_id";
let task;
try {
  task = await taskSpace(Number(fs.readFileSync(SPACE_FILE, "utf8")));
} catch {
  task = await taskSpace("avatar redraw");
  fs.writeFileSync(SPACE_FILE, String(task.spaceId));
}
// 先用已管理的分頁；沒有就認領空間裡現成的分頁（例如使用者交還的 Gemini 分頁），都沒有才開新的
const tab0 = (await task.tabs())[0];
const page = (await task.pages())[0] || (tab0 ? await task.adopt(tab0.page) : await task.newPage());
const wait = (ms) => page.waitForTimeout(ms);

async function newChat() {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").trim() === "新對話" || /New chat/i.test(x.getAttribute("aria-label") || ""));
    b?.click();
  });
  await wait(3500);
}

async function typePrompt(text) {
  await page.evaluate((t) => {
    const el = document.querySelector('div[contenteditable="true"]');
    el.focus();
    document.execCommand("insertText", false, t);
  }, text);
  await wait(1200);
}

for (const it of ITEMS) {
  const out = it.out;
  if (fs.existsSync(out) && fs.statSync(out).size > 40000) {
    log(`跳過 ${it.kind}/${it.key}`);
    continue;
  }
  try {
    await page.goto("https://gemini.google.com/app");
    await page.waitForLoadState();
    await wait(7000);
    await newChat();
    // 附上參考圖：2026-10 的 Gemini 介面沒有常駐的 input[type=file]，
    // 要先按輸入框左邊的「上傳與工具」（aria-label）開啟選單，input 才會出現在 DOM，
    // 出現後直接把檔案塞進圖片 input（accept="image/*"），不必碰原生檔案選擇視窗。
    let attached = false;
    try {
      await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="上傳與工具"]');
        if (btn) {
          btn.scrollIntoView();
          btn.click();
        }
      });
      await wait(1500);
      const n = await page.evaluate(
        () => document.querySelectorAll('input[type=file][accept="image/*"]').length,
      );
      if (n > 0) {
        await page.setInputFiles('input[type=file][accept="image/*"]', [it.ref]);
        // 上傳＋產生縮圖要一點時間；只等一次容易誤判成「沒附上」（曾等 6s 失敗、8s 成功）
        for (let i = 0; i < 10; i++) {
          await wait(3000);
          attached = await page.evaluate(() => !!document.querySelector('img[src^="blob:"], img[src^="data:image"]'));
          if (attached) break;
        }
      } else {
        log(`${it.key} 找不到圖片 input（選單沒開？）`);
      }
      await page.keyboard.press("Escape"); // 收掉可能還開著的選單
    } catch (e) {
      log(`${it.key} 附件失敗 ${String(e).slice(0, 60)}`);
    }
    log(`${it.key} 附件=${attached}`);
    if (!attached) {
      log(`${it.key} ❌ 沒附上參考圖，跳過（沒有參考圖就對不準）`);
      continue;
    }
    // 參考圖本身也是 1024px 的 blob 圖，先記下送出前已在頁面上的圖，之後只認新出現的
    const before = await page.evaluate(() => [...document.images].map((i) => i.src));
    await typePrompt(it.prompt);
    await page.evaluate(() => {
      const el = document.querySelector('div[contenteditable="true"]');
      el.focus();
    });
    await page.keyboard?.press?.("Enter");
    await page.evaluate(() => {
      const el = document.querySelector('div[contenteditable="true"]');
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    });
    log(`${it.key} 已送出`);
    // 挑圖只在「模型回覆」區塊裡找：送出後 Gemini 會把使用者訊息裡附的參考圖重繪成新的 blob 圖，
    // 那份會混進 document.images，取 pop() 就可能存到參考圖本身（看起來像「AI 沒改」）。
    let got = null;
    for (let i = 0; i < 60; i++) {
      await wait(4000);
      const imgs = await page.evaluate(
        (seen) => {
          const inReply = [...document.querySelectorAll("model-response img")];
          return {
            reply: inReply.length,
            imgs: inReply
              .filter(
                (i) =>
                  (i.src.startsWith("blob:") || i.src.startsWith("data:image")) &&
                  i.naturalWidth >= 512 &&
                  !seen.includes(i.src),
              )
              .map((i) => ({ w: i.naturalWidth, h: i.naturalHeight })),
            text: (document.querySelector("model-response")?.innerText || "").replace(/\s+/g, " ").slice(0, 120),
          };
        },
        before,
      );
      if (imgs.imgs.length) {
        log(`${it.key} 出圖 ${imgs.imgs[0].w}x${imgs.imgs[0].h}（${(i + 1) * 4}s, 回覆區圖 ${imgs.imgs.length} 張）`);
        if (!imgs.reply) log(`${it.key} ⚠ 找不到 model-response 區塊，退回全頁找圖`);
        got = imgs.imgs[0];
        break;
      }
      if (i % 4 === 3) log(`${it.key} 等待 ${(i + 1) * 4}s｜回覆文字: ${imgs.text}`);
      if (/limit resets|用量上限|上限/.test(imgs.text)) break; // 額度用完，再等也不會出圖
    }
    if (!got) {
      const why = await page.evaluate(() => document.querySelector("model-response")?.innerText || "");
      log(`${it.key} ❌ 沒出圖 ${why.replace(/\s+/g, " ").slice(0, 80)}`);
      if (/limit resets|上限/.test(why)) {
        log("Gemini 生圖額度用完，停止（到 gemini.google.com/usage 看重設時間）");
        break;
      }
      continue;
    }
    await wait(12000);
    const b64 = await page.evaluate(async (seen) => {
      const inReply = [...document.querySelectorAll("model-response img")];
      const img = inReply
        .filter(
          (i) =>
            (i.src.startsWith("blob:") || i.src.startsWith("data:image")) &&
            i.naturalWidth >= 512 &&
            !seen.includes(i.src),
        )
        .pop();
      if (!img) return null;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      return c.toDataURL("image/png").split(",")[1];
    }, before);
    if (!b64) {
      log(`${it.key} ❌ 取圖失敗`);
      continue;
    }
    fs.writeFileSync(out, Buffer.from(b64, "base64"));
    log(`${it.key} 存檔 ${fs.statSync(out).size} bytes`);
  } catch (e) {
    log(`${it.key} ❌ 例外 ${String(e).slice(0, 100)}`);
  }
}
log("全部結束");
// 不 finish：下一輪（下一類）接著用同一個 TaskSpace；全部畫完再手動 finish
