import assert from 'node:assert/strict';
import { canRetryWithoutSchema, requestRefinementJson, refinementConnectionKey } from '../../tavern_helper_template-main/src/修仙状态栏/refinementApi.ts';

for (const error of [new Error('INVALID_ARGUMENT'), new Error('response_format is not supported'),
  { error: { message: 'invalid json_schema' } }]) assert.equal(canRetryWithoutSchema(error), true);
for (const error of [new Error('Bad Request'), new Error('Failed to fetch'), new Error('AbortError'),
  { status: 429, message: 'INVALID_ARGUMENT' }, new Error('Invalid API key'),
  new Error('max_tokens exceeds limit'), new Error('safety filter'),
  { status: 503, message: 'invalid json_schema' }]) assert.equal(canRetryWithoutSchema(error), false);

const cache = new Map();
const storage = { getItem: k => cache.get(k) ?? null, setItem: (k, v) => cache.set(k, v) };
let calls = [];
let notices = 0;
const options = { key: 'one', storage, onFallback: () => notices++, request: async structured => {
  calls.push(structured);
  if (structured) throw new Error('INVALID_ARGUMENT');
  return '{"npc":{}}';
} };
const result = await requestRefinementJson(options);
assert.deepEqual(calls, [true, false]);
assert.equal(notices, 1);
assert.equal(cache.size, 0, 'Not cached before caller validates');
result.remember();
calls = [];
await requestRefinementJson(options);
assert.deepEqual(calls, [false]);
calls = [];
await requestRefinementJson({ ...options, key: 'two' });
assert.deepEqual(calls, [true, false]);
cache.set('one', String(Date.now() - 8 * 86400000));
calls = [];
await requestRefinementJson(options);
assert.deepEqual(calls, [true, false]);
calls = [];
await assert.rejects(requestRefinementJson({ ...options, request: async structured => {
  calls.push(structured); throw new Error('INVALID_ARGUMENT');
} }), /重试仍失败/);
assert.deepEqual(calls, [true, false]);
calls = [];
await assert.rejects(requestRefinementJson({ ...options, request: async structured => {
  calls.push(structured); throw new Error('AbortError');
} }), /AbortError/);
assert.deepEqual(calls, [true]);
await requestRefinementJson({ ...options, storage: { getItem() { throw Error(); }, setItem() { throw Error(); } } });

globalThis.SillyTavern = { mainApi: 'openai', chatCompletionSettings: {
  chat_completion_source: 'custom', custom_url: 'https://user:secret@example.com/v1?key=secret',
}, getChatCompletionModel: (...args) => args.length ? '' : 'gemini-alias' };
const key = await refinementConnectionKey();
assert.match(key, /^cultivation:npc-json-compat:v1:[a-f0-9]{64}$/);
SillyTavern.chatCompletionSettings.custom_url = 'https://example.com/v1?key=another';
assert.equal(await refinementConnectionKey(), key);
SillyTavern.getChatCompletionModel = () => 'claude-alias';
assert.notEqual(await refinementConnectionKey(), key);
SillyTavern.chatCompletionSettings.custom_url = 'https://another.example/v1';
assert.notEqual(await refinementConnectionKey(), key);
console.log('Refinement API compatibility tests passed.');
