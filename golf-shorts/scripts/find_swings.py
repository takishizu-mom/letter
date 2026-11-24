"""動画の中からスイングしている場面を探す（冒頭・締めのスイング再生に使う候補）。

骨格推定で「手元が肩より上に上がる」瞬間を探す。トップ（短く上がる）のあとにフィニッシュ（しばらく上がったまま）が
続く区間をスイングとみなす。見つからないときは、人物のまわりの動きが大きい区間を候補にする。
  python scripts/find_swings.py input/動画.mov [layout.npz] → JSON（開始・終了・強さ）を出力
"""
import json
import subprocess
import sys

import numpy as np

W, H, FPS = 90, 160, 30


def motion(path, layout=None):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={FPS},scale={W}:{H},format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.int16)
    d = np.abs(np.diff(fr, axis=0)) > 22
    if layout is not None:  # 人物（＋クラブ）の付近だけを見る
        m = np.load(layout)["mask"]
        idx = np.minimum((np.arange(len(d)) / FPS * float(np.load(layout)["fps"])).astype(int), len(m) - 1)
        sub = m[:, ::2, ::2][idx]
        d &= sub[:, :H, :W]
    e = d.mean(axis=(1, 2))
    # カメラの揺れなど画面全体が動いた分を差し引く
    return np.convolve(e, np.ones(5) / 5, "same")


def by_pose(layout):
    lay = np.load(layout)
    if "pose" not in lay:
        return []
    fps = float(lay["fps"])
    hy, sy, _ = lay["pose"].T
    high = np.nan_to_num(hy, nan=1) < np.nan_to_num(sy, nan=0) - 0.02
    groups = []
    for i in np.where(high)[0]:
        t = i / fps
        if groups and t - groups[-1][1] <= 0.35:
            groups[-1][1] = t
        else:
            groups.append([t, t])
    swings = []
    for (a0, a1), (b0, b1) in zip(groups, groups[1:]):
        # トップ → 1.2 秒以内にフィニッシュ（0.5 秒以上手が高い位置）
        if b0 - a1 <= 1.2 and b1 - b0 >= 0.5:
            start = max(0.0, a0 - 0.6)
            swings.append({"start": round(start, 2), "end": round(b1 + 0.1, 2), "top": round(a0, 2),
                           "slowStart": round(max(start, a0 - 0.1), 2), "strength": round(b1 - b0, 2)})
    return sorted(swings, key=lambda r: -r["strength"])


def find(path, layout=None, top=3, length=2.2):
    if layout:
        swings = by_pose(layout)
        if swings:
            return swings[:top]
    e = motion(path, layout)
    win = int(length * FPS)
    score = np.convolve(e, np.ones(win), "valid")
    out = []
    order = np.argsort(score)[::-1]
    for i in order:
        if all(abs(i - j) > win * 1.5 for j, _ in out):
            out.append((int(i), float(score[i])))
        if len(out) >= top:
            break
    res = []
    for i, sc in out:
        seg = e[i:i + win]
        peak = i + int(np.argmax(seg))  # インパクト付近
        start = max(0, peak / FPS - 1.2)  # テークバック開始の目安
        res.append({"start": round(start, 2), "end": round(start + length, 2), "top": round(start + 0.6, 2),
                    "slowStart": round(start + 0.5, 2), "strength": round(sc / win * 100, 2), "guess": True})
    return sorted(res, key=lambda r: -r["strength"])


if __name__ == "__main__":
    print(json.dumps(find(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None), ensure_ascii=False, indent=1))
