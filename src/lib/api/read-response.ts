import { NextResponse } from 'next/server';

type ReadError = { ok: false; error: string; status: number };

export function readErrorResponse(result: ReadError) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}

export function readOkResponse<T extends Record<string, unknown>>(data: T) {
  return NextResponse.json(data);
}
