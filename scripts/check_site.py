#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kontrola trenažéru druhů sítí. Vrací 1, když něco nesedí.

Trenažér je **učební text, který nikdo neověřil proti normě.** Tahle kontrola
proto nehlídá správnost — tu bez normy posoudit nelze — ale to, aby text
netvrdil víc, než na co má:

  1. nic v něm nemá stav „overeno" a je u něj řečeno, co se má doložit
  2. **neuvádí žádnou číselnou hodnotu s jednotkou.** Doby odpojení, dovolená
     napětí a průřezy jsou právě ty údaje, které se bez normy vymýšlet nesmí.
     Trenažér učí uspořádání vodičů a uzemnění, ne hodnoty.
  3. každý druh sítě je ze svých znaků i ze svého schématu rozpoznatelný
     jednoznačně — jinak by úloha měla dvě správné odpovědi
  4. generovaný seznam otázek z banky je aktuální a všechna ID v bance jsou

Spouštěj izolovaně:  python3 -I scripts/check_site.py
"""

import importlib.util
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRUHY = os.path.join(ROOT, "src", "data", "site.json")
OTAZKY = os.path.join(ROOT, "src", "data", "site-otazky.json")
BANKA = os.path.join(ROOT, "src", "data", "questions.2027.json")

ZDROJE = {"uzemneny", "izolovany", "impedance"}

# Jednotky, které v učebním textu nemají co dělat. Odkaz na článek normy
# („čl. 312.2", „ed. 3") číslo s jednotkou není a kontroluje se jinde.
JEDNOTKY = r"(?:k?V|m?A|kA|m?s|min|hod|mm2|mm²|cm|km|m|Ω|ohm|%|°C|k?Hz|k?W|k?VA)"
CISLO_S_JEDNOTKOU = re.compile(r"\d+(?:[.,]\d+)?\s*" + JEDNOTKY + r"(?![^\W\d_])")
DESETINNE_CISLO = re.compile(r"\d+[.,]\d+")


def nacti_generator():
    spec = importlib.util.spec_from_file_location(
        "build_site_topics", os.path.join(ROOT, "scripts", "build_site_topics.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def ucebni_texty(data):
    """Všechna pole, která aplikace předkládá jako učivo. Bez pole `doloz`,
    kde odkazy na články norem patří."""
    yield "varovani", data["varovani"]
    for p in data["pismena"]:
        yield "pismena[{}].vyznam".format(p["pozice"]), p["vyznam"]
        for v in p["varianty"]:
            yield "pismena[{}].{}".format(p["pozice"], v["znak"]), v["popis"]
    for d in data["druhy"]:
        for i, r in enumerate(d["rozpad"]):
            yield "{}.rozpad[{}]".format(d["kod"], i), r
        for i, z in enumerate(d["znaky"]):
            yield "{}.znaky[{}]".format(d["kod"], i), z
        for z in d["zameny"]:
            yield "{}.zameny[{}]".format(d["kod"], z["s"]), z["cim"]


def main():
    nalezy = []

    with open(DRUHY, encoding="utf-8") as fh:
        data = json.load(fh)
    with open(OTAZKY, encoding="utf-8") as fh:
        temata_soubor = json.load(fh)
    with open(BANKA, encoding="utf-8") as fh:
        bank = json.load(fh)

    # 1. Trenažér nikdy netvrdí, že je ověřený.
    if data.get("stavCeleho") != "navrh":
        nalezy.append(
            "site.json: stavCeleho je '{}', smí být jen 'navrh'. Obsah nikdo "
            "neověřil proti normě.".format(data.get("stavCeleho")))
    if not data.get("varovani", "").strip():
        nalezy.append("site.json: chybí varovani — aplikace by obsah předkládala bez výhrady.")
    if "ČSN" not in data.get("doloz", ""):
        nalezy.append("site.json: doloz nejmenuje normu, proti které se má text doložit.")

    # 2. Žádná číselná hodnota s jednotkou v učebním textu.
    for kde, text in ucebni_texty(data):
        for vzor, popis in ((CISLO_S_JEDNOTKOU, "číslo s jednotkou"),
                            (DESETINNE_CISLO, "desetinné číslo")):
            m = vzor.search(text)
            if m:
                nalezy.append(
                    "{}: {} '{}'. Trenažér učí uspořádání vodičů a uzemnění; "
                    "hodnoty se bez normy neuvádějí.".format(kde, popis, m.group(0)))

    # 3. Jednoznačnost druhů.
    kody = [d["kod"] for d in data["druhy"]]
    ids = [d["id"] for d in data["druhy"]]
    for seznam, jak in ((kody, "kód"), (ids, "id")):
        duplicitni = {x for x in seznam if seznam.count(x) > 1}
        if duplicitni:
            nalezy.append("site.json: {} se opakuje: {}".format(jak, ", ".join(sorted(duplicitni))))

    podpisy = {}
    for d in data["druhy"]:
        if not d["rozpad"] or not d["znaky"]:
            nalezy.append("{}: chybí rozpad kódu nebo znaky.".format(d["kod"]))
        for z in d["zameny"]:
            if z["s"] not in kody:
                nalezy.append("{}: zámena odkazuje na neznámý kód '{}'.".format(d["kod"], z["s"]))

        s = d["schema"]
        if s["zdroj"] not in ZDROJE:
            nalezy.append("{}: neznámý vztah zdroje k zemi '{}'.".format(d["kod"], s["zdroj"]))
        if not s["vodice"]:
            nalezy.append("{}: schéma nemá žádný vodič.".format(d["kod"]))
        znaky_vodicu = set()
        for v in s["vodice"]:
            znaky_vodicu.add(v["znak"])
            znaky_vodicu.update(v.get("deleniNa", []))
        if s["neziveCasti"] != "vlastniZemnic" and s["neziveCasti"] not in znaky_vodicu:
            nalezy.append(
                "{}: neživé části jsou připojené na '{}', takový vodič ale ve schématu "
                "není.".format(d["kod"], s["neziveCasti"]))

        # Schéma i výčet znaků musí určovat druh jednoznačně — na obojím
        # stojí jedna z úloh trenažéru.
        podpisy.setdefault(json.dumps(s, sort_keys=True, ensure_ascii=False), []).append(d["kod"])
        podpisy.setdefault("znaky:" + "|".join(sorted(d["znaky"])), []).append(d["kod"])
    for podpis, kdo in podpisy.items():
        if len(kdo) > 1:
            nalezy.append(
                "Druhy {} mají shodné schéma nebo shodné znaky. Úloha trenažéru by měla "
                "dvě správné odpovědi.".format(", ".join(kdo)))

    # 4. Generovaný seznam otázek.
    gen = nacti_generator()
    cekano = gen.spocitej(bank, ids)
    if temata_soubor.get("bankVersion") != bank["bankVersion"]:
        nalezy.append(
            "site-otazky.json je generovaný z banky {}, nahraná banka je {}. Spusť "
            "scripts/build_site_topics.py.".format(
                temata_soubor.get("bankVersion"), bank["bankVersion"]))
    if temata_soubor.get("temata") != cekano:
        nalezy.append(
            "site-otazky.json nesouhlasí s tím, co ze banky plyne teď. Spusť "
            "scripts/build_site_topics.py a výsledek zkontroluj.")
    v_bance = {q["id"] for q in bank["questions"]}
    for tema, seznam in temata_soubor.get("temata", {}).items():
        for qid in seznam:
            if qid not in v_bance:
                nalezy.append("site-otazky.json: téma {} odkazuje na {}, které v bance "
                              "není.".format(tema, qid))

    pocty = {k: len(v) for k, v in temata_soubor.get("temata", {}).items()}
    print("Trenažér sítí: {} druhů, {} úloh na písmena, otázek z banky {}".format(
        len(data["druhy"]),
        sum(len(p["varianty"]) for p in data["pismena"]),
        sum(pocty.values())))
    for k in sorted(pocty):
        print("  {:10} {:>3}".format(k, pocty[k]))

    if nalezy:
        print("\nNálezy ({}):".format(len(nalezy)))
        for n in nalezy:
            print("  - " + n)
        return 1
    print("\nKontrola prošla. Trenažér netvrdí nic, co by neměl čím doložit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
