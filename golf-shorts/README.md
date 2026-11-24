# ゴルフ動画 → YouTube ショート 自動編集キット

縦型のゴルフレッスン動画を入れると、次の作業を自動で行い、YouTube ショート用の MP4 と字幕（SRT）を書き出します。

1. Whisper（large-v3）で日本語を文字起こし（ゴルフ用語の辞書で誤変換を補正）
2. 発言に合わせてテロップを作成（文節で区切る／重要語は黄色／大中小の 3 サイズ）
3. MediaPipe で顔・体・クラブの位置を検出し、テロップが被らない位置と大きさを決定
4. 動きのない長い間だけをカット（スイングの実演は残す）
5. Remotion で描画（タイトル・名前表示・控えめなズームと効果音・Lo-fi BGM を音量 5% で追加）
6. FFmpeg で音量を YouTube の基準（-14 LUFS）に整える
7. 品質チェックのレポートを出力（音ズレ・音量・文字切れ・UI との重なり・テロップ一覧）

## 新しい動画を作るとき

1. 動画を `input/` に置く
2. `projects/<好きな名前>/project.json` を作る（`projects/muta-lever/project.json` をコピーして書き換えるのが簡単です）

```json
{
  "id": "muta-driver",
  "inputs": [{"file": "input/新しい動画.mov"}],
  "title": ["1行目のタイトル", "2行目のタイトル"],
  "title_emphasis": ["黄色にしたい語"],
  "fixes": {"誤変換": "正しい表記"},
  "emphasis": ["この動画だけで黄色にしたい語"]
}
```

- 動画が複数に分かれているときは `inputs` に順番に並べると 1 本につながります。重複部分は `"end": 80.0`（秒）のように切り詰められます。
- 冒頭のタイトルは内容に合わせて毎回考えて入れてください（2 行・各 10 文字前後がおすすめ）。

3. 実行する

```bash
cd golf-shorts
. .venv/bin/activate
python scripts/make_short.py projects/<名前>/project.json
```

完成品は `output/<名前>.mp4`、字幕は `output/<名前>.srt`、チェック結果は `output/<名前>_qc.md` と `output/<名前>_qc_sheet.jpg` に出ます。

## 直したいとき

| 直したいこと | やり方 | 再実行 |
|---|---|---|
| 誤字（毎回出るゴルフ用語） | `config/golf_terms.json` の `replacements` に追加 | `--from build` |
| 誤字（その動画だけ） | `project.json` の `fixes` に追加 | `--from build` |
| 1 つのテロップだけ手で直す | `projects/<名前>/edit.json` の該当テロップの `lines` を直接編集 | `--from render` |
| タイトル | `project.json` の `title` | `--from build` |
| 色・文字サイズ・BGM 音量など | `config/style.json` | `--from build` |
| カットをやめる・変える | `project.json` に `"keep": [[開始秒, 終了秒], ...]` を書く | `--from build` |

`--from build` は文字起こしと人物検出の結果を使い回すので数分で終わります。`--from render` は `edit.json` を手で直したあとに描画だけやり直します（`--from build` を実行すると `edit.json` は作り直されるので注意）。

確認用に軽く書き出したいときは `--fast` を付けると半分の解像度で出ます。

Remotion Studio で 1 コマずつ確認・調整もできます:

```bash
cd remotion && npx remotion studio src/index.ts
```

（入力欄で `editFile` に `projects/<名前>/edit.json` を指定）

## フォルダ構成

```
golf-shorts/
├── config/            デザイン・辞書（全動画共通）
│   ├── style.json       色・サイズ・余白・BGM・カットの設定
│   └── golf_terms.json  ゴルフ用語（Whisper へのヒント／誤変換の置換／黄色にする語）
├── scripts/
│   ├── make_short.py     一括実行
│   ├── transcribe.py     Whisper 文字起こし
│   ├── layout_mask.py    顔・体・クラブの検出（MediaPipe）
│   ├── build_project.py  テロップ・カット・配置の決定、SRT 出力
│   ├── qc.py             品質チェック
│   └── make_sfx.py       効果音の合成
├── remotion/          描画テンプレート（React）
│   └── src/GolfShort.tsx  テロップ・タイトル・名前表示のデザイン
├── assets/            BGM・効果音・検出モデル
├── projects/<名前>/   動画ごとの設定と途中結果（edit.json が再編集用データ）
└── output/            完成品
```

## 画面の安全領域（1080×1920）

- 上 0〜200px、下 1500px〜、右下のボタン列（x 900〜、y 880〜1660）は YouTube の UI と重なるので、テロップを置きません。
- 映像は 320px 下にずらし、上部に濃色の帯を作ってテロップとタイトルを置いています（`style.json` の `videoOffsetY`）。足元より下が少し切れる代わりに、顔より上にテロップの場所ができます。

## 初回セットアップ（新しい環境で動かす場合）

```bash
sudo apt-get install -y ffmpeg libegl1 libgles2 libgl1
python3 -m venv .venv && . .venv/bin/activate
pip install torch openai-whisper mediapipe opencv-python-headless numpy "fugashi[unidic-lite]"
cd remotion && npm ci
```

- Whisper のモデルは初回に openaipublic.azureedge.net から自動でダウンロードされます。
- 骨格推定モデル `assets/models/pose_landmarker_full.task` は storage.googleapis.com の MediaPipe 公式モデルです。
- Remotion は `remotion.config.ts` で、手元の Chromium（`REMOTION_CHROME` 環境変数で変更可）を使います。

## ライセンス上の注意

- BGM と効果音・フォントについては `BGM_CREDITS.md` を参照。概要欄に BGM のクレジットが必要です。
- Remotion は個人・従業員 3 人以下の会社なら無料です。4 人以上の会社で業務に使う場合は Remotion の Company License が必要です（https://www.remotion.dev/license）。
