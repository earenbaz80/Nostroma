"""Writes src/locales/net-<lang>.json: the line shown while a download server has not answered yet (lane NET, owner wording 11-10, W14).
Run from apps/host:  python scripts/make-net-locales.py
The English text is nostroma_control/netpolicy.py WORDS["waiting"] with {host} -> {0} and {seconds} -> {1}; setup prints it and
nostroma_control/progress_words.py hands it to the app as the install step's label. Every entry names all nine languages; keys are net01.. in
the order of S. Placeholders ({0}, {1}) must be kept in every language. The eight translations are first drafts for the owner's later look."""
import json
import re
from pathlib import Path

LANGS = ["en", "zh", "ja", "de", "es", "ru", "pt", "ko", "fr"]
S = []


def add(en, zh, ja, de, es, ru, pt, ko, fr):
    S.append(dict(en=en, zh=zh, ja=ja, de=de, es=es, ru=ru, pt=pt, ko=ko, fr=fr))


add("Waiting for {0} to answer ({1} s so far)",
    "正在等待 {0} 响应（已等待 {1} 秒）",
    "{0} の応答を待っています（{1} 秒経過）",
    "Warten auf eine Antwort von {0} (bisher {1} s)",
    "Esperando la respuesta de {0} ({1} s hasta ahora)",
    "Ожидание ответа от {0} (прошло {1} с)",
    "A aguardar a resposta de {0} ({1} s até agora)",
    "{0}의 응답을 기다리는 중 ({1}초 경과)",
    "En attente de la réponse de {0} ({1} s jusqu'ici)")

here = Path(__file__).resolve().parent.parent / "src" / "locales"
NBSP = " "


def french(text):
    text = re.sub(r"(?<=[A-Za-zÀ-ſ])'(?=[A-Za-zÀ-ſ{])", "’", text)
    text = re.sub(r"(?<=\S) ([:;?!])", NBSP + r"\1", text)
    return text


def only_once(texts):
    """Stops, writing nothing, if a new English string already lives in another English set: that would be the same sentence under a second id, and the
    two then drift apart (that is how s1150/fx157 and s3273/fxpr1 happened). Texts this file already carries are its own and are not checked."""
    own_path = here / "net-en.json"
    own = set(json.loads(own_path.read_text(encoding="utf-8")).values()) if own_path.exists() else set()
    elsewhere = {}
    main = here / "en.json"
    for other in sorted({*here.glob("*-en.json"), *([main] if main.exists() else [])}):
        if other.name == "net-en.json":
            continue
        for key, value in json.loads(other.read_text(encoding="utf-8")).items():
            elsewhere.setdefault(value, f"{other.name}:{key}")
    for text in texts:
        if text not in own and text in elsewhere:
            raise SystemExit(f"net-en.json: {text!r} already lives in {elsewhere[text]}. One id per text: use that id instead of a second one.")


only_once(entry["en"] for entry in S)


for lang in LANGS:
    data = {}
    for i, entry in enumerate(S):
        text = entry[lang]
        assert sorted(re.findall(r"\{\d+\}", entry["en"])) == sorted(re.findall(r"\{\d+\}", text)), (lang, entry["en"], text)
        data[f"net{i + 1:02d}"] = french(text) if lang == "fr" else text
    with (here / f"net-{lang}.json").open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
print("written", len(S), "strings in", len(LANGS), "languages")
