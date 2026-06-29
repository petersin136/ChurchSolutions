"use client";

import dynamic from "next/dynamic";

const ForgotPasswordForm = dynamic(() => import("@/components/auth/ForgotPasswordForm"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh" }} />,
});

export default function Page() {
  return <ForgotPasswordForm />;
}
