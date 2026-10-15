"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type State = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; email: string; credits: number };

export default function Home() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setState({ status: "signed-out" });
      // Row-level security returns only this user's row.
      const { data } = await supabase.from("credits").select("balance").single();
      setState({ status: "signed-in", email: user.email ?? "", credits: data?.balance ?? 0 });
    })();
  }, []);

  // #region generate-form
  async function onGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const prompt = String(new FormData(event.currentTarget).get("prompt"));
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const body = await res.json();
    setPending(false);
    if (typeof body.credits === "number") {
      setState((s) => (s.status === "signed-in" ? { ...s, credits: body.credits } : s));
    }
    if (!res.ok) return setError(body.error);
    setImage(body.image);
  }
  // #endregion

  async function signOut() {
    await createClient().auth.signOut();
    setState({ status: "signed-out" });
    setImage(null);
  }

  if (state.status === "loading") return <p className="muted">Loading...</p>;
  if (state.status === "signed-out") {
    return (
      <>
        <h1>Image credits</h1>
        <p>Make AI images. Every new account gets 10 free credits, one per image.</p>
        <p><a href="/signup">Create an account</a> or <a href="/login">log in</a>.</p>
      </>
    );
  }

  return (
    <>
      <h1>Image credits</h1>
      <p className="muted">
        {state.email}: <strong data-testid="credits">{state.credits}</strong> credits left.{" "}
        <a href="#" onClick={(e) => (e.preventDefault(), signOut())}>Log out</a>
      </p>
      <form onSubmit={onGenerate}>
        <label>
          Prompt
          <textarea name="prompt" rows={3} maxLength={500} required defaultValue="A lighthouse on a cliff at dusk" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={pending || state.credits === 0}>
          {pending ? "Generating..." : state.credits === 0 ? "Out of credits" : "Generate (1 credit)"}
        </button>
      </form>
      {image && <img className="result" src={image} alt="Generated image" />}
    </>
  );
}
