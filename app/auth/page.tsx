"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Mode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (m: Mode) => { setMode(m); setError(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { name, email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        router.push("/coach");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1.5px solid #e2e8f0",
    fontSize: 14,
    background: "#f8fafc",
    color: "#0d1117",
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6ff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#0d1117", letterSpacing: "-0.5px" }}>
              🎙️ SpeakForge
            </span>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: "#fff",
          borderRadius: 20,
          border: "1px solid #e2e8f0",
          padding: "32px 36px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}>

          {/* Tab toggle */}
          <div style={{
            display: "flex",
            background: "#f8fafc",
            borderRadius: 10,
            padding: 4,
            marginBottom: 28,
            gap: 4,
          }}>
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  padding: "8px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: mode === m ? "#fff" : "transparent",
                  color: mode === m ? "#0d1117" : "#94a3b8",
                  boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {mode === "register" && (
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  style={inputStyle}
                />
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                background: "#fee2e2",
                color: "#dc2626",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 500,
                border: "1px solid #fca5a5",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "#93c5fd" : "#3b5bdb",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px",
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4,
                transition: "background 0.2s",
                fontFamily: "inherit",
              }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign In →" : "Create Account →"}
            </button>

          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#94a3b8" }}>
          <Link href="/" style={{ color: "#3b5bdb", textDecoration: "none", fontWeight: 500 }}>
            ← Back to home
          </Link>
        </p>

      </div>
    </div>
  );
}
