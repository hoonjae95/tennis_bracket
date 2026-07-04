import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export function SiteHeader({ isAdmin }: { isAdmin: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-emerald-700">
          <span className="text-lg">🎾</span>
          <span>L.P.T 대진표</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {isAdmin ? (
            <>
              <Link href="/admin/rooms/new" className="text-zinc-600 hover:text-emerald-700">
                방 만들기
              </Link>
              <Link href="/admin/members" className="text-zinc-600 hover:text-emerald-700">
                정회원 관리
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/admin/login"
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-white hover:bg-emerald-800"
            >
              관리자 로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
