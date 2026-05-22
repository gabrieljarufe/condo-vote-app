import { HttpErrorResponse } from '@angular/common/http';

// Para HttpErrorResponse, expomos a mensagem que o backend curou (body.message via
// GlobalExceptionHandler) ou, na falta dela, a frase do próprio HttpErrorResponse
// (status + statusText) — ambas são seguras para exibir ao usuário.
// Para Error puro (programming bugs, RxJS internals, parsing errors), usamos o fallback
// curado pelo callsite — evita vazar detalhes técnicos tipo "undefined is not a function".
export function extractErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof HttpErrorResponse) {
    const body = e.error as { message?: string } | null | undefined;
    return body?.message ?? e.message;
  }
  return fallback;
}
