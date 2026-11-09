// LichtWerk – Server
// Liefert die Web-App aus und fragt (wenn ein API-Schlüssel vorhanden ist) Claude,
// welche Bearbeitung zu einem Bild passt. Claude gibt nur Bearbeitungs-Parameter
// zurück; das eigentliche Rechnen an den Pixeln passiert im Browser.

import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL = "claude-opus-5-5";

const hasCredentials = Boolean(
  process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
);
const client = hasCredentials ? new Anthropic() : null;

// ---------- Schema der Bearbeitungs-Parameter ----------

const STYLES = [
  "natural", "crisp", "bw", "warm", "cool",
  "vivid", "moody", "bright", "vintage", "cinematic",
];

const num = (description) => ({ type: "number", description });

const boxSchema = {
  type: "object",
  properties: {
    x: num("linker Rand, 0..1 relativ zur Bildbreite"),
    y: num("oberer Rand, 0..1 relativ zur Bildhöhe"),
    w: num("Breite, 0..1"),
    h: num("Höhe, 0..1"),
  },
  required: ["x", "y", "w", "h"],
  additionalProperties: false,
};

const paramsSchema = {
  type: "object",
  properties: {
    exposure: num("Belichtung in Blendenstufen, -2..2, 0 = unverändert"),
    contrast: num("-100..100"),
    highlights: num("Lichter, -100..100 (negativ = Lichter zurückholen)"),
    shadows: num("Tiefen, -100..100 (positiv = Schatten aufhellen)"),
    saturation: num("-100..100"),
    vibrance: num("Dynamik, -100..100"),
    temperature: num("Farbtemperatur, -100 (kühl/blau) .. 100 (warm/gelb)"),
    tint: num("Tönung, -100 (grün) .. 100 (magenta)"),
    grayscale: num("Schwarz-Weiß-Anteil, 0..100"),
    sepia: num("0..100"),
    fade: num("matter Look / angehobene Schwarztöne, 0..100"),
    sharpen: num("Schärfe, 0..100"),
    clarity: num("Klarheit / lokaler Kontrast, 0..100"),
    vignette: num("Vignette, 0..100"),
    crop: {
      ...boxSchema,
      description:
        "Bildausschnitt relativ zum Originalbild. Ganzes Bild = {x:0,y:0,w:1,h:1}. Zum Heranzoomen kleiner machen.",
    },
  },
  required: [
    "exposure", "contrast", "highlights", "shadows", "saturation", "vibrance",
    "temperature", "tint", "grayscale", "sepia", "fade", "sharpen", "clarity",
    "vignette", "crop",
  ],
  additionalProperties: false,
};

const suggestionsSchema = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      description: "Genau 5 Vorschläge",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Kurzer deutscher Name, 1–3 Wörter" },
          description: { type: "string", description: "Ein kurzer deutscher Satz, was geändert wurde" },
          style: { type: "string", enum: STYLES },
          params: paramsSchema,
        },
        required: ["name", "description", "style", "params"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
};

const editSchema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Kurze deutsche Antwort an den Nutzer: was du gemacht hast, oder warum etwas nicht geht",
    },
    params: paramsSchema,
    removals: {
      type: "array",
      description:
        "Bereiche (relativ zum ORIGINALBILD), in denen Objekte entfernt und mit der Umgebung aufgefüllt werden sollen. Leer, wenn nichts entfernt werden soll.",
      items: boxSchema,
    },
  },
  required: ["message", "params", "removals"],
  additionalProperties: false,
};

const PARAM_GUIDE = `Du steuerst einen Bildeditor ausschließlich über Parameter. Du malst keine Pixel selbst.
Parameter (0 heißt immer "unverändert"):
- exposure: Blendenstufen (-2..2). Kleine Werte wie 0.2–0.5 reichen meist.
- contrast, highlights, shadows, saturation, vibrance, temperature, tint: -100..100
- grayscale, sepia, fade, sharpen, clarity, vignette: 0..100
- crop: Ausschnitt relativ zum Original (x, y, w, h in 0..1). Ganzes Bild = {x:0,y:0,w:1,h:1}.
  Achte darauf, dass x+w <= 1 und y+h <= 1, und behalte ungefähr das Seitenverhältnis bei, außer der Nutzer will etwas anderes.
Das Motiv soll im Großen und Ganzen gleich bleiben: dezente, geschmackvolle Bearbeitungen statt extremer Effekte.`;

// ---------- Hilfen ----------

function imageBlock(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Ungültiges Bild");
  return {
    type: "image",
    source: { type: "base64", media_type: match[1], data: match[2] },
  };
}

async function askClaude({ system, content, schema }) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema },
    },
    system,
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude hat diese Anfrage abgelehnt.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Die Antwort von Claude war zu lang und wurde abgeschnitten.");
  }
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  return JSON.parse(text);
}

