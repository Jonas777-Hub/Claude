// Verbindung zu Claude.
// - Als geteilter Link (claude.ai): über die "sample"-Fähigkeit der Seite, auf dem Konto des Betrachters.
// - Lokal mit `npm start` und API-Schlüssel: über den eigenen Server (/api/ask).
// Claude liefert nur Parameter (JSON). Die Pixel rechnet immer der Browser.

import { canvasToBlob, canvasToDataUrl, HSL_BANDS } from "./editor.js";
import { STYLE_LABELS } from "./presets.js";

const PARAM_GUIDE = `PARAMETER (alle Zahlen; 0 bzw. false = unverändert):
Licht:
- exposure: Belichtung in Blendenstufen, -3..3 (0.3 = sichtbar heller, 1 = viel heller)
- contrast -100..100, highlights -100..100 (negativ holt helle Bereiche zurück), shadows -100..100 (positiv hellt Schatten auf)
- whites -100..100, blacks -100..100 (negativ = tiefere Schwarztöne)
- blackPoint 0..100, whitePoint 0..100: Tonwertspreizung (höher = Schwarz-/Weißpunkt wird nach innen gezogen, mehr "Pop")
- dehaze -100..100 (positiv entfernt Dunst, negativ macht verträumt/dunstig)
Farbe:
- temperature -100 (kühl/blau)..100 (warm/gelb), tint -100 (grün)..100 (magenta)
- saturation -100..100 (-100 = farblos), vibrance -100..100 (schonende Sättigung)
- hue -180..180: dreht ALLE Farbtöne (Grad)
- hsl: Einzelne Farbbereiche gezielt ändern: {"red":{"h":0,"s":0,"l":0}, ...} für ${Object.keys(HSL_BANDS).join(", ")}.
  h -100..100 verschiebt den Farbton (±30°), s -100..100 Sättigung dieser Farbe, l -100..100 Helligkeit dieser Farbe.
  Beispiele: Himmel blauer = blue.s +40, blue.l -20; Rasen saftiger = green.s +40; Haut wärmer = orange.h -10, orange.s +10.
- splitShadowHue 0..360 + splitShadowAmount 0..100: Schatten einfärben (Color Grading); splitHighlightHue + splitHighlightAmount: Lichter einfärben.
  Farbtöne: 0 Rot, 30 Orange, 50 Gold, 120 Grün, 190 Türkis, 220 Blau, 280 Lila, 330 Pink.
- grayscale 0..100 (100 = Schwarz-Weiß), sepia 0..100, fade 0..100 (matte Schwarztöne)
Details & Effekte:
- sharpen 0..100 (Schärfe), clarity -100..100 (Klarheit/lokaler Kontrast; negativ = weich, z. B. Haut)
- softness 0..100 (ganzes Bild weichzeichnen), grain 0..100 (Filmkorn), vignette -100..100 (positiv dunkle Ränder, negativ helle Ränder)
Geometrie:
- rotate -45..45 (Grad, positiv = im Uhrzeigersinn; das Bild wird automatisch so vergrößert, dass keine Ecken fehlen)
- flipH, flipV: true/false (spiegeln)
- crop {x,y,w,h}: Bildausschnitt im Original (ganzes Bild = {"x":0,"y":0,"w":1,"h":1}). Zum Zoomen kleiner machen, auf das Motiv zentrieren, Seitenverhältnis möglichst beibehalten (x+w<=1, y+h<=1).
Lokale Bereiche:
- regions: Liste (max. 8) von Bereichen, die nur dort geändert werden:
  {"x","y","w","h" (0..1 im Original), "shape":"ellipse"|"rect", "feather":0..100 (weicher Übergang, meist 40-70),
   "invert": true/false (true = alles AUSSERHALB des Bereichs), "exposure":-3..3, "contrast":-100..100,
   "saturation":-100..100, "temperature":-100..100, "blur":0..100}
  Beispiele: Gesicht aufhellen = region um das Gesicht mit exposure 0.4; Hintergrund unscharf = region um die Person mit invert true und blur 60-80;
  Himmel dramatischer = rect über den Himmel mit exposure -0.4 und contrast 30.`;

