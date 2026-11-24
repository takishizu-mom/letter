"""ゴルフ用語の辞書。config/golf_terms.json を読み込む。"""
import json
import os
import re

CONFIG = os.path.join(os.path.dirname(__file__), "..", "config", "golf_terms.json")


def load() -> dict:
    with open(CONFIG, encoding="utf-8") as f:
        return json.load(f)


def initial_prompt() -> str:
    terms = load()["vocabulary"]
    return "ゴルフのレッスン動画です。" + "、".join(terms) + "。"


def correct(text: str) -> str:
    for wrong, right in load()["replacements"].items():
        if wrong.startswith("re:"):
            text = re.sub(wrong[3:], right, text)
        else:
            text = text.replace(wrong, right)
    return text
