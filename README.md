# ticr — příprava na písemnou část zkoušky E2A a LPS

Procvičování písemné části zkoušky revizního technika elektrických zařízení
v rozsahu **E2A včetně LPS v prostředí bez nebezpečí výbuchu**, postavené na
oficiální sadě otázek TIČR **platné od 1. 1. 2027**.

Statický web. Žádný účet, žádný server, žádné předplatné. Pokrok zůstává
v prohlížeči a dá se vyexportovat do souboru.

## Stav, bez okrašlování

| Co | Stav |
|---|---|
| Banka otázek | **430 otázek naimportováno** z oficiálního ZIPu — ez1 90, ez2 100, ez3 140, ez4 100. Počty, číslování i duplicity ověřené. |
| Studijní režim | **funguje** — znění otázky, normativní odkaz, hledání podle textu, čísla i normy |
| Zkouška nanečisto | implementovaná, ale **nelze ji spustit** — chybí ověřené odpovědi |
| Procvičování | implementované, běží podle toho, kolik je odpovědí |
| Ověřených odpovědí | **0 ze 430** |

Oficiální dokumenty TIČR obsahují znění otázek a odkazy na předpisy. **Klíč
správných odpovědí ani možnosti A/B/C nezveřejňují.** Proto je klíč samostatný
soubor, který se plní po jedné otázce, a proto se podle neověřené odpovědi
nehodnotí test. Aktuální přehled: [docs/COVERAGE.md](docs/COVERAGE.md).

Čím se dá odpověď vůbec ověřit:

- **93 otázek** odkazuje na právní předpisy — volně dostupné, ověřitelné
- **337 otázek** odkazuje na normy ČSN — placené, bez přístupu k normě to nejde

## Rozjezd

```bash
npm install
npm run dev
```

Import banky ze zdroje (vyžaduje macOS kvůli `textutil`, viz *Známá omezení*):

```bash
scripts/fetch_source.sh && python3 -I scripts/import_ticr.py
```

`fetch_source.sh` bere i ručně dodaný ZIP: `scripts/fetch_source.sh ~/Downloads/otazky.zip`.

Trenažér sítí po změně obsahu (seznam otázek k druhům sítí se generuje):

```bash
python3 -I scripts/build_site_topics.py && python3 -I scripts/check_site.py
```

Průvodce zprávou po novelizaci předpisu:

```bash
python3 -I scripts/build_zprava.py && python3 -I scripts/check_zprava.py
```

Mapa norem po přeimportování banky:

```bash
python3 -I scripts/build_normy.py && python3 -I scripts/check_normy.py
```

Přehled pokrytí po změně odpovědí:

```bash
python3 -I scripts/coverage_report.py
```

Testy:

```bash
npm test
```

## Jak je to postavené

```
src/data/questions.2027.json   banka — generuje import, ručně se needituje
src/data/site.json             trenažér sítí — vlastní učební text, neověřený
src/data/site-otazky.json      které otázky z banky se ptají na který druh sítě
src/data/normy-skupiny.json    mapa norem — skupiny a popisky, vlastní text
src/data/normy.json            mapa norem — inventura spočítaná z banky
src/data/zprava-citace.json    průvodce zprávou — doslovné citace z NV 190/2022
src/data/zprava.json           průvodce zprávou — fáze a poznámky, vlastní text
src/data/answers.2027.json     klíč, veřejná vrstva (volně ověřitelné zdroje)
src/data/answers.*.local.json  klíč, lokální vrstva (placené podklady), mimo git
predpisy/                      doslovné texty předpisů — proti nim se klíč ověřuje
src/domain/                    výběr otázek, hodnocení, čas, opakování — bez UI
src/storage/                   IndexedDB a přenos pokroku
src/ui/                        obrazovky
scripts/                       import ze zdroje a přehled pokrytí
deploy/                        Dockerfile, nginx, compose
```

Otázky a odpovědi jsou **dva oddělené soubory** spojené stabilním ID
(`2027-ez4-013`). Přeimportování banky tak nepřepíše odvedenou práci na
odpovědích; když se změní verze banky, aplikace to nahlásí a odpovědi se
nepřeberou automaticky.

Rozhodnutí, která stojí za vysvětlení:

- **Čas se počítá z uloženého okamžiku konce**, ne z odpočtu v paměti. Refresh
  ani uspání záložky v Safari ho neresetuje.
- **Správnost je vázaná na ID možnosti**, ne na písmeno ani pozici — možnosti
  se míchají při každém spuštění.
- **„Tipoval jsem" je samostatný příznak.** Náhodně správná odpověď neposune
  otázku v opakování.
