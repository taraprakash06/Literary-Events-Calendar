import { getIngestionConnectorStatuses } from "@/lib/source-connectors";

export const dynamic = "force-dynamic";

export async function GET() {
  const connectors = getIngestionConnectorStatuses();
  return Response.json({
    updatedAt: new Date().toISOString(),
    connectors,
  });
}
