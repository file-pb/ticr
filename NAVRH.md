# ticr — příprava na zkoušku E2A a LPS (sada od 1. 1. 2027)

Návrh projektu do hračkárny. Stav: **před implementací**, čeká na rozhodnutí
v oddílu *Co potřebuju rozhodnout*.

---

## 1. Co už je ověřené, ne předpokládané

Datovou část jsem udělal dřív, než přišel pokyn napřed navrhnout. Nechávám ji,
protože bez ní je celý zbytek návrhu jen dohad o tom, co v té sadě vlastně je.

Archiv stažen z `https://www.ticr.eu/soubor/ez-testove-otazky-od-2027-01-01-zip/`
(HTTP 200, 125 215 B):

```
sha256(zip) = 8306d131b41c9fe58a3407017d34b468c6b04a59518265b588f75ffdbad32808
```

Obsahuje 7 souborů `.doc`. Pro E2A včetně LPS bez nebezpečí výbuchu jsou
relevantní první čtyři; ez5–ez7 se vědomě nezpracovávají.

| Okruh | Soubor | Naimportováno | Očekáváno dle zadání |
|---|---|---|---|
| ez1 | obecný test | 90 | 90 |
| ez2 | ochrana před úrazem el. proudem | 100 | 100 |
| ez3 | všeobecné požadavky na EZ | 140 | 140 |
| ez4 | LPS bez nebezpečí výbuchu | 100 | 100 |
| | **celkem** | **430** | **430** |

Počty souhlasí, žádná otázka nechybí ani není dvakrát, **každá ze 430 otázek má
normativní odkaz**. Dvě pasti ze zadání jsou ověřené konkrétně:

- ez1 otázka 34 má ve zdroji značku `34/`, ne `34)`. Parser bere obě značky, otázka je v bance.
- ez4 **není číslovaný celý**: prvních 12 otázek je bez značky, číslování jde od 13 do 100.
  To zadání nezmiňovalo. Importér je skládá podle střídání řádku otázky a řádku
  s odkazem na normu, takže všech 100 projde.

Dál byla potřeba úklidu po konverzi z Wordu: polí `HYPERLINK "…"` vložených
doprostřed věty, pevných mezer a víceřádkových otázek (ez4/96). Po importu
v datech nezůstal ani jeden zbytek `HYPERLINK`.

Reprodukovatelný postup, dva kroky:

```
scripts/fetch_source.sh [volitelně ručně dodaný ZIP]   # stáhne, rozbalí, .doc -> UTF-8 text
python3 -I scripts/import_ticr.py                      # -> src/data/questions.2027.json + docs/IMPORT_REPORT.md
```

Importér počty **nedorovnává** — když se sada u TIČR změní, nahlásí odchylku
a skončí nenulovým kódem.

---

## 2. Omezení, které určuje celý zbytek návrhu

Zveřejněné dokumenty TIČR obsahují **znění otázky a odkaz na předpis nebo
článek normy. Nic víc.** Žádné možnosti A/B/C, žádný klíč správných odpovědí.
Tohle zadání předpokládalo a je to potvrzené.

Rozdělil jsem proto všech 430 otázek podle toho, čím se dá odpověď vůbec ověřit:

| Typ zdroje | Otázek | Dostupnost |
|---|---|---|
| právní předpis (zákon, NV) | **93** | volně — e-Sbírka, Zákony pro lidi |
| norma ČSN / ČSN EN IEC | **337** | placené, nemám k nim přístup |

Po okruzích: ez1 je celý z právních předpisů (90), ez2 celý z norem (100),
ez3 139 norem + 1 předpis, ez4 98 norem + 2 předpisy.

Nejcitovanější předpisy: NV 190/2022 (24 otázek), zákon 250/2021 (22),
NV 194/2022 (10), zákon 22/1997 (9) — čtyři předpisy pokrývají 65 z těch 93.

**Co z toho plyne pro zkoušku nanečisto:** předvolba „60 otázek, 15 z každého
okruhu" dnes poctivě postavit nejde a nepůjde, dokud nebude čím ověřit odpovědi
u ez2, ez3 a ez4. Žádná dávka práce na mé straně to neobejde — chybí vstup, ne
čas. Aplikace to proto bude umět **odmítnout a říct, co schází**, místo aby
dolila vymyšlené odpovědi. Procvičování ez1 se rozjet dá hned.

---

## 3. Umístění v hračkárně

**Nový projekt `ticr` na `ticr.klihovka.cz`.** Statický web, bez databáze —
tedy přesně druhý případ po `filip` (9. 10. 2026), ne `http-service`
ze šablony.

