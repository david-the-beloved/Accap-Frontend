"use client";

import { FormEvent, useState, useEffect, useRef, useCallback } from "react";
import { CredentialResponse } from "@react-oauth/google";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { login, loginWithGoogle, setToken, signup } from "@/lib/api";
import styles from "./AuthForm.module.css";

type AuthFormProps = {
  mode: "login" | "signup";
};

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = mode === "login" ? await login(email, password) : await signup(email, password);

      setToken(data.access_token);
      router.push("/reader");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to continue");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      setError("Google authentication did not return a credential");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const data = await loginWithGoogle(credentialResponse.credential);
      setToken(data.access_token);
      router.push("/reader");
    } catch (googleError) {
      setError(googleError instanceof Error ? googleError.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  const onGoogleCallback = useCallback((resp: { credential?: string } | null) => {
    if (!resp || !resp.credential) {
      setError("Google authentication did not return a credential");
      return;
    }

    // reuse existing flow
    void (async () => {
      setError(null);
      setLoading(true);
      try {
        const data = await loginWithGoogle(resp.credential as string);
        setToken(data.access_token);
        router.push("/reader");
      } catch (googleError) {
        setError(googleError instanceof Error ? googleError.message : "Google sign-in failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const gsiRef = useRef(false);
  useEffect(() => {
    if (!googleClientId) return;
    if (typeof window === "undefined") return;
    if (gsiRef.current) return;

    const loadAndInit = async () => {
      if (!(window as any).google) {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
        await new Promise((res) => {
          s.onload = res;
          s.onerror = res;
        });
      }

      const g = (window as any).google;
      if (g && g.accounts && g.accounts.id && !gsiRef.current) {
        try {
          g.accounts.id.initialize({ client_id: googleClientId, callback: onGoogleCallback });
          g.accounts.id.renderButton(document.getElementById("g_id_signin"), { theme: "outline", size: "large" });
          gsiRef.current = true;
        } catch (err) {
          // initialization may still warn in dev; swallow errors here
          // console.warn(err);
        }
      }
    };

    void loadAndInit();
  }, [googleClientId, onGoogleCallback]);

  return (
    <form onSubmit={onSubmit} className={styles.card}>
      <div className={styles.heading}>
        <p className={styles.kicker}>{mode === "login" ? "Sign in" : "Create account"}</p>
        <h1>{mode === "login" ? "Welcome back" : "Join the reading circle"}</h1>
        <p>Use your email and password to continue.</p>
      </div>

      <div className={styles.fieldBlock}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div className={styles.fieldBlock}>
        <label htmlFor="password">Password</label>
        <div className={styles.passwordRow}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            className={styles.toggleVisibility}
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <button type="submit" disabled={loading} className={styles.submitButton}>
        {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
      </button>

      {error && <div className={styles.error}>{error}</div>}

      {googleClientId ? (
        <div className={styles.googleSection}>
          <div className={styles.divider}>or</div>
          <div id="g_id_signin" />
        </div>
      ) : null}

      <div className={styles.switchMode}>
        {mode === "login" ? "New here? " : "Already have an account? "}
        <Link href={mode === "login" ? "/signup" : "/login"}>
          {mode === "login" ? "Create one" : "Log in"}
        </Link>
      </div>
    </form>
  );
}
