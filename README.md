# Forgefront V0.1.9 – Tutorial & MAX/IST-Industriediagnose

**Stand:** 09.10.2026 · Spielbarer, eigenständig lauffähiger Browser-Prototyp (Smartphone/PC). **V0.1.8 bleibt als Vorversion erhalten.**

## Spielen

- `index.html` im Repo-Root ist eine **vollständige Einzeldatei** (HTML, CSS, JS). Im Ordner `src/` sind die gleichen Quellen als `index.html` + `style.css` + `game.js` bearbeitbar. Das Google-Drive-ZIP enthaelt ausserdem die automatisierten Tests.
- Beim ersten Start erscheint die Begrüßung **„Hallo Asphaltgeschoss 😜“**, gefolgt vom kurzen Scherz, dass Erzminen Metall fördern und nicht explodieren.
- **Tutorial starten** führt durch 6 Aktionen: Erzmine auf Erz, Fabrik, Metallverbindung, MG, Munitionsverbindung und Welle starten. Der Fortschritt wird an tatsächlichen Gebäuden und Rohrverbindungen geprüft. Direkt benachbarte Gebäude gelten als verbunden.
- Das Tutorial kann **übersprungen** und während jeder Bauphase über **? HILFE** wiederholt werden. Während einer Kampfphase ist Bauen gesperrt und das Tutorial kann erst wieder in einer Bauphase geöffnet werden.
- **Erzmine** statt „Mine“ im Baumenü, mit der Angabe **„Metall 1/s“**.
- Karte mit einem Finger verschieben und mit zwei Fingern zoomen. Unten BAUEN aufklappen, Werkzeug wählen, setzen beziehungsweise Rohre ziehen.

## Produktionsoptimierung: MAX / IST

- Über jeder Erzmine, Fabrik und jedem MG steht eine zweizeilige Leistungsanzeige: **IST / MAX** (Einheiten pro Sekunde), farbig nach Betriebszustand und mit kleinem Auslastungsbalken.
- **Antippen eines Gebäudes ohne aktives Bauwerkzeug** zeigt eine große Detailkarte mit MAX, IST, Auslastung und lesbarer Engpassdiagnose. Bei ausgewähltem Bauwerkzeug lassen sich vorhandene Gebäude ebenfalls antippen (außer mit Radierer).
- **MAX ist die dauerhaft erreichbare Nennleistung**, **IST ist die durchschnittlich tatsächlich abgegebene Menge seit Beginn der laufenden Welle**. Während der Bauphase zeigt IST den **Durchschnitt der letzten abgeschlossenen Welle**, explizit als Vergangenheitswert gekennzeichnet. Vor der ersten Welle steht „Noch nicht gemessen“.
- Sollwerte: Erzmine **1 Metall/s**, Fabrik **1,2 Munition/s**, MG **bis zu ca. 1,75 Schuss/s** bei ständigem Ziel und genügender Versorgung.
- Erklärungen bei fehlenden Verbindungen, Materialmangel, bereits unterwegs befindlichen Paketen, vollem Empfänger und Produktionsrückstau. Ein MG ohne Gegner wird nicht irrtümlich als defekt markiert.
- **Wichtig zur Testbeobachtung „Produktion hängt manchmal“:** Bei bis zu drei ausstehenden Munitionspaketen für dasselbe MG stoppt eine Fabrik ihre Auslieferung, wenn noch nicht geschossen wird; dann können auch die Mine und andere Vorstufen warten. Das ist ein geplanter Rückstau und wird als solcher kenntlich gemacht. Ein separat gemeldeter Softwarefehler ist dadurch nicht ausgeschlossen; weitere echte Gerätetests sind sinnvoll.

## Weiterhin gültige V0.1.8-Regeln

- 18 × 20 Felder, Start mit 180 Gold, 20 HQ-Leben. Mine 22 Gold, Fabrik 18, MG 24, Rohr 4, Brücke 10. +5 Gold pro Kill und +10 Gold pro abgeschlossener Welle.
- Die Bauphase ist unbegrenzt und **sämtliche Produktion sowie der Pakettransport sind vollständig pausiert**. Nach manuellem Start läuft die Industrie an, Gegner erscheinen nach 10 s. Während des Kampfes ist Bauen, Abriss und Rohrändern gesperrt.
- Keine Zwischenlager in Mine/MG: Metall und Munition werden in realen Paketen über das automatische Rohrnetz geschickt. Eine Fabrik hält höchstens einen laufenden Auftrag und eine wartende Charge.
- 5 Wellen mit steigender Gegnervielfalt, dann 1 Bosswelle mit Phase 2. Optional 1×/1,5×/2× Spieltempo, Pause und Neustart.
- Der Radierer erstattet im aktuellen Testmodus 100 %; spätere Schwierigkeitsgrade sollen andere Faktoren erhalten.

## Tests

- `node test.cjs`: Kernlogik und Transport, striktes Phasenmodell, Gold und Sieger-/Verliererzustände.
- `node onboarding_test.cjs`: Tutorial-Fortschritt, reale Verbindungskontrolle, ?-Hilfe, Überspringen, MAX/IST und Messwerte während der Bauphase.
- `node strategies.cjs`: sechs Wellen und Boss mit unterschiedlichem Verteidigungsaufbau.
- `python browser_test.py`: Basis-UI mit Playwright/Chromium auf 390px/360px/1280px.
- `python browser_intro_test.py`: personalisierte Begrüßung, interaktives Tutorial, Hilfefunktionen und Gebäudeauswertung auf denselben Viewports.

**Quellstand:** Google Drive `KI TEAM – ARBEITSSPEICHER / 01_ACTIVE / FORGEFRONT` und GitHub `Karlel0815/Forgefront`. Frühere Versionen bleiben im Drive bestehen. **Ein echter ungeführter V0.1.9-Test auf Alessandros Smartphone ist noch offen.**
