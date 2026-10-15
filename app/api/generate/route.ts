import { generateImage } from "@/lib/image";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// #region generate-route
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });

  const { prompt } = await request.json().catch(() => ({}));
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
    const { data: refunded } = await createAdminClient().rpc("refund_credit", { p_user_id: user.id });
    return Response.json(
      { error: "Image generation failed. Your credit was returned.", credits: refunded ?? credits },
      { status: 502 },
    );
  }
}
// #endregion
