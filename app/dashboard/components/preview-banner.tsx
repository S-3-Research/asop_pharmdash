import type { ChannelName } from "@/lib/releases";

export function PreviewBanner({ channel }: { channel: ChannelName }) {
  if (channel !== "preview") return null;

  return (
    <div className="relative flex items-center justify-center gap-2 overflow-hidden bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white">
      <div
        className="pointer-events-none absolute inset-0 animate-[banner-shimmer_2.5s_linear_infinite] bg-[length:200%_100%]"
        style={{
          backgroundImage:
            "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)",
        }}
      />
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      <span className="relative">Data Preview Mode — Work in Progress</span>
    </div>
  );
}
