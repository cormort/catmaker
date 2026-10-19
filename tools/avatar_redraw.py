#!/usr/bin/env python3
"""avatar_redraw.py — 重畫髮型／配件的前後處理（搭配 tools/gen_avatar_redraw.js）

作法：不再畫「物件圖板」再猜位置，而是讓 AI 直接在某個年級的身體上畫（--grade N，預設 4），
畫完用顏色把新畫的東西摳出來，位置天生就對齊 base_gN，輸出到 icons/avatar/gN/（每個年級一整套）。
- 參考圖的「道具衣服」都用該年級自己那一套（gN/ 底下的檔案），所以要照順序畫：
  bottom（褲裙）→ top（上衣）→ hair（髮型）→ hat、acc、shoes。
  上衣、褲裙的參考圖穿淡藍背心＋深藍短褲當道具（不讓 AI 面對裸身），新衣服整件蓋掉道具，沒蓋到的道具有彩度不會被摳走。
- 參考圖：base_gN（穿淡藍上衣）鋪滿純綠底。綠底、膚色、藍衣服都有彩度，
  AI 畫的頭髮／配件規定是白／灰（遊戲裡再上色），所以「沒有彩度」的像素就是新畫的東西。
  配件的參考圖另外戴一頂棕色妹妹頭（有彩度，不會被摳走），耳機、眼鏡才會戴在頭髮外面。
- 眼睛、線稿也沒彩度：跟參考圖比，和參考圖幾乎一樣的就不算。
- AI 輸出的大小、位置可能略有不同：比對綠底／皮膚／藍上衣的色塊自動找縮放與平移對回去。
  帽子的參考圖也戴同一頂棕色妹妹頭，帽子會戴在頭髮上。
- 背包拆兩層：壓在身體上的（背帶）→ acc_backpack_front（疊在上衣前面），其餘 → acc_backpack（身體後面）。

用法（kind 是 bottom、top、hair、hat、acc 或 shoes；每個指令都可以加 --grade N，預設 4）：
  python3 tools/avatar_redraw.py ref <kind> --grade 7        # 產生 /tmp/avatar_ref/g7/<kind>.png
  （跑 tools/gen_avatar_redraw.js，輸出 /tmp/avatar_gen/g7/<kind>/<id>.png）
  python3 tools/avatar_redraw.py process <kind> --grade 7 [id ...]   # 摳圖 → icons/avatar/g7/（頭髮另外產生後髮）
  python3 tools/avatar_redraw.py process <kind> --grade 7 --preview  # 只輸出到 /tmp/avatar_gen/g7/<kind>/out 並出預覽圖
  python3 tools/avatar_redraw.py split-backpack --grade 7    # 把現有的 g7/acc_backpack.png 拆成前後兩層
  python3 tools/avatar_redraw.py clean --grade 7             # 對 g7/ 現有圖層補做細線清理（process 已內建）
需要 Pillow、numpy；process hair 最後會呼叫 node tools/split_avatar_hair.mjs --fresh。
"""
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
AV = ROOT / "icons" / "avatar"
GRADE = int(sys.argv[sys.argv.index("--grade") + 1]) if "--grade" in sys.argv else 4
AVG = AV / f"g{GRADE}"  # 這個年級的換裝圖層
BASE = AV / f"base_g{GRADE}.png"


def stage_metrics():
    """從 js/avatar.js 讀 STAGE_METRICS（各年級頭頂、脖子、領口…），避免兩份數字各寫一次"""
    src = (ROOT / "js" / "avatar.js").read_text()
    block = re.search(r"STAGE_METRICS\s*=\s*\{(.*?)\n\};", src, re.S).group(1)
    return {g: {k: int(v) for k, v in re.findall(r"(\w+): (\d+)", body)} for g, body in re.findall(r"(g\d): \{(.*?)\}", block)}


