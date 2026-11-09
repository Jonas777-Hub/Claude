# LichtWerk – Bilder automatisch bearbeiten

Du lädst ein Bild hoch. Links siehst du das **Original**, rechts **5 Vorschläge**, wie es besser aussehen könnte.
Das Motiv bleibt dabei gleich, geändert werden nur Belichtung, Farben, Kontrast, Schwarz-Weiß, Schärfe und so weiter.

## Funktionen

- **5 Vorschläge pro Bild.** Immer dabei sind eine natürlich optimierte Version, eine deutlich **schärfere** Version und eine **Schwarz-Weiß**-Version. Dazu kommen zwei Stile, die dir gefallen (zum Beispiel warm, kühl, lebendig, moody, vintage oder Kino-Look).
- **Wunschzeile oben.** Du schreibst einfach rein, was du willst, zum Beispiel:
  *„Gefällt mir, aber schneid den Mann im Hintergrund raus, mach es wärmer und zoom etwas rein.“*
  Der Wunsch gilt für den Vorschlag, der gerade ausgewählt ist (orange umrandet). Mit ↶ machst du die letzte Änderung rückgängig.
- **Bewerten und Stil lernen.** Mit ♥ und 1–5 Sternen bewertest du die Vorschläge. Die App merkt sich deine Lieblingsstile.
  Beim nächsten Bild stehen sie **ganz oben** und sind mit **„★ Dein Stil“** markiert. Die anderen Vorschläge bekommst du trotzdem.
- **Großansicht mit Vorher/Nachher-Regler.** Doppelklick oder ⤢ auf einem Vorschlag öffnet sie.
- **Objekte entfernen.** Entweder per Text („entferne die Person links“, mit Claude), oder in der Großansicht mit **✂ Objekt entfernen** einen Rahmen ziehen. Die Stelle wird mit der Umgebung aufgefüllt.
- **Speichern** in voller Auflösung als JPG (bis 4096 px).
- **Dashboard** mit der Zahl der bearbeiteten Bilder, deinen Bewertungen, Favoriten und deinem Stil.

## Starten

Du brauchst Node.js 18 oder neuer.

```bash
npm install
npm start
```

Dann im Browser öffnen: <http://localhost:3000>

### Mit Claude (empfohlen)

Mit einem Anthropic-API-Schlüssel schaut sich Claude jedes Bild an und macht passende Vorschläge.
Außerdem versteht Claude freie Wünsche in der Textzeile, auch „schneid den Mann im Hintergrund raus“. Claude findet die Stelle dann selbst.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Oben rechts steht dann **„● Claude aktiv“**.

### Ohne API-Schlüssel (lokaler Modus)

Die App funktioniert auch ohne Schlüssel. Die Vorschläge werden dann aus einer Analyse des Bildes berechnet
(Helligkeit, Kontrast, Farbstich). Die Textzeile versteht Stichwörter wie *heller, dunkler, schärfer, wärmer, kühler,
schwarz-weiß, mehr Kontrast, kräftigere Farben, vintage, zoom rein, zoom rechts, rauszoomen*. Auch Verstärker wie *viel*
oder *etwas* werden erkannt. Um Objekte zu entfernen, ziehst du in der Großansicht einen Rahmen.

## Technik

| Datei | Aufgabe |
|---|---|
| `server.js` | Express-Server. Liefert die App aus und fragt Claude (`/api/suggest`, `/api/edit`). Claude gibt nur Bearbeitungs-Parameter als JSON zurück. |
| `public/editor.js` | Bild-Engine im Browser: Belichtung, Weißabgleich, Lichter und Tiefen, Kontrast, Sättigung und Dynamik, S/W, Sepia, Fade, Klarheit, Schärfen (Unscharf-Maskierung), Vignette, Zuschnitt, Objekt-Entfernung |
| `public/presets.js` | Lokale Vorschläge und Stichwort-Erkennung für die Textzeile |
| `public/prefs.js` | Bewertungen und Stil-Lernen (gespeichert im Browser, `localStorage`) |
| `public/app.js` | Oberfläche |

Die Pixel werden immer lokal im Browser bearbeitet. Mit Claude wird nur eine verkleinerte Kopie (max. 1024 px) zur Analyse geschickt.

## Grenzen

- Das Entfernen von Objekten füllt die Stelle aus der Umgebung auf. Das klappt gut bei ruhigem Hintergrund
  (Himmel, Wand, Wiese) und eher kleinen Objekten. Vor Kanten oder Mustern bleiben sichtbare Spuren.
- Neue Dinge ins Bild malen oder hinzufügen geht nicht.
- Die gelernten Vorlieben gelten pro Browser. Über „zurücksetzen“ im Dashboard löschst du sie.
