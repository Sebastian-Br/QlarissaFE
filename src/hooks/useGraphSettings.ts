import { useCallback, useEffect, useRef, useState } from "react";
import { getGraphSettings, updateGraphSetting } from "@/api/settingsApi";
import {
  GraphDataSource,
  type Bounds,
  type GraphSettings,
} from "@/models/GraphSettings";

function defaultSettings(dataSource: GraphDataSource): GraphSettings {
  if (dataSource === GraphDataSource.Security) {
    return {
      dataSource,
      plotType: 0,
      bounds: null,
      asTotalReturn: false,
    };
  }
  return {
    dataSource,
    plotType: 0,
    bounds: null,
    isSynchronizedWithSecurityGraph: true,
  };
}

function withBounds(settings: GraphSettings, bounds: Bounds | null): GraphSettings {
  if (settings.dataSource === GraphDataSource.Security)
    return { ...settings, bounds };
  return { ...settings, bounds };
}

export function useGraphSettings(dataSource: GraphDataSource): {
  settings: GraphSettings;
  ready: boolean;
  error: boolean;
  updateBounds: (bounds: Bounds | null) => void;
} {
  const [settings, setSettings] = useState(() => defaultSettings(dataSource));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const settingsRef = useRef(settings);
  const pendingBounds = useRef<Bounds | null | undefined>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback((next: GraphSettings) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void updateGraphSetting(next).catch((error: unknown) => {
        console.error("Unable to save typed graph settings.", error);
      });
    }, 500);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setReady(false);
    setError(false);
    void getGraphSettings(controller.signal)
      .then((allSettings) => {
        if (controller.signal.aborted) return;
        const remote = allSettings.find(
          (setting) => setting.dataSource === dataSource,
        );
        const merged = remote ?? defaultSettings(dataSource);
        const hydrated = pendingBounds.current === undefined
          ? merged
          : withBounds(merged, pendingBounds.current);
        settingsRef.current = hydrated;
        setSettings(hydrated);
        setReady(true);
        if (pendingBounds.current !== undefined) scheduleSave(hydrated);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Unable to load typed graph settings.", error);
        setError(true);
      });

    return () => {
      controller.abort();
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void updateGraphSetting(settingsRef.current).catch((error: unknown) => {
          console.error("Unable to save typed graph settings.", error);
        });
      }
    };
  }, [dataSource, scheduleSave]);

  const updateBounds = useCallback(
    (bounds: Bounds | null) => {
      pendingBounds.current = bounds;
      const next = withBounds(settingsRef.current, bounds);
      settingsRef.current = next;
      setSettings(next);
      if (ready) scheduleSave(next);
    },
    [ready, scheduleSave],
  );

  return { settings, ready, error, updateBounds };
}
