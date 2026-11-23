#!/usr/bin/env bash
# Stáhne oficiální archiv testových otázek TIČR platný od 1. 1. 2027 a převede
# soubory .doc na UTF-8 text. Reprodukovatelný krok: po změně na straně TIČR se
# změní kontrolní součet a import to nahlásí.
#
# Použití:
#   scripts/fetch_source.sh                 # stáhne z ticr.eu
#   scripts/fetch_source.sh /cesta/k.zip    # použije ručně dodaný ZIP
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW="$ROOT/data/raw"
EXTRACT="$RAW/extracted"
TXT="$ROOT/data/txt"
ZIP_URL="https://www.ticr.eu/soubor/ez-testove-otazky-od-2027-01-01-zip/"
ZIP="$RAW/ez-2027.zip"

mkdir -p "$RAW" "$TXT"

if [ "$#" -ge 1 ]; then
  echo "Používám ručně dodaný archiv: $1"
  cp "$1" "$ZIP"
else
  echo "Stahuji $ZIP_URL"
  curl -fsSL -o "$ZIP" "$ZIP_URL"
fi

if ! file "$ZIP" | grep -q 'Zip archive'; then
  echo "CHYBA: stažený soubor není ZIP archiv." >&2
  exit 1
fi

echo "sha256(zip) = $(shasum -a 256 "$ZIP" | cut -d' ' -f1)"

# Archiv je nedůvěryhodná vstupní data: rozbaluje se do vlastního prázdného
# adresáře, nikdy ne vedle skriptů.
rm -rf "$EXTRACT"
mkdir -p "$EXTRACT"
unzip -o -q "$ZIP" -d "$EXTRACT"

echo "Převádím .doc -> .txt (textutil, UTF-8)"
rm -f "$TXT"/*.txt
for f in "$EXTRACT"/*.doc; do
  b="$(basename "$f" .doc)"
  textutil -convert txt -encoding UTF-8 -stdout "$f" > "$TXT/$b.txt"
  echo "  $b.txt  ($(wc -l < "$TXT/$b.txt" | tr -d ' ') řádků)"
done

echo "Hotovo. Dále: python3 -I scripts/import_ticr.py"
