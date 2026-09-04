import Image from "next/image";

/**
 * Minimal logo-only top bar used on secondary pages (Users, Settings,
 * Data Releases) that live outside the main dashboard shell/sidebar.
 * Matches the dark header color used inside the dashboard shell so
 * navigating between these pages and the dashboard feels consistent.
 */
export function LogoNav() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 bg-[#0a1116] px-6 shadow-md">
      <Image
        src="/ASOP Global wht x S3.png"
        alt="ASOP Global x S3"
        width={176}
        height={28}
        className="h-10 w-auto"
        priority
      />
      <span className="h-6 w-px bg-white/20" aria-hidden="true" />
      <span className="whitespace-nowrap text-xs font-semibold text-white">Rx Watchdog</span>
    </header>
  );
}
