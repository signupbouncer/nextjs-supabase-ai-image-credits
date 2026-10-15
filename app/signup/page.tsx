"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// #region signup-page
export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    // Called from the browser, so the signup check sees the user's IP address, not your server's.
    const { error } = await createClient().auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    setPending(false);
    if (error) {
      // A refused signup lands here with the message set in signupbouncer.
      setError(error.message);
      return;
    }
    router.push("/");
  }

  return (
    <>
      <h1>Create an account</h1>
      <p className="muted">New accounts get 10 free image credits.</p>
      <form method="post" onSubmit={onSubmit}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? "Creating account..." : "Sign up"}</button>
      </form>
      <p className="muted">Already have an account? <a href="/login">Log in</a></p>
    </>
  );
}
// #endregion