function describePreferences(prefs) {
  if (!prefs || !Array.isArray(prefs.topStyles) || prefs.topStyles.length === 0) {
    return "Noch keine Bewertungen vorhanden. Mach 5 abwechslungsreiche Vorschläge.";
  }
  const liked = prefs.topStyles
    .filter((s) => STYLES.includes(s.style))
    .map((s) => `${s.style} (Punkte ${Math.round(s.score)})`)
    .join(", ");
  const avg = prefs.averageLiked
    ? `\nDurchschnittliche Parameter der Bilder, die dem Nutzer gefallen haben: ${JSON.stringify(prefs.averageLiked)}`
    : "";
  return `Der Nutzer hat bisher diese Stile am besten bewertet: ${liked}.${avg}
Mach mindestens 2 Vorschläge in den Stilen, die ihm am besten gefallen (an dieses Bild angepasst), die übrigen dürfen andere Richtungen zeigen.`;
}

function sendError(res, error) {
  console.error(error);
  let status = 500;
  let message = error instanceof Error ? error.message : String(error);
  if (error instanceof Anthropic.AuthenticationError) {
    status = 401;
    message = "Der API-Schlüssel ist ungültig.";
  } else if (error instanceof Anthropic.RateLimitError) {
    status = 429;
    message = "Zu viele Anfragen – bitte kurz warten.";
  } else if (error instanceof Anthropic.APIError) {
    status = 502;
    message = `Claude-API-Fehler: ${error.message}`;
  }
  res.status(status).json({ error: message });
}

// ---------- App ----------

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(here, "public")));

app.get("/api/status", (_req, res) => {
  res.json({ claude: hasCredentials, model: hasCredentials ? MODEL : null });
});

app.post("/api/suggest", async (req, res) => {
  if (!client) return res.status(503).json({ error: "Kein API-Schlüssel konfiguriert" });
  try {
    const { image, preferences } = req.body;
    const result = await askClaude({
      system: `Du bist ein erfahrener Fotograf und Bildbearbeiter.\n${PARAM_GUIDE}`,
      schema: suggestionsSchema,
      content: [
        imageBlock(image),
        {
          type: "text",
          text: `Schau dir das Foto an und mach genau 5 Vorschläge, wie es besser aussehen könnte.
Pflicht: Ein Vorschlag ist eine dezent optimierte, natürliche Version (style "natural"), ein Vorschlag ist deutlich schärfer (style "crisp", sharpen und clarity erhöht), und ein Vorschlag ist Schwarz-Weiß (style "bw").
Pass alles an dieses konkrete Bild an (z. B. zu dunkel → Belichtung hoch, Farbstich → Temperatur/Tönung ausgleichen). Behalte crop = ganzes Bild, außer ein leichter Beschnitt verbessert die Komposition deutlich.

${describePreferences(preferences)}`,
        },
      ],
    });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/edit", async (req, res) => {
  if (!client) return res.status(503).json({ error: "Kein API-Schlüssel konfiguriert" });
  try {
    const { image, params, instruction, removals } = req.body;
    if (!instruction || typeof instruction !== "string") {
      return res.status(400).json({ error: "Bitte schreib, was geändert werden soll." });
    }
    const result = await askClaude({
      system: `Du bist ein Bildbearbeiter, der Wünsche des Nutzers in Bearbeitungs-Parameter übersetzt.\n${PARAM_GUIDE}
Objekte entfernen: Gib in "removals" Rechtecke relativ zum ORIGINALBILD an, die das Objekt komplett und mit etwas Rand umschließen. Der Bereich wird dann mit der Umgebung aufgefüllt – das klappt am besten bei ruhigem Hintergrund und eher kleinen Objekten. Bisherige Entfernungen bleiben erhalten; gib nur neue an.
Du kannst nichts Neues ins Bild malen oder Gegenstände hinzufügen. Wenn der Nutzer so etwas will, sag es ehrlich in "message" und mach, was mit den Parametern möglich ist.
Ändere nur, worum der Nutzer bittet, und übernimm alle anderen Werte unverändert.`,
      schema: editSchema,
      content: [
        imageBlock(image),
        {
          type: "text",
          text: `Das ist das Originalbild.
Aktuelle Parameter: ${JSON.stringify(params)}
Bereits entfernte Bereiche: ${JSON.stringify(removals || [])}

Wunsch des Nutzers: ${instruction}`,
        },
      ],
    });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

app.listen(PORT, () => {
  console.log(`LichtWerk läuft auf http://localhost:${PORT}`);
  console.log(
    hasCredentials
      ? `Claude ist aktiv (${MODEL}).`
      : "Kein ANTHROPIC_API_KEY gesetzt – die App läuft im lokalen Modus (ohne Claude).",
  );
});
