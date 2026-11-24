"""完成動画の品質チェック。output/<id>_qc.md と確認用のコマ一覧画像を作る。

- 解像度・fps・映像と音声の長さのずれ（音ズレ）
- ラウドネス（YouTube 基準 -14 LUFS 付近か）、BGM と声のバランス
- テロップの文字切れ（画面端に文字がかかっていないか）
- テロップ一覧（誤字チェック用）と、辞書の誤変換が残っていないか
- YouTube ショートの UI 領域を重ねたコマ一覧
"""
import json
import os
import re
import subprocess
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import golf_terms  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# YouTube ショートの UI が重なる領域（1080×1920 基準のおおよその値）
UI_ZONES = [
    ("上部アイコン", (0, 0, 1080, 200)),
    ("右側ボタン", (900, 880, 1080, 1660)),
    ("下部タイトル・チャンネル名", (0, 1500, 1080, 1920)),
]


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "stream=codec_type,width,height,r_frame_rate,duration,sample_rate:format=duration",
                          "-of", "json", path], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def loudness(path, af=None):
    cmd = ["ffmpeg", "-hide_banner", "-i", path]
    if af:
        cmd += ["-af", af + ",ebur128=peak=true"]
    else:
        cmd += ["-af", "ebur128=peak=true"]
    err = subprocess.run(cmd + ["-f", "null", "-"], capture_output=True, text=True).stderr
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
    tp = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", err)
    return float(i[-1]) if i else None, float(tp[-1]) if tp else None


def frame_at(path, t):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", path, "-frames:v", "1", "-vf", "scale=1080:1920",
                          "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(1920, 1080, 3).copy() if raw else None


def main(project_path, video):
    proj = json.load(open(project_path, encoding="utf-8"))
    pdir = os.path.dirname(project_path)
    edit = json.load(open(os.path.join(pdir, "edit.json"), encoding="utf-8"))
    pid = proj["id"]
    out_dir = os.path.dirname(video)
    lines = [f"# 品質チェック: {pid}", ""]

    info = probe(video)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next(s for s in info["streams"] if s["codec_type"] == "audio")
    drift = abs(float(v["duration"]) - float(a["duration"]))
    lines += ["## 映像・音声",
              f"- 解像度 {v['width']}×{v['height']} / {v['r_frame_rate']} fps / 長さ {float(info['format']['duration']):.2f} 秒",
              f"- 映像と音声の長さの差: {drift * 1000:.0f} ms {'✅' if drift < 0.1 else '⚠️'}"]
    src = os.path.join(ROOT, "remotion", "public", edit["video"])
    lines.append(f"- 編集素材と完成版の長さの差: {abs(float(probe(src)['format']['duration']) - float(info['format']['duration'])) * 1000:.0f} ms")

    i_all, tp = loudness(video)
    lines += ["", "## 音量",
              f"- 全体ラウドネス {i_all:.1f} LUFS（目標 -14）/ トゥルーピーク {tp:.1f} dBFS {'✅' if tp <= -1.0 else '⚠️'}",
              f"- BGM 音量: 元音源の {edit['bgm']['volume'] * 100:.0f}%（約 {20 * np.log10(edit['bgm']['volume']):.0f} dB）"]

    # テロップ
    terms = golf_terms.load()
    suspicious = [w for w in terms["replacements"] if not w.startswith("re:")]
    lines += ["", "## テロップ一覧（誤字確認用）", "", "| # | 時間 | サイズ | テロップ | 備考 |", "|---|---|---|---|---|"]
    sheet = []
    edge_issues = 0
    for n, c in enumerate(edit["captions"], 1):
        text = " / ".join("".join(s["text"] for s in line) for line in c["lines"])
        note = []
        if any(w in text for w in suspicious):
            note.append("⚠️ 誤変換候補")
        t = (c["start"] + c["end"]) / 2
        img = frame_at(video, t)
        if img is not None:
            h = int(len(c["lines"]) * c["fontSize"] * 1.25)
            band = img[c["y"]:c["y"] + h]
            edge = np.concatenate([band[:, :6], band[:, -6:]], axis=1)
            if (edge.min(axis=2) > 235).mean() > 0.01:
                note.append("⚠️ 端で文字切れの可能性")
                edge_issues += 1
            if c["y"] < UI_ZONES[0][1][3] or c["y"] + h > UI_ZONES[2][1][1]:
                note.append("⚠️ UI と重なる位置")
            sheet.append((t, img, text))
        lines.append(f"| {n} | {c['start']:.1f}–{c['end']:.1f}s | {c['size']} {c['fontSize']}px | {text} | {' '.join(note)} |")
    lines.insert(lines.index("## テロップ一覧（誤字確認用）") + 1,
                 f"文字切れの疑い: {edge_issues} 件 {'✅' if edge_issues == 0 else '⚠️'}")

    # コマ一覧（UI 領域を半透明で重ねる）
    thumbs = []
    for t, img, _ in sheet[:: max(1, len(sheet) // 24)][:24]:
        ov = img.copy()
        for _, (x0, y0, x1, y1) in UI_ZONES:
            cv2.rectangle(ov, (x0, y0), (x1, y1), (60, 60, 255), -1)
        img = cv2.addWeighted(ov, 0.25, img, 0.75, 0)
        cv2.putText(img, f"{t:.1f}s", (20, 1900), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 4)
        thumbs.append(cv2.resize(img, (270, 480), interpolation=cv2.INTER_AREA))
    while len(thumbs) % 6:
        thumbs.append(np.zeros_like(thumbs[0]))
    rows = [np.hstack(thumbs[i:i + 6]) for i in range(0, len(thumbs), 6)]
    sheet_path = os.path.join(out_dir, f"{pid}_qc_sheet.jpg")
    cv2.imwrite(sheet_path, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])
    lines += ["", f"コマ一覧（赤い部分が YouTube の UI 領域）: {os.path.basename(sheet_path)}"]

    with open(os.path.join(out_dir, f"{pid}_qc.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("\n".join(lines[:12]))


if __name__ == "__main__":
    main(os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2]))
