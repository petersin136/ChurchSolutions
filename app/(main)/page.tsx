"use client";

import dynamic from "next/dynamic";

const MainPageClient = dynamic(() => import("@/components/MainPageClient"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh" }} />,
});

export default function Home() {
  return <MainPageClient />;
}
