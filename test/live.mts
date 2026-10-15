// End-to-end run against a running stack: local Supabase with the signupbouncer hook in Enforce mode, a local
// signupbouncer API, and this app on APP_URL (`npm run dev`). Checks the article's end state:
//   1. a mailinator.com signup is refused with the hook's message, and leaves no rows;
//   2. a fresh gmail.com signup gets a user and 10 credits;
//   3. one image (sample mode) leaves 9; at 0 the route refuses with an out-of-credits message.
// Run: node test/live.mts (Node 22.18+ runs TypeScript directly). Env: NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, DATABASE_URL, APP_URL (default http://127.0.0.1:3000).
import { createServerClient } from "@supabase/ssr";
import postgres from "postgres";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const MESSAGE = process.env.EXPECTED_MESSAGE ?? "Please sign up with a permanent email address.";
const sql = postgres(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres", {
  onnotice: () => {},
});

let failed = 0;
function check(label: string, ok: boolean, detail: unknown) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}

// A Supabase client that keeps its session in a cookie jar, as the browser does, so the app's route handler
// can read the session from the Cookie header.
function client() {
  const jar = new Map<string, string>();
  const supabase = createServerClient(SUPABASE_URL, KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) value ? jar.set(name, value) : jar.delete(name);
      },
    },
  });
  const cookie = () => [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
  return { supabase, cookie };
}

const rows = async (email: string) => {
  const [r] = await sql`
    select count(u.id)::int as users, count(c.user_id)::int as credits
    from auth.users u left join public.credits c on c.user_id = u.id where u.email = ${email}`;
  return r as { users: number; credits: number };
};
const generate = async (cookie: string) => {
  const res = await fetch(`${APP}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ prompt: "A lighthouse on a cliff at dusk" }),
  });
  return { status: res.status, body: await res.json() };
};

const rand = Math.random().toString(36).slice(2, 8);

// 1. Burner address: refused by the hook, nothing stored.
const burner = `follow-${rand}@mailinator.com`;
{
  const { supabase } = client();
  const { data, error } = await supabase.auth.signUp({ email: burner, password: "a long password 1" });
  check("1 burner refused with the hook's message", error?.message === MESSAGE && !data.user, {
    email: burner,
    status: error?.status,
    code: error?.code,
    message: error?.message,
  });
  check("1 burner left no rows", (await rows(burner)).users === 0, await rows(burner));
}

// 2. Fresh gmail address: a user with 10 credits.
const real = `follow.${rand}@gmail.com`;
const { supabase, cookie } = client();
{
  const { data, error } = await supabase.auth.signUp({ email: real, password: "a long password 1" });
  check("2 gmail signup created a user", !error && !!data.user, error?.message ?? { email: real, id: data.user?.id });
  const [c] = await sql`select c.balance from public.credits c join auth.users u on u.id = c.user_id where u.email = ${real}`;
  check("2 new user has 10 credits", c?.balance === 10, { balance: c?.balance });
}

// 3. One sample image leaves 9; at 0 the route refuses.
{
  const r = await generate(cookie());
  check("3 generate returns an image and 9 credits", r.status === 200 && r.body.credits === 9 && !!r.body.image, r);
  const img = await fetch(new URL(r.body.image, APP));
  check("3 image loads", img.ok, `${img.status} ${img.headers.get("content-type")}`);
  const [c] = await sql`select c.balance from public.credits c join auth.users u on u.id = c.user_id where u.email = ${real}`;
  check("3 balance in Postgres is 9", c?.balance === 9, { balance: c?.balance });

  await sql`update public.credits c set balance = 0 from auth.users u where u.id = c.user_id and u.email = ${real}`;
  const z = await generate(cookie());
  check("3 zero balance refuses", z.status === 402 && z.body.error === "You are out of credits.", z);
}

await sql.end();
console.log(failed ? `${failed} check(s) failed` : "all checks passed");
process.exit(failed ? 1 : 0);
