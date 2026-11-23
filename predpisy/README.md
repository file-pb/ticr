# Doslovné texty právních předpisů

Primární zdroj, proti kterému `scripts/check_answers.py` ověřuje každou
odpověď se stavem `overeno`. Kontrola hledá citované ustanovení **jako
ustanovení**, ne jako řetězec kdekoli v textu, a ověřuje, že každá číselná
hodnota z odpovědi stojí uvnitř toho ustanovení. Bez těchto souborů kontrola
neprojde — záměrně. Nemá mlčky přeskočit odpověď, kterou nemá čím doložit.

| Soubor | Předpis | Stav textu | Stažen |
| --- | --- | --- | --- |
| `zakon-250-2021.txt` | zákon č. 250/2021 Sb., o bezpečnosti práce v souvislosti s provozem vyhrazených technických zařízení | ve znění k datu stažení | 23. 11. 2026 |
| `nv-190-2022.txt` | nařízení vlády č. 190/2022 Sb., o vyhrazených technických elektrických zařízeních a požadavcích na zajištění jejich bezpečnosti | znění od 1. 7. 2024 | 23. 11. 2026 |

Zdroj: zakonyprolidi.cz. Hlavička každého souboru nese adresu a datum.

## Proč jsou v repozitáři

**Právní předpis je úřední dílo** podle § 3 písm. a) zákona č. 121/2000 Sb.
a autorskoprávní ochrana se na něj nevztahuje. Text se tedy smí šířit a je
správné, aby tu byl: kontrola klíče má být spustitelná a přezkoumatelná
kýmkoli, ne jen na stroji, kde texty náhodou leží.

Tím se liší od norem ČSN, které jsou placené a v repozitáři nejsou ani být
nemohou. Odpovědi odvozené z nich zůstávají v lokální vrstvě
`src/data/answers.*.local.json` mimo git — viz `docs/OBSAH-A-LICENCE.md`.

## Pozor na znění

Tohle je text **k datu stažení**, ne živý zdroj. Novela předpisu ho tiše
neaktualizuje a kontrola to sama nepozná — projde dál proti starému znění.
Když se předpis změní, je nutné text stáhnout znovu a odpovědi, kterých se
změna týká, převést zpět na `navrh`.
