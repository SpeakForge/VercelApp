import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "No API key configured" }, { status: 503 });
  }

  try {
    const { metrics, liveTranscript, fullSpeech } = await req.json();

    const prompt = `You are a live speaking coach. Reply with JSON only.
feedback: max 6 words — if things look good, give an encouraging compliment (e.g. "You're doing great!", "Keep it up!", "Excellent energy!"); otherwise give a punchy corrective tip (e.g. "Slow down, pause between ideas")
focus: the single biggest issue, or "positive" if the speaker is performing well overall
reason: max 5 words explaining the feedback

Metrics: ${JSON.stringify(metrics)}
Transcript: ${liveTranscript || "(none)"}
Planned: ${fullSpeech || "(none)"}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                feedback: { type: "string" },
                focus: { type: "string", enum: ["pace","fillers","energy","variation","gestures","posture","content","positive"] },
                reason: { type: "string" },
              },
              required: ["feedback", "focus", "reason"],
            },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error("Gemini API error:", err);
      return NextResponse.json({ error: "Gemini API error", details: err }, { status: 502 });
    }

    const data = await geminiRes.json();
    const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    try {
      return NextResponse.json(JSON.parse(raw));
    } catch {
      console.error("Failed to parse Gemini JSON:", raw);
      return NextResponse.json({ error: "Invalid JSON from Gemini", raw }, { status: 500 });
    }
  } catch (err) {
    console.error("Gemini route error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
