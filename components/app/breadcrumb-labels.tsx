"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Maps a crumb href (e.g. "/integrated-brand-brain/roadmap/questionnaire/company") to a
// human-friendly label. Pages register these for dynamic segments whose label
// can only be resolved from server data (a section title, agent name, …).
type BreadcrumbLabelMap = Record<string, string>;

const EMPTY_LABELS: BreadcrumbLabelMap = {};

type BreadcrumbLabelsContextValue = {
  labels: BreadcrumbLabelMap;
  registerLabels: (entries: BreadcrumbLabelMap) => void;
  unregisterLabels: (hrefs: string[]) => void;
};

const BreadcrumbLabelsContext =
  createContext<BreadcrumbLabelsContextValue | null>(null);

export function BreadcrumbLabelsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [labels, setLabels] = useState<BreadcrumbLabelMap>(EMPTY_LABELS);

  const registerLabels = useCallback((entries: BreadcrumbLabelMap) => {
    setLabels((current) => ({ ...current, ...entries }));
  }, []);

  const unregisterLabels = useCallback((hrefs: string[]) => {
    setLabels((current) => {
      const next = { ...current };
      for (const href of hrefs) delete next[href];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ labels, registerLabels, unregisterLabels }),
    [labels, registerLabels, unregisterLabels],
  );

  return (
    <BreadcrumbLabelsContext.Provider value={value}>
      {children}
    </BreadcrumbLabelsContext.Provider>
  );
}

export function useBreadcrumbLabels(): BreadcrumbLabelMap {
  return useContext(BreadcrumbLabelsContext)?.labels ?? EMPTY_LABELS;
}

/**
 * Registers server-resolved breadcrumb labels for the current route while it is
 * mounted. Renders nothing — drop it into a (server) page that owns a dynamic
 * segment, e.g.
 *   <SetBreadcrumbLabels labels={{ [`/agents/${key}`]: agent.name }} />
 */
export function SetBreadcrumbLabels({
  labels,
}: {
  labels: BreadcrumbLabelMap;
}) {
  const context = useContext(BreadcrumbLabelsContext);
  const register = context?.registerLabels;
  const unregister = context?.unregisterLabels;
  // Stable across renders unless the label values actually change.
  const serialized = JSON.stringify(labels);

  useEffect(() => {
    if (!register || !unregister) return;
    const entries = JSON.parse(serialized) as BreadcrumbLabelMap;
    register(entries);
    return () => unregister(Object.keys(entries));
  }, [register, unregister, serialized]);

  return null;
}
