"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const SLIDES = [
  {
    bg: "linear-gradient(145deg, #0a0f1e 0%, #1e3a5f 55%, #004370 100%)",
    title: "Speak with\nconfidence.",
    sub: "Real-time AI coaching that transforms how you present.",
  },
  {
    bg: "linear-gradient(145deg, #1a0533 0%, #3b0764 55%, #5b21b6 100%)",
    title: "Every word\nmatters.",
    sub: "Track pace, filler words, and vocal variation live.",
  },
  {
    bg: "linear-gradient(145deg, #022c22 0%, #064e3b 55%, #0f766e 100%)",
    title: "Body language\nis your voice too.",
    sub: "Posture, gestures, and eye contact — all analysed.",
  },
];

const EyeIcon = ({ open }: { open: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

export default function LoginPage() {
  const [slide, setSlide] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    padding: "13px 16px",
    fontSize: 14,
    color: "var(--text)",
    background: "#fff",
    border: `1.5px solid ${focusedField === field ? "rgba(0,0,0,0.4)" : "var(--border)"}`,
    borderRadius: 12,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── LEFT: Sliding panels ── */}
      <div
        className="hide-mobile"
        style={{
          flex: "0 0 48%",
          position: "relative",
          overflow: "hidden",
          borderRadius: "0 0 0 0",
        }}
      >
        {/* Gradient slides */}
        {SLIDES.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              background: s.bg,
              opacity: i === slide ? 1 : 0,
              transition: "opacity 1s ease",
            }}
          />
        ))}

        {/* Subtle noise / grid overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
        }} />

        {/* Glow orbs */}
        <div style={{
          position: "absolute", top: "18%", left: "25%",
          width: 320, height: 320, borderRadius: "50%",
          background: "rgba(255,255,255,0.03)", filter: "blur(70px)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "25%", right: "5%",
          width: 220, height: 220, borderRadius: "50%",
          background: "rgba(255,255,255,0.05)", filter: "blur(50px)",
          pointerEvents: "none",
        }} />

        {/* Brand */}
        <div style={{
          position: "absolute", top: 36, left: 40,
          fontSize: 15, fontWeight: 600,
          color: "rgba(255,255,255,0.9)", letterSpacing: "-0.4px",
        }}>
          <span style={{ opacity: 0.45, fontWeight: 400 }}>speak</span>forge
        </div>

        {/* Slide copy */}
        <div style={{ position: "absolute", bottom: 56, left: 44, right: 44 }}>
          <div style={{ position: "relative", minHeight: 130 }}>
            {SLIDES.map((s, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: i === slide ? 1 : 0,
                  transform: i === slide ? "translateY(0)" : "translateY(14px)",
                  transition: "opacity 0.8s ease, transform 0.8s ease",
                  pointerEvents: i === slide ? "auto" : "none",
                }}
              >
                <h2 style={{
                  fontSize: "clamp(26px, 2.8vw, 38px)",
                  fontWeight: 900,
                  color: "#fff",
                  letterSpacing: "-1.8px",
                  lineHeight: 1.05,
                  margin: "0 0 12px",
                  whiteSpace: "pre-line",
                }}>
                  {s.title}
                </h2>
                <p style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.55)",
                  margin: 0,
                  lineHeight: 1.65,
                }}>
                  {s.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div style={{ display: "flex", gap: 6, marginTop: 28 }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                style={{
                  width: i === slide ? 24 : 8,
                  height: 8,
                  borderRadius: 99,
                  background: i === slide ? "#fff" : "rgba(255,255,255,0.28)",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form ── */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 40px",
        background: "var(--bg)",
      }}>
        <div style={{ width: "100%", maxWidth: 370 }}>

          {/* Back */}
          <Link
            href="/"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 13, color: "var(--text-muted)", textDecoration: "none",
              marginBottom: 52,
              opacity: 0.8,
            }}
          >
            ← Back
          </Link>

          <h1 style={{
            fontSize: "clamp(26px, 3vw, 34px)",
            fontWeight: 900,
            letterSpacing: "-1.5px",
            margin: "0 0 8px",
            color: "var(--text)",
            lineHeight: 1.1,
          }}>
            Welcome back.
          </h1>
          <p style={{
            fontSize: 14,
            color: "var(--text-muted)",
            margin: "0 0 40px",
            lineHeight: 1.5,
          }}>
            Sign in to your SpeakForge account.
          </p>

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block", marginBottom: 6,
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", color: "var(--text-muted)",
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              placeholder="you@example.com"
              style={inputStyle("email")}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 10 }}>
            <label style={{
              display: "block", marginBottom: 6,
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", color: "var(--text-muted)",
            }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                placeholder="••••••••"
                style={{ ...inputStyle("password"), paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={{
                  position: "absolute", right: 14, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-subtle)", padding: 0, lineHeight: 1,
                  display: "flex", alignItems: "center",
                }}
              >
                <EyeIcon open={showPw} />
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: "right", marginBottom: 32 }}>
            <a
              href="#"
              style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
            >
              Forgot password?
            </a>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary"
            style={{
              width: "100%",
              padding: "14px",
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              background: "var(--text)",
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
              letterSpacing: "-0.3px",
              marginBottom: 28,
            }}
          >
            Log in
          </button>

          {/* Divider */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 28,
          }}>
            <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
            <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
          </div>

          {/* Sign up */}
          <p style={{
            fontSize: 13, color: "var(--text-muted)",
            textAlign: "center", margin: 0,
          }}>
            Don't have an account?{" "}
            <Link
              href="/signup"
              style={{ color: "var(--text)", fontWeight: 700, textDecoration: "none" }}
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