const COORDS = `KOORDINATEN: x,y = linke obere Ecke, w,h = Breite/Höhe, jeweils 0..1 relativ zum ORIGINALBILD (Bild 1). Schau genau hin und schätze die Position sorgfältig.`;

// ---------- Prompts ----------

export function editPrompt({ params, removals, instruction, history }) {
  const recent = (history || []).slice(-5).map((h) => `- ${h}`).join("\n");
  return `Du bist ein Profi-Bildbearbeiter. Du steuerst einen Bildeditor ausschließlich über JSON-Parameter.

Bild 1 = das ORIGINALBILD (unbearbeitet).
Bild 2 = der AKTUELLE STAND (Original mit den aktuellen Parametern).

${PARAM_GUIDE}

Objekte entfernen:
- removals: Liste NEUER Rechtecke {x,y,w,h} um Objekte, die verschwinden sollen. Das Rechteck muss das Objekt KOMPLETT umschließen, mit etwas Rand. Die Stelle wird mit der Umgebung aufgefüllt (gut bei ruhigem Hintergrund).
- Bereits entfernt: ${JSON.stringify(removals || [])}

${COORDS}

AKTUELLE PARAMETER:
${JSON.stringify(params)}
${recent ? `\nFRÜHERE WÜNSCHE (schon umgesetzt):\n${recent}\n` : ""}
WUNSCH DES NUTZERS:
"${instruction}"

So arbeitest du:
1. Setze den Wunsch VOLLSTÄNDIG und GENAU so um, wie er formuliert ist. Jeder Teil des Wunsches muss erledigt sein.
2. Das Ergebnis muss im Vergleich zu Bild 2 klar sichtbar anders sein. "Etwas/bisschen" = dezent, aber sichtbar. "Viel/sehr/deutlich" = kräftig.
3. Alles, was der Wunsch nicht betrifft, bleibt exakt wie in den aktuellen Parametern.
4. Nutze für Dinge, die nur einen Teil des Bildes betreffen (Himmel, Gesicht, Person, Hintergrund, eine Ecke), regions oder hsl statt globaler Werte.
5. Was technisch nicht geht (etwas Neues ins Bild malen, Gegenstände austauschen, Gesichter verändern, Text schreiben): sag es ehrlich in "message" und setze die bestmögliche Annäherung um.

Antworte NUR mit diesem JSON:
{"message": "1-2 kurze deutsche Sätze an den Nutzer, was du genau geändert hast", "params": { ALLE Parameter vollständig }, "removals": [ nur NEUE Bereiche, sonst [] ]}`;
}

