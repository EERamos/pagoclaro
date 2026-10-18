// One-off probe (not part of the agent): does each pinned model call a trivial tool natively, and
// does it report reasoning tokens? Two calls, effort low, as the reader route uses.
import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from '../src/config';

const config = loadConfig();
const client = new Anthropic();
const only = process.argv.find((a) => a.startsWith('--models='))?.split('=')[1]?.split(',');
for (const model of [config.primaryModel, config.checkModel, config.tiebreakModel].filter((m) => !only || only.includes(m))) {
  const resp = await client.messages.create({
    model,
    max_tokens: 2000,
    tools: [
      {
        name: 'echo',
        description: 'Devuelve el texto que recibe.',
        input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
      },
    ],
    tool_choice: { type: 'auto' },
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: 'Llama a la herramienta echo con el texto "hola" y nada más.' }],
  });
  console.log(`\n${model} · stop_reason=${resp.stop_reason}`);
  console.log('bloques:', resp.content.map((b) => (b.type === 'tool_use' ? `tool_use(${b.name} ${JSON.stringify(b.input)})` : b.type)).join(', '));
  console.log('usage:', JSON.stringify({ input: resp.usage.input_tokens, output: resp.usage.output_tokens, details: resp.usage.output_tokens_details }));
}
console.log(`Fecha: ${new Date().toISOString()}`);
