# Forgefront V0.2.0 – KISS-Logistik-Puzzle

Spielbarer Browser-Prototyp (Smartphone und Desktop). Stand: 09.10.2026.

## Start

- `index.html` im Ordner mit `style.css` und `game.js` öffnen.
- Die herunterladbare `Forgefront_V0.2.0.html` enthält alles in einer Datei.
- Optional interaktives, neutrales Tutorial (sechs Schritte, überspringbar und über `? HILFE` wiederholbar).
- Zum Bauen unten **BAUEN** öffnen. Das Rohrwerkzeug kann mit dem Finger gezogen werden. Zwei Finger zoomen.

## KISS-Wirtschaft (neu)

- Rohre und Brücken verbinden Gebäude, kosten Gold, haben **keine Transportkapazitätsgrenze**.
- Es werden **keine Metallpakete oder Einzelpatronen** durch Leitungen verschoben. Einheiten werden als kontinuierliche Rate/s je Netz bilanziert.
- Erzmine liefert bis zu 1 Metall/s; Fabrik benötigt 0,4 Metall/s und erzeugt bis zu 1,2 Munition/s; MG braucht für volles Dauerfeuer bis ca. 1,75 Munition/s.
- Metall wird gleichmäßig nach Bedarfsprozent auf erreichbare Fabriken verteilt; die daraus resultierende Munition ebenso auf versorgte MGs. Die Netze werden nur bei tatsächlicher Rohrverbindung geteilt, weder Verbindung noch Produktivität teleportieren.
- In der **Bauphase** zeigt jedes Gebäude sofort eine **Prognose als Prozentzahl** in Signalfarbe, auch ohne laufende Produktion. Nach jeder Bau-/Rohr-/Abriss-Aktion wird die Bilanz aktualisiert. Eine Mine unter 100 % Auslastung hat eventuell einfach Reserve – kein Fehler.
- In der **Kampfphase** zeigt ein MG den realen Versorgungsgrad unter Berücksichtigung derzeit schießender MGs. Untätige MGs reservieren keine Munition. MG-Feuerrate wird bei Mangel entsprechend gedrosselt.
- Gebäude antippen: Details zu bereitgestellter Rate, Maximum und zur Ursache eines Engpasses.
- Der 10-Sekunden-Vorlauf pro Kampfphase wurde vorerst beibehalten; er ist ein Gegner-Countdown und kein Pakettransport mehr.
- Ressourcenleisten METALL/s und MUN./s sind **Raten, keine Vorräte**.

## Bekannte Grenzen

- Prototyp-Balancing: 180 Startgold, 20 HQ-Leben, Mine 22 Gold, Fabrik 18, MG 24, Rohr 4, Brücke 10. +5 Gold pro Kill und +10 pro Welle.
- 18×20-Felder-Karte, fünf Gegnerwellen + ein Boss mit zweiter Phase. Bauphasen ohne Produktion und ohne Zeitlimit; Kämpfe mit gesperrtem Bauen.
- Keine Speicherung zwischen Seiten-Neuladungen; noch keine zweite Karte und keine Schwierigkeitsauswahl.
- Das Tutorial ist wieder **neutral** und ohne persönliche Spitznamen.
- Die Prozentwerte in der Bauphase sind **Kapazitätsprognosen**, keine gemessenen Vergangenheitswerte.

## Validierung

`node test.cjs`, `node strategies.cjs`, `node onboarding_test.cjs` sowie `python browser_test.py` (mit Playwright/Chromium).
