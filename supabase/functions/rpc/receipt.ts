// Reads a receipt photo with a Claude vision model (schema.txt 6.i.a). Runs in Deno and Node 24.
// The model only drafts line items; fromScan() in fakeOcr.ts checks them against the charge before anyone sees them.

export type Photo = {data: string; mediaType: string};
export type Read = {items: {name: string; amount: number}[]; tax: number; tip: number};
export type ReadReceipt = (photo: Photo, charge: {merchant: string; amount: number}) => Promise<Read>;

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BASE64 = 6_000_000; // about 4.5 MB of image, under the API's 5 MB per-image limit

export class PhotoError extends Error {}

export function checkPhoto(value: unknown): Photo {
  const p = value as Partial<Photo> | null;
  if (!p || typeof p.data !== 'string' || typeof p.mediaType !== 'string' || !TYPES.has(p.mediaType)) throw new PhotoError('Send a JPEG, PNG, WebP or GIF photo.');
  if (!p.data || p.data.length > MAX_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(p.data)) throw new PhotoError('That photo is too large or unreadable. Try another.');
  return {data: p.data, mediaType: p.mediaType};
}

const schema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {name: {type: 'string'}, amount_cents: {type: 'integer'}},
        required: ['name', 'amount_cents'],
        additionalProperties: false,
      },
    },
    tax_cents: {type: 'integer'},
    tip_cents: {type: 'integer'},
  },
  required: ['items', 'tax_cents', 'tip_cents'],
  additionalProperties: false,
};

const prompt = (merchant: string, amount: number) => `This is a photo of a receipt from ${merchant || 'a purchase'}. The card was charged $${(amount / 100).toFixed(2)}.
List each purchased line item with its final price in integer cents. Fold discounts into the item they apply to, and list service fees or surcharges as their own items.
Put sales tax in tax_cents and tip or gratuity in tip_cents (0 if none). If no tip is printed but the card charge is higher than the printed total, put the difference in tip_cents.
Copy item names as printed, shortened to a few words. If the image is not a readable receipt, return an empty items list.`;

export function claudeReader(opts: {apiKey: string; model: string; fetch?: typeof fetch; timeoutMs?: number}): ReadReceipt {
  const send = opts.fetch ?? globalThis.fetch;
  return async (photo, charge) => {
    const res = await send('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01'},
      signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
      body: JSON.stringify({
        model: opts.model,
        max_tokens: 4096,
        messages: [{role: 'user', content: [
          {type: 'image', source: {type: 'base64', media_type: photo.mediaType, data: photo.data}},
          {type: 'text', text: prompt(charge.merchant, charge.amount)},
        ]}],
        output_config: {format: {type: 'json_schema', schema}},
      }),
    });
    if (!res.ok) throw new Error(`Receipt model returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = await res.json() as {content?: {type: string; text?: string}[]};
    const text = body.content?.find(b => b.type === 'text')?.text ?? '';
    const out = JSON.parse(text) as {items: {name: string; amount_cents: number}[]; tax_cents: number; tip_cents: number};
    return {items: out.items.map(i => ({name: i.name, amount: i.amount_cents})), tax: out.tax_cents, tip: out.tip_cents};
  };
}
