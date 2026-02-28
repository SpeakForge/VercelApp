import { NextRequest, NextResponse } from "next/server";

const CLAUDE_API_KEY = "REMOVED";

export async function POST(req: NextRequest) {
  try {
    const { metrics, liveTranscript, fullSpeech } = await req.json();

    const prompt = `Return ONLY valid JSON — no markdown, no code fences, no extra text.

Schema:
{
  "feedback": "<one actionable tip, max 12 words>",
  "focus": "pace" | "fillers" | "energy" | "variation" | "gestures" | "posture" | "content",
  "reason": "<one sentence why>"
}

Rules:
- feedback must be a single, short, actionable coaching tip.
- If the live transcript is missing key topics from the planned speech, set focus to "content".
- Pick the single most important thing to fix right now.

Current metrics:
${JSON.stringify(metrics, null, 2)}

What has been said so far:
${liveTranscript || "(nothing yet)"}

Full planned speech to cover:
${fullSpeech || "(none provided)"}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error("Claude API error:", err);
      return NextResponse.json({ error: "Claude API error", details: err }, { status: 502 });
    }

    const data = await claudeRes.json();
    const raw: string = data.content?.[0]?.text ?? "";

    // Strip any accidental markdown fences
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) {
      console.error("No JSON found in Claude response:", raw);
      return NextResponse.json({ error: "No JSON in Claude response", raw }, { status: 500 });
    }

    return NextResponse.json(JSON.parse(match[0]));
  } catch (err) {
    console.error("Claude route error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
