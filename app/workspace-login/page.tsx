"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { bootstrapOwnerCompany, getPendingCompany, rememberCompany } from "../../lib/company-bootstrap";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { getWorkspaceIdentity, rolePath } from "../../lib/workspace-auth";
import { AlsatBrand, AlsatIcon } from "../../components/AlsatIcon";

export default function WorkspaceLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!supabase || !isSupabaseConfigured) {
      setError("Supabase орта айнымалылары табылмады.");
      return;
    }

    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setLoading(false);
      setError(signInError?.message || "Email немесе құпия сөз қате.");
      return;
    }

    try {
      const pending = getPendingCompany();
      if (pending) {
        await bootstrapOwnerCompany(data.user.id, pending);
        window.location.href = "/workspace";
        return;
      }

      const identity = await getWorkspaceIdentity();
      const owner = identity.memberships.find((membership) => membership.role === "owner");
      if (owner) {
        const { data: company } = await supabase.from("companies").select("name").eq("id", owner.company_id).single();
        rememberCompany(owner.company_id, company?.name ?? "Компания Workspace");
        window.location.href = "/workspace";
        return;
      }

      const membership = identity.memberships[0];
      if (membership) {
        localStorage.setItem("alsat-company-id", membership.company_id);
        window.location.href = rolePath(membership.role);
        return;
      }

      const { data: platformAdmin } = await supabase.from("platform_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
      if (platformAdmin) {
        window.location.href = "/admin";
        return;
      }

      setError("Бұл аккаунтқа компания немесе қызметкер рөлі тіркелмеген.");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Workspace ашылмады.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="qmart-login workspace-owner-login">
      <Link className="qmart-login-brand" href="/promo">
        <AlsatBrand label="WORKSPACE" inverse/>
      </Link>
      <div className="qmart-login-copy">
        <h1>Workspace-қа кіру</h1>
        <p>Компания кабинетіне немесе өз қызметкер рөліңізге кіріңіз.</p>
      </div>
      <form onSubmit={signIn}>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.kz" autoComplete="email" required /></label>
        <label>Құпия сөз<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" required /></label>
        <button className="qmart-login-btn" type="submit" disabled={loading}>{loading ? "Workspace ашылуда…" : "Кіру"}</button>
      </form>
      {error && <p className="login-error">{error}</p>}
      <div className="qmart-or"><span>немесе</span></div>
      <Link className="demo-login" href="/workspace-signup">Жаңа компания тіркеу</Link>
      <Link className="forgot" href="/admin">Alsat Admin панеліне кіру</Link>
      <small className="offline-note"><AlsatIcon name="shield" size={15}/> Деректер Supabase арқылы қорғалады</small>
    </main>
  );
}
