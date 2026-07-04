"use client";

import { useActionState, useState, useTransition } from "react";
import { updateMember, deleteMember, type MemberActionResult } from "@/lib/members/actions";
import type { Database } from "@/lib/supabase/types";

type Member = Database["public"]["Tables"]["members"]["Row"];

const initialState: MemberActionResult | null = null;

const GRADE_BADGE: Record<string, string> = {
  A: "bg-amber-100 text-amber-800",
  B: "bg-sky-100 text-sky-800",
  C: "bg-zinc-200 text-zinc-700",
  D: "bg-rose-100 text-rose-700",
};

export function MemberRow({ member }: { member: Member }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateMember, initialState);
  const [isDeleting, startDeleteTransition] = useTransition();

  if (editing) {
    return (
      <li className="py-2">
        <form
          action={(fd) => {
            formAction(fd);
            setEditing(false);
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="id" value={member.id} />
          <input
            name="name"
            defaultValue={member.name}
            required
            className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-sm"
          />
          <select
            name="gender"
            defaultValue={member.gender}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
          >
            <option value="male">남</option>
            <option value="female">여</option>
          </select>
          <select
            name="grade"
            defaultValue={member.grade ?? ""}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
          >
            <option value="">미지정</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
          <label className="flex items-center gap-1 text-sm text-zinc-600">
            <input type="checkbox" name="is_active" defaultChecked={member.is_active} />
            활동중
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-800"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600"
          >
            취소
          </button>
        </form>
        {state && !state.success && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className={`text-sm ${member.is_active ? "text-zinc-900" : "text-zinc-400 line-through"}`}>
          {member.name}
        </span>
        {member.grade && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GRADE_BADGE[member.grade]}`}>
            {member.grade}
          </span>
        )}
        {!member.is_active && (
          <span className="text-xs text-zinc-400">(비활성)</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <button onClick={() => setEditing(true)} className="text-zinc-500 hover:text-emerald-700">
          수정
        </button>
        <button
          disabled={isDeleting}
          onClick={() => {
            if (!confirm(`${member.name}님을 정말 삭제하시겠습니까?`)) return;
            startDeleteTransition(async () => {
              await deleteMember(member.id);
            });
          }}
          className="text-zinc-500 hover:text-red-600 disabled:opacity-50"
        >
          삭제
        </button>
      </div>
    </li>
  );
}
