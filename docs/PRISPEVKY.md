# Jak se přidává odpověď

Klíč roste po jedné otázce. Pravidlo je jediné a nejde ho obejít: **odpověď
smí dostat stav `overeno` jen tehdy, když jsi doopravdy přečetl primární
zdroj a napsal, který to byl.**

## Kde se edituje

`src/data/answers.2027.json` — veřejná vrstva, odpovědi z volně dostupných
zdrojů (zákony, nařízení vlády).

`src/data/answers.2027.local.json` — lokální vrstva, odpovědi z norem ČSN
a z placených školicích materiálů. Mimo git. Stejný formát.

Lokální vrstva přepisuje veřejnou podle `questionId`.

## Formát jednoho záznamu

```jsonc
{
  "questionId": "2027-ez1-034",
  "options": [
    { "id": "a1", "text": "…" },
    { "id": "a2", "text": "…" },
    { "id": "a3", "text": "…" }
  ],
  "correctOptionId": "a2",
  "explanation": "Proč je správná.",
  "whyWrong": { "a1": "Proč ne.", "a3": "Proč ne." },
  "status": "overeno",
  "sourceClass": "volny",
  "verification": {
    "source": "NV č. 190/2022 Sb., § 6 odst. 2 a 6 — e-Sbírka, čteno 23. 11. 2026",
    "method": "primární text předpisu",
    "checkedAt": "2026-11-23",
    "checkedBy": "jméno nebo 'agent'"
  }
}
```

ID možností jsou stabilní. Správnost se váže na ně, nikdy na písmeno ani
pozici — možnosti se při každém spuštění míchají.

## Stavy

| `status` | Kdy | Hodnotí se v testu |
|---|---|---|
| `overeno` | porovnáno s primárním zdrojem, který je uvedený ve `verification` | **ano** |
| `navrh` | učební návrh, nikdo ho proti zdroji neověřil | ne |
| `sporne` | nalezen rozpor se zněním otázky nebo s edicí normy, popsaný ve `dispute` | ne |

Odpověď bez `verification` nesmí mít `status: "overeno"`. Odpověď, kterou
nemáš čím ověřit, nech jako `navrh` a do `missing` napiš **konkrétně**, co je
potřeba doložit — ne „chybí norma", ale „ČSN EN IEC 62305-3 ed. 3 čl. 5.3.2".

`checkedBy` nikdy netvrdí kontrolu člověkem, která neproběhla.

## Co se nepřebírá

- Odpovědi z cizích placených produktů. Důvod je v [OBSAH-A-LICENCE.md](OBSAH-A-LICENCE.md).
- Doslovný text norem ČSN. Odkazuj článkem, necituj odstavce.
- Odpovědi ze starší sady otázek (platné do 31. 12. 2026) bez porovnání.
  Stejné číslo otázky ani podobný text nestačí; shodovat se musí i podmínky
  otázky, hodnoty a **edice normy**. U LPS zvlášť: sada 2027 cituje
  `ČSN EN IEC 62305-1 ed. 3: 2024` i `ČSN EN 62305-4 ed. 3: 2026`.

Při rozporu se zněním nové otázky starou odpověď **nepřebírej**. Zapiš ji jako
`sporne` s popisem rozdílu. Zastaralý text nesmí přepsat novou otázku ani
její odkaz na normu.

## Školicí materiály

Pokud odpověď vychází z materiálu ze školení, uveď ho ve `trainingMaterial`:

```jsonc
"trainingMaterial": {
  "name": "Elektrosvaz, RT online",
  "version": "nezjisteno",
  "locator": "snímek 42",
  "currency": "neposouzeno",
  "note": "Porovnat s ed. 3: 2024, materiál může být k ed. 2."
}
```

`currency` je samostatný údaj od `status`. Že materiál existuje, ještě
neznamená, že je aktuální, a ani nové datum školení samo o sobě správnost
nezaručuje.

## Než pošleš změnu

```bash
npm test                              # 35 testů, včetně kontrol nad skutečnou bankou
python3 -I scripts/coverage_report.py # přepočítá docs/COVERAGE.md
```

Přehled pokrytí patří do stejné změny jako odpovědi — jinak README tvrdí něco
jiného než data.