- **Zkouška losuje výhradně z ověřených odpovědí.** Když v okruhu není 15
  takových otázek, předvolba se nespustí a ukáže, co kde chybí. Nedolévá se
  z jiného okruhu ani duplicitami.
- **Doslovná duplicita znění se losuje jen jednou.** Oficiální dokument TIČR
  má v okruhu ez2 tutéž otázku dvakrát — čísla 22 a 23, shodné znění i shodný
  odkaz (ČSN 33 2000-4-41 ed. 3:2018 čl. 411.3.3). V bance zůstávají obě, aby
  banka odpovídala zdroji; ve studijním režimu je proto vidět obě. Losování
  bere jen tu s nižším číslem. Rozhoduje **přesná shoda** znění — dvojice,
  které se liší jediným slovem (ez2 78/79 SELV proti PELV, 95/96 „nesmí“
  proti „může“), jsou dvě různé otázky a zůstávají obě.

## Pomůcky mimo zkouškovou banku

**Trenažér druhů sítí** — rozpoznávání TN-C, TN-S, TN-C-S, TT a IT ze schématu.
Schémata se kreslí z popisu v `src/data/site.json`, takže obrázek nemůže
zestárnout odděleně od textu. Ke každému druhu je seznam otázek z banky, které
ho jmenují; generuje ho `scripts/build_site_topics.py` podle kódu ve znění
otázky a `scripts/check_site.py` hlídá, že je seznam aktuální.

**Mapa předpisů a norem** — na které předpisy sada otázek odkazuje a jakou vahou.
Banka má 430 otázek a 432 odkazů na 76 předpisů (57 norem ČSN, 19 právních);
prvních pět nese 45 % všech odkazů. Mapa je ve třech vrstvách — právní
předpisy, kmenová řada ČSN 33 2000 po částech, normy pro konkrétní oblasti —
a z každého předpisu se dá projít na otázky, které ho citují.

Dvě věci, které z té inventury vypadly a stojí za pozornost:

- **ČSN EN IEC 62305-3** je citovaná v obou edicích. Padesát jedna otázek míří
  na ed. 3:2025, jedna jediná (`2027-ez4-060`) na **ed. 2:2012**. Odpovědět na ni
  podle novější edice je chyba, kterou nic nenapoví.
- **Dva předpisy píše TIČR nejednotně** — 62305-3 jako „ČSN EN" i „ČSN EN IEC",
  61140 jako „ČSN" i „ČSN EN". Inventura je spojuje podle čísla, aby se jedna
  norma nerozpadla na dvě položky.

Počty, označení, edice a zařazení otázek pocházejí z banky a přepočítá je
skript. **Popisky skupin a norem jsou vlastní text, neověřený proti katalogu
ČAS** — norma, u které si popiskem nejsem jistý, žádný nemá.
`scripts/check_normy.py` hlídá, že je inventura aktuální, že žádná položka
nepropadla bez zařazení, že rozpad po edicích nikam neztratil otázku a že
popisek neuvádí číselnou hodnotu.

**Průvodce revizní zprávou** — co musí být uděláno a co musí být ve zprávě.
Jediná pomůcka, která **není** návrh: všech 91 vět je doslovný text nařízení
vlády č. 190/2022 Sb. a `scripts/check_zprava.py` ověřuje, že každá z nich
v `predpisy/nv-190-2022.txt` doslova stojí. Vlastní je jen rozdělení do fází
a šest poznámek, označených v rozhraní jako moje.

Pokrývá podklady (příloha č. 2 část A), náplň revize (část B), prohlídku
(příloha č. 1 část A), zkoušku a měření v předepsaném pořadí (část B),
patnáct náležitostí zprávy od a) po o) (§ 10 odst. 1) a lhůty pravidelných
revizí (příloha č. 4). Body se dají odškrtávat; stav zůstává v prohlížeči
a je to pomůcka při učení, ne záznam o provedené revizi.

Co v něm **není**: vzor ani formulář, náležitosti navíc podle ČSN 33 1500
a ČSN 33 2000-6 (placené normy), postupy měření a mezní hodnoty.

V menu i na rozcestníku stojí pomůcky **odděleně od zkouškové části** a platí
pro ně jiná pravidla:

- Je to **vlastní učební text aplikace, neověřený proti normě.** Nejsou to
  definice převzaté z ČSN 33 2000-1 ed. 2 ani z ČSN 33 2000-4-41 ed. 3; obě
  normy jsou placené a bez přístupu k nim zůstává text návrhem.
- **Neuvádí žádnou číselnou hodnotu.** Doby odpojení, dovolená dotyková napětí
  a nejmenší průřezy jsou přesně ty údaje, které se bez normy vymýšlet nesmí.
  Trenažér učí uspořádání vodičů a uzemnění. `scripts/check_site.py` číslo
  s jednotkou v učebním textu odmítne.
