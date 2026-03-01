import { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  hoverable?: boolean;
  padding?: string | number;
  /** Use frosted-glass style (backdrop-filter) */
  glass?: boolean;
}

export default function Card({
  children,
  className = "",
  style = {},
  hoverable = false,
  padding = "20px",
  glass = true,
}: CardProps) {
  const base: CSSProperties = glass
    ? {
        background: "rgba(255, 255, 255, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        border: "1px solid rgba(255, 255, 255, 0.65)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 0 1px 1px #1e2d520f, 1px 1px 1px #1e2d5233",
        padding,
      }
    : {
        background: "var(--surface-solid)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding,
      };

  return (
    <div
      className={`${hoverable ? "card-hover" : ""} ${className}`}
      style={{ ...base, ...style }}
    >
      {children}
    </div>
  );
}
