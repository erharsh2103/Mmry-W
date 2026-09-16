import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/AuthForm";
import { AuthLayout } from "@/components/forms/AuthLayout";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthLayout>
      <AuthForm mode="register" />
    </AuthLayout>
  );
}
