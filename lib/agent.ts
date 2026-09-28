// Turns a free-text chat message into a grounded answer by giving a model the same tools the MCP
// server exposes (lib/mcp.ts's TOOLS) and letting it call them. The conversation is kept in a
// provider-neutral shape (Block/AgentMessage) so the model call is swappable — callGemini is the
// default; callAnthropic is kept as a drop-in alternative — without touching the loop itself. The
// model call is injected so the loop logic is unit-testable without a network call.
import type { Tool } from './mcp.ts';
import { errMsg } from './fmt.ts';

export const SYSTEM_PROMPT = [
  "You are Consensus's Telegram assistant. Consensus is a measurement instrument, not a trading terminal:",
  'it records every exchange\'s quote for a small set of tracked crypto and tokenised-stock assets on a',
  'fixed schedule and reports how much they disagree, who sets the price, and how CoinMarketCap\'s own',
  'published price compares. A tool\'s as_of field has the exact time of the reading — use it rather than',
  'stating a fixed cadence, since how often captures actually happen can vary.',
  '',
  'Always call a tool before answering any question about a specific price, trust score, exchange,',
  'or disagreement figure — never guess or recall a number from memory. If a tool returns no data for',
  'a symbol, say so plainly; do not invent one.',
  '',
  'Never give trading or investment advice (no "buy", "sell", "safe to trade", "should I"). Describe',
  'only what the data shows and let the person draw their own conclusion.',
  '',
  'Keep replies short — two to five sentences, plain conversational text, no markdown, no HTML, no',
  'bullet lists. This is a Telegram chat, not a report. If the question is outside what Consensus',
  'tracks (only ~38 crypto assets and ~100 tokenised stocks), say so and suggest /assets or /rwa.',
].join('\n');

// Provider-neutral conversation shape. 'model' turns hold what the model said/did; 'user' turns hold
// the person's message or, for a tool round-trip, the tool's result fed back in.
export type Block =
  | { type: 'text'; text: string }
  // meta carries provider-specific pass-through data that must be echoed back verbatim on the next
  // turn (e.g. Gemini's thoughtSignature continuity token) without the loop needing to know it exists.
  | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown>; meta?: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; result: unknown; isError?: boolean };
export type AgentMessage = { role: 'user' | 'model'; blocks: Block[] };
export type ModelRequest = { model: string; system: string; tools: Tool[]; messages: AgentMessage[]; maxTokens: number; temperature: number };
export type ModelResponse = { blocks: Block[]; toolCalls: Extract<Block, { type: 'tool_call' }>[] };
export type ModelCall = (req: ModelRequest) => Promise<ModelResponse>;

// Gemini's function-parameter schema is a strict subset of OpenAPI 3.0 and rejects unknown keywords
// like additionalProperties (400 INVALID_ARGUMENT), so it's stripped recursively before sending.
export function toGeminiSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return schema;
  const rest = { ...(schema as Record<string, unknown>) };
  delete rest.additionalProperties;
  if (rest.properties && typeof rest.properties === 'object') {
    rest.properties = Object.fromEntries(Object.entries(rest.properties as Record<string, unknown>).map(([k, v]) => [k, toGeminiSchema(v)]));
  }
  return rest;
}

export async function callGemini(req: ModelRequest): Promise<ModelResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const contents = req.messages.map((m) => ({
    role: m.role,
    parts: m.blocks.map((b) => {
      if (b.type === 'text') return { text: b.text };
      if (b.type === 'tool_call') return { functionCall: { id: b.id, name: b.name, args: b.input }, ...(b.meta ?? {}) };
      return { functionResponse: { id: b.id, name: b.name, response: { result: b.result, ...(b.isError ? { error: true } : {}) } } };
    }),
  }));

  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents,
    tools: [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: toGeminiSchema(t.inputSchema) })) }],
    generationConfig: { temperature: req.temperature, maxOutputTokens: req.maxTokens },
  };

  const call = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${req.model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  // The free tier returns 503 "high demand" often enough in practice to be worth one retry; anything
  // else (400 wire-format, 401 auth) is not transient, so it's not worth the extra latency to retry.
  let res = await call();
  if (res.status === 503) { await new Promise((r) => setTimeout(r, 800)); res = await call(); }
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parts: { text?: string; functionCall?: { id?: string; name: string; args?: Record<string, unknown> }; thoughtSignature?: string }[] =
    data.candidates?.[0]?.content?.parts ?? [];
  const blocks: Block[] = parts.map((p, i) => {
    if (!p.functionCall) return { type: 'text', text: p.text ?? '' };
    const meta = p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : undefined;
    return { type: 'tool_call', id: p.functionCall.id ?? `call_${i}`, name: p.functionCall.name, input: p.functionCall.args ?? {}, meta };
  });
  return { blocks, toolCalls: blocks.filter((b): b is Extract<Block, { type: 'tool_call' }> => b.type === 'tool_call') };
}

