"use client";

import Link from "next/link";

const NAV_LINKS = ["What is SpeakForge?", "How It Works", "Features", "Pricing"];

const STATS = [
  { icon: "🎤", label: "Real-Time", sub: "Live Feedback" },
  { icon: "✅", label: "95%+", sub: "Accuracy" },
  { icon: "⭐", label: "AI Coach", sub: "Always On" },
];

const FEATURES_LEFT = [
  {
    icon: "🎤",
    title: "Live speech transcription",
    desc: "Every word you say appears instantly so you can track what you're actually saying.",
  },
  {
    icon: "⏱️",
    title: "WPM & filler word detection",
    desc: "Counts your ums, uhs, and likes in real time so you can cut them out.",
  },
  {
    icon: "🕺",
    title: "Pose-based gesture analysis",
    desc: "MediaPipe tracks your wrist movement to score how expressive your gestures are.",
  },
];

const FEATURES_RIGHT = [
  {
    icon: "🧍",
    color: "#e0e7ff",
    iconColor: "#6366f1",
    title: "Posture Scoring",
    desc: "Shoulder tilt and head position are analyzed so you always look confident.",
  },
  {
    icon: "🔊",
    color: "#dcfce7",
    iconColor: "#22c55e",
    title: "Volume & Energy",
    desc: "Real-time RMS energy meter keeps your delivery loud and engaging.",
  },
  {
    icon: "📈",
    color: "#fef9c3",
    iconColor: "#eab308",
    title: "Variation Score",
    desc: "Detects monotone delivery and nudges you to vary your vocal dynamics.",
  },
  {
    icon: "🧠",
    color: "#fce7f3",
    iconColor: "#ec4899",
    title: "AI-Powered Insights",
    desc: "All metrics combined into one live coaching dashboard — no setup needed.",
  },
];

