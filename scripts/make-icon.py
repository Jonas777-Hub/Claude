# Erzeugt das KALORA-App-Icon (PNG) in mehreren Größen:
# grüner Verlauf, weißer Kalorien-Ring (zu 3/4 gefüllt) und ein frisches Blatt in der Mitte.
import math, sys
from PIL import Image, ImageDraw, ImageFilter

S = 2048                      # Arbeitsgröße (Supersampling für glatte Kanten)
out = sys.argv[1] if len(sys.argv) > 1 else 'public'

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * max(0, min(1, t))) for i in range(3))

# ---------- Hintergrund: Verlauf Hellgrün → Kalora-Grün → Türkis ----------
grad = Image.new('RGB', (256, 256))
gp = grad.load()
c1, c2, c3 = (110, 231, 150), (34, 197, 94), (13, 148, 136)
for y in range(256):
    for x in range(256):
        t = (x * 0.45 + y * 0.55) / 255
        gp[x, y] = lerp(c1, c2, t / 0.5) if t < 0.5 else lerp(c2, c3, (t - 0.5) / 0.5)
bg = grad.resize((S, S), Image.BICUBIC).convert('RGBA')

glow = Image.new('L', (S, S), 0)
ImageDraw.Draw(glow).ellipse((-S * .3, -S * .35, S * .6, S * .5), fill=90)
glow = glow.filter(ImageFilter.GaussianBlur(S * .12))
bg = Image.composite(Image.new('RGBA', (S, S), (255, 255, 255, 255)), bg, glow)

layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(layer)
cx, cy = S / 2, S / 2
R, W = S * 0.315, S * 0.072          # Ring-Radius (Mitte der Linie) und Linienstärke
box = (cx - R - W / 2, cy - R - W / 2, cx + R + W / 2, cy + R + W / 2)

# Ring-Spur (halbtransparent) und gefüllter Teil (weiß), 270° ab 12 Uhr im Uhrzeigersinn
d.ellipse(box, outline=(255, 255, 255, 80), width=int(W))
d.arc(box, start=-90, end=180, fill=(255, 255, 255, 255), width=int(W))
def pt(deg, rad=R): a = math.radians(deg); return cx + rad * math.cos(a), cy + rad * math.sin(a)
for deg in (-90, 180):                  # runde Enden
    x, y = pt(deg); d.ellipse((x - W / 2, y - W / 2, x + W / 2, y + W / 2), fill=(255, 255, 255, 255))
x, y = pt(180); k = W * 0.30           # oranger Akzentpunkt am Ende
d.ellipse((x - k, y - k, x + k, y + k), fill=(251, 191, 36, 255))

# ---------- Blatt (Spitzoval aus zwei Kreisbögen), um 45° geneigt ----------
leaf = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ld = ImageDraw.Draw(leaf)
L = S * 0.20                            # halbe Blattlänge
bulge = 0.62                            # Bauchigkeit
pts_top, pts_bot = [], []
for i in range(0, 101):
    t = -1 + 2 * i / 100                # entlang der Längsachse
    wdt = L * bulge * (1 - t * t) ** 0.85
    pts_top.append((cx + t * L, cy - wdt))
    pts_bot.append((cx + t * L, cy + wdt))
ld.polygon(pts_top + pts_bot[::-1], fill=(255, 255, 255, 255))
# Mittelader und Seitenadern (in Grün „ausgeschnitten")
vein = (34, 197, 94, 255)
ld.line([(cx - L * 0.82, cy), (cx + L * 0.78, cy)], fill=vein, width=int(S * 0.016))
for s in (-0.35, 0.05, 0.42):
    for sign in (-1, 1):
        x0 = cx + s * L
        ld.line([(x0, cy), (x0 + L * 0.28, cy + sign * L * 0.30)], fill=vein, width=int(S * 0.011))
# Stiel
ld.line([(cx - L * 0.98, cy), (cx - L * 1.32, cy + L * 0.12)], fill=(255, 255, 255, 255), width=int(S * 0.026))
leaf = leaf.rotate(40, center=(cx, cy), resample=Image.BICUBIC)

layer = Image.alpha_composite(layer, leaf)
# leichter Schatten unter Ring & Blatt für Tiefe
shadow = layer.split()[3].filter(ImageFilter.GaussianBlur(S * 0.012)).point(lambda v: v * 0.22)
shade = Image.new('RGBA', (S, S), (6, 78, 59, 0)); shade.putalpha(shadow)
bg = Image.alpha_composite(bg, shade.transform((S, S), Image.AFFINE, (1, 0, 0, 0, 1, -S * 0.012)))
bg = Image.alpha_composite(bg, layer).convert('RGB')

for size, name in [(1024, 'icon-1024.png'), (512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
    bg.resize((size, size), Image.LANCZOS).save(f'{out}/{name}', optimize=True)

mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * 0.225), fill=255)
rounded = Image.new('RGBA', (S, S), (0, 0, 0, 0)); rounded.paste(bg, (0, 0), mask)
rounded.resize((512, 512), Image.LANCZOS).save(f'{out}/icon-rounded.png', optimize=True)
print('ok')
