"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { logoutAdmin } from "@/lib/auth/actions";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await logoutAdmin();
          router.push("/");
          router.refresh();
        });
      }}
      className="text-zinc-600 hover:text-red-600 disabled:opacity-50"
    >
      로그아웃
    </button>
  );
}
