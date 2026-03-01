import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "No API key configured" }, { status: 503 });
  }

  try {
    const { avgMetrics, transcript, fullSpeech, durationSecs, wordCount, fillerCount } = await req.json();

    const prompt = `You are an encouraging speech coach writing a post-session summary.
Important context: all metrics are 0–1 normalized browser measurements. Values of 0.1–0.4 are completely normal for a real speaker in a browser session — do NOT treat them as poor performance.
Scoring guide: a solid student or amateur presenter should land 65–85. Reserve scores below 50 for truly poor sessions (incoherent, very short, or no speech at all). Be generous.
Keep the overview to 2 sentences. List exactly 2–3 genuine strengths and exactly 2 focused, actionable improvements (not a long list of flaws).
Duration: ${Math.round(durationSecs)}s, Words: ${wordCount}, Fillers: ${fillerCount}
Avg metrics: ${JSON.stringify(avgMetrics)}
Transcript: ${transcript || "(none)"}
Planned speech: ${fullSpeech || "(none)"}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                overview: { type: "string" },
                score: { type: "number" },
                strengths: { type: "array", items: { type: "string" } },
                improvements: { type: "array", items: { type: "string" } },
              },
              required: ["overview", "score", "strengths", "improvements"],
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: "Gemini error", details: err }, { status: 502 });
    }

    const data = await res.json();
    const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return NextResponse.json(JSON.parse(raw));
  } catch (err) {
    console.error("Summary route error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
