import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import CoachChat from "@/components/CoachChat";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Fitness Coach",
  description: "Personal training dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface text-slate-200 antialiased">
        <Providers>
          {/* Header */}
          <header className="border-b border-surface-border bg-surface-card/60 backdrop-blur sticky top-0 z-30">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">💪</span>
              <div>
                <div className="font-bold text-white text-base leading-tight">
                  Fitness Coach
                </div>
                <div className="text-xs text-slate-500 leading-tight">
                  Personal training dashboard
                </div>
              </div>
            </div>
          </header>

          {/* Main */}
          <main className="max-w-5xl mx-auto px-4 py-5">
            <Nav />
            {children}
          </main>

          <footer className="border-t border-surface-border mt-12 py-4 text-center text-xs text-slate-600">
            Fitness Coach Dashboard
          </footer>

          <CoachChat />
        </Providers>
      </body>
    </html>
  );
}
