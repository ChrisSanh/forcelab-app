import { Suspense } from "react";
import { AuthForm } from "../AuthForm";

export const metadata = { title: "Iniciar sesión · ForceLab" };

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
