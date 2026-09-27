import { scoreHistory, anomalyRows } from '@/lib/data';
import { alerts } from '@/lib/alerts';

// Public, read-only: the same list the /alerts page shows, for bots and agents.
// Cached like the rest of the site (revalidated by the recorder after each capture) so a burst of
// callers is served from the edge instead of each one reaching the database.
export const revalidate = 1800;

export async function GET() {
  const [scores, anoms] = await Promise.all([scoreHistory(), anomalyRows()]);
  return Response.json({ alerts: alerts(scores, anoms) });
}
