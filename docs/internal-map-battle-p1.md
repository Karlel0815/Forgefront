# Forgefront – interner Engine-Testspieler P1

Phase 2 ausschließlich im Entwicklungsbranch; keine Änderung von src/game.js oder öffentlicher Kampagne.

Ausführen:
  node tools/map-battle.cjs --count 1 --seed 52741 --budget 3
  node --test tests/map-battle.test.cjs

Testkarten-Daten werden ausschließlich innerhalb einer kurzlebigen Node-VM in MAP_BLUEPRINTS[0] eingesetzt. Als Kampfprofil wird für alle Geometrien stets Schwer, Kapitel 1 und challenge 0 verwendet. Die echte Forgefront-Engine führt Goldausgaben, Bauen, Produktion, Feuern, Gegnerbewegung, Wellen und Bosskampf aus. Es werden KEINE Game-Siegflags oder Bosswerte gesetzt.

Solver: begrenzte, voneinander abweichende vollständig finanzierte Startnetze aus P0 und reale Käufe von unabhängigen Produktionsnetzen und MGs zwischen Wellen. Jeder geprüfte Bauvorgang wird protokolliert. Kein Sieg im getesteten Suchbudget beweist nicht, dass die Karte unlösbar ist.

Ein Sieg wird nur verifiziert, falls sechs Wellen gespielt wurden, der Boss tatsächlich getötet wurde, kein Boss entkam, HQ noch Lebenspunkte hat und die Munitionserzeugung die Ausgaben deckt. Schwierigkeitsklasse nicht kalibriert.

Berichte: battle-report.json und battle-review.html sowie P0 candidates.json / review.html. GitHub-CI archiviert die Ergebnisse als DEV-Artefakt. Die originalen Kampagnenkarten, Spielstände und main/Pages bleiben unverändert.

Testkontrollen: bestehender legaler 6-Wellen-MG-Plan muss erneut real gewinnen; ein leerer Aufbau darf nie als Sieg zählen. Danach werden generierte Erzvarianten mit begrenzter Strategieanzahl getestet.

Ausstehend: Verbesserte Strategie-Suche, echte Erfolgsquote an vielen Seeds, KI-Critic, neue Gegnerwege, Mobile-Endgeräteprüfung. Übernahme in die Kampagne nur nach persönlicher Bewertung und separater Veröffentlichungsgenehmigung.