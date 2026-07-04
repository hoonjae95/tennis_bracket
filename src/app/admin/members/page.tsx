import { createClient } from "@/lib/supabase/server";
import { MemberList } from "@/components/members/member-list";
import { AddMemberForm } from "@/components/members/add-member-form";

export default async function AdminMembersPage() {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("*")
    .order("gender", { ascending: true })
    .order("name", { ascending: true });

  const male = (members ?? []).filter((m) => m.gender === "male");
  const female = (members ?? []).filter((m) => m.gender === "female");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">정회원 관리</h1>
        <p className="text-sm text-zinc-500">
          L.P.T 정회원 명단과 등급(A/B/C)을 관리합니다. 등급은 방 만들기에서 유동적으로 조정할 수 있습니다.
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-zinc-800">정회원 추가</h2>
        <AddMemberForm />
      </div>

      <div className="flex flex-col gap-6">
        <MemberList title="남자" members={male} />
        <MemberList title="여자" members={female} />
      </div>
    </div>
  );
}
