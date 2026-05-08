import { Dashboard } from "@/components/dashboard";
import { getLeads } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialLeads = await getLeads();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-muted/40 via-background to-background">
      <Dashboard initialLeads={initialLeads} />
    </div>
  );
}
