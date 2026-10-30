"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { initialState, type ActionState } from "@/lib/action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A form wired to a Server Action that reports success and failure as a toast.
 * Hidden inputs carry ids; the database still re-checks permission.
 */
export function ActionForm({
  action,
  hidden,
  children,
  className,
  confirm,
  onDone,
}: {
  action: Action;
  hidden?: Record<string, string>;
  children: React.ReactNode | ((state: ActionState) => React.ReactNode);
  className?: string;
  /** Ask before submitting (for removals). */
  confirm?: string;
  onDone?: (state: ActionState) => void;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const last = useRef<ActionState>(initialState);

  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
    if (state.ok) onDone?.(state);
  }, [state, onDone]);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {typeof children === "function" ? children(state) : children}
    </form>
  );
}
