// What the sign-up page shows when the signup check refuses an address. The real supabase-js signUp() runs
// against a mocked fetch that answers exactly as local Supabase Auth (v2.197.0) did when the signupbouncer hook
// refused a mailinator.com address on 2026-10-15.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const MESSAGE = "Please sign up with a permanent email address.";

function clientAnswering(status: number, body: unknown) {
  const calls: string[] = [];
  const fetch = async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  const supabase = createClient("http://127.0.0.1:54321", "sb_publishable_test", {
    global: { fetch },
    auth: { persistSession: false },
  });
  return { supabase, calls };
}

describe("sign-up refused by the hook", () => {
  it("surfaces the hook's message as error.message, which the page shows", async () => {
    const { supabase, calls } = clientAnswering(400, { code: 400, error_code: "unknown", msg: MESSAGE });
    const { data, error } = await supabase.auth.signUp({ email: "x@mailinator.com", password: "a long password" });
    expect(calls[0]).toBe("http://127.0.0.1:54321/auth/v1/signup");
    expect(error?.message).toBe(MESSAGE);
    expect(error?.status).toBe(400);
    expect(data.user).toBeNull();
  });

  it("an older Auth that turns the refusal into a 500 still refuses, with a generic message", async () => {
    const { supabase } = clientAnswering(500, { code: 500, error_code: "unexpected_failure", msg: "Invalid payload sent to hook" });
    const { data, error } = await supabase.auth.signUp({ email: "x@mailinator.com", password: "a long password" });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });
});