export function suggestPrompt(preferences) {
  const top = (preferences?.topStyles || []).map((s) => `${s.style} (${STYLE_LABELS[s.style] || s.style}, Punkte ${Math.round(s.score)})`).join(", ");
  const prefText = top
    ? `Der Nutzer hat bisher diese Stile am besten bewertet: ${top}.
Durchschnitt der Parameter, die ihm gefallen haben: ${JSON.stringify(preferences.averageLiked)}.
Mach mindestens 2 der 5 Vorschläge in seinen Lieblingsstilen, an dieses Bild angepasst.`
    : "Noch keine Bewertungen: Mach 5 möglichst unterschiedliche Vorschläge.";
  return `Du bist ein Profi-Fotograf und Bildbearbeiter (wie in Lightroom). Du steuerst einen Bildeditor ausschließlich über JSON-Parameter.

Das Bild ist ein Foto des Nutzers. Analysiere es: Belichtung, Tonwerte, Farbstich, Kontrast, Motiv, Schwächen.

${PARAM_GUIDE}

${COORDS}

Mach genau 5 Vorschläge, wie das Foto besser aussehen kann.
- Das Motiv bleibt gleich, aber jeder Vorschlag muss SICHTBAR anders und besser sein als das Original. Bearbeite von Grund auf: erst Tonwerte und Belichtung korrigieren (blackPoint/whitePoint, exposure, highlights/shadows), Farbstich ausgleichen, dann den Look.
- Nutze die Möglichkeiten: hsl für einzelne Farben, regions z. B. für Gesicht/Himmel/Hintergrund, Color Grading, dehaze, clarity.
- Pflicht: ein Vorschlag "natural" (sauber optimiert, natürlich), einer "crisp" (deutlich schärfer: sharpen 60-90, clarity 40-60), einer "bw" (Schwarz-Weiß, kontrastreich).
- crop nur ändern, wenn ein leichter Beschnitt die Komposition klar verbessert; sonst ganzes Bild.
- Erlaubte Stile: ${Object.keys(STYLE_LABELS).join(", ")}.

${prefText}

Antworte NUR mit diesem JSON:
{"suggestions": [{"name": "kurzer deutscher Name (1-3 Wörter)", "description": "ein kurzer deutscher Satz, was geändert wurde", "style": "einer der Stile", "params": { Parameter }}, ... genau 5 ...]}`;
}

// ---------- Transport ----------

const ERROR_TEXT = {
  not_granted: "Claude wurde für diese Seite nicht erlaubt.",
  sampling_disabled: "Claude ist für dieses Konto nicht verfügbar.",
  rate_limited: "Gerade zu viele Anfragen – bitte kurz warten und noch einmal versuchen.",
  session_expired: "Bitte melde dich bei Claude neu an.",
  refused: "Claude hat diesen Wunsch abgelehnt. Formuliere ihn bitte anders.",
  invalid_json: "Claude hat unklar geantwortet. Bitte noch einmal versuchen.",
  image_rejected: "Das Bild konnte nicht an Claude geschickt werden.",
  upstream_error: "Verbindung zu Claude unterbrochen. Bitte noch einmal versuchen.",
};
const PERMANENT = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"]);

export class AIError extends Error {
  constructor(message, permanent = false) {
    super(message);
    this.permanent = permanent;
  }
}

/**
 * Liefert {kind, ask(prompt, canvases, signal)} oder null, wenn Claude nicht verfügbar ist.
 * ask() gibt das geparste JSON zurück.
 */
export async function connectAI({ server }) {
  if (server?.claude) {
    return {
      kind: "server",
      async ask(prompt, canvases, signal) {
        const res = await fetch("api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, images: canvases.map((c) => canvasToDataUrl(c, 1024)) }),
          signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new AIError(data.error || `Fehler ${res.status}`);
        return data;
      },
    };
  }

  if (typeof window.claude?.use !== "function") return null;
  let sample = null;
  try {
    sample = await window.claude.use("sample");
  } catch {
    sample = null;
  }
  if (!sample) return null;
  const limits = await sample.limits().catch(() => null);
  const canSendImages = Boolean(limits?.images);

  return {
    kind: "sample",
    async ask(prompt, canvases, signal) {
      const images = canSendImages
        ? await Promise.all(canvases.slice(0, limits.images.maxCount).map((c) => canvasToBlob(c, 1280, 0.88)))
        : undefined;
      const text = canSendImages
        ? prompt
        : `${prompt}\n\n(Hinweis: Die Bilder konnten nicht mitgeschickt werden. Arbeite nur mit dem Text und den Parametern; keine regions, removals oder crop-Änderungen raten.)`;
      try {
        return await sample.json(text, { images, signal, cache: false, modelTier: "default" });
      } catch (e) {
        if (e?.code === "cancelled") throw new AIError("Abgebrochen.");
        throw new AIError(ERROR_TEXT[e?.code] || "Claude ist gerade nicht erreichbar.", PERMANENT.has(e?.code));
      }
    },
  };
}

