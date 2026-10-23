"use client"

import * as React from "react"
import { Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login, type LoginState } from "./actions"

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = React.useActionState<LoginState, FormData>(login, {})
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary/12 text-primary">
          <Shield className="size-5" />
        </div>
        <CardTitle className="text-lg">SentinelAI</CardTitle>
        <CardDescription>Ingresá la contraseña del panel para continuar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "login-error" : undefined}
            />
            {state.error && (
              <p id="login-error" role="alert" className="text-sm text-critical-foreground">
                {state.error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
