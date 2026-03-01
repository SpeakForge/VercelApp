import { CSSProperties, ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
  type?: "button" | "submit" | "reset";
}

const VARIANT_STYLES: Record<string, CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
  },
  ghost: {
    background: "rgba(255,255,255,0.55)",
    color: "var(--text-muted)",
    border: "1px solid rgba(30,45,82,0.14)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  },
  danger: {
    background: "#fee2e2",
    color: "#dc2626",
    border: "1.5px solid #fca5a5",
  },
  success: {
    background: "#dcfce7",
    color: "#15803d",
    border: "1.5px solid #86efac",
  },
};

const SIZE_STYLES: Record<string, CSSProperties> = {
  sm: { padding: "6px 16px",  fontSize: 13, fontWeight: 600 },
  md: { padding: "10px 22px", fontSize: 14, fontWeight: 700 },
  lg: { padding: "16px 44px", fontSize: 17, fontWeight: 700 },
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  onClick,
  disabled,
  style = {},
  className = "",
  type = "button",
}: ButtonProps) {
  const base: CSSProperties = {
    borderRadius: "var(--radius-pill)",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    opacity: disabled ? 0.6 : 1,
    whiteSpace: "nowrap",
    lineHeight: 1,
    ...VARIANT_STYLES[variant],
    ...SIZE_STYLES[size],
    ...style,
  };

  const cls = `${variant === "primary" ? "btn-primary" : "btn-ghost"} ${className}`;

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} style={base}>
      {children}
    </button>
  );
}
