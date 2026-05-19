import { HttpErrorResponse } from '@angular/common/http';

export function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof HttpErrorResponse) {
    const body = e.error as { message?: string } | null | undefined;
    return body?.message ?? e.message;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return fallback;
}
