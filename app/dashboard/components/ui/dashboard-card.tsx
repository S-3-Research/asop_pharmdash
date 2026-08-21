import type { ReactNode } from "react";

type DashboardCardProps = {
  title?: string;
  subtitle?: string;
  subtitleClassName?: string;
  rightSlot?: ReactNode;
  variant?: "light" | "teal";
  className?: string;
  children: ReactNode;
  note?: ReactNode;
};

export function DashboardCard({
  title,
  subtitle,
  subtitleClassName,
  rightSlot,
  variant = "light",
  className,
  children,
  note,
}: DashboardCardProps) {
  const isTeal = variant === "teal";

  return (
    <section
      className={`flex flex-col rounded-xl border p-4 shadow-sm ${
        isTeal
          ? "border-[#2d6470] bg-[#1f4e58] text-white"
          : "border-gray-100 bg-white text-slate-900"
      } ${className ?? ""}`}
    >
      {title ? (
        <header className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h3 className={`text-sm font-semibold ${isTeal ? "text-white" : "text-slate-900"}`}>
              {title}
            </h3>
            {subtitle ? (
              <p
                className={`text-xs ${isTeal ? "text-[#9cd3e0]" : "text-slate-500"} ${
                  subtitleClassName ?? "mt-1"
                }`}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {rightSlot}
        </header>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {note ? (
        <div className={`mt-0 border-t pt-2 ${
          isTeal ? "border-white/10" : "border-gray-100"
        }`}>
          {note}
        </div>
      ) : null}
    </section>
  );
}
