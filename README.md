# Forgefront V0.3.1 – Handy-Bedienung und Angriffstrupps

- HUD: nur Gold oben, HQ-Leben direkt am Hauptquartier. Wellenübersicht in Baupause, Gegner-Restzahl im Kampf.
- Vier feste Baukategorien ohne horizontales Scrollen. Ein Klick auf Werkzeug schließt die Auswahl, lässt das Werkzeug aktiv.
- Tempo fest 2x, Pause/Start bleiben.
- Gegner: sechs Wellen mit 16/25/30/45/65/34 Begleitgegnern und einem Boss in der letzten Welle (Welle 6: 35 insgesamt). Kompakte Gruppen 4/5/6/9/13/7, Abstand der Trupps 2.4–3.3 Spielsekunden. Bedrohliches Gruppenspiel bei Smartphone-Performance prüfen.
- Gold: Scout +1, Normal +2, Heavy +6, Boss +20, Wellenbonus +10. Bisherige Waffen-/Produktionsparameter unverändert.

# Forgefront V0.3.1 – Testkarte mit drei Waffen

Kanone: 38 Gold, Reichweite 4, Schaden 11, Schuss alle 1,7 Sekunden, 1,2 Munition/s, Panzerbrecher. Mörser: 42 Gold, Reichweite 1,5 bis 5, 6 Flächenschaden (Radius 1,1), Schuss alle 2,4 Sekunden, 2,4 Munition/s. MG unverändert (3 Schaden, 0,57 s, 1,75 Munition/s). Heavy Rüstung 2, Boss Phase 2 Rüstung 2. Nur eine Munitionsfabrik und ein universelles Munitionsnetz. Testkarte: veränderter Gegnerpfad mit zusätzlichem Knick im Mittelteil und neuen Erzvorkommen; 6 gemischte Wellen; alle Gegner vorab sichtbar. Neubau und Umbau zwischen Wellen: vor Wellenstart neu gesetzt 100 % Rückerstattung, nach Einsatz 50 %. Noch keine Kampagne/Speicherung.

# Forgefront V0.3.1 – Produktions- und Optimierungspuzzle

Spielbarer Browser-Prototyp für Handy und Desktop. Stand: 09.10.2026.

## Leitidee

**Primär ein knackiges Produktions-/Optimierungspuzzle mit Tower-Defense-Prüfung.** Die Spieler sollen begrenzte Ressourcen und räumliche Positionen optimieren, um die jeweilige Gegnerwelle beziehungsweise später ein dediziertes Level zu meistern. Jede Bauphase bleibt **zeitlich unbegrenzt**, ohne Produktionsfortschritt. Angriffswellen werden bewusst manuell gestartet; die Bauphase ist zum Analysieren und Umbauen gedacht. Die gut lesbare, farbige Prozentprognose der Gebäude ist ein zentrales Spielelement.

## Neue Anzeige in V0.3.1

- Während des Kampfs wird nur die **sichtbare Prozentzahl** ungefähr viermal pro Sekunde aktualisiert und über ca. 1,5 Sekunden sanft geglättet. Keine Änderung an Kampf-Ticks, Rohstoff-Berechnung, Schaden oder Baukosten.
- Die **Bauphasen-Prognose** bleibt nach jeder Änderung unmittelbar und exakt; Details enthalten weiterhin reale Produktionsraten. Nach jedem Wellenstart beginnt die Darstellung mit der zuletzt geplanten Versorgung.
- Keine Kanone / kein Mörser in diesem kleinen Qualitätsupdate. Für V0.3.1 vorgesehen: MG, Kanone und Mörser verwenden dieselbe Munition aus der einzigen Metall verarbeitenden Munitionsfabrik.

## Spiel starten

- `index.html` zusammen mit `style.css` und `game.js` öffnen, oder `Forgefront_V0.3.1.html` als einzelne Offline-Datei verwenden.
- Erstes Tutorial ist neutral, optional und überspringbar, per `? HILFE` während der Bauphase wiederholbar.
- Unten bleibt beim Bauen eine **kompakte Bauleiste ständig offen**, auch bei Werkzeugwechsel und wiederholter Platzierung; Tippen oder Rohrziehen. Bei Angriff verschwindet die Werkzeugleiste, nach der Welle erscheint sie wieder.
- Standardtempo **2×** (umschaltbar: 1×, 1,5×, 2×). Nach dem manuellen Start erscheinen Gegner **2 Spielsekunden** später (bei 2× etwa 1 Sekunde Echtzeit).

## KISS-Wirtschaft und automatische Rohrtypen

