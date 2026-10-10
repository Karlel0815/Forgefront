# Forgefront – interner Kartensimulator Phase 2 (P1)

**Nur intern**, als GitHub-DEV-Tool. Kein neues Spielmenü und keine Änderung an Spielregeln, Veröffentlichung oder Save-Daten.

## Ausführen

~~~sh
node --test tests/map-simulator.test.cjs
node tools/map-simulator.cjs --seed 52741 --count 2 --out generated/map-sim/results.json
~~~

Der Solver lädt die **echte Spiel-Engine** `src/game.js` in eine isolierte Node-VM und injiziert ausschließlich innerhalb dieser VM pro Versuch `path/ore/hq` in die bestehende erste Kapitelkarte. Wellenprofile sind **Schwer / Kapitel 1 / challenge 0** fixiert, damit nicht unterschiedliche Gegnerwellen fälschlich als höhere Kartenschwierigkeit interpretiert werden.

Alle Käufe erfolgen über die echte Engine-Methode `place`, deren Gold-, Rohr- und Platzierungsregeln gelten. Bis zu vier beschränkte Strategiefamilien werden von Levelstart bis zum Verlust oder vollständigen Abschluss von **sechs realen Wellen** gespielt. Als Sieg zählt ausschließlich `wave=6`, `mode=won`, `bossDefeated=true`, `bossEscaped=false` und `hp>0`.

**Suchbudget erschöpft / kein Sieg gefunden** ist ausdrücklich keine Unlösbarkeitsbehauptung. Der Solver ist derzeit nur eine Heuristik für Mine, Fabrik und MG in Kapitel 1 und kann gute Karten übersehen. Er versucht zusätzliche Netze und vollständig versorgte MG-Stellungen in den Bauphasen. Ein bekannter 6-Wellen-Gewinnplan aus der V0.5-Regressionssuite prüft unabhängig die tatsächliche Engine-Siegfähigkeit des Testharness.

Ergebnisse in `generated/map-sim/results.json`: pro Seed getestete Strategiefamilien, legale Zwischenwellen-Bauaktionen, Gold, HP, Leaks, Munition und Bossstatus; GitHub Actions lädt sie zusammen mit der P0-HTML-Kartenvorschau hoch.

**Offen:** Mehrwert und Trefferquote durch echte Erfolge auf neuen Seeds prüfen, weitere Suchfamilien/Erz-Knoten, Simulation für Kanone und Mörser, automatisierte KI-Kuration, Smartphone- und Nutzertests. Kein Merge nach `main` ohne gesonderte Freigabe.
