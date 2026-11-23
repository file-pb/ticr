#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Import oficiální banky testových otázek TIČR (platnost od 1. 1. 2027).

Vstup:  data/txt/*.txt  (výstup scripts/fetch_source.sh)
Výstup: src/data/questions.2027.json
        docs/IMPORT_REPORT.md

Importují se pouze okruhy ez1–ez4, které tvoří rozsah přípravy E2A včetně LPS
bez nebezpečí výbuchu. Okruhy ez5–ez7 se vědomě nezpracovávají.

Skript zachovává původní text otázky, její číslo i úplný normativní odkaz.
Normalizuje jen technické zalomení řádků, mezery a artefakty konverze z Wordu.
Význam ani chyby zdroje neopravuje.

Spouštěj izolovaně:  python3 -I scripts/import_ticr.py
"""

import hashlib
import json
import os
import re
import sys
import unicodedata
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TXT_DIR = os.path.join(ROOT, "data", "txt")
RAW_DIR = os.path.join(ROOT, "data", "raw")
OUT_JSON = os.path.join(ROOT, "src", "data", "questions.2027.json")
OUT_REPORT = os.path.join(ROOT, "docs", "IMPORT_REPORT.md")

BANK_VERSION = "2027.1"
VALID_FROM = "2027-01-01"
PAGE_URL = "https://www.ticr.eu/inpage/testove-otazky-ez/"
ZIP_URL = "https://www.ticr.eu/soubor/ez-testove-otazky-od-2027-01-01-zip/"

# Okruh -> (soubor .doc, lidský název, očekávaný počet otázek při kontrole 23. 11. 2026)
CIRCUITS = [
    ("ez1", "ez1 obecny test - 2027", "Obecný test", 90),
    ("ez2", "ez2 ochrana pred urazem el.proudem - 2027",
     "Ochrana před úrazem elektrickým proudem", 100),
    ("ez3", "ez3 vseob pozadavky na EZ - 2027",
     "Všeobecné požadavky na elektrická zařízení", 140),
    ("ez4", "ez4 LPS v prostredi bez nebezpeci vybuchu - 2027",
     "LPS v prostředí bez nebezpečí výbuchu", 100),
]

# Značka začátku otázky: "12)" nebo "34/" (zdroj obě značky skutečně míchá).
RE_NUM = re.compile(r"^\s*(\d{1,3})\s*([)/])\s*")

# Řádek s normativním odkazem. Pokrývá odkazy na normy (ČSN/TNI/PNE) i na
# právní předpisy, které jsou v ez1 uvedené v kulatých závorkách.
RE_REF = re.compile(
    r"^\(?\s*("
    r"ČSN|TNI|PNE|EN\b|IEC\b"
    r"|[Zz]ákon|[Zz]ák\.|NV\b|[Nn]ařízení|[Vv]yhláška|§|[Pp]říloha"
    r")"
)

# Odkaz vložený na konec řádku s otázkou: "... odběratel? (Nařízení vlády č. 190/2022 Sb.)"
RE_TRAILING_REF = re.compile(r"\(([^()]*(?:ČSN|TNI|PNE|zákon|Zákon|zák\.|NV|[Nn]ařízení|vyhláška|§|[Pp]říloha)[^()]*)\)\s*$")

# Artefakt konverze z Wordu: pole HYPERLINK zůstane v textu před zobrazeným textem.
RE_HYPERLINK = re.compile(r"\s*HYPERLINK\s+\"[^\"]*\"\s*")


def normalize(line):
    """Technická normalizace řádku. Nemění význam ani interpunkci zdroje."""
    line = unicodedata.normalize("NFC", line)
    line = RE_HYPERLINK.sub(" ", line)
    # NBSP, zero-width, exotické mezery a Wordové zalomení uvnitř odstavce
    # (U+2028 LINE SEPARATOR, U+2029 PARAGRAPH SEPARATOR, U+000B) na obyčejnou
    # mezeru. Textová konverze je nechává uprostřed věty.
    line = re.sub(r"[         \t]", " ", line)
    line = line.replace("​", "").replace("﻿", "")
    line = re.sub(r" {2,}", " ", line)
    return line.strip()


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_file(path, circuit):
    """Rozdělí text okruhu na bloky otázek.

    Blok začíná číselnou značkou; okruh ez4 má prvních 12 otázek bez značky,
    proto nový blok začíná i tehdy, když přijde řádek bez odkazu a předchozí
    blok už svůj normativní odkaz dostal.
    """
    with open(path, "r", encoding="utf-8") as fh:
        raw_lines = fh.readlines()

    blocks = []
    cur = None
    header_seen = False
    v_hlavicce = False
    anomalies = []

    for raw in raw_lines:
        line = normalize(raw)
        if not line:
            continue
        # Hlavička souboru. Nová sada ji má jednořádkovou ("EZRTB1 – obecný
        # test"), starší dvouřádkovou ("Testy pro písemnou část zkoušky
        # EZRTA1" / "ze zákonů a vyhlášek"). Zahazuje se proto všechno až do
        # první otázky — tou je buď číslovaná značka, nebo řádek s otazníkem.
        # Bez toho se druhý řádek hlavičky naparsuje jako otázka navíc.
        if not header_seen:
            if "EZRT" in line:
                v_hlavicce = True
                continue
            if v_hlavicce and "?" not in line and not RE_NUM.match(line):
                anomalies.append("Zahozen další řádek hlavičky: {!r}".format(line[:60]))
                continue
            header_seen = True

        m = RE_NUM.match(line)
        if m:
            rest = line[m.end():].strip()
            cur = {
                "number": int(m.group(1)),
                "marker": "{}{}".format(m.group(1), m.group(2)),
                "text": [rest] if rest else [],
                "ref": [],
            }
            blocks.append(cur)
            continue

        is_ref = bool(RE_REF.match(line))

        if cur is None:
            if is_ref:
                anomalies.append("Odkaz bez otázky: {!r}".format(line[:80]))
                continue
            cur = {"number": None, "marker": None, "text": [line], "ref": []}
            blocks.append(cur)
            continue

        if is_ref:
            cur["ref"].append(line)
        elif cur["ref"]:
            # Předchozí blok je uzavřený odkazem -> tohle je nová (nečíslovaná) otázka.
            cur = {"number": None, "marker": None, "text": [line], "ref": []}
            blocks.append(cur)
        else:
            # Pokračování víceřádkové otázky.
            cur["text"].append(line)

    return blocks, anomalies


def build_questions(circuit, title, blocks, anomalies):
    questions = []
    for idx, b in enumerate(blocks, start=1):
        text = " ".join(b["text"]).strip()
        ref = " ".join(b["ref"]).strip()

        if not ref:
            m = RE_TRAILING_REF.search(text)
            if m:
                ref = m.group(1).strip()
                text = text[: m.start()].strip()

        # Odkazy v ez1 jsou ve zdroji v kulatých závorkách – závorky jsou
        # formátování, ne součást citace.
        ref = re.sub(r"^\((.*)\)$", r"\1", ref).strip()
        ref = re.sub(r"\s+([.,])", r"\1", ref)

        number = b["number"] if b["number"] is not None else idx
        if b["number"] is not None and b["number"] != idx:
            anomalies.append(
                "Číslo ve zdroji ({}) nesouhlasí s pořadím ({}).".format(b["number"], idx)
            )

        if not text:
            anomalies.append("Prázdný text otázky na pořadí {}.".format(idx))
        if not ref:
            anomalies.append(
                "Otázka {} bez normativního odkazu: {!r}".format(number, text[:70])
            )

        questions.append({
            "id": "2027-{}-{:03d}".format(circuit, number),
            "circuit": circuit,
            "circuitTitle": title,
            "number": number,
            "sourceMarker": b["marker"],
            "numberedInSource": b["number"] is not None,
            "text": text,
            "normativeRef": ref,
        })
    return questions


def main():
    zip_path = os.path.join(RAW_DIR, "ez-2027.zip")
    provenance = {
        "pageUrl": PAGE_URL,
        "zipUrl": ZIP_URL,
        "importedAt": date.today().isoformat(),
        "zipSha256": sha256_file(zip_path) if os.path.exists(zip_path) else None,
        "files": [],
    }

    all_questions = []
    circuits_meta = []
    all_anomalies = []
    ok = True

    for circuit, filebase, title, expected in CIRCUITS:
        txt_path = os.path.join(TXT_DIR, filebase + ".txt")
        doc_path = os.path.join(RAW_DIR, "extracted", filebase + ".doc")
        if not os.path.exists(txt_path):
            print("CHYBA: chybí {}. Spusť scripts/fetch_source.sh".format(txt_path),
                  file=sys.stderr)
            return 2

        blocks, anomalies = parse_file(txt_path, circuit)
        questions = build_questions(circuit, title, blocks, anomalies)

        ids = [q["id"] for q in questions]
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        if dupes:
            anomalies.append("Duplicitní ID: {}".format(", ".join(dupes)))

        numbers = sorted(q["number"] for q in questions)
        missing = [n for n in range(1, (numbers[-1] if numbers else 0) + 1)
                   if n not in numbers]
        if missing:
            anomalies.append("Chybějící čísla v posloupnosti: {}".format(missing))

        if len(questions) != expected:
            anomalies.append(
                "POČET: naimportováno {}, očekáváno {} (kontrola 23. 11. 2026). "
                "Rozdíl je potřeba posoudit, ne zahladit.".format(len(questions), expected)
            )
            ok = False

        circuits_meta.append({
            "id": circuit,
            "sourceFile": filebase + ".doc",
            "title": title,
            "expected": expected,
            "imported": len(questions),
            "withNormativeRef": sum(1 for q in questions if q["normativeRef"]),
        })
        provenance["files"].append({
            "name": filebase + ".doc",
            "sha256": sha256_file(doc_path) if os.path.exists(doc_path) else None,
            "bytes": os.path.getsize(doc_path) if os.path.exists(doc_path) else None,
            "questions": len(questions),
        })
        all_questions.extend(questions)
        all_anomalies.extend("[{}] {}".format(circuit, a) for a in anomalies)

    bank = {
        "schemaVersion": 1,
        "bankVersion": BANK_VERSION,
        "validFrom": VALID_FROM,
        "scope": "E2A – revizní technik elektrických zařízení, okruhy ez1–ez4 "
                 "(včetně LPS bez nebezpečí výbuchu). Okruhy ez5–ez7 nejsou součástí.",
        "disclaimer": "Oficiální dokumenty TIČR obsahují znění otázek a normativní "
                      "odkazy. Neobsahují zveřejněné možnosti A/B/C ani klíč správných "
                      "odpovědí. Možnosti v této aplikaci jsou učební, nikoli autentické "
                      "odpovědi TIČR.",
        "provenance": provenance,
        "circuits": circuits_meta,
        "questions": all_questions,
    }

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(bank, fh, ensure_ascii=False, indent=1, sort_keys=False)
        fh.write("\n")

    lines = ["# Report importu banky TIČR {}".format(BANK_VERSION), ""]
    lines.append("Zdroj: {}".format(ZIP_URL))
    lines.append("")
    lines.append("sha256(ZIP): `{}`".format(provenance["zipSha256"]))
    lines.append("")
    lines.append("| Okruh | Soubor | Název | Očekáváno | Naimportováno | S normativním odkazem |")
    lines.append("| --- | --- | --- | --- | --- | --- |")
    for c in circuits_meta:
        lines.append("| {} | `{}` | {} | {} | {} | {} |".format(
            c["id"], c["sourceFile"], c["title"], c["expected"],
            c["imported"], c["withNormativeRef"]))
    lines.append("")
    lines.append("Celkem naimportováno: **{}** otázek.".format(len(all_questions)))
    lines.append("")
    if all_anomalies:
        lines.append("## Nálezy k posouzení")
        lines.append("")
        for a in all_anomalies:
            lines.append("- {}".format(a))
    else:
        lines.append("## Nálezy k posouzení")
        lines.append("")
        lines.append("Žádné. Počty, číslování ani duplicity nevykázaly odchylku.")
    lines.append("")

    os.makedirs(os.path.dirname(OUT_REPORT), exist_ok=True)
    with open(OUT_REPORT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    print("Naimportováno {} otázek -> {}".format(len(all_questions), OUT_JSON))
    for c in circuits_meta:
        flag = "" if c["imported"] == c["expected"] else "  <-- ODCHYLKA"
        print("  {} {:>4}/{:<4} s odkazem {:>4}{}".format(
            c["id"], c["imported"], c["expected"], c["withNormativeRef"], flag))
    if all_anomalies:
        print("\nNálezy ({}):".format(len(all_anomalies)))
        for a in all_anomalies:
            print("  - " + a)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
