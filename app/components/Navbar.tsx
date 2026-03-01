"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.name) setUser(d); });
  }, []);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  };

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: "var(--header-h)",
        display: "flex",
        alignItems: "center",
        padding: "0 40px",
        background: "rgba(247, 250, 252, 0.82)",
        backdropFilter: "blur(6.73px)",
        WebkitBackdropFilter: "blur(6.73px)",
        borderBottom: "1px solid rgba(30, 45, 82, 0.07)",
        boxShadow: "0 1px 0 rgba(30,45,82,0.06)",
      }}
    >
      {/* Brand */}
      <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.4px" }}>
          <span style={{ opacity: 0.4, fontWeight: 400 }}>speak</span>forge
        </span>
      </Link>

      {/* Left: Live Coaching + Practice */}
      <div style={{ display: "flex", gap: 8, marginLeft: 20, flex: 1 }}>
        <Link href="/coach">
          <button
            className="btn-primary"
            style={{
              background: "var(--text)", color: "#fff", border: "none",
              borderRadius: "var(--radius-pill)", padding: "7px 16px",
              fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.2px",
            }}
          >
            Live Coaching
          </button>
        </Link>
        <Link href="/practice">
          <button
            className="btn-ghost"
            style={{
              background: "transparent", color: "var(--text)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-pill)", padding: "7px 16px",
              fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.2px",
            }}
          >
            Practice
          </button>
        </Link>
      </div>

      {/* Right: auth-aware */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {user ? (
          <>
            <span style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              Hi, <strong>{user.name}</strong>
            </span>
            <button
              onClick={signOut}
              className="btn-ghost"
              style={{
                background: "transparent", color: "var(--text)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-pill)", padding: "8px 20px",
                fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.2px",
              }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link href="/auth">
              <button
                className="btn-ghost"
                style={{
                  background: "transparent", color: "var(--text)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-pill)", padding: "8px 20px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.2px",
                }}
              >
                Sign In
              </button>
            </Link>
            <Link href="/auth">
              <button
                className="btn-primary"
                style={{
                  background: "var(--text)", color: "#fff", border: "none",
                  borderRadius: "var(--radius-pill)", padding: "8px 20px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.2px",
                }}
              >
                Get Started
              </button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
