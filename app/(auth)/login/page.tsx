"use client";

import dynamic from "next/dynamic";

const LoginForm = dynamic(() => import("@/components/auth/LoginForm"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh" }} />,
});

export default function Page() {
  return <LoginForm />;
}
