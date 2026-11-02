"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppleIcon, FacebookIcon, GoogleIcon, LogoMark } from "@/components/icons";
import { isNativeApp } from "@/lib/native/firebaseMessaging";

export default function SignInPage() {
  // « code » : connexion sans mot de passe, par un code à 6 chiffres reçu par e-mail (les comptes
  // créés depuis le parcours d'invité n'ont pas de mot de passe).
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "code">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  // Dans l'appli Android / iOS, Google refuse la connexion depuis une vue web intégrée : on n'y
  // propose que l'email (à revoir quand la connexion Google / Apple sera branchée en natif).
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(isNativeApp()), []);

  const supabase = createClient();
  const router = useRouter();
  const t = useTranslations("SignIn");
  const locale = useLocale();

  // Erreur renvoyée par /auth/callback (refus du fournisseur, compte sans e-mail, etc.).
  useEffect(() => {
    const detail = new URLSearchParams(window.location.search).get("oauth_error");
    if (detail) setOauthError(oauthErrorMessage(detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function oauthErrorMessage(detail: string) {
    if (/email/i.test(detail)) return t("oauthNoEmail");
    return t("oauthFailed", { detail });
  }

  async function handleOAuth(provider: "google" | "apple" | "facebook") {
    setOauthError(null);
    const name = { google: "Google", apple: "Apple", facebook: "Facebook" }[provider];
    // Si le fournisseur n'est pas activé dans Supabase, Supabase afficherait une page d'erreur brute
    // (« Unsupported provider: provider is not enabled ») : on vérifie avant de partir.
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      });
      if (res.ok) {
        const settings = (await res.json()) as { external?: Record<string, boolean> };
        if (settings.external && !settings.external[provider]) {
          setOauthError(t("oauthUnavailable", { provider: name }));
          return;
        }
      }
    } catch {
      // Vérification impossible : on tente quand même la connexion.
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setOauthError(oauthErrorMessage(error.message));
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!codeSent) {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
      setLoading(false);
      if (error) setError(/signups? not allowed|not found/i.test(error.message) ? t("codeUnknownEmail") : error.message);
      else setCodeSent(true);
      return;
    }
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setLoading(false);
    if (error) {
      setError(t("codeWrong"));
      return;
    }
    router.push("/");
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "code") return handleCodeSubmit(e);
    setLoading(true);
    setError(null);

    const { error } =
      mode === "sign-up"
        ? await supabase.auth.signUp({ email, password, options: { data: { locale } } })
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
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-ice">
            <LogoMark className="h-8 w-8" />
          </div>
          <div className="font-display text-2xl font-extrabold">
            <span className="text-frost">Biathlon</span>
            <span className="text-ice">Pronos</span>
          </div>
        </div>
        <p className="text-sm text-text-dim">{t("prompt")}</p>
      </div>

      {!inApp && (
        <>
          <div className="flex w-full flex-col gap-3">
            {(
              [
                { provider: "google", label: t("continueGoogle"), icon: <GoogleIcon className="h-5 w-5" /> },
                { provider: "apple", label: t("continueApple"), icon: <AppleIcon className="h-5 w-5" /> },
                { provider: "facebook", label: t("continueFacebook"), icon: <FacebookIcon className="h-5 w-5" /> },
              ] as const
            ).map(({ provider, label, icon }) => (
              <button
                key={provider}
                onClick={() => handleOAuth(provider)}
                className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card py-3 font-display text-sm font-semibold"
              >
                {icon}
                {label}
              </button>
            ))}
            {oauthError && <div className="text-center text-xs text-red">{oauthError}</div>}
          </div>

          <div className="flex w-full items-center gap-3 text-xs text-text-dim">
            <div className="h-px flex-1 bg-border" />
            {t("or")}
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={handleEmailSubmit} className="flex w-full flex-col gap-3">
        <input
          type="email"
          required
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-ice"
        />
        {mode === "code" ? (
          codeSent && (
            <>
              <div className="text-xs text-text-dim">{t("codeSent", { email: email.trim() })}</div>
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                maxLength={8}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="rounded-xl border border-border bg-card px-4 py-3 text-center font-display text-xl tracking-[0.4em] outline-none focus:border-ice"
              />
            </>
          )
        ) : (
          <input
            type="password"
            required
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-ice"
          />
        )}
        {error && <div className="text-xs text-red">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-ice py-3 font-display text-sm font-bold text-on-ice disabled:opacity-60"
        >
          {loading
            ? t("connecting")
            : mode === "code"
              ? codeSent
                ? t("submit")
                : t("codeSend")
              : mode === "sign-up"
                ? t("signUpSubmit")
                : t("submit")}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "code" ? "sign-in" : "code");
          setCodeSent(false);
          setCode("");
          setError(null);
        }}
        className="text-xs font-semibold text-ice underline"
      >
        {mode === "code" ? t("usePassword") : t("useCode")}
      </button>

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
