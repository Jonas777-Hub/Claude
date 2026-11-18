# Rise – Wecker mit Aufsteh-Aufgaben (iPhone)

Rise ist ein Wecker, den du nicht einfach wegdrücken und weiterschlafen kannst:

1. Du stellst eine Uhrzeit ein (z. B. 6:00), wählst einen Ton und legst Aufgaben fest,
   z. B. **5 Liegestütze, Foto vom Sofa, Foto vom Schreibtisch, Foto vom Sideboard**.
2. Um 6:00 klingelt Rise wie der normale iPhone-Wecker, auch auf dem **Sperrbildschirm**,
   im Lautlos-Modus und im Fokus. Der Ton beginnt **ganz leise** und wird in 20 Sekunden immer lauter,
   bis er voll klingelt. So bleibt er, bis du draufdrückst.
3. Du schaltest ihn ganz normal aus („Aus“ oder „Aufgaben“). Danach erscheint die Liste deiner Aufgaben.
   Ein großer Countdown zeigt, wie viel Zeit du noch hast.
4. Erledigst du **alle Aufgaben innerhalb von 5 Minuten**, ist der Wecker für heute aus
   (bei Wiederholung klingelt er am nächsten eingestellten Tag wieder).
5. Schaffst du es nicht, klingelt er wieder, diesmal **sofort in voller Lautstärke** und stärker verdichtet.
   Nach dem Ausschalten hast du wieder 5 Minuten. Das wiederholt sich, bis alles erledigt ist.
   Die Zeit (1–30 Min., Standard 5) stellst du in den Einstellungen ein.

## Aufgaben und wie sie geprüft werden

| Aufgabe | Prüfung |
|---|---|
| **Liegestütze** | Die Frontkamera zählt mit (Apple Vision erkennt Schulter, Ellbogen und Hand). Stell das iPhone hochkant ca. 1,5 m seitlich neben dich. Gezählt wird, wenn der Arm unten (< 100°) und danach wieder gestreckt (> 150°) ist. |
| **Foto von …** | Die Kamera öffnet sich direkt. Alte Fotos aus der Mediathek zählen also nicht. **Claude (KI)** vergleicht das neue Foto mit deinem **Referenzfoto**. Ohne Referenzfoto prüft Claude, ob das genannte Objekt zu sehen ist. |

Für die KI-Prüfung trägst du in **Einstellungen › KI-Fotoprüfung** einen API-Schlüssel von
[console.anthropic.com](https://console.anthropic.com) ein. Er wird im iPhone-Schlüsselbund gespeichert.
Ohne Schlüssel oder ohne Internet vergleicht Rise das Foto direkt auf dem iPhone mit dem Referenzfoto.
Das ist etwas ungenauer. Tipp: Nimm Referenzfotos aus der Position auf, aus der du morgens fotografierst.

Jede Prüfung ist ein Aufruf an `claude-opus-5-5` mit 1–2 verkleinerten Bildern und kostet nur Bruchteile eines Cents.

## Installieren

Du brauchst:

- einen **Mac mit Xcode 26** oder neuer (kostenlos im Mac App Store)
- ein **iPhone mit iOS 26** oder neuer. Rise nutzt Apples AlarmKit, das gibt es erst ab iOS 26.
- eine Apple-ID. Ein kostenloser Account reicht, dann muss die App aber alle 7 Tage neu installiert werden.
  Mit dem Apple Developer Program (99 €/Jahr) gilt sie ein Jahr.

Schritte:

1. Repository auf den Mac laden und `rise/Rise.xcodeproj` in Xcode öffnen.
2. Links das Projekt **Rise** › Target **Rise** › **Signing & Capabilities**:
   - **Team**: deine Apple-ID auswählen (vorher unter Xcode › Settings › Accounts anmelden)
   - **Bundle Identifier**: `com.CHANGEME.rise` in etwas Eigenes ändern, z. B. `com.deinname.rise`
3. iPhone per Kabel anschließen und oben als Ziel auswählen. Auf dem iPhone muss der **Entwicklermodus** an sein
   (Einstellungen › Datenschutz & Sicherheit › Entwicklermodus).
4. ▶︎ (Run) drücken. Beim ersten Start auf dem iPhone unter Einstellungen › Allgemein › VPN & Geräteverwaltung
   deinem Entwicklerzertifikat vertrauen.
5. Beim Start der App **Wecker** und **Mitteilungen** erlauben, beim ersten Foto die **Kamera**.

## Ausprobieren

- Wecker in der Liste **nach rechts wischen › Testen**: Er klingelt in einer Minute. Sperr das iPhone dabei,
  dann siehst du genau, was dich morgens erwartet.
- Zum schnellen Testen der Wiederhol-Logik in den Einstellungen „Zeit für Aufgaben“ auf 1 Min. stellen.

## Aufbau

```
rise/
├── Rise.xcodeproj         Xcode-Projekt (Ordner Rise/ wird automatisch synchronisiert)
├── Config/Info.plist      Texte für Wecker- und Kamera-Berechtigung
├── Rise/
│   ├── RiseApp.swift            App-Start, Berechtigungen
│   ├── Models.swift             Wecker, Aufgaben, Töne, offener Zustand
│   ├── RiseStore.swift          Speichern (JSON) und Referenzfotos
│   ├── AlarmScheduler.swift     AlarmKit: Wecker, Nachwecker, Testwecker
│   ├── AlarmIntents.swift       Was beim Drücken von „Aus“/„Aufgaben“ passiert
│   ├── ChallengeCoordinator.swift  Die Logik: Aufgaben fällig → Nachwecker → fertig
│   ├── ChallengeView.swift      Aufgaben-Bildschirm und Liegestütz-Zähler
│   ├── PushupDetector.swift     Kamera und Körperhaltungs-Erkennung
│   ├── PhotoVerifier.swift      Fotoprüfung (Claude API und Vergleich auf dem Gerät)
│   ├── AlarmEditorView.swift    Wecker einstellen
│   ├── ContentView.swift        Weckerliste
│   ├── SettingsView.swift       Einstellungen, API-Schlüssel
│   ├── Keychain.swift           Schlüsselbund
│   ├── CameraPicker.swift       Kamera
│   ├── Sounds/*.wav             Wecktöne: <name>.wav (leise → laut) und <name>_laut.wav (Nachwecker)
│   └── Assets.xcassets          App-Icon
└── scripts/make_assets.py Erzeugt Töne und Icon neu
```

## Gut zu wissen

- AlarmKit-Wecker klingeln auch, wenn die App geschlossen ist. Ist das iPhone **komplett ausgeschaltet**,
  klingelt kein Wecker, auch nicht der von Apple.
- **Lautstärke:** Eine App kann die iPhone-Lautstärke nicht selbst hochdrehen. Deshalb steckt das
  „leise → laut“ direkt in den Tondateien. Wie laut „voll“ ist, bestimmt die Wecker-Lautstärke unter
  Einstellungen › Töne & Haptik. Stell sie hoch. iOS spielt einen Weckton höchstens 30 Sekunden am Stück.
  Wiederholt das iPhone den Ton danach, beginnt er wieder leise.
- Ein eigener Ton muss als `.wav`, `.caf` oder `.aiff` (max. 30 s) zweimal in `Rise/Sounds/` liegen (`name.wav` und `name_laut.wav`) und in
  `AlarmSound.all` (`Models.swift`) eingetragen werden.
- Rise wurde ohne Mac geschrieben und noch nicht in Xcode kompiliert. Sollte Xcode beim ersten Build
  einen Fehler melden, schick ihn mir und ich behebe ihn.
