import { Suspense } from "react";
import { AuthForm } from "../AuthForm";

export const metadata = { title: "Crear cuenta · ForceLab" };

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
