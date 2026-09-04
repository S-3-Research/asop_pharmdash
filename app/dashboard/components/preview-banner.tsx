import type { ChannelName } from "@/lib/releases";

const bannerConfig: Partial<Record<ChannelName, { bg: string; label: string }>> = {
  dev: {
    bg: "bg-sky-600",
    label: "Development Build — Internal Use Only",
  },
  preview: {
    bg: "bg-emerald-500",
    label: "Data Preview Mode — Work in Progress",
  },
  production: {
    bg: "bg-amber-500",
    label: "Rx Watchdog Has Not Launched — Data Shown Is Mock Data",
  },
};

export function PreviewBanner({ channel }: { channel: ChannelName }) {
  const config = bannerConfig[channel];
  if (!config) return null;

  return (
    <div
      className={`relative flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold text-white ${config.bg}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      <span className="relative">{config.label}</span>
    </div>
  );
}
