# iPhone-Hintergrundbild im Kalora-Stil (1290 × 2796, iPhone 15/16 Pro Max)
import math, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1290, 2796
out = sys.argv[1]
icon_path = sys.argv[2]
F_BOLD = '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf'
F_SEMI = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * max(0, min(1, t))) for i in range(3))

# Verlauf: dunkles Waldgrün oben → Kalora-Grün → Türkis unten
g = Image.new('RGB', (1, 512))
for y in range(512):
    t = y / 511
    g.putpixel((0, y), lerp((6, 64, 43), (22, 163, 74), t / 0.55) if t < 0.55 else lerp((22, 163, 74), (13, 148, 136), (t - 0.55) / 0.45))
bg = g.resize((W, H), Image.BICUBIC).convert('RGBA')

# weiche Lichtflecken
light = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ld = ImageDraw.Draw(light)
ld.ellipse((-400, 900, 900, 2200), fill=(134, 239, 172, 70))
ld.ellipse((700, 1600, 1700, 2700), fill=(253, 224, 71, 40))
ld.ellipse((300, -300, 1500, 800), fill=(45, 212, 191, 45))
bg = Image.alpha_composite(bg, light.filter(ImageFilter.GaussianBlur(220)))

# dezente Begriffe & Werte als Deko (Kalorien-Welt)
deco = Image.new('RGBA', (W, H), (0, 0, 0, 0))
dd = ImageDraw.Draw(deco)
items = [('kcal', 140, 820, 70), ('Protein', 880, 760, 52), ('Kohlenhydrate', 90, 990, 44), ('Fett', 1040, 1020, 54),
         ('Ballaststoffe', 700, 2520, 42), ('Zucker', 130, 2440, 46), ('2.380', 960, 900, 56), ('172 g', 1010, 2380, 48), ('H₂O', 120, 2620, 50)]
for text, x, y, s in items:
    dd.text((x, y), text, font=ImageFont.truetype(F_SEMI, s), fill=(255, 255, 255, 46))
# kleine Ringe als Deko
for x, y, r, frac in [(1120, 640, 46, .7), (170, 1840, 40, .45), (1090, 2040, 34, .85)]:
    dd.ellipse((x - r, y - r, x + r, y + r), outline=(255, 255, 255, 40), width=9)
    dd.arc((x - r, y - r, x + r, y + r), -90, -90 + 360 * frac, fill=(255, 255, 255, 90), width=9)
bg = Image.alpha_composite(bg, deco)

# Icon-Motiv groß in der Mitte (ohne Kachel, mit Schein)
icon = Image.open(icon_path).convert('RGBA').resize((760, 760), Image.LANCZOS)
mask = Image.new('L', icon.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, 759, 759), radius=170, fill=255)
cx, cy = W // 2, 1530
halo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(halo).ellipse((cx - 520, cy - 520, cx + 520, cy + 520), fill=(187, 247, 208, 90))
bg = Image.alpha_composite(bg, halo.filter(ImageFilter.GaussianBlur(120)))
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle((cx - 380, cy - 340, cx + 380, cy + 420), radius=170, fill=(2, 44, 34, 140))
bg = Image.alpha_composite(bg, shadow.filter(ImageFilter.GaussianBlur(60)))
bg.paste(icon, (cx - 380, cy - 380), mask)

d = ImageDraw.Draw(bg)
def center(text, y, font, fill):
    w = d.textlength(text, font=font)
    d.text(((W - w) / 2, y), text, font=font, fill=fill)
center('KALORA', 2050, ImageFont.truetype(F_BOLD, 150), (255, 255, 255, 255))
center('TRACK.  ANALYSE.  ERFOLG.', 2235, ImageFont.truetype(F_SEMI, 46), (187, 247, 208, 255))
bg.convert('RGB').save(out, quality=94)
print('ok')
