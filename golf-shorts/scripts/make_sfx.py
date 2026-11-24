"""控えめな効果音を合成して assets/sfx に保存する（自作音源なのでライセンス上の制約なし）。"""
import os
import wave

import numpy as np

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sfx")


def save(name, x):
    x = np.clip(x / np.max(np.abs(x)) * 0.8, -1, 1)
    st = np.stack([x, x], axis=1)
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((st * 32767).astype("<i2").tobytes())


def pop():
    """タイトル表示用：やわらかい「ポン」。"""
    t = np.arange(int(SR * 0.16)) / SR
    f = 620 * np.exp(-t * 18) + 330
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = (1 - np.exp(-t * 900)) * np.exp(-t * 26)
    return np.sin(ph) * env + 0.25 * np.sin(2 * ph) * env


def tick():
    """強調テロップ用：小さな木琴風の「コッ」。"""
    t = np.arange(int(SR * 0.12)) / SR
    env = (1 - np.exp(-t * 2000)) * np.exp(-t * 45)
    return (np.sin(2 * np.pi * 1320 * t) + 0.5 * np.sin(2 * np.pi * 2640 * t) + 0.2 * np.sin(2 * np.pi * 3960 * t)) * env


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    save("pop.wav", pop())
    save("tick.wav", tick())
    print("ok")
