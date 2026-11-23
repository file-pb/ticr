# Předání jinému správci

Projekt je napsaný s tím, že ho jednou může převzít někdo jiný — spolek,
školicí organizace, kdokoliv. Tahle stránka je seznam toho, co přesně se
přebírá a co zůstává nevyřešené.

## Co se přebírá

| Část | Kde | Vázanost na původního autora |
|---|---|---|
| kód aplikace | `src/` | žádná, MIT |
| banka otázek | `src/data/questions.2027.json` | žádná, generuje ji import ze zdroje TIČR |
| import ze zdroje | `scripts/` | macOS kvůli `textutil` |
| klíč odpovědí, veřejná vrstva | `src/data/answers.2027.json` | žádná, CC BY-SA 4.0 |
| nasazení | `deploy/`, `.github/workflows/ci.yml` | **doména je v proměnné `DOMENA`**, registr v `GHCR_OWNER` |

Co se **nepřebírá**: lokální vrstva odpovědí odvozených z placených podkladů.
Není v gitu a nemá v něm být. Nový správce si ji buď vytvoří z vlastního
přístupu k normám, nebo ji nemá — a pak zůstanou ty otázky bez klíče.

## Cena odchodu

Výstup sestavení je adresář statických souborů. Běží za jakýmkoliv web
serverem, který umí servírovat statiku a vracet `index.html` na neznámou
cestu. Žádná databáze, žádné sezení na serveru, žádný stav na disku.

Odchod z téhle infrastruktury = zkopírovat `dist/` jinam a nastavit DNS.
Odchod z GitHub Actions = postavit obraz čímkoliv jiným z `deploy/Dockerfile`.

## Co je potřeba udělat při přebírání

1. **Změnit `DOMENA` a `GHCR_OWNER`** v prostředí nasazení. Jméno Traefik
   routeru v `deploy/docker-compose.yml` je natvrdo `ticr` — Compose
   neinterpoluje proměnné do klíčů labelů. Pokud se projekt přejmenuje, musí
   se přepsat i tam, jinak Traefik vrátí self-signed certifikát.
2. **Zrcadlo základních obrazů.** Build staví z `node` a `nginx`, oba
   z Docker Hubu. Na účtu s limitem stahování je potřeba je zrcadlit.
3. **Zkontrolovat banku proti aktuálnímu zdroji TIČR.** `scripts/fetch_source.sh`
   a import; při odchylce import skončí nenulovým kódem a nahlásí rozdíl.
   Počty se **nedorovnávají**, rozdíl se posuzuje.
4. **Přečíst [PRISPEVKY.md](PRISPEVKY.md)** před prvním doplněním odpovědi.
   Pravidlo, že `overeno` vyžaduje uvedený primární zdroj, je to jediné, co
   drží důvěryhodnost celého klíče.

## Co zůstává nevyřešené

- **337 otázek bez klíče, protože odkazují na placené normy ČSN.** Tohle je
  hlavní nedodělek a nejde ho vyřešit prací, jen přístupem k normám.
  Organizace, která normy má, ho vyřešit může.
- **Zkoušku nanečisto nelze spustit**, dokud nebude 15 ověřených otázek
  v každém okruhu. Aplikace to nezastírá a sama se odmítne spustit.
- **Parametry zkoušky nejsou doložené od TIČR** — viz *Známá omezení*
  v [README](../README.md).
- **Import jen na macOS.**

## Co projekt nemá dělat

Nemá nahrazovat školení ani normy a nemá ubrat na tom, co někdo prodává jako
znalost. Procvičovací software je jiná věc než odborný obsah; tenhle projekt
je ten software.
