"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { safeNext } from "@/lib/safe-next"
import { getEnv } from "@/lib/server/env"
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken, safeEqual } from "@/lib/session"

export interface LoginState {
  error?: string
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  let env
  try {
    env = getEnv()
  } catch (e) {
    console.error("[login]", e)
    return { error: "El servidor no está configurado correctamente (variables de entorno)." }
  }

  const password = String(formData.get("password") ?? "")
  if (!(await safeEqual(password, env.panelPassword))) {
    await new Promise((r) => setTimeout(r, 600)) // frena fuerza bruta barata
    return { error: "Contraseña incorrecta." }
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, await createSessionToken(env.sessionSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
  redirect(safeNext(formData.get("next")))
}

export async function logout() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect("/login")
}
