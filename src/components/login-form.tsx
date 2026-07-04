"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin, type LoginResult } from "@/lib/auth/actions";

const initialState: LoginResult | null = null;

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(loginAdmin, initialState);

  useEffect(() => {
    if (state?.success) {
      router.push(next || "/");
      router.refresh();
    }
  }, [state, router, next]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="text-sm font-medium text-zinc-700">
          아이디
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
      </div>
      {state && !state.success && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {isPending ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
