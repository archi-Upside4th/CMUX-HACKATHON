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
  title: "LexOS",
  description: "AI 기본법 컴플라이언스",
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
        <footer className="py-10 text-center text-[11px] text-slate-400 tracking-wide">
          © {new Date().getFullYear()} LexOS
        </footer>
      </body>
    </html>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-10 bg-[var(--background)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/70">
      <div className="mx-auto w-full max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <span className="grid place-items-center h-7 w-7 rounded-full bg-slate-900 text-white text-[12px] font-semibold tracking-tight">
            L
          </span>
          <span className="font-semibold tracking-tight text-slate-900">
            LexOS
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-[13px]">
          <NavLink href="/dashboard" label="대시보드" />
          <NavLink href="/scan" label="스캔" />
          <NavLink href="/" label="진단" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-full text-slate-500 hover:bg-slate-900 hover:text-white transition"
    >
      {label}
    </Link>
  );
}
