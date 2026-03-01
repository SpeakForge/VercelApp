"use client";

import React from "react";
import Link from "next/link";
import Navbar from "./components/Navbar";
import Card from "./components/Card";
import ScrollReveal from "./components/ScrollReveal";
import "./sf-card.css";

/* ── Static data ─────────────────────────────────────────── */

const FEATURES = [
  { gradient: "linear-gradient(43deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%)", title: "Pace & WPM",     desc: "Live words-per-minute tracking keeps your delivery in the ideal 130–160 WPM range." },
  { gradient: "linear-gradient(43deg, #FF512F 0%, #F09819 100%)",               title: "Filler Words",    desc: "Counts every \"um\", \"uh\", and \"like\" in real time so you can catch and cut them." },
  { gradient: "linear-gradient(43deg, #0BAB64 0%, #3BB78F 50%, #74EBD5 100%)", title: "Gesture Energy",  desc: "MediaPipe tracks wrist movement to score how expressive your gestures are." },
  { gradient: "linear-gradient(43deg, #7F00FF 0%, #A855F7 50%, #E879F9 100%)", title: "Posture Score",   desc: "Shoulder tilt and head position analysed so you always look poised and confident." },
  { gradient: "linear-gradient(43deg, #0F7B6C 0%, #0891B2 50%, #67E8F9 100%)", title: "Volume & Energy", desc: "Real-time RMS energy meter ensures your voice stays loud, clear, and engaging." },
  { gradient: "linear-gradient(43deg, #BE185D 0%, #EC4899 50%, #FDA4AF 100%)", title: "Vocal Variation", desc: "Detects monotone delivery and nudges you to vary your pitch and dynamics." },
];

/* ── Floater styles ─────────────────────────────────────── */

const glassCard: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.88)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.75)",
  borderRadius: 20,
  boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 8px 40px rgba(0,0,0,0.10)",
};

/* ── Step preview components ────────────────────────────── */

function PreviewPermission() {
  return (
    <div className="step-preview">
      <div style={{ marginTop: 20, background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          {["rgba(255,255,255,0.25)", "rgba(255,255,255,0.25)", "rgba(255,255,255,0.25)"].map((c, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 500, marginBottom: 10, lineHeight: 1.5 }}>
          speakforge.app wants access to your
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["Camera", "Microphone"].map((item) => (
            <div key={item} style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "7px 0", fontSize: 11, color: "rgba(255,255,255,0.9)", textAlign: "center", fontWeight: 600 }}>
              {item}
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 8, padding: "7px 0", fontSize: 12, color: "#1e3a5f", textAlign: "center", fontWeight: 700 }}>
          Allow
        </div>
      </div>
    </div>
  );
}

function PreviewWaveform() {
  const heights = [10, 20, 14, 28, 18, 24, 12, 28, 16, 22, 10, 26, 18, 24, 12];
  return (
    <div className="step-preview">
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 32, marginBottom: 14 }}>
          {heights.map((h, i) => (
            <div
              key={i}
              className="wave-bar"
              style={{
                flex: 1,
                height: h,
                borderRadius: 3,
                background: "rgba(255,255,255,0.65)",
                animationDelay: `${i * 0.06}s`,
              }}
            />
          ))}
        </div>
        <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "9px 12px" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Transcript
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
            "...and I believe this approach will significantly improve..."
          </span>
          <span style={{ display: "inline-block", width: 2, height: 13, background: "rgba(255,255,255,0.8)", marginLeft: 2, verticalAlign: "middle", animation: "wavePulse 0.7s ease-in-out infinite" }} />
        </div>
      </div>
    </div>
  );
}