- **Nehodnotí se jím zkouška a nezapisuje se do pokroku.** Výsledek kvízu
  nikam neodchází, do pokrytí banky se nepočítá a opakování podle pokroku se
  o něj neopírá.

## Obsah, licence a cizí práce

Tři vrstvy s různými vlastníky, podrobně v
[docs/OBSAH-A-LICENCE.md](docs/OBSAH-A-LICENCE.md):

| Vrstva | Vlastník | Licence |
|---|---|---|
| znění otázek | TIČR | jejich, uvedené s původem a kontrolním součtem |
| možnosti, vysvětlení, klíč | tento projekt | CC BY-SA 4.0 |
| kód aplikace | tento projekt | MIT |

Do projektu **se nepřebírají** odpovědi z cizích placených produktů ani
doslovný text norem. Odpovědi odvozené z placených podkladů (normy ČSN,
materiály ze zaplaceného školení) zůstávají v lokální vrstvě a nikam
neodcházejí. Jak se odpověď přidává: [docs/PRISPEVKY.md](docs/PRISPEVKY.md).

## Nasazení

Statický obraz za Traefikem, bez databáze. Doména je v proměnné `DOMENA`, ne
natvrdo v kódu — aplikace se dá předat jinému správci bez zásahu do
repozitáře. Postup a předávací stav: [docs/PREDANI.md](docs/PREDANI.md).

```bash
DOMENA=example.cz GHCR_OWNER=owner docker compose -f deploy/docker-compose.yml up -d
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/health
```

## Známá omezení

- **Import je vázaný na macOS.** Starší formát Wordu `.doc` převádí `textutil`.
  Přenositelná varianta (LibreOffice nebo `antiword` v kontejneru) je vědomý
  dluh — import se pouští při přípravě obsahu, ne v provozu. **Má to ale
  následek v CI:** krok „Import je reprodukovatelný" na ubuntu skončí u
  převodu a nic neověří. Reprodukovatelnost se zatím ověřuje ručně na macOS
  (naposledy 23. 11. 2026 — banka vyšla bajt po bajtu stejná). Konvertor
  nejde vyměnit bez porovnání banky bajt po bajtu: jiný nástroj zalomí text
  jinak a vyrobí jinou banku.
- **Parametry zkoušky nejsou doložené dokumentem TIČR.** Hranici 80 % uvádí
  TIČR ve zveřejněných informacích. Skladbu — pro rozsah E2A čtyři testy po
  patnácti otázkách, 20 minut na test, tedy 60 otázek a 80 minut — uvádějí
  shodně dva komerční provozovatelé příprav a tři nezávislé zdroje ze školení.
  Pořád je to druhotné, takže v aplikaci běží jako tréninkové nastavení a jde
  je změnit.
- **Hranice 80 % se počítá z celých 60 otázek, ne po okruzích.** Dokud to nebylo
  doložené, aplikace to tak dělala jako odhad. Záznam prvního dne kurzu ESČ
  z 23. 11. 2026 to říká výslovně: „Vyhodnocuje to až na závěr všech těch 60
  otázek… K úspěšnému složení zkoušky musíte mít 80 % správných odpovědí."
  Mezi testy zkouška výsledek nezobrazí. Je to druhotný zdroj (přednášející,
  který zkoušku sám skládal), ne dokument TIČR.
- **Zkouška běží jako čtyři samostatné testy a aplikace od 24. 11. 2026 taky.**
  Každý test má svých 20 minut, čas se mezi testy nepřenáší — kdo prošvihne
  prvních 20 minut, o ně přijde. Pořadí testů si volí zkoušený, stisk
  „Vyhodnotit" test nevratně uzavře a výsledek se neukáže dřív než po čtvrtém
  testu; hranice 80 % se pak počítá z celých 60 otázek. Dřív aplikace losovala
  jeden blok 60 otázek na 80 minut, což bylo mírnější.
  - Jediný vědomý rozdíl, který zbyl: z běžícího testu se dá odejít do
    rozcestníku aplikace, zatímco u zkoušky se z testu odejít nedá. Čas mu i tak
    běží dál, protože se počítá z uloženého okamžiku konce — zavřená záložka ani
    obnovení stránky ho nezastaví a vypršelý test se po návratu uzavře sám.
  - Nedokončenou zkoušku lze uzavřít i bez napsání všech testů. Nenapsané
    otázky se počítají jako nesprávné, stejně jako to, co zkoušený neodpoví.
- **Ústní část zkoušky aplikace neprocvičuje** a nic o ní netvrdí.
