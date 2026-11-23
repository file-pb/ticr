#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vygeneruje atrapu klíče odpovědí pro ruční zkoušku rozhraní.

**Není to obsah k učení.** Možnosti jsou zjevně nesmyslné a text to u každé
říká, aby se atrapa nedala omylem považovat za odpověď. Soubor jde do
`src/data/answers.2027.local.json`, který není v gitu ani v nasazení.

Použití:
    python3 -I scripts/make_scaffold_answers.py 20   # 20 otázek z každého okruhu
    rm src/data/answers.2027.local.json              # až rozhraní projdeš
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUESTIONS = os.path.join(ROOT, "src", "data", "questions.2027.json")
OUT = os.path.join(ROOT, "src", "data", "answers.2027.local.json")

MARK = "ATRAPA PRO ZKOUŠKU ROZHRANÍ — není to odpověď na tuhle otázku"


def main():
    per_circuit = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    with open(QUESTIONS, encoding="utf-8") as fh:
        bank = json.load(fh)

    answers = []
    for circuit in [c["id"] for c in bank["circuits"]]:
        qs = [q for q in bank["questions"] if q["circuit"] == circuit][:per_circuit]
        for q in qs:
            answers.append({
                "questionId": q["id"],
                "options": [
                    {"id": "x1", "text": MARK + " (varianta 1)"},
                    {"id": "x2", "text": MARK + " (varianta 2, označená jako správná)"},
                    {"id": "x3", "text": MARK + " (varianta 3)"},
                ],
                "correctOptionId": "x2",
                "explanation": MARK + ". Slouží jen k tomu, aby se dalo proklikat rozhraní.",
                "whyWrong": {"x1": MARK, "x3": MARK},
                "status": "overeno",
                "sourceClass": "placeny",
                "verification": {
                    "source": "ATRAPA — žádný zdroj, vygenerováno skriptem",
                    "method": "atrapa",
                    "checkedAt": "1970-01-01",
                    "checkedBy": "scripts/make_scaffold_answers.py",
                },
            })

    out = {
        "schemaVersion": 1,
        "answersVersion": "atrapa",
        "bankVersion": bank["bankVersion"],
        "license": "nepoužitelné — atrapa",
        "note": MARK,
        "answers": answers,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("Atrapa: {} odpovědí -> {}".format(len(answers), OUT))
    print("Po zkoušce rozhraní soubor smaž.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
