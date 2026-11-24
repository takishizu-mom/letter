"""人物・クラブが映る領域を推定する（MediaPipe 骨格推定 + 人物セグメンテーション）。

出力: 10fps ごとの「テロップを置いてはいけない領域」マスク（元動画座標、低解像度）を npz に保存。
- 人物シルエット（顔・体）
- クラブ（手元から伸びる直線をシャフトとして検出。見つからないときは届きうる範囲を円で近似）
"""
import json
import os
import subprocess
import sys

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision

W, H, FPS = 180, 320, 10  # 解析解像度（9:16）
MODEL = os.path.join(os.path.dirname(__file__), "..", "assets", "models", "pose_landmarker_full.task")
CLUB_RATIO = 0.5  # 身長に対するクラブ（手元〜ヘッド）の長さの目安


MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/"
             "float16/latest/pose_landmarker_full.task")


def ensure_model() -> None:
    if not os.path.exists(MODEL):
        import urllib.request
        os.makedirs(os.path.dirname(MODEL), exist_ok=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL)


def read_frames(path: str) -> np.ndarray:
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={FPS},scale={W}:{H}:flags=area",
           "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


def club_zone(lm, height: float) -> np.ndarray:
    """シャフトが見つからないとき：両手の中点からクラブが届きうる範囲を円で近似する。"""
    z = np.zeros((H, W), np.uint8)
    hx = (lm[15].x + lm[16].x) / 2 * W
    hy = (lm[15].y + lm[16].y) / 2 * H
    r = int(height * CLUB_RATIO)
    cv2.circle(z, (int(hx), int(hy)), r, 1, -1)
    return z.astype(bool)


def detect_shaft(big, body, hands, height):
    """手元付近から伸びる直線（シャフト）を探し、クラブの先端方向を返す。big は 2 倍解像度。"""
    S = 2
    hx, hy = hands[0] * W * S, hands[1] * H * S
    hgt = height * S
    gray = cv2.cvtColor(big, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (3, 3), 0), 50, 140)
    yy, xx = np.mgrid[0:H * S, 0:W * S]
    dist = np.hypot(xx - hx, yy - hy)
    body_big = cv2.dilate(cv2.resize(body.astype(np.uint8), (W * S, H * S)), np.ones((5, 5), np.uint8)).astype(bool)
    edges[(dist > hgt * 0.62) | (dist < hgt * 0.03) | body_big] = 0
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=14, minLineLength=int(hgt * 0.09), maxLineGap=10)
    best = None
    for x1, y1, x2, y2 in (lines.reshape(-1, 4) if lines is not None else []):
        d = np.array([x2 - x1, y2 - y1], float)
        L = np.hypot(*d)
        # 手元からの直線の延長上にあるか
        perp = abs(d[0] * (hy - y1) - d[1] * (hx - x1)) / L
        near = min(np.hypot(x1 - hx, y1 - hy), np.hypot(x2 - hx, y2 - hy))
        if perp < hgt * 0.06 and near < hgt * 0.3 and (best is None or L > best[0]):
            far = (x2, y2) if np.hypot(x2 - hx, y2 - hy) > np.hypot(x1 - hx, y1 - hy) else (x1, y1)
            best = (L, far)
    if best is None:
        return None
    fx, fy = best[1]
    v = np.array([fx - hx, fy - hy], float)
    v /= np.linalg.norm(v)
    tip = (hx + v[0] * hgt * CLUB_RATIO, hy + v[1] * hgt * CLUB_RATIO)
    z = np.zeros((H, W), np.uint8)
    p0 = (int(hx / S), int(hy / S))
    p1 = (int(tip[0] / S), int(tip[1] / S))
    cv2.line(z, p0, p1, 1, max(2, int(height * 0.05)))
    cv2.circle(z, p1, max(3, int(height * 0.07)), 1, -1)  # クラブヘッド
    return z.astype(bool)


def analyze(path: str, out: str) -> dict:
    ensure_model()
    frames = read_frames(path)
    opts = vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL),
        running_mode=vision.RunningMode.VIDEO,
        output_segmentation_masks=True,
    )
    bodies, shafts, circles, heads, hands, last = [], [], [], [], [], None
    with vision.PoseLandmarker.create_from_options(opts) as det:
        # 精度のため 2 倍解像度で推定
        for i, f in enumerate(frames):
            big = cv2.resize(f, (W * 2, H * 2), interpolation=cv2.INTER_CUBIC)
            res = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=big), int(i * 1000 / FPS))
            if res.pose_landmarks:
                lm = res.pose_landmarks[0]
                body = cv2.resize(res.segmentation_masks[0].numpy_view(), (W, H)) > 0.4
                ys = [p.y for p in lm]
                height = (max(ys) - min(ys)) * H
                head_top = min(min(ys) * H - 0.07 * height, np.argmax(body.any(1)) if body.any() else H)
                hand = ((lm[15].x + lm[16].x) / 2, (lm[15].y + lm[16].y) / 2)
                prev = last[3] if last else hand
                moving = np.hypot(hand[0] - prev[0], hand[1] - prev[1]) * FPS > 0.8  # スイング中はブレて見えない
                shaft = None if moving else detect_shaft(big, body, hand, height)
                last = (body, club_zone(lm, height), head_top, hand)
            else:
                shaft = None
            if last is None:
                bodies.append(np.zeros((H, W), bool))
                circles.append(np.zeros((H, W), bool))
                shafts.append(None)
                heads.append(H)
                hands.append((np.nan, np.nan))
                continue
            bodies.append(last[0])
            circles.append(last[1])
            shafts.append(shaft)
            heads.append(last[2])
            hands.append(last[3])
    # シャフトが見えないコマは前後 0.5 秒で見えたシャフト位置を使い、それもなければ円で近似
    masks, found = [], 0
    for i in range(len(bodies)):
        near = [shafts[j] for j in range(max(0, i - 5), min(len(shafts), i + 6)) if shafts[j] is not None]
        if shafts[i] is not None:
            found += 1
            club = shafts[i]
        elif len(near) >= 2:
            club = np.any(near, axis=0)
        else:
            club = circles[i]
        m = cv2.dilate((bodies[i] | club).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
        masks.append(m)
    masks = np.array(masks)
    heads = np.array(heads, float) / H
    # 手元の移動速度（スイング中かどうかの判定に使う。単位: 画面高さ/秒）
    hands = np.array(hands, float)
    speed = np.r_[0, np.hypot(*np.diff(hands, axis=0).T) * FPS]
    np.savez_compressed(out, mask=masks, head=heads, hand_speed=np.nan_to_num(speed), fps=FPS)
    return {"frames": int(len(masks)), "shaft_found": found, "head_top_p05": float(np.percentile(heads, 5)),
            "head_top_median": float(np.median(heads))}


if __name__ == "__main__":
    print(json.dumps(analyze(sys.argv[1], sys.argv[2]), ensure_ascii=False))
