import type { ReactNode } from "react";

type TopNavProps = {
  title: string;
  rightSlot?: ReactNode;
};

export function TopNav({ title, rightSlot }: TopNavProps) {
  return (
    <header className="flex h-14 items-center justify-end bg-[#0a1116] px-6 text-sm text-slate-300 shadow-md">
      {/* <div className="text-slate-400">{title}</div> */}
      <div className="flex items-center gap-6">
        <button type="button" className="transition-colors hover:text-white">
          Home
        </button>
        <button type="button" className="transition-colors hover:text-white">
          App ▾
        </button>
        <div>{rightSlot}</div>
      </div>
    </header>
  );
}
