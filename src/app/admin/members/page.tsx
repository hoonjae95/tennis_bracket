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
          L.P.T 정회원 명단과 등급(A/B/C/D)을 관리합니다. 등급은 방 만들기에서 유동적으로 조정할 수 있습니다.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-amber-900">
          등급 안내 (관리자 전용 · 외부 유출 금지)
        </h2>
        <p className="mb-2 text-xs text-amber-800">
          등급은 게임 밸런스를 맞추기 위해 임시로 작성한 기준입니다. 정회원 간 형성된 서열이 아니니 외부에 유출하지 않도록 주의해주세요.
        </p>
        <ul className="space-y-1 text-xs text-amber-800">
          <li><strong>A등급 (3점)</strong> — 정회원 간 실력이 상위권 (원활한 게임 진행 가능)</li>
          <li><strong>B등급 (2점)</strong> — 정회원 간 실력이 중상위권 (A등급보다 조금 아래 실력)</li>
          <li><strong>C등급 (1점)</strong> — 정회원 간 실력이 중위권 (게임 진행은 가능하나 실력이 조금 아쉬운 수준)</li>
          <li><strong>D등급 (0점)</strong> — 정회원 간 실력이 하위권 (게임 진행이 어려운 수준)</li>
        </ul>
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
