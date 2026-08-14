"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { adminLogin, type AdminLoginState } from "@/app/admin/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-teal px-4 py-2.5 font-cond text-base font-semibold uppercase tracking-wide text-white transition-opacity disabled:opacity-60"
    >
      {pending ? "Checking..." : "Sign in"}
    </button>
  );
}

export function AdminLoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<AdminLoginState, FormData>(adminLogin, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 p-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5">
        <span className="font-cond text-sm font-semibold uppercase tracking-widest text-text-muted">
          Code
        </span>
        <input
          type="password"
          name="password"
          // It's a numeric PIN, so ask phones for the number pad.
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          required
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-base tracking-[0.4em] text-text outline-none focus:border-teal"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-down">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
