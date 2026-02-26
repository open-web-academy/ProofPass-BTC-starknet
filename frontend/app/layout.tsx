"use client";

import "./globals.css";
import type { ReactNode } from "react";
import { StarknetProvider } from "../lib/starknet-provider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StarknetProvider>{children}</StarknetProvider>
      </body>
    </html>
  );
}

