"use client";

import { useMemo, useState } from "react";

import { LogoutButton } from "../logout-button";
import { sidebarItems } from "./mock-data";
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
  "top-products": "Top Products",
  "domain-insights": "Domain Insights",
  "social-media-insights": "Social Media Insights",
};

export function DashboardShell() {
  const [activeSubPage, setActiveSubPage] = useState<SubPageKey>(defaultSubPage);

  const subPageContent = useMemo(() => {
    if (activeSubPage === "domain-insights") {
      return <DomainInsightsSubpage />;
    }

    if (activeSubPage === "social-media-insights") {
      return <SocialMediaInsightsSubpage />;
    }

    return <TopProductsSubpage />;
  }, [activeSubPage]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a1116] font-sans">
      <Sidebar
        items={sidebarItems}
        activeKey={activeSubPage}
        onChange={setActiveSubPage}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          title={subpageTitleMap[activeSubPage]}
          rightSlot={
            <LogoutButton className="rounded px-1 text-slate-300 transition-colors hover:text-white" />
          }
        />

        <main className="flex-1 overflow-y-auto p-6 rounded-tl-3xl bg-[#f3f7f9]">{subPageContent}</main>
      </div>
    </div>
  );
}
