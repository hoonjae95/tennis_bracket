import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminAuthenticated } from "@/lib/auth/session";
import { DeleteRoomButton } from "@/components/rooms/delete-room-button";
import { TEMPLATE_LABEL } from "@/lib/rooms/templates";

export default async function HomePage() {
  const supabase = await createClient();
  const isAdmin = await isAdminAuthenticated();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, title, template, event_date, location, is_indoor, status")
    .order("event_date", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">일정 목록</h1>
          <p className="text-sm text-zinc-500">L.P.T 클럽 대진표 일정입니다.</p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/rooms/new"
            className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            + 방 만들기
          </Link>
        )}
      </div>

      {!rooms || rooms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center text-zinc-500">
          아직 만들어진 일정이 없습니다.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rooms.map((room) => (
            <li key={room.id} className="relative">
              <Link
                href={`/rooms/${room.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow"
              >
                <div className="flex items-center justify-between gap-2 pr-24 sm:pr-28">
                  <h2 className="min-w-0 truncate font-semibold text-zinc-900">{room.title}</h2>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {TEMPLATE_LABEL[room.template] ?? room.template}
                  </span>
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  {room.event_date} · {room.location} ({room.is_indoor ? "실내" : "실외"})
                </div>
                <div className="mt-2 text-xs text-zinc-400">
                  상태: {room.status === "published" ? "대진표 확정" : room.status === "ready" ? "구성 완료" : "준비 중"}
                </div>
              </Link>
              {isAdmin && (
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <Link
                    href={`/admin/rooms/${room.id}/edit`}
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 hover:border-emerald-300 hover:text-emerald-700"
                  >
                    수정
                  </Link>
                  <DeleteRoomButton roomId={room.id} roomTitle={room.title} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
