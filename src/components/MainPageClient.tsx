"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import dynamic from "next/dynamic";

const SuperPlanner = dynamic(() => import("@/components/SuperPlanner"), { ssr: false });

export default function MainPageClient() {
  const { user, churchId, loading } = useAuth();
  const router = useRouter();
  console.log("[MainPage] loading:", loading, "user:", !!user, "churchId:", churchId);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user || !churchId) {
    return <div style={{ minHeight: "100vh" }} />;
  }

  return <SuperPlanner />;
}
