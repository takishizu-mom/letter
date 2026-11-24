# 使用した BGM の出典と利用条件

## 使用曲

| 項目 | 内容 |
|---|---|
| 曲名 | Late Night Radio |
| 作曲 | Kevin MacLeod |
| 配布元 | incompetech.com（https://incompetech.com/music/royalty-free/music.html） |
| 雰囲気 | Calming / Relaxed（エレピ・ベース・ドラムの Lo-fi 系チル、72 BPM） |
| ライセンス | Creative Commons: By Attribution 4.0（CC BY 4.0）https://creativecommons.org/licenses/by/4.0/ |
| 動画内の音量 | 話している間は元音源の 15%（約 -16 dB）、冒頭と締めのスイング部分は 30%。最後の 1.5 秒でフェードアウト |
| ファイル | `assets/bgm/late_night_radio.mp3` |

## 利用条件（2026年11月24日に配布元で確認）

- 無料で、**商用利用・YouTube の収益化も可能**（incompetech の FAQ「YouTube 動画に使えますか？ → はい、収益化もできます。クレジットを入れてください」）。
- 条件は**クレジット表記（帰属表示）だけ**。YouTube と Vimeo では、**動画の概要欄にクレジットを書く**よう案内されています。
- クレジットを入れられない用途（ラジオ・テレビ CM など）向けには、別途有料の Standard License があります。今回の用途（YouTube ショート）では不要です。

## 概要欄に貼るクレジット（このままコピーしてください）

```
Music: "Late Night Radio" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/
```

## 注意点

- 投稿後に YouTube の Content ID の申し立てが届くことがまれにあります。CC BY の曲なので、異議申し立てで「ライセンスを持っている（Creative Commons）」を選び、上のクレジットと配布元の URL を示せば解除されます。
- ほかの候補曲として `assets/bgm/study_and_relax.mp3`（「Study And Relax」）と `assets/bgm/suave_standpipe.mp3`（「Suave Standpipe」）も入れてあります。どちらも Kevin MacLeod の曲で CC BY 4.0 です。曲を差し替えるときは `config/style.json` の `bgm.file` を変更し、クレジットも合わせて変えてください。

## 効果音

`assets/sfx/pop.wav`（タイトル表示）と `assets/sfx/tick.wav`（強調テロップ）は `scripts/make_sfx.py` でプログラムから合成した自作音源です。第三者の権利は含まれていません。

## フォント

テロップのフォントは Google Fonts の Noto Sans JP、Zen Kaku Gothic New、Montserrat です。いずれも SIL Open Font License 1.1 で、商用の動画にも使えます。ライセンス文は `remotion/public/fonts/OFL-*.txt` にあります。
