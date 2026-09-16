"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Field } from "@/components/ui/Field";
import ui from "@/components/ui/ui.module.css";
import styles from "./forms.module.css";

type Mode = "login" | "register";

/* Only same-site paths may be used as a post-login destination (no open redirect). */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/dashboard";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const { login, register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    const local: Record<string, string> = {};
    if (mode === "register" && !fullName.trim()) local.fullName = t("setupNeedName");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) local.email = t("authEmail");
    if (mode === "register" && password.length < 10) local.password = t("authPasswordHint");
    if (Object.keys(local).length) return setFieldErrors(local);

    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(fullName.trim(), email.trim(), password);
      router.replace(safeNext(params.get("next")));
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.details?.length) {
        setFieldErrors(Object.fromEntries(apiErr.details.map((d) => [d.path, d.message])));
      } else {
        setError(apiErr.isNetwork ? t("errNetwork") : apiErr.message || t("errGeneric"));
      }
      setBusy(false);
    }
  };

  const isLogin = mode === "login";
  return (
    <>
      <h1 className={ui.pageTitle}>{t(isLogin ? "authSignInTitle" : "authRegisterTitle")}</h1>
      <p className={ui.pageSub}>{t(isLogin ? "authSignInSub" : "authRegisterSub")}</p>
      <form className={styles.form} onSubmit={submit} noValidate>
        {!isLogin && (
          <Field
            label={t("authFullName")}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            maxLength={120}
            error={fieldErrors.fullName}
            required
          />
        )}
        <Field
          label={t("authEmail")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          error={fieldErrors.email}
          required
        />
        <Field
          label={t("authPassword")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isLogin ? "current-password" : "new-password"}
          maxLength={128}
          hint={isLogin ? undefined : t("authPasswordHint")}
          error={fieldErrors.password}
          required
        />
        {error && (
          <p className={ui.formError} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={ui.pillButtonGreen} disabled={busy}>
          {busy ? t("authWorking") : t(isLogin ? "authSignIn" : "authRegister")}
        </button>
      </form>
      <p className={styles.switch}>
        {t(isLogin ? "authNoAccount" : "authHaveAccount")}{" "}
        <Link href={isLogin ? "/register" : "/login"}>{t(isLogin ? "authRegister" : "authSignIn")}</Link>
      </p>
    </>
  );
}
