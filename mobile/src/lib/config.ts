// Expo replaces direct EXPO_PUBLIC references when bundling. Only public keys belong here.
export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '') ?? '';
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '') ?? '';
export const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

function validateConfig() {
  if (!apiUrl) return '';
  if (!supabaseUrl || !publishableKey) return 'Account access is not configured yet. You can still try the demo.';
  try {
    for (const value of [apiUrl, supabaseUrl]) {
      const url = new URL(value);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw Error();
    }
  } catch {
    return 'Account access has an invalid server address. You can still try the demo.';
  }
  if (publishableKey.startsWith('sb_secret_')) return 'Account access needs a public project key.';
  return '';
}

export const configurationError = validateConfig();
