# Pokrytí banky odpověďmi

Banka `2027.1`, platnost od 2027-01-01. Vygenerováno skriptem `scripts/coverage_report.py`.

## Stav ověření po okruzích

| Okruh | Název | Otázek | Ověřeno | Návrh | Sporné | Bez odpovědi |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| ez1 | Obecný test | 90 | 44 | 0 | 0 | 46 |
| ez2 | Ochrana před úrazem elektrickým proudem | 100 | 0 | 0 | 0 | 100 |
| ez3 | Všeobecné požadavky na elektrická zařízení | 140 | 0 | 0 | 0 | 140 |
| ez4 | LPS v prostředí bez nebezpečí výbuchu | 100 | 2 | 0 | 0 | 98 |
| | **celkem** | **430** | **46** | **0** | **0** | **384** |

## Lze spustit zkoušku nanečisto?

Předvolba chce 15 ověřených otázek z každého okruhu, tedy 60 celkem.

- `ez1`: ověřeno 44 z 15 — ano
- `ez2`: ověřeno 0 z 15 — chybí 15
- `ez3`: ověřeno 0 z 15 — chybí 15
- `ez4`: ověřeno 2 z 15 — chybí 13

**Nelze.** Chybí 43 ověřených otázek. Chybějící se nenahrazují jiným okruhem ani duplicitami; aplikace plnou předvolbu nespustí a nabídne kratší procvičování.

## Čím se dá odpověď vůbec ověřit

| Okruh | Z právních předpisů | Z norem ČSN |
| --- | ---: | ---: |
| ez1 | 90 | 0 |
| ez2 | 0 | 100 |
| ez3 | 1 | 139 |
| ez4 | 2 | 98 |
| **celkem** | **93** | **337** |

Právní předpisy jsou volně dostupné, takže odpovědi k nim lze ověřit a zveřejnit.
Normy ČSN jsou placené. Odpověď odvozená z placeného podkladu zůstává v lokální
vrstvě `src/data/answers.2027.local.json`, která není v gitu ani ve veřejném nasazení.

## Co konkrétně chybí doložit

### Právní předpisy — volně ověřitelné (47 otázek)

Nejčastější chybějící podklady:

- NV č. 194/2022 Sb., § 7, odst. 1 — 2 otázek
- zákon č. 22/1997 Sb., § 5, odst. 1 — 2 otázek
- Příloha č. 1 k zákonu č. 455/1991 Sb. — 1 otázek
- Příloha č. 1 k zákonu č. 455/1991 Sb. a Příloha č. 1 k nařízení vlády č. 278/2008 Sb. — 1 otázek
- §5, odst. 1, zákona č. 89/2012 Sb. — 1 otázek
- § 102 zákona č. 262/2006 Sb. — 1 otázek
- § 349, odst. 1, zákona č. 262/2006 Sb. — 1 otázek
- Zákon č. 309/2006 Sb. — 1 otázek
- Zákon č. 309/2006 Sb., § 4, odst. 1, písm. c — 1 otázek
- NV č. 378/2001 Sb., § 1 — 1 otázek
- NV č. 378/2001 Sb., § 4, odst. 2 — 1 otázek
- NV č. 378/2001 Sb., § 2, písm. g — 1 otázek
- NV č. 378/2001 Sb., § 4, odst. 1 — 1 otázek
- NV č. 194/2022 Sb., § 2 a 3 — 1 otázek
- NV č. 194/2022 Sb., § 1, písm. a — 1 otázek
- …a dalších 30 různých odkazů

### Normy ČSN — potřeba přístup k normě (337 otázek)

Nejčastější chybějící podklady:

- ČSN 33 2000-4-41 ed. 3:2018 čl. 411.3.3 — 4 otázek
- ČSN 33 2000-4-41 ed. 3:2018 čl. 410.3.2. — 3 otázek
- ČSN 33 2000-4-41 ed. 3:2018 čl. 411.3.2. — 3 otázek
- ČSN 33 2000-4-41 ed. 3:2018 čl. 411.4.5 — 3 otázek
- ČSN 33 2000-4-41 ed. 3:2018 čl. 410.3.3. — 2 otázek
- ČSN 33 2000-4-41 ed. 3:2018 čl. 410.3.5 — 2 otázek
- ČSN 33 2000-4-41 ed. 3:2018 čl. 410.3.6 — 2 otázek
- ČSN 33 2000-4-41 ed. 3:2018 čl. 410.3.7 — 2 otázek
- ČSN 33 2000-5-53 ed. 3: 2022 čl. 531.3.5. — 2 otázek
- ČSN 33 2000-4-41 ed. 3:2018 příloha B čl. B.3.2 — 2 otázek
- ČSN EN 61140 ed. 3:2016 čl. 4.3.1 — 2 otázek
- ČSN 33 2000-5-54 ed. 3:2012 čl. NA.10.3.2 — 2 otázek
- ČSN 33 2000-1 ed. 2:2009 čl. 312.2 — 2 otázek
- ČSN 33 2000-7-710 ed.2: 2026 čl. 710.415.2. — 2 otázek
- ČSN 34 0350 ed. 2:2009 čl. 5.3.2 — 2 otázek
- …a dalších 294 různých odkazů

## Edice norem, na které sada 2027 odkazuje

Edice je u odpovědi rozhodující: starší edice téže normy může mít jinou
hodnotu i jinou strukturu článků. Následující přehled plyne přímo
z normativních odkazů v oficiální bance.

| Okruh | bez uvedené edice | ed. 2 | ed. 3 | ed. 4 | ed. 6 |
| --- | ---: | ---: | ---: | ---: | ---: |
| ez1 | 90 | 0 | 0 | 0 | 0 |
| ez2 | 0 | 0 | 100 | 0 | 0 |
| ez3 | 20 | 49 | 50 | 18 | 3 |
| ez4 | 2 | 1 | 97 | 0 | 0 |

U okruhu `ez4` (LPS) stojí za zvláštní pozornost řada ČSN EN IEC 62305.
- 62305-3 ed. 3 2025 — 45 otázek
- 62305-1 ed. 3 2024 — 18 otázek
- 62305-4 ed. 3 2026 — 17 otázek
- 62305-2 ed. 3 2025 — 8 otázek
- 62305-3 ed. 3 — 6 otázek
- 62305-3 ed. 2 2012 — 1 otázek

## Lokální vrstva

Žádná lokální vrstva. Všechny odpovědi v přehledu jsou zveřejnitelné.
