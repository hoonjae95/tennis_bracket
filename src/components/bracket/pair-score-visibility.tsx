"use client";

import { createContext, useContext, useState } from "react";

const PairScoreVisibilityContext = createContext<boolean>(false);

export function PairScoreVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  return (
    <PairScoreVisibilityContext.Provider value={visible}>
      {children}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-500 shadow-sm hover:border-zinc-400"
        >
          {visible ? "페어 점수 숨기기" : "페어 점수 보기 (관리자 전용)"}
        </button>
      </div>
    </PairScoreVisibilityContext.Provider>
  );
}

export function VsOrPairScore({ t1sum, t2sum }: { t1sum: number; t2sum: number }) {
  const visible = useContext(PairScoreVisibilityContext);
  return <>{visible ? `페어 점수 ${t1sum} : ${t2sum}` : "vs"}</>;
}
