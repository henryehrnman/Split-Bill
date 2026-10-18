import assert from 'node:assert/strict';
import {geminiReader} from '../functions/rpc/receipt.ts';

const photo = {data: 'aGVsbG8=', mediaType: 'image/jpeg'};
const charge = {merchant: 'Juniper', amount: 1234};

// The Gemini reader sends the photo inline with a JSON schema and reads the joined text parts.
{
  let sent: {url: string; init: any} | null = null;
  const fetch = (async (url: string, init: any) => {
    sent = {url, init};
    const json = JSON.stringify({items: [{name: 'Pasta', amount_cents: 1000}], tax_cents: 234, tip_cents: 0});
    const parts = [{text: 'Reading the totals first...', thought: true}, {text: json.slice(0, 10)}, {text: json.slice(10)}];
    return new Response(JSON.stringify({candidates: [{content: {parts}}]}));
  }) as typeof globalThis.fetch;
  const read = await geminiReader({apiKey: 'k', model: 'gemini-test', fetch})(photo, charge);
  assert.deepEqual(read, {items: [{name: 'Pasta', amount: 1000}], tax: 234, tip: 0});
  assert.equal(sent!.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
  assert.equal(sent!.init.headers['x-goog-api-key'], 'k');
  const body = JSON.parse(sent!.init.body);
  assert.deepEqual(body.contents[0].parts[0], {inline_data: {mime_type: 'image/jpeg', data: 'aGVsbG8='}});
  assert.match(body.contents[0].parts[1].text, /Juniper.*\$12\.34/);
  assert.equal(body.generation_config.response_mime_type, 'application/json');
  assert.equal(body.generation_config.response_schema.type, 'OBJECT');
}

// An API error surfaces as a thrown error, which core.ts turns into 502 scan_failed.
{
  const fetch = (async () => new Response('quota exceeded', {status: 429})) as typeof globalThis.fetch;
  await assert.rejects(geminiReader({apiKey: 'k', model: 'm', fetch})(photo, charge), /429/);
}

console.log('receipt reader tests passed');
