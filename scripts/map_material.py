#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Přiřadí odpovědi z dodaného školicího materiálu k otázkám sady 2027.

Proč to není triviální: školicí materiál je ke **starší** sadě otázek.
Shodné číslo otázky nestačí a je nebezpečné — otázky se mezi sadami
přečíslovaly, přeformulovaly i vyměnily. Přiřazení se proto dělá podle
**znění otázky**, ne podle čísla, a výsledek se dělí podle míry shody:

  >= 0.80  pravděpodobně táž otázka, odpověď stojí za posouzení
  0.60–0.80 podobná, ale změněná — porovnat ručně slovo po slovu
  < 0.60   v sadě 2027 nejspíš není, nebo je přepsaná k nepoznání

Žádná z těch kategorií neznamená „ověřeno". Znamenají jen, čím začít.

Spouštěj izolovaně:
    python3 -I scripts/map_material.py podklady/lps-diktovane-odpovedi-20260520.md ez4
"""

import difflib
import json
import os
import re
import sys
import unicodedata
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUESTIONS = os.path.join(ROOT, "src", "data", "questions.2027.json")

SILNA = 0.80
STREDNI = 0.60


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def nacti_material(path):
    """Čte formát `## q=NNN` s popisky `klic: hodnota`."""
    text = open(path, encoding="utf-8").read()
    out = []
    for blok in re.split(r"^## q=", text, flags=re.M)[1:]:
        cislo = blok.split("\n", 1)[0].strip()
        zaznam = {"cislo": cislo}
        for klic in ("otazka", "odpoved", "jistota", "pozn", "cas_mmss"):
            m = re.search(r"^{}:\s*(.*?)(?=^\w+:|\Z)".format(klic), blok, re.M | re.S)
            zaznam[klic] = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
        out.append(zaznam)
    return out


def main():
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    cesta, okruh = sys.argv[1], sys.argv[2]

    bank = json.load(open(QUESTIONS, encoding="utf-8"))
    otazky = [q for q in bank["questions"] if q["circuit"] == okruh]
    material = nacti_material(os.path.join(ROOT, cesta))

    radky = []
    prirazeno = {}
    for m in material:
        if not m["otazka"]:
            radky.append((m, None, 0.0))
            continue
        n = norm(m["otazka"])
        nej, nejr = None, 0.0
        for q in otazky:
            r = difflib.SequenceMatcher(None, n, norm(q["text"])).ratio()
            if r > nejr:
                nej, nejr = q, r
        radky.append((m, nej, nejr))
        if nejr >= SILNA and nej:
            prirazeno.setdefault(nej["id"], []).append(m["cislo"])

    silne = [r for r in radky if r[2] >= SILNA]
    stredni = [r for r in radky if STREDNI <= r[2] < SILNA]
    slabe = [r for r in radky if r[2] < STREDNI]
    bez = [q for q in otazky if q["id"] not in prirazeno]

    out = os.path.splitext(os.path.join(ROOT, cesta))[0] + "-mapovani.md"
    with open(out, "w", encoding="utf-8") as fh:
        w = lambda s="": fh.write(s + "\n")
        w("# Přiřazení školicího materiálu k sadě 2027 — okruh {}".format(okruh))
        w()
        w("Materiál: `{}`".format(cesta))
        w("Banka: {} ({} otázek v okruhu {}), sestaveno {}".format(
            bank["bankVersion"], len(otazky), okruh, date.today().isoformat()))
        w()
        w("**Přiřazeno podle znění otázky, ne podle čísla.** Materiál je ke starší")
        w("sadě; čísla otázek se mezi sadami neshodují a spoléhat na ně by bylo")
        w("chybné. Žádný řádek níže neznamená ověřenou odpověď — jen vodítko,")
        w("čím začít a co porovnat ručně.")
        w()
        w("| Míra shody | Počet | Co s tím |")
        w("| --- | ---: | --- |")
        w("| silná (≥ {:.2f}) | {} | pravděpodobně táž otázka, odpověď posoudit |".format(SILNA, len(silne)))
        w("| střední ({:.2f}–{:.2f}) | {} | otázka se změnila, porovnat slovo po slovu |".format(STREDNI, SILNA, len(stredni)))
        w("| slabá (< {:.2f}) | {} | v sadě 2027 nejspíš není, nebo je přepsaná |".format(STREDNI, len(slabe)))
        w()
        w("**Otázek okruhu {} v sadě 2027 bez protějšku v materiálu: {} z {}.**".format(
            okruh, len(bez), len(otazky)))
        w("To jsou otázky, které se z tohohle materiálu naučit nedají.")
        w()

        for nadpis, skupina in (("Silná shoda", silne), ("Střední shoda", stredni), ("Slabá shoda", slabe)):
            w("## {} ({})".format(nadpis, len(skupina)))
            w()
            w("| Materiál | Shoda | Otázka 2027 | Jistota | Odpověď z materiálu |")
            w("| --- | ---: | --- | --- | --- |")
            for m, q, r in sorted(skupina, key=lambda x: -x[2]):
                odp = (m["odpoved"] or "—").replace("|", "/")
                w("| č. {} | {:.2f} | {} | {} | {} |".format(
                    m["cislo"], r, q["id"] if q else "—", m["jistota"] or "—",
                    odp[:110] + ("…" if len(odp) > 110 else "")))
            w()

        w("## Otázky sady 2027 bez protějšku ({})".format(len(bez)))
        w()
        for q in bez:
            w("- `{}` č. {} — {}".format(q["id"], q["number"], q["text"][:100]))
        w()

    print("Přiřazení -> {}".format(os.path.relpath(out, ROOT)))
    print("  silná {}  střední {}  slabá {}".format(len(silne), len(stredni), len(slabe)))
    print("  otázek 2027 bez protějšku: {} z {}".format(len(bez), len(otazky)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
