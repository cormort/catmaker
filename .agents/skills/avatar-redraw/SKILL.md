---
name: avatar-redraw
description: 完整的 2D Q 版紙娃娃（Chibi Avatar）髮型、帽子、配件、鞋飾的原位（In-situ）重繪、顏色摳圖、五官防穿透遮罩、前後分層分離與自動對位工作流。結合 Gemini 網頁版（Nano Banana）與 ego-browser 自動化，支援 mix-blend-mode 上色與多階段年級娃娃相容。當使用者要重繪髮型、添加紙娃娃配件、服裝或排除穿透破洞時調用。
---

# Avatar Redraw & Layer Separation Pipeline (紙娃娃原位重繪與圖層分離工作流)

本指南記錄了為 2D 日系 Q 版紙娃娃（Chibi Doll / Avatar）自動化生成**完美對位、無生硬切痕、無頭骨穿透孔洞、支援任意色彩著色（`mix-blend-mode: multiply`）**之髮型、配件、帽子與鞋飾的端到端工程管線。

---

## 1. 核心哲學：原位重繪（In-situ Redraw Paradigm）

### ❌ 過去的錯誤做法（物件圖板法）
讓 AI 在空白畫布上畫單獨的「假髮」、「帽子」或「鞋子」，再以程式推測縮放與貼上位置：
- **致命缺點**：AI 容易畫成 3/4 俯視角（如鞋子歪斜、腳趾露在外面）；假髮與娃娃頭型完全脫節，戴上後像安全帽浮在頭上；邊緣生硬。

### ✅ 原位重繪法則（In-situ Redraw）
**直接把基準娃娃（`base_g4.png`）作為畫布讓 AI 在上面重繪**。
- 娃娃本來就在正中央、站姿正面，AI 在上面添加髮型或鞋子時，天生就契合娃娃的骨架與五官比例。
- 生成後，利用**色彩學（Color Contract）**自動將新畫的部分摳出，位置天生對齊基準座標（scale 1.00，平移 0px）。

---

## 2. 參考圖色彩契約（Color Contract）

為了讓演算法能 100% 自動精準摳出新畫項目，設計了以下防混淆色彩規範：

| 元素 | RGB 數值 | 角色作用 | 扣除邏輯 |
|---|---|---|---|
| **純綠背景** | `(0, 177, 64)` | 高彩度綠底 | 演算法判定 `green` 立即剔除 |
| **淡藍上衣** | `(156, 195, 230)` | 保護軀幹 | 具彩度（`sat > 30`），不會被當成新圖層 |
| **深藍短褲** | `(74, 111, 165)` | 保護下身 | 具彩度，防止 AI 自行補畫腿部 |
| **棕色妹妹頭** | `(138, 90, 52)` | 帽子／外戴配件專用 | 讓帽子、耳機、眼鏡戴在頭髮外側，棕髮具彩度不被摳除 |
| **新畫項目** | **純白／淺銀灰** | AI 生成目標 | 彩度極低（`sat < 30`）且無綠色殘留，演算法判定為新圖層 |

> **前端著色機制**：所有配件與髮型輸出為單色灰階帶透明度 PNG。遊戲前端透過 CSS `mix-blend-mode: multiply` 或 Canvas 著色，底層陰影與高光完美保留，可即時染成黑、棕、金、粉、藍、薄荷等任意顏色。

---

## 3. 避免瑕疵的三大關鍵修正（Lessons Learned）

### 關鍵 1：頭骨輪廓線鏤空穿鑿（Perforation Bug）
- **現象**：頭髮內部沿著原本光頭的邊緣出現一圈透明小孔或虛線切痕，著色後底下的光頭皮膚從孔洞露出來。
- **成因**：參考圖中光頭娃娃的邊緣線是深褐色（`sat < 30` 屬中性色）。若全圖比對 `same = np.abs(gen - ref) < 40`，頭髮覆蓋在頭骨輪廓處會因顏色接近而被判定為「未更動的背景」直接挖空！
- **解法**：**嚴格限制 `same & ref_neutral` 僅扣除五官特徵區（眉毛、眼睛、嘴巴）**，頭殼、太陽穴與頭頂範圍絕不扣除，頭髮保持 100% 紮實：
  ```python
  # 僅在五官區扣除原圖未更動的像素（眼睛、眉毛、嘴巴）
  y_idx, x_idx = np.indices(neutral.shape)
  is_face_feature = (y_idx >= 280) & (y_idx <= 520) & (x_idx >= 370) & (x_idx <= 650)
  hair = neutral & ~(same & ref_neutral & is_face_feature)
  ```

