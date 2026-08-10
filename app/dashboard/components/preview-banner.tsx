import type { ChannelName } from "@/lib/releases";

export function PreviewBanner({ channel }: { channel: ChannelName }) {
  if (channel !== "preview") return null;

  return (
    <div className="relative flex items-center justify-center gap-2 bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      <span className="relative">Data Preview Mode — Work in Progress</span>
    </div>
  );
}
