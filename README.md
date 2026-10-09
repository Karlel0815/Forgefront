# FORGEFRONT V0.1.8 – Logistik-Puzzle

**Status:** spielbare Browser-Testversion (PC + Android), 09.10.2026. Die Balancingwerte sind vorläufig.

## Spiel starten

- **Einfachste Variante:** `index.html` aus dem Repository lokal im Browser öffnen. Alles ist in einer HTML-Datei enthalten, keine Internetverbindung benötigt.
- **Quellcode:** Im Ordner `src/` liegen `index.html`, `style.css` und `game.js` als getrennte Dateien. `src/index.html` lässt sich ebenfalls direkt im Browser öffnen.
- Auf Mobilgeräten **BAUEN** unten antippen oder nach oben ziehen, ein Werkzeug wählen und auf dem Spielfeld platzieren.
- Karte mit einem Finger verschieben, mit zwei Fingern stufenlos zoomen. Ein Werkzeug durch erneutes Antippen wieder abwählen, um die Karte zu verschieben.
- Rohre und Radiergummi lassen sich über mehrere Felder ziehen. Auf Gegnerwegen wird beim Rohrziehen automatisch eine Brücke gebaut.
- **Welle starten** startet die Industrie sofort und lässt die ersten Gegner nach ca. 10 Sekunden kommen. Während der Kampfphase darf nichts gebaut, verändert oder gelöscht werden.
- Nach Wellenabschluss pausieren **Mine, Fabrik, Rohrpakete und MG** vollständig, bis die nächste Welle manuell gestartet wird. Die Bauphase hat kein Zeitlimit. Während eines laufenden Kampfes sind Pause und Spieltempo (1× / 1,5× / 2×) möglich.

## Spielziel und Wirtschaft

- Fünf zunehmend schwierige Wellen, dann die sechste Welle mit dem Boss **Eisenbrecher** samt Begleitgegnern. Beim Boss unter 50 % Lebenspunkten beginnt seine zweite Phase (schneller, gepanzert). Niederlage bei HQ-Leben 0.
- Start mit 180 **Gold**, 20 HQ-Leben. Baukosten Mine 22, Fabrik 18, MG 24, Rohr 4, Brücke 10 Gold. +5 Gold je besiegtem Gegner, +10 Gold je überstandener Welle.
- Gold ist **nur Bauwährung** und wird global sofort gutgeschrieben, Metall ist industrieller Rohstoff, Munition wird physisch transportiert.
- Minen stehen auf Erz und schicken **ohne internes Zwischenlager** alle 1 Sekunde ein Metallpaket direkt über das Rohrnetz los, wenn eine Fabrik freie Verarbeitungskapazität hat. Ansonsten pausiert die Förderung.
- Eine Fabrik verarbeitet **1 Metall** während **2,5 Sekunden** und gibt **3 Munition** als sichtbares Paket aus. Im Ablauf darf höchstens ein laufender Produktionsvorgang sowie eine fertige wartende Charge liegen, kein Großlager.
- MGs haben **kein Magazin**: Schießen kann ein MG nur, wenn ein echtes Munitionspaket am Rohranschluss angekommen ist. Die Patronen werden unmittelbar aus diesem Paket verbraucht. Max. ~1,75 Schuss je Sekunde.
- Rohrwege finden den kürzesten erreichbaren passenden Empfänger automatisch. Kreuzungen erlauben Gegenverkehr; dadurch kann sich das Spiel nicht durch Paket-Sackgassen dauerhaft festfahren. Sind Empfänger ausgelastet, staut sich Nachschub; Minen/Fabriken werden gedrosselt, ohne Pakete zu verlieren.
- Über jedem Mine-/Fabrik-/MG-Gebäude zeigt ein **kleines Farbsignal** den gleitenden tatsächlichen Förder-, Produktions- bzw. Verbrauchsdurchsatz der letzten vier Sekunden. Grau=aus/kein Ziel, grün=arbeitet, orange=reduziert/Anlauf, rot=blockiert/unterversorgt.
- Radierer nur in der Bauphase. Im aktiven Testmodus werden **100 % Gold** erstattet; später soll der Erstattungsfaktor mit dem Schwierigkeitsgrad variieren. Das Entfernen belegter Leitungen und besetzter Fabriken wird zur Paketerhaltung verhindert.

## Geplanter Gesamtumfang / Grenzen

- 18 × 20 Felder, automatische Kurven, T-Stücke und Rohrbrücken, Minikarte für Orientierung.
- **Keine** unnötigen Zoomknöpfe, Zoom-Erklärleiste oder Karte-Mitte-Sprung. Das Baumenü sitzt am unteren Bildschirmrand.
- Die geplante Rundendauer beträgt rund 10–15 Minuten inklusive der frei langen Bauphasen und hängt stark von der Spielweise ab.
- Es gibt noch **keine** zweite Karte, Fabrik-/Waffenupgrades, mehrere Schwierigkeitsgrade oder Cloud-Speicherstände.
- Nach jedem Seiten-Neuladen beginnt eine neue Runde. Kein echtes Geräte-Testzertifikat; browserbasierte Android-Größen-Tests sind bestanden.

## Tests und vollständiges Quellpaket

Die automatisierten Tests (`test.cjs`, `strategies.cjs`, `browser_test.py`) befinden sich im [vollständigen V0.1.8-Quellpaket auf Google Drive](https://drive.google.com/file/d/1Sv0dME2uU4YlytHbYuzVv6JjFj9zkFVK/view).

**Versionierung:** `main/index.html` ist die eigenständig lauffähige GitHub-Version. `src/` enthält dieselbe Spielversion als bearbeitbare HTML-, CSS- und JavaScript-Dateien.

**Master:** V0.1.8 ist auf GitHub und im Google-Drive-Arbeitsspeicher verfügbar. GitHub-Pages-Hosting wird separat geprüft.
