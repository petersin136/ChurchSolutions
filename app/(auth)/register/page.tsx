"use client";

import dynamic from "next/dynamic";

const RegisterForm = dynamic(() => import("@/components/auth/RegisterForm"), {
  ssr: false,
});

export default function Page() {
  return <RegisterForm />;
}
