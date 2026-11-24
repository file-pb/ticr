# Pokrytí banky odpověďmi

Banka `2027.1`, platnost od 2027-01-01. Vygenerováno skriptem `scripts/coverage_report.py`.

## Stav ověření po okruzích

| Okruh | Název | Otázek | Ověřeno | Návrh | Sporné | Bez odpovědi |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| ez1 | Obecný test | 90 | 88 | 2 | 0 | 0 |
| ez2 | Ochrana před úrazem elektrickým proudem | 100 | 0 | 0 | 0 | 100 |
| ez3 | Všeobecné požadavky na elektrická zařízení | 140 | 0 | 0 | 0 | 140 |
| ez4 | LPS v prostředí bez nebezpečí výbuchu | 100 | 2 | 0 | 0 | 98 |
| | **celkem** | **430** | **90** | **2** | **0** | **338** |

## Lze spustit zkoušku nanečisto?

Předvolba chce 15 ověřených otázek z každého okruhu, tedy 60 celkem.

- `ez1`: ověřeno 88 z 15 — ano
- `ez2`: ověřeno 0 z 15 — chybí 15
- `ez3`: ověřeno 0 z 15 — chybí 15
- `ez4`: ověřeno 2 z 15 — chybí 13

Započítáno bez doslovných duplicit znění: v bance jich je 1 (oficiální dokument má tutéž otázku dvakrát). Losování je sloučí, takže jedna ověřená odpověď z dvojice přidá jen jednu použitelnou otázku.

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

### Právní předpisy — volně ověřitelné (1 otázek)

Nejčastější chybějící podklady:

- Nařízení vlády č. 117/2016 Sb. § 2 v platném znění — 1 otázek

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

Na tomhle stroji je 33 odpovědí v lokální vrstvě. Do veřejného nasazení nepatří.
