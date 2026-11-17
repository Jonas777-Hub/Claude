# Drei am Tag

Musik-Spiel für Freunde: Jeden Tag schickt jede Person 3 Spotify-Lieder in die Gruppe. Die anderen hören sie komplett und bewerten sie mit 1–10, Kriterien, Etiketten und Kommentar. Rangliste, beste Lieder, Statistiken.

- Anmelden mit E-Mail und Passwort, gleicher Stand auf jedem Gerät
- Beliebig viele Gruppen mit Einladungslink oder 6-stelligem Code
- Live-Updates, wenn jemand etwas schickt oder bewertet
- Regeln in der Datenbank: max. 3 Lieder pro Tag, kein Lied doppelt, keine eigenen Lieder bewerten, nur Mitglieder sehen eine Gruppe

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Website (Design und Aufbau) |
| `app.js` | App-Logik |
| `config.js` | Supabase-Zugangsdaten (öffentliche Werte) |
| `supabase.sql` | Datenbank: Tabellen, Regeln, Funktionen |
| `vendor/` | Supabase-Bibliothek (supabase-js 2.118.0) |
| `claude-artifact.html` | ältere Version für claude.ai |

## Einrichtung (einmalig, ca. 10 Minuten)

1. **Projekt anlegen:** Auf [supabase.com](https://supabase.com) anmelden → *New project* → Name `drei-am-tag`, Region *Central EU (Frankfurt)*, ein Datenbank-Passwort vergeben (brauchst du nicht weiter).
2. **Datenbank anlegen:** Links *SQL Editor* → *New query* → den kompletten Inhalt von `supabase.sql` einfügen → *Run*. Es muss „Success" erscheinen.
3. **Zugangsdaten eintragen:** *Project Settings* → *API* (bzw. *Data API*/*API Keys*). Die **Project URL** und den **anon public** Key in `config.js` eintragen. Der anon-Key ist öffentlich gedacht; geschützt werden die Daten durch die Regeln aus Schritt 2. Den `service_role`-Key **niemals** eintragen.
4. **Adresse für E-Mail-Links:** *Authentication* → *URL Configuration*:
   - *Site URL*: `https://jonas777-hub.github.io/Claude/drei-am-tag/`
   - *Redirect URLs*: dieselbe Adresse hinzufügen.
5. **Optional:** *Authentication* → *Sign In / Providers* → *Email*: „Confirm email" ausschalten, wenn man ohne Bestätigungs-Mail sofort loslegen soll. Mit eingeschalteter Bestätigung kommen Mails vom Supabase-Standardversand, der nur wenige Mails pro Stunde schickt; für viele Leute später einen eigenen SMTP-Dienst eintragen.

## Veröffentlichen

Die GitHub-Pages-Pipeline (`.github/workflows/pages.yml`) legt den Ordner bei jedem Push auf `main` unter `…/drei-am-tag/` neben KALORA ab.

Lokal testen: `npx serve .` im Ordner `drei-am-tag` (oder jeder andere statische Server) und `http://localhost:3000` öffnen; dann `http://localhost:3000` zusätzlich bei Supabase unter *Redirect URLs* eintragen.
