"use client";

import { createContext, useContext, useState } from "react";

const AppStateContext = createContext<
  | {
      isGenerating: boolean;
      setIsGenerating: (value: boolean) => void;
    }
  | undefined
>(undefined);

export const AppStateProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <AppStateContext.Provider value={{ isGenerating, setIsGenerating }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
};
