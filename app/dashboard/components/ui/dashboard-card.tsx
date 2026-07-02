import type { ReactNode } from "react";

type DashboardCardProps = {
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  variant?: "light" | "teal";
  className?: string;
  children: ReactNode;
  note?: ReactNode;
};

export function DashboardCard({
  title,
  subtitle,
  rightSlot,
  variant = "light",
  className,
  children,
  note,
}: DashboardCardProps) {
  const isTeal = variant === "teal";

  return (
    <section
      className={`rounded-xl border p-4 shadow-sm ${
        isTeal
          ? "border-[#2d6470] bg-[#1f4e58] text-white"
          : "border-gray-100 bg-white text-slate-900"
      } ${className ?? ""}`}
    >
      {title ? (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className={`text-sm font-semibold ${isTeal ? "text-white" : "text-slate-900"}`}>
              {title}
            </h3>
            {subtitle ? (
              <p className={`mt-1 text-xs ${isTeal ? "text-[#9cd3e0]" : "text-slate-500"}`}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {rightSlot}
        </header>
      ) : null}
      {children}
      {note ? (
        <div className={`mt-3 border-t pt-2.5 ${
          isTeal ? "border-white/10" : "border-gray-100"
        }`}>
          {note}
        </div>
      ) : null}
    </section>
  );
}