Proč statika a ne .NET šablona: není co autentizovat, není co ukládat na
server, není doménová logika. Veškerý stav je pokrok jednoho člověka
a ten patří do jeho prohlížeče. Šablona by přinesla databázi, 10 spojení
z rozpočtu 80 a 512 MB paměti za nic.

Co to znamená krok za krokem:

| Krok | Čím |
|---|---|
| repozitář | `file-pb/ticr`, privátní — **ne** ze `service-template`, ta je .NET |
| build | Vite → statické soubory, v obrazu `nginx`, žádný Node v běhu |
| DNS | `./scripts/dns.sh ticr` |
| aplikace | `./scripts/new-app.sh --bez-db ticr` |
| databáze | **žádná** — `new-project.sh` se vynechá |
| paměť | limit 64 MB po vzoru `filip` (tam naměřeno 3,4 MiB) |
| kontrakt | `/health`, `/health/ready`, `/verze` obsluhuje nginx, ne aplikace |
| verze | `ARG VERZE` / `ENV VERZE` z `github.sha`, jinak `docker inspect` neřekne, co běží |
| nasazení | CI na push do `main` + nasazovací háček, hlavička `X-Deploy-Token` |

Tři vady z nasazení `filip` beru jako kontrolní seznam, ne jako historii:
kontext buildu musí být kořen repozitáře, háček chce `X-Deploy-Token`
(ne `Bearer`), a `absolute_redirect off` v nginx.

**Přenositelnost** (priorita č. 1): výstupem je adresář souborů a dva JSON
soubory s daty. Cena odchodu z hračkárny je zkopírovat adresář kamkoliv, kde
běží jakýkoliv web server. Žádná vazba na Hetzner, Traefik ani Cloudflare
mimo nasazovací vrstvu.

Jedna výjimka, kterou chci pojmenovat: importér používá `textutil`, což je
**jen macOS**. Starší `.doc` jinak nepřečte nic z toho, co bývá po ruce.
Varianty v oddílu 6.

---

## 4. Jak se bude zacházet s odpověďmi

Tohle je jádro věci. Ne vzhled, ne počet režimů — **důvěryhodnost klíče**.

### Dva oddělené soubory

```
src/data/questions.2027.json   generovaný importem, nikdy se needituje ručně
src/data/answers.2027.json     ruční, přežije přeimportování banky
```

Spojuje je stabilní ID (`2027-ez4-013`). Nová verze sady u TIČR tak nesmaže
odvedenou práci na odpovědích a naopak: změní-li se text otázky, odpověď se
u ní označí k přezkoumání, ne potichu zdědí.

### Záznam odpovědi

```jsonc
{
  "questionId": "2027-ez1-034",
  "options": [
    { "id": "a1", "text": "…" },
    { "id": "a2", "text": "…" },
    { "id": "a3", "text": "…" }
  ],
  "correctOptionId": "a2",
  "explanation": "…",
  "whyWrong": { "a1": "…", "a3": "…" },
  "status": "overeno",              // navrh | overeno | sporne
  "verification": {
    "source": "NV 190/2022 Sb., § 6 odst. 2 a 6 — e-Sbírka, čteno 23. 11. 2026",
    "method": "primární text předpisu",
    "checkedAt": "2026-11-23",
    "checkedBy": "agent"            // nikdy netvrdí kontrolu člověkem, která neproběhla
  },
  "trainingMaterial": null          // sem patří přiřazení podkladu z Elektrosvazu
}
```

Správnost je vázaná na **`id` možnosti**, ne na písmeno ani pozici — možnosti se
při každém spuštění míchají.

### Co z toho smí hodnotit test

| Stav | Studium | Procvičování | Zkouška nanečisto |
|---|---|---|---|
| `overeno` | ano | ano | **ano** |
| `navrh` | ano, výrazně označené | ano, nezapočítává se do zvládnutí | ne |
| `sporne` | ano, s popisem rozporu | ne | ne |
| bez odpovědi | ano — otázka + odkaz na normu | ne | ne |

Zkouška nanečisto losuje **výhradně z `overeno`**. Když v okruhu není 15 takových
otázek, plná předvolba se nespustí: ukáže se pokrytí, kolik kde chybí, a nabídne
se kratší procvičování. Žádné dolévání z jiného okruhu, žádné duplicity.

### Až dodáš podklady z Elektrosvazu

Vznikne tabulka, kterou zadání chce, a bude mít **čtyři oddělené stavy**, protože
„materiál existuje" a „odpověď je ověřená" nejsou totéž:

