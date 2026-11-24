"""Whisper で日本語を文字起こしし、単語タイムスタンプ付き JSON を保存する。"""
import json
import sys

import whisper

from golf_terms import initial_prompt

MODEL = "large-v3"


def transcribe(wav: str, out: str, model_name: str = MODEL) -> None:
    model = whisper.load_model(model_name, device="cpu")
    result = model.transcribe(
        wav,
        language="ja",
        word_timestamps=True,
        initial_prompt=initial_prompt(),  # ゴルフ用語を事前に与えて誤変換を減らす
        condition_on_previous_text=False,
        temperature=0.0,
        fp16=False,
    )
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    transcribe(sys.argv[1], sys.argv[2], *(sys.argv[3:4]))
