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
  shodně dva komerční provozovatelé příprav a dva nezávislé zdroje ze školení.
  Pořád je to druhotné, takže v aplikaci běží jako tréninkové nastavení a jde
  je změnit.
- **Zkouška běží jako čtyři samostatné testy, aplikace jako jeden blok.**
  Na zkoušce se čas nedá přenášet mezi okruhy; kdo prošvihne prvních 20 minut,
  o ně přijde. Aplikace losuje 60 otázek na 80 minut dohromady, což je
  mírnější. Rozdělení na čtyři bloky zatím není implementované.
- **Ústní část zkoušky aplikace neprocvičuje** a nic o ní netvrdí.