- **Keine einzelnen Metall-/Munitionspakete**: Versorgung wird als kontinuierliche Produktions-/Verbrauchsrate je verbundenem Netz berechnet.
- **Ein Rohrbauwerkzeug**, keine separaten Materialwerkzeuge: Metallleitungen werden automatisch **orange**, Munitionsleitungen **türkis**, noch unbestimmte Rohre **grau**.
- Rohre werden durch Kontakt mit einer **Erzmine als Metall** und mit einem **MG als Munition** erkannt. Die **Fabrik trennt als Umwandler** den Metall-Eingang vom Munitions-Ausgang. Gebäude sind keine Transitknoten.
- Das Spiel verhindert jede Bauaktion, durch die **Metall und Munition im selben zusammenhängenden Rohrnetz** lägen; der Spieler erhält einen Hinweis und verliert **kein Gold**. Eine direkte orthogonale Nachbarschaft Mine–Fabrik beziehungsweise Fabrik–MG braucht kein Rohr. Diagonalen zählen nicht.
- Die Rohrtypen sind ein **erster automatischer Ansatz**, dessen Bedienbarkeit gezielt in Freundestests geprüft werden soll: Nähere Berührungen können bewusst blockiert werden, wenn die Materialerkennung sonst uneindeutig wäre.
- Rohre haben keine eigene Durchsatzgrenze. Erzmine MAX 1 Metall/s; Fabrik benötigt bis 0,4 Metall/s und produziert bis 1,2 Munition/s; MG benötigt bis ca. 1,75 Munition/s bei vollem Dauerfeuer.
- Bei Mangel werden gleichartige Verbraucher proportional gleich versorgt, überschüssige Kapazität gedrosselt. Ein MG ohne Gegner verbraucht im Kampf keine Munition.
- Bauphase: sofortige **Prozent-Prognose** beim Bauen; Kampfphase: aktuell berechnete Versorgung. Mine mit Förderreserve ist nicht automatisch ein Problem; Gebäudedetails zeigen die genauen Zahlen.

## Aktuelles Testlevel und Grenzen

- Ein Testlevel mit **18 × 20 quadratischen Feldern**, fester Gegnerroute, fünf Standardwellen und einer Bosswelle mit zweiter Bossphase. 180 Startgold, 20 HQ-Leben, +5 Gold pro Kill, +10 Gold pro bestandener Welle.
- Gebäude: Erzmine (22), Fabrik (18), MG (24), Rohr (4), Brücke (10), Radierer (Testmodus: volle Rückerstattung).
- Noch **keine** zusätzlichen Türme, Forschung, weitere Rohstoffe, freie Wege oder Hexagonfelder. Diese Optionen werden erst diskutiert, nicht automatisch ergänzt.
- Kein Speichern beim Neuladen; GitHub Pages als separate öffentliche URL noch nicht geprüft. Quellcode liegt auf GitHub `Karlel0815/Forgefront`, versionierte Kopien in Google Drive.

## Offene längerfristige Konzepte – nicht implementiert

1. Mehrere eigenständige, schwierigere **Puzzle-Level** mit lösbaren, gut lesbaren Versorgungsengpässen; Gegnerwelle als Erfolgstest. Die Baupause muss dauerhaft unbegrenzt bleiben.
2. Zweiter Turm mit klar anderer Funktion, beispielsweise Panzerbrecher, vor weiteren Rohstoffen.
3. **Forschungslabor** nutzt überschüssige Metallleistung (nach Priorität Verteidigung) für ansteigenden Forschungsfortschritt, Level-Upgrades/Turmfreischaltungen; Balance noch offen.
4. Mehr Karten- und Erz-/Gegnerweg-Layouts auf dem quadratischen Raster; Hexfelder und freie Gegnerwege oder Mauerlabyrinthe später eigenständig prototypisieren, nicht voreilig in den Hauptspielmodus aufnehmen.
5. Publikationsstrategie: GitHub ist vorerst **public** für Tests mit Freunden, Google-Drive-Master privat; Browser-Quellcode kann bei einer öffentlichen Spielversion ohnehin eingesehen werden.

**Arbeitsregel:** Immer zuerst das Konzept diskutieren, erst nach ausdrücklichem Wunsch die nächste Version programmieren. GitHub main und Google Drive nach getesteten Veröffentlichungen synchron halten.

## Tests

```sh
node test.cjs
node pipe_test.cjs
node onboarding_test.cjs
node strategies.cjs
node display_test.cjs
python browser_test.py
```

Die Browsertests verwenden Playwright und einen lokalen Chromium. Zusätzlich wird die gebündelte, eigenständig spielbare HTML-Datei im Browser geprüft.
