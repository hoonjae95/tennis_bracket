import { createClient } from "@/lib/supabase/server";
import { RoomWizard } from "@/components/rooms/room-wizard";

export default async function NewRoomPage() {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("id, name, gender, grade")
    .eq("is_active", true)
    .order("gender", { ascending: true })
    .order("name", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">방 만들기</h1>
        <p className="text-sm text-zinc-500">일정 정보를 입력하고 대진표를 만들 준비를 합니다.</p>
      </div>
      <RoomWizard members={members ?? []} />
    </div>
  );
}
