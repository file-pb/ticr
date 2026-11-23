# Tři vrstvy obsahu a co s kterou jde dělat

Tenhle projekt míchá tři věci, které mají každá jiného vlastníka. Smysl téhle
stránky je, aby se nikdy neslily do jedné.

## 1. Znění otázek — TIČR

Otázky pocházejí z dokumentů, které Technická inspekce ČR zveřejňuje ke
stažení na [ticr.eu](https://www.ticr.eu/inpage/testove-otazky-ez/) pro
přípravu na zkoušku. Jejich znění, číslování a normativní odkazy nejsou naše.

Import je uchovává beze změny a nese u nich URL, jméno souboru, datum stažení
a kontrolní součet archivu. Význam ani případné chyby zdroje se potichu
neopravují — oprava by znamenala, že se učíš jinou otázku, než jaká bude na
zkoušce.

Pokud by TIČR s šířením znění nesouhlasil, je to jejich právo a banka se
z veřejného nasazení odstraní. Aplikace sama o sobě funguje s jakoukoliv
bankou ve stejném formátu.

## 2. Odpovědi, možnosti a vysvětlení — naše, CC-BY-SA-4.0

Oficiální dokumenty klíč správných odpovědí nezveřejňují. Možnosti A/B/C
a vysvětlení k nim proto nejsou autentické odpovědi TIČR, ale učební obsah
vytvořený tady.

Licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.cs):
komukoliv k použití, i komerčnímu, s uvedením autora a se stejnou licencí
u odvozených děl. To je úmysl — kdo si ten obsah vezme, nesmí ho zavřít.

### Co se do téhle vrstvy nesmí dostat

**Odpovědi převzaté z cizích placených produktů.** Vypracované otázky od
IN-EL, testyrevize.cz, elektrotesty.cz ani z jiného prodávaného kurzu. Je to
jejich autorské dílo a navíc by u takové odpovědi nešlo napsat, z čeho je —
což je přesně to, na čem celý klíč stojí.

**Doslovné přepisy norem ČSN.** Normy jsou placené. Odpověď na ně odkazuje
článkem a čísly, nereprodukuje jejich text.

## 3. Odpovědi odvozené z placených podkladů — lokální, nikam nejdou

Normy ČSN a materiály ze školení, za které se platí (u mě
[Elektrosvaz](https://www.elektrosvaz.cz/rt-online)), jsou legitimní hodnota
někoho jiného. Platím za ně a respektuju to.

Odpovědi, které z nich vznikly, proto patří do
`src/data/answers.2027.local.json`. Ten soubor:

- není v gitu (`.gitignore`),
- nedostane se do veřejného nasazení,
- aplikace ho načte, jen pokud leží na stroji, a v patičce to přizná.

Každá odpověď nese `sourceClass`:

| `sourceClass` | Znamená | Viditelnost |
|---|---|---|
| `volny` | zákon, nařízení, veřejně dostupný dokument | `verejne` |
| `placeny` | norma ČSN, materiál ze zaplaceného školení | `jen-lokalne` |

Hranice je jednoduchá: **za znalost se platí a to je v pořádku; procvičovací
software je něco, co si člověk umí uzpůsobit sám.** Tahle aplikace je ta druhá
část. Nenahrazuje školení ani normy a nemá nikomu ubrat na tom, co prodává.

## Čím tenhle projekt není

Není to náhrada zkoušky, školení ani normy. Procvičuje **písemnou část**
zkoušky E2A včetně LPS bez nebezpečí výbuchu a nic netvrdí o ústní části.
Není to zkouška elektrotechnika podle § 6 ani vedoucího elektrotechnika podle
§ 7 NV č. 194/2022 Sb.
