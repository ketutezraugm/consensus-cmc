import { scoreHistory, anomalyRows } from '@/lib/data';
import { alerts } from '@/lib/alerts';

// Public, read-only. The same list the /alerts page shows, for bots and agents.
export async function GET() {
  const [scores, anoms] = await Promise.all([scoreHistory(), anomalyRows()]);
  return Response.json({ generated_at: new Date().toISOString(), alerts: alerts(scores, anoms) }, { headers: { 'Cache-Control': 'no-store' } });
}
