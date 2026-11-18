"""Baut die Offline-Desktop-Version von Rise aus rise/web/index.html.

Ergebnis: rise/desktop/Rise.html – eine einzige Datei, läuft ohne Internet
(Schriften eingebettet, Desktop-Modus mit Webcam und Leertaste aktiv).

Aufruf:  python3 rise/scripts/build_desktop.py
"""
import re
from pathlib import Path

RISE = Path(__file__).resolve().parent.parent
src = (RISE / "web" / "index.html").read_text(encoding="utf-8")
fonts = (RISE / "scripts" / "fonts" / "embedded.css").read_text(encoding="utf-8")

# Online-Teile entfernen (Google Fonts, Claude-Metadaten)
src = re.sub(r'<link rel="preconnect"[^>]*>\n?', "", src)
src = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\n?', "", src)
src = re.sub(r'<meta name="claude:[^>]*>\n?', "", src)
title = re.search(r"<title>.*?</title>\n?", src).group(0)
src = src.replace(title, "", 1)

head = f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
{title.strip()}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3CradialGradient id='g' cx='.5' cy='1' r='1'%3E%3Cstop offset='0' stop-color='%23ffc56b'/%3E%3Cstop offset='.55' stop-color='%23ff7a3d'/%3E%3Cstop offset='1' stop-color='%23ff4f6d'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='32' height='32' rx='8' fill='%2307080f'/%3E%3Ccircle cx='16' cy='20' r='10' fill='url(%23g)'/%3E%3Crect y='21' width='32' height='11' fill='%2307080f'/%3E%3C/svg%3E">
<style>
{fonts}
</style>
<script>window.RISE_DESKTOP = true;</script>
</head>
<body>
"""
out = head + src + "\n</body>\n</html>\n"
dest = RISE / "desktop" / "Rise.html"
dest.parent.mkdir(exist_ok=True)
dest.write_text(out, encoding="utf-8")
assert "fonts.googleapis" not in out and "http" not in re.sub(r"http://www\.w3\.org/[^\"']*", "", out), "Datei lädt noch etwas aus dem Internet"
print(f"{dest.relative_to(RISE.parent)}  ({len(out) // 1024} KB)")
