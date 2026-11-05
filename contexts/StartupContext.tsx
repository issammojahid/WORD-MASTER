import React, { createContext, useContext } from "react";

const StartupContext = createContext(false);

export function StartupProvider({
  ready,
  children,
}: {
  ready: boolean;
  children: React.ReactNode;
}) {
  return <StartupContext.Provider value={ready}>{children}</StartupContext.Provider>;
}

export function useStartupReady(): boolean {
  return useContext(StartupContext);
}
