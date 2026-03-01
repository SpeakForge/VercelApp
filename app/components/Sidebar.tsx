"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface SidebarItem {
  icon: string;
  label: string;
  href: string;
}

const ITEMS: SidebarItem[] = [
  { icon: "·", label: "Home",  href: "/" },
  { icon: "·", label: "Coach", href: "/coach" },
];

export default function Sidebar({ children }: { children?: ReactNode }) {
  const path = usePathname();

  return (
    <aside
      className="sidebar-mobile-hidden"
      style={{
        width: "var(--sidebar-w)",
        minWidth: "var(--sidebar-w)",
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border-light)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 14px 20px",
        gap: 4,
        boxShadow: "var(--shadow-xs)",
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 8px",
          marginBottom: 28,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", letterSpacing: "-0.3px" }}>
          <span style={{ opacity: 0.4, fontWeight: 400 }}>speak</span>forge
        </span>
      </div>

      {/* Nav items */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {ITEMS.map(({ icon, label, href }) => {
          const active = path === href;
          return (
            <Link key={href} href={href} style={{ textDecoration: "none" }}>
              <div
                className="sidebar-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: active ? "var(--accent-light)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  fontWeight: active ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                <span>{label}</span>
                {active && (
                  <div
                    style={{
                      marginLeft: "auto",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent)",
                    }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer tag */}
      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-subtle)" }}>
        SpeakForge · v0.1
      </div>

      {children}
    </aside>
  );
}
