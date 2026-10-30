"use client";

import { useActionState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { initialState, type ActionState } from "@/lib/action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A form wired to a Server Action that reports success and failure as a toast.
 * The toast fires as soon as the action resolves, so it still shows when the
 * form itself disappears afterwards (e.g. archiving the row it sits in).
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
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  const withFeedback = useCallback(
    async (prev: ActionState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.error) toast.error(result.error);
      else if (result.ok && result.message) toast.success(result.message);
      if (result.ok) onDoneRef.current?.(result);
      return result;
    },
    [action],
  );
  const [state, formAction] = useActionState(withFeedback, initialState);

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
