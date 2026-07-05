"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRoomClosed } from "@/lib/rooms/actions";

export function CloseRoomButton({
  roomId,
  roomTitle,
  isClosed,
}: {
  roomId: string;
  roomTitle: string;
  isClosed: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const confirmMessage = isClosed
          ? `"${roomTitle}" 방을 다시 열려있는 상태로 되돌리시겠습니까?`
          : `"${roomTitle}" 방을 종료 처리하시겠습니까?`;
        if (!confirm(confirmMessage)) return;
        startTransition(async () => {
          const result = await setRoomClosed(roomId, !isClosed);
          if (!result.success) {
            alert(`처리 실패: ${result.error}`);
            return;
          }
          router.refresh();
        });
      }}
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-500 shadow-sm hover:border-amber-300 hover:text-amber-700 disabled:opacity-50"
    >
      {isPending ? "처리 중..." : isClosed ? "다시 열기" : "종료 처리"}
    </button>
  );
}
