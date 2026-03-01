import Link from "next/link";

export default function Navbar() {
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
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: "-0.4px",
          }}
        >
          <span style={{ opacity: 0.4, fontWeight: 400 }}>speak</span>forge
        </span>
      </Link>

      {/* Left: Live Coaching + Practice */}
      <div style={{ display: "flex", gap: 8, marginLeft: 20, flex: 1 }}>
        <Link href="/coach">
          <button
            className="btn-primary"
            style={{
              background: "var(--text)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "-0.2px",
            }}
          >
            Live Coaching
          </button>
        </Link>

        <button
          className="btn-ghost"
          style={{
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-pill)",
            padding: "7px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "-0.2px",
          }}
        >
          Practice
        </button>
      </div>

      {/* Right: Sign in + Get Started */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <Link href="/login">
          <button
            className="btn-ghost"
            style={{
              background: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-pill)",
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "-0.2px",
            }}
          >
            Sign in
          </button>
        </Link>

        <Link href="/#cta">
          <button
            className="btn-primary"
            style={{
              background: "var(--text)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "-0.2px",
            }}
          >
            Get Started
          </button>
        </Link>
      </div>
    </nav>
  );
}
