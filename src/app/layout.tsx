import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LexOS — AI 규제 자동 대응 플랫폼",
  description:
    "AI기본법 30초 진단. 회사 프로필 또는 GitHub URL → 9개 의무 자동 매핑.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-slate-900">
        <TopNav />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto w-full max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center font-bold text-sm text-white shadow-sm shadow-indigo-300/40">
            L
          </div>
          <span className="font-semibold tracking-tight text-slate-900 group-hover:text-indigo-600 transition">
            LexOS
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            · AI기본법 컴플라이언스
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/dashboard" label="대시보드" />
          <NavLink href="/scan" label="코드 스캔" />
          <NavLink href="/" label="회사 진단" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
    >
      {label}
    </Link>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/40 mt-12 py-6 text-center text-xs text-slate-400">
      © {new Date().getFullYear()} LexOS · 본 도구의 결과는 자동 추론이며 법적
      자문이 아닙니다.
    </footer>
  );
}
