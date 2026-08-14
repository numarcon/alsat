import { supabase } from "./supabase";

export type PendingCompany = {
  company: string;
  bin: string;
  city: string;
  phone: string;
  fullName: string;
  email: string;
};

const pendingKey = "alsat-pending-company";

export function savePendingCompany(company: PendingCompany) {
  localStorage.setItem(pendingKey, JSON.stringify(company));
}

export function getPendingCompany(): PendingCompany | null {
  const value = localStorage.getItem(pendingKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as PendingCompany;
  } catch {
    localStorage.removeItem(pendingKey);
    return null;
  }
}

export function rememberCompany(companyId: string, companyName: string) {
  localStorage.setItem("alsat-company", "1");
  localStorage.setItem("alsat-company-id", companyId);
  localStorage.setItem("alsat-company-name", companyName);
  localStorage.removeItem(pendingKey);
}

export async function bootstrapOwnerCompany(userId: string, pending: PendingCompany) {
  if (!supabase) throw new Error("Supabase қосылмаған.");

  const { data: existing } = await supabase
    .from("companies")
    .select("id,name")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase.from("company_users").upsert({
      company_id: existing.id,
      user_id: userId,
      role: "owner",
      status: "active",
    });
    rememberCompany(existing.id, existing.name);
    return existing;
  }

  const slug = `${pending.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company"}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: companyId, error: companyError } = await supabase.rpc("create_company", {
    name: pending.company,
    slug,
  });

  if (companyError || !companyId) {
    throw new Error(companyError?.message || "Компанияны сақтау мүмкін болмады.");
  }

  const { data: company, error: profileError } = await supabase
    .from("companies")
    .update({ bin: pending.bin || null, city: pending.city, phone: pending.phone })
    .eq("id", companyId)
    .select("id,name")
    .single();

  if (profileError || !company) throw new Error(profileError?.message || "Компания профилін сақтау мүмкін болмады.");
  rememberCompany(company.id, company.name);
  return company;
}
