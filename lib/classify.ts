import type { LeadCategory } from "@/lib/types";

const FULLSTACK = /\b(node\.?js|node\b|backend|back-end|full[\s-]?stack|api\b|express|nestjs|django|flask|spring|\.net|sql|postgres|mongodb|microservice)\b/i;

const FRONTEND = /\b(react|angular|vue|svelte|next\.?js|nuxt|html\b|css\b|typescript|javascript|front[\s-]?end|ui\b|ux\b|tailwind|sass|webpack|vite)\b/i;

/**
 * Classify a lead from free-text description.
 * Fullstack keywords take precedence when both could match.
 */
export function classifyDescription(description: string): LeadCategory {
  const text = description.trim();
  if (!text) return "frontend";
  if (FULLSTACK.test(text)) return "fullstack";
  if (FRONTEND.test(text)) return "frontend";
  return "frontend";
}
