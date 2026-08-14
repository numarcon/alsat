"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../../lib/supabase";

type AgentProfile = { id: string; full_name: string; phone: string | null };
type AgentLink = {
  company_id: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  commission_rate: number;
  companies: { id: string; name: string } | Array<{ id: string; name: string }> | null;
};

export default function AgentSetupPage() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [links, setLinks] = useState<AgentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setError("Supabase орта айнымалылары табылмады.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      window.location.replace("/agent-login");
      return;
    }
    const { data: agent, error: agentError } = await supabase
      .from("sales_agents")
      .select("id,full_name,phone")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (agentError) {
      setError(agentError.message);
      setLoading(false);
      return;
    }
    setProfile(agent as AgentProfile | null);
    if (agent) {
      const { data, error: linksError } = await supabase
        .from("company_sales_agents")
        .select("company_id,status,commission_rate,companies(id,name)")
        .eq("sales_agent_id", agent.id)
        .order("created_at", { ascending: false });
      if (linksError) setError(linksError.message);
      setLinks((data ?? []) as unknown as AgentLink[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setError("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const values = new FormData(event.currentTarget);
    const { error: insertError } = await supabase.from("sales_agents").insert({
      user_id: userData.user.id,
      full_name: String(values.get("full_name")),
      phone: String(values.get("phone") || "") || null,
    });
    if (insertError) setError(insertError.message);
    else { setMessage("Сауда өкілі профилі ашылды."); await load(); }
  }

  async function requestCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !profile) return;
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const companyId = String(new FormData(form).get("company_id") || "").trim();
    const { error: requestError } = await supabase.from("company_sales_agents").insert({
      company_id: companyId,
      sales_agent_id: profile.id,
      status: "pending",
    });
    if (requestError) setError(requestError.message);
    else { form.reset(); setMessage("Компанияға қосылу сұрауы жіберілді."); await load(); }
  }

  function openCompany(link: AgentLink) {
    const company = Array.isArray(link.companies) ? link.companies[0] : link.companies;
    localStorage.setItem("alsat-company-id", link.company_id);
    if (company?.name) localStorage.setItem("alsat-company-name", company.name);
    window.location.href = "/agent";
  }

  return (
    <main className="qmart-login workspace-owner-login">
      <Link className="qmart-login-brand" href="/agent-login"><span className="qmark">A</span><b>ALSAT</b><small>САУДА ӨКІЛІ</small></Link>
      <div className="qmart-login-copy"><h1>Компанияға қосылу</h1><p>Сауда өкілі тәуелсіз аккаунт ретінде тіркеліп, компанияның бекітуін күтеді.</p></div>
      {loading ? <p className="login-message">Профиль тексерілуде…</p> : !profile ? (
        <form onSubmit={register}>
          <label>Аты-жөні<input name="full_name" placeholder="Нұрлан Әбдірахманов" required /></label>
          <label>Телефон<input name="phone" placeholder="+7 (___) ___-__-__" inputMode="tel" /></label>
          <button className="qmart-login-btn" type="submit">Профиль ашу</button>
        </form>
      ) : (
        <>
          <div className="login-message"><strong>{profile.full_name}</strong><br />{profile.phone || "Телефон көрсетілмеген"}</div>
          {links.map((link) => {
            const company = Array.isArray(link.companies) ? link.companies[0] : link.companies;
            return <div className="login-message" key={link.company_id}><strong>{company?.name || `Компания ${link.company_id.slice(0, 8)}…`}</strong><br />Күйі: {link.status}{link.status === "approved" && <><br /><button className="qmart-login-btn" type="button" onClick={() => openCompany(link)}>Кабинетті ашу</button></>}</div>;
          })}
          <form onSubmit={requestCompany}>
            <label>Компания ID<input name="company_id" placeholder="Компания берген UUID" required /></label>
            <button className="qmart-login-btn" type="submit">Қосылу сұрауын жіберу</button>
          </form>
        </>
      )}
      {message && <p className="login-message">{message}</p>}
      {error && <p className="login-error">{error}</p>}
      <Link className="forgot" href="/agent-login">← Кіру бетіне қайту</Link>
    </main>
  );
}
