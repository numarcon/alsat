"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { AlsatBrand } from "../../components/AlsatIcon";

type LoginStep = "phone" | "otp";
type LoginMode = "email" | "phone";

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("8") && digits.length === 11) return `+7${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 11) return `+${digits}`;
  return value.trim();
}

export default function AgentLogin() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<LoginMode>("email");
  const [step, setStep] = useState<LoginStep>("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!normalizedPhone || normalizedPhone.replace(/\D/g, "").length < 10) {
      setError("Телефон нөмірін толық енгізіңіз.");
      return;
    }

    if (!supabase || !isSupabaseConfigured) {
      setMessage("Демо режимі қосылды. Қазір кабинетке өте аласыз.");
      return;
    }

    setLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
    });
    setLoading(false);

    if (otpError) {
      setError(otpError.message || "Код жіберу мүмкін болмады.");
      return;
    }

    setStep("otp");
    setMessage("SMS-код жіберілді. Кодты төменге енгізіңіз.");
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!/^\d{6}$/.test(otp)) {
      setError("6 таңбалы кодты енгізіңіз.");
      return;
    }

    if (!supabase || !isSupabaseConfigured) {
      window.location.href = "/agent";
      return;
    }

    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: otp,
      type: "sms",
    });
    setLoading(false);

    if (verifyError) {
      setError(verifyError.message || "Код қате немесе мерзімі өтіп кеткен.");
      return;
    }

    window.location.href = "/agent/setup";
  }

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!email.trim() || !password) {
      setError("Email және құпия сөзді енгізіңіз.");
      return;
    }
    if (!supabase || !isSupabaseConfigured) {
      window.location.href = "/agent";
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message || "Email немесе құпия сөз қате.");
      return;
    }
    window.location.href = "/agent/setup";
  }

  async function signInWithGoogle() {
    setError("");
    setMessage("");
    if (!supabase || !isSupabaseConfigured) {
      setMessage("Google кіруі Supabase бапталғаннан кейін қолжетімді болады.");
      return;
    }

    setLoading(true);
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/agent/setup` },
    });
    setLoading(false);

    if (googleError) setError(googleError.message || "Google арқылы кіру мүмкін болмады.");
  }

  return (
    <main className="qmart-login">
      <div className="qmart-login-brand">
        <AlsatBrand label="САУДА ӨКІЛІ" inverse/>
      </div>

      <div className="qmart-login-copy">
        <h1>Сауда өкілі ретінде кіріңіз</h1>
        <p>Тапсырыстар, клиенттер және комиссиялар бір жерде.</p>
      </div>

      <div className="login-methods">
        <button type="button" className={mode === "email" ? "active" : ""} onClick={() => { setMode("email"); setStep("phone"); setError(""); setMessage(""); }}>Email</button>
        <button type="button" className={mode === "phone" ? "active" : ""} onClick={() => { setMode("phone"); setStep("phone"); setError(""); setMessage(""); }}>Телефон / SMS</button>
      </div>

      <form onSubmit={mode === "email" ? signInWithEmail : step === "phone" ? requestOtp : verifyOtp}>
        {mode === "email" ? (
          <>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nurlanqyzy2@gmail.com" type="email" autoComplete="email" required />
            </label>
            <label>
              Құпия сөз
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" type="password" autoComplete="current-password" required />
            </label>
          </>
        ) : step === "phone" ? (
          <label>
            Телефон нөміріңіз
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+7 (___) ___-__-__"
              inputMode="tel"
              autoComplete="tel"
              required
            />
          </label>
        ) : (
          <label>
            SMS-код
            <input
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
          </label>
        )}
        <button className="qmart-login-btn" type="submit" disabled={loading}>
          {loading ? "Күте тұрыңыз…" : mode === "email" ? "Кіру" : step === "phone" ? "SMS-код алу" : "Кіру"}
        </button>
      </form>

      {message && <p className="login-message">{message}</p>}
      {error && <p className="login-error">{error}</p>}

      <div className="qmart-or"><span>немесе</span></div>
      <button className="google-login" type="button" onClick={signInWithGoogle} disabled={loading}>
        G　Google арқылы кіру
      </button>
      <Link className="demo-login" href="/agent/setup">Сауда өкілі профилін ашу</Link>
      <a className="forgot" href="mailto:support@alsat.kz">Құпия сөзді ұмыттыңыз ба?</a>
      <small className="offline-note">◉　Offline режимі қолжетімді</small>
    </main>
  );
}
