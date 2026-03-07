"use client";

import dynamic from "next/dynamic";

const RegisterForm = dynamic(() => import("@/components/auth/RegisterForm"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh" }} />,
});

export default function Page() {
  return <RegisterForm />;
}
