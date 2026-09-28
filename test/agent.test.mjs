import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgent, toGeminiSchema, callGemini } from '../lib/agent.ts';

const echoTool = { name: 'echo', description: 'echoes', inputSchema: { type: 'object', properties: { x: { type: 'string' } }, additionalProperties: false }, run: async (a) => ({ got: a.x }) };
const boomTool = { name: 'boom', description: 'throws', inputSchema: { type: 'object', properties: {} }, run: async () => { throw new Error('kaboom'); } };

test('toGeminiSchema strips additionalProperties recursively, since Gemini rejects that keyword', () => {
  const stripped = toGeminiSchema({ type: 'object', properties: { a: { type: 'object', properties: { b: { type: 'string' } }, additionalProperties: false } }, additionalProperties: false });
  assert.equal('additionalProperties' in stripped, false);
  assert.equal('additionalProperties' in stripped.properties.a, false);
  assert.deepEqual(stripped.properties.a.properties.b, { type: 'string' });
});

const textReply = (t) => ({ blocks: [{ type: 'text', text: t }], toolCalls: [] });
const toolCall = (name, input = {}) => { const b = { type: 'tool_call', id: 'c1', name, input }; return { blocks: [b], toolCalls: [b] }; };

test('runAgent: an immediate text answer (no tool call) returns on the first step', async () => {
  const calls = [];
  const model = async (req) => { calls.push(req); return textReply('hello there'); };
  assert.equal(await runAgent('hi', [echoTool], model), 'hello there');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tools[0].name, 'echo');
  assert.equal(calls[0].messages[0].blocks[0].text, 'hi');
});

test('runAgent: one tool-call round trip feeds the result back and returns the final text', async () => {
  let step = 0;
  const model = async () => { step++; return step === 1 ? toolCall('echo', { x: 'hi' }) : textReply('the tool said hi'); };
  assert.equal(await runAgent('echo hi', [echoTool], model), 'the tool said hi');
  assert.equal(step, 2);
});

test('runAgent: a tool result is fed back with the tool\'s name attached, for provider-side matching', async () => {
  let seenResult = null;
  let step = 0;
  const model = async (req) => {
    step++;
    if (step === 1) return toolCall('echo', { x: 'hi' });
    seenResult = req.messages.at(-1).blocks[0];
    return textReply('ok');
  };
  await runAgent('echo hi', [echoTool], model);
  assert.equal(seenResult.type, 'tool_result');
  assert.equal(seenResult.name, 'echo');
  assert.deepEqual(seenResult.result, { got: 'hi' });
});

test('runAgent: a tool that throws still lets the model produce a final answer, marked isError', async () => {
  let seenResult = null;
  let step = 0;
  const model = async (req) => {
    step++;
    if (step === 1) return toolCall('boom');
    seenResult = req.messages.at(-1).blocks[0];
    return textReply('that tool failed');
  };
  assert.equal(await runAgent('call boom', [boomTool], model), 'that tool failed');
  assert.equal(seenResult.isError, true);
  assert.match(seenResult.result.error, /kaboom/);
});

test('runAgent: a call to an unknown tool name does not throw, reports an error result instead', async () => {
  let step = 0;
  const model = async (req) => {
    step++;
    if (step === 1) return toolCall('ghost');
    const result = req.messages.at(-1).blocks[0].result;
    return textReply(`saw: ${result.error}`);
  };
  assert.equal(await runAgent('call ghost', [echoTool], model), 'saw: unknown tool ghost');
});

