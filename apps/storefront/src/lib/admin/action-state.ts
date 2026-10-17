export type FieldErrors = Record<string, string | undefined>

/**
 * Serialisable state returned by server actions that integrate with
 * `useActionState`. On a recoverable failure the action returns `{ ok: false,
 * message, errors, values }` so the client can re-render preserved input values
 * and field-level validation messages instead of losing the operator's input.
 * On success the action redirects (no state is needed by the form).
 */
export interface ActionState {
  ok: boolean
  message?: string
  errors?: FieldErrors
  values?: Record<string, string>
}

/** True when nothing is pending and no failure has been reported. */
export function isActionPending(state: ActionState): boolean {
  return !state.ok
}

/** Collect the string fields of a submitted form so they survive a retry. */
export function collectFormValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [name, raw] of formData.entries()) {
    if (typeof raw === "string") values[name] = raw
  }
  return values
}

/** Merge server-normalised defaults with operator-entered (preserved) values. */
export function fieldValue(
  values: Record<string, string> | undefined,
  initial: string | undefined,
  name: string,
): string | undefined {
  return values?.[name] ?? initial ?? ""
}