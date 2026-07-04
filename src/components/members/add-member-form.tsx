"use client";

import { useActionState, useEffect, useRef } from "react";
import { createMember, type MemberActionResult } from "@/lib/members/actions";

const initialState: MemberActionResult | null = null;

export function AddMemberForm() {
  const [state, formAction, isPending] = useActionState(createMember, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600">이름</label>
        <input
          name="name"
          required
          className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-600"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600">성별</label>
        <select
          name="gender"
          required
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-600"
        >
          <option value="male">남</option>
          <option value="female">여</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600">등급 (선택)</label>
        <select
          name="grade"
          defaultValue=""
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-600"
        >
          <option value="">미지정</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
          <option value="D">D</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {isPending ? "추가 중..." : "추가"}
      </button>
      {state && !state.success && (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
