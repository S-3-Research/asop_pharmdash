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

import type { PageContext, SelectedWidget } from "@/app/dashboard/components/copilot/types";

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
    `Reporting Period: ${ctx.reportingPeriod}`,
    `Active Filters: ${
      ctx.filters.categories.length > 0
        ? ctx.filters.categories.join(", ")
        : "None"
    }${ctx.filters.platform ? ` · Platform: ${ctx.filters.platform}` : ""}`,
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
    if (widget.dataPoints && widget.dataPoints.length > 0) {
      lines.push("Data Points:");
      for (const dp of widget.dataPoints) {
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
  };

  const { messages, id: sessionId, pageContext, selectedWidget } = body;

  console.log(
    `[copilot] session=${sessionId} page=${pageContext?.page} msgs=${messages.length}`,
  );

  // ── Tool definitions ──────────────────────────────────────────────────────

  const filterTool = tool({
    description:
      "Propose a filter change for the user to review and confirm before applying. " +
      "Use this when you want to suggest a specific filter to focus the user's analysis. " +
      "The user will see a confirmation prompt before the filter is applied.",
    inputSchema: z.object({
      actionType: z
        .enum(["set_categories", "set_platform", "clear_filters"])
        .describe("The type of filter action to propose"),
      categories: z
        .array(z.string())
        .optional()
        .describe(
          "Category names to set (required for set_categories). " +
            "Use the category names as they appear in the dashboard: " +
            "GLP-1, Cancer Med, CNS Med, Pain Med",
        ),
      platform: z
        .string()
        .optional()
        .describe(
          "Platform name to set (required for set_platform). " +
            "Examples: Reddit, X, YouTube, Instagram, TikTok, Telegram",
        ),
      description: z
        .string()
        .describe(
          "Human-readable explanation of what this filter change will do, shown to the user",
        ),
    }),
    execute: async ({ actionType, categories, platform, description }) => {
      return {
        proposedAction: {
          id: crypto.randomUUID(),
          actionType,
          categories,
          platform,
          description,
        },
        status: "awaiting_confirmation",
      };
    },
  });

  const tools = { propose_filter_action: filterTool };

  // ── Stream ────────────────────────────────────────────────────────────────

  const result = streamText({
    model: openaiClient("gpt-4o-mini"),
    system: buildSystemPrompt(
      pageContext ?? {
        page: "top-products",
        pageTitle: "Top Products",
        reportingPeriod: "2026-04-01 ~ 2026-06-30",
        filters: { categories: [] },
        stats: [],
      },
      selectedWidget ?? null,
    ),
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(3),
    tools,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, tools }),
  });
}
