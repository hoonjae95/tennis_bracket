"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthenticated } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/types";

type Gender = Database["public"]["Enums"]["gender"];
type Grade = Database["public"]["Enums"]["grade"];

export type MemberActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const ok = await isAdminAuthenticated();
  if (!ok) throw new Error("Unauthorized");
}

export async function createMember(
  _prevState: MemberActionResult | null,
  formData: FormData
): Promise<MemberActionResult> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const gender = String(formData.get("gender") ?? "") as Gender;
  const gradeRaw = String(formData.get("grade") ?? "");
  const grade = (gradeRaw === "" ? null : gradeRaw) as Grade | null;

  if (!name) return { success: false, error: "이름을 입력해주세요." };
  if (gender !== "male" && gender !== "female") {
    return { success: false, error: "성별을 선택해주세요." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("members").insert({
    name,
    gender,
    grade,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/members");
  return { success: true };
}

export async function updateMember(
  _prevState: MemberActionResult | null,
  formData: FormData
): Promise<MemberActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const gender = String(formData.get("gender") ?? "") as Gender;
  const gradeRaw = String(formData.get("grade") ?? "");
  const grade = (gradeRaw === "" ? null : gradeRaw) as Grade | null;
  const isActive = formData.get("is_active") === "on";

  if (!id) return { success: false, error: "잘못된 요청입니다." };
  if (!name) return { success: false, error: "이름을 입력해주세요." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("members")
    .update({ name, gender, grade, is_active: isActive })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/members");
  return { success: true };
}

export async function deleteMember(id: string): Promise<MemberActionResult> {
  await requireAdmin();

  const supabase = createAdminClient();
  const { error } = await supabase.from("members").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/members");
  return { success: true };
}
