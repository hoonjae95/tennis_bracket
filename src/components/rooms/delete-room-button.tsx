"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRoom } from "@/lib/rooms/actions";

export function DeleteRoomButton({ roomId, roomTitle }: { roomId: string; roomTitle: string }) {
  const router = useRouter();
  const [isDeleting, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isDeleting}
      onClick={() => {
        if (!confirm(`"${roomTitle}" 방을 정말 삭제하시겠습니까?\n대진표를 포함한 모든 데이터가 삭제됩니다.`)) return;
        startTransition(async () => {
          const result = await deleteRoom(roomId);
          if (!result.success) {
            alert(`삭제 실패: ${result.error}`);
            return;
          }
          router.refresh();
        });
      }}
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-500 shadow-sm hover:border-red-300 hover:text-red-600 disabled:opacity-50"
    >
      {isDeleting ? "삭제 중..." : "삭제"}
    </button>
  );
}