### 關鍵 2：生硬垂直切刀痕與方塊切角（Boxy Cheek Cutouts）
- **現象**：兩側鬢角在臉頰兩側呈現筆直的垂直尺規切痕或突兀的方塊邊緣。
- **成因**：舊版修圖腳本採用矩形邊緣裁切（`TRIM`）強制削掉臉頰上的像素。
- **解法**：
  1. 廢棄所有強制矩形 `TRIM` 邏輯。
  2. 在 Prompt 中強制要求柔順內扣弧度：
     `"The side locks naturally frame the cheeks with soft curved contours (no harsh boxy cuts, no flat blunt horizontal edges, no straight vertical ruler cuts). Adorable curved sideburns that softly hug the round face."`

### 關鍵 3：雙馬尾天空天花板（Sky Ceiling Bug）
- **現象**：後髮（`hairback`）逐列橫向填滿時，在雙馬尾上方架出一整面水平平頂。
- **成因**：左馬尾頂端 `l` 與右馬尾頂端 `r` 在頭頂上方的空白天空連成一條水平線，被填成整片灰色實心。
- **解法**：**橫向填滿必須限制在人體輪廓範圍（`bodyL` ~ `bodyR`）之內**：
  ```javascript
  for (let y = 0; y <= fillTo; y++) {
    if (bodyL[y] < 0) continue;
    const hl = bodyL[y], hr = bodyR[y];
    let l = -1, r = -1;
    for (let x = hl; x <= hr; x++) if (back[y * W + x]) { if (l < 0) l = x; r = x; }
    if (l >= 0) for (let x = l; x <= r; x++) back[y * W + x] = 1;
  }
  ```

### 關鍵 4：帽子實心包覆與 3D 深度（Hat Crown Coverage & Volume）
- **現象**：帽子像一片薄薄的貼紙浮在額頭上方，頭頂大團頭髮穿透帽冠爆出來。
- **成因**：Prompt 過去提示「帽子戴在頭髮上，頭髮在帽子周圍與下方保持原樣」，AI 不敢覆蓋頭頂髮絲，只能畫成扁平小貼片。
- **解法**：
  1. 帽子必須具備**實心且足夠深度的立體帽冠（Solid Opaque Crown）**，完整包覆頭骨與頭頂，前端露出自然的瀏海與下側鬢角。
  2. 廢棄 legacy 的人工平移偏移量（`HAT_ADJUST = { dy: 0, sx: 1.0 }`），原位重繪直接自帶 100% 精準對位。

### 關鍵 5：上衣原位重繪與腰線下襬（Top In-situ & Waistline Fit）
- **現象**：背心（`vest`）過長（垂至大腿覆蓋短褲與裙子）、3/4 視角歪斜、單側袖洞。
- **成因**：在獨立圖板畫空衣服再貼上，無法精準對齊娃娃正面的領口與腰身。
- **解法**：
  1. 將 `top` 納入原位重繪：參考圖為裸上身穿著深藍短褲的娃娃，AI 直接在身體上畫背心。
  2. Prompt 強制要求「對稱正面站姿、羅紋下襬剛好收束在腰線（腰帶處），不覆蓋短褲」。
  3. `TOP_BOX.vest` 領口精準落在 207、下襬收在 354，與短褲、百褶裙、牛仔褲完美交接。

---

## 4. 前後圖層分離標準（Layer Splitting）

在 2D 換裝遊戲中，身體與物件必須有正確的深度遮擋關係：

### 髮型拆分
- **前髮（`hair_<id>.png`）**：瀏海、鬢角與臉頰邊緣微修容側髮。疊在 `base` 身體前面。
- **後髮（`hairback_<id>.png`）**：後腦勺輪廓、馬尾背髮。在身體高度逐列填滿，疊在 `base` 身體後面，使臉與脖子自然蓋住中間，只有髮絲縫隙與兩側露出。

### 背包拆分
- **背帶（`acc_backpack_front.png`）**：脖子線（`y >= 200`）以下壓在身體或上衣上的像素，疊在上衣前面。
- **包體（`acc_backpack.png`）**：身體背後露出的包體本體，疊在身體與後髮最底層。

---

## 5. ego-browser 網頁自動化最佳實踐

使用 `ego-browser nodejs` 驅動 Gemini 網頁版批次繪圖時之核心要點：

1. **避免 Viewport 超時**：
   Gemini 的「上傳與工具」按鈕需使用 `scrollIntoView()` 搭配 `page.evaluate()` 點擊，勿直接依賴座標點擊。
2. **安全獲取 Tab 與 TaskSpace 復原**：
   ```javascript
   let task;
   try { task = await claimTaskSpace("gemini redraw"); }
   catch { task = await taskSpace("gemini redraw"); }

   const pages = await task.pages();
   let page = pages.find((p) => p.label === "p1");
   if (!page) {
     const tabs = await task.tabs();
     const geminiTab = tabs.find((t) => (t.url || "").includes("gemini"));
     page = geminiTab ? await task.adopt(geminiTab.page, { as: "p1" }) : await task.newPage("p1");
   }
   ```
3. **僅從 `model-response` 抓圖**：
   嚴格限定選取 `document.querySelectorAll("model-response img")`，防止誤抓使用者輸入框的圖片縮圖。
