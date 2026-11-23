#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kontrola klíče odpovědí proti vymyšlenému obsahu.

Tohle není kontrola stylu. Je to obrana proti jediné věci, která tenhle
projekt dokáže zabít: odpověď, která zní věrohodně a není ničím podložená.
Člověk ji od ověřené nerozezná, proto to musí hlídat stroj.

Co se kontroluje:

  1. Každá otázka, na kterou klíč odpovídá, musí být v bance.
  2. `correctOptionId` musí existovat mezi `options`.
  3. `whyWrong` musí pokrývat právě ty možnosti, které nejsou správné.
  4. Odpověď se stavem `overeno` musí mít `verification` se zdrojem, datem
     a způsobem kontroly.
  5. **Zdroj uvedený u ověřené odpovědi musí existovat.** U odpovědí ze
     `sourceClass: "volny"` se zdroj hledá v `predpisy/` a ověřuje
     se, že citovaný předpis i ustanovení jsou v tom souboru doopravdy
     k nalezení. Odpověď, která se odvolává na paragraf, který v textu
     předpisu není, je vymyšlená, i kdyby zněla sebelíp.
  6. Číselné údaje v odpovědi (lhůty, částky, napětí) musí jít najít
     v textu zdroje. Číslo, které ve zdroji není, je nejčastější podoba
     halucinace — proto se hlásí každé.
  7. Verze banky u klíče musí souhlasit s bankou.
  8. Klíč nesmí mít dvě odpovědi na tutéž otázku.