test('runAgent: an empty final text falls back to a fixed message instead of an empty reply', async () => {
  const model = async () => textReply('   ');
  assert.match(await runAgent('hi', [echoTool], model), /couldn't work that out/);
});

test('runAgent: stops after MAX_STEPS of repeated tool calls, never loops forever', async () => {
  let calls = 0;
  const model = async () => { calls++; return toolCall('echo', { x: String(calls) }); };
  const reply = await runAgent('loop forever', [echoTool], model);
  assert.match(reply, /more steps than I allow/);
  assert.equal(calls, 4, 'exactly MAX_STEPS model calls, not one more');
});

test('runAgent: a missing-key error from the model call becomes a plain reply, not a thrown error', async () => {
  const model = async () => { throw new Error('GEMINI_API_KEY not set'); };
  assert.match(await runAgent('hi', [echoTool], model), /aren't set up yet/);
});

test('runAgent: a quota-exhausted (429) error becomes a plain reply pointing at commands, not a thrown error', async () => {
  const model = async () => { throw new Error('gemini 429: {"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'); };
  assert.match(await runAgent('hi', [echoTool], model), /usage limit/);
});

test('runAgent: a genuine model-call failure (not a missing key) still propagates, for the route handler to log', async () => {
  const model = async () => { throw new Error('gemini 500: internal error'); };
  await assert.rejects(() => runAgent('hi', [echoTool], model), /gemini 500/);
});

test('runAgent: the AGENT_CHAT_ENABLED kill switch short-circuits before any model call', async (t) => {
  t.after(() => { delete process.env.AGENT_CHAT_ENABLED; });
  process.env.AGENT_CHAT_ENABLED = 'false';
  let calls = 0;
  const model = async () => { calls++; return textReply('should not run'); };
  assert.match(await runAgent('hi', [echoTool], model), /switched off/);
  assert.equal(calls, 0);
});

test('runAgent: input longer than MAX_INPUT is clipped before it reaches the model', async () => {
  let sentText = null;
  const model = async (req) => { sentText = req.messages[0].blocks[0].text; return textReply('ok'); };
  await runAgent('x'.repeat(1000), [echoTool], model);
  assert.equal(sentText.length, 400);
});

// callGemini's real-network retry behaviour: measured live against the free tier (2026-09-28), 503
// "high demand" and 429 "quota" both occur often enough that a single retry isn't reliably enough —
// observed a second straight 503 in testing. Mocked here so the retry/backoff logic is covered without
// depending on a real, rate-limited API key.
const geminiOk = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const geminiErr = (status) => new Response(JSON.stringify({ error: { code: status, message: 'nope' } }), { status });

test('callGemini: retries past a transient 503 then a 429, succeeding on the third attempt', async (t) => {
  process.env.GEMINI_API_KEY = 'test-key';
  t.after(() => { delete process.env.GEMINI_API_KEY; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return calls < 3 ? geminiErr(calls === 1 ? 503 : 429) : geminiOk('recovered'); });
  const res = await callGemini({ model: 'x', system: 's', tools: [], messages: [], maxTokens: 10, temperature: 0 });
  assert.equal(calls, 3);
  assert.equal(res.blocks[0].text, 'recovered');
});

test('callGemini: gives up after 2 retries (3 attempts total) of sustained 503s', async (t) => {
  process.env.GEMINI_API_KEY = 'test-key';
  t.after(() => { delete process.env.GEMINI_API_KEY; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return geminiErr(503); });
  await assert.rejects(() => callGemini({ model: 'x', system: 's', tools: [], messages: [], maxTokens: 10, temperature: 0 }), /gemini 503/);
  assert.equal(calls, 3);
});

test('callGemini: a stalled/timed-out attempt (fetch throws, not a status) is retried like a 503', async (t) => {
  // Regression: the fetch call originally had no timeout at all, so a stalled upstream response could
  // hang for the whole route budget with nothing to show for it. AbortSignal.timeout() makes that throw
  // instead of hang; this checks the throw is retried, not left to crash the whole request.
  process.env.GEMINI_API_KEY = 'test-key';
  t.after(() => { delete process.env.GEMINI_API_KEY; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls === 1) throw new DOMException('signal timed out', 'TimeoutError');
    return geminiOk('recovered after a stall');
  });
  const res = await callGemini({ model: 'x', system: 's', tools: [], messages: [], maxTokens: 10, temperature: 0 });
  assert.equal(calls, 2);
  assert.equal(res.blocks[0].text, 'recovered after a stall');
});

test('callGemini: a non-transient error (400) is not retried', async (t) => {
  process.env.GEMINI_API_KEY = 'test-key';
  t.after(() => { delete process.env.GEMINI_API_KEY; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return geminiErr(400); });
  await assert.rejects(() => callGemini({ model: 'x', system: 's', tools: [], messages: [], maxTokens: 10, temperature: 0 }), /gemini 400/);
  assert.equal(calls, 1);
});
