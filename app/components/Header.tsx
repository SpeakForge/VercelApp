"use client";

import { ReactNode } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  badge?: { label: string; color: "green" | "red" | "gray" };
  right?: ReactNode;
}

const BADGE_STYLES = {
  green: { bg: "#dcfce7", color: "#15803d" },
  red:   { bg: "#fee2e2", color: "#dc2626" },
  gray:  { bg: "var(--surface2)", color: "var(--text-muted)" },
};

export default function Header({ title, subtitle, badge, right }: HeaderProps) {
  const bs = badge ? BADGE_STYLES[badge.color] : null;

  return (
    <header
      style={{
        height: "var(--header-h)",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border-light)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 12,
        boxShadow: "var(--shadow-xs)",
        position: "sticky",
        top: 0,
        zIndex: 9,
      }}
    >
      {/* Title group */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.4px",
            color: "var(--text)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <span
            style={{
              fontSize: 12,
              color: "var(--text-subtle)",
              fontWeight: 500,
              paddingLeft: 2,
            }}
          >
            {subtitle}
          </span>
        )}
        {badge && bs && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: bs.bg,
              color: bs.color,
              borderRadius: "var(--radius-pill)",
              padding: "3px 11px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span
              className={badge.color === "green" ? "live-dot" : undefined}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "currentColor",
                display: "inline-block",
              }}
            />
            {badge.label}
          </span>
        )}
      </div>

      {/* Right slot */}
      {right && <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{right}</div>}

      {/* Avatar placeholder */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "var(--accent-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
          cursor: "pointer",
          border: "2px solid var(--surface)",
          boxShadow: "0 0 0 2px var(--border-light)",
        }}
      >
        🧑
      </div>
    </header>
  );
}
