// Offline tests for POST /api/generate: Supabase and Replicate are mocked, nothing touches the network.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabase = { auth: { getUser: vi.fn() }, rpc: vi.fn() };
const admin = { rpc: vi.fn() };
const replicateRun = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => supabase,
  createAdminClient: () => admin,
}));
vi.mock("replicate", () => ({
  default: class {
    run = replicateRun;
  },
}));

const { POST } = await import("@/app/api/generate/route");

function call(body: unknown) {
  return POST(new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  delete process.env.REPLICATE_API_TOKEN;
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/generate", () => {
  it("refuses a signed-out request without spending", async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await call({ prompt: "a cat" });
    expect(res.status).toBe(401);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("refuses an empty or missing prompt without spending", async () => {
    for (const body of [{ prompt: "  " }, {}, "not json", "null", "[]", "42", { prompt: "x".repeat(501) }]) {
      const res = await call(body);
      expect(res.status).toBe(400);
    }
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("spends one credit and returns the sample image when no Replicate token is set", async () => {
    supabase.rpc.mockResolvedValue({ data: 9, error: null });
    const res = await call({ prompt: "a lighthouse" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ image: "/sample.svg", credits: 9 });
    expect(supabase.rpc).toHaveBeenCalledWith("spend_credit");
    expect(replicateRun).not.toHaveBeenCalled();
  });

  it("refuses with an out-of-credits message when the balance is 0", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    const res = await call({ prompt: "a lighthouse" });
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: "You are out of credits.", credits: 0 });
    expect(replicateRun).not.toHaveBeenCalled();
  });

  it("calls FLUX schnell on Replicate when a token is set", async () => {
    process.env.REPLICATE_API_TOKEN = "r8_test";
    supabase.rpc.mockResolvedValue({ data: 4, error: null });
    replicateRun.mockResolvedValue([{ url: () => new URL("https://replicate.delivery/x/out-0.webp") }]);
    const res = await call({ prompt: " a fox " });
    expect(await res.json()).toEqual({ image: "https://replicate.delivery/x/out-0.webp", credits: 4 });
    expect(replicateRun).toHaveBeenCalledWith("black-forest-labs/flux-schnell", {
      input: { prompt: "a fox", num_outputs: 1, output_format: "webp" },
    });
  });

  it("gives the credit back when generation fails", async () => {
    process.env.REPLICATE_API_TOKEN = "r8_test";
    supabase.rpc.mockResolvedValue({ data: 4, error: null });
    replicateRun.mockRejectedValue(new Error("model down"));
    admin.rpc.mockResolvedValue({ data: 5, error: null });
    const res = await call({ prompt: "a fox" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Image generation failed. Your credit was returned.", credits: 5 });
    expect(admin.rpc).toHaveBeenCalledWith("refund_credit", { p_user_id: "user-1" });
  });

  it("says so when the refund fails, and logs it, without retrying", async () => {
    process.env.REPLICATE_API_TOKEN = "r8_test";
    supabase.rpc.mockResolvedValue({ data: 4, error: null });
    replicateRun.mockRejectedValue(new Error("model down"));
    admin.rpc.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const res = await call({ prompt: "a fox" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Image generation failed. We could not give your credit back.", credits: 4 });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith("refund failed:", "user-1", "connection refused");
  });

  it("treats a refund that returns no balance, or throws, as failed", async () => {
    process.env.REPLICATE_API_TOKEN = "r8_test";
    supabase.rpc.mockResolvedValue({ data: 4, error: null });
    replicateRun.mockRejectedValue(new Error("model down"));
    admin.rpc.mockResolvedValueOnce({ data: null, error: null }).mockRejectedValueOnce(new Error("fetch failed"));
    for (let i = 0; i < 2; i++) {
      const res = await call({ prompt: "a fox" });
      expect((await res.json()).error).toBe("Image generation failed. We could not give your credit back.");
    }
    expect(admin.rpc).toHaveBeenCalledTimes(2);
  });

  it("answers 500 when the credits call errors", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await call({ prompt: "a fox" });
    expect(res.status).toBe(500);
  });
});
