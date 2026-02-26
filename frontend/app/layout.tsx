"use client";

import "./globals.css";
import type { ReactNode } from "react";
import { StarknetProvider } from "../lib/starknet-provider";
import { Navbar } from "../components/Navbar";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-zinc-950 text-slate-50 min-h-screen flex flex-col">
        <StarknetProvider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
        </StarknetProvider>
      </body>
    </html>
  );
}
