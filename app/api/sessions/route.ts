import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import clientPromise from "@/lib/mongodb";

async function getSessionsCol() {
  const c = await clientPromise;
  return c.db("speakforge").collection("sessions");
}

// Save a completed session
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const col = await getSessionsCol();
    await col.insertOne({
      userId: session.userId,
      userEmail: session.email,
      recordedAt: new Date(),
      durationSecs: body.durationSecs,
      wordCount: body.wordCount,
      fillerCount: body.fillerCount,
      transcript: body.transcript,
      plannedSpeech: body.plannedSpeech ?? "",
      avgMetrics: body.avgMetrics,
      summary: body.summary ?? null,
      lastFeedback: body.lastFeedback ?? null,
    });
    return res;
  } catch (err) {
    console.error("Save session error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Fetch all sessions for the current user
export async function GET(req: NextRequest) {
  const res = NextResponse.json({});
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const col = await getSessionsCol();
    const sessions = await col
      .find({ userId: session.userId })
      .sort({ recordedAt: -1 })
      .toArray();
    return NextResponse.json(sessions);
  } catch (err) {
    console.error("Get sessions error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
