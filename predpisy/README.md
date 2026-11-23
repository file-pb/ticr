# Doslovné texty právních předpisů

Primární zdroj, proti kterému `scripts/check_answers.py` ověřuje každou
odpověď se stavem `overeno`. Kontrola hledá citované ustanovení **jako
ustanovení**, ne jako řetězec kdekoli v textu, a ověřuje, že každá číselná
hodnota z odpovědi stojí uvnitř toho ustanovení. Bez těchto souborů kontrola
neprojde — záměrně. Nemá mlčky přeskočit odpověď, kterou nemá čím doložit.

| Soubor | Předpis | Stav textu | Stažen |
| --- | --- | --- | --- |
| `zakon-250-2021.txt` | zákon č. 250/2021 Sb., o bezpečnosti práce v souvislosti s provozem vyhrazených technických zařízení | ve znění k datu stažení | 23. 11. 2026 |
| `nv-190-2022.txt` | nařízení vlády č. 190/2022 Sb., o vyhrazených technických elektrických zařízeních a požadavcích na zajištění jejich bezpečnosti | ve znění k datu stažení | 23. 11. 2026 |
| `nv-194-2022.txt` | nařízení vlády č. 194/2022 Sb., o požadavcích na odbornou způsobilost k výkonu činnosti na elektrických zařízeních a na odbornou způsobilost v elektrotechnice | ve znění k datu stažení | 23. 11. 2026 |
| `zakon-22-1997.txt` | zákon č. 22/1997 Sb., o technických požadavcích na výrobky | ve znění k datu stažení | 23. 11. 2026 |
| `zakon-90-2016.txt` | zákon č. 90/2016 Sb., o posuzování shody stanovených výrobků při jejich dodávání na trh | ve znění k datu stažení | 23. 11. 2026 |
| `nv-117-2016.txt` | nařízení vlády č. 117/2016 Sb., o posuzování shody výrobků z hlediska elektromagnetické kompatibility | ve znění k datu stažení | 23. 11. 2026 |
| `zakon-262-2006.txt` | zákon č. 262/2006 Sb., zákoník práce | ve znění k datu stažení | 23. 11. 2026 |
| `zakon-309-2006.txt` | zákon č. 309/2006 Sb., o zajištění dalších podmínek bezpečnosti a ochrany zdraví při práci | ve znění k datu stažení | 23. 11. 2026 |
| `nv-378-2001.txt` | nařízení vlády č. 378/2001 Sb., kterým se stanoví bližší požadavky na bezpečný provoz a používání strojů, technických zařízení, přístrojů a nářadí | ve znění k datu stažení | 23. 11. 2026 |
| `zakon-251-2005.txt` | zákon č. 251/2005 Sb., o inspekci práce | ve znění k datu stažení | 23. 11. 2026 |
| `zakon-455-1991.txt` | zákon č. 455/1991 Sb., živnostenský zákon | ve znění k datu stažení | 23. 11. 2026 |
| `nv-278-2008.txt` | nařízení vlády č. 278/2008 Sb., o obsahových náplních jednotlivých živností | ve znění k datu stažení | 23. 11. 2026 |
| `zakon-458-2000.txt` | zákon č. 458/2000 Sb., energetický zákon | ve znění k datu stažení | 23. 11. 2026 |
| `zakon-505-1990.txt` | zákon č. 505/1990 Sb., o metrologii | ve znění k datu stažení | 23. 11. 2026 |
| `vyhlaska-345-2002.txt` | vyhláška č. 345/2002 Sb., kterou se stanoví měřidla k povinnému ověřování a měřidla podléhající schválení typu | ve znění k datu stažení | 23. 11. 2026 |
| `zakon-283-2021.txt` | zákon č. 283/2021 Sb., stavební zákon | ve znění k datu stažení | 23. 11. 2026 |
| `vyhlaska-146-2024.txt` | vyhláška č. 146/2024 Sb., o požadavcích na výstavbu | ve znění k datu stažení | 23. 11. 2026 |
| `nv-366-2013.txt` | nařízení vlády č. 366/2013 Sb., o úpravě některých záležitostí souvisejících s bytovým spoluvlastnictvím | ve znění k datu stažení | 23. 11. 2026 |
| `zakon-89-2012.txt` | zákon č. 89/2012 Sb., občanský zákoník | ve znění k datu stažení | 23. 11. 2026 |

Zdroj: zakonyprolidi.cz. Hlavička každého souboru nese adresu konkrétního
předpisu a datum stažení. Převod HTML na text dělá `textutil` (macOS), proto
v souborech zůstává i navigace a reklama portálu — text předpisu se tím
nemění a kontrola si v něm ustanovení najde.

Každý soubor musí být zároveň v mapě `PREDPIS_SOUBORY` ve
`scripts/check_answers.py`, jinak kontrola jeho text nenajde a odpověď,
která se na předpis odvolává, neprojde. Na pořadí v mapě záleží: odpověď
citující dva předpisy se ověří proti tomu, který je v mapě dřív, takže
prováděcí předpis stojí za tím, který provádí (278/2008 za 455/1991,
345/2002 za 505/1990).

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
