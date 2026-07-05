import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminAuthenticated } from "@/lib/auth/session";
import { DeleteRoomButton } from "@/components/rooms/delete-room-button";
import { CloseRoomButton } from "@/components/rooms/close-room-button";
import { TEMPLATE_LABEL } from "@/lib/rooms/templates";
import type { Database } from "@/lib/supabase/types";

type Room = Pick<
  Database["public"]["Tables"]["rooms"]["Row"],
  "id" | "title" | "template" | "event_date" | "location" | "is_indoor" | "status" | "is_closed"
> & { participantCount: number };

function RoomCard({ room, isAdmin }: { room: Room; isAdmin: boolean }) {
  return (
    <li className="relative">
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
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span>
            상태:{" "}
            {room.is_closed
              ? "종료"
              : room.status === "published"
                ? "대진표 확정"
                : room.status === "ready"
                  ? "구성 완료"
                  : "준비 중"}
          </span>
          <span
            className={
              room.participantCount === 0
                ? "rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-600"
                : "rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-500"
            }
          >
            {room.participantCount === 0 ? "선수등록 X" : `선수등록 ${room.participantCount}명`}
          </span>
        </div>
      </Link>
      {isAdmin && (
        <div className="absolute right-4 top-11 flex items-center gap-2">
          <Link
            href={`/admin/rooms/${room.id}/edit`}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 hover:border-emerald-300 hover:text-emerald-700"
          >
            수정
          </Link>
          <CloseRoomButton roomId={room.id} roomTitle={room.title} isClosed={room.is_closed} />
          <DeleteRoomButton roomId={room.id} roomTitle={room.title} />
        </div>
      )}
    </li>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const isAdmin = await isAdminAuthenticated();

  const { data: roomsData } = await supabase
    .from("rooms")
    .select(
      "id, title, template, event_date, location, is_indoor, status, is_closed, room_participants(count)"
    )
    .order("event_date", { ascending: false });

  const rooms: Room[] = (roomsData ?? []).map(({ room_participants, ...room }) => ({
    ...room,
    participantCount: room_participants?.[0]?.count ?? 0,
  }));

  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  const openRooms = rooms
    .filter((room) => !room.is_closed && room.event_date >= todayStr)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const closedRooms = rooms
    .filter((room) => room.is_closed || room.event_date < todayStr)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

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

      {rooms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center text-zinc-500">
          아직 만들어진 일정이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-zinc-600">
              현재 열려있는 방 {openRooms.length > 0 && `(${openRooms.length})`}
            </h2>
            {openRooms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500">
                열려있는 일정이 없습니다.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {openRooms.map((room) => (
                  <RoomCard key={room.id} room={room} isAdmin={isAdmin} />
                ))}
              </ul>
            )}
          </section>

          {closedRooms.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-zinc-600">
                종료된 방 ({closedRooms.length})
              </h2>
              <ul className="flex flex-col gap-3">
                {closedRooms.map((room) => (
                  <RoomCard key={room.id} room={room} isAdmin={isAdmin} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
