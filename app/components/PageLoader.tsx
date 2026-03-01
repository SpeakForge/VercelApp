"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export default function PageLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [opaque, setOpaque] = useState(false);

  // Refs that never change identity — safe to capture in any closure
  const visibleRef = useRef(false);
  const prevPathRef = useRef(pathname);
  const pathnameRef = useRef(pathname);   // always current pathname
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep pathnameRef in sync every render
  pathnameRef.current = pathname;

  // ── Stable hide/show ─────────────────────────────────────────────────────
  const hide = useCallback(() => {
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    visibleRef.current = false;
    setOpaque(false);
    hideTimerRef.current = setTimeout(() => setVisible(false), 600);
  }, []);

  const show = useCallback(() => {
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    visibleRef.current = true;
    setVisible(true);
    setOpaque(false);
    rafRef.current = requestAnimationFrame(() =>
      requestAnimationFrame(() => { rafRef.current = null; setOpaque(true); })
    );
    // Safety: force-hide if pathname never changes within 3s
    safetyTimerRef.current = setTimeout(hide, 3000);
  }, [hide]);

  // ── Register click listener once; use pathnameRef to avoid stale checks ──
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("mailto") ||
        href.startsWith("tel")
      ) return;
      if (href.split("?")[0] === pathnameRef.current) return;
      show();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [show]); // show is stable (useCallback [hide]), registers once

  // ── Hide when pathname changes ────────────────────────────────────────────
  useEffect(() => {
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;
    if (visibleRef.current) hide();
  }, [pathname, hide]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: opaque ? 1 : 0,
        transition: "opacity 0.5s ease",
        pointerEvents: opaque ? "all" : "none",
      }}
    >
      <div className="spinner">
        <div /><div /><div /><div /><div /><div />
      </div>
    </div>
  );
}
