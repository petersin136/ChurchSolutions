"use client";

import { type ReactNode, useEffect } from "react";
import { PcToastProvider } from "@/components/ui/PcToastProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppDataProvider } from "@/contexts/AppDataContext";

/** 프로덕션 빌드 후 등록된 SW가 dev의 다른 청크 경로를 깨뜨리는 것을 방지 */
function DevUnregisterServiceWorkers() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    void (async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if (typeof caches !== "undefined" && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    })();
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppDataProvider>
        <PcToastProvider>
          <DevUnregisterServiceWorkers />
          {children}
        </PcToastProvider>
      </AppDataProvider>
    </AuthProvider>
  );
}
