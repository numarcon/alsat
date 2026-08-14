"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import {
  bootstrapOwnerCompany,
  type PendingCompany,
  rememberCompany,
  savePendingCompany,
} from "../../lib/company-bootstrap";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { getWorkspaceIdentity } from "../../lib/workspace-auth";
import { AlsatBrand } from "../../components/AlsatIcon";

export default function WorkspaceSignupPage() {
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      if (!supabase) {
        if (active) setChecking(false);
        return;
      }

      const identity = await getWorkspaceIdentity();
      const membership = identity.memberships.find((item) =>
        ["owner", "admin", "manager"].includes(item.role),
      );

      if (!active) return;
      if (membership) {
        window.location.replace("/workspace");
        return;
      }
      setChecking(false);
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const pending: PendingCompany = {
      company: String(form.get("company")),
      bin: String(form.get("bin") || ""),
      city: String(form.get("city")),
      phone: String(form.get("phone")),
      fullName: String(form.get("fullName")),
      email: String(form.get("email")).trim().toLowerCase(),
    };
    const password = String(form.get("password"));

    if (!supabase || !isSupabaseConfigured) {
      setError("Supabase қосылмаған. Vercel environment айнымалыларын тексеріңіз.");
      return;
    }

    savePendingCompany(pending);
    setLoading(true);

    try {
      const { data: current } = await supabase.auth.getUser();
      let user = current.user;

      if (user && user.email?.toLowerCase() !== pending.email) {
        await supabase.auth.signOut();
        user = null;
      }

      if (!user) {
        const { data: signup, error: signupError } = await supabase.auth.signUp({
          email: pending.email,
          password,
          options: {
            data: { full_name: pending.fullName },
            emailRedirectTo: `${window.location.origin}/workspace-login`,
          },
        });
        if (signupError) throw signupError;
        user = signup.user;

        if (!signup.session) {
          setMessage("Email-ға растау хаты жіберілді. Сілтемені басып, кейін Workspace-қа кіріңіз.");
          return;
        }
      }

      if (!user) throw new Error("Аккаунт ашылмады. Қайта көріңіз.");

      const company = await bootstrapOwnerCompany(user.id, pending);
      rememberCompany(company.id, company.name);
      window.location.href = "/workspace";
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : "Тіркелу аяқталмады.";
      setError(
        detail.includes("already registered")
          ? "Бұл email бұрын тіркелген. Workspace-қа кіру батырмасын пайдаланыңыз."
          : detail,
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="workspace-checking">
        <Brand />
        <p>Workspace тексерілуде…</p>
      </main>
    );
  }

  return (
    <main className="registration">
      <section className="register-copy">
        <Brand />
        <div>
          <p className="eyebrow">ALSAT WORKSPACE</p>
          <h1>Сатуды бір жерден басқарыңыз</h1>
          <p>Компания, каталог, сауда өкілдері және тапсырыстар — бір ыңғайлы workspace-та.</p>
        </div>
        <div className="feature-list">
          <span>✓ Тауарларды СӨ-ге бөлек ашу</span>
          <span>✓ Marketplace-ке саналы жариялау</span>
          <span>✓ Мобильді сауда ағыны</span>
        </div>
      </section>

      <section className="register-card">
        <div>
          <p className="eyebrow">НАҚТЫ WORKSPACE</p>
          <h2>Компанияны тіркеу</h2>
          <p>Компания мен әкімші аккаунтын бірге ашыңыз.</p>
        </div>
        <form onSubmit={submit}>
          <label>Компания атауы<input required placeholder="Мысалы, Kraus Electric" name="company" /></label>
          <div className="two">
            <label>БСН<input placeholder="123456789012" name="bin" inputMode="numeric" /></label>
            <label>Қала<input required placeholder="Алматы" name="city" /></label>
          </div>
          <div className="two">
            <label>Әкімшінің аты-жөні<input required placeholder="Нұрлан Әбдірахманов" name="fullName" /></label>
            <label>Байланыс телефоны<input required placeholder="+7 700 000 00 00" name="phone" /></label>
          </div>
          <label>Email<input required type="email" placeholder="name@company.kz" name="email" autoComplete="email" /></label>
          <label>Құпия сөз<input required type="password" minLength={8} placeholder="Кемінде 8 таңба" name="password" autoComplete="new-password" /></label>
          {message && <div className="register-feedback success">✓ {message}<Link href="/workspace-login">Workspace-қа кіру →</Link></div>}
          {error && <div className="register-feedback error">{error}</div>}
          <button className="primary full" disabled={loading}>{loading ? "Workspace ашылуда…" : "Workspace ашу"} <span>→</span></button>
        </form>
        <Link className="demo-entry register-login" href="/workspace-login">Аккаунтым бар — кіру →</Link>
        <Link className="demo-entry register-login" href="/">Marketplace-ке қайту</Link>
        <small>Компания Supabase-ке сақталып, сіз owner рөлін аласыз.</small>
      </section>
    </main>
  );
}

function Brand() {
  return <Link className="brand" href="/promo"><AlsatBrand label="WORKSPACE"/></Link>;
}
