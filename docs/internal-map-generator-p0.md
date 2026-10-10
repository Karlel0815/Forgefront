# Interner Forgefront-Kartengenerator – P0.1

**Nur Entwicklungswerkzeug, kein Spielmodus.** Keine Änderungen an `src/game.js`, `index.html`, Kampagnenkarten oder Spielständen.

## Start

```bash
node tools/map-generator.cjs --seed 52741 --count 12 --out generated/map-candidates
node --test tests/map-generator.test.cjs
```

Ergebnisse: `candidates.json` (Seed, Generatorversion, vollständiger Path-/Ore-/HQ-Snapshot und SHA-256-Hash, strukturelle Validierung und mögliche Startaufbauten) sowie `review.html` (interne Mini-Karten).

P0 verwendet **drei bestehende Wege** und verändert nur die Erzcluster. Motive: `front`, `remote`, `split`. Die Bewertung prüft gültige Karten, eine finanzierbare Mine–Fabrik–MG-Anfangsversorgung, Rohrmedien-Konflikte, Straßenbrücken, Goldkosten und MG-Feuerfenster. Die vorgeschlagenen Baupläne sind **nur strukturell** plausibel; das Werkzeug simuliert noch keine sechs Wellen und garantiert keine Siege oder kalibrierte Schwierigkeitsgrade.

In Phase 2 werden ein generischer Strategieplaner, echte Engine-/Bosskill-Läufe mit festen Schwer-Gegnerprofilen und anschließend eine KI-gestützte Kuratierung ergänzt. Danach erst neue Gegnerwege generieren. Kandidaten werden vor einer Veröffentlichung erneut in der Spiel-Engine geprüft und individuell freigegeben. Seed alleine genügt nicht zur langfristigen Reproduktion: vollständige Mapdaten und Hash sichern.
