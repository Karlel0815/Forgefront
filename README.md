# Forgefront V0.1.2 – durchgehende Echtzeit

Mobiler 2D-Tower-Defense-Prototyp mit Rohstoffwirtschaft. Auf Basis eines echten Spieltests wurde das frühere Phasenmodell zugunsten **durchgehender Echtzeit** ersetzt.

## Spielablauf

1. Nach **MISSION STARTEN** läuft das Spiel sofort in Echtzeit.
2. Die **erste Gegnerwelle kommt nach 10 Sekunden**, vier weitere folgen automatisch jeweils **32 Sekunden** später.
3. **Bauen und Fabrik ein-/ausschalten sind jederzeit möglich**, auch wenn Gegner auf dem Spielfeld sind.
4. Die Mine fördert kontinuierlich Metall, die Munitionsfabrik verbraucht Metall und produziert Patronen.
5. **PAUSE** hält Gegner, Wellen-Countdown und Produktion an. Du darfst während der Pause Gebäude platzieren; Warten erzeugt aber keine zusätzlichen Rohstoffe.
6. Fünf Wellen überleben, bevor das HQ 0 Lebenspunkte erreicht.

Die bisherige Pausenzeit zwischen Wellen sowie der frühere Bonus von 16 Metall je Wellenabschluss wurden entfernt. Mit diesen Regeln dauern erfolgreiche Testläufe ungefähr 2,5–3 Minuten simulierter Spielzeit.

## Steuerung und Wirtschaft

- Einen **MG-Turm (24 Metall)** auswählen und an ein bestehendes Gebäude angrenzend platzieren.
- Zusätzliche **Minen (22 Metall)** dürfen nur auf goldenen Erzfeldern gebaut werden.
- Eine weitere **Fabrik (18 Metall)** ist neben vorhandenen Gebäuden baubar.
- Mine: **+1 Metall alle 2 s**, solange das Spiel läuft.
- Fabrik bei eingeschaltetem Zustand: **−1 Metall, +2 Munition alle 2,5 s**, solange das Spiel läuft.
- Alle Türme verbrauchen Munition zum Schießen.
- Der Kernkonflikt: Metall entweder in Bauwerke investieren oder zu Munition verarbeiten.
- Tastatur: **1/2/3** für Gebäude, **Leertaste** Pause/Fortsetzen, **Esc** Auswahl aufheben.

## Technik

Vanilla HTML, CSS, JavaScript und Canvas 2D, gebündelt in `index.html`. Keine externen Bibliotheken, Anmeldung oder Server. GitHub-Repository: https://github.com/Karlel0815/Forgefront.

## Veröffentlichung

GitHub Pages in den Einstellungen mit **Deploy from a branch → main → /(root)** aktivieren. Die neue Version ist auf dem `main`-Branch. Für Versionstests kann ein commitfixierter CDN-Link verwendet werden, um alte gecachte Versionen auszuschließen.

## Prüfstatus

Automatische Simulationen bestanden: erster Wellenstart nach 10 s, automatische Folgewellen, Fabrikumschalten und Turmbau während der Gefechte, Pause ohne Weiterlaufen der Produktion, Sieg nach Welle 5 mit zwei Türmen sowie Niederlage ohne Verteidigung. Ein neuer **echter Mobil-/Spielspaßtest** steht noch aus.
