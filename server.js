// LichtWerk – Server
// Liefert die Web-App aus und leitet Fragen an Claude weiter, wenn ein
// API-Schlüssel vorhanden ist. Die Prompts baut die App selbst (public/ai.js);
// Claude antwortet mit JSON-Parametern, die Pixel rechnet der Browser.

import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL = "claude-opus-5-5";

const hasCredentials = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = hasCredentials ? new Anthropic() : null;

function imageBlock(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw Object.assign(new Error("Ungültiges Bild"), { status: 400 });
  return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
}

/** Liest ein JSON-Objekt aus der Antwort (auch wenn es in ``` steht). */
function parseJson(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Claude hat kein JSON geliefert.");
  return JSON.parse(body.slice(start, end + 1));
}

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(here, "public")));

app.get("/api/status", (_req, res) => {
  res.json({ claude: hasCredentials, model: hasCredentials ? MODEL : null });
});

app.post("/api/ask", async (req, res) => {
  if (!client) return res.status(503).json({ error: "Kein API-Schlüssel konfiguriert" });
  try {
    const { prompt, images } = req.body;
    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Leere Anfrage" });
    }
    const content = [
      ...(Array.isArray(images) ? images.slice(0, 4) : []).flatMap((img, i) => [
        { type: "text", text: `Bild ${i + 1}:` },
        imageBlock(img),
      ]),
      { type: "text", text: prompt },
    ];
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: "Du antwortest ausschließlich mit einem einzigen JSON-Objekt, ohne weiteren Text.",
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "Claude hat diesen Wunsch abgelehnt. Formuliere ihn bitte anders." });
    }
    if (response.stop_reason === "max_tokens") {
      return res.status(502).json({ error: "Die Antwort von Claude war zu lang und wurde abgeschnitten." });
    }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    res.json(parseJson(text));
  } catch (error) {
    console.error(error);
    let status = error.status && error.status < 500 && !(error instanceof Anthropic.APIError) ? error.status : 500;
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
    } else if (error instanceof SyntaxError) {
      status = 502;
      message = "Claude hat unklar geantwortet. Bitte noch einmal versuchen.";
    }
    res.status(status).json({ error: message });
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
