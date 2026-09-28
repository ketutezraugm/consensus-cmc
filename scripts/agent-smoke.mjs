// One-off live smoke test: exercises lib/agent.ts's runAgent against the real Gemini API and real
// data, outside the Telegram webhook. Not committed to the test suite (needs live network + a key).
// Run: node --env-file=.env.local scripts/agent-smoke.mjs "your question here"
import { runAgent } from '../lib/agent.ts';
import { TOOLS } from '../lib/mcp.ts';

const q = process.argv[2] ?? 'Is Bitcoin Cash reliable right now?';
console.log('Q:', q);
const started = Date.now();
try {
  const reply = await runAgent(q, TOOLS);
  console.log('A:', reply);
  console.log(`(${Date.now() - started}ms)`);
} catch (e) {
  console.error('FAILED:', e);
  process.exit(1);
}
