#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kontrola mapy předpisů a norem. Vrací 1, když něco nesedí.

Mapa míchá dvě věci s velmi různou vahou: **spočítaná data z banky** a **moje
vlastní popisky**. Kontrola hlídá, aby se ty dvě vrstvy nezačaly plést:

  1. generovaný soubor sedí s tím, co z banky plyne teď
  2. každá položka má skupinu — nová norma v příští bance nesmí propadnout
     bez zařazení
  3. každé ID otázky v inventuře je v bance a počty sedí
  4. popisky netvrdí požadavek: **žádná číselná hodnota s jednotkou.**
     Mapa říká, o čem norma je, ne co v ní stojí
  5. popisek se váže na normu, která se v bance skutečně vyskytuje

Spouštěj izolovaně:  python3 -I scripts/check_normy.py
"""

import importlib.util
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKUPINY = os.path.join(ROOT, "src", "data", "normy-skupiny.json")
NORMY = os.path.join(ROOT, "src", "data", "normy.json")
BANKA = os.path.join(ROOT, "src", "data", "questions.2027.json")

# Stejné pravidlo jako u trenažéru sítí: hodnota s jednotkou patří do normy,
# ne do popisku. Desetinná čísla se tu nehlídají — označení norem a paragrafů
# je samo plné teček a lomítek.
JEDNOTKY = r"(?:k?V|m?A|kA|m?s|min|hod|mm2|mm²|cm|km|m|Ω|ohm|%|°C|k?Hz|k?W|k?VA)"
CISLO_S_JEDNOTKOU = re.compile(r"\d+(?:[.,]\d+)?\s*" + JEDNOTKY + r"(?![^\W\d_])")


def nacti_generator():
    spec = importlib.util.spec_from_file_location(
        "build_normy", os.path.join(ROOT, "scripts", "build_normy.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    nalezy = []

    with open(SKUPINY, encoding="utf-8") as fh:
        sk = json.load(fh)
    with open(NORMY, encoding="utf-8") as fh:
        normy = json.load(fh)
    with open(BANKA, encoding="utf-8") as fh:
        bank = json.load(fh)

    if sk.get("stavCeleho") != "navrh":
        nalezy.append(
            "normy-skupiny.json: stavCeleho je '{}', smí být jen 'navrh'. Popisky "
            "nikdo neověřil proti katalogu ČAS.".format(sk.get("stavCeleho")))
    if not sk.get("varovani", "").strip():
        nalezy.append("normy-skupiny.json: chybí varovani — mapa by se tvářila jako ověřená.")

    # 1. Generovaný soubor je aktuální.
    gen = nacti_generator()
    cekano, bez_odkazu = gen.spocitej(bank, sk["skupiny"], sk["popisky"])
    if normy.get("bankVersion") != bank["bankVersion"]:
        nalezy.append("normy.json je z banky {}, nahraná je {}. Spusť scripts/build_normy.py."
                      .format(normy.get("bankVersion"), bank["bankVersion"]))
    if normy.get("polozky") != cekano:
        nalezy.append("normy.json nesouhlasí s tím, co z banky plyne teď. Spusť "
                      "scripts/build_normy.py a výsledek zkontroluj.")
    if bez_odkazu:
        nalezy.append("Z {} otázek se nepodařilo rozpoznat předpis v normativním odkazu "
                      "(např. {}). Doplň vzor v build_normy.py.".format(
                          len(bez_odkazu), ", ".join(bez_odkazu[:3])))

    # 2. Nic nepropadne bez skupiny.
    id_skupin = {s["id"] for s in sk["skupiny"]}
    for p in normy["polozky"]:
        if not p.get("skupina"):
            nalezy.append("{}: položka nemá skupinu. Doplň vzor v normy-skupiny.json."
                          .format(p["oznaceni"]))
        elif p["skupina"] not in id_skupin:
            nalezy.append("{}: skupina '{}' v normy-skupiny.json není."
                          .format(p["oznaceni"], p["skupina"]))

    # 3. ID otázek a počty.
    v_bance = {q["id"] for q in bank["questions"]}
    for p in normy["polozky"]:
        chybejici = [q for q in p["otazky"] if q not in v_bance]
        if chybejici:
            nalezy.append("{}: odkazuje na otázky mimo banku ({}).".format(
                p["oznaceni"], ", ".join(chybejici[:3])))
        if p["otazek"] != len(p["otazky"]):
            nalezy.append("{}: hlásí {} otázek, vyjmenovaných je {}.".format(
                p["oznaceni"], p["otazek"], len(p["otazky"])))
        if sum(p["podleOkruhu"].values()) != len(p["otazky"]):
            nalezy.append("{}: rozpad po okruzích nesedí s počtem otázek.".format(p["oznaceni"]))
        podle_edice = p.get("otazkyPodleEdice", {})
        if podle_edice:
            if sorted(q for v in podle_edice.values() for q in v) != sorted(p["otazky"]):
                nalezy.append("{}: rozpad po edicích nesedí se seznamem otázek. Edice "
                              "rozhoduje o odpovědi, nesmí se ztratit.".format(p["oznaceni"]))
            if sorted(podle_edice) != sorted(p["edice"]):
                nalezy.append("{}: edice v rozpadu ({}) nesedí s vyjmenovanými ({}).".format(
                    p["oznaceni"], ", ".join(sorted(podle_edice)), ", ".join(sorted(p["edice"]))))
    pokryte = {q for p in normy["polozky"] for q in p["otazky"]}
    if len(pokryte) != len(v_bance):
        nalezy.append("Inventura pokrývá {} otázek z {}. Každá otázka má normativní odkaz, "
                      "takže se nemá ztratit ani jedna.".format(len(pokryte), len(v_bance)))

    # 4. Popisky netvrdí hodnoty.
    texty = [("varovani", sk["varovani"])]
    texty += [("skupina {}".format(s["id"]), s["nazev"] + " " + s["popis"]) for s in sk["skupiny"]]
    texty += [("popisek {}".format(k), v) for k, v in sk["popisky"].items()]
    for kde, text in texty:
        m = CISLO_S_JEDNOTKOU.search(text)
        if m:
            nalezy.append("{}: číslo s jednotkou '{}'. Mapa říká, o čem norma je, ne co "
                          "v ní stojí.".format(kde, m.group(0)))

    # 5. Popisek k normě, která v bance není, je mrtvý — a nejspíš omyl.
    klice = {p["klic"] for p in normy["polozky"]}
    for k in sk["popisky"]:
        if k not in klice:
            nalezy.append("popisek '{}': takový předpis banka necituje. Překlep, nebo "
                          "popisek k normě, která ve zkoušce není.".format(k))

    print("Mapa norem: {} položek ({} ČSN, {} právních), popisků {}, otázek pokryto {}/{}".format(
        len(normy["polozky"]),
        sum(1 for p in normy["polozky"] if p["druh"] == "csn"),
        sum(1 for p in normy["polozky"] if p["druh"] == "pravni"),
        sum(1 for p in normy["polozky"] if p.get("popis")),
        len(pokryte), len(v_bance)))

    if nalezy:
        print("\nNálezy ({}):".format(len(nalezy)))
        for n in nalezy:
            print("  - " + n)
        return 1
    print("\nKontrola prošla. Čísla jsou z banky, popisky jsou přiznaně moje.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
