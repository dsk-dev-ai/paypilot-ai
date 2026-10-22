import Link from "next/link";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn relative inline-flex items-center justify-center gap-2 font-medium rounded-xl disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap transition-all duration-300 active:scale-[0.97] overflow-hidden";

const variants: Record<Variant, string> = {
  primary:
    "shine text-white bg-[linear-gradient(110deg,#6d8dff,#a07bff,#4ad4ff,#6d8dff)] bg-[length:200%_200%] shadow-[0_6px_28px_rgba(109,141,255,0.4)] hover:shadow-[0_10px_40px_rgba(160,123,255,0.55)] hover:bg-[position:100%_50%]",
  secondary: "glass text-text border border-line-strong hover:border-accent/50 hover:text-accent",
  outline: "border border-line-strong text-text hover:border-accent hover:text-accent hover:bg-accent/5",
  ghost: "text-muted hover:text-text hover:bg-line",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5",
  md: "text-sm px-4 py-2.5",
  lg: "text-base px-6 py-3",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: Size;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