M = stage_metrics()[f"g{GRADE}"]
W = H = 512
SIDE = 1024  # 參考圖邊長
GREEN = (0, 177, 64)
SHIRT = (156, 195, 230)  # 淡藍上衣，讓衣服有彩度、不會被當成頭髮／配件
HAIR_REF = (138, 90, 52)  # 配件、帽子參考圖的棕色頭髮
PANTS = (74, 111, 165)  # 配件、帽子參考圖的深藍短褲（不穿褲子 AI 可能自己補畫）
SAT_MAX = 30  # 彩度（RGB 最大減最小）低於這個算「白／灰」＝新畫的東西；AI 畫得偏米色時可以調高
WAIST = round(M["collar"] + 0.55 * (M["crotch"] - M["collar"]))  # 腰線（肚臍上方）：畫褲裙時道具上衣剪到這裡，褲裙腰頭就畫在這條線
_B0 = min(212, WAIST - 40)  # 褲裙框：腰線上方一點到畫布底（正方形，置中）
# 參考圖從 512 畫布裁哪一塊（正方形 x0, y0, x1, y1）
KINDS = {
    "bottom": {"crop": (256 - (512 - _B0) // 2, _B0, 256 + (512 - _B0) // 2, 512), "prefix": "bottom_"},  # 腰到腳底（長裙到腳踝）
    "hair": {"crop": (106, 20, 406, 320), "prefix": "hair_"},  # 頭＋肩，留空間給長髮
    "acc": {"crop": (56, 20, 456, 420), "prefix": "acc_"},  # 頭到腰，背包、名牌、圍巾都在框內
    "hat": {"crop": (96, 0, 416, 320), "prefix": "hat_"},  # 頭往上留空間給帽冠、兩側給寬帽簷
    "shoes": {"crop": (156, 292, 376, 512), "prefix": "shoes_"},  # 膝下到腳底（鞋子要穿在腳上，不能用「物件圖」猜位置）
    "top": {"crop": (106, M["neck"] - 40, 406, M["neck"] + 260), "prefix": "top_"},  # 下巴到大腿（跟著該年級的脖子高度）
}
TOP_PROP = {"top": "top_vest", "bottom": "top_vest"}  # 畫衣服時穿淡藍背心當道具（其他類別穿淡藍 T 恤）
# 和 js/avatar.js 的 ACC_COLOR 一致（預覽用）
HAT_COLOR = {"cap": (224, 87, 79), "beanie": (127, 176, 216), "straw": (232, 201, 122), "beret": (176, 127, 192), "bow": (239, 127, 168)}  # 和 AVATAR_PARTS.hat 一致
ACC_COLOR = {"glasses": (51, 51, 51), "scarf": (224, 87, 79), "backpack": (138, 90, 52), "headphone": (58, 58, 58), "badge": (201, 162, 39)}
# 和 js/avatar.js 的 AVATAR_PARTS.shoes 一致（預覽用）
SHOES_COLOR = {"sneaker": (240, 240, 240), "boots": (107, 74, 53), "loafer": (63, 58, 54), "sandal": (201, 138, 91), "rainboot": (242, 199, 68)}
BOTTOM_COLOR = {"jeans": (74, 111, 165), "shorts": (122, 92, 70), "skirt": (212, 106, 138), "pleat": (140, 107, 177), "sport": (79, 107, 82)}
PREVIEW_COLOR = {"hat": HAT_COLOR, "acc": ACC_COLOR, "shoes": SHOES_COLOR, "bottom": BOTTOM_COLOR}
HIP_PAD = 3  # 褲裙在臀部以上可以比身體臀寬多出的像素（布料厚度）
NECK_LINE = M["neck"] - 7  # 背包：這條線以下、壓在身體上的才算背帶（頭後面的仍在身體後面）


def ref_path(kind):
    return Path(f"/tmp/avatar_ref/g{GRADE}/{kind}.png")


def gen_dir(kind):
    return Path(f"/tmp/avatar_gen/g{GRADE}/{kind}")


def tinted(file, color):
    im = Image.open(file).convert("RGBA")
    t = Image.fromarray((np.asarray(im.convert("RGB"), np.float32) * np.asarray(color, np.float32) / 255).astype(np.uint8)).convert("RGBA")
    t.putalpha(im.getchannel("A"))
    return t


def scene(kind, hair_color=HAIR_REF):
    """參考場景（512 畫布，該年級身體）：後髮 → 身體 → 深藍短褲 → 淡藍上衣（畫衣服時是背心）→ 頭和脖子（疊在領口前面，跟遊戲一樣）→ 棕色妹妹頭；
    畫髮型時不戴頭髮。道具衣服、頭髮都用該年級自己那一套"""
    base = Image.open(BASE).convert("RGBA")
    canvas = Image.new("RGBA", (W, H), GREEN + (255,))
    hair = kind != "hair"
    if hair:
        canvas.alpha_composite(tinted(AVG / "hairback_bob.png", hair_color))
    canvas.alpha_composite(base)
    canvas.alpha_composite(tinted(AVG / "bottom_shorts.png", PANTS))
    top = tinted(AVG / f"{TOP_PROP.get(kind, 'top_tshirt')}.png", SHIRT)
    if kind == "bottom":  # 道具背心剪成短版露出腰：不然 AI 會把腰頭畫在背心下襬（肚臍以下），太低
        a = np.asarray(top.getchannel("A")).copy()
        a[WAIST:] = 0
        top.putalpha(Image.fromarray(a))
    canvas.alpha_composite(top)
    head = base.copy()
    mask = np.zeros((H, W), np.uint8)
    mask[: M["neck"] + 12] = 255  # 脖子以上
    head.putalpha(Image.fromarray(np.minimum(np.asarray(head.getchannel("A")), mask)))
    canvas.alpha_composite(head)
    if hair:
        canvas.alpha_composite(tinted(AVG / "hair_bob.png", hair_color))
    return canvas


def build_ref(kind):
    crop = KINDS[kind]["crop"]
    ref = scene(kind).crop(crop).resize((SIDE, SIDE), Image.LANCZOS).convert("RGB")
    path = ref_path(kind)
    path.parent.mkdir(parents=True, exist_ok=True)
    ref.save(path)
    print(f"參考圖 {path}（{SIDE}x{SIDE}）")


def classes(img, n, brown=False):
    """縮成 n x n 後分類：1 綠底、2 皮膚、3 藍上衣／短褲、4 棕髮（配件參考圖）、0 其他（白灰的新東西、線稿 → 對位時不算）"""
    a = np.asarray(img.resize((n, n), Image.BILINEAR), np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    out = np.zeros((n, n), np.int8)
    out[(g - np.maximum(r, b)) > 40] = 1
    out[(r > 170) & (r - b > 25) & (r >= g) & (g >= b - 10)] = 2
    out[(b > r + 30) & (b > 150) & (g > r)] = 3
    if brown:  # 只有配件參考圖有棕髮；髮型參考圖不分這類，免得皮膚陰影被誤判
        out[(r < 170) & (r > g) & (g > b) & (r - b > 50)] = 4
    return out


def _best(gc, rc, scales, offs):
    n = len(gc)
    ys, xs = np.nonzero(rc > 0)
    want = rc[ys, xs]
    best = ((-1.0, 0), 1.0, 0.0, 0.0)
    for s in scales:
        for dy in offs[1]:
            gy = np.round((ys - n / 2) * s + n / 2 + dy).astype(int)
            okY = (gy >= 0) & (gy < n)
            for dx in offs[0]:
                gx = np.round((xs - n / 2) * s + n / 2 + dx).astype(int)
                ok = okY & (gx >= 0) & (gx < n)
                got = np.zeros_like(want)
                got[ok] = gc[gy[ok], gx[ok]]
                # 頭髮、線稿的地方 got=0，不算對也不算錯；先比「對的比例」，同分再比「對的數量」
                hit = int((got == want).sum())
                miss = int(((got > 0) & (got != want)).sum())
                score = (round(hit / max(1, hit + miss), 3), hit)
                if score > best[0]:
                    best = (score, s, dx, dy)
    return best


def prop_mask(kind):
    """參考圖（SIDE 座標）裡「會被新衣服換掉」的道具：畫褲裙時的深藍短褲、畫上衣時的淡藍背心。
    對位時不能拿它比（新圖裡它已經不在了，會把整張圖拉歪）"""
    prop = {"bottom": "bottom_shorts", "top": "top_vest"}.get(kind)
    if not prop:
        return None
    a = Image.open(AVG / f"{prop}.png").getchannel("A").crop(KINDS[kind]["crop"]).resize((SIDE, SIDE))
    return a


def register(gen, ref, brown=False, ignore=None):
    """找出 gen → ref 的縮放 s 與平移 (dx, dy)（ref 像素座標 p 對到 gen 的 (p - c) * s + c + d）。
    比的是綠底／皮膚／藍上衣／棕髮這幾種顏色區塊，新畫的白灰東西和線稿不算，所以頭髮蓋住臉不影響對位。
    先在 64x64 粗找，再到 256、512 細修。ignore（L 模式遮罩）蓋到的參考圖像素不比。"""

    def rcls(n):
        c = classes(ref, n, brown)
        if ignore is not None:
            c[np.asarray(ignore.resize((n, n), Image.BILINEAR)) > 20] = 0
        return c

    n = 64
    _, s, dx, dy = _best(classes(gen, n, brown), rcls(n), np.arange(0.80, 1.21, 0.02), (range(-12, 13), range(-12, 13)))
    n2 = 256
    k = n2 / n
    score, s, dx, dy = _best(
        classes(gen, n2, brown), rcls(n2), np.arange(s - 0.02, s + 0.021, 0.005),
        (np.arange(dx * k - 4, dx * k + 5), np.arange(dy * k - 4, dy * k + 5)),
    )
    n3 = 512
    score, s, dx, dy = _best(
        classes(gen, n3, brown), rcls(n3), np.arange(s - 0.006, s + 0.0061, 0.003),
        (np.arange(dx * 2 - 2, dx * 2 + 3), np.arange(dy * 2 - 2, dy * 2 + 3)),
    )
    print(f"  對位吻合 {score[0]:.1%}")
    return s, dx * SIDE / n3, dy * SIDE / n3


def warp(gen, s, dx, dy):
    """把 gen 轉回 ref 座標（SIDE x SIDE）"""
    c = SIDE / 2
    # PIL 的 affine 是 output → input：x_in = a*x + b*y + c0
    return gen.transform((SIDE, SIDE), Image.AFFINE, (s, 0, c - c * s + dx, 0, s, c - c * s + dy), resample=Image.BICUBIC, fillcolor=GREEN)


def enclosed_holes(keep):
    """回傳被 keep 完全包圍的封閉區域（從邊界連不到的空白）。
    背帶這種「白底＋深灰外框」的東西，外框會被摳出來、裡面鏤空，
    看起來就只剩兩條線；把封閉區域補起來才會是實心的。"""
    from collections import deque
    h, w = keep.shape
    outside = np.zeros_like(keep)
    q = deque()
    for y in range(h):
        for x in (0, w - 1):
            if not keep[y, x] and not outside[y, x]:
                outside[y, x] = True
                q.append((y, x))
    for x in range(w):
        for y in (0, h - 1):
            if not keep[y, x] and not outside[y, x]:
                outside[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not keep[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                q.append((ny, nx))
    return ~keep & ~outside


def morph_close(mask, r):
    """方形結構元素的膨脹再侵蝕：補掉背帶中間被上衣顏色吃掉的破洞。
    AI 畫的背帶在壓到藍上衣的地方會吃進一點藍（彩度超過門檻）→ 摳圖時中間被挖空，
    看起來像兩條斷掉的線；先膨脹再侵蝕可以把這種窄破洞接起來。"""
    m = mask.copy()
    for _ in range(r):
        d = m.copy()
        d[1:, :] |= m[:-1, :]
        d[:-1, :] |= m[1:, :]
        d[:, 1:] |= m[:, :-1]
        d[:, :-1] |= m[:, 1:]
        m = d
    for _ in range(r):
        e = m.copy()
        e[1:, :] &= m[:-1, :]
        e[:-1, :] &= m[1:, :]
        e[:, 1:] &= m[:, :-1]
        e[:, :-1] &= m[:, 1:]
        m = e
    return m


def face_box(crop):
    """五官（眉毛、眼睛、嘴巴）在參考圖（SIDE 座標）的範圍：照該年級頭頂到脖子的比例換算（g4 量的比例）"""
    k = SIDE / (crop[2] - crop[0])
    ht, nk = M["headTop"], M["neck"]
    half = 0.3 * (M["headR"] - M["headL"])
    y0, y1 = ht + 0.30 * (nk - ht), ht + 0.77 * (nk - ht)
    return (y0 - crop[1]) * k, (y1 - crop[1]) * k, (256 - half - crop[0]) * k, (256 + half - crop[0]) * k


def extract(gen, ref, crop, fill_holes=False):
    a = np.asarray(gen, np.int16)
    rf = np.asarray(ref, np.int16)
    sat = a.max(-1) - a.min(-1)
    green = (a[..., 1] - np.maximum(a[..., 0], a[..., 2])) > 40
    neutral = (sat < SAT_MAX) & ~green
    same = np.abs(a - rf).max(-1) < 40
    ref_neutral = (rf.max(-1) - rf.min(-1)) < SAT_MAX
    # 只扣除五官特徵區（眉毛、眼睛、嘴巴）；頭部與臉頰外輪廓不應扣除，否則會在頭髮內留下頭殼虛線切痕
    y_idx, x_idx = np.indices(neutral.shape)
    fy0, fy1, fx0, fx1 = face_box(crop)
    is_face_feature = (y_idx >= fy0) & (y_idx <= fy1) & (x_idx >= fx0) & (x_idx <= fx1)
    hair = neutral & ~(same & ref_neutral & is_face_feature)
    # 只留夠大的塊（最大塊的 2% 以上；眼睛、雜點會掉）
    from collections import deque
    lab = np.zeros(hair.shape, np.int32)
    sizes = [0]
    h, w = hair.shape
    for sy in range(0, h, 2):
        for sx in range(0, w, 2):
            if not hair[sy, sx] or lab[sy, sx]:
                continue
            idx = len(sizes)
            sizes.append(0)
            q = deque([(sy, sx)])
            lab[sy, sx] = idx
            while q:
                y, x = q.popleft()
                sizes[idx] += 1
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < h and 0 <= nx < w and hair[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = idx
                        q.append((ny, nx))
    big = max(sizes)
    keep = np.isin(lab, [i for i, n in enumerate(sizes) if n > big * 0.02 and i])
    if fill_holes:
        keep = morph_close(keep, 6)
        keep = keep | enclosed_holes(keep)
    lum = (a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11).clip(0, 255).astype(np.uint8)
    alpha = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = Image.merge("RGBA", (Image.fromarray(lum),) * 3 + (alpha,))
    # 縮回 512 畫布
    size = crop[2] - crop[0]
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(out.resize((size, size), Image.LANCZOS), (crop[0], crop[1]))
    return canvas


def _shift_all(m, op):
    """四鄰域一步膨脹（op=np.logical_or）或侵蝕（op=np.logical_and）"""
    d = m.copy()
    d[1:, :] = op(d[1:, :], m[:-1, :])
    d[:-1, :] = op(d[:-1, :], m[1:, :])
    d[:, 1:] = op(d[:, 1:], m[:, :-1])
    d[:, :-1] = op(d[:, :-1], m[:, 1:])
    return d


THIN_R = 2  # 比 2*THIN_R+1 px 還細、又沒連著實心布料的線條會被清掉
NO_THIN = {"acc_glasses"}
GLASS_RIM = 3  # 眼鏡框留幾 px 寬  # 本身就是細線的東西不清


def drop_thin(img, name):
    """清掉摳圖時一起被摳進來的細線：AI 沿手臂、膝蓋、腳踝、領口描的外框線（無彩度）會被當成新畫的東西。
    作法：開運算（先侵蝕再膨脹）找出實心部分，只留實心部分往外 THIN_R+2 px 內的像素（布料自己的外框線還在），
    再丟掉跟最大塊比起來很小的碎塊。"""
    a = np.asarray(img.getchannel("A"))
    if name == "acc_glasses":  # 眼鏡是細線不能開運算；改成只留頭部範圍（脖子以下、頭兩側以外的描線都不要）
        b = a.copy()
        b[round(M["headTop"] + 0.75 * (M["neck"] - M["headTop"])) :] = 0  # 眼睛在頭高一半左右，下巴附近不會有眼鏡
        b[:, : M["headL"] - 10] = 0
        b[:, M["headR"] + 11 :] = 0
        # 鏡片裡會連 AI 重畫的眼睛、反光一起摳出來（上色後像墨鏡）：把每個鏡片當實心圓，只留外緣 GLASS_RIM px 的鏡框
        m = b > 128
        disc = m | enclosed_holes(m)
        inner = disc
        for _ in range(GLASS_RIM):
            inner = _shift_all(inner, np.logical_and)
        b[inner] = 0
        out = img.copy()
        out.putalpha(Image.fromarray(b))
        return draw_glasses()
        out = img.copy()
        out.putalpha(Image.fromarray(b))
        return out
    if name in NO_THIN:
        return img
    if name == "shoes_sandal":  # 細帶子不能用開運算清；改成腳踝以上（小腿上的描線）全部不要
        out = img.copy()
        b = a.copy()
        b[: M["ankle"] - 15] = 0
        out.putalpha(Image.fromarray(b))
        return out
    m = a > 128
    if not m.any():
        return img
    core = m
    for _ in range(THIN_R):
        core = _shift_all(core, np.logical_and)
    for _ in range(THIN_R * 2 + 2):
        core = _shift_all(core, np.logical_or)
    keep = core
    from collections import deque
    h, w = keep.shape
    lab = np.zeros(keep.shape, np.int32)
    sizes = [0]
    for sy, sx in zip(*np.nonzero(keep & m)):
        if lab[sy, sx]:
            continue
        idx = len(sizes)
        sizes.append(0)
        q = deque([(sy, sx)])
        lab[sy, sx] = idx
        while q:
            y, x = q.popleft()
            sizes[idx] += 1
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and keep[ny, nx] and m[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = idx
                    q.append((ny, nx))
    big = max(sizes)
    good = np.isin(lab, [i for i, n in enumerate(sizes) if i and n >= max(30, big * 0.03)])
    good = _shift_all(_shift_all(good, np.logical_or), np.logical_or) & (a > 0)  # 補回半透明的反鋸齒邊
    out = img.copy()
    out.putalpha(Image.fromarray(np.where(good, a, 0).astype(np.uint8)))
    return out


def cover_feet(img, reach=14):
    """鞋子沒蓋到、但離鞋子 reach px 內的腳（AI 把鞋畫得稍微偏一點，腳趾／腳跟會從旁邊露出來）：
    用相鄰鞋子像素的顏色一圈一圈往外補滿，最外圈描深灰外框，鞋子就把腳整個包住。"""
    foot = np.asarray(Image.open(BASE).getchannel("A")) > 128
    foot[: M["ankle"] + 4] = False
    px = np.asarray(img).astype(np.float32).copy()
    have = px[..., 3] > 128
    filled = np.zeros_like(have)
    for _ in range(reach):
        grow = _shift_all(have, np.logical_or) & foot & ~have
        if not grow.any():
            break
        acc = np.zeros(px.shape[:2] + (3,), np.float32)
        cnt = np.zeros(px.shape[:2], np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            src = np.roll(np.roll(have, dy, 0), dx, 1)
            col = np.roll(np.roll(px[..., :3], dy, 0), dx, 1)
            acc += col * src[..., None]
            cnt += src
        px[grow, :3] = acc[grow] / cnt[grow, None]
        px[grow, 3] = 255
        have |= grow
        filled |= grow
    edge = filled & ~_shift_all(have, np.logical_and)  # 補出來那圈的最外緣 → 外框
    px[edge, :3] = 92
    return Image.fromarray(px.clip(0, 255).astype(np.uint8))


def draw_glasses(img=None):
    """畫一副乾淨的圓框眼鏡（4 倍超取樣反鋸齒）。AI 畫的眼鏡鏡框粗細不一、鏡片裡還有重畫的眼睛，摳出來不好看，
    所以直接以身體原本的兩隻眼睛定位：鏡片圓心＝眼睛中心（略往下），半徑＝眼睛深色區塊等效半徑 × 1.8（g4 原本那副量出來的比例）。
    淺灰鏡框＋深灰描邊（遊戲裡 multiply 上色）、中間鼻橋、兩側鏡腳伸到頭的側邊。"""
    from PIL import ImageDraw
    base = np.asarray(Image.open(BASE).convert("RGBA")).astype(np.int16)
    lum = base[..., :3].mean(-1)
    ht, nk = M["headTop"], M["neck"]
    zone = np.zeros(lum.shape, bool)
    zone[round(ht + 0.3 * (nk - ht)) : round(ht + 0.75 * (nk - ht)), M["headL"] + 5 : M["headR"] - 5] = True
    dark = (lum < 120) & (base[..., 3] > 200) & zone
    eyes = []
    for half in (slice(0, 256), slice(256, W)):
        ys, xs = np.nonzero(dark[:, half])
        eyes.append((xs.mean() + half.start, ys.mean(), np.sqrt(len(xs) / np.pi)))
    rad = 1.8 * (eyes[0][2] + eyes[1][2]) / 2
    cy = (eyes[0][1] + eyes[1][1]) / 2 + 0.2 * rad
    mid = (eyes[0][0] + eyes[1][0]) / 2
    off = (eyes[1][0] - eyes[0][0]) / 2
    cxs = [mid - off, mid + off]
    k = 4
    big = Image.new("RGBA", (W * k, H * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    line = max(1.6, rad * 0.15)
    dark, light = (70, 70, 74, 255), (215, 215, 220, 255)
    for wid, col in ((line + 1.6, dark), (line - 0.6, light)):
        for cx in cxs:
            d.ellipse([(cx - rad) * k, (cy - rad) * k, (cx + rad) * k, (cy + rad) * k], outline=col, width=round(wid * k))
        # 鼻橋：兩片鏡框之間略往上拱
        d.arc([(mid - (off - rad)) * k, (cy - rad * 0.55) * k, (mid + (off - rad)) * k, (cy + rad * 0.35) * k], 200, 340, fill=col, width=round(wid * 0.8 * k))
        # 鏡腳：往外到頭的側邊（耳朵前）
        for cx, side in ((cxs[0] - rad, M["headL"] + 6), (cxs[1] + rad, M["headR"] - 6)):
            d.line([cx * k, (cy - rad * 0.25) * k, side * k, (cy - rad * 0.35) * k], fill=col, width=round(wid * 0.8 * k))
    return big.resize((W, H), Image.LANCZOS)


def split_backpack(img):
    """背包拆前後：NECK_LINE 以下、壓在身體或上衣上的像素 → 前（背帶），其餘 → 後"""
    body = np.asarray(Image.open(BASE).getchannel("A")) > 128
    body |= np.asarray(Image.open(AVG / "top_tshirt.png").getchannel("A")) > 128
    body[:NECK_LINE] = False
    # 只有軀幹上的背帶算前層；手臂旁邊的包體側邊要在手臂後面（不然會像兩片棕色袖子蓋在手臂上）
    body[:, : M["hipL"] - 6] = False
    body[:, M["hipR"] + 7 :] = False
    a = np.asarray(img.getchannel("A"))
    front, back = img.copy(), img.copy()
    front.putalpha(Image.fromarray(np.where(body, a, 0).astype(np.uint8)))
    back.putalpha(Image.fromarray(np.where(body, 0, a).astype(np.uint8)))
    return front, back


def save_acc(aid, img, out_dir):
    if aid == "backpack":
        front, back = split_backpack(img)
        back.save(out_dir / "acc_backpack.png")
        front.save(out_dir / "acc_backpack_front.png")
    else:
        img.save(out_dir / f"acc_{aid}.png")


def preview(kind, ids, out_dir):
    """預覽圖：參考場景（去綠底）疊上新圖層；頭髮換三種髮色、疊在光頭身體上"""
    crop = KINDS[kind]["crop"]
    size = 300
    colors = [(58, 47, 42), (138, 90, 52), (232, 138, 168)] if kind == "hair" else [None]
    sheet = Image.new("RGB", (size * len(ids), size * len(colors)))
    s = scene(kind)
    green = np.all(np.asarray(s)[..., :3] == GREEN, -1)
    s.putalpha(Image.fromarray(np.where(green, 0, 255).astype(np.uint8)))
    for i, iid in enumerate(ids):
        for j, col in enumerate(colors):
            c = Image.new("RGBA", (W, H), (122, 156, 198, 255))
            if kind == "hair":
                c.alpha_composite(tinted(out_dir / f"hairback_{iid}.png", col))
            if kind == "acc" and iid == "backpack":
                c.alpha_composite(tinted(out_dir / "acc_backpack.png", ACC_COLOR["backpack"]))
            c.alpha_composite(s)
            name = "acc_backpack_front" if kind == "acc" and iid == "backpack" else f"{KINDS[kind]['prefix']}{iid}"
            c.alpha_composite(tinted(out_dir / f"{name}.png", col or PREVIEW_COLOR.get(kind, {}).get(iid, (168, 213, 162))))
            sheet.paste(c.crop(crop).resize((size, size)).convert("RGB"), (i * size, j * size))
    path = gen_dir(kind) / "preview.png"
    sheet.save(path)
    print(f"預覽 {path}")


def process(kind, args):
    dry = "--preview" in args
    gdir = gen_dir(kind)
    ids = [a for a in args if not a.startswith("--") and a != str(GRADE)] or sorted(p.stem for p in gdir.glob("*.png") if p.stem != "preview")
    if not ref_path(kind).exists():
        build_ref(kind)
    ref = Image.open(ref_path(kind)).convert("RGB")
    crop = KINDS[kind]["crop"]
    out_dir = gdir / "out" if dry else AVG
    out_dir.mkdir(parents=True, exist_ok=True)
    done = []
    for iid in ids:
        f = gdir / f"{iid}.png"
        if not f.exists():
            print(f"缺 {f}，跳過")
            continue
        gen = Image.open(f).convert("RGB")
        if gen.size != (SIDE, SIDE):
            gen = gen.resize((SIDE, SIDE), Image.LANCZOS)
        s, dx, dy = register(gen, ref, brown=(kind != "hair"), ignore=prop_mask(kind))
        img = extract(warp(gen, s, dx, dy), ref, crop, fill_holes=(kind == "acc" and iid == "backpack"))
        if kind == "bottom":  # 腰線以上是道具上衣的外框線（AI 沿著剪短的下襬描邊），褲裙不會長到那裡
            al = np.asarray(img.getchannel("A")).copy()
            al[morph_close(al > 128, 2) & (al < 250)] = 255  # 補褶襬邊緣的小破洞（AI 的亮部被當成背景摳掉）
            al[: WAIST + 2] = 0
            # 胯下以上（腰到臀）不能比臀寬還寬：不然會從上衣兩側、手臂下面冒出來
            al[: M["crotch"], : M["hipL"] - HIP_PAD] = 0
            al[: M["crotch"], M["hipR"] + HIP_PAD + 1 :] = 0
            # 也不能跑到身體輪廓外（手臂和腰之間的空隙只有幾 px，不能留餘裕，不然會從縫裡露出一條褲裙色）
            body = np.asarray(Image.open(BASE).getchannel("A")) > 128
            al[: M["crotch"]][~body[: M["crotch"]]] = 0
            # 腰到胯下每一列只留「從中線連續過去的軀幹」那段（手臂另外一段不算），褲裙兩端才不會從上衣和手臂之間探出來
            for y in range(WAIST, M["crotch"]):
                row = body[y]
                l = r = 256
                while l > 0 and row[l - 1]:
                    l -= 1
                while r < W - 1 and row[r + 1]:
                    r += 1
                al[y, :l] = 0
                al[y, r + 1 :] = 0
            img.putalpha(Image.fromarray(al))
        img = drop_thin(img, f"{KINDS[kind]['prefix']}{iid}")
        if kind == "acc":
            save_acc(iid, img, out_dir)
        else:
            img.save(out_dir / f"{KINDS[kind]['prefix']}{iid}.png")
        if kind == "shoes" and iid != "sandal":
            img = cover_feet(img)
        if kind == "shoes" and iid != "sandal":  # 鞋子要把腳整個包住：腳踝以下的腳沒被蓋到的比例太高就提醒重畫
            foot = np.asarray(Image.open(BASE).getchannel("A")) > 128
            foot[: M["ankle"] + 4] = False
            cov = (foot & (np.asarray(img.getchannel("A")) > 128)).sum() / foot.sum()
            if cov < 0.97:
                print(f"  ⚠ shoes_{iid} 只蓋住 {cov:.0%} 的腳（會露出腳趾／腳跟），建議刪掉 {gdir / (iid + '.png')} 重畫")
        n = int((np.asarray(img.getchannel("A")) > 128).sum())
        print(f"{KINDS[kind]['prefix']}{iid}: 縮放 {s:.2f} 平移 ({dx:+.0f}, {dy:+.0f})，{n} px")
        done.append(iid)
    if done and kind == "hair":
        cmd = ["node", str(ROOT / "tools" / "split_avatar_hair.mjs"), "--fresh", "--grade", str(GRADE), "--dir", str(out_dir)] + done
        subprocess.run(cmd, check=True)
    if done:
        preview(kind, done, out_dir)


if __name__ == "__main__":
    cmd, rest = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ("", [])
    if cmd in ("ref", "process") and rest and rest[0] in KINDS:
        build_ref(rest[0]) if cmd == "ref" else process(rest[0], rest[1:])
    elif cmd == "clean":
        # 對已經輸出的圖層補做細線清理（後髮要再跑一次 split_avatar_hair.mjs 從前髮重建）
        for f in sorted(AVG.glob("*.png")):
            if f.stem.startswith("hairback_"):
                continue
            im = Image.open(f).convert("RGBA")
            before = int((np.asarray(im.getchannel("A")) > 128).sum())
            im = drop_thin(im, f.stem)
            im.save(f)
            print(f"{f.stem}: 清掉 {before - int((np.asarray(im.getchannel('A')) > 128).sum())} px")
    elif cmd == "split-backpack":
        whole = Image.open(AVG / "acc_backpack.png").convert("RGBA")  # 前後兩層合回一張再重拆
        whole.alpha_composite(Image.open(AVG / "acc_backpack_front.png").convert("RGBA"))
        front, back = split_backpack(whole)
        back.save(AVG / "acc_backpack.png")
        front.save(AVG / "acc_backpack_front.png")
        print("acc_backpack.png（後）＋ acc_backpack_front.png（背帶）")
    else:
        print(__doc__)
