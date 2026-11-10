# KALORA – Track. Analyse. Erfolg.

Intelligente Ernährungs-, Rezept- und Einkaufs-App: Kalorien zählen mit KI-Fotoerkennung, passende Rezepte mit echten Fotos, lernende Empfehlungen und geteilte Einkaufslisten in Echtzeit.

Mobile First (Android & iPhone, als App installierbar), Apple-ähnliches Design, Hell- und Dunkelmodus, Hauptfarbe `#22C55E`.

## Schnellstart

```bash
npm install
cp .env.example .env          # ANTHROPIC_API_KEY eintragen (für KI-Funktionen)
npm run dev                   # App: http://localhost:5173  (API: :8787)
```

Produktion:

```bash
npm run build && npm start    # alles auf http://localhost:8787
```

Voraussetzung: Node.js ≥ 22.13 (nutzt die eingebaute SQLite-Datenbank `node:sqlite`).

## Funktionen

| Bereich | Was es kann |
|---|---|
| **Onboarding** | Geschlecht, Alter, Größe, Gewicht, 5 Aktivitätslevel, Ziel (Abnehmen / Halten / Muskelaufbau), optional Wunschgewicht + Zieltermin → berechnet Kalorien, Protein, Fett, Kohlenhydrate, Zuckerlimit, Ballaststoffe, Wasser (Mifflin-St Jeor) |
| **Dashboard** | Verbraucht / Verfügbar / Tagesziel, „Heute noch verfügbar", Ringdiagramme (Grün = im Ziel, Orange = fast erreicht, Rot = überschritten), großer Kamera-Button, „Heute essen" (je 1 Frühstück, Mittag, Abend, Snack passend zu den offenen Makros), Wasser-Tracker |
| **KI-Fotoerkennung** | Foto → Claude erkennt Gericht + Lebensmittel, schätzt Portion, berechnet alle Makros. Danach bestätigen, Portion anpassen oder Lebensmittel bearbeiten → landet im Tageskonto |
| **Tagebuch** | Alle Einträge pro Tag nach Frühstück / Mittag / Abend / Snacks mit Foto, Name, Kalorien und Makros; bearbeiten, löschen, Vortage ansehen |
| **Suche** | ~200 Grundnahrungsmittel + Millionen Markenprodukte über Open Food Facts, Barcode-Scan |
| **Rezepte** | 70 Rezepte mit **Originalfoto genau dieses Gerichts**; Auswahl über Hauptzutat („Was möchtest du essen?"), Suche „Worauf hast du Lust?", Mahlzeit-Filter, Kalorien/Protein/Kochzeit/Ernährungsform, 15 Kategorien, 5 Sortierungen |
| **Rezeptdetails** | Bildergalerie (wischen, Vollbild, Zoom, eigene Fotos), Personenzahl 1–6 oder eigene → Zutaten & alle Makros werden neu berechnet, Nährwerte pro Portion + gesamt, „Zu meinem Tag hinzufügen", Einkaufsliste, Bewertung 1–10 mit Kommentar |
| **Lernende Empfehlungen** | Bewertung 8–10 → häufiger, 6–7 → normal, < 6 → nicht mehr aktiv empfohlen; Lieblingszutaten, -kategorien und -küchen werden gelernt; Abneigungen („Lebensmittel, die ich nicht mag") filtern Rezepte komplett aus |
| **KI-Rezeptgenerator** | Max. Kalorien, Mindestprotein, Zutaten, Kochzeit, Ernährungsform → Rezept mit Zutaten, Zubereitung und Nährwerten (Claude; ohne Schlüssel eingebauter Offline-Generator) |
| **Einkaufswagen** | Rezepte hinzufügen (gleiche Zutaten werden zusammengeführt), eigene Produkte mit Autovervollständigung, Barcode, Einheiten, Kategorien, Favoriten, Vorratskammer (wird abgezogen), geschätzte Kosten, Ersatzprodukte mit ähnlichen Makros |
| **Gemeinsam einkaufen** | Freigabelink `…/cart/ABCD1234`, Teilen über WhatsApp / Telegram / Signal / E-Mail / SMS / Link; Echtzeit-Sync (WebSocket), abhaken, Personen zuweisen („Für mich"), Aktivitätsverlauf „Wer hat was geändert?", Offline-Warteschlange |
| **Supermärkte** | Suche per Adresse/PLZ/Ort oder Standort (OpenStreetMap) für Edeka, Rewe, Kaufland, Lidl, Aldi, Netto, Penny, Norma, Globus; Vergleich von Entfernung, Verfügbarkeit und Preis, empfohlener Markt |
| **Shopping Assistant** | Produkt im Laden scannen → passt es zum Rezept, zu den Makros, gibt es eine bessere Alternative? |
| **Verlauf** | Tag / Woche / Monat / Jahr: Kalorien-, Gewichts-, Protein-, Fett- und Zuckerverlauf, Tabellenansicht |
| **Gewichtstracker** | Einträge, Diagramm mit Zielgewicht, Fortschritt in %, voraussichtliche Dauer |
| **KI-Coach** | Chat mit Claude auf Basis deiner gespeicherten Daten (Ziele, heute gegessen, Bewertungen, Abneigungen); Rezeptnamen in Antworten sind antippbar |
| **Profil** | Daten, Ziel, Aktivität, Gewicht, Abneigungen, Erinnerungen (Mahlzeiten, Gewicht, Wasser), Hell/Dunkel, Konto, Export, Demo-Daten |

## Rezeptbilder – wie die Echtheit sichergestellt wird

* Jedes Rezept ist über `mealId` mit **genau einem Gericht** in [TheMealDB](https://www.themealdb.com) verknüpft. Das Bild ist das Originalfoto dieses Gerichts – kein Stockfoto, kein KI-Bild, kein Platzhalter.
* Alle 70 Fotos wurden angesehen, und die Zutatenlisten wurden an das angepasst, was auf dem Foto zu sehen ist (z. B. Stroganoff auf Bandnudeln, grünes Curry mit Roti, Burger mit Spiegelei).
* `npm run build-images` holt die Bild-URLs neu und prüft, dass jedes Bild erreichbar ist.
* `npm run verify-images` lässt Claude (Vision) jedes Bild prüfen: Passt es zum Rezept? Sind die Hauptzutaten sichtbar? Passt die Portion? Ist die Bildqualität ausreichend?

## Architektur

```
src/                 React-Frontend (Vite, PWA)
  data/foods.js      Lebensmitteldatenbank (Nährwerte /100 g, Kategorien, Preise)
  data/recipes.js    Rezeptdatenbank (Nährwerte werden aus Zutaten berechnet)
  lib/nutrition.js   Kalorienrechner, Ampellogik
  lib/recommend.js   lernende Empfehlungen, „Heute essen"
  lib/shopping.js    Zusammenführen, Mengen, Kosten, Ersatzprodukte, Supermarktvergleich
  store.jsx          Zustand: offline in localStorage, Cloud-Sync, Echtzeit-Einkaufswagen
server/
  index.js           Express-API + WebSocket
  db.js              SQLite-Schema (users, user_state, carts, cart_items, cart_activity, recipe_ratings)
  auth.js            scrypt-Passwort-Hashes, signierte Tokens
  ai.js              Claude: Fotoanalyse, Coach, Rezeptgenerator, Bildprüfung
tests/               Logik-Tests (npm test)
```

Die App läuft auch **ohne Konto und offline** (Daten im Browser). Mit Konto wird alles in der Cloud gespeichert und zwischen Geräten synchronisiert.

## Ehrliche Grenzen

* **Supermarkt-Preise und -Verfügbarkeit** sind Schätzungen (Preisindex und Sortiment der Ketten). Die Ketten stellen keine öffentlichen Live-Daten bereit. Die Standorte sind echt (OpenStreetMap).
* **Online bestellen (Premium):** REWE, Knuspr und Bringoo bieten keine öffentliche Warenkorb-API. Kalora kopiert die Liste und öffnet den Shop.
* **Bildergalerie:** Pro Gericht gibt es ein echtes Originalfoto. Weitere Bilder kommen von deinen eigenen Fotos („Mein Ergebnis fotografieren"). Portionsabhängige Fotos werden nicht künstlich erzeugt; stattdessen zeigt ein Hinweis die Portionsgröße (klein / mittel / Familie).
* **Erinnerungen** erscheinen, solange die App geöffnet bzw. als PWA installiert ist (kein Push-Server).
* **Barcode-Live-Scan** braucht die BarcodeDetector-API (Chrome/Android). Auf dem iPhone wird die Nummer eingetippt.
* Ohne `ANTHROPIC_API_KEY`: Fotoerkennung inaktiv (manuelle Suche funktioniert), Coach und Rezeptgenerator laufen regelbasiert.

Rezeptfotos: © TheMealDB.com · Produktdaten: Open Food Facts (ODbL) · Karten: © OpenStreetMap-Mitwirkende
