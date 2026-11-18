"""Erzeugt die Wecktöne (WAV, <30 s, wie von iOS verlangt) und das App-Icon.

Aufruf:  python3 rise/scripts/make_assets.py
"""
import json
import math
import struct
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / "Rise"
SR = 22050
DUR = 28.0  # iOS spielt Alarmtöne bis 30 s


def env(n, attack=0.01, release=0.08):
    a = max(1, min(int(attack * SR), n // 2))
    r = max(1, min(int(release * SR), n // 2))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] = np.linspace(1, 0, r)
    return e


def tone(freq, sec, harmonics=(1.0,), attack=0.01, release=0.08):
    t = np.arange(int(sec * SR)) / SR
    s = sum(h * np.sin(2 * math.pi * freq * (i + 1) * t) for i, h in enumerate(harmonics))
    return s * env(len(t), attack, release)


def silence(sec):
    return np.zeros(int(sec * SR))


def loop(pattern):
    out = np.zeros(0)
    while len(out) < DUR * SR:
        out = np.concatenate([out, pattern])
    return out[: int(DUR * SR)]


def bell(freq, sec):
    t = np.arange(int(sec * SR)) / SR
    partials = [(1, 1.0), (2.0, 0.6), (2.76, 0.4), (5.4, 0.25), (8.9, 0.1)]
    s = sum(a * np.sin(2 * math.pi * freq * p * t) * np.exp(-t * (1.5 + p)) for p, a in partials)
    return s * env(len(t), 0.002, 0.05)


def sounds():
    beep = tone(880, 0.12, (1, 0.3)), silence(0.08)
    klassik = loop(np.concatenate([*beep, *beep, *beep, *beep, silence(0.6)]))

    notes = [523.25, 659.25, 783.99, 1046.5]
    sanft_pat = np.concatenate([tone(f, 0.45, (1, 0.2, 0.05), 0.05, 0.3) for f in notes] + [silence(1.2)])
    sanft = loop(sanft_pat)

    glocke = loop(np.concatenate([bell(660, 1.6), bell(880, 1.6), silence(0.4)]))

    t = np.arange(int(1.2 * SR)) / SR
    f = 600 + 500 * np.sin(2 * math.pi * 0.83 * t)
    sirene = loop(np.sin(2 * math.pi * np.cumsum(f) / SR) * env(len(t), 0.02, 0.02))

    digital = loop(np.concatenate([tone(1320, 0.07), silence(0.05), tone(1320, 0.07), silence(0.05),
                                   tone(1760, 0.14), silence(0.5)]))
    return {"klassik": klassik, "sanft": sanft, "glocke": glocke, "sirene": sirene, "digital": digital}


def normalize(data, peak=1.0):
    return data / (np.max(np.abs(data)) or 1) * peak


RAMP_SEC = 20.0      # so lange dauert es von ganz leise bis volle Lautstärke
START_GAIN = 0.02    # ca. -34 dB: wirklich leise


def crescendo(data):
    """Hauptwecker: beginnt ganz leise, wird gleichmäßig (exponentiell = gefühlt linear) lauter, dann voll."""
    t = np.arange(len(data)) / SR
    gain = np.minimum(1.0, START_GAIN * (1 / START_GAIN) ** (t / RAMP_SEC))
    return normalize(data, 0.95) * gain


def loud(data):
    """Nachwecker: sofort volle Lautstärke, zusätzlich verdichtet, damit er deutlich lauter wirkt."""
    drive = 3.0
    return normalize(np.tanh(normalize(data) * drive) / np.tanh(drive), 0.99)


def write_wav(path, data):
    data = np.clip(data, -1, 1)
    pcm = (data * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def icon():
    size = 1024
    img = Image.new("RGB", (size, size))
    top, bottom = (255, 140, 66), (124, 58, 237)
    px = img.load()
    for y in range(size):
        k = y / (size - 1)
        c = tuple(int(top[i] * (1 - k) + bottom[i] * k) for i in range(3))
        for x in range(size):
            px[x, y] = c
    d = ImageDraw.Draw(img)
    cx, cy, r = size // 2, int(size * 0.62), int(size * 0.26)
    d.pieslice([cx - r, cy - r, cx + r, cy + r], 180, 360, fill=(255, 236, 179))
    for i in range(9):
        a = math.pi + i * math.pi / 8
        x1, y1 = cx + math.cos(a) * r * 1.25, cy + math.sin(a) * r * 1.25
        x2, y2 = cx + math.cos(a) * r * 1.6, cy + math.sin(a) * r * 1.6
        d.line([x1, y1, x2, y2], fill=(255, 236, 179), width=34)
    d.rectangle([size * 0.15, cy + 10, size * 0.85, cy + 46], fill=(255, 236, 179))
    out = ROOT / "Assets.xcassets" / "AppIcon.appiconset"
    img.save(out / "icon-1024.png")
    (out / "Contents.json").write_text(json.dumps({
        "images": [{"filename": "icon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}],
        "info": {"author": "xcode", "version": 1},
    }, indent=2))
    (ROOT / "Assets.xcassets" / "Contents.json").write_text(json.dumps({"info": {"author": "xcode", "version": 1}}, indent=2))


if __name__ == "__main__":
    for name, data in sounds().items():
        write_wav(ROOT / "Sounds" / f"{name}.wav", crescendo(data))
        write_wav(ROOT / "Sounds" / f"{name}_laut.wav", loud(data))
    icon()
    print("fertig")
