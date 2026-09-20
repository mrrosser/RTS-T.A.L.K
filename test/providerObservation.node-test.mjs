import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIcebreakerService } from '../backend/providers.mjs';

test('application Gemini caller preserves payload and logs usage without topic or output', async () => {
  const original = console.info, rows = [], payloads = [];
  console.info = value => rows.push(JSON.parse(value));
  try {
    const service = createIcebreakerService({models: {generateContent: async payload => {
      payloads.push(payload);
      return {text: 'One?\nTwo?\nThree?', modelVersion: 'test-model', usageMetadata: {promptTokenCount: 12, candidatesTokenCount: 6}};
    }}}, 'unchanged-model');
    assert.deepEqual(await service.generate('PRIVATE TOPIC'), ['One?', 'Two?', 'Three?']);
    assert.equal(payloads.length, 1); assert.equal(payloads[0].model, 'gemini-2.5-flash');
    assert.equal(rows.length, 1); assert.equal(rows[0].usage.input_tokens, 12);
    assert.ok(!JSON.stringify(rows).includes('PRIVATE')); assert.ok(!JSON.stringify(rows).includes('One?'));
  } finally {console.info = original;}
});

test('provider failure retains the existing three-question fallback', async () => {
  const original = console.info, rows = [];
  console.info = value => rows.push(JSON.parse(value));
  try {
    const service = createIcebreakerService({models: {generateContent: async () => {throw Error('PRIVATE');}}});
    assert.equal((await service.generate('test')).length, 3);
    assert.equal(rows[0].transport_status, 'request_failed');
    assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
  } finally {console.info = original;}
});
