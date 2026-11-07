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
    const normalizedSymbol = symbol.toUpperCase();
    let disposed = false;
    let connection: HubConnection | null = null;

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
      const update = updates[0];
      if (update) applyLivePrice(update);
    };
    const handleBatch = (updates: LivePrice[]) => {
      const update = updates.find(
        (item) => item.symbol.toUpperCase() === normalizedSymbol,
      );
      if (update) applyLivePrice(update);
    };
    const subscribe = async () => {
      if (connection?.state === HubConnectionState.Connected) {
        await connection.invoke("Subscribe", [symbol]);
      }
    };

    startUnavailableTimer();
    connection = new HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_BASE_URL}/hubs/live-prices`, {
        accessTokenFactory: () => localStorage.getItem("jwt") ?? "",
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connection.on("PriceSnapshot", handleSnapshot);
    connection.on("PriceBatch", handleBatch);
    connection.onreconnected(() => {
      void subscribe().catch(() => undefined);
    });
    void connection
      .start()
      .then(subscribe)
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (unavailableTimerRef.current) clearTimeout(unavailableTimerRef.current);
      connection?.off("PriceSnapshot", handleSnapshot);
      connection?.off("PriceBatch", handleBatch);
      void (async () => {
        if (connection?.state === HubConnectionState.Connected) {
          await connection.invoke("Unsubscribe", [symbol]).catch(() => undefined);
        }
        await connection?.stop();
      })();
    };
  }, [security, setGraphHistory]);

  return { livePrice, liveTimestamp, liveUpdatesUnavailable };
}
