---
name: golf-short
description: ゴルフの動画（.mov/.mp4）が送られてきたら、牟田プロのテイストで YouTube ショートに自動編集する。「動画を編集して」「ショートにして」「いつものやつで」や、動画ファイルだけが送られてきたときに使う。
---

# ゴルフ動画 → YouTube ショート

仕組みは `golf-shorts/` にある（使い方の詳細は `golf-shorts/README.md`）。送られた動画を次の手順で仕上げ、完成品を渡すところまで自分で行う。途中で操作を頼まない。

## 0. 準備（新しい環境のとき）

`golf-shorts/.venv` と `golf-shorts/remotion/node_modules` が無ければ、README の「初回セットアップ」を実行する（環境のセットアップスクリプトが入っていれば不要）。

## 1. プロジェクトを作る

送られた動画（アップロードは `/root/.claude/uploads/...` にある）を撮影順に並べて実行する。プロジェクト名は内容がわかる英小文字（例: `muta-driver-slice`）。

```bash
cd golf-shorts && . .venv/bin/activate
python scripts/new_project.py <名前> <動画1> [動画2 ...]
```

文字起こし（Whisper large-v3、CPU で 1 分の動画に約 5 分）、人物・クラブ検出、つなぎ目の重複カット、スイング検出までが自動で終わる。長いので `run_in_background` で実行する。

## 2. 内容を読んで project.json を仕上げる

`projects/<名前>/transcript.txt` を読み、`projects/<名前>/project.json` に書く。

- `title`：冒頭タイトル 2 行（各 10 文字前後）。内容に即して興味を引くもの。`title_emphasis` に黄色にする語。サムネイルにも同じ文字が入る。
- `fixes`：誤変換の修正（`{"誤": "正"}`）。ゴルフ用語で毎回出そうなものは `config/golf_terms.json` の `replacements` に追加する。意味が通らない箇所は、`work/inN.wav` のその部分だけ切り出して Whisper にかけ直して照合する。
- `emphasis`：この動画で黄色にしたいキーワード（テコ、支点、センター軸のような要点）。
- `swings.jpg` を見て、冒頭・締めに使うスイング場面が本当にスイングか確認する。違えば `intro` / `outro` の `start`・`end` を直す。スイングが無い動画なら `intro` / `outro` / `thumbnail` を消す。

## 3. 書き出す

```bash
python scripts/make_short.py projects/<名前>/project.json --from build
```

（4 コアの CPU で 2〜3 分の動画に 25 分前後。`run_in_background` で実行）。終わったら `output/<名前>_qc.md` を読み、⚠️ が無いか、テロップ一覧に誤字が無いか確認する。`output/<名前>_qc_sheet.jpg` でテロップが顔・体・クラブや UI に重なっていないか目で見る。直したら `--from build` で再実行。

## 4. 渡す

- `SendUserFile` で送る：`output/<名前>.mp4`（完成版）、`output/<名前>_share.mp4`（iPhone 保存・LINE 用の軽い版）、`output/<名前>_thumbnail.jpg`、`output/<名前>.srt`
- YouTube のタイトルと説明文を作り、`output/<名前>_youtube.md` に保存して、返信にもコピーできる形（コードブロック）で載せる。説明文の最後には必ず BGM のクレジット（`BGM_CREDITS.md` の 3 行）を入れる。
- 聞き取りに自信がないテロップは、時刻つきで「確認してほしい箇所」として伝える。
- `project.json`・`edit.json`・SRT・youtube.md をコミットして push する（動画ファイルは .gitignore 済み）。

## 決まっている好み（牟田プロの動画）

- 音声は元のまま（雑音処理なし。`style.json` の `voice.enabled: false`）。BGM は Kevin MacLeod「Late Night Radio」、話している間 15%・スイング部分 30%。
- 冒頭：スイング 2 回（通常→スロー）にタイトル。締め：スイング 3 回にレッスン案内「レッスンのご相談は DMでお気軽に」と Instagram / YouTube。
- 長さは YouTube ショートの上限 3 分以内。
