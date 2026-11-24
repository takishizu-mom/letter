"""新しい動画からプロジェクトを作り、文字起こし・人物検出・スイング検出まで済ませる。

  python scripts/new_project.py <プロジェクト名> <動画1> [動画2 ...]

- 動画を input/<名前>/ にコピー
- 2 本以上のときは順番につなぎ、前の動画の最後と次の動画の最初で同じ話をしていれば重複を自動で切る
- スイング場面を見つけて、冒頭（通常→スロー）と締め（通常→スロー→通常）・サムネイルの場面を自動で設定
- projects/<名前>/project.json と、確認用の transcript.txt・swings.jpg を作る
タイトル・誤変換の修正（fixes）・強調語は transcript.txt を読んで project.json に書き足す。
"""
import difflib
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
import build_project  # noqa: E402
import find_swings  # noqa: E402
import make_short  # noqa: E402

ROOT = build_project.ROOT


def trim_overlaps(proj, pdir):
    """前の動画の最後の発言と、次の動画の最初の発言が同じなら、前の動画をその手前で切る。"""
    work = os.path.join(pdir, "work")
    for i in range(len(proj["inputs"]) - 1):
        a = build_project.load_json(os.path.join(work, f"in{i}.whisper.json"))["segments"]
        b = build_project.load_json(os.path.join(work, f"in{i + 1}.whisper.json"))["segments"]
        if not a or not b:
            continue
        last, first = a[-1]["text"].strip(), b[0]["text"].strip()
        # 次の動画の冒頭に、前の動画の最後の発言と同じ言葉が入っているか
        ratio = difflib.SequenceMatcher(a=last, b=first[:len(last)]).ratio()
        if ratio > 0.6:
            proj["inputs"][i]["end"] = round(a[-1]["start"] - 0.05, 2)
            print(f"重複を検出: 動画{i + 1}の最後「{a[-1]['text'].strip()}」を {proj['inputs'][i]['end']} 秒で切ります")


def swing_sheet(src, sw, out):
    """スイング候補の確認用コマ一覧。"""
    run = ["ffmpeg", "-v", "error", "-y", "-ss", str(sw["start"]), "-t", str(sw["end"] - sw["start"]), "-i", src,
           "-vf", "fps=6,scale=120:-1,tile=8x2", "-frames:v", "1", out]
    subprocess.run(run, check=True)


def main():
    pid, videos = sys.argv[1], sys.argv[2:]
    cfg = build_project.load_json(os.path.join(ROOT, "config", "style.json"))
    pdir = os.path.join(ROOT, "projects", pid)
    os.makedirs(os.path.join(pdir, "work"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "input", pid), exist_ok=True)
    inputs = []
    for i, v in enumerate(videos):
        dst = os.path.join("input", pid, f"{i + 1:02d}{os.path.splitext(v)[1].lower()}")
        shutil.copy(v, os.path.join(ROOT, dst))
        inputs.append({"file": dst})
    proj = {"id": pid, "inputs": inputs, "title": ["（タイトル1行目）", "（タイトル2行目）"], "title_emphasis": [],
            "fixes": {}, "emphasis": []}

    # 文字起こし・人物検出（各動画）→ 重複カット → つないだタイムラインを作り直す
    make_short.prepare_inputs(proj, pdir)
    trim_overlaps(proj, pdir)
    parts, total = make_short.prepare_inputs(proj, pdir)
    with open(os.path.join(pdir, "work", "parts.json"), "w") as f:
        json.dump(parts, f)

    # スイング検出 → 冒頭・締め・サムネイル
    cands = []
    for i, (src, start, end) in enumerate(parts):
        for sw in find_swings.find(src, os.path.join(pdir, "work", f"in{i}.layout.npz")):
            if sw["start"] >= start and sw["end"] <= end:
                cands.append(sw | {"input": i})
    cands.sort(key=lambda s: (s.get("guess", False), -s["strength"]))
    if cands:
        sw = cands[0]
        base = {"input": sw["input"]}
        normal = base | {"start": sw["start"], "end": sw["end"], "speed": 1}
        slow = base | {"start": sw["slowStart"], "end": sw["end"], "speed": 0.5}
        address = base | {"start": max(parts[sw["input"]][1], sw["start"] - 1.5), "end": sw["end"], "speed": 1}
        proj["intro"] = {"plays": [normal, slow]}
        proj["outro"] = {"plays": [address, slow, normal], "cta": cfg["cta"]}
        # サムネイルの文字はタイトルと同じ（変えたいときは thumbnail に lines / emphasis を書く）
        proj["thumbnail"] = {"input": sw["input"], "time": round(sw["end"] - 0.7, 2), "shift": 120}
        swing_sheet(parts[sw["input"]][0], sw, os.path.join(pdir, "swings.jpg"))
        print(f"スイング: 動画{sw['input'] + 1} の {sw['start']}〜{sw['end']} 秒" + ("（推定）" if sw.get("guess") else ""))
    else:
        print("スイング場面が見つかりませんでした（冒頭・締めのスイング再生なしで作ります）")

    with open(os.path.join(pdir, "project.json"), "w", encoding="utf-8") as f:
        json.dump(proj, f, ensure_ascii=False, indent=2)
    # 確認用の文字起こし（タイトル決め・誤変換チェック用）
    w = build_project.load_json(os.path.join(pdir, "whisper.json"))
    with open(os.path.join(pdir, "transcript.txt"), "w", encoding="utf-8") as f:
        for s in w["segments"]:
            f.write(f"{s['words'][0]['start']:7.2f}  {s['text'].strip()}\n")
    print(f"長さ（カット前）: {total:.1f} 秒")
    print(f"次: {pdir}/transcript.txt を読み、project.json の title / fixes / emphasis を書いてから")
    print(f"    python scripts/make_short.py projects/{pid}/project.json --from build")


if __name__ == "__main__":
    main()
