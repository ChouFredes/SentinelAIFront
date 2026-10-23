import { NextResponse } from "next/server"

/** Error con status HTTP, como los que devuelve el backend (404/409/422/503…). */
export class BackendError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail)
  }
}

export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn())
  } catch (e) {
    if (e instanceof BackendError) {
      return NextResponse.json({ detail: e.detail }, { status: e.status })
    }
    console.error("[bff]", e)
    return NextResponse.json({ detail: "Error interno del panel" }, { status: 500 })
  }
}
