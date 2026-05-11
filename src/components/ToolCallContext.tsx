import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Which side of a tool call we're rendering. ToolDisplay reads this and
 * shows a small "Request" / "Result" pill in the header so an evaluator can
 * distinguish input cards from result cards at a glance — the underlying
 * variant is the same component for both.
 *
 * Threaded via context so individual variants don't need to learn about it.
 */
export type ToolCallKind = "request" | "result";

interface Value {
  kind?: ToolCallKind;
}

const ToolCallContext = createContext<Value>({});

export function ToolCallProvider({
  kind,
  children,
}: {
  kind: ToolCallKind;
  children: ReactNode;
}) {
  const value = useMemo<Value>(() => ({ kind }), [kind]);
  return <ToolCallContext.Provider value={value}>{children}</ToolCallContext.Provider>;
}

export function useToolCallKind(): ToolCallKind | undefined {
  return useContext(ToolCallContext).kind;
}
