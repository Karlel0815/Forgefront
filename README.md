# Forgefront · V0.1.1

Spielbarer 2D-Browserprototyp mit **Phasenstrategie und Echtzeitkampf** (HTML, CSS, Vanilla JavaScript und Canvas 2D).

## So funktioniert eine Runde

1. **Planung:** Keine Produktion und kein Zeitdruck. Baue Gebäude und wähle, ob die Fabrik im nächsten Kampf Munition herstellen soll.
2. **Kampf:** Starte die nächste Welle. Minen und Fabriken produzieren automatisch, Türme greifen an. **Bauen und Fabrikumschaltung sind während des Kampfes gesperrt.**
3. **Wellenende:** Du erhältst **16 Metall** (nach Wellen 1 bis 4). Alle Anlagen stehen wieder still, bis du die nächste Welle startest.
4. **Ziel:** Überlebe fünf Wellen mit deinem Hauptquartier.

## Spielregeln

- Start: 34 Metall, 12 Munition, eine Mine, eine Fabrik, 12 HQ-Lebenspunkte.
- **Mine:** +1 Metall / 2 s in der Kampfphase. Zusätzliche Minen nur auf goldenen Erzfeldern.
- **Fabrik:** -1 Metall und +2 Munition / 2,5 s in der Kampfphase, wenn vor Kampfbeginn aktiviert. Pausieren spart Metall für den nächsten Ausbau.
- **MG-Turm:** 24 Metall; jeder Schuss verbraucht eine Munition und fügt Schaden zu.
- Baue ausschließlich auf freien Feldern direkt neben einem bestehenden Gebäude.
- Während der Planung kannst du unbegrenzt nachdenken. Es gibt keinen kostenlosen Ressourcengewinn durch Warten.

**Tastatur:** 1 = MG, 2 = Mine, 3 = Fabrik, Leertaste = Welle starten, Esc = Bauauswahl aufheben.

## Technik und Veröffentlichung

Die V0.1.1 bleibt absichtlich in einer einzigen `index.html` und erfordert keine externen Bibliotheken oder einen Server. Mobile Touch und Desktop-Maus werden unterstützt.

Um GitHub Pages zu aktivieren: **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**. Code liegt auf `main`.

## Tests

Automatisierte Simulationen: Planung erzeugt nach langem Warten keine Ressourcen; Bauen und Umschalten sind im Kampf gesperrt; Wellenbonus und erneute Planungsphase funktionieren; sowohl Sieg als auch Niederlage über fünf Wellen sind erreichbar. Mobile-Gerätetests und externe Spielspaßtests stehen noch aus.
