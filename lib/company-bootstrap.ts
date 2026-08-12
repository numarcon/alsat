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
    await supabase.from("company_members").upsert({
      company_id: existing.id,
      user_id: userId,
      role: "owner",
      full_name: pending.fullName,
      status: "active",
    });
    rememberCompany(existing.id, existing.name);
    return existing;
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      owner_id: userId,
      name: pending.company,
      bin: pending.bin || null,
      city: pending.city,
      phone: pending.phone,
    })
    .select("id,name")
    .single();

  if (companyError || !company) {
    throw new Error(companyError?.message || "Компанияны сақтау мүмкін болмады.");
  }

  const { error: memberError } = await supabase.from("company_members").upsert({
    company_id: company.id,
    user_id: userId,
    role: "owner",
    full_name: pending.fullName,
    status: "active",
  });

  if (memberError) throw new Error(memberError.message);
  rememberCompany(company.id, company.name);
  return company;
}
