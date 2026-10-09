# Forgefront V0.4.0 DEV1 – Kampagnenprototyp

Entwicklungsstand, NICHT die auf GitHub Pages veröffentlichte Version. V0.3.5 bleibt live.

## V0.4.0 DEV1 (Testumfang)
- Neue Levelauswahl ohne Gold-/Kampf-HUD; Kapitelstruktur für vier Kapitel mit je fünf Karten vorgesehen.
- Kapitel 1: **Die Versorgung** (Originalkarte) und **Gegenstrom** (echte horizontal gespiegelte Weg-/Erzkarte) spielbar, Level 3–5 sichtbar aber klar als "in Vorbereitung" deaktiviert. Kapitel 2–4 sind noch nicht verfügbar.
- Schwierigkeit unten in der Levelauswahl; Kartensterne pro Schwierigkeit separat. Erste erfolgreiche Bossverteidigung auf beliebiger Schwierigkeit schaltet das nächste **fertige** Level frei.
- Nur nach tatsächlichem Bosskill Sterne: 0 Durchbrüche = 3, 1–4 = 2, ab 5 = 1. Boss entkommen = Niederlage, unabhängig von HQ-Leben.
- Tippen auf Karte öffnet direkt Bauphase. Welle 1 bleibt manuell.
- Tutorial erscheint einmalig und lässt sich später mit ? HILFE erneut öffnen; Sieg/Niederlage erlauben Retry/Levelauswahl und optional Nächstes Level.
- Einstellungen im Auswahlmenü: dunkles/helles **Menüdesign**, keine vollständige Spielfeld-Neueinfärbung.
- Lokale Speicherstruktur unter `forgefront.progress.v1`; anonyme/ungültige Daten und deaktivierte localStorage dürfen das Spiel nicht blockieren.

## Release-/Testhinweis
Vor Veröffentlichung alle Tests ausführen: `node tools/verify-release.cjs && node --test tests/*.test.cjs`.

# Forgefront – Alpha 0.3.5 RC1

**Produktions- und Verteidigungspuzzle für Browser und Smartphone.** Entwicklungsversion, noch nicht in GitHub `main` veröffentlicht. Unter `index.html` befindet sich eine eigenständig spielbare HTML-Datei ohne externe Bibliotheken. Alternativ `src/index.html` mit `src/style.css` und `src/game.js` über einen lokalen Webserver öffnen.

## Spielprinzip

- Bauphase: **kein Zeitlimit und keine Produktion**. Jede Welle beginnt erst nach Klick auf **WELLE STARTEN**. Bauen und Abriss während der Angriffswelle gesperrt.
- Erzminen werden ausschließlich auf Erzfeldern gebaut. Fabriken wandeln Metall in *eine gemeinsame Munition* für MG, Kanone und Mörser um. Rohre und Brücken verbinden Anlagen mit getrennten Metall- und Munitionsnetzen. Angrenzende Gebäude sind direkt verbunden.
- Anzeigen: Die Versorgung in Prozent beschreibt die **nachhaltige Produktionsdeckung bei Dauerfeuer**. In der Kampfphase kann eine Waffe auch ohne Gegner in Reichweite Munition für **maximal einen vorbereiteten Schuss** laden. Eine solche Ladung benötigt echte Produktion; es gibt keine kostenlosen Sofortschüsse.
- Nach einer Welle werden Goldprämien gutgeschrieben. Vor der ersten Benutzung abgerissene Gebäude erstatten 100 %; bereits eingesetzte Gebäude 50 %. Es gibt sechs Gegnerwellen in vier Schwierigkeitsstufen.
- **Sieg nur, wenn das HQ überlebt UND der Boss getötet wurde.** Entkommt der Boss, ist das Level sofort verloren, unabhängig von den verbleibenden HQ-Leben. Durchbrüche normaler Gegner verursachen HQ-Schaden.

## Spielmechanik V0.3.5 RC1

| Waffe | Kosten | Dauerfeuerrate | Munition/s | Rolle |
|---|---:|---:|---:|---|
| MG | 24 | 0,45 s/Schuss | 0,60 | Schnelle Einzelziel-Abwehr |
| Kanone | 38 | 1,90 s/Schuss | 0,60 | Panzerbrecher |
| Mörser | 42 | 2,20 s/Schuss | 0,65 | Flächenschaden (Radius 1,45) |

Mine: max. 1 Metall/s; Fabrik: 0,4 Metall/s zu max. 1,2 Munition/s. Waffen besitzen eine lokale Vorladung für einen Schuss, der nur während einer laufenden Welle durch aktive Produktion erworben werden kann. „2×“ ist die feste Geschwindigkeit. Die größere Karte ist 18 × 20 Felder.

## Tests und Qualitätssicherung

Node.js 22 (ohne Installation externer NPM-Pakete):

```sh
node tools/build-standalone.cjs
node tools/verify-release.cjs
node --test tests/forgefront.test.cjs
```

Der Spielcode ist nur in `src/game.js` zu bearbeiten. Das generierte Root-`index.html` muss nach Änderungen **neu gebaut** und exakt gegen die Modulquellen geprüft werden. Bei Push und Pull Requests führt `.github/workflows/quality.yml` dieselben Prüfungen über GitHub Actions aus.

Der Testkatalog umfasst Boss-Sieg-/Niederlagenbedingungen, Munition und Schussladung, Ressourcennetz, Bauregeln, 15/30/60-FPS-Simulation, eine Flächenziel-Referenzprüfung und komplette Durchläufe auf Leicht, Mittel, Schwer und Verrückt. Eine zusätzliche alternative „Verrückt“-Strategie verwendet Mörser und MG gemeinsam.

**Veröffentlichungsdisziplin:** Änderungen zuerst in einem Entwicklungszweig testen; GitHub `main`/Pages erst nach bestandenen Qualitätstests und expliziter Freigabe aktualisieren. Ein erfolgreicher synthetischer Test ersetzt nicht die abschließende Bedienprüfung auf einem echten Smartphone.
