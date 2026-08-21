"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import type { ChannelName } from "@/lib/releases";
import { CopilotPanel } from "./copilot/copilot-panel";
import { CopilotProvider, useCopilot } from "./copilot/copilot-context";
import { sidebarItems } from "./mock-data";
import { PreviewBanner } from "./preview-banner";
import { Sidebar } from "./sidebar";
import {
  DomainInsightsSubpage,
  SocialMediaInsightsSubpage,
  TopProductsSubpage,
} from "./subpages";
import { TopNav } from "./top-nav";
import type { SubPageKey } from "./types";

const defaultSubPage: SubPageKey = "top-products";

const subpageTitleMap: Record<SubPageKey, string> = {
  "top-products": "Overview",
  "domain-insights": "Domain Insights",
  "social-media-insights": "Social Media Insights",
};

// ── Toggle button (needs context, so lives inside CopilotProvider) ────────────

function CopilotToggleButton() {
  const { togglePanel, isPanelOpen } = useCopilot();
  return (
    <button
      type="button"
      onClick={togglePanel}
      title={isPanelOpen ? "Close Copilot" : "Open Copilot"}
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all active:scale-95"
      style={
        isPanelOpen
          ? {
              background: "linear-gradient(135deg, #64D6D8 0%, #4ecdd0 100%)",
              color: "#fff",
              boxShadow: "0 2px 10px #64D6D850",
            }
          : {
              background: "rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(255,255,255,0.18)",
            }
      }
    >
      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
      Copilot
      {!isPanelOpen && (
        <span
          className="rounded-full px-1.5 py-[1px] text-[9px] font-bold leading-none tracking-wide"
          style={{ background: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.85)" }}
        >
          BETA
        </span>
      )}
    </button>
  );
}

// ── Inner shell (uses context) ────────────────────────────────────────────────

function DashboardShellInner({ channel }: { channel: ChannelName }) {
  const [activeSubPage, setActiveSubPage] = useState<SubPageKey>(defaultSubPage);
  const { setSelectedWidget, isPanelOpen } = useCopilot();

  // User's manually-chosen collapse preference, persisted across sessions.
  // Kept separate from the Copilot-driven force-collapse below so opening/
  // closing Copilot never overwrites what the user actually asked for.
  const [userCollapsed, setUserCollapsed] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem("sidebar-collapsed");
    if (stored === "1") setUserCollapsed(true);
  }, []);

  function toggleSidebarCollapsed() {
    setUserCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  // Effective collapsed state: the user's own preference OR a temporary
  // override while the Copilot panel is open (there's limited horizontal
  // room once Copilot's 380px panel is showing, so the sidebar auto-narrows
  // — this does NOT touch/overwrite the user's stored preference, it just
  // renders narrow for as long as the panel stays open).
  const sidebarCollapsed = userCollapsed || isPanelOpen;

  // Clear selection when navigating between pages.
  // NOTE: page context (page/pageTitle/filters/stats) is owned and synced by
  // each subpage's own effect — resetting it here would race with (and wipe)
  // the subpage's sync effect, which runs before this parent effect.
  useEffect(() => {
    setSelectedWidget(null);
  }, [activeSubPage, setSelectedWidget]);

  const subPageContent = useMemo(() => {
    if (activeSubPage === "domain-insights") return <DomainInsightsSubpage />;
    if (activeSubPage === "social-media-insights") return <SocialMediaInsightsSubpage />;
    return <TopProductsSubpage />;
  }, [activeSubPage]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a1116] font-sans">
      <PreviewBanner channel={channel} />
      <div className="flex min-h-0 flex-1">
        {/* Sidebar is a direct child of this row (not nested under TopNav),
            so it naturally spans the row's full height — the Logo it
            renders (in its own fixed-size, position-independent header
            slot) is never squeezed/cut by TopNav's height. */}
        <Sidebar
          items={sidebarItems}
          activeKey={activeSubPage}
          onChange={setActiveSubPage}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />

        {/* Right-hand column: TopNav sits above main+Copilot, confined to
            this column's width (not the Sidebar's) — its total height
            (56px + row) matches the Sidebar's full height exactly. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav
            title={subpageTitleMap[activeSubPage]}
            rightSlot={
              <div className="flex items-center gap-3">
                <CopilotToggleButton />
              </div>
            }
          />
          <div className="flex min-h-0 flex-1">
            <main className="flex-1 overflow-y-auto p-6 rounded-tl-3xl bg-[#f3f7f9]">
              {subPageContent}
            </main>

            {/* Right-side Copilot panel — full height of this row, shows/hides via context */}
            <CopilotPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function DashboardShell({ channel }: { channel: ChannelName }) {
  return (
    <CopilotProvider>
      <DashboardShellInner channel={channel} />
    </CopilotProvider>
  );
}
