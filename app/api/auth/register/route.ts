import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { getUsersCollection } from "@/lib/mongodb";
import { sessionOptions, SessionData } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const col = await getUsersCollection();
    const existing = await col.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await col.insertOne({
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date(),
    });

    const res = NextResponse.json({ ok: true });
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    session.userId = result.insertedId.toString();
    session.name = name.trim();
    session.email = email.toLowerCase();
    await session.save();
    return res;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
