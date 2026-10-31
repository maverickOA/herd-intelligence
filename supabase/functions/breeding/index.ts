// Supabase Edge Function "breeding": runs the pedigree engine for a signed-in
// user and stores the result. Only this function (with the secret key) can
// write breeding_assessments, so a result cannot be forged from the browser.
//
// The engine and request logic live in packages/breeding-service and are
// bundled into core.bundle.js (npm run bundle -w @herd/breeding-service).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { BreedingRequestError, handle } from './core.bundle.js';

const url = Deno.env.get('SUPABASE_URL')!;
const keyFrom = (json: string, legacy: string) => {
  try {
    const k = JSON.parse(Deno.env.get(json) ?? '{}').default;
    if (k) return k as string;
  } catch { /* fall through */ }
  return Deno.env.get(legacy)!;
};
const publishableKey = keyFrom('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
const secretKey = keyFrom('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in first' }, 401);

  const user = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claims, error: authError } = await user.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (authError || !userId || claims?.claims?.role !== 'authenticated') return json({ error: 'Sign in first' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send a JSON body' }, 400);
  }

  try {
    const result = await handle(body, {
      userId,
      async getPedigree(animalIds, withBucks) {
        // Runs as the user: the database checks they can see these animals.
        const { data, error } = await user.rpc('breeding_pedigree', { p_animals: animalIds, p_with_bucks: withBucks });
        if (error) {
          throw new BreedingRequestError(error.code === 'P0002' ? 'Animal not found' : error.message,
            error.code === 'P0002' ? 404 : 400);
        }
        return data;
      },
      async saveAssessment(row) {
        const { data, error } = await admin.from('breeding_assessments').insert(row).select('id').single();
        if (error) throw new Error(`Could not save the assessment: ${error.message}`);
        return data.id;
      },
    });
    return json(result);
  } catch (e) {
    if (e instanceof BreedingRequestError) return json({ error: e.message }, e.status);
    console.error(e);
    // Fail closed: no partial or guessed result.
    return json({ error: 'The breeding check could not be completed, so no result is shown. Try again.' }, 500);
  }
});
