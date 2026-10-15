import { generateImage } from "@/lib/image";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// #region generate-route
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });

  // Anything but a JSON object with a string prompt gets a 400, including a body of null.
  const body: unknown = await request.json().catch(() => null);
  const prompt = typeof body === "object" && body !== null && "prompt" in body ? body.prompt : undefined;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 500) {
    return Response.json({ error: "Write a prompt of up to 500 characters." }, { status: 400 });
  }

  // Take one credit before calling the model. null means the balance was already 0.
  const { data: credits, error } = await supabase.rpc("spend_credit");
  if (error) return Response.json({ error: "Could not read your credits." }, { status: 500 });
  if (credits === null) {
    return Response.json({ error: "You are out of credits.", credits: 0 }, { status: 402 });
  }

  try {
    const image = await generateImage(prompt.trim());
    return Response.json({ image, credits });
  } catch (err) {
    // The model failed, so the user gets the credit back.
    console.error("generate:", err);
    const refunded = await refundCredit(user.id);
    if (refunded === null) {
      return Response.json(
        { error: "Image generation failed. We could not give your credit back.", credits },
        { status: 502 },
      );
    }
    return Response.json(
      { error: "Image generation failed. Your credit was returned.", credits: refunded },
      { status: 502 },
    );
  }
}

// Gives one credit back with the secret key and returns the new balance, or null if the refund failed. A failed
// refund is logged and never retried: if the first call did reach the database, a retry would return two credits.
async function refundCredit(userId: string): Promise<number | null> {
  try {
    const { data, error } = await createAdminClient().rpc("refund_credit", { p_user_id: userId });
    if (error || typeof data !== "number") {
      console.error("refund failed:", userId, error?.message ?? "no balance returned");
      return null;
    }
    return data;
  } catch (err) {
    console.error("refund failed:", userId, err);
    return null;
  }
}
// #endregion
