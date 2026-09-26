import { handleRpc } from '@/lib/mcp';

export const maxDuration = 30;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, mcp-protocol-version, mcp-session-id, accept' };

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });

// The server is stateless and read-only, so there is no GET/SSE stream and no session.
export const GET = () => new Response('This MCP server accepts POST (Streamable HTTP, JSON responses).', { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } });

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers: CORS });
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m)))).filter(Boolean);
    return out.length ? Response.json(out, { headers: CORS }) : new Response(null, { status: 202, headers: CORS });
  }
  const res = await handleRpc(body);
  return res ? Response.json(res, { headers: CORS }) : new Response(null, { status: 202, headers: CORS });
}
