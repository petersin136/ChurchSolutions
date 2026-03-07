"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import dynamic from "next/dynamic";

const SuperPlanner = dynamic(() => import("@/components/SuperPlanner"), { ssr: false });

export default function MainPage() {
  const { user, churchId, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log("[MainPage] 상태:", { user: !!user, churchId, loading });
    if (!loading && !user) {
      console.log("[MainPage] 로그인 안됨, /login으로 이동");
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: "18px" }}>
        로딩 중...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: "18px" }}>
        로그인 페이지로 이동 중...
      </div>
    );
  }

  if (!churchId) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: "18px" }}>
        교회 정보 로딩 중...
      </div>
    );
  }

  return <SuperPlanner />;
}
