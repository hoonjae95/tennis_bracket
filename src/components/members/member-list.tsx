import type { Database } from "@/lib/supabase/types";
import { MemberRow } from "@/components/members/member-row";

type Member = Database["public"]["Tables"]["members"]["Row"];

export function MemberList({ title, members }: { title: string; members: Member[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 font-semibold text-zinc-800">
        {title} <span className="text-sm font-normal text-zinc-400">({members.length}명)</span>
      </h2>
      {members.length === 0 ? (
        <p className="text-sm text-zinc-400">등록된 회원이 없습니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </ul>
      )}
    </div>
  );
}
