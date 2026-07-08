import { NextResponse } from "next/server";

export function apiError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}