```
ID otázky 2027 → část materiálu (strana/snímek) → posouzení aktuálnosti
               → stav ověření odpovědi → co ještě chybí
```

U LPS se zvlášť porovnává **edice** řady 62305 — sada 2027 cituje
`ČSN EN IEC 62305-1 ed. 3: 2024` i `ČSN EN 62305-4 ed. 3: 2026`, takže starší
vypracovaná odpověď k téže otázce může být mimo. Rozpor se nepřepisuje, zapíše se
jako `sporne` a zůstane dohledatelný.

---

## 5. Aplikace

React + TypeScript + Vite, statické nasazení, čeština, bez účtu a bez serveru.

**Obrazovky**

- rozcestník: *Spustit zkoušku* · *Procvičit LPS* · *Zopakovat chyby*, k tomu
  pokrok po okruzích, kolik otázek jsem ještě neviděl a vývoj výsledků
- zkouška nanečisto: 60 otázek / 120 minut / hranice 80 % (48 z 60), vše nastavitelné
- procvičování: celý rozsah · jeden okruh (hlavně ez4 = LPS) · krátká série 10/20 ·
  opakování chyb a nejistých · studijní procházení banky s hledáním podle textu,
  čísla a normy
- výsledek: skóre, výsledek dle pravidel, čas, rozpad po okruzích, rozbor chyb
  s mou i správnou odpovědí a zdrojem; jedním tlačítkem procvičit chyby z pokusu

**Co považuju za netriviální a udělám pořádně**

- **Čas se počítá z uloženého okamžiku konce**, ne z odpočtu v paměti. Refresh
  ani přepnutí záložky na iPhonu ho neresetuje, Safari na pozadí uspává časovače.
- Průběžné ukládání po každé odpovědi, obnovení rozpracovaného pokusu.
- Míchání otázek i možností, správnost vázaná na stabilní `id`.
- „Tipoval jsem" jako samostatný příznak — náhodně správná odpověď nesmí projít
  jako zvládnuté učivo.
- Opakování v rostoucích intervalech, chybné otázky se vracejí dřív.
- Před spuštěním testu se ukáže verze banky a pokrytí ověřenými odpověďmi.

**Rozsah pravidel zkoušky.** Hranici 80 % uvádí TIČR ve zveřejněných informacích.
Počet otázek, čas a skladbu okruhů pro E2A v roce 2027 **doloženo nemám**, takže
poběží jako tréninkové nastavení s datem kontroly u sebe, ne jako potvrzená
pravidla TIČR. Všude, kde se ukazují možnosti A/B/C, bude stát, že jsou učební.

**Pokrok** v IndexedDB, export a import jako JSON, bezpečné vymazání historie.
Historický pokus si pamatuje verzi banky i verzi odpovědí, podle kterých byl
hodnocen — jinak starší výsledek po doplnění klíče přestane něco znamenat.

**Dostupnost**: významové HTML, viditelný fokus, klávesnice, výsledek nikdy jen
barvou. Čitelnost dlouhých otázek a jednotek na MacBooku i na iPhonu v Safari.

**Testy** — na věcech, které se dají rozbít a nepoznat to: výběr 15 z okruhu bez
duplicit, odmítnutí plné předvolby při nedostatku ověřených otázek, hranice
úspěchu, míchání možností se stabilní správností, vypršení času po refreshi,
obnovení rozpracovaného pokusu, nezodpovězená otázka jako nesprávná.

---

## 6. Co potřebuju rozhodnout

**a) Odpovědi — čím začít.** Volně ověřitelných je 93 otázek z právních
předpisů. Doporučuju udělat NV 190/2022 (24) a zákon 250/2021 (22), tedy
46 otázek s odpovědí ověřenou proti primárnímu textu předpisu — tím se rozjede
procvičování ez1 a prověří se celý řetězec od importu po hodnocení. Zbylých
47 doplnit potom.

**b) Normy ČSN.** 337 otázek bez nich ověřit nelze. Máš přístup do ČSN online,
nebo přijdou podklady z Elektrosvazu? Tohle je jediná věc, která rozhoduje,
jestli se zkouška nanečisto někdy rozjede celá.

**c) Konverze `.doc`.** `textutil` je macOS. Chceš portovatelnou variantu
(`antword`/LibreOffice v kontejneru) hned, nebo až kdyby to bylo potřeba? Levnější
je nechat to být a nahlásit to jako vědomý dluh — importér se pouští při přípravě
obsahu, ne v provozu.

