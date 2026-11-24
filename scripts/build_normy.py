#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Inventura předpisů a norem, na které banka odkazuje -> src/data/normy.json.

Počítá se z normativních odkazů v oficiální bance, takže čísla nejsou odhad.
Ručně psané je jen zařazení do skupin a popisky — ty jsou v
`src/data/normy-skupiny.json` a tenhle skript je nevymýšlí.

Norma se klíčuje **číselným označením** („33 2000-4-41", „62305-3"), ne celým
řetězcem. TIČR píše tutéž normu různě — „ČSN EN 62305-3" i „ČSN EN IEC
62305-3", „ČSN 61140" i „ČSN EN 61140" — a kdyby se klíčovalo celým zápisem,
rozpadla by se jedna norma na dvě položky. Všechny zapsané tvary se zachovají
v poli `tvary`, aby bylo vidět, že ta nejednotnost je ve zdroji.

Spouštěj izolovaně:  python3 -I scripts/build_normy.py
"""

import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUESTIONS = os.path.join(ROOT, "src", "data", "questions.2027.json")
SKUPINY = os.path.join(ROOT, "src", "data", "normy-skupiny.json")
OUT = os.path.join(ROOT, "src", "data", "normy.json")

CSN = re.compile(r"(ČSN(?:\s+EN)?(?:\s+IEC)?(?:\s+ISO)?)\s+([0-9][0-9 ]*[0-9](?:-[0-9A-Za-z]+)*)")
EDICE = re.compile(r"ed\.\s*(\d)")
ROK = re.compile(r":\s*(\d{4})")
PRAVNI = [
    (re.compile(r"(?:zákon\w*)\s*(?:č\.)?\s*(\d+/\d{4})", re.I), "zákon č. {} Sb."),
    (re.compile(r"(?:NV|nařízení vlády)\s*(?:č\.)?\s*(\d+/\d{4})", re.I), "NV č. {} Sb."),
    (re.compile(r"vyhlášk\w*\s*(?:č\.)?\s*(\d+/\d{4})", re.I), "vyhláška č. {} Sb."),
]


def rozeber(ref):
    """Vrátí [(klic, tvar, druh)] — jeden odkaz může jmenovat víc předpisů."""
    nalezy = []
    for m in CSN.finditer(ref):
        cislo = re.sub(r"\s+", " ", m.group(2)).strip()
        nalezy.append((cislo, "{} {}".format(m.group(1), cislo), "csn"))
    if nalezy:
        return nalezy
    for vzor, sablona in PRAVNI:
        for m in vzor.finditer(ref):
            nalezy.append((m.group(1), sablona.format(m.group(1)), "pravni"))
    return nalezy


def zarad(klic, druh, skupiny):
    for s in skupiny:
        if s["druh"] != druh:
            continue
        if re.search(s["vzor"], klic):
            return s["id"]
    return None


def spocitej(bank, skupiny, popisky):
    polozky = {}
    bez_odkazu = []
    for q in bank["questions"]:
        ref = q["normativeRef"]
        nalezy = rozeber(ref)
        if not nalezy:
            bez_odkazu.append(q["id"])
            continue
        for klic, tvar, druh in nalezy:
            p = polozky.setdefault(klic, {
                "klic": klic, "druh": druh, "tvary": {}, "edice": {}, "roky": {},
                "otazky": [], "podleOkruhu": {}, "otazkyPodleEdice": {},
            })
            p["tvary"][tvar] = p["tvary"].get(tvar, 0) + 1
            if druh == "csn":
                e = EDICE.search(ref)
                p["edice"]["ed. " + e.group(1) if e else "bez edice"] = \
                    p["edice"].get("ed. " + e.group(1) if e else "bez edice", 0) + 1
                r = ROK.search(ref)
                if r:
                    p["roky"][r.group(1)] = p["roky"].get(r.group(1), 0) + 1
            if q["id"] not in p["otazky"]:
                p["otazky"].append(q["id"])
                p["podleOkruhu"][q["circuit"]] = p["podleOkruhu"].get(q["circuit"], 0) + 1
                if druh == "csn":
                    e = EDICE.search(ref)
                    klic_e = "ed. " + e.group(1) if e else "bez edice"
                    p["otazkyPodleEdice"].setdefault(klic_e, []).append(q["id"])

    hotove = []
    for klic in sorted(polozky):
        p = polozky[klic]
        # Nejčastější zapsaný tvar je ten, kterým se norma pojmenuje.
        tvar = max(p["tvary"].items(), key=lambda x: (x[1], x[0]))[0]
        hotove.append({
            "klic": klic,
            "druh": p["druh"],
            "oznaceni": tvar,
            "tvary": sorted(p["tvary"]),
            "edice": sorted(p["edice"]),
            "roky": sorted(p["roky"]),
            "skupina": zarad(klic, p["druh"], skupiny),
            "popis": popisky.get(klic),
            "otazkyPodleEdice": {k: sorted(v) for k, v in sorted(p["otazkyPodleEdice"].items())},
            "otazek": len(p["otazky"]),
            "podleOkruhu": p["podleOkruhu"],
            "otazky": sorted(p["otazky"]),
        })
    hotove.sort(key=lambda x: (-x["otazek"], x["klic"]))
    return hotove, sorted(bez_odkazu)


def main():
    with open(QUESTIONS, encoding="utf-8") as fh:
        bank = json.load(fh)
    with open(SKUPINY, encoding="utf-8") as fh:
        sk = json.load(fh)

    polozky, bez_odkazu = spocitej(bank, sk["skupiny"], sk["popisky"])

    out = {
        "schemaVersion": 1,
        "generovano": date.today().isoformat(),
        "skript": "scripts/build_normy.py",
        "bankVersion": bank["bankVersion"],
        "poznamka": (
            "Generovaný soubor. Počty plynou z normativních odkazů v bance. "
            "Otázka, jejíž odkaz jmenuje dva předpisy, se počítá u obou, "
            "takže součet přes položky může být vyšší než počet otázek."
        ),
        "otazekVBance": len(bank["questions"]),
        "bezRozpoznanehoOdkazu": bez_odkazu,
        "polozky": polozky,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print("Inventura norem -> {}".format(os.path.relpath(OUT, ROOT)))
    print("  položek {}, z toho ČSN {}, právních předpisů {}".format(
        len(polozky),
        sum(1 for p in polozky if p["druh"] == "csn"),
        sum(1 for p in polozky if p["druh"] == "pravni")))
    print("  bez rozpoznaného odkazu: {}".format(len(bez_odkazu)))
    for p in polozky[:8]:
        print("   {:4}x {:22} {}".format(p["otazek"], p["oznaceni"], p["skupina"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
