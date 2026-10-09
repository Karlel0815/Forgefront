# Forgefront V0.4.0 DEV2 – Kapitel 1: MG-Kampagne

**Entwicklungsfassung zur Benutzerabnahme; nicht die Liveversion von GitHub Pages.**
Live auf `main` bleibt V0.3.5, sofern nicht separat freigegeben.

## Drei spielbare MG-Level

1. **Die Versorgung** – Einstieg in die Erz-/Munitionsversorgung entlang der erprobten Karte.
2. **Der Engpass** – eigenständige Gegnerroute mit engem Korridor und verteilt liegenden Erzfeldern: Rohrkosten und MG-Positionierung optimieren.
3. **Die Belagerung** – längere Verteidigungslinien und mehrere Erzgruppen: zwei Versorgungszonen aufbauen und den Abschlussboss aufhalten.

Kapitel 1 erlaubt nur **MG, Erzmine, Munitionsfabrik, Rohre/Brücken**. Kanone und Mörser sind im Bau-UI und in der Spiellogik gesperrt. Die gesamte Kampagne ist mit vier Kapiteln à drei Leveln geplant: Kapitel 2 Kanone, Kapitel 3 Mörser, Kapitel 4 Forschungslabor; diese drei späteren Kapitel sind noch nicht spielbar.

Jede der drei Karten hat eigene, ausbalancierte sechs Gegnerwellen (Wellen 1–5 und Bosswelle), mit Scouts/Normals und einem ungepanzerten, in Phase 2 schnelleren MG-Boss. Zwischen den Wellen gibt es **20 Gold Kapitel-1-Wellenprämie**. Die bestehenden vier Schwierigkeitsgrade beeinflussen weiterhin Startgold, HQ-Leben, Gegner-HP und Spawn-Tempo. Die erste Welle startet nur manuell; Bauphase ohne Zeitlimit.

**Verbindliche Siegbedingung:** Boss muss tatsächlich getötet werden; bei Bossflucht immer Niederlage, keine Sterne und keine Freischaltung. Sterne bei Sieg: 0 Durchbrüche = 3, 1–4 = 2, 5+ = 1. Sterne pro Schwierigkeit getrennt; ein echter Sieg auf beliebiger Schwierigkeit öffnet die nächste Karte. Bei erneutem Spielen bleiben Bestleistungen erhalten.

## Testzugang zu Level 2 & 3

Öffne in der Levelauswahl **Einstellungen → TESTZUGANG · Level 2/3 öffnen**. So kannst du Level 2 und 3 direkt ausprobieren, ohne zunächst Level 1 zu gewinnen. Testzugang gilt nur bis zum nächsten Laden; Siege im Testmodus werden **nicht** im Fortschritt gespeichert. Für regulären Fortschritt das Spiel ohne Testzugang spielen.

## Lokaler Speicher / Migration

`forgefront.progress.v2`: Der neu gestaltete MG-Kampagnenstand ist bewusst ein neuer Spielstand. Aus dem DEV1-Speicher v1 werden nur Design, Schwierigkeit und Tutorialstatus übernommen, **keine alten Sterne**, denn die damaligen Maps und Waffen unterscheiden sich. Der alte Speicher wird nicht gelöscht.

## Qualitätssicherung

```
node tools/build-standalone.cjs
node tools/verify-release.cjs
node --test tests/forgefront.test.cjs
```

Die Node22-Suite enthält unabhängige Bossbedingungen, Produktions-/Munitions-Regressionen, Karteninvarianten, Waffenrestriktionen, Speicher-/Tutorialregeln und **12 komplette MG-only Boss-Sieg-Läufe** (drei Maps × vier Schwierigkeiten). Die mobilen Browser-UI-Tests sind zusätzlich mit Chromium bei 390×844 Pixeln durchgeführt worden. Die dort getestete HTML entspricht `index.html` (Standalone ohne externe Abhängigkeiten).

## Änderungen an der Liveversion

Keine direkten Änderungen an `main` oder GitHub Pages. Diese Version ist ein Dev-Branch-Prototyp, der nach manueller Spielprüfung und separater Veröffentlichungserlaubnis weiterentwickelt oder veröffentlicht werden kann. Echte Touch-Endgeräte und freies menschliches Gameplay sind **nicht** durch synthetische Tests ersetzt.
