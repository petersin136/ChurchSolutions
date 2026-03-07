"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div suppressHydrationWarning>
      <AuthProvider>{children}</AuthProvider>
    </div>
  );
}
