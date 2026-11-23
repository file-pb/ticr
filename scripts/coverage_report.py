#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Přehled pokrytí banky odpověďmi -> docs/COVERAGE.md.

Rozlišuje čtyři různé věci, které se snadno slijí do jedné:
  dostupnost podkladu  — mám vůbec čím odpověď ověřit
  aktuálnost podkladu  — platí pro znění otázky 2027
  stav ověření         — navrh / overeno / sporne
  co chybí doložit     — konkrétní ustanovení nebo článek normy

Spouštěj izolovaně:  python3 -I scripts/coverage_report.py
"""

import json
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUESTIONS = os.path.join(ROOT, "src", "data", "questions.2027.json")
ANSWERS = os.path.join(ROOT, "src", "data", "answers.2027.json")
LOCAL_ANSWERS = os.path.join(ROOT, "src", "data", "answers.2027.local.json")
OUT = os.path.join(ROOT, "docs", "COVERAGE.md")

EXAM_PER_CIRCUIT = 15


def zdroj_typu(ref):
    return "norma" if re.search(r"ČSN|TNI|PNE", ref) else "predpis"


def main():
    with open(QUESTIONS, encoding="utf-8") as fh:
        bank = json.load(fh)
    with open(ANSWERS, encoding="utf-8") as fh:
        answers = json.load(fh)

    by_q = {a["questionId"]: a for a in answers["answers"]}
    local_count = 0
    if os.path.exists(LOCAL_ANSWERS):
        with open(LOCAL_ANSWERS, encoding="utf-8") as fh:
            local = json.load(fh)
        local_count = len(local["answers"])
        # Lokální vrstva se do veřejného přehledu nepočítá, jen se přizná.

    circuits = defaultdict(lambda: Counter())
    source_kind = defaultdict(lambda: Counter())
    missing = defaultdict(list)

    for q in bank["questions"]:
        c = q["circuit"]
        circuits[c]["total"] += 1
        source_kind[c][zdroj_typu(q["normativeRef"])] += 1
        a = by_q.get(q["id"])
        if a is None:
            circuits[c]["bez"] += 1
            missing[zdroj_typu(q["normativeRef"])].append((q["id"], q["normativeRef"]))
        else:
            circuits[c][a["status"]] += 1

    order = [c["id"] for c in bank["circuits"]]
    lines = []
    w = lines.append

    w("# Pokrytí banky odpověďmi")
    w("")
    w("Banka `{}`, platnost od {}. Vygenerováno skriptem `scripts/coverage_report.py`."
      .format(bank["bankVersion"], bank["validFrom"]))
    w("")
    w("## Stav ověření po okruzích")
    w("")
    w("| Okruh | Název | Otázek | Ověřeno | Návrh | Sporné | Bez odpovědi |")
    w("| --- | --- | ---: | ---: | ---: | ---: | ---: |")
    for c in order:
        meta = next(x for x in bank["circuits"] if x["id"] == c)
        k = circuits[c]
        w("| {} | {} | {} | {} | {} | {} | {} |".format(
            c, meta["title"], k["total"], k["overeno"], k["navrh"], k["sporne"], k["bez"]))
    tot = Counter()
    for c in order:
        tot.update(circuits[c])
    w("| | **celkem** | **{}** | **{}** | **{}** | **{}** | **{}** |".format(
        tot["total"], tot["overeno"], tot["navrh"], tot["sporne"], tot["bez"]))
    w("")

    w("## Lze spustit zkoušku nanečisto?")
    w("")
    w("Předvolba chce {} ověřených otázek z každého okruhu, tedy {} celkem."
      .format(EXAM_PER_CIRCUIT, EXAM_PER_CIRCUIT * len(order)))
    w("")
    chybi_celkem = 0
    for c in order:
        k = circuits[c]["overeno"]
        chybi = max(0, EXAM_PER_CIRCUIT - k)
        chybi_celkem += chybi
        stav = "ano" if chybi == 0 else "chybí {}".format(chybi)
        w("- `{}`: ověřeno {} z {} — {}".format(c, k, EXAM_PER_CIRCUIT, stav))
    w("")
    if chybi_celkem:
        w("**Nelze.** Chybí {} ověřených otázek. Chybějící se nenahrazují jiným okruhem "
          "ani duplicitami; aplikace plnou předvolbu nespustí a nabídne kratší procvičování."
          .format(chybi_celkem))
    else:
        w("**Ano.** Každý okruh má dost ověřených otázek.")
    w("")

    w("## Čím se dá odpověď vůbec ověřit")
    w("")
    w("| Okruh | Z právních předpisů | Z norem ČSN |")
    w("| --- | ---: | ---: |")
    for c in order:
        w("| {} | {} | {} |".format(c, source_kind[c]["predpis"], source_kind[c]["norma"]))
    w("| **celkem** | **{}** | **{}** |".format(
        sum(source_kind[c]["predpis"] for c in order),
        sum(source_kind[c]["norma"] for c in order)))
    w("")
    w("Právní předpisy jsou volně dostupné, takže odpovědi k nim lze ověřit a zveřejnit.")
    w("Normy ČSN jsou placené. Odpověď odvozená z placeného podkladu zůstává v lokální")
    w("vrstvě `src/data/answers.2027.local.json`, která není v gitu ani ve veřejném nasazení.")
    w("")

    w("## Co konkrétně chybí doložit")
    w("")
    for kind, label in (("predpis", "Právní předpisy — volně ověřitelné"),
                        ("norma", "Normy ČSN — potřeba přístup k normě")):
        items = missing[kind]
        w("### {} ({} otázek)".format(label, len(items)))
        w("")
        if not items:
            w("Nic nechybí.")
            w("")
            continue
        refs = Counter(ref for _, ref in items)
        w("Nejčastější chybějící podklady:")
        w("")
        for ref, n in refs.most_common(15):
            w("- {} — {} otázek".format(ref, n))
        if len(refs) > 15:
            w("- …a dalších {} různých odkazů".format(len(refs) - 15))
        w("")

    w("## Edice norem, na které sada 2027 odkazuje")
    w("")
    w("Edice je u odpovědi rozhodující: starší edice téže normy může mít jinou")
    w("hodnotu i jinou strukturu článků. Následující přehled plyne přímo")
    w("z normativních odkazů v oficiální bance.")
    w("")
    edice = defaultdict(lambda: Counter())
    for q in bank["questions"]:
        ref = q["normativeRef"]
        m = re.search(r"ed\.\s*(\d)", ref)
        edice[q["circuit"]]["ed. " + m.group(1) if m else "bez uvedené edice"] += 1
    w("| Okruh | " + " | ".join(
        sorted({k for c in edice.values() for k in c})) + " |")
    klice = sorted({k for c in edice.values() for k in c})
    w("| --- | " + " | ".join(["---:"] * len(klice)) + " |")
    for c in order:
        w("| {} | {} |".format(c, " | ".join(str(edice[c][k]) for k in klice)))
    w("")
    w("U okruhu `ez4` (LPS) stojí za zvláštní pozornost řada ČSN EN IEC 62305.")
    lps = Counter()
    for q in bank["questions"]:
        if q["circuit"] != "ez4":
            continue
        m = re.search(r"(62305-\d)\s*(ed\.\s*\d)?\s*:?\s*(\d{4})?", q["normativeRef"])
        if m:
            lps["{} {} {}".format(m.group(1), m.group(2) or "bez edice", m.group(3) or "").strip()] += 1
    for k, n in lps.most_common():
        w("- {} — {} otázek".format(k, n))
    w("")

    w("## Lokální vrstva")
    w("")
    if local_count:
        w("Na tomhle stroji je {} odpovědí v lokální vrstvě. Do veřejného nasazení "
          "nepatří.".format(local_count))
    else:
        w("Žádná lokální vrstva. Všechny odpovědi v přehledu jsou zveřejnitelné.")
    w("")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    print("Přehled pokrytí -> {}".format(OUT))
    print("  ověřeno {} / {} otázek, bez odpovědi {}".format(
        tot["overeno"], tot["total"], tot["bez"]))
    print("  zkoušku nanečisto spustit {}".format("lze" if chybi_celkem == 0 else "nelze"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
