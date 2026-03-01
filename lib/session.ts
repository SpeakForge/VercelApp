import type { SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  name?: string;
  email?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD as string,
  cookieName: "speakforge_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};