export default function LandingPage() {
  return (
    <div
      style={{
        background: "#f4f6ff",
        minHeight: "100vh",
        fontFamily:
          "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#0d1117",
      }}
    >
      {/* ── Navbar ── */}
      <div style={{ display: "flex", justifyContent: "center", padding: "20px 24px 0" }}>
        <nav
          style={{
            background: "#fff",
            borderRadius: 999,
            boxShadow: "0 2px 20px rgba(0,0,0,0.08)",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            gap: 32,
            maxWidth: 900,
            width: "100%",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 16, whiteSpace: "nowrap" }}>
            🎙️ speakforge.ai
          </div>

          {/* Links */}
          <div style={{ display: "flex", gap: 24, flex: 1 }}>
            {NAV_LINKS.map((l) => (
              <span
                key={l}
                style={{ fontSize: 14, color: "#475569", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {l}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              style={{
                background: "transparent",
                border: "1px solid #e2e8f0",
                borderRadius: 999,
                padding: "8px 18px",
                fontSize: 14,
                cursor: "pointer",
                color: "#0d1117",
                whiteSpace: "nowrap",
              }}
            >
              Sign In
            </button>
            <Link href="/coach">
              <button
                style={{
                  background: "#3b5bdb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 999,
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Get Started Free →
              </button>
            </Link>
          </div>
        </nav>
      </div>

      {/* ── Hero ── */}
      <section
        style={{
          textAlign: "center",
          padding: "72px 24px 60px",
          maxWidth: 760,
          margin: "0 auto",
          position: "relative",
        }}
      >
        {/* Floating decoration icons */}
        {[
          { emoji: "🎤", top: 40, left: -120, bg: "#ede9fe" },
          { emoji: "🧍", top: 160, left: -80, bg: "#fce7f3" },
          { emoji: "📊", top: 40, right: -120, bg: "#dcfce7" },
          { emoji: "🔊", top: 160, right: -80, bg: "#fef9c3" },
        ].map(({ emoji, top, left, right, bg }, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top,
              left,
              right,
              width: 52,
              height: 52,
              background: bg,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            }}
          >
            {emoji}
          </div>
        ))}

        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 999,
            padding: "6px 16px",
            fontSize: 13,
            color: "#475569",
            marginBottom: 28,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          AI-Powered Speaking Coach
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: "clamp(44px, 7vw, 72px)",
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-2px",
            margin: "0 0 24px",
            color: "#0d1117",
          }}
        >
          Speak With{" "}
          <span style={{ color: "#3b5bdb" }}>Confidence.</span>
        </h1>

        {/* Sub with highlight chips */}
        <p style={{ fontSize: 17, color: "#475569", lineHeight: 1.75, margin: "0 0 36px" }}>
          <Chip color="#bbf7d0" text="Real-time" /> coaching that{" "}
          <Chip color="#bbf7d0" text="tracks your speech" />, analyzes your body
          language, and gives you{" "}
          <Chip color="#bbf7d0" text="instant feedback" />.
        </p>

        {/* CTA */}
        <Link href="/coach">
          <button
            style={{
              background: "#3b5bdb",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "18px 48px",
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 24px rgba(59,91,219,0.35)",
              marginBottom: 16,
            }}
          >
            Start Coaching Free →
          </button>
        </Link>

        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 48 }}>
          No sign-up required &nbsp;·&nbsp; Works best in Chrome
        </div>

        {/* Trust badges */}
        <div style={{ display: "flex", justifyContent: "center", gap: 28, marginBottom: 56, flexWrap: "wrap" }}>
          {["✅ No credit card", "✅ Camera & mic only", "▶ See How It Works"].map((t) => (
            <span key={t} style={{ fontSize: 13, color: "#64748b" }}>{t}</span>
          ))}
        </div>

        {/* Stat cards */}
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          {STATS.map(({ icon, label, sub }) => (
            <div
              key={label}
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: "16px 28px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
                border: "1px solid #f1f5f9",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  background: "#ede9fe",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                {icon}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── What is SpeakForge? ── */}
      <section style={{ background: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2
            style={{
              textAlign: "center",
              fontSize: "clamp(32px, 5vw, 52px)",
              fontWeight: 900,
              letterSpacing: "-1.5px",
              marginBottom: 14,
            }}
          >
            What is{" "}
            <span style={{ color: "#3b5bdb" }}>SpeakForge?</span>
          </h2>
          <p
            style={{
              textAlign: "center",
              fontSize: 16,
              color: "#64748b",
              maxWidth: 560,
              margin: "0 auto 64px",
              lineHeight: 1.7,
            }}
          >
            SpeakForge is a real-time AI coach that listens to your voice,
            watches your posture, and gives you live feedback — all in your browser.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
            {/* Left: feature list */}
            <div>
              <p
                style={{
                  fontWeight: 800,
                  fontSize: 20,
                  marginBottom: 28,
                  color: "#0d1117",
                }}
              >
                Stop presenting without knowing how you look
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {FEATURES_LEFT.map(({ icon, title, desc }) => (
                  <div
                    key={title}
                    style={{
                      display: "flex",
                      gap: 16,
                      background: "#f8fafc",
                      borderRadius: 14,
                      padding: "18px 20px",
                      border: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        background: "#ede9fe",
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      {icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: 2x2 cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {FEATURES_RIGHT.map(({ icon, color, iconColor, title, desc }) => (
                <div
                  key={title}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    padding: "22px 18px",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      background: color,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      marginBottom: 14,
                      color: iconColor,
                    }}
                  >
                    {icon}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{title}</div>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ padding: "80px 24px", background: "#f4f6ff" }}>
        <h2
          style={{
            textAlign: "center",
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 900,
            letterSpacing: "-1.5px",
            marginBottom: 12,
          }}
        >
          How It{" "}
          <span style={{ color: "#3b5bdb" }}>Works</span>
        </h2>
        <p style={{ textAlign: "center", color: "#64748b", fontSize: 15, marginBottom: 56 }}>
          From browser to better speaker in 3 steps
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            maxWidth: 900,
            margin: "0 auto",
            flexWrap: "wrap",
          }}
        >
          {[
            { step: "01", title: "Allow Camera & Mic", desc: "Grant permission once — no downloads, no accounts.", icon: "📷" },
            { step: "02", title: "Start Speaking", desc: "SpeakForge immediately starts analysing your voice and body.", icon: "🎙️" },
            { step: "03", title: "Read Your Live Score", desc: "Watch WPM, posture, gesture energy, and fillers update in real time.", icon: "📊" },
          ].map(({ step, title, desc, icon }) => (
            <div
              key={step}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 20,
                padding: "32px 28px",
                flex: "1 1 240px",
                maxWidth: 280,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#3b5bdb" }}>Step {step}</span>
              </div>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* Final CTA */}
        <div style={{ textAlign: "center", marginTop: 64 }}>
          <Link href="/coach">
            <button
              style={{
                background: "#3b5bdb",
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: "18px 52px",
                fontSize: 17,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 24px rgba(59,91,219,0.35)",
              }}
            >
              Launch Coach →
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          textAlign: "center",
          padding: "28px 24px",
          fontSize: 13,
          color: "#94a3b8",
          borderTop: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        © 2025 SpeakForge · Built at HackTCNJ 2026
      </footer>
    </div>
  );
}

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        background: color,
        borderRadius: 6,
        padding: "1px 8px",
        fontWeight: 600,
        color: "#0d1117",
        fontSize: "0.95em",
      }}
    >
      {text}
    </span>
  );
}
