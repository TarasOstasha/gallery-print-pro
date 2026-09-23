import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Studio sign in  Dynasty Pix" },
      { name: "description", content: "Sign in to manage galleries, print products and orders." },
      { property: "og:title", content: "Studio sign in  Dynasty Pix" },
      {
        property: "og:description",
        content: "Sign in to manage galleries, print products and orders.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    void nav({ to: "/admin" });
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-16">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center" aria-label="Dynasty Pix home">
          <img
            src="/images/dynasty-pix-logo.png"
            alt="Dynasty Pix"
            className="h-10 w-auto rounded-sm bg-black px-2 py-1"
          />
        </Link>
        <p className="label-mono mt-10 text-primary">Studio access</p>
        <h1 className="mt-3 font-display text-5xl">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border bg-card p-6">
          <label className="block">
            <span className="label-mono">Email</span>
            <input
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="block">
            <span className="label-mono">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            disabled={busy}
            className="label-mono w-full rounded-full bg-foreground px-5 py-4 text-white disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-center text-xs text-muted-foreground underline"
          >
            {mode === "signin" ? "Need an account?" : "Already have an account?"}
          </button>
        </form>
      </div>
    </main>
  );
}
