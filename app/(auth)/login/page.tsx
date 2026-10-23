import type { Metadata } from "next"
import { safeNext } from "@/lib/safe-next"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Ingresar — SentinelAI" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <LoginForm next={safeNext(next)} />
    </main>
  )
}
