import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

export interface ToolPermissionHandlers {
  /** Called when the user clicks Allow on a pending-permission tool call. */
  onAllow?: (toolCallId: string) => void;
  /** Called when the user clicks Deny on a pending-permission tool call. */
  onDeny?: (toolCallId: string) => void;
}

const DEFAULT: ToolPermissionHandlers = {};

const ToolPermissionContext = createContext<ToolPermissionHandlers>(DEFAULT);

export interface ToolPermissionProviderProps extends ToolPermissionHandlers {
  children: ReactNode;
}

/** Wraps a subtree with onAllow / onDeny handlers. `<ToolDisplay>` reads them
 *  from context to render the Allow / Deny actions only when the host has
 *  actually wired them up. */
export function ToolPermissionProvider({
  onAllow,
  onDeny,
  children,
}: ToolPermissionProviderProps) {
  const value = useMemo<ToolPermissionHandlers>(
    () => ({ onAllow, onDeny }),
    [onAllow, onDeny]
  );
  return (
    <ToolPermissionContext.Provider value={value}>
      {children}
    </ToolPermissionContext.Provider>
  );
}

export function useToolPermissionHandlers(): ToolPermissionHandlers {
  return useContext(ToolPermissionContext);
}
