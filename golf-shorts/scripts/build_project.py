"""Whisper の結果からテロップ・カット・配置を決め、Remotion 用の edit.json と SRT を作る。

使い方:
  python scripts/build_project.py projects/<id>/project.json
（ふつうは scripts/make_short.py から呼ばれる）
"""
import difflib
import json
import os
import re
import subprocess
import sys

import numpy as np

import golf_terms

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC = os.path.join(ROOT, "remotion", "public")
PARTICLES = set("はがをにでとものへやか") | {"って", "けど", "から", "ので", "より"}
SMALL = set("ゃゅょぁぃぅぇぉっャュョァィゥェォッー")
PUNCT = "、。，．,.!！?？…"


def load_json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


# ---------- 文字起こし → 文字ごとの時刻 ----------

def segment_chars(seg):
    """セグメント内の各文字に（開始, 終了）時刻を割り当てる。"""
    chars, times = [], []
    for w in seg.get("words", []):
        text = w["word"].strip()
        if not text:
            continue
        n = len(text)
        for i, ch in enumerate(text):
            a = w["start"] + (w["end"] - w["start"]) * i / n
            b = w["start"] + (w["end"] - w["start"]) * (i + 1) / n
            chars.append(ch)
            times.append((a, b))
    return "".join(chars), times


def apply_fixes(text, times, fixes):
    """用語修正を行い、修正後の文字にも元の時刻を引き継ぐ。"""
    fixed = golf_terms.correct(text)
    for a, b in fixes.items():
        fixed = fixed.replace(a, b)
    if fixed == text:
        return text, times
    sm = difflib.SequenceMatcher(a=text, b=fixed, autojunk=False)
    new_times = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            new_times.extend(times[i1:i2])
        else:
            src = times[i1:i2] or [times[min(i1, len(times) - 1)]]
            a, b = src[0][0], src[-1][1]
            n = j2 - j1
            for k in range(n):
                new_times.append((a + (b - a) * k / n, a + (b - a) * (k + 1) / n))
    return fixed, new_times


# ---------- テロップの区切り ----------

def char_width(ch):
    return 0.55 if ord(ch) < 0x2E80 else 1.0


def text_width(s):
    return sum(char_width(c) for c in s)


def char_kind(ch):
    if re.match(r"[ぁ-ゖ]", ch):
        return "h"
    if re.match(r"[ァ-ヺー]", ch):
        return "k"
    if re.match(r"[一-龯々〆]", ch):
        return "j"
    return "o"


CONTENT = {"名詞", "動詞", "形容詞", "副詞", "連体詞", "接続詞", "感動詞", "代名詞", "形状詞"}
_tagger = None
_cache = {}


def boundary_scores(s):
    """形態素解析で各位置の「区切りやすさ」を求める（文節の切れ目ほど高い）。"""
    global _tagger
    if s in _cache:
        return _cache[s]
    if _tagger is None:
        import fugashi
        _tagger = fugashi.Tagger()
    toks = [(w.surface, w.feature.pos1, w.feature.pos2) for w in _tagger(s)]
    score = [-60] * (len(s) + 1)  # 単語の途中では切らない
    pos = 0
    for k, (surf, p1, p2) in enumerate(toks):
        if k > 0:
            prev = toks[k - 1]
            if prev[1] == "補助記号":
                sc = 10
            elif p2 == "非自立可能" and p1 in ("動詞", "形容詞"):
                sc = -10 if prev[1] == "助詞" else -20  # 「して｜いる」「ないと｜いけない」はなるべく切らない
            elif p1 in CONTENT and prev[1] in ("助詞", "助動詞"):
                sc = 7
            elif p1 in CONTENT and prev[1] == "接尾辞":
                sc = 4
            elif p1 in CONTENT and prev[1] in CONTENT and not (p1 == "名詞" and prev[1] == "名詞") and prev[1] != "接頭辞":
                sc = 2
            elif p1 in ("助詞", "助動詞", "補助記号") or prev[1] == "接頭辞" or p1 == "接尾辞":
                sc = -20
            else:
                sc = -8
            score[pos] = sc
        pos += len(surf)
    _cache[s] = score
    return score