Spouštěj izolovaně:  python3 -I scripts/check_answers.py [soubor s klíčem ...]
Bez argumentů zkontroluje veřejnou i lokální vrstvu.
Vrací nenulový kód, když něco neprojde.
"""

import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUESTIONS = os.path.join(ROOT, "src", "data", "questions.2027.json")
PREDPISY = os.path.join(ROOT, "predpisy")

# Čísla, která se v odpovědích objevují jako běžná výplň a nejsou údajem.
IGNOROVANA_CISLA = {"1", "2", "3", "4", "5"}

# Slova, která za číslem stojí, ale nejsou jednotkou. Bez tohohle se
# „přílohy č. 2 a vyhrazené zařízení" přečte jako údaj „2 a" a kontrola
# nahlásí falešný poplach. Zjištěno 23. 11. 2026 na prvním ostrém běhu.
NEJEDNOTKY = {
    "a", "i", "o", "u", "v", "z", "s", "k",
    "na", "do", "od", "ve", "za", "se", "je", "to", "ke", "po", "pro",
    "nebo", "podle", "písm", "odst", "bodu", "části", "přílohy", "příloha",
    "tohoto", "této", "tímto", "včetně", "jen", "též", "jakož",
}

# Mapování citovaného předpisu na soubor s jeho doslovným textem.
PREDPIS_SOUBORY = {
    "190/2022": "nv-190-2022.txt",
    "250/2021": "zakon-250-2021.txt",
    "194/2022": "nv-194-2022.txt",
    "22/1997": "zakon-22-1997.txt",
    "458/2000": "zakon-458-2000.txt",
    "262/2006": "zakon-262-2006.txt",
    "309/2006": "zakon-309-2006.txt",
    "378/2001": "nv-378-2001.txt",
    "455/1991": "zakon-455-1991.txt",
    # 278/2008 stojí za 455/1991 záměrně: otázka na živnostenské oprávnění
    # cituje obě přílohy a `najdi_text_predpisu` bere první shodu, takže
    # kontrola má sáhnout do živnostenského zákona, ne do jeho prováděcího
    # nařízení. Totéž platí pro 505/1990 před 345/2002.
    "278/2008": "nv-278-2008.txt",
    "89/2012": "zakon-89-2012.txt",
    "251/2005": "zakon-251-2005.txt",
    "90/2016": "zakon-90-2016.txt",
    "117/2016": "nv-117-2016.txt",
    "283/2021": "zakon-283-2021.txt",
    "146/2024": "vyhlaska-146-2024.txt",
    "366/2013": "nv-366-2013.txt",
    "505/1990": "zakon-505-1990.txt",
    "345/2002": "vyhlaska-345-2002.txt",
}


def nacti(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def normalizuj(text):
    """Sjednotí mezery a pomlčky, aby šlo porovnávat citace ustanovení."""
    text = text.replace(" ", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", text)


# Číslo včetně desetinné čárky a mezery jako oddělovače tisíců (2 000 000 Kč).
RE_CISLO = re.compile(r"\d{1,3}(?:[  ]\d{3})+|\d+(?:[.,]\d+)?")


# --- Prekryv slov mezi odpovedi a citovanym ustanovenim -----------------
#
# Ciselna kontrola nize chytne vymyslenou HODNOTU. Nechytne ale citaci, ktera
# miri na jine, existujici ustanoveni — u odpovedi bez cisel projde cokoli, co
# nekde v predpisu stoji. Namereno 23. 11. 2026 na zakonu 22/1997: zamena
# "§ 4a odst. 1" za "§ 4 odst. 1" u otazky na harmonizovanou normu prosla,
# ackoli § 4 o harmonizaci nemluvi.
#
# Prah 0,60 je vybrany z dat, ne z citu. Na 83 overenych odpovedich ma pokryti
# vuci citovanemu ustanoveni median 1,00 a paty percentil 0,71; vuci nahodne
# jinemu ustanoveni tehoz predpisu median 0,26; u te sabotaze 0,08.
#
# Co kontrola NEUMI: odpovedi s mene nez tremi obsahovymi slovy ("ano",
# "5 let", "stat") se preskakuji — lexikalne je ukotvit nejde. Jejich jedinou
# pojistkou zustava ciselna kontrola nize.
PRAH_PREKRYVU = 0.60
MIN_SLOV = 3

NEOBSAHOVA = set("""
a i o u v z s k na do od ve za se je to ke po pro nebo podle pismeno pismene
odst odstavce bodu casti prilohy priloha tohoto teto tomuto timto vcetne jen tez
jakoz ktery ktera ktere kterym kterych byt byl byla bylo jsou nejsou maji musi
nesmi lze nelze pri pred pouze vsak tak take jako ani nez aby pokud kdyz pripade
pripadne dale jejich jeho svych svem jine jiny jina dalsi takove ten
nebo anebo popripade zpravidla zejmena napriklad tedy pak proto ovsem vsech
vsechny tim tomu toho teto tyto tech temto
""".split())


def stemy(text):
    """Obsahova slova zkracena na pet znaku — hruba nahrada za stemmer.

    Cestina sklonuje, takze presne porovnani slov by selhalo na "harmonizovanou"
    vs "harmonizovane". Pet znaku staci na rozliseni a snese sklonovani.
    """
    s = unicodedata.normalize("NFD", text.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return {w[:5] for w in re.findall(r"[a-z]{4,}", s) if w not in NEOBSAHOVA}


def prekryv(odpoved, kontext):
    """Jaky podil obsahovych slov odpovedi stoji v kontextu. None = nelze merit."""
    a = stemy(odpoved)
    if len(a) < MIN_SLOV:
        return None
    return len(a & stemy(kontext)) / len(a)


def cisla_v(text):
    """Vytáhne číselné údaje **i s jednotkou, která za nimi stojí**.

    Samotná číslice se v textu předpisu najde skoro vždycky — „7" je v „§ 7"
    i v „2022". Vymyšlenou lhůtu „7 let" proto odhalí teprve dvojice číslo
    plus jednotka. Změřeno na vlastní kontrole 23. 11. 2026: verze, která
    hledala jen číslo, podstrčenou lhůtu nechytila.
    """
    text = normalizuj(text)
    out = []
    for m in RE_CISLO.finditer(text):
        cislo = m.group()
        zbytek = text[m.end():m.end() + 24]
        m2 = re.match(r"\s*([A-Za-zÁ-Žá-ž%°]+)", zbytek)
        jednotka = m2.group(1) if m2 else None
        if jednotka and jednotka.lower() in NEJEDNOTKY:
            jednotka = None
        out.append((cislo, jednotka))
    return out


def rozdel_na_ustanoveni(raw):
    """Rozseká text předpisu na jednotlivé paragrafy a přílohy.

    Hranicí je řádek, na kterém stojí jen označení paragrafu, včetně
    paragrafů s písmenem (§ 4a). Obsah přílohy začíná jejím záhlavím.

    Bez tohohle kroku kontrola jen ověří, že se řetězec „§ 11" v předpisu
    někde vyskytuje — jenže se vyskytuje i v každém křížovém odkazu. Ověřená
    odpověď se musí dát najít **v tom ustanovení, které cituje**, ne kdekoliv
    v zákoně. Naběhlo 23. 11. 2026, když ruční kontrola § 11 omylem vytáhla
    text úplně jiného paragrafu.
    """
    lines = raw.split("\n")
    hranice = []
    for i, l in enumerate(lines):
        m = re.fullmatch(r"\s*§\s*(\d+[a-z]?)\s*", l)
        if m:
            hranice.append((i, ("paragraf", m.group(1))))
            continue
        m = re.match(r"\s*Příloha\s*č\.\s*(\d+)\b", l)
        if m:
            hranice.append((i, ("priloha", m.group(1))))

    out = {}
    for k, (i, klic) in enumerate(hranice):
        konec = hranice[k + 1][0] if k + 1 < len(hranice) else len(lines)
        # Paragraf se může v textu objevit vícekrát (novelizace); bereme ten delší.
        telo = normalizuj("\n".join(lines[i:konec]))
        if klic not in out or len(telo) > len(out[klic]):
            out[klic] = telo
    return out


def najdi_text_predpisu(source, cache):
    """Vrátí (číslo předpisu, celý text, mapu ustanovení) nebo (None, None, None)."""
    for cislo, soubor in PREDPIS_SOUBORY.items():
        if cislo in source:
            if cislo not in cache:
                cesta = os.path.join(PREDPISY, soubor)
                if not os.path.exists(cesta):
                    cache[cislo] = (None, None)
                else:
                    with open(cesta, encoding="utf-8") as fh:
                        raw = fh.read()
                    cache[cislo] = (normalizuj(raw), rozdel_na_ustanoveni(raw))
            text, mapa = cache[cislo]
            return cislo, text, mapa
    return None, None, None


def ustanoveni_v(source):
    """Vytáhne odkazy na ustanovení, např. '§ 6 odst. 2' nebo 'příloha č. 4'.

    Číslo paragrafu může nést písmeno (§ 4a, § 36a). Bez něj by se z citace
    '§ 4a odst. 1' přečetlo '§ 4' a kontrola by ověřovala úplně jiné
    ustanovení — a **prošla by**, protože § 4 odst. 1 v zákoně taky existuje.
    Falešně prošlá kontrola je horší než spadlá. Zjištěno 23. 11. 2026 na
    zákonu č. 22/1997 Sb., kde § 4 i § 4a mluví o českých technických normách.
    """
    out = []
    for m in re.finditer(r"§\s*(\d+[a-z]?)(?:\s*odst\.\s*(\d+))?", source):
        out.append(("paragraf", m.group(1), m.group(2)))
    for m in re.finditer(r"[Pp]říloh[ay]\s*č\.\s*(\d+)", source):
        out.append(("priloha", m.group(1), None))
    return out


def zkontroluj(path, bank_ids, bank_version, nalezy):
    data = nacti(path)
    jmeno = os.path.basename(path)

    if data.get("bankVersion") != bank_version:
        nalezy.append(
            "{}: klíč je psaný pro banku {!r}, ale banka je {!r}. Odpovědi se "
            "nesmějí zdědit automaticky.".format(jmeno, data.get("bankVersion"), bank_version)
        )

    videne = set()
    cache = {}
    overeno = navrh = sporne = 0

    for a in data.get("answers", []):
        qid = a.get("questionId")
        kde = "{} / {}".format(jmeno, qid)

        if qid in videne:
            nalezy.append("{}: dvě odpovědi na tutéž otázku.".format(kde))
        videne.add(qid)

        if qid not in bank_ids:
            nalezy.append("{}: otázka v bance neexistuje.".format(kde))
            continue

        options = a.get("options") or []
        ids = [o.get("id") for o in options]
        if len(ids) != len(set(ids)):
            nalezy.append("{}: duplicitní ID možností.".format(kde))
        if len(options) < 2:
            nalezy.append("{}: méně než dvě možnosti.".format(kde))

        correct = a.get("correctOptionId")
        if correct not in ids:
            nalezy.append(
                "{}: correctOptionId {!r} není mezi možnostmi.".format(kde, correct)
            )

        ocekavane = {i for i in ids if i != correct}
        skutecne = set((a.get("whyWrong") or {}).keys())
        if ocekavane != skutecne:
            nalezy.append(
                "{}: whyWrong nepokrývá nesprávné možnosti (chybí {}, navíc {}).".format(
                    kde, sorted(ocekavane - skutecne) or "nic", sorted(skutecne - ocekavane) or "nic"
                )
            )

        status = a.get("status")
        if status == "overeno":
            overeno += 1
        elif status == "navrh":
            navrh += 1
            if not a.get("missing"):
                nalezy.append(
                    "{}: stav 'navrh' bez pole 'missing' — musí být napsáno, "
                    "co konkrétně chybí doložit.".format(kde)
                )
        elif status == "sporne":
            sporne += 1
            if not a.get("dispute"):
                nalezy.append("{}: stav 'sporne' bez popisu rozporu.".format(kde))
        else:
            nalezy.append("{}: neznámý stav {!r}.".format(kde, status))

        if status != "overeno":
            continue

        # --- od sem jen ověřené odpovědi: ty se podle nich hodnotí test ---

        v = a.get("verification") or {}
        for pole in ("source", "method", "checkedAt", "checkedBy"):
            if not v.get(pole):
                nalezy.append(
                    "{}: stav 'overeno' bez verification.{}. Ověřená odpověď "
                    "musí říct, čím je ověřená.".format(kde, pole)
                )
        source = normalizuj(v.get("source") or "")
        if not source:
            continue

        if a.get("sourceClass") != "volny":
            # Placený podklad se strojově ověřit nedá, text normy tu není.
            continue

        cislo, text, mapa = najdi_text_predpisu(source, cache)
        if cislo is None:
            nalezy.append(
                "{}: zdroj {!r} neodkazuje na žádný ze stažených předpisů. "
                "Ověřená odpověď musí být doložitelná.".format(kde, source[:80])
            )
            continue
        if text is None:
            nalezy.append(
                "{}: zdroj odkazuje na předpis {}, ale jeho text není "
                "v predpisy/. Bez něj ověření nejde zkontrolovat.".format(kde, cislo)
            )
            continue

        # Citované ustanovení musí existovat **jako ustanovení**, ne jen jako
        # řetězec někde v textu. Zároveň si uložíme jeho znění — správná
        # odpověď se musí opírat právě o ně.
        kontext = []
        for druh, cis, odst in ustanoveni_v(source):
            telo = mapa.get((druh, cis)) if mapa else None
            if telo is None:
                nalezy.append(
                    "{}: zdroj cituje {} {}, které v předpisu {} jako ustanovení "
                    "není.".format(kde, "§" if druh == "paragraf" else "přílohu č.", cis, cislo)
                )
                continue
            if odst:
                m = re.search(r"\({}\)(.*?)(?=\(\d+\)|$)".format(re.escape(odst)), telo, re.S)
                if not m:
                    nalezy.append(
                        "{}: zdroj cituje § {} odst. {}, ale ten odstavec v § {} "
                        "předpisu {} není.".format(kde, cis, odst, cis, cislo)
                    )
                    continue
                kontext.append(m.group(1))
            else:
                kontext.append(telo)

        # Každý číselný údaj ve správné odpovědi musí být v textu předpisu.
        # Hledá se přednostně v citovaném ustanovení; celý předpis je záloha
        # pro odpovědi, které legitimně shrnují víc ustanovení najednou.
        uzky = normalizuj(" ".join(kontext)) if kontext else ""

        spravna = next((o for o in options if o.get("id") == correct), None)
        if spravna:
            for udaj, jednotka in cisla_v(spravna.get("text", "")):
                if jednotka is None and udaj in IGNOROVANA_CISLA:
                    continue
                varianty = set()
                for c in (udaj, udaj.replace(",", "."), udaj.replace(".", ",")):
                    if jednotka:
                        # Číslo i s jednotkou — „5 let", ne jen „5".
                        varianty.add("{} {}".format(c, jednotka).lower())
                        # Některé předpisy tiskne zdroj bez mezery („110kV 1m"
                        # v § 46 odst. 5 zákona č. 458/2000 Sb.). Je to typografie
                        # téže hodnoty, ne jiná hodnota: vymyšlené „7 m" tím
                        # neprojde, protože „7m" v tom ustanovení taky není.
                        varianty.add("{}{}".format(c, jednotka).lower())
                        # Skloňování: předpis může mít „5 letech" apod.
                        varianty.add("{} {}".format(c, jednotka[:-1]).lower()
                                     if len(jednotka) > 3 else "{} {}".format(c, jednotka).lower())
                    else:
                        varianty.add(c.lower())
                popis = "{} {}".format(udaj, jednotka) if jednotka else udaj
                v_ustanoveni = any(var in uzky.lower() for var in varianty)
                v_predpisu = any(var in text.lower() for var in varianty)
                if not v_predpisu:
                    nalezy.append(
                        "{}: údaj {!r} ve správné odpovědi není nikde v textu "
                        "předpisu {}. Ověř ho, nebo odpověď přeřaď na 'navrh'.".format(
                            kde, popis, cislo)
                    )
                elif uzky and not v_ustanoveni:
                    nalezy.append(
                        "{}: údaj {!r} v předpisu {} je, ale **ne v citovaném "
                        "ustanovení**. Buď je zdroj uvedený špatně, nebo je "
                        "hodnota vzatá odjinud.".format(kde, popis, cislo)
                    )

            # Odpoved se musi opirat o CITOVANE ustanoveni, ne jen o predpis.
            # Dvoustupnove hlaseni jako u cisel vyse: oboji je nalez, prochazi
            # jen odpoved ukotvena v citovanem ustanoveni.
            if uzky:
                p_uzky = prekryv(spravna.get("text", ""), uzky)
                if p_uzky is not None and p_uzky < PRAH_PREKRYVU:
                    p_siroky = prekryv(spravna.get("text", ""), text)
                    if p_siroky is not None and p_siroky >= PRAH_PREKRYVU:
                        nalezy.append(
                            "{}: slova správné odpovědi v předpisu {} jsou, ale "
                            "**ne v citovaném ustanovení** (překryv {:.2f} proti "
                            "{:.2f} v celém předpisu). Zdroj míří na jiné "
                            "ustanovení, než ze kterého odpověď je.".format(
                                kde, cislo, p_uzky, p_siroky)
                        )
                    else:
                        nalezy.append(
                            "{}: správná odpověď se slovy neopírá o citované "
                            "ustanovení předpisu {} (překryv {:.2f}, prahem je "
                            "{:.2f}). Ověř zdroj, nebo odpověď přeřaď na "
                            "'navrh'.".format(kde, cislo, p_uzky, PRAH_PREKRYVU)
                        )

    return overeno, navrh, sporne, len(videne)


def main():
    bank = nacti(QUESTIONS)
    bank_ids = {q["id"] for q in bank["questions"]}
    bank_version = bank["bankVersion"]

    soubory = sys.argv[1:]
    if not soubory:
        data_dir = os.path.join(ROOT, "src", "data")
        # Dílčí soubory `answers.part-*.json` jsou vstupem pro sloučení, ne
        # samostatná vrstva. Kdyby se počítaly taky, vyšlo by dvakrát tolik
        # odpovědí, než kolik jich aplikace vidí.
        soubory = [
            os.path.join(data_dir, n)
            for n in sorted(os.listdir(data_dir))
            if n.startswith("answers.") and n.endswith(".json")
            and not n.startswith("answers.part-")
        ]

    nalezy = []
    celkem = [0, 0, 0, 0]
    for path in soubory:
        if not os.path.exists(path):
            nalezy.append("Soubor {} neexistuje.".format(path))
            continue
        o, n, s, c = zkontroluj(path, bank_ids, bank_version, nalezy)
        print("{}: {} odpovědí — ověřeno {}, návrh {}, sporné {}".format(
            os.path.basename(path), c, o, n, s))
        for i, v in enumerate((o, n, s, c)):
            celkem[i] += v

    print("\nCelkem {} odpovědí z {} otázek v bance.".format(celkem[3], len(bank_ids)))
    print("  ověřeno {}  návrh {}  sporné {}".format(celkem[0], celkem[1], celkem[2]))

    if nalezy:
        print("\nNálezy ({}):".format(len(nalezy)))
        for n in nalezy:
            print("  - " + n)
        print("\nOvěřená odpověď, která neprojde touhle kontrolou, se nesmí "
              "dostat do testu. Oprav ji, nebo jí dej stav 'navrh'.")
        return 1

    print("\nKontrola prošla. Každá ověřená odpověď má doložitelný zdroj.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
