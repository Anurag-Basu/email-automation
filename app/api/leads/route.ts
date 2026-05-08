import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getLeads } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const leads = await getLeads();
    return NextResponse.json({ leads });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load leads";
    return jsonError(message, 500);
  }
}