def break_score(s, i):
    """s[:i] | s[i:] で区切るときの自然さ（大きいほど良い）。"""
    if i <= 0 or i >= len(s):
        return -99
    if s[i] in PUNCT or s[i] in SMALL:
        return -50
    return boundary_scores(s)[i]


def split_phrases(text, times, max_len):
    """文ごとに、自然な区切り（読点・助詞のあと）で 1 テロップに収まる長さに分ける。
    動的計画法で「区切りの自然さ」と「短すぎる断片を作らない」を両立させる。"""
    out = []
    sentences, start = [], 0
    for i, ch in enumerate(text):
        if ch in "。！？!?":
            sentences.append((start, i + 1))
            start = i + 1
    if start < len(text):
        sentences.append((start, len(text)))
    for s0, s1 in sentences:
        n = s1 - s0
        best = {0: (0.0, None)}  # 位置 → (コスト, 直前の区切り)
        for j in range(1, n + 1):
            cands = []
            for i in best:
                piece = text[s0 + i:s0 + j]
                w = text_width(piece.strip(PUNCT))
                if w > max_len + (2 if j == n else 0):
                    continue
                cost = best[i][0] + 16  # テロップ数は少なめに
                if j < n:
                    cost -= break_score(text, s0 + j) * 1.5
                if w < 5:
                    cost += 30  # 短すぎる断片（「す」など）は避ける
                cost += abs(w - max_len * 0.75) * 0.4
                cands.append((cost, i))
            if cands:
                best[j] = min(cands)
        if n not in best:  # どうしても収まらないときは長さで切る
            for k in range(s0, s1, int(max_len)):
                out.append((text[k:min(s1, k + int(max_len))], times[k:min(s1, k + int(max_len))]))
            continue
        cuts, j = [], n
        while j:
            cuts.append(j)
            j = best[j][1]
        prev = 0
        for c in reversed(cuts):
            out.append((text[s0 + prev:s0 + c], times[s0 + prev:s0 + c]))
            prev = c
    return [(t, tm) for t, tm in out if t.strip(PUNCT + " ")]


def wrap_lines(text, max_chars):
    """2 行に折り返す。文節の切れ目を優先し、行の長さもなるべくそろえる。"""
    if text_width(text) <= max_chars:
        return [text.replace("、", " ").strip()]
    best, cut = None, len(text) // 2
    for i in range(2, len(text) - 1):
        l1, l2 = text[:i].strip("、"), text[i:].strip("、")
        if text_width(l1) > max_chars + 0.5 or text_width(l2) > max_chars + 0.5:
            continue
        sc = break_score(text, i) * 2 - abs(text_width(l1) - text_width(l2)) * 0.8
        if text[i - 1] == "、":
            sc += 12
        if best is None or sc > best:
            best, cut = sc, i
    return [text[:cut].strip("、").replace("、", " ").strip(), text[cut:].strip("、").replace("、", " ").strip()]


def mark_emphasis(line, words):
    """強調語を黄色の span に分ける。"""
    spans, i = [], 0
    pattern = "|".join(sorted(map(re.escape, words), key=len, reverse=True))
    for m in re.finditer(pattern, line) if pattern else []:
        if m.start() > i:
            spans.append({"text": line[i:m.start()]})
        spans.append({"text": m.group(), "em": True})
        i = m.end()
    if i < len(line):
        spans.append({"text": line[i:]})
    return spans


STRONG = re.compile(r"(重要|大事|大切|ポイント|コツ|お勧めしない|おすすめしない|絶対|NG|ダメ|正解|ここ)")


def caption_size(text, has_em):
    if STRONG.search(text) and text_width(text) <= 11:
        return "L"
    if has_em and text_width(text) <= 8:
        return "L"
    if text_width(text) >= 18:
        return "S"
    return "M"


# ---------- カット ----------

