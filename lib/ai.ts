// =============================================================================
// AI face-swap pipeline (Replicate)
// =============================================================================
// Takes (user PFP URL, base scene URL) → returns composited image URL.
//
// Default model: cjwbw/face-swap (InsightFace-based, ~1.5s on A40, $0.005/run)
// For v2: swap to a more sophisticated inpainting model that respects lighting/angle.

import Replicate from 'replicate';

export interface CompositeResult {
  url: string;           // Replicate output URL (hosted for ~1h, persist to Supabase Storage)
  model: string;         // model version
  durationMs: number;    // inference time
}

let _client: Replicate | null = null;
function getClient() {
  if (_client) return _client;
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN not set');
  _client = new Replicate({ auth: token });
  return _client;
}

export async function faceSwapComposite(
  sourcePfpUrl: string,
  baseSceneUrl: string
): Promise<CompositeResult> {
  const client = getClient();
  const model = process.env.REPLICATE_FACE_SWAP_MODEL || 'cjwbw/face-swap';

  const start = Date.now();
  const output = await client.run(model as `${string}/${string}` || 'cjwbw/face-swap', {
    input: {
      target_image: baseSceneUrl,
      swap_image: sourcePfpUrl,
    },
  });

  // Replicate returns a URL (string) or array of URLs depending on the model
  const url = Array.isArray(output) ? (output[0] as string) : (output as string);
  if (!url || typeof url !== 'string') {
    throw new Error(`Unexpected Replicate output shape: ${JSON.stringify(output)}`);
  }

  return {
    url,
    model,
    durationMs: Date.now() - start,
  };
}

// -----------------------------------------------------------------------------
// Optional: persist Replicate output to Supabase Storage so it doesn't expire
// (Replicate deletes hosted outputs after ~1 hour on free tier)
// -----------------------------------------------------------------------------
export async function persistComposite(
  sourceUrl: string,
  storagePath: string
): Promise<string> {
  const { getServiceSupabase } = await import('./supabase');
  const supabase = getServiceSupabase();

  // Download the Replicate-hosted image
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch Replicate output: ${res.status}`);
  const blob = await res.blob();

  // Upload to Supabase Storage
  const { error } = await supabase.storage.from('composites').upload(storagePath, blob, {
    contentType: 'image/png',
    cacheControl: '31536000',     // 1 year
    upsert: true,
  });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = supabase.storage.from('composites').getPublicUrl(storagePath);
  return data.publicUrl;
}
