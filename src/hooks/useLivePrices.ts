import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";
import {
  dateOnlyFromTimestamp,
  mergeLivePriceIntoHistory,
  type LivePrice,
} from "@/lib/livePrices";
import type { DailyPrice, Security } from "@/models/Security";

const UNAVAILABLE_AFTER_MS = 30_000;

function getUsableJwt() {
  const token = localStorage.getItem("jwt");
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
      (character) => character.charCodeAt(0),
    );
    const claims: { exp?: unknown } = JSON.parse(new TextDecoder().decode(bytes));
    return typeof claims.exp !== "number" || claims.exp > Date.now() / 1000
      ? token
      : null;
  } catch {
    return null;
  }
}

export function useLivePrices({
  security,
  securityId,
  setGraphHistory,
}: {
  security: Security | null;
  securityId: number;
  setGraphHistory: Dispatch<SetStateAction<DailyPrice[]>>;
}) {
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveTimestamp, setLiveTimestamp] = useState<string | null>(null);
  const [liveUpdatesUnavailable, setLiveUpdatesUnavailable] = useState(false);
  const unavailableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLivePrice(null);
    setLiveTimestamp(null);
  }, [securityId]);

  useEffect(() => {
    if (!security) return;

    const symbol = security.symbol;
    const symbols = [symbol];
    const normalizedSymbol = symbol.toUpperCase();
    let disposed = false;
    let connection: HubConnection | null = null;
    setLiveUpdatesUnavailable(false);

    const startUnavailableTimer = () => {
      if (unavailableTimerRef.current) clearTimeout(unavailableTimerRef.current);
      unavailableTimerRef.current = setTimeout(() => {
        if (!disposed) setLiveUpdatesUnavailable(true);
      }, UNAVAILABLE_AFTER_MS);
    };

    const applyLivePrice = (update: LivePrice) => {
      if (
        disposed ||
        update.symbol.toUpperCase() !== normalizedSymbol ||
        !Number.isFinite(update.price)
      ) {
        return;
      }

      const date = dateOnlyFromTimestamp(update.timestamp);
      if (!date) return;

      setLivePrice(update.price);
      setLiveTimestamp(update.timestamp);
      setLiveUpdatesUnavailable(false);
      startUnavailableTimer();
      setGraphHistory((history) => mergeLivePriceIntoHistory(history, update, date));
    };

    const handleSnapshot = (updates: LivePrice[]) => {
      updates.forEach(applyLivePrice);
    };
    const handleBatch = (updates: LivePrice[]) => {
      const update = updates.find(
        (item) => item.symbol.toUpperCase() === normalizedSymbol,
      );
      if (update) applyLivePrice(update);
    };
    const reportConnectionError = (action: string, cause: unknown) => {
      if (disposed) return;
      setLiveUpdatesUnavailable(true);
      console.warn(`Live-price ${action} failed.`, cause);
    };
    const subscribe = async () => {
      if (disposed || connection?.state !== HubConnectionState.Connected) return;
      const snapshot = await connection.invoke<LivePrice[] | null>(
        "Subscribe",
        symbols,
      );
      if (snapshot) handleSnapshot(snapshot);
    };

    if (!getUsableJwt()) {
      setLiveUpdatesUnavailable(true);
      return () => {
        disposed = true;
      };
    }

    startUnavailableTimer();
    connection = new HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_BASE_URL}/hubs/live-prices`, {
        accessTokenFactory: () => {
          const token = getUsableJwt();
          if (!token) throw new Error("A valid sign-in token is required.");
          return token;
        },
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connection.on("PriceSnapshot", handleSnapshot);
    connection.on("PriceBatch", handleBatch);
    connection.onreconnected(() => {
      void subscribe().catch((cause) =>
        reportConnectionError("resubscription", cause),
      );
    });
    connection.onreconnecting((cause) => {
      if (cause) reportConnectionError("reconnection", cause);
      else if (!disposed) setLiveUpdatesUnavailable(true);
    });
    connection.onclose((cause) => {
      if (cause) reportConnectionError("connection", cause);
      else if (!disposed) setLiveUpdatesUnavailable(true);
    });
    void (async () => {
      try {
        await connection?.start();
        await subscribe();
      } catch (cause) {
        reportConnectionError("connection", cause);
      }
    })();

    return () => {
      disposed = true;
      if (unavailableTimerRef.current) clearTimeout(unavailableTimerRef.current);
      connection?.off("PriceSnapshot", handleSnapshot);
      connection?.off("PriceBatch", handleBatch);
      void (async () => {
        try {
          if (connection?.state === HubConnectionState.Connected) {
            await connection.invoke("Unsubscribe", symbols);
          }
        } catch (cause) {
          console.warn("Live-price unsubscription failed.", cause);
        } finally {
          try {
            await connection?.stop();
          } catch (cause) {
            console.warn("Live-price connection cleanup failed.", cause);
          }
        }
      })();
    };
  }, [security, setGraphHistory]);

  return { livePrice, liveTimestamp, liveUpdatesUnavailable };
}
