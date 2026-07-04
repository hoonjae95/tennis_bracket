"use server";

import { createAdminSession, destroyAdminSession } from "@/lib/auth/session";

export type LoginResult = { success: true } | { success: false; error: string };

export async function loginAdmin(
  _prevState: LoginResult | null,
  formData: FormData
): Promise<LoginResult> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validUsername || !validPassword) {
    return { success: false, error: "서버에 관리자 계정이 설정되어 있지 않습니다." };
  }

  if (username !== validUsername || password !== validPassword) {
    return { success: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  await createAdminSession();
  return { success: true };
}

export async function logoutAdmin() {
  await destroyAdminSession();
}