// Kept as a drop-in alternative model call (see the module comment) — not used by default.
export async function callAnthropic(req: ModelRequest): Promise<ModelResponse> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const messages = req.messages.map((m) => ({
    role: m.role === 'model' ? 'assistant' : 'user',
    content: m.blocks.map((b) => {
      if (b.type === 'text') return { type: 'text', text: b.text };
      if (b.type === 'tool_call') return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
      return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(b.result), is_error: b.isError };
    }),
  }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: req.model, max_tokens: req.maxTokens, temperature: req.temperature, system: req.system, messages,
      tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[] = data.content ?? [];
  const blocks: Block[] = content.map((c) =>
    c.type === 'tool_use' ? { type: 'tool_call', id: c.id!, name: c.name!, input: c.input ?? {} } : { type: 'text', text: c.text ?? '' });
  return { blocks, toolCalls: blocks.filter((b): b is Extract<Block, { type: 'tool_call' }> => b.type === 'tool_call') };
}

const MAX_STEPS = 4;    // bounds cost/latency per message: at most 4 model calls, however many tool calls each requests
const MAX_INPUT = 400;  // characters; a real question is short, this just stops someone inflating input tokens with a wall of text

// Per-chat call frequency is rate-limited by the caller (lib/ratelimit.ts, applied in lib/telegram.ts's
// answer()) before this ever runs, so a spammy chat never reaches here at all, let alone the network.
const NOT_CONFIGURED = "Plain-language questions aren't set up yet — try a command instead, e.g. /help.";

export async function runAgent(
  text: string, tools: Tool[], callModel: ModelCall = callGemini, model = process.env.GEMINI_MODEL || 'gemini-3.8-flash',
): Promise<string> {
  if (process.env.AGENT_CHAT_ENABLED === 'false') return "Plain-language questions are switched off right now — try a command, e.g. /help.";
  const messages: AgentMessage[] = [{ role: 'user', blocks: [{ type: 'text', text: text.slice(0, MAX_INPUT) }] }];

  for (let step = 0; step < MAX_STEPS; step++) {
    // A missing key throws "<PROVIDER>_API_KEY not set" from callGemini/callAnthropic; caught here
    // (not left to the route handler's generic catch) so it's a plain, non-alarming reply, not an error.
    let res: ModelResponse;
    try {
      res = await callModel({ model, system: SYSTEM_PROMPT, tools, messages, maxTokens: 500, temperature: 0 });
    } catch (e) {
      if (/_API_KEY not set/.test(errMsg(e))) return NOT_CONFIGURED;
      throw e;
    }

    if (res.toolCalls.length === 0) {
      const reply = res.blocks.filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text').map((b) => b.text).join('\n').trim();
      return reply || "I couldn't work that out from the tracked data. Try /help for the commands.";
    }

    messages.push({ role: 'model', blocks: res.blocks });
    const results: Block[] = await Promise.all(res.toolCalls.map(async (tc): Promise<Block> => {
      const tool = tools.find((t) => t.name === tc.name);
      try {
        const result = tool ? await tool.run(tc.input) : { error: `unknown tool ${tc.name}` };
        return { type: 'tool_result', id: tc.id, name: tc.name, result };
      } catch (e) {
        return { type: 'tool_result', id: tc.id, name: tc.name, result: { error: errMsg(e) }, isError: true };
      }
    }));
    messages.push({ role: 'user', blocks: results });
  }
  return 'That question needed more steps than I allow per message — try a specific command like /check BTC or /alerts.';
}
