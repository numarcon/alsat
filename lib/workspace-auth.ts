import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type WorkspaceRole = "owner" | "sales_agent" | "warehouse" | "dispatcher";
export type WorkspaceMembership = {
  company_id: string;
  user_id: string;
  role: WorkspaceRole;
  full_name: string | null;
  status: "invited" | "active" | "suspended";
};

export async function getWorkspaceIdentity(): Promise<{ user: User | null; memberships: WorkspaceMembership[] }> {
  if (!supabase) return { user: null, memberships: [] };
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { user: null, memberships: [] };
  const { data } = await supabase
    .from("company_members")
    .select("company_id,user_id,role,full_name,status")
    .eq("user_id", userData.user.id)
    .eq("status", "active");
  return { user: userData.user, memberships: (data ?? []) as WorkspaceMembership[] };
}

export function roleLabel(role: WorkspaceRole) {
  return {
    owner: "Компания әкімшісі",
    sales_agent: "Сауда өкілі",
    warehouse: "Қойма менеджері",
    dispatcher: "Экспедитор",
  }[role];
}

export function rolePath(role: WorkspaceRole) {
  return { owner: "/", sales_agent: "/agent", warehouse: "/warehouse", dispatcher: "/dispatcher" }[role];
}
