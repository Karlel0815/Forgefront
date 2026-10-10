# Forgefront V0.4.0 DEV3 – 12 Level zum Waffenvergleich

**Entwicklungsbranch, nicht main/Pages.**

Vier Kapitel mit denselben drei Kartenlayouts und denselben Wellenprofilen. Die Fortschritte werden unter eigenen Level-IDs gespeichert: 4 × 3 = 12. Die vorhandenen Sterne aus DEV2 für Kapitel 1 bleiben gültig.

- Kapitel 1: MG.
- Kapitel 2: MG + Kanone (nach drei Siegen in Kapitel 1).
- Kapitel 3: MG + Kanone + Mörser (nach drei Siegen in Kapitel 2).
- Kapitel 4: MG + Kanone + Mörser (nach drei Siegen in Kapitel 3); das Forschungslabor ist noch nicht implementiert.

Bei erstmaligem Abschluss von Level 3 eines Kapitels erscheint ein Kapitelabschluss mit Belohnung. Nur echte Boss-Siege zählen. Bossflucht ist immer Niederlage, ohne Sterne oder Freischaltungen. Testzugang unter Einstellungen öffnet alle zwölf Levels temporär ohne gespeicherte Sterne.

Die Wellenlängen und Difficulty sind in diesem DEV3 gegenüber DEV2 unverändert: damit wir **isoliert den Unterschied durch die neuen Waffen** testen können. Längere Phasen sind ein nachgelagertes Balancing-Thema.

```
node tools/build-standalone.cjs
node tools/verify-release.cjs
node --test tests/*.test.cjs
```