def plan_cuts(words, duration, hand_speed, fps_mask, cfg):
    """長い無音のうち、手元が動いていない区間だけを詰める。"""
    keep = []
    first, last = words[0][0], words[-1][1]

    def moving(a, b):
        i, j = int(a * fps_mask), max(int(a * fps_mask) + 1, int(b * fps_mask))
        seg = hand_speed[i:j]
        return len(seg) and np.percentile(seg, 90) > cfg["motionSpeed"]

    # 冒頭はタイトルを見せる時間（introHold 秒）だけ残す
    start = max(0.0, first - cfg["introHold"]) if not moving(0, first) else 0.0
    cursor = start
    for (a0, a1), (b0, b1) in zip(words, words[1:]):
        gap = b0 - a1
        if gap > cfg["maxGap"] and not moving(a1, b0):
            half = cfg["keepGap"] / 2
            keep.append((cursor, a1 + half))
            cursor = b0 - half
    end = duration if moving(last, duration) else min(duration, last + cfg["tail"])
    keep.append((cursor, end))
    # 書き出し時にずれが積み重ならないよう、フレーム単位にそろえる
    fps = cfg.get("fps", 60)
    return [(round(a * fps) / fps, round(b * fps) / fps) for a, b in keep]


def unmap(t, keep):
    """編集後の時刻 → 元のタイムラインの時刻。"""
    acc = 0.0
    for a, b in keep:
        if t <= acc + (b - a):
            return a + t - acc
        acc += b - a
    return keep[-1][1]


def remap(t, keep):
    acc = 0.0
    for a, b in keep:
        if t < a:
            return acc
        if t <= b:
            return acc + t - a
        acc += b - a
    return acc


# ---------- 配置（顔・体・クラブを避ける） ----------

def blocked_top(mask, t0, t1, fps_mask, x0, x1, offset, scale_out):
    """区間中に人物/クラブが現れる最も上の y（出力座標）。"""
    i, j = int(t0 * fps_mask), max(int(t0 * fps_mask) + 1, int(np.ceil(t1 * fps_mask)))
    m = mask[max(0, i - 1):min(len(mask), j + 1)]
    if not len(m):
        return 1920
    u = m.any(axis=0)
    cols = slice(max(0, int(x0 / scale_out)), min(u.shape[1], int(np.ceil(x1 / scale_out))))
    rows = u[:, cols].any(axis=1)
    if not rows.any():
        return 1920
    return int(np.argmax(rows) * scale_out + offset)


def layout_caption(cap, mask, fps_mask, cfg, occupied_bottom, warnings):
    W = cfg["width"]
    safe = cfg["safe"]
    fs = cfg["fontSizes"][cap["size"]]
    scale_out = W / mask.shape[2]
    while True:
        lines = cap["linesText"]
        width = max(text_width(l) for l in lines) * fs + fs * 0.4
        x0, x1 = (W - width) / 2, (W + width) / 2
        h = len(lines) * fs * 1.18 + fs * 0.25
        top = max(safe["top"], occupied_bottom + 10)
        limit = blocked_top(mask, cap["src_start"], cap["src_end"], fps_mask, x0, x1, cfg["videoOffsetY"], scale_out)
        # ズーム分の余白
        limit -= 24
        fits_width = width <= W - safe["left"] - safe["right"]
        if (top + h <= limit and fits_width) or fs <= cfg["fontSizes"]["min"]:
            if top + h > limit:
                warnings.append(f"{cap['start']:.1f}s「{''.join(lines)}」: 人物/クラブに近い（空き {limit - top:.0f}px）")
            return fs, int(top)
        fs -= 4


def place_box(mask, t0, t1, fps_mask, cfg, candidates, w, h):
    """候補位置のうち、区間中に人物/クラブと重ならない最初の位置を返す。"""
    scale_out = cfg["width"] / mask.shape[2]
    i, j = int(t0 * fps_mask), int(np.ceil(t1 * fps_mask))
    u = mask[max(0, i):min(len(mask), j + 1)].any(axis=0)
    best = None
    for x, y in candidates:
        r0 = int((y - cfg["videoOffsetY"]) / scale_out)
        r1 = int(np.ceil((y + h - cfg["videoOffsetY"]) / scale_out))
        c0, c1 = int(x / scale_out), int(np.ceil((x + w) / scale_out))
        overlap = u[max(0, r0):max(0, r1), max(0, c0):c1].mean() if r1 > 0 else 0
        if best is None or overlap < best[0]:
            best = (overlap, x, y)
        if overlap == 0:
            break
    return best