function PreviewScores() {
  const metrics = [
    { label: "WPM",     value: 142, max: 200 },
    { label: "Posture", value: 87,  max: 100 },
    { label: "Energy",  value: 74,  max: 100 },
  ];
  return (
    <div className="step-preview">
      <div style={{ marginTop: 20 }}>
        {metrics.map(({ label, value, max }) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.7)" }}>{label}</span>
              <span style={{ color: "#fff", fontWeight: 700 }}>{value}</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.15)", borderRadius: 99 }}>
              <div style={{ width: `${(value / max) * 100}%`, height: "100%", background: "rgba(255,255,255,0.85)", borderRadius: 99, transition: "width 0.6s ease" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Feature Cards ───────────────────────────────────────────── */

function FeatureDeck() {
  return (
    <div className="feature-cards-grid">
      {FEATURES.map((f) => (
        <div
          key={f.title}
          className="feature-card"
          style={{ backgroundImage: f.gradient }}
        >
          <div className="feature-card-content">
            <div className="feature-card-title">{f.title}</div>
            <p className="feature-card-para">{f.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>
      <Navbar />

      {/* ═══ HERO ═══ */}
      <section
        style={{
          position: "relative",
          minHeight: "calc(100vh - var(--header-h))",
          overflow: "hidden",
        }}
      >
        {/* Giant diagonal streak — behind everything */}
        <div className="sf-card anim-fadeIn">
          <div className="sf-border" />
          <p className="sf-bottom-text">speakforge</p>
          <div className="sf-content">
            <div className="sf-logo">
              <span className="sf-logo1">speak</span>
              <span className="sf-logo2">forge</span>
              <div className="sf-trail" />
            </div>
            <p className="sf-logo-bottom-text">speak with confidence</p>
          </div>
        </div>

        {/* Subtitle — centered just below the diagonal streak */}
        <div
          className="anim-fadeUp delay-1"
          style={{
            position: "absolute",
            top: "calc(45% + 205px)",
            left: 0,
            right: 0,
            textAlign: "center",
            padding: "0 24px",
            zIndex: 10,
          }}
        >
          <p style={{
            fontSize: 18,
            color: "var(--text-muted)",
            lineHeight: 1.65,
            margin: 0,
            letterSpacing: "-0.32px",
          }}>
            By giving you real-time feedback on your speech,<br />
            posture, and gestures — all in your browser.
          </p>
        </div>

        {/* ── LEFT FLOATERS (slide from left) ── */}
        <div className="hero-floaters">

          {/* L1 — recording + waveform */}
          <div className="float-l1" style={{ position: "absolute", top: "8%", left: "3%" }}>
            <div style={{ transform: "rotate(-7deg)", ...glassCard, padding: "18px 20px", width: 210 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: "rgba(124,111,247,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, color: "#7c6ff7", letterSpacing: "-0.5px",
                }}>REC</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px" }}>Recording</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, fontSize: 11, color: "#22c55e", fontWeight: 600 }}>
                    <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                    Live session
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 28 }}>
                {[14, 22, 18, 28, 12, 24, 20, 28, 16, 22, 10, 26, 18, 22, 14].map((h, i) => (
                  <div key={i} style={{ flex: 1, height: h, borderRadius: 3, background: `rgba(124,111,247,${0.3 + (i % 4) * 0.15})` }} />
                ))}
              </div>
            </div>
          </div>

          {/* L2 — filler words */}
          <div className="float-l2" style={{ position: "absolute", top: "40%", left: "1%" }}>
            <div style={{ transform: "rotate(5deg)", ...glassCard, padding: "16px 18px", width: 190 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-subtle)", marginBottom: 12 }}>
                Filler Words
              </div>
              {[
                { word: '"um"',       count: 3, color: "#f59e0b" },
                { word: '"uh"',       count: 1, color: "#f97316" },
                { word: '"like"',     count: 5, color: "#ef4444" },
                { word: '"you know"', count: 2, color: "#8b5cf6" },
              ].map(({ word, count, color }) => (
                <div key={word} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{word}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color, background: color + "18", borderRadius: 6, padding: "2px 8px" }}>{count}x</span>
                </div>
              ))}
            </div>
          </div>

          {/* L3 — live transcript */}
          <div className="float-l3" style={{ position: "absolute", bottom: "14%", left: "4%" }}>
            <div style={{ transform: "rotate(-4deg)", ...glassCard, padding: "16px 18px", width: 220 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-subtle)", marginBottom: 10 }}>
                Live Transcript
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                "...and that is why I believe this approach will{" "}
                <span style={{ color: "var(--text)", fontWeight: 600 }}>significantly improve</span>{" "}
                the outcome—"
              </p>
              <span style={{ display: "inline-block", width: 2, height: 14, background: "#7c6ff7", marginTop: 4, animation: "wavePulse 0.8s ease-in-out infinite" }} />
            </div>
          </div>

        </div>

        {/* ── RIGHT FLOATERS (slide from right) ── */}
        <div className="hero-floaters">

          {/* R1 — WPM stat */}
          <div className="float-r1" style={{ position: "absolute", top: "8%", right: "3%" }}>
            <div style={{ transform: "rotate(8deg)", ...glassCard, padding: "18px 22px", width: 200, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-subtle)", marginBottom: 8 }}>
                Words / Min
              </div>
              <div style={{ fontSize: 62, fontWeight: 900, letterSpacing: "-3px", color: "var(--text)", lineHeight: 1 }}>
                142
              </div>
              <div style={{ marginTop: 10, height: 5, background: "rgba(0,0,0,0.06)", borderRadius: 99 }}>
                <div style={{ width: "79%", height: "100%", background: "#3b82f6", borderRadius: 99 }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>Good pace</div>
            </div>
          </div>

          {/* R2 — AI coach feedback */}
          <div className="float-r2" style={{ position: "absolute", top: "38%", right: "1%" }}>
            <div style={{ transform: "rotate(-6deg)", ...glassCard, padding: "16px 18px", width: 240 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "linear-gradient(135deg, #7c6ff7, #a78bfa)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px",
                }}>AI</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>AI Coach</div>
                  <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>Just now</div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text)", lineHeight: 1.55 }}>
                Great energy! Try slowing to <strong>130 WPM</strong> — you'll sound more authoritative.
              </p>
            </div>
          </div>

          {/* R3 — body language */}
          <div className="float-r3" style={{ position: "absolute", bottom: "12%", right: "4%" }}>
            <div style={{ transform: "rotate(4deg)", ...glassCard, padding: "16px 20px", width: 210 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-subtle)", marginBottom: 12 }}>
                Body Language
              </div>
              {[
                { label: "Posture",   value: 0.87, color: "#7c6ff7" },
                { label: "Gestures",  value: 0.74, color: "#10b981" },
                { label: "Eye Level", value: 0.92, color: "#3b82f6" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>{label}</span>
                    <span style={{ fontWeight: 700, color: "var(--text)" }}>{Math.round(value * 100)}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(0,0,0,0.06)", borderRadius: 99 }}>
                    <div style={{ width: `${value * 100}%`, height: "100%", background: color, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom fade */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 160, background: "linear-gradient(to bottom, transparent, var(--bg))", pointerEvents: "none", zIndex: 5 }} />
      </section>

      {/* ═══ HOW IT WORKS — blur-sibling hover ═══ */}
      <section id="how" style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 40px 0" }}>
        <ScrollReveal>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-subtle)", marginBottom: 12 }}>
            How it works
          </p>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 46px)", fontWeight: 900, letterSpacing: "-2px", margin: "0 0 52px", lineHeight: 1.07, color: "var(--text)", maxWidth: 680 }}>
            Your path to becoming a better speaker starts with three simple steps.
          </h2>
        </ScrollReveal>

        {/* Step cards — uses CSS .step-cards and .step-card for blur effect */}
        <div className="step-cards">

          {/* Step 01 */}
          <div className="step-card" style={{ background: "#1e3a5f" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.07em", marginBottom: 20 }}>01</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#fff", letterSpacing: "-0.4px" }}>Allow Camera &amp; Mic</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.65 }}>
              Grant permission once — no downloads, no accounts needed.
            </div>
            <PreviewPermission />
          </div>

          {/* Step 02 */}
          <div className="step-card" style={{ background: "#3b0764" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.07em", marginBottom: 20 }}>02</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#fff", letterSpacing: "-0.4px" }}>Start Speaking</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.65 }}>
              SpeakForge immediately analyses your voice and body language.
            </div>
            <PreviewWaveform />
          </div>

          {/* Step 03 */}
          <div className="step-card" style={{ background: "#064e3b" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.07em", marginBottom: 20 }}>03</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#fff", letterSpacing: "-0.4px" }}>Read Your Live Score</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.65 }}>
              Watch WPM, posture, gestures, and fillers update in real time.
            </div>
            <PreviewScores />
          </div>

        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 40px 0" }}>
        <ScrollReveal>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-subtle)", marginBottom: 12 }}>
            What we track
          </p>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 900, letterSpacing: "-2.5px", margin: "0 0 52px", lineHeight: 1.02, color: "var(--text)" }}>
            Every dimension of your delivery.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <FeatureDeck />
        </ScrollReveal>
      </section>

      {/* ═══ CTA ═══ */}
      <section id="cta" style={{ maxWidth: 1100, margin: "100px auto 0", padding: "0 40px 120px" }}>
        <ScrollReveal>
          <Card
            glass={false}
            style={{
              padding: "72px 56px",
              background: "rgba(0,0,0,0.88)",
              border: "none",
              boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
              textAlign: "center",
            }}
          >
            <h2 style={{ fontSize: "clamp(28px, 4vw, 52px)", fontWeight: 900, letterSpacing: "-2.5px", margin: "0 0 14px", color: "#fff", lineHeight: 1.02 }}>
              Ready to become a better speaker?
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", margin: "0 0 36px", letterSpacing: "-0.2px" }}>
              No sign-up, no download. Just open the coach and start speaking.
            </p>
            <Link href="/coach">
              <button
                className="btn-primary"
                style={{
                  background: "#fff",
                  color: "rgba(0,0,0,0.9)",
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  padding: "15px 44px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "-0.3px",
                }}
              >
                Launch Coach
              </button>
            </Link>
          </Card>
        </ScrollReveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ borderTop: "1px solid var(--border-light)", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.3px" }}>
          <span style={{ opacity: 0.35, fontWeight: 400 }}>speak</span>forge
        </span>
        <span style={{ fontSize: 13, color: "var(--text-subtle)" }}>2025 SpeakForge · HackTCNJ 2026</span>
      </footer>
    </div>
  );
}
