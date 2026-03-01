import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import clientPromise from "@/lib/mongodb";

function avg(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export async function GET(req: NextRequest) {
  const res = NextResponse.json({});
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Fetch recent sessions for this user
  const c = await clientPromise;
  const sessions = await c
    .db("speakforge")
    .collection("sessions")
    .find({ userId: session.userId })
    .sort({ recordedAt: -1 })
    .limit(5)
    .toArray();

  const hasHistory = sessions.length > 0;

  // Aggregate weak areas from AI summaries
  const improvements = sessions.flatMap((s) => s.summary?.improvements ?? []).slice(0, 6);
  const avgScore = hasHistory
    ? Math.round(avg(sessions.map((s) => s.summary?.score ?? 70)))
    : null;
  const avgWpm = hasHistory
    ? Math.round(avg(sessions.map((s) => s.avgMetrics?.wpm ?? 0)))
    : null;
  const avgVolume = hasHistory
    ? avg(sessions.map((s) => s.avgMetrics?.volumeLevel ?? 0))
    : null;
  const avgEnergy = hasHistory
    ? avg(sessions.map((s) => s.avgMetrics?.energyScore ?? 0))
    : null;
  const avgVariation = hasHistory
    ? avg(sessions.map((s) => s.avgMetrics?.variationScore ?? 0))
    : null;
  const totalFillers = hasHistory
    ? Math.round(avg(sessions.map((s) => s.fillerCount ?? 0)))
    : null;

  const historyContext = hasHistory
    ? `The user has completed ${sessions.length} prior session(s).
- Average score: ${avgScore}/100
- Average WPM: ${avgWpm} (ideal range: 120–160)
- Average volume: ${avgVolume?.toFixed(2)} (0–1 scale; below 0.3 is too quiet)
- Average energy: ${avgEnergy?.toFixed(2)} (0–1 scale; below 0.3 is low)
- Average vocal variation: ${avgVariation?.toFixed(2)} (0–1 scale; below 0.3 is monotone)
- Average fillers per session: ${totalFillers}
- Key improvement areas from coach feedback: ${improvements.length ? improvements.join("; ") : "not yet determined"}`
    : "This is the user's first practice session — create a well-rounded baseline covering pace, energy, and clarity.";

  const prompt = `You are a personalized speech coach creating a targeted practice session.

${historyContext}

Create a practice session with exactly 4 segments targeting their weakest areas.
Each segment must have a natural-sounding practice text (2–4 sentences, 30–60 words) that the user reads aloud.
The coachIntro should be 1–2 warm, encouraging sentences spoken by the coach before the user repeats.
Vary the focus areas across segments — do not repeat the same focus twice.

Reply with JSON only.`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.75,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              sessionTitle: { type: "string" },
              overview: { type: "string" },
              segments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    order: { type: "number" },
                    focus: {
                      type: "string",
                      enum: ["pace", "fillers", "energy", "variation", "gestures", "posture", "content"],
                    },
                    title: { type: "string" },
                    coachIntro: { type: "string" },
                    practiceText: { type: "string" },
                    tip: { type: "string" },
                  },
                  required: ["order", "focus", "title", "coachIntro", "practiceText", "tip"],
                },
              },
            },
            required: ["sessionTitle", "overview", "segments"],
          },
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    console.error("Gemini generate error:", err);
    return NextResponse.json({ error: "Failed to generate practice session" }, { status: 502 });
  }

  const data = await geminiRes.json();
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid response from AI" }, { status: 500 });
  }
}
