"use client";

import { createContext, useContext, useState } from "react";

const BracketNotesVisibilityContext = createContext<boolean>(false);

export function BracketNotesVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  return (
    <BracketNotesVisibilityContext.Provider value={visible}>
      {children}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-500 shadow-sm hover:border-zinc-400"
        >
          {visible ? "대진표 유의사항 숨기기" : "대진표 유의사항 보기"}
        </button>
      </div>
    </BracketNotesVisibilityContext.Provider>
  );
}

export function useBracketNotesVisible(): boolean {
  return useContext(BracketNotesVisibilityContext);
}

export function BracketNote({ note }: { note: { names: string[]; consecutiveCount: number }[] }) {
  const visible = useContext(BracketNotesVisibilityContext);
  if (!visible) return null;
  return (
    <p className="mt-1 text-right text-xs text-amber-600">
      비고:{" "}
      {note.map((group, i) => (
        <span key={group.consecutiveCount}>
          {i > 0 && " / "}
          {group.names.join(", ")}님이 <strong className="font-bold">{group.consecutiveCount}</strong>경기 연속
          진행중입니다!
        </span>
      ))}
    </p>
  );
}
