// The credits SQL against a running local Supabase Postgres (`supabase start`, then DATABASE_URL from
// `supabase status`). Users are inserted straight into auth.users, which skips Supabase Auth and its hook.
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = postgres(url, { max: 4, onnotice: () => {} });
const created: string[] = [];

afterAll(async () => {
  if (created.length) await sql`delete from auth.users where id = any(${created})`;
  await sql.end();
});

async function newUser(): Promise<string> {
  const [{ id }] = await sql`
    insert into auth.users (id, email, aud, role)
    values (gen_random_uuid(), ${`dbtest.${crypto.randomUUID()}@example.com`}, 'authenticated', 'authenticated')
    returning id`;
  created.push(id);
  return id;
}

// Runs fn as the signed-in user, the way PostgREST does for a request with that user's token.
function asUser<T>(id: string, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: id, role: "authenticated" })}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  }) as Promise<T>;
}

const spend = (id: string) => asUser(id, async (tx) => (await tx`select public.spend_credit() as b`)[0].b as number | null);
const balance = async (id: string) => (await sql`select balance from public.credits where user_id = ${id}`)[0]?.balance;

describe("credits", () => {
  it("a new user starts with 10 credits", async () => {
    expect(await balance(await newUser())).toBe(10);
  });

  it("spends down to zero and never below", async () => {
    const id = await newUser();
    const seen: (number | null)[] = [];
    for (let i = 0; i < 12; i++) seen.push(await spend(id));
    expect(seen).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, null, null]);
    expect(await balance(id)).toBe(0);
  });

  it("two parallel spends of the last credit: one wins, one gets null", async () => {
    const id = await newUser();
    await sql`update public.credits set balance = 1 where user_id = ${id}`;
    const results = await Promise.all([spend(id), spend(id)]);
    expect(results.sort()).toEqual([0, null]);
    expect(await balance(id)).toBe(0);
  });

  it("a user reads only their own balance", async () => {
    const a = await newUser();
    await newUser();
    const rows = await asUser(a, (tx) => tx`select user_id from public.credits`);
    expect(rows.map((r) => r.user_id)).toEqual([a]);
  });

  it("a user cannot refund themselves or change balances directly", async () => {
    const id = await newUser();
    await expect(asUser(id, (tx) => tx`select public.refund_credit(${id}::uuid)`)).rejects.toThrow(/permission denied/);
    await asUser(id, (tx) => tx`update public.credits set balance = 999 where user_id = ${id}`);
    expect(await balance(id)).toBe(10);
  });

  it("the server (service_role) can refund", async () => {
    const id = await newUser();
    await spend(id);
    const refunded = await sql.begin(async (tx) => {
      await tx`set local role service_role`;
      return (await tx`select public.refund_credit(${id}::uuid) as b`)[0].b;
    });
    expect(refunded).toBe(10);
  });
});
