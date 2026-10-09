"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/icons";

export default function SignInPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("SignIn");

  async function handleOAuth(provider: "google" | "apple") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } =
      mode === "sign-up"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-ice">
          <LogoMark className="h-8 w-8" />
        </div>
        <div className="font-display text-2xl font-extrabold">
          <span className="text-frost">Biathlon</span>
          <span className="text-ice">Pronos</span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <button
          onClick={() => handleOAuth("google")}
          className="rounded-xl border border-border bg-card py-3 font-display text-sm font-semibold"
        >
          {t("continueGoogle")}
        </button>
        <button
          onClick={() => handleOAuth("apple")}
          className="rounded-xl border border-border bg-card py-3 font-display text-sm font-semibold"
        >
          {t("continueApple")}
        </button>
      </div>

      <div className="flex w-full items-center gap-3 text-xs text-text-dim">
        <div className="h-px flex-1 bg-border" />
        {t("or")}
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailSubmit} className="flex w-full flex-col gap-3">
        <input
          type="email"
          required
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-ice"
        />
        <input
          type="password"
          required
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-ice"
        />
        {error && <div className="text-xs text-red">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-ice py-3 font-display text-sm font-bold text-[#062024] disabled:opacity-60"
        >
          {loading ? t("connecting") : mode === "sign-up" ? t("signUpSubmit") : t("submit")}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "sign-up" ? "sign-in" : "sign-up");
          setError(null);
        }}
        className="text-xs text-text-dim underline"
      >
        {mode === "sign-up" ? t("switchToSignIn") : t("switchToSignUp")}
      </button>
    </div>
  );
}