def build(project_path):
    pdir = os.path.dirname(os.path.abspath(project_path))
    proj = load_json(project_path)
    cfg = load_json(os.path.join(ROOT, "config", "style.json"))
    cfg.update(proj.get("style_overrides", {}))
    pid = proj["id"]
    terms = golf_terms.load()
    emphasis = terms["emphasis"] + proj.get("emphasis", [])

    whisper = load_json(os.path.join(pdir, "whisper.json"))
    lay = np.load(os.path.join(pdir, "layout.npz"))
    mask, hand_speed, fps_mask = lay["mask"], lay["hand_speed"], float(lay["fps"])
    parts = load_json(os.path.join(pdir, "work", "parts.json"))
    duration = sum(b - a for _, a, b in parts)

    # 1) 文字単位の時刻つきテキスト（修正込み）
    phrases = []
    word_times = []
    # 間が短いセグメントはひと続きの発話としてまとめてから区切る
    utterances = []
    for seg in whisper["segments"]:
        text, times = segment_chars(seg)
        if not text:
            continue
        word_times += [(w["start"], w["end"]) for w in seg["words"]]
        if utterances and times[0][0] - utterances[-1][1][-1][1] < 0.6 and utterances[-1][0][-1] not in "。！？":
            prev_text, prev_times = utterances[-1]
            if prev_text[-1] not in PUNCT:  # セグメントの切れ目は読点として扱う
                prev_text += "、"
                prev_times = prev_times + [(prev_times[-1][1], times[0][0])]
            utterances[-1] = (prev_text + text, prev_times + times)
        else:
            utterances.append((text, times))
    for text, times in utterances:
        text, times = apply_fixes(text, times, proj.get("fixes", {}))
        for p_text, p_times in split_phrases(text, times, max_len=cfg["maxPhrase"]):
            phrases.append((p_text, p_times))

    # 2) カット
    keep = proj.get("keep") or plan_cuts(word_times, duration, hand_speed, fps_mask, cfg["cut"] | {"fps": cfg["fps"]})
    new_duration = sum(b - a for a, b in keep)

    # 3) テロップ
    caps = []
    for text, times in phrases:
        raw = text.strip("、。 ").replace("。", "、")
        display = raw.replace("、", " ")
        has_em = any(w in display for w in emphasis)
        size = caption_size(display, has_em)
        if size == "L" and text_width(raw) > cfg["maxCharsPerLine"]["L"] and len(wrap_lines(raw, cfg["maxCharsPerLine"]["L"])) > 1 \
                and min(text_width(x) for x in wrap_lines(raw, cfg["maxCharsPerLine"]["L"])) < 3:
            size = "M"
        caps.append({
            "src_start": times[0][0], "src_end": times[-1][1],
            "start": remap(times[0][0], keep), "end": remap(times[-1][1], keep),
            "text": display, "size": size,
            "linesText": wrap_lines(raw, cfg["maxCharsPerLine"][size]),
        })
    for c in proj.get("caption_overrides", []):
        for cap in caps:
            if cap["text"] == c["match"]:
                cap.update({k: v for k, v in c.items() if k != "match"})
                if "text" in c:
                    cap["linesText"] = c.get("lines") or wrap_lines(c["text"], cfg["maxCharsPerLine"][cap["size"]])
    # 表示時間：次のテロップまで（短い間は詰める）
    for a, b in zip(caps, caps[1:]):
        a["end"] = b["start"] if b["start"] - a["end"] < 0.7 else a["end"] + 0.35
        a["src_end"] = max(a["src_end"], b["src_start"] if b["start"] - a["end"] < 0.05 else a["src_end"])
    if caps:
        caps[-1]["end"] = min(new_duration, caps[-1]["end"] + 0.6)
    for a, b in zip(caps, caps[1:] + [None]):  # 最低表示時間（次のテロップとは重ねない）
        a["end"] = max(a["end"], a["start"] + 0.5)
        if b:
            a["end"] = min(a["end"], b["start"])

    # 4) タイトル
    t_cfg = cfg["title"]
    title_lines = [mark_emphasis(l, proj.get("title_emphasis", [])) for l in proj["title"]]
    # タイトルは話し始めまで（短すぎ・長すぎないよう制限）
    first_cap = caps[0]["start"] if caps else t_cfg["duration"]
    title_end = min(t_cfg["duration"], max(t_cfg["minDuration"], first_cap))
    title_bottom = t_cfg["y"] + 48 + len(title_lines) * t_cfg["fontSize"] * 1.18

    # 5) 配置
    warnings = []
    out_caps = []
    for c in caps:
        occupied = title_bottom if c["start"] < title_end else 0
        if c["end"] > new_duration - 3:  # 最後に名前を帯に出すときはその下に置く
            occupied = max(occupied, cfg["safe"]["top"] + 70)
        fs, y = layout_caption(c, mask, fps_mask, cfg, occupied, warnings)
        out_caps.append({
            "start": round(c["start"], 3), "end": round(c["end"], 3), "size": c["size"],
            "fontSize": fs, "y": y, "text": c["text"],
            "lines": [mark_emphasis(l, emphasis) for l in c["linesText"]],
        })

    # 6) ズームと効果音（控えめ）：強調テロップのうち間隔をあけて数回だけ
    zooms, sfx, last = [], [], -99
    for c in out_caps:
        if c["size"] == "L" and c["start"] - last >= cfg["zoom"]["minGap"] and len(zooms) < cfg["zoom"]["maxCount"]:
            zooms.append({"start": c["start"], "end": min(c["end"] + 0.6, new_duration), "scale": cfg["zoom"]["scale"]})
            sfx.append({"t": c["start"], "file": cfg["sfx"]["accent"]["file"], "volume": cfg["sfx"]["accent"]["volume"]})
            last = c["start"]
    sfx.insert(0, {"t": 0.05, "file": cfg["sfx"]["title"]["file"], "volume": cfg["sfx"]["title"]["volume"]})

    # 7) 名前表示の位置（冒頭・最後とも人物/クラブを避ける）
    name = cfg["name"] | proj.get("name", {})
    cands = [(56, y) for y in (1330, 1160, 990, 820)]
    for key, (t0, t1) in {"intro": (name["start"], name["end"]),
                          "outro": (new_duration - 3, new_duration)}.items():
        ov, x, y = place_box(mask, unmap(t0, keep), unmap(t1, keep), fps_mask, cfg, cands, 470, 170)
        # 空きがなければ上部の帯に 1 行で表示（冒頭はタイトルの上の行に名前が入るので省略）
        name[key] = {"x": x, "y": y, "mode": "plate" if ov == 0 else ("none" if key == "intro" else "band")}

    rel = f"projects/{pid}"
    edit = {
        "fps": cfg["fps"], "width": cfg["width"], "height": cfg["height"], "duration": round(new_duration, 3),
        "video": f"{rel}/source.mp4", "videoOffsetY": cfg["videoOffsetY"],
        "title": {"lines": title_lines, "start": 0, "end": title_end, "fontSize": t_cfg["fontSize"], "y": t_cfg["y"]},
        "name": name,
        "captions": out_caps, "zooms": zooms, "sfx": sfx,
        "bgm": cfg["bgm"] | proj.get("bgm", {}),
        "style": cfg["style"],
    }
    return edit, keep, warnings


def write_srt(caps, path):
    def ts(t):
        ms = int(round(t * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    with open(path, "w", encoding="utf-8") as f:
        for i, c in enumerate(caps, 1):
            text = "\n".join("".join(s["text"] for s in line) for line in c["lines"])
            f.write(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{text}\n\n")


if __name__ == "__main__":
    edit, keep, warnings = build(sys.argv[1])
    print(json.dumps({"keep": keep, "captions": len(edit["captions"]), "warnings": warnings}, ensure_ascii=False, indent=1))