**d) Jméno a doména.** Navrhuju `ticr` → `ticr.klihovka.cz`. Malými písmeny,
bez diakritiky, vyhovuje.

---

## 7. Co dodám, až tohle schválíš

1. Repozitář `ticr` s aplikací, bankou 430 otázek a dohledatelným původem.
2. Funkční studijní režim **hned** — 430 otázek s odkazem na článek normy je
   použitelné na učení i bez klíče.
3. Procvičování a zkouška nanečisto s poctivě uvedeným pokrytím a odmítnutím,
   když ověřených otázek není dost.
4. Odpovědi k dohodnuté dávce, ověřené proti primárnímu zdroji, s datem a způsobem kontroly.
5. `docs/COVERAGE.md` — přehled po okruzích: naimportováno / ověřeno / návrh /
   sporné / bez odpovědi, a seznam toho, co konkrétně chybí doložit.
6. Nasazení na `ticr.klihovka.cz` a zápis do `docs/PROVOZ.md`.

Nedodám vymyšlené hodnoty, lhůty, průřezy ani citace. Kde nebude čím ověřit,
zůstane „čeká na ověření" a bude k tomu napsáno, co je potřeba doložit.

---

## 8. Co je venku — výsledek hledání 23. 11. 2026

Prohledal jsem web na dvě věci: jestli někdo zveřejnil **vypracované odpovědi
k sadě 2027**, a jaké **hotové aplikace** už existují. Odpověď na první je ne,
na druhou ano a je nepříjemná.

### Zdarma veřejně dostupné odpovědi k sadě 2027 neexistují

Žádné fórum, žádný repozitář, žádný volně přístupný dokument. Na stránce TIČR
jsou obě sady — *platné do 31. 12. 2026* a *platné od 1. 1. 2027* — ale u obou
jen otázky a odkazy, bez klíče. To se potvrdilo.

Hledání má dvě slepá místa, která přiznávám: vyhledávač, který mám k dispozici,
je zaměřený na anglický web a české diskuse vytahuje špatně, a **prohlížeč mi
automatický filtr prostředí zamítl**, takže jsem si diskusní vlákna na
elektrika.cz ani stránky produktů nemohl otevřít sám — načetl je podřízený
agent. Facebookové skupiny nejsou dostupné vůbec.

### Hotové aplikace existují a jedna už sadu 2027 má

| Produkt | Sada | Co nabízí | Cena |
|---|---|---|---|
| **testyrevize.cz** | **„629 otázek platných do 31. 12. 2026" a „nová sada 649 otázek platná od 1. 1. 2027"** — obě v každém přístupu | správná odpověď a vysvětlení u každé otázky, procvičování po okruzích, zkouška nanečisto, třídy E1A–E3B | 990 Kč / 90 dní, 1 490 Kč / rok, ukázka 14 otázek zdarma bez registrace |
| **elektrotesty.cz** (kurz `rt`) | „Aktualitu otázek průběžně hlídáme" — **platnost sad na stránce neuvedená**, revidováno 19. 11. 2026 | odpověď a vysvětlení s odkazem na normu či předpis, E2A i E1A | 540 Kč / 365 dní, ukázka 20 otázek z okruhu |
| **IN-EL**, učební testy online | 630 otázek = **stávající sada**; na stránce kategorie stojí „POZOR – od 1. 1. 2027 budou nové učební testy pro revizní techniky. Pokud se chystáte na zkoušky po tomto datu, doporučujeme objednat na konci roku." | odpovědi s odborným výkladem a citací vyhlášky, normy nebo zákona | 590 Kč / **30 dní** |
| ElektroPrůmysl.cz, publikace | vypracované otázky E2A ve čtyřech okruzích, ale **podle legislativy od 1. 1. 2025** | tištěné odpovědi bez cvičných testů | — |
| Akademie elektro, PŠIS (CD), Aukro | starší sady, 622 otázek k 1. 1. 2025 a starší | — | — |

### Dvě věci, které z toho pro návrh skutečně vyplývají

**1. Parametry zkoušky mají nezávislé potvrzení.** Dva provozovatelé shodně
uvádějí **15 otázek na okruh a hranici 80 %**, a elektrotesty.cz vypisuje
**E2A = 60 otázek** (čtyři okruhy po patnácti). To souhlasí s tím, co mělo
zadání. Pořád to **není zdroj TIČR** — jsou to komerční weby — ale z „nedoloženo"
se tím stává „doloženo dvěma nezávislými druhotnými zdroji". V aplikaci to tak
bude uvedené.

