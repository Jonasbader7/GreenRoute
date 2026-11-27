# Prüf- und Analyseskripte

Hier liegen die Skripte, mit denen Router, Netz und Web-App geprüft und ausgewertet wurden. Die Zahlen im Produktbericht stammen aus diesen Läufen.

**Wichtig:**
- Die Skripte belegen, *wie* geprüft wurde. Ohne die Rohdaten (amtliche Vermessung MOPUBE, Netzmaster-GeoPackages, Zwischenergebnisse) laufen die meisten nicht. Diese Daten sind zu gross und liegen nicht im Repository.
- Pfade zeigen auf die lokale Projektablage (z. B. `05_Berichte/...`, `04_WebApp/...`); einige wenige sind absolut.
- Die `.js`-Skripte laufen in `node` mit dem Web-Router `bors_router.js` und einer `netz.json`; die `.py`-Skripte in normalem Python (sqlite3, numpy), nicht in QGIS.
- Fast alles wurde **nur im Code** geprüft, nicht vor Ort. Was in QGIS geprüft ist, steht im Haupt-README.
- Keine Token, keine Personendaten.

| Ordner | Datum | Was geprüft oder ausgewertet wurde |
|---|---|---|
| `Validierung_20261028` | 28.10. | Erste Validierung: Breiten gegen Profile, Hinderniskartei, LiDAR-Höhen, Vergleich der Autoreferenz mit OSRM und Google Maps |
| `Analyse_AP1_20261029` | 29.10. | Warum A/B teils längere Routen nehmen als C/D |
| `Analyse_AP2_20261029` | 29.10. | Einrasten-Fix Router V9.2e: Web-Router (node) gegen Python-Router, Parität |
| `Pruefung_WebApp_V5_20261031` | 31.10. | Prüfprotokoll Web-App V5: 32 Routen Segment für Segment, unabhängige Breitenprüfung |
| `Validierung_Prioritaet_20261101` | 1.11. | Welche ungeklärten Abschnitte zuerst prüfen (Rangliste); `b2_ortho_skala.py` misst Breiten am Orthofoto SWISSIMAGE |
| `Abgleich_Tiefbauamt_20261105` | 5.11. | Plan «Höchstgewicht» des Tiefbauamts georeferenziert und den Abschnitten zugeordnet |
| `Abgleich_Geoportal_Stadt_20261105` | 5.11. | Geoportal Stadt Bern (Poller, Baustellen, Bus) gegen das Netz |
| `Benchmark_REF_20261105` | 5.11. | 291 Vergleiche: Wie oft führt eine normale Auto-Route ein Einsatzfahrzeug über einen gesperrten Abschnitt |
| `Sensitivitaet_20261105` | 5.11. | Sensitivität der Netzmaster-Parameter (Spiegelabstand, k, Reserven) |
| `Stichprobe_Validierung_20261105` | 5.11. | Plan einer blinden Stichprobe (160 Abschnitte) mit Auswertung nach Clopper-Pearson; nicht durchgeführt |
| `Realitaetstest_WebApp_20261106` | 6.11. | Router-Invarianten mit 300 Zufallspaaren (`invarianten2.js` ist die korrigierte Fassung) |
| `Bruecken_Orthofoto_20261106` | 6./7.11. | Brücken am Orthofoto nachgemessen, Identitätstest Live-Baustellen |
| `OSM_Mobiliar_20261106` | 6.11. | Kandelaber und Signale aus OpenStreetMap: Wirkung auf Breite und Spiegel |
| `Beispiele_Fahrzeugvergleich_20261108` | 8.11. | Suche der vier Beispiele S1–S4 (Höhe, Gewicht, Breite, Kurve) und Modell «fährt wie A, wendet» |
| `Breite_V9_4_20261110` | 10./11.11. | Breite V9.4 und Fahrkorridor: Volllauf-Prüfung, Netzmaster-Vergleich, Web-Regression, Engpässe |
