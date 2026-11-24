"""ゴルフ動画 → YouTube ショート を一括で作る。

  python scripts/make_short.py projects/<id>/project.json [--from build|render] [--fast]

手順: 音声抽出 → Whisper → 人物/クラブ検出 → テロップ・カット・配置 → 素材書き出し
      → Remotion で描画 → 音量を -14 LUFS に整える → 品質チェック
途中結果はキャッシュされるので、edit.json やテロップ修正後は --from render で再描画だけできる。
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import build_project  # noqa: E402

ROOT = build_project.ROOT
PUBLIC = build_project.PUBLIC
REMOTION = os.path.join(ROOT, "remotion")
PY = sys.executable


def run(cmd, **kw):
    print("$", " ".join(str(c) for c in cmd)[:200], flush=True)
    return subprocess.run(cmd, check=True, **kw)


def probe_duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return float(out)


def prepare_inputs(proj, pdir):
    """各素材を文字起こし・解析し、つなげた 1 本のタイムラインに統合する。"""
    work = os.path.join(pdir, "work")
    os.makedirs(work, exist_ok=True)
    segments, masks, speeds, parts = [], [], [], []
    offset = 0.0
    for i, item in enumerate(proj["inputs"]):
        src = os.path.join(ROOT, item["file"])
        start = item.get("start", 0.0)
        end = item.get("end") or probe_duration(src)
        wav = os.path.join(work, f"in{i}.wav")
        wj = os.path.join(work, f"in{i}.whisper.json")
        lz = os.path.join(work, f"in{i}.layout.npz")
        if not os.path.exists(wav):
            run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-ar", "16000", wav])
        if not os.path.exists(wj):
            run([PY, os.path.join(ROOT, "scripts", "transcribe.py"), wav, wj])
        if not os.path.exists(lz):
            run([PY, os.path.join(ROOT, "scripts", "layout_mask.py"), src, lz], stderr=subprocess.DEVNULL)
        w = build_project.load_json(wj)
        for s in w["segments"]:
            words = [dict(x, start=x["start"] - start + offset, end=x["end"] - start + offset)
                     for x in s.get("words", []) if start - 0.05 <= x["start"] < end]
            if words:
                segments.append({"text": s["text"], "words": words})
        lay = np.load(lz)
        fps = float(lay["fps"])
        a, b = int(start * fps), int(end * fps)
        masks.append(lay["mask"][a:b])
        speeds.append(lay["hand_speed"][a:b])
        parts.append((src, start, end))
        offset += end - start
    np.savez_compressed(os.path.join(pdir, "layout.npz"), mask=np.concatenate(masks),
                        hand_speed=np.concatenate(speeds), fps=fps)
    with open(os.path.join(pdir, "whisper.json"), "w", encoding="utf-8") as f:
        json.dump({"segments": segments}, f, ensure_ascii=False, indent=1)
    return parts, offset


def make_source(parts, keep, out, fps):
    """素材をつなぎ、不要な間をカットし、1080×1920 に整えた映像を作る。"""
    # つないだタイムライン上の残す区間を、元ファイルごとの区間に置き換える
    pieces, off = [], 0.0
    for src, s, e in parts:
        length = e - s
        for a, b in keep:
            a2, b2 = max(a, off), min(b, off + length)
            if b2 - a2 > 0.02:
                pieces.append((src, s + a2 - off, b2 - a2))
        off += length
    inputs, filt, fade = [], [], 0.012
    for i, (src, start, dur) in enumerate(pieces):
        inputs += ["-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", src]
        filt.append(f"[{i}:v]fps={fps},scale=1080:1920:flags=lanczos,setsar=1,setpts=PTS-STARTPTS[v{i}];"
                    f"[{i}:a]aresample=48000,asetpts=PTS-STARTPTS,"
                    f"afade=t=in:d={fade},afade=t=out:st={max(0, dur - fade):.3f}:d={fade}[a{i}]")
    n = len(pieces)
    filt.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[v][a]")
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filt), "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-crf", "14", "-preset", "fast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k",
         "-movflags", "+faststart", out])


def sync_assets():
    dst = os.path.join(PUBLIC, "assets")
    for sub in ("bgm", "sfx"):
        shutil.copytree(os.path.join(ROOT, "assets", sub), os.path.join(dst, sub), dirs_exist_ok=True)


def render(edit_rel, out, fast=False):
    cmd = ["npx", "remotion", "render", "src/index.ts", "GolfShort", out,
           "--props", json.dumps({"editFile": edit_rel}), "--codec", "h264", "--crf", "28" if fast else "17",
           "--audio-codec", "aac", "--audio-bitrate", "320k", "--concurrency", str(os.cpu_count()),
           "--offthreadvideo-cache-size-in-bytes", str(2 * 1024 ** 3)]
    if fast:
        cmd += ["--scale", "0.5"]
    run(cmd, cwd=REMOTION)


def loudnorm(src, out, target, tp):
    """YouTube の基準（約 -14 LUFS）に合わせる。声と BGM の比率は変えない。"""
    meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af",
                           f"loudnorm=I={target}:TP={tp}:LRA=11:print_format=json", "-f", "null", "-"],
                          capture_output=True, text=True).stderr
    m = json.loads(meas[meas.rindex("{"):])
    af = (f"loudnorm=I={target}:TP={tp}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-c:v", "copy", "-af", af, "-ar", "48000", "-c:a", "aac",
         "-b:a", "256k", "-movflags", "+faststart", out])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--from", dest="start", choices=["prepare", "build", "render"], default="prepare")
    ap.add_argument("--fast", action="store_true", help="確認用の低解像度プレビュー")
    args = ap.parse_args()

    ppath = os.path.abspath(args.project)
    pdir = os.path.dirname(ppath)
    proj = build_project.load_json(ppath)
    cfg = build_project.load_json(os.path.join(ROOT, "config", "style.json"))
    pid = proj["id"]
    pub = os.path.join(PUBLIC, "projects", pid)
    os.makedirs(pub, exist_ok=True)
    out_dir = os.path.join(ROOT, "output")
    os.makedirs(out_dir, exist_ok=True)

    if args.start == "prepare":
        parts, _ = prepare_inputs(proj, pdir)
        with open(os.path.join(pdir, "work", "parts.json"), "w") as f:
            json.dump(parts, f)
    if args.start in ("prepare", "build"):
        parts = json.load(open(os.path.join(pdir, "work", "parts.json")))
        edit, keep, warnings = build_project.build(ppath)
        with open(os.path.join(pdir, "edit.json"), "w", encoding="utf-8") as f:
            json.dump(edit, f, ensure_ascii=False, indent=1)
        with open(os.path.join(pdir, "work", "keep.json"), "w") as f:
            json.dump(keep, f)
        build_project.write_srt(edit["captions"], os.path.join(pdir, f"{pid}.srt"))
        for w in warnings:
            print("⚠", w)
        make_source(parts, keep, os.path.join(pub, "source.mp4"), cfg["fps"])

    # edit.json（手で直した内容を含む）を Remotion の public に置いて描画
    shutil.copy(os.path.join(pdir, "edit.json"), os.path.join(pub, "edit.json"))
    sync_assets()
    raw = os.path.join(pdir, "work", "render.mp4")
    render(f"projects/{pid}/edit.json", raw, fast=args.fast)
    final = os.path.join(out_dir, f"{pid}{'_preview' if args.fast else ''}.mp4")
    loudnorm(raw, final, cfg["loudness"]["target"], cfg["loudness"]["truePeak"])
    shutil.copy(os.path.join(pdir, f"{pid}.srt"), os.path.join(out_dir, f"{pid}.srt"))
    run([PY, os.path.join(ROOT, "scripts", "qc.py"), ppath, final])
    print("完成:", final)


if __name__ == "__main__":
    main()