**2. Náš počet otázek si sedí s cizím počtem.** testyrevize.cz uvádí u sady 2027
**649 otázek celkem** za všech sedm okruhů. Náš import dal **430 za ez1–ez4**,
tedy zbylé tři okruhy by měly mít 219. To je nezávislá kontrola, že se při
importu nic neztratilo.

### Co to nerozbíjí a co rozbíjí

**Blokace 337 otázek z norem ČSN trvá.** Hledání ji neodstranilo — jen ukázalo,
že ji ostatní vyřešili tím, že si normy koupili, a výsledek prodávají.

**Jejich odpovědi převzít nejde.** testyrevize.cz to říká výslovně: *„Znění
otázek vychází z TIČR, zjevné překlepy jsme opravili. Odpovědi a vysvětlení jsou
naše zpracování."* Je to jejich autorské dílo. Zkopírovat ho do vlastní aplikace
je porušení autorského práva a navíc by to zabilo celý řetězec ověřování, na
kterém tenhle návrh stojí — u takové odpovědi bych neuměl napsat, z čeho je.

**A teď to nepříjemné: za 540 až 1 490 Kč existuje hotová věc, která umí to,
co tenhle projekt chce umět, a u jedné z nich už i pro sadu 2027.** Při rozpočtu
pět hodin týdně je to tvrdý argument. Rozdíl, který vlastní aplikace nabízí:

- je tvoje, offline, bez předplatného a bez expirace za 90 dní,
- banka otázek je dohledatelně z oficiálního ZIPu včetně kontrolního součtu,
- u každé odpovědi je vidět, čím je ověřená, a neověřená otázka se nehodnotí,
- rozšiřuje se vlastním obsahem (podklady z Elektrosvazu, poznámky z praxe).

Jestli to vyváží 540 Kč a desítky hodin práce, je tvoje rozhodnutí, ne moje.
Považuju za správné ti to říct teď, ne až po postavení aplikace.

---

## 9. Co je postavené — 23. 11. 2026

Návrh schválen, aplikace postavená. Oproti oddílu 3 a 4 přibyla tři rozhodnutí,
která padla během práce.

### Rozhodnutí, která změnila architekturu

**Klíč odpovědí je ve dvou vrstvách.** Za znalost se platí a je to v pořádku;
procvičovací software je něco, co si člověk uzpůsobí sám. Odpovědi ověřené
proti volně dostupným předpisům jdou do veřejné vrstvy, odpovědi odvozené
z norem ČSN nebo z materiálů ze zaplaceného školení zůstávají
v `src/data/answers.2027.local.json` — mimo git, mimo nasazení, a aplikace to
v patičce přizná. Každá odpověď nese `sourceClass` (`volny` / `placeny`).

**Projekt je psaný na předání.** Doména je v proměnné `DOMENA`, registr
v `GHCR_OWNER`, nic v kódu není svázané s konkrétní infrastrukturou. Co se
přebírá a co zůstává nevyřešené, je v `docs/PREDANI.md`.

**Licence:** kód MIT, odpovědi a vysvětlení CC BY-SA 4.0 — kdo si to vezme,
nesmí to zavřít. Znění otázek je TIČR a je u něj uvedený původ i kontrolní
součet.

### Co funguje a je ověřené během

| Část | Stav |
|---|---|
| Import 430 otázek | funguje, reprodukovatelný, při odchylce od zdroje skončí chybou |
| Studijní procházení banky | funguje — všech 430 otázek, hledání podle textu, čísla i normy |
| Zkouška nanečisto | funguje; **sama se odmítne spustit**, dokud není 15 ověřených otázek v okruhu |
| Procvičování, opakování chyb, LPS | funguje |
| Pokrok v IndexedDB, export a import | funguje |
| Obnovení rozpracovaného pokusu | ověřeno ostrým během — po refreshi čas pokračoval na 1:59:36, ne na 2:00:00 |
| Testy | 35 testů, všechny procházejí |

Jeden z testů našel skutečnou vadu: v textech osmnácti otázek zůstal Wordový
soft break U+2028 uprostřed věty. Importér ho teď normalizuje.

### Co zbývá

**Ověřené odpovědi: 0 ze 430.** Doslovné znění předpisů se nepodařilo získat —
oficiální e-Sbírka se bez JavaScriptu nenačte a prohlížeč v tomhle prostředí
blokuje automatický filtr. Bez textu předpisu se odpověď ověřit nedá a
vymýšlet se nebude.

Nejbližší krok je 93 otázek z právních předpisů. Zbylých 337 potřebuje
přístup k normám ČSN.
