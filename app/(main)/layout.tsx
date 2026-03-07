"use client";

import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div suppressHydrationWarning>
      <Providers>{children}</Providers>
    </div>
  );
}
