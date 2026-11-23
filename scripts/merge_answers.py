#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sloučí dílčí klíče `answers.part-*.json` do `answers.2027.json`.

Dílčí soubory vznikají po dávkách (jeden předpis, jedna norma, jedno
školení). Sloučení je proto běžná operace a nemá se dělat ručně — ruční
kopírování je přesně ten okamžik, kdy se ztratí `verification` nebo se
přepíše cizí odpověď.

Odmítne sloučit, když:
  - dva dílčí soubory odpovídají na tutéž otázku,
  - dílčí klíč je psaný pro jinou verzi banky.

Spouštěj izolovaně:  python3 -I scripts/merge_answers.py
Po sloučení pusť kontrolu: python3 -I scripts/check_answers.py
"""

import glob
import json
import os
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data")
QUESTIONS = os.path.join(DATA, "questions.2027.json")
OUT = os.path.join(DATA, "answers.2027.json")


def main():
    with open(QUESTIONS, encoding="utf-8") as fh:
        bank = json.load(fh)
    bank_version = bank["bankVersion"]
    poradi = {q["id"]: i for i, q in enumerate(bank["questions"])}

    casti = sorted(glob.glob(os.path.join(DATA, "answers.part-*.json")))
    if not casti:
        print("Žádný soubor answers.part-*.json ke sloučení.", file=sys.stderr)
        return 1

    odkud = {}
    sloucene = {}
    verze = []
    chyby = []

    for cesta in casti:
        jmeno = os.path.basename(cesta)
        with open(cesta, encoding="utf-8") as fh:
            data = json.load(fh)

        if data.get("bankVersion") != bank_version:
            chyby.append(
                "{}: psáno pro banku {!r}, banka je {!r}.".format(
                    jmeno, data.get("bankVersion"), bank_version)
            )
            continue

        verze.append(data.get("answersVersion", jmeno))
        for a in data.get("answers", []):
            qid = a["questionId"]
            if qid in sloucene:
                chyby.append(
                    "{}: odpověď na {} už dodal {}. Dvě odpovědi na tutéž "
                    "otázku sloučit nelze.".format(jmeno, qid, odkud[qid])
                )
                continue
            sloucene[qid] = a
            odkud[qid] = jmeno

    if chyby:
        print("Sloučení neproběhlo:", file=sys.stderr)
        for c in chyby:
            print("  - " + c, file=sys.stderr)
        return 1

    answers = [sloucene[k] for k in sorted(sloucene, key=lambda q: poradi.get(q, 10**6))]
    out = {
        "schemaVersion": 1,
        "answersVersion": "{}+{}".format(date.today().isoformat(), ".".join(sorted(verze))),
        "bankVersion": bank_version,
        "license": "CC-BY-SA-4.0",
        "note": "Učební možnosti A/B/C a vysvětlení. NEJSOU to autentické odpovědi "
                "TIČR — oficiální dokumenty žádný klíč nezveřejňují. Hodnotí se jen "
                "odpovědi se stavem 'overeno', u kterých je ve 'verification' "
                "uvedeno, co bylo skutečně přečteno.",
        "answers": answers,
    }

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write("\n")

    stavy = {}
    for a in answers:
        stavy[a.get("status")] = stavy.get(a.get("status"), 0) + 1
    print("Sloučeno {} odpovědí z {} souborů -> {}".format(
        len(answers), len(casti), os.path.relpath(OUT, ROOT)))
    for s, n in sorted(stavy.items()):
        print("  {}: {}".format(s, n))
    print("\nDál pusť: python3 -I scripts/check_answers.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
