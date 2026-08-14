"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Commission = { id: string; order_id: string; rate: number; amount: number; status: string; earned_at: string; sales_agents: { full_name: string } | Array<{ full_name: string }> | null };
const money = new Intl.NumberFormat("kk-KZ", { style: "currency", currency: "KZT", maximumFractionDigits: 0 });

export default function CompanyCommissions({ companyId }: { companyId: string | null }) {
  const [rows, setRows] = useState<Commission[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    if (!supabase || !companyId) return;
    const { data, error } = await supabase.from("commissions").select("id,order_id,rate,amount,status,earned_at,sales_agents(full_name)").eq("company_id", companyId).order("earned_at", { ascending: false });
    if (error) setMessage(error.message);
    else setRows(((data ?? []) as unknown as Commission[]).map((row) => ({ ...row, rate: Number(row.rate), amount: Number(row.amount) })));
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.amount, 0), [rows]);
  const averageRate = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.rate, 0) / rows.length * 10) / 10 : 0;

  return <><div className="page-actions"><p>Тек жеткізілген және толық төленген СӨ тапсырыстары.</p></div>{message && <div className="toast">{message}<button onClick={() => setMessage("")}>×</button></div>}<div className="stats"><section className="stat"><span className="stat-icon">₸</span><p>Есептелген комиссия</p><strong>{money.format(total)}</strong><small>{rows.length} тапсырыс</small></section><section className="stat"><span className="stat-icon">%</span><p>Орташа мөлшерлеме</p><strong>{averageRate}%</strong><small>Бекітілген келісімдер</small></section></div><section className="card commission"><h3>Комиссиялар</h3>{rows.length ? rows.map((row) => { const agent = Array.isArray(row.sales_agents) ? row.sales_agents[0] : row.sales_agents; return <div className="order-row" key={row.id}><span className="order-icon">₸</span><div><strong>{agent?.full_name || "Сауда өкілі"}</strong><small>№{row.order_id.slice(0, 8).toUpperCase()} · {row.rate}%</small></div><div><b>{money.format(row.amount)}</b><span className="badge Расталды">{row.status}</span></div></div>; }) : <p>Delivered + paid тапсырыс болғанда комиссия автоматты пайда болады.</p>}</section></>;
}
