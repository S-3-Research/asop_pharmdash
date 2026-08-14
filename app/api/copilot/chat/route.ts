import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

import type {
  PageContext,
  SelectedWidget,
  WidgetSnapshot,
} from "@/app/dashboard/components/copilot/types";

// ── Proxy support ─────────────────────────────────────────────────────────────
// Node.js does NOT automatically use the system HTTP proxy set by a VPN in
// proxy mode (Clash / V2Ray / Surge etc.).
// Set HTTPS_PROXY=http://127.0.0.1:<port> in .env.local so that all
// server-side fetch calls (including OpenAI) route through the local proxy.
//   Clash default:  7890
//   V2Ray default:  10809
//   Surge default:  6152
{
  const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  if (proxyUrl) {
    // undici is included with Node.js 18+; use require() to avoid TypeScript
    // bundler-resolution issues caused by undici's missing exports field.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ProxyAgent, setGlobalDispatcher } = require("undici");
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  }
}

// ── OpenAI client ─────────────────────────────────────────────────────────────
const openaiClient = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Use || (not ??) so that an empty string also falls back to the default URL
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  ctx: PageContext,
  widget: SelectedWidget | null,
  widgetsSnapshot?: WidgetSnapshot[],
): string {
  const lines: string[] = [
    "You are a dashboard copilot for a pharmaceutical surveillance platform.",
    "You help analysts understand and operate a data dashboard that monitors",
    "illegal pharmaceutical listings, rogue domains, and social media signals.",
    "",
    "Capabilities:",
    "- Explain charts, metric cards, tables, and filters",
    "- Suggest useful filters based on the current data",
    "- Summarize selected widgets or the overall dashboard state",
    "- Compare current values to prior periods",
    "- Draft email summaries for stakeholders",
    "- Propose UI filter changes using the propose_filter_action tool",
    "",
    "Rules:",
    "- Use ONLY the provided page context and widget data. Do not invent numbers.",
    "- If data is insufficient, clearly state what is missing.",
    "- For filter changes, always use the propose_filter_action tool — never",
    "  pretend the filter was already applied.",
    "- For email drafts, produce the text only; do not claim it was sent.",
    "- Keep responses concise and use markdown for structure.",
    "- For destructive or external actions, require explicit user confirmation.",
    "",
    "=== CURRENT PAGE CONTEXT ===",
    `Page: ${ctx.pageTitle} (${ctx.page})`,
    `Reporting Period: ${
      ctx.reportingPeriod === "mock-data"
        ? "mock-data (no data release published — the dashboard is showing built-in mock data)"
        : ctx.reportingPeriod
          ? `${ctx.reportingPeriod} (format: <year>-RPT-<n>, the n-th reporting period of that year; a rolling 3-month window. Refer to periods by this identifier only — never by concrete calendar dates.)`
          : "unknown (data not loaded)"
    }`,
    `Active Filters: ${
      ctx.filters.categories.length > 0
        ? ctx.filters.categories.join(", ")
        : "None"
    }${ctx.filters.platform ? ` · Platform: ${ctx.filters.platform}` : ""}`,
    "",
    "=== AVAILABLE FILTERS ON THIS PAGE (use ONLY these exact values) ===",
    `Category selection mode: ${ctx.availableFilters.categorySelectionMode} ` +
      (ctx.availableFilters.categorySelectionMode === "single"
        ? "(only ONE category can be active at a time on this page)"
        : "(multiple categories can be active at once, OR-matched)"),
    `Selectable categories: ${
      ctx.availableFilters.categories.length > 0
        ? ctx.availableFilters.categories.join(", ")
        : "(none available yet)"
    }`,
    ctx.availableFilters.platforms
      ? `Selectable platforms: ${
          ctx.availableFilters.platforms.length > 0
            ? ctx.availableFilters.platforms.join(", ")
            : "(none available yet)"
        }`
      : "This page has NO platform filter — never propose a set_platform action here.",
    "IMPORTANT: propose_filter_action's `categories`/`platform` arguments MUST " +
      "be chosen ONLY from the lists above, spelled exactly as shown. Never " +
      "invent or guess a category/platform name that isn't listed.",
  ];

  if (ctx.stats.length > 0) {
    lines.push("", "Visible Metrics:");
    for (const s of ctx.stats) {
      const change = s.change ? ` (${s.change})` : "";
      lines.push(`  - ${s.label}: ${s.value}${change}`);
    }
  }

  if (widget) {
    lines.push(
      "",
      "=== SELECTED WIDGET ===",
      `Title: ${widget.title}`,
      `Type: ${widget.type}`,
    );
    if (widget.description) {
      lines.push(`Description: ${widget.description}`);
    }
    if (widget.dataNote) {
      lines.push(
        "Card Data Notes (what this card shows and where its data comes from):",
        widget.dataNote,
      );
    }
    if (widget.dataPoints && widget.dataPoints.length > 0) {
      lines.push("Data Points:");
      for (const dp of widget.dataPoints) {
        lines.push(`  - ${dp.label}: ${dp.value}`);
      }
    }
  }

  if (widgetsSnapshot && widgetsSnapshot.length > 0) {
    lines.push(
      "",
      "=== ALL VISIBLE CARDS (live data snapshot) ===",
      "The user asked a page-level question; below is the live data of every card currently on screen.",
    );
    for (const w of widgetsSnapshot) {
      lines.push("", `--- Card: ${w.widgetId} ---`);
      if (w.prompt) lines.push(w.prompt);
      for (const dp of w.dataPoints) {
        lines.push(`  - ${dp.label}: ${dp.value}`);
      }
    }
  }

  return lines.join("\n");
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const body = (await req.json()) as {
    messages: UIMessage[];
    id?: string;
    pageContext?: PageContext;
    selectedWidget?: SelectedWidget | null;
    widgetsSnapshot?: WidgetSnapshot[];
    /** When true (Suggest filters / Suggest a filter buttons), the model MUST
     *  call propose_filter_action on its first step instead of just chatting
     *  about filters — see the prepareStep forcing below. */
    forceFilterTool?: boolean;
  };

  const { messages, id: sessionId, pageContext, selectedWidget, widgetsSnapshot, forceFilterTool } = body;

  console.log(
    `[copilot] session=${sessionId} page=${pageContext?.page} msgs=${messages.length}`,
  );
  console.log(
    "[copilot:server] received pageContext:",
    JSON.stringify(pageContext, null, 2),
  );
  console.log(
    "[copilot:server] received selectedWidget:",
    JSON.stringify(selectedWidget, null, 2),
  );

  // ── Tool definitions ──────────────────────────────────────────────────────

  const filterTool = tool({
    description:
      "Propose a filter change for the user to review and confirm before applying. " +
      "Use this when you want to suggest a specific filter to focus the user's analysis. " +
      "The user will see a confirmation prompt before the filter is applied. " +
      "`categories` and `platform` MUST be chosen only from the current page's " +
      "'AVAILABLE FILTERS' list in the system prompt — values not in that list " +
      "will be rejected.",
    inputSchema: z.object({
      actionType: z
        .enum(["set_categories", "set_platform", "clear_filters"])
        .describe("The type of filter action to propose"),
      categories: z
        .array(z.string())
        .optional()
        .describe(
          "Category names to set (required for set_categories). Must exactly " +
            "match names from the current page's 'Selectable categories' list — " +
            "do not invent names. If the page's category selection mode is " +
            "'single', provide exactly one category.",
        ),
      platform: z
        .string()
        .optional()
        .describe(
          "Platform name to set (required for set_platform). Must exactly match " +
            "one entry from the current page's 'Selectable platforms' list. Only " +
            "propose this on pages that have a platform filter.",
        ),
      description: z
        .string()
        .describe(
          "Human-readable explanation of what this filter change will do, shown to the user",
        ),
    }),
    execute: async ({ actionType, categories, platform, description }) => {
      const available = pageContext?.availableFilters;

      if (actionType === "set_categories") {
        const validCategories = (categories ?? []).filter((c) =>
          available?.categories.includes(c),
        );
        if (validCategories.length === 0) {
          return {
            status: "invalid",
            reason: `None of the proposed categories (${(categories ?? []).join(", ") || "none given"}) exist on this page. Available categories: ${available?.categories.join(", ") || "none"}. Do not tell the user the filter was applied — explain the mismatch instead.`,
          };
        }
        const finalCategories =
          available?.categorySelectionMode === "single"
            ? [validCategories[0]]
            : validCategories;
        return {
          proposedAction: {
            id: crypto.randomUUID(),
            actionType,
            categories: finalCategories,
            description,
          },
          status: "awaiting_confirmation",
        };
      }

      if (actionType === "set_platform") {
        if (!available?.platforms) {
          return {
            status: "invalid",
            reason: "This page has no platform filter. Do not propose a platform change here.",
          };
        }
        if (!platform || !available.platforms.includes(platform)) {
          return {
            status: "invalid",
            reason: `Platform "${platform ?? "(none given)"}" does not exist on this page. Available platforms: ${available.platforms.join(", ")}. Do not tell the user the filter was applied — explain the mismatch instead.`,
          };
        }
        return {
          proposedAction: {
            id: crypto.randomUUID(),
            actionType,
            platform,
            description,
          },
          status: "awaiting_confirmation",
        };
      }

      // clear_filters always valid — no page-specific values to check
      return {
        proposedAction: {
          id: crypto.randomUUID(),
          actionType,
          description,
        },
        status: "awaiting_confirmation",
      };
    },
  });

  const tools = { propose_filter_action: filterTool };

  // ── Stream ────────────────────────────────────────────────────────────────

  const systemPrompt = buildSystemPrompt(
    pageContext ?? {
      page: "top-products",
      pageTitle: "Top Products",
      reportingPeriod: "",
      filters: { categories: [] },
      availableFilters: { categories: [], categorySelectionMode: "single" },
      stats: [],
    },
    selectedWidget ?? null,
    widgetsSnapshot,
  );

  console.log("[copilot:server] system prompt:\n" + systemPrompt);

  const result = streamText({
    model: openaiClient("gpt-4o-mini"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(3),
    tools,
    // "Suggest filters" buttons must actually trigger propose_filter_action,
    // not just a text description of what filter to use — force it on step 0
    // only, so the model can still follow up with explanatory text once the
    // tool result comes back (forcing it on every step would loop forever).
    prepareStep: forceFilterTool
      ? ({ stepNumber }) =>
          stepNumber === 0
            ? { toolChoice: { type: "tool", toolName: "propose_filter_action" } }
            : {}
      : undefined,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, tools }),
  });
}
