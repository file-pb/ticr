#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kontrola průvodce revizní zprávou. Vrací 1, když něco nesedí.

Jádro kontroly: **každá citace v průvodci musí doslova stát v předpisu.**
Průvodce tvrdí, co musí být ve zprávě o revizi — to je přesně druh tvrzení,
které se nesmí vymyslet ani „upravit pro srozumitelnost". Kontrola proto
hledá každou větu v `predpisy/nv-190-2022.txt`, ne jen to, že soubor vznikl
skriptem.

Dál hlídá, že:
  - generovaný soubor sedí s tím, co ze stejného předpisu plyne teď
  - každá sekce je právě v jedné fázi průvodce a poznámky míří na existující
  - moje poznámky neuvádějí číselnou hodnotu — ta patří do citace
  - ID otázek z banky existují

Spouštěj izolovaně:  python3 -I scripts/check_zprava.py
"""

import importlib.util
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREDPIS = os.path.join(ROOT, "predpisy", "nv-190-2022.txt")
CITACE = os.path.join(ROOT, "src", "data", "zprava-citace.json")
PRUVODCE = os.path.join(ROOT, "src", "data", "zprava.json")
BANKA = os.path.join(ROOT, "src", "data", "questions.2027.json")

JEDNOTKY = r"(?:k?V|m?A|kA|m?s|min|hod|let|rok\w*|mm2|mm²|cm|km|m|Ω|ohm|%|°C|k?Hz|k?W|k?VA)"
CISLO_S_JEDNOTKOU = re.compile(r"\d+(?:[.,]\d+)?\s*" + JEDNOTKY + r"(?![^\W\d_])")


def nacti_generator():
    spec = importlib.util.spec_from_file_location(
        "build_zprava", os.path.join(ROOT, "scripts", "build_zprava.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    nalezy = []

    with open(PREDPIS, encoding="utf-8") as fh:
        predpis = re.sub(r"\s+", " ", fh.read())
    with open(CITACE, encoding="utf-8") as fh:
        citace = json.load(fh)
    with open(PRUVODCE, encoding="utf-8") as fh:
        pruvodce = json.load(fh)
    with open(BANKA, encoding="utf-8") as fh:
        bank = json.load(fh)

    # 1. Každá citace doslova v předpisu.
    overeno = 0
    for sekce in citace["sekce"]:
        kusy = [("úvod", sekce["uvod"])]
        kusy += [("písm. {})".format(b["znak"]), b["text"]) for b in sekce["body"]]
        for kde, text in kusy:
            overeno += 1
            if len(text.strip()) < 10:
                nalezy.append("{} {}: citace je prázdná nebo useknutá ({!r}). Prázdný "
                              "řetězec projde kontrolou na doslovnost, aniž by něco "
                              "doložil.".format(sekce["id"], kde, text))
                continue
            if text not in predpis:
                nalezy.append(
                    "{} {}: citace v předpisu doslova není. Průvodce tvrdí požadavek, "
                    "který se nedá doložit: {!r}".format(sekce["id"], kde, text[:70]))
    for kde, text in ([("lhuty název", citace["lhuty"]["nazev"]),
                       ("lhuty zbytek", citace["lhuty"]["zbytek"])]
                      + [("lhuty doplněk {})".format(b["znak"]), b["text"])
                         for b in citace["lhuty"]["doplnky"]]
                      + [("lhuty LPS {})".format(b["znak"]), b["text"])
                         for b in citace["lhuty"]["doplnkyLps"]]):
        overeno += 1
        if len(text.strip()) < 10:
            nalezy.append("{}: citace je prázdná nebo useknutá ({!r}).".format(kde, text))
            continue
        if text not in predpis:
            nalezy.append("{}: citace v předpisu doslova není: {!r}".format(kde, text[:70]))
    for r in citace["lhuty"]["radky"]:
        overeno += 1
        if "{} {}".format(r["co"], r["lhuta"]) not in predpis:
            nalezy.append("lhůta {!r}: řádek v předpisu v tomhle znění není.".format(r["co"][:50]))

    # 2. Generovaný soubor je aktuální.
    gen = nacti_generator()
    sekce_cekane = {s["id"]: s for s in citace["sekce"]}
    try:
        znovu = gen.sestav(gen.nacti(), bank)
        if {k: v for k, v in znovu.items() if k != "generovano"} != \
           {k: v for k, v in citace.items() if k != "generovano"}:
            nalezy.append("zprava-citace.json nesouhlasí s tím, co z předpisu plyne teď. "
                          "Spusť scripts/build_zprava.py a rozdíl si prohlédni.")
    except SystemExit as e:
        nalezy.append("Generátor spadl: {}. Předpis se nejspíš novelizoval a kotvy "
                      "nesedí.".format(e))

    # 3. Fáze a poznámky.
    v_fazich = [s for f in pruvodce["faze"] for s in f["sekce"]]
    for sid in v_fazich:
        if sid not in sekce_cekane:
            nalezy.append("fáze odkazuje na sekci '{}', která v citacích není.".format(sid))
    for sid in sekce_cekane:
        kolik = v_fazich.count(sid)
        if kolik != 1:
            nalezy.append("sekce '{}' je ve fázích {}krát, má být právě jednou."
                          .format(sid, kolik))
    for klic in pruvodce["poznamky"]:
        if klic not in sekce_cekane and klic != "lhuty":
            nalezy.append("poznámka '{}' míří na sekci, která neexistuje.".format(klic))

    # 4. Poznámky neuvádějí hodnoty.
    texty = [("uvod", pruvodce["uvod"])]
    texty += [("comuNeni[{}]".format(i), t) for i, t in enumerate(pruvodce["comuNeni"])]
    texty += [("fáze {}".format(f["id"]), f["popis"]) for f in pruvodce["faze"]]
    texty += [("poznámka {}".format(k), v) for k, v in pruvodce["poznamky"].items()]
    for kde, text in texty:
        m = CISLO_S_JEDNOTKOU.search(text)
        if m:
            nalezy.append("{}: číselná hodnota '{}' ve vlastním textu. Hodnota patří do "
                          "citace z předpisu, ne do mého komentáře.".format(kde, m.group(0)))

    # 5. Otázky z banky.
    v_bance = {q["id"] for q in bank["questions"]}
    odkazane = [q for s in citace["sekce"] for q in s["otazky"]] + citace["lhuty"]["otazky"]
    for qid in odkazane:
        if qid not in v_bance:
            nalezy.append("odkaz na otázku {}, která v bance není.".format(qid))

    print("Průvodce zprávou: {} citací ověřeno proti {}, {} sekcí ve {} fázích, "
          "{} otázek z banky".format(
              overeno, os.path.relpath(PREDPIS, ROOT), len(citace["sekce"]),
              len(pruvodce["faze"]), len(set(odkazane))))

    if nalezy:
        print("\nNálezy ({}):".format(len(nalezy)))
        for n in nalezy:
            print("  - " + n)
        return 1
    print("\nKontrola prošla. Každá věta průvodce stojí doslova v nařízení vlády.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