4. **Canvas 匯出繞過 CSP**：
   Gemini 頁面有嚴格的 CSP，禁止 `fetch(blobUrl)`。改用 HTML5 Canvas 繪製後以 `toDataURL("image/png")` 提取 Base64。

---

## 6. 每個年級一整套（Per-grade Layer Sets）

四年級（Q 版大頭）到九年級（接近成人比例）身體差太多，同一張圖層縮放對位一定會穿模或比例怪，所以**每個年級各畫一整套**：
- 身體 `icons/avatar/base_gN.png`；換裝 `icons/avatar/gN/<部位>.png`（每個年級 39 張：前後髮各 6、上衣 6、褲裙 5、鞋 5、帽 5、配件 5＋背帶）。
- `js/avatar.js` 的 `avatarLayers` 直接取 `gN/` 那一套，**不做任何 CSS 縮放**；`tests/avatar.test.mjs` 檢查每個年級都齊全、都在 `sw.js` 快取清單。
- 參考圖的道具衣服、棕色妹妹頭都用**該年級自己那一套**，所以要照順序畫：
  `bottom`（褲裙）→ `top`（上衣）→ `hair` → `hat`、`acc`、`shoes`。
- 畫衣服時，參考圖穿淡藍背心＋深藍短褲當道具（不讓 AI 面對裸身），新衣服整件換掉道具；
  **對位時要忽略被換掉的道具**（`prop_mask`），否則對位會把道具和新圖的其他色塊硬配在一起、整張歪掉。
- 五官遮罩、後髮填滿線、背帶分界線都依 `STAGE_METRICS` 的頭頂／脖子換算到各年級。
- Prompt 帶入年齡（四年級 10 歲 … 九年級 15 歲），讓 AI 依該年級身形畫。
- **褲裙**：參考圖的道具背心剪到腰線（`WAIST`，肚臍上方），AI 才會把腰頭畫在腰上而不是肚臍下；
  摳圖後腰線以上清掉、胯下以上不能比臀寬（`HIP_PAD`）或身體輪廓還寬（否則會從上衣兩側、手臂和腰之間冒出來），並補小破洞。
- **鞋子**：`cover_feet` 把鞋子旁邊 14 px 內露出的腳用鞋子顏色補滿描框；處理時若腳踝以下仍有 3% 以上沒蓋到會印 ⚠ 提示重畫（涼鞋除外）。
- **細線清理**（`drop_thin`，所有類別都會跑；眼鏡除外、涼鞋改成只留腳踝以下）：AI 會沿手臂、膝蓋、下巴描線，這些無彩度細線會被一起摳出來，
  用開運算去掉；已輸出的圖層可以補跑 `python3 tools/avatar_redraw.py clean --grade N`（之後再跑 split_avatar_hair.mjs 重建後髮）。
- **眼鏡**：AI 畫的鏡框粗細不一、鏡片裡還會連重畫的眼睛一起摳出來 → 不用摳圖，`draw_glasses()` 以身體原本兩隻眼睛定位，直接畫一副乾淨的圓框眼鏡（半徑＝眼睛區塊 × 1.8）。
- **帽子／耳機／蝴蝶結 × 髮型**：這三種是畫在該年級「妹妹頭」上的，其他髮型比較扁、窄或寬 → `python3 tools/fit_head_items.py` 量每個年級每種髮型的頭頂高度與太陽穴／耳朵寬度，算出縮放平移寫進 `js/avatar.js` 的 `HEAD_FIT`，`renderAvatar` 套 CSS transform（只有這三種會套，衣服頭髮都不縮放）。重畫頭髮或帽子後要重跑。
- **背包拆層**：只有軀幹（臀寬範圍）上的背帶在前層，包體側邊放後層，不然會像兩片袖子蓋在手臂上。
- **身體底圖**：base_gN 原本白色連身衣換膚色時，軀幹兩側留下淡紫灰邊，會從上衣和手臂的縫露出來，已改成膚色（備份在 /tmp/avatar_backup/bases）。

## 7. 常用指令與驗證流程

```bash
# 每一類、每個年級：參考圖 → Gemini → 摳圖
for g in 4 5 6 7 8 9; do python3 tools/avatar_redraw.py ref bottom --grade $g; done
# tools/gen_avatar_redraw.js 改 RUN = ["bottom"]、GRADES，然後：
~/.local/bin/ego-browser nodejs < tools/gen_avatar_redraw.js   # → /tmp/avatar_gen/gN/bottom/<id>.png
for g in 4 5 6 7 8 9; do python3 tools/avatar_redraw.py process bottom --grade $g; done   # → icons/avatar/gN/
# 不滿意哪張就刪掉 /tmp/avatar_gen/gN/<kind>/<id>.png 再跑一次 gen（已有的會跳過）

# 檢查：六個年級 × 七套造型（?all=top 列出某部位全部選項）
python3 -m http.server 8765   # 開 http://localhost:8765/tools/avatar_preview.html
node tests/avatar.test.mjs
```
