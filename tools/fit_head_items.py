#!/usr/bin/env python3
"""fit_head_items.py — 帽子／耳機／蝴蝶結跟著髮型微調位置與大小，寫進 js/avatar.js 的 HEAD_FIT

帽子、耳機、蝴蝶結都是在該年級「妹妹頭」上原位重畫的；其他髮型比較扁（短髮、長直髮）或比較寬（捲髮），
直接疊上去耳機頭帶會浮在頭頂上方、帽子太大、蝴蝶結飄在頭旁邊的空中。
這裡量每個年級每種髮型的輪廓（前髮＋後髮＋頭），跟妹妹頭比：
- 頭頂高度 top：中線附近最上面的頭髮
- 太陽穴寬 wT、耳朵寬 wE：從中線往兩側連續的寬度（雙馬尾、馬尾甩出去的不算）
算出縮放／平移（以 (ox, oy) 為原點，寬縮 sx、高縮 sy，再平移 dx, dy）：
- hat（帽子）：原點在太陽穴高度，寬跟 wT 比，高讓帽頂落在新的頭頂
- headphone（耳機）：原點在耳朵高度（耳罩不動），寬跟 wE 比，高讓頭帶落在新的頭頂
- bow（蝴蝶結）：不縮放，水平移到新髮型那一側的邊緣、垂直跟著頭頂
用法：python3 tools/fit_head_items.py（改完 STAGE_METRICS 或重畫頭髮／帽子後重跑）
"""
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
AV = ROOT / "icons" / "avatar"
JS = ROOT / "js" / "avatar.js"
HAIRS = ["short", "bob", "twin", "pony", "curly", "straight"]
REF = "bob"
src = JS.read_text()
METRICS = {g: {k: int(v) for k, v in re.findall(r"(\w+): (\d+)", body)} for g, body in re.findall(r"(g\d): \{(.*?)\}", src)}


def alpha(f):
    return np.asarray(Image.open(f).convert("RGBA").getchannel("A")) > 128


def run(row, lim, x=256):
    """從中線往兩側連續的範圍，最多到 lim=(左界, 右界)（雙馬尾、馬尾甩出去的不算）"""
    if not row[x]:
        return None
    l = r = x
    while l > lim[0] and row[l - 1]:
        l -= 1
    while r < lim[1] and row[r + 1]:
        r += 1
    return l, r


def measure(stage, hair):
    m = METRICS[stage]
    d = AV / stage
    sil = alpha(d / f"hair_{hair}.png") | alpha(d / f"hairback_{hair}.png")
    head = alpha(AV / f"base_{stage}.png")
    head[m["neck"] :] = False
    sil |= head
    hw = m["headR"] - m["headL"]
    # 頭頂：頭中間 40% 寬每一欄最上面那列取中位數（馬尾綁在頭頂的那一撮不會把頭頂拉高）
    cols = range(round(256 - 0.2 * hw), round(256 + 0.2 * hw) + 1)
    top = int(np.median([np.nonzero(sil[:, x])[0].min() for x in cols if sil[:, x].any()]))
    lim = (round(m["headL"] - 0.25 * hw), round(m["headR"] + 0.25 * hw))
    T = round(m["headTop"] + 0.35 * (m["neck"] - m["headTop"]))
    E = round(m["headTop"] + 0.6 * (m["neck"] - m["headTop"]))
    return {"top": top, "T": T, "E": E, "rT": run(sil[T], lim), "rE": run(sil[E], lim), "sil": sil, "lim": lim}


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def bow_box(stage):
    a = alpha(AV / stage / "hat_bow.png")
    ys, xs = np.nonzero(a)
    return float(xs.mean()), float(ys.mean()), int(xs.max() - xs.min())


def fit(stage):
    ref = measure(stage, REF)
    bx, by, bw = bow_box(stage)
    out = {}
    for h in HAIRS:
        cur = measure(stage, h)
        wT = (cur["rT"][1] - cur["rT"][0]) / (ref["rT"][1] - ref["rT"][0])
        wE = (cur["rE"][1] - cur["rE"][0]) / (ref["rE"][1] - ref["rE"][0])
        T, E = ref["T"], ref["E"]
        hat_sy = clamp((T - cur["top"]) / (T - ref["top"]), 0.8, 1.2)
        hp_sy = clamp((E - cur["top"]) / (E - ref["top"]), 0.8, 1.2)
        # 蝴蝶結：中心放在那一側髮型邊緣往內 35% 蝴蝶結寬（夾在頭髮上，不飄在空中）；妹妹頭也套用
        dy = clamp(cur["top"] - ref["top"], -20, 20)
        row = round(by + dy)
        cr = run(cur["sil"][row], cur["lim"])
        side = 1 if bx > 256 else -1
        bdx = ((cr[1] if side > 0 else cr[0]) - side * 0.35 * bw - bx) if cr else 0
        # 但不能往內蓋到眼睛：蝴蝶結內緣至少離中線 12% 頭寬
        hw = METRICS[stage]["headR"] - METRICS[stage]["headL"]
        inner = bx + bdx - side * bw / 2
        if side * (inner - 256) < 0.12 * hw:
            bdx += side * (0.12 * hw - side * (inner - 256))
        fit = {"bow": [1, 1, int(round(clamp(bdx, -40, 40))), int(dy), 256, 0]}
        if h != REF:  # 帽子、耳機本來就是在妹妹頭上畫的
            fit["hat"] = [round(clamp(wT, 0.85, 1.05), 3), round(clamp(hat_sy, 0.85, 1.05), 3), 0, 0, 256, T]
            fit["headphone"] = [round(clamp(wE, 0.8, 1.1), 3), round(hp_sy, 3), 0, 0, 256, E]
        out[h] = fit
    return out


def main():
    table = {f"g{g}": fit(f"g{g}") for g in range(4, 10)}
    lines = ["export const HEAD_FIT = {"]
    for st, hs in table.items():
        lines.append(f"  {st}: {{")
        for h, v in hs.items():
            lines.append(f"    {h}: {{ " + ", ".join(f"{k}: {x}" for k, x in v.items()) + " },")
        lines.append("  },")
    lines.append("};")
    block = "\n".join(lines)
    new = re.sub(r"export const HEAD_FIT = \{.*?\n\};", block, src, flags=re.S)
    assert new != src or block in src, "js/avatar.js 裡找不到 HEAD_FIT 區塊"
    JS.write_text(new)
    print(block)


if __name__ == "__main__":
    main()
