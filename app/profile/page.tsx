"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import Card from "../components/Card";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserData { name: string; email: string; }

interface AvgMetrics {
  wpm: number; fillerCount: number; gestureEnergy: number;
  postureScore: number; volumeLevel: number; energyScore: number; variationScore: number;
}

interface SessionDoc {
  _id: string;
  recordedAt: string;
  durationSecs: number;
  wordCount: number;
  fillerCount: number;
  avgMetrics: AvgMetrics;
  summary: { score: number; overview: string; strengths: string[]; improvements: string[] } | null;
  lastFeedback: { feedback: string; focus: string; reason: string } | null;
  isPracticeSession?: boolean;
  sessionTitle?: string;
}

type Tab = "profile" | "statistics";

// ── Helpers ───────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function avg(arr: number[]) {
  const valid = arr.filter(n => n > 0);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDuration(secs: number) {
  if (!secs) return "–";
  const m = Math.floor(secs / 60), s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "var(--surface-solid)", borderRadius: "var(--radius-md)",
      border: "1px solid var(--border-light)", padding: "18px 16px", textAlign: "center",
      boxShadow: "var(--shadow-xs)",
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)", letterSpacing: "-1px", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 4, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "18px 0", borderBottom: "1px solid var(--border-light)" }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-subtle)" }}>{label}</span>
      <span style={{ fontSize: 15, color: "var(--text)", fontWeight: 500, fontFamily: mono ? "var(--font-geist-mono), monospace" : "inherit" }}>{value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("profile");

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r => r.ok ? r.json() : null),
      fetch("/api/sessions").then(r => r.ok ? r.json() : []),
      delay(1500),
    ]).then(([userData, sessionData]) => {
      if (!userData) { router.push("/auth"); return; }
      setUser(userData);
      setSessions(Array.isArray(sessionData) ? sessionData : []);
      setLoading(false);
    });
  }, [router]);

  // ── Computed stats ─────────────────────────────────────────────────────────

  const totalSessions = sessions.length;
  const practiceSessions = sessions.filter(s => s.isPracticeSession).length;
  const liveSessions = totalSessions - practiceSessions;
  const avgWpm = avg(sessions.map(s => s.avgMetrics?.wpm ?? 0));
  const avgEnergy = avg(sessions.map(s => s.avgMetrics?.energyScore ?? 0));
  const avgPosture = avg(sessions.map(s => s.avgMetrics?.postureScore ?? 0));
  const avgFillers = avg(sessions.map(s => s.fillerCount ?? 0));
  const avgGesture = avg(sessions.map(s => s.avgMetrics?.gestureEnergy ?? 0));
  const avgVolume = avg(sessions.map(s => s.avgMetrics?.volumeLevel ?? 0));
  const avgVariation = avg(sessions.map(s => s.avgMetrics?.variationScore ?? 0));
  const bestScore = sessions.reduce((best, s) => Math.max(best, s.summary?.score ?? 0), 0);
  const latestSession = sessions[0] ?? null;

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner"><div /><div /><div /><div /><div /><div /></div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      {/* Sub-header */}
      <div style={{
        borderBottom: "1px solid var(--border-light)", padding: "16px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(247,250,252,0.8)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        position: "relative", zIndex: 1,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.6px", color: "var(--text)" }}>
            Your <span style={{ color: "var(--gold)" }}>Profile</span>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            {user?.name} · {user?.email}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, background: "var(--bg)", borderRadius: "var(--radius-pill)", padding: 4, border: "1px solid var(--border-light)" }}>
          {(["profile", "statistics"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab === t ? "btn-primary" : "btn-ghost"}
              style={{
                background: tab === t ? "var(--dark)" : "transparent",
                color: tab === t ? "#fff" : "var(--text-muted)",
                border: "none",
                borderRadius: "var(--radius-pill)",
                padding: "7px 18px",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                textTransform: "capitalize", letterSpacing: "-0.1px",
                transition: "all 0.2s ease",
              }}
            >
              {t === "profile" ? "Profile" : "Statistics"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "32px 40px 60px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>

          {/* ── PROFILE TAB ─────────────────────────────────────────────────── */}
          {tab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Avatar + name card */}
              <Card style={{ display: "flex", alignItems: "center", gap: 24, padding: "28px 32px" }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: "var(--dark)", color: "var(--gold)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, fontWeight: 900, letterSpacing: "-1px",
                  flexShrink: 0, boxShadow: "0 0 0 3px var(--gold-border)",
                }}>
                  {user ? initials(user.name) : "?"}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.6px" }}>{user?.name}</div>
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
                    Member · {totalSessions} session{totalSessions !== 1 ? "s" : ""} completed
                  </div>
                </div>
              </Card>

              {/* Account info */}
              <Card style={{ padding: "0 28px" }}>
                <p style={{ margin: "20px 0 0", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>
                  Account Details
                </p>
                <InfoRow label="Full Name" value={user?.name ?? "–"} />
                <InfoRow label="Email Address" value={user?.email ?? "–"} />
                <InfoRow label="Password" value="••••••••••••" mono />
                <div style={{ padding: "16px 0" }}>
                  <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
                    To update your credentials, contact support.
                  </span>
                </div>
              </Card>

              {/* Quick stats */}
              <Card style={{ padding: "24px 28px" }}>
                <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>
                  At a Glance
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <StatChip label="Total Sessions" value={String(totalSessions)} />
                  <StatChip label="Live Sessions" value={String(liveSessions)} />
                  <StatChip label="Practice Sessions" value={String(practiceSessions)} />
                  <StatChip label="Best Score" value={bestScore ? `${bestScore}/100` : "–"} sub={bestScore >= 80 ? "Excellent" : bestScore >= 60 ? "Good" : undefined} />
                </div>
              </Card>

            </div>
          )}

          {/* ── STATISTICS TAB ──────────────────────────────────────────────── */}
          {tab === "statistics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {totalSessions === 0 ? (
                <Card style={{ textAlign: "center", padding: "56px 32px" }}>
                  <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>◇</div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>No sessions yet</p>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Complete a live or practice session to see your metrics here.</p>
                </Card>
              ) : (
                <>
                  {/* Metric overview */}
                  <Card style={{ padding: "24px 28px" }}>
                    <p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>
                      All-Time Averages
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                      <StatChip label="Avg WPM"       value={avgWpm      ? Math.round(avgWpm).toString()          : "–"} sub={avgWpm >= 130 && avgWpm <= 160 ? "Ideal pace" : undefined} />
                      <StatChip label="Energy"        value={avgEnergy   ? `${Math.round(avgEnergy * 100)}%`      : "–"} />
                      <StatChip label="Posture"       value={avgPosture  ? `${Math.round(avgPosture * 100)}%`     : "–"} />
                      <StatChip label="Volume"        value={avgVolume   ? `${Math.round(avgVolume * 100)}%`      : "–"} />
                      <StatChip label="Gesture"       value={avgGesture  ? `${Math.round(avgGesture * 100)}%`     : "–"} />
                      <StatChip label="Variation"     value={avgVariation ? `${Math.round(avgVariation * 100)}%` : "–"} />
                      <StatChip label="Avg Fillers"   value={avgFillers  ? avgFillers.toFixed(1)                  : "0"} sub="per session" />
                    </div>
                  </Card>

                  {/* Latest feedback */}
                  {latestSession?.lastFeedback && (
                    <Card style={{ padding: "24px 28px" }}>
                      <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>
                        Latest Feedback
                      </p>
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                          background: "var(--dark)", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 800, color: "var(--gold)",
                        }}>AI</div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>AI Coach</span>
                            {latestSession.lastFeedback.focus && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: "var(--gold-light)", color: "var(--gold)", borderRadius: "var(--radius-pill)", padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {latestSession.lastFeedback.focus}
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>{fmtDate(latestSession.recordedAt)}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>
                            {latestSession.lastFeedback.feedback}
                          </p>
                          {latestSession.lastFeedback.reason && (
                            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                              {latestSession.lastFeedback.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Latest summary */}
                  {latestSession?.summary && (
                    <Card style={{ padding: "24px 28px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>
                          Latest Session Summary
                        </p>
                        <span style={{ fontSize: 22, fontWeight: 900, color: "var(--gold)", letterSpacing: "-1px" }}>
                          {latestSession.summary.score}<span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>/100</span>
                        </span>
                      </div>
                      {latestSession.summary.overview && (
                        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65 }}>
                          {latestSession.summary.overview}
                        </p>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {latestSession.summary.strengths?.length > 0 && (
                          <div style={{ background: "var(--gold-light)", border: "1px solid var(--gold-border)", borderRadius: "var(--radius-sm)", padding: "14px 16px" }}>
                            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--gold)" }}>Strengths</p>
                            {latestSession.summary.strengths.map((s, i) => (
                              <p key={i} style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>· {s}</p>
                            ))}
                          </div>
                        )}
                        {latestSession.summary.improvements?.length > 0 && (
                          <div style={{ background: "var(--bg)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)", padding: "14px 16px" }}>
                            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>To Improve</p>
                            {latestSession.summary.improvements.map((s, i) => (
                              <p key={i} style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>· {s}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Session history */}
                  <div>
                    <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)" }}>
                      Session History
                    </p>
                    {sessions.map((s, i) => {
                      const m = s.avgMetrics;
                      return (
                        <Card key={s._id ?? i} style={{ marginBottom: 10, padding: "18px 24px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, borderRadius: "var(--radius-pill)",
                                padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.05em",
                                background: s.isPracticeSession ? "var(--gold-light)" : "rgba(36,49,55,0.08)",
                                color: s.isPracticeSession ? "var(--gold)" : "var(--text-muted)",
                                border: s.isPracticeSession ? "1px solid var(--gold-border)" : "1px solid var(--border-light)",
                              }}>
                                {s.isPracticeSession ? "Practice" : "Live"}
                              </span>
                              {s.sessionTitle && (
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{s.sessionTitle}</span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              {s.summary?.score != null && (
                                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--gold)" }}>
                                  {s.summary.score}<span style={{ fontSize: 11, color: "var(--text-subtle)", fontWeight: 600 }}>/100</span>
                                </span>
                              )}
                              <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>{fmtDate(s.recordedAt)}</span>
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                            {[
                              { label: "WPM",      value: m?.wpm ? Math.round(m.wpm) : "–" },
                              { label: "Fillers",  value: s.fillerCount ?? "–" },
                              { label: "Energy",   value: m?.energyScore ? `${Math.round(m.energyScore * 100)}%` : "–" },
                              { label: "Posture",  value: m?.postureScore ? `${Math.round(m.postureScore * 100)}%` : "–" },
                              { label: "Volume",   value: m?.volumeLevel ? `${Math.round(m.volumeLevel * 100)}%` : "–" },
                              { label: "Duration", value: fmtDuration(s.durationSecs) },
                            ].map(({ label, value }) => (
                              <div key={label} style={{ background: "var(--bg)", borderRadius: "var(--radius-xs)", padding: "8px 6px", textAlign: "center", border: "1px solid var(--border-light)" }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{String(value)}</div>
                                <div style={{ fontSize: 9, color: "var(--text-subtle)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                              </div>
                            ))}
                          </div>

                          {s.lastFeedback?.feedback && (
                            <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", lineHeight: 1.5, borderTop: "1px solid var(--border-light)", paddingTop: 10 }}>
                              "{s.lastFeedback.feedback.slice(0, 140)}{s.lastFeedback.feedback.length > 140 ? "…" : ""}"
                            </p>
                          )}
                        </Card>
                      );
                    })}
                  </div>

                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
