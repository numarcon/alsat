"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type AgentLink = {
  company_id: string;
  sales_agent_id: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  commission_rate: number;
  sales_agents: { full_name: string; phone: string | null } | Array<{ full_name: string; phone: string | null }> | null;
};
type CompanyMember = { company_id: string; user_id: string; role: "owner" | "admin" | "manager" | "warehouse" | "forwarder"; status: "invited" | "active" | "disabled" };

export default function CompanyAgents({ companyId, productCount, productName }: { companyId: string | null; productCount: number; productName?: string }) {
  const [links, setLinks] = useState<AgentLink[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [message, setMessage] = useState("");
  const [rates, setRates] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!supabase || !companyId) return;
    const [agentResult, memberResult] = await Promise.all([
      supabase.from("company_sales_agents").select("company_id,sales_agent_id,status,commission_rate,sales_agents(full_name,phone)").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("company_users").select("company_id,user_id,role,status").eq("company_id", companyId),
    ]);
    const error = agentResult.error || memberResult.error;
    if (error) { setMessage(error.message); return; }
    setLinks((agentResult.data ?? []) as unknown as AgentLink[]);
    setMembers((memberResult.data ?? []) as CompanyMember[]);
    setRates(Object.fromEntries((agentResult.data ?? []).map((link) => [link.sales_agent_id, Number(link.commission_rate || 0)])));
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  async function update(link: AgentLink, status: AgentLink["status"]) {
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    const payload = status === "approved"
      ? { status, commission_rate: rates[link.sales_agent_id] || 0, approved_by: userData.user?.id, approved_at: new Date().toISOString() }
      : { status };
    const { error } = await supabase.from("company_sales_agents").update(payload)
      .eq("company_id", link.company_id).eq("sales_agent_id", link.sales_agent_id);
    setMessage(error ? error.message : status === "approved" ? "Сауда өкілі бекітілді." : "Сұрау қабылданбады.");
    if (!error) await load();
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !companyId) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const { error } = await supabase.from("company_users").upsert({
      company_id: companyId,
      user_id: String(values.get("user_id") || "").trim(),
      role: String(values.get("role")),
      status: "active",
    });
    setMessage(error ? error.message : "Қызметкер рөлі сақталды.");
    if (!error) { form.reset(); await load(); }
  }

  async function disableMember(member: CompanyMember) {
    if (!supabase || member.role === "owner") return;
    const { error } = await supabase.from("company_users").update({ status: "disabled" }).eq("company_id", member.company_id).eq("user_id", member.user_id);
    setMessage(error ? error.message : "Қызметкер қолжетімділігі өшірілді.");
    if (!error) await load();
  }

  return <>
    <div className="page-actions"><div><p>СӨ мобильді каталогында {productCount} тауар қолжетімді.</p><small>Қосылу үшін сауда өкіліне компания ID беріңіз: <b>{companyId || "—"}</b></small></div></div>
    {message && <div className="toast">{message}<button onClick={() => setMessage("")}>×</button></div>}
    <form className="card action-form" onSubmit={addMember}><h3>Компания қызметкері</h3><p>Auth User ID арқылы ішкі рөл беріңіз. Сауда өкілі бұл тізімге қосылмайды.</p><div className="two"><label>User ID<input name="user_id" placeholder="Қызметкер UUID" required /></label><label>Рөлі<select name="role" defaultValue="manager"><option value="admin">Әкімші</option><option value="manager">Менеджер</option><option value="warehouse">Қойма</option><option value="forwarder">Экспедитор</option></select></label></div><button className="primary">Рөлді сақтау</button></form>
    <section className="card order-list">{members.map((member) => <div className="order-row" key={`${member.user_id}-${member.role}`}><span className="order-icon">♙</span><div><strong>{member.user_id.slice(0, 8)}…</strong><small>{member.role}</small></div><div><b>{member.status}</b>{member.role !== "owner" && member.status === "active" && <button onClick={() => void disableMember(member)}>Өшіру</button>}</div></div>)}</section>
    <div className="agent-grid">{links.length ? links.map((link, index) => {
      const agent = Array.isArray(link.sales_agents) ? link.sales_agents[0] : link.sales_agents;
      return <section className="card agent-profile" key={link.sales_agent_id}>
        <span className={index % 2 ? "avatar large blue" : "avatar large"}>{agent?.full_name?.[0] || "С"}</span>
        <h3>{agent?.full_name || "Сауда өкілі"}</h3>
        <p>{agent?.phone || "Телефон көрсетілмеген"} · {link.status}</p>
        <div><b>{link.commission_rate}%</b><small>комиссия</small><b>{link.status === "approved" ? "Белсенді" : "Күтуде"}</b><small>қолжетімділік</small></div>
        {link.status === "pending" && <div className="form-actions"><input aria-label="Комиссия" type="number" min="0" max="100" value={rates[link.sales_agent_id] ?? 0} onChange={(event) => setRates((current) => ({ ...current, [link.sales_agent_id]: Number(event.target.value) }))} /><button onClick={() => void update(link, "rejected")}>Қабылдамау</button><button className="primary" onClick={() => void update(link, "approved")}>Бекіту</button></div>}
      </section>;
    }) : <section className="card agent-profile"><span className="avatar large">С</span><h3>Сұрау жоқ</h3><p>Сауда өкілі алдымен тәуелсіз профиль ашып, компания ID арқылы сұрау жібереді.</p></section>}</div>
    <section className="card mobile-preview"><div><p className="eyebrow">СӨ MOBILE FLOW</p><h3>Компания → Дүкен → Тауар → Тапсырыс</h3><p>Бекітілген сауда өкілі ғана компания каталогын ашып, тапсырыс жинай алады.</p></div><div className="phone"><b>Alsat</b><span>Компания каталогы</span><small>{productName || "Тауар жоқ"}</small><button>Себетке қосу</button></div></section>
  </>;
}
