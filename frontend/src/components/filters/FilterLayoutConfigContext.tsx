"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import type { DashboardFilterLayoutsDocument } from "@/config/analyticsFilterLayouts";
import { getDashboardFilterLayouts } from "@/shared/api";

type Ctx = {
  doc: DashboardFilterLayoutsDocument | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const FilterLayoutConfigContext = createContext<Ctx | null>(null);

export function FilterLayoutConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { auth } = useAuth();
  const [doc, setDoc] = useState<DashboardFilterLayoutsDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!auth) {
      setDoc(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await getDashboardFilterLayouts();
      setDoc(d);
    } catch {
      setDoc(null);
      setError("No se pudieron cargar los layouts de filtros.");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = React.useMemo(
    () => ({ doc, loading, error, reload }),
    [doc, loading, error, reload],
  );

  return (
    <FilterLayoutConfigContext.Provider value={value}>
      {children}
    </FilterLayoutConfigContext.Provider>
  );
}

export function useFilterLayoutConfig(): Ctx {
  const ctx = useContext(FilterLayoutConfigContext);
  return (
    ctx ?? {
      doc: null,
      loading: false,
      error: null,
      reload: async () => {},
    }
  );
}

/**
 * Sustituye temporalmente el documento de layouts (p. ej. vista previa WYSIWYG del editor).
 */
export function FilterLayoutDocOverrideProvider({
  doc,
  children,
}: {
  doc: DashboardFilterLayoutsDocument | null;
  children: React.ReactNode;
}) {
  const parent = useFilterLayoutConfig();
  const value = React.useMemo(
    () => ({ ...parent, doc }),
    [parent, doc],
  );
  return (
    <FilterLayoutConfigContext.Provider value={value}>
      {children}
    </FilterLayoutConfigContext.Provider>
  );
}
