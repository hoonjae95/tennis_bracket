import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth/session";
import { LoginForm } from "@/components/login-form";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const isAdmin = await isAdminAuthenticated();
  const { next } = await searchParams;

  if (isAdmin) {
    redirect(next || "/");
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-zinc-900">관리자 로그인</h1>
        <p className="mt-1 text-sm text-zinc-500">
          방 생성과 정회원 관리는 관리자만 가능합니다.
        </p>
      </div>
      <LoginForm next={next} />
    </div>
  );
}
