"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CreatingSplash } from "@/components/common/CreatingSplash";
import dynamic from "next/dynamic";

const SuperPlanner = dynamic(() => import("@/components/SuperPlanner"), { ssr: false });

export default function MainPageClient() {
  const { user, churchId, loading } = useAuth();
  const router = useRouter();
  const [graceOver, setGraceOver] = useState(false);
  console.log("[MainPage] loading:", loading, "user:", !!user, "churchId:", churchId);

  useEffect(() => {
    const timer = setTimeout(() => setGraceOver(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // 1) 비로그인 → /login
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // 2) 로그인했지만 교회 없음 → 교회 찾기 화면으로 자동 이동
  useEffect(() => {
    if (!loading && user && !churchId && graceOver) {
      router.replace("/church-search");
    }
  }, [loading, user, churchId, graceOver, router]);

  if (loading || !user) {
    return <div style={{ minHeight: "100vh", background: "#f4f4f6" }} />;
  }

  if (!churchId) {
    return <CreatingSplash />;
  }

  return <SuperPlanner />;
}
