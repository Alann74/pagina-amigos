import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-center text-[22px] font-medium tracking-[0.32em] pl-[0.32em]">INEDITA</p>
        <p className="label mt-2 text-center text-mute">Panel de administración</p>
        <div className="mt-14">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
