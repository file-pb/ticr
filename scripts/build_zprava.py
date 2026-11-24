#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vytáhne z NV č. 190/2022 Sb. to, co se týká revize a zprávy o revizi
-> src/data/zprava-citace.json.

Proč skript a ne ručně opsaný seznam: opsat patnáct písmen z nařízení vlády
znamená patnáct příležitostí k překlepu a žádný způsob, jak si ho všimnout.
Takhle je text doslovný z `predpisy/nv-190-2022.txt` a `scripts/check_zprava.py`
ověří, že každá věta v aplikaci v předpisu skutečně stojí.

Co se vytahuje:
    § 10 odst. 1        co zpráva o revizi obsahuje
    příloha č. 1 A      prohlídka
    příloha č. 1 B I    zkouška a měření v daném pořadí
    příloha č. 1 B II   co se zkouší dál
    příloha č. 2 A      podklady pro výchozí / pravidelnou a mimořádnou revizi
    příloha č. 2 B      náplň výchozí / pravidelné a mimořádné revize
    příloha č. 4        základní nejdelší lhůty pravidelných revizí

Spouštěj izolovaně:  python3 -I scripts/build_zprava.py
"""

import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREDPIS = os.path.join(ROOT, "predpisy", "nv-190-2022.txt")
QUESTIONS = os.path.join(ROOT, "src", "data", "questions.2027.json")
OUT = os.path.join(ROOT, "src", "data", "zprava-citace.json")

PISMENO = re.compile(r"^([a-z])\)\s+(.*)$")
LHUTA = re.compile(r"^(.*?)\s+(\d+(?:[,.]\d+)?\s*(?:let|roky|rok|roku))$")

# Které ustanovení patří ke které sekci — podle něj se k sekci najdou otázky
# z banky. Hledá se v normativním odkazu otázky, ne v jejím znění.
USTANOVENI = {
    "zprava-obsah": r"§\s*10",
    "podklady-vychozi": r"příloha č\. 2",
    "podklady-pravidelne": r"příloha č\. 2",
    "napln-vychozi": r"příloha č\. 2",
    "napln-pravidelne": r"příloha č\. 2",
    "prohlidka": r"příloha č\. 1",
    "zkouska-poradi": r"příloha č\. 1",
    "zkouska-dalsi": r"příloha č\. 1",
    "lhuty": r"příloha č\. 4",
}


def otazky_k(bank, klic):
    """Otázky, jejichž normativní odkaz míří na NV 190/2022 a na dané ustanovení."""
    vzor = re.compile(USTANOVENI[klic])
    return sorted(
        q["id"] for q in bank["questions"]
        if "190/2022" in q["normativeRef"] and vzor.search(q["normativeRef"])
    )


def nacti():
    with open(PREDPIS, encoding="utf-8") as fh:
        return [re.sub(r"\s+", " ", radek).strip() for radek in fh]


def index(radky, text, od=0):
    """První řádek, který začíná daným textem. Kotvy jsou doslovné —
    když se předpis novelizuje, skript spadne, místo aby tiše vrátil nesmysl."""
    for i in range(od, len(radky)):
        if radky[i].startswith(text):
            return i
    raise SystemExit("Kotva nenalezena v {}: {!r}".format(
        os.path.relpath(PREDPIS, ROOT), text))


def sber(radky, od, do):
    body = []
    for radek in radky[od:do]:
        m = PISMENO.match(radek)
        if m:
            body.append({"znak": m.group(1), "text": m.group(2).rstrip(",").strip()})
    return body


def sestav(radky, bank):
    """Složí obsah souboru. Oddělené od zápisu, aby si kontrola mohla stejným
    kódem ověřit, že je uložený soubor aktuální, a nic přitom nepřepsala."""

    i_p10 = index(radky, "§ 10")
    i_obsah = index(radky, "(1) Zpráva o revizi vyhrazeného elektrického zařízení obsahuje", i_p10)
    i_obsah_konec = index(radky, "(2) Bude-li výchozí revize", i_obsah)

    i_pr1 = index(radky, "Příloha č. 1 k nařízení vlády")
    i_prohlidka = index(radky, "Prohlídka předchází zkoušce", i_pr1)
    i_castB = index(radky, "Část B", i_prohlidka)
    i_poradi = index(radky, "Zkoušení a měření se u revidovaného", i_castB)
    i_dalsi = index(radky, "II. Další požadavky", i_poradi)

    i_pr2 = index(radky, "Příloha č. 2 k nařízení vlády")
    i_pod_vych = index(radky, "I. Pro výchozí revize", i_pr2)
    i_pod_prav = index(radky, "II. Pro pravidelné a mimořádné revize", i_pod_vych)
    i_pr2_castB = index(radky, "Část B", i_pod_prav)
    i_napln_vych = index(radky, "I. Při výchozí revizi", i_pr2_castB)
    i_napln_prav = index(radky, "II. Při pravidelné a mimořádné revizi", i_napln_vych)
    i_pr3 = index(radky, "Příloha č. 3 k nařízení vlády", i_napln_prav)

    i_pr4 = index(radky, "Příloha č. 4 k nařízení vlády")
    i_lhuty_doplnky = index(radky, "Doplňující informace k základním nejdelším lhůtám "
                                   "pravidelných revizí vyhrazeného", i_pr4)
    i_lps_doplnky = index(radky, "Doplňující informace k základním nejdelším lhůtám "
                                 "pravidelných revizí LPS", i_lhuty_doplnky)
    i_pr5 = index(radky, "Příloha č. 5 k nařízení vlády", i_lps_doplnky)

    sekce = [
        {
            "id": "zprava-obsah",
            "nazev": "Co zpráva o revizi obsahuje",
            "zdroj": "NV č. 190/2022 Sb., § 10 odst. 1",
            "uvod": radky[i_obsah],
            "body": sber(radky, i_obsah, i_obsah_konec),
        },
        {
            "id": "podklady-vychozi",
            "nazev": "Podklady pro výchozí revizi",
            "zdroj": "NV č. 190/2022 Sb., příloha č. 2 část A bod I",
            "uvod": radky[index(radky, "Podklady pro provedení revize vyhrazeného "
                                       "elektrického zařízení obsahují zejména", i_pr2)],
            "body": sber(radky, i_pod_vych, i_pod_prav),
        },
        {
            "id": "podklady-pravidelne",
            "nazev": "Podklady pro pravidelnou a mimořádnou revizi",
            "zdroj": "NV č. 190/2022 Sb., příloha č. 2 část A bod II",
            "uvod": radky[i_pod_prav],
            "body": sber(radky, i_pod_prav, i_pr2_castB),
        },
        {
            "id": "napln-vychozi",
            "nazev": "Náplň výchozí revize",
            "zdroj": "NV č. 190/2022 Sb., příloha č. 2 část B bod I",
            "uvod": radky[i_napln_vych],
            "body": sber(radky, i_napln_vych, i_napln_prav),
        },
        {
            "id": "napln-pravidelne",
            "nazev": "Náplň pravidelné a mimořádné revize",
            "zdroj": "NV č. 190/2022 Sb., příloha č. 2 část B bod II",
            "uvod": radky[i_napln_prav],
            "body": sber(radky, i_napln_prav, i_pr3),
        },
        {
            "id": "prohlidka",
            "nazev": "Prohlídka",
            "zdroj": "NV č. 190/2022 Sb., příloha č. 1 část A",
            "uvod": radky[i_prohlidka],
            "body": sber(radky, i_prohlidka, i_castB),
        },
        {
            "id": "zkouska-poradi",
            "nazev": "Zkouška a měření v tomhle pořadí",
            "zdroj": "NV č. 190/2022 Sb., příloha č. 1 část B bod I",
            "uvod": radky[i_poradi],
            "body": sber(radky, i_poradi, i_dalsi),
        },
        {
            "id": "zkouska-dalsi",
            "nazev": "Co se zkouší dál",
            "zdroj": "NV č. 190/2022 Sb., příloha č. 1 část B bod II",
            "uvod": radky[index(radky, "Zkouší se zejména", i_dalsi)],
            "body": sber(radky, i_dalsi, i_pr2),
        },
    ]

    lhuty, nadpis = [], None
    for radek in radky[i_pr4:i_lhuty_doplnky]:
        if radek.endswith("Revizní lhůty"):
            nadpis = radek[: -len("Revizní lhůty")].rstrip(": ").strip()
            continue
        m = LHUTA.match(radek)
        if m:
            lhuty.append({"co": m.group(1).strip(), "lhuta": m.group(2).strip(),
                          "skupina": nadpis})

    for sekce_item in sekce:
        sekce_item["otazky"] = otazky_k(bank, sekce_item["id"])

    out = {
        "schemaVersion": 1,
        "generovano": date.today().isoformat(),
        "skript": "scripts/build_zprava.py",
        "zdroj": {
            "predpis": "nařízení vlády č. 190/2022 Sb.",
            "soubor": "predpisy/nv-190-2022.txt",
            "poznamka": (
                "Doslovný text předpisu. Právní předpis je podle § 3 písm. a) zákona "
                "č. 121/2000 Sb. úřední dílo. Text platí k datu stažení uvedenému "
                "v predpisy/README.md — novelizace se sama nepozná."
            ),
        },
        "sekce": sekce,
        "lhuty": {
            "nazev": radky[index(radky, "Základní nejdelší lhůty pravidelných revizí", i_pr4)],
            "zdroj": "NV č. 190/2022 Sb., příloha č. 4",
            "radky": lhuty,
            "doplnky": sber(radky, i_lhuty_doplnky, i_lps_doplnky),
            "doplnkyLps": sber(radky, i_lps_doplnky, i_pr5),
            "zbytek": radky[index(radky, "Vyhrazené elektrické zařízení, pro které "
                                         "nestanovuje tato příloha lhůtu", i_lps_doplnky)],
            "otazky": otazky_k(bank, "lhuty"),
        },
    }

    return out


def main():
    radky = nacti()
    with open(QUESTIONS, encoding="utf-8") as fh:
        bank = json.load(fh)
    out = sestav(radky, bank)
    sekce = out["sekce"]
    lhuty = out["lhuty"]["radky"]

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print("Citace k revizní zprávě -> {}".format(os.path.relpath(OUT, ROOT)))
    for s in sekce:
        print("  {:22} {:>2} bodů, {} otázek z banky   {}".format(
            s["id"], len(s["body"]), len(s["otazky"]), s["zdroj"]))
    print("  {:22} {:>2} řádků, {} doplňků + {} k LPS".format(
        "lhuty", len(lhuty), len(out["lhuty"]["doplnky"]), len(out["lhuty"]["doplnkyLps"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
