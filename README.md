# Forgefront · V0.1

Spielbarer 2D-Browserprototyp mit Rohstoffförderung, Produktion und Tower Defense.

## Bedienung
1. **Mission starten**, dann **MG-Turm** auswählen und direkt neben die vorhandene Anlage setzen.
2. **Welle starten**: Gegner folgen der markierten Route, Türme greifen automatisch an.
3. Die Fabrik verarbeitet **1 Metall zu 2 Munition alle 2,5 Sekunden**. Mit **Pausieren** sparst du Metall für Gebäude.
4. Eine zusätzliche Mine darf ausschließlich auf einem **goldenen Erzfeld** errichtet werden.
5. Fünf Wellen überleben, bevor die Basis 0 Lebenspunkte hat.

**Tastatur:** 1 = MG, 2 = Mine, 3 = Fabrik, Leertaste = Welle starten, Esc = Bauauswahl verlassen.

## Technik
Die erste Testversion ist bewusst in einer einzigen `index.html` gehalten (HTML, CSS, Vanilla JS, Canvas 2D). Kein Backend und keine Bibliotheken nötig. Auf Mobilgerät und Desktop nutzbar. V0.1: 8 × 10 Raster, 3 Gebäude, 2 Ressourcen, 5 Wellen.

## GitHub Pages veröffentlichen
Im Repository **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save** wählen. Der Code liegt bereits auf `main`. Anschließend wird GitHub einen öffentlichen Spiellink anzeigen.

Der Gameplay-Prototyp ist intern simuliert getestet. Externe Spielertests und abschließendes Balancing folgen.