import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type WorkspaceRole = "owner" | "admin" | "manager" | "warehouse" | "forwarder";
export type WorkspaceMembership = {
  company_id: string;
  user_id: string;
  role: WorkspaceRole;
  full_name: string | null;
  status: "invited" | "active" | "disabled";
};

export async function getWorkspaceIdentity(): Promise<{ user: User | null; memberships: WorkspaceMembership[] }> {
  if (!supabase) return { user: null, memberships: [] };
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { user: null, memberships: [] };
  const { data } = await supabase
    .from("company_users")
    .select("company_id,user_id,role,status")
    .eq("user_id", userData.user.id)
    .eq("status", "active");
  const fullName = typeof userData.user.user_metadata?.full_name === "string"
    ? userData.user.user_metadata.full_name
    : null;
  return {
    user: userData.user,
    memberships: (data ?? []).map((membership) => ({ ...membership, full_name: fullName })) as WorkspaceMembership[],
  };
}

export function roleLabel(role: WorkspaceRole) {
  return {
    owner: "Компания әкімшісі",
    admin: "Әкімші",
    manager: "Менеджер",
    warehouse: "Қойма менеджері",
    forwarder: "Экспедитор",
  }[role];
}

export function rolePath(role: WorkspaceRole) {
  return { owner: "/", admin: "/", manager: "/", warehouse: "/warehouse", forwarder: "/dispatcher" }[role];
}
