"use client";

import {
  Lock,
  MoveDown,
  MoveUp,
  RefreshCw,
  Unlock,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";
import {
  accessTokenSubject,
  AUTH_CHANGED_EVENT,
  getAccessTokenForSignalR,
} from "@/api/authenticatedFetch";
import MovementSignal from "@/components/MovementSignal";
import {
  getPinnedWatchlists,
  updatePinnedWatchlistOrder,
} from "@/api/watchlistApi";
import type { LivePrice } from "@/lib/livePrices";
import { formatWatchlistPrice } from "@/lib/currency";
import {
  getPinnedWatchlistSymbols,
  movePinnedWatchlist,
  rankWatchlistMovers,
  sortPinnedWatchlists,
  type WatchlistMover,
} from "@/lib/pinnedWatchlists";
import type { Watchlist } from "@/models/Watchlist";

const REFRESH_INTERVAL_MS = 60_000;
const MOVERS_PER_DIRECTION = 5;
const STACK_MAX_HEIGHT_PX = 576;
const MIN_COLLAPSED_CARD_HEIGHT_PX = 86;
const CARD_GAP_PX = 8;
const CONNECTION_RETRY_MS = 5_000;
const MAX_VISIBLE_WATCHLISTS = Math.floor(
  (STACK_MAX_HEIGHT_PX + CARD_GAP_PX) /
    (MIN_COLLAPSED_CARD_HEIGHT_PX + CARD_GAP_PX),
);

function MoverRow({ mover }: { mover: WatchlistMover }) {
  return (
    <div onClick={(event) => event.stopPropagation()} className="pinned-watchlist-row flex items-center justify-between gap-4 rounded-xl px-2 py-2.5 hover:bg-slate-800/50">
      <p title={mover.name} className="min-w-0 truncate text-base font-medium text-slate-100">{mover.name}</p>
      <div className="flex shrink-0 items-center gap-4 whitespace-nowrap text-right">
        <span className="text-sm text-slate-300">{formatWatchlistPrice(mover.price, mover.currencySymbol)}</span>
        <MovementSignal mover={mover} />
      </div>
    </div>
  );
}

function sameWatchlists(left: Watchlist[], right: Watchlist[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((watchlist, index) => {
    const other = right[index];
    return (
      watchlist.id === other.id &&
      watchlist.name === other.name &&
      watchlist.pinPosition === other.pinPosition &&
      watchlist.trackedChangeDurationTradingDays === other.trackedChangeDurationTradingDays &&
      watchlist.watchedSecurities.length === other.watchedSecurities.length &&
      watchlist.watchedSecurities.every((security, securityIndex) => {
        const otherSecurity = other.watchedSecurities[securityIndex];
        return (
          security.securityId === otherSecurity.securityId &&
          security.name === otherSecurity.name &&
          security.symbol === otherSecurity.symbol &&
          security.currencySymbol === otherSecurity.currencySymbol &&
          security.previousClosePrice === otherSecurity.previousClosePrice
        );
      })
    );
  });
}

export default function PinnedWatchlistsStack() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(
    () => new Map(),
  );
  const [loadError, setLoadError] = useState(false);
  const [orderError, setOrderError] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [priceConnectionError, setPriceConnectionError] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [keyboardFocusedId, setKeyboardFocusedId] = useState<number | null>(null);
  const [lockedId, setLockedId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const orderSaveInProgress = useRef(false);
  const desiredSymbolsRef = useRef<string[]>([]);
  const reconcileRef = useRef<(() => void) | null>(null);
  const symbols = useMemo(
    () => getPinnedWatchlistSymbols(watchlists),
    [watchlists],
  );
  const symbolsKey = symbols.join("\u0000");
  const visibleWatchlists = watchlists.slice(0, MAX_VISIBLE_WATCHLISTS);
  const hiddenCount = watchlists.length - visibleWatchlists.length;

  useEffect(() => {
    let active = true;
    let requestId = 0;
    let requestController: AbortController | null = null;
    let activeSubject = accessTokenSubject(localStorage.getItem("jwt") ?? "");
    const refresh = async () => {
      requestController?.abort();
      const currentRequestId = ++requestId;
      const controller = new AbortController();
      requestController = controller;
      const expectedSubject = accessTokenSubject(localStorage.getItem("jwt") ?? "");
      try {
        const nextWatchlists = sortPinnedWatchlists(
          await getPinnedWatchlists(controller.signal, expectedSubject ?? undefined),
        );
        if (!active || currentRequestId !== requestId) return;
        if (!orderSaveInProgress.current) {
          setWatchlists((current) =>
            sameWatchlists(current, nextWatchlists) ? current : nextWatchlists,
          );
        }
        setLoadError(false);
      } catch (error) {
        if (
          !active ||
          currentRequestId !== requestId ||
          (error instanceof DOMException && error.name === "AbortError")
        )
          return;
        setLoadError(true);
        console.warn("Unable to refresh pinned watchlists.", error);
      } finally {
        if (currentRequestId === requestId) requestController = null;
      }
    };

    const handleAuthChanged = () => {
      const nextSubject = accessTokenSubject(localStorage.getItem("jwt") ?? "");
      if (nextSubject === activeSubject) return;
      activeSubject = nextSubject;
      requestController?.abort();
      setWatchlists([]);
      setLivePrices(new Map());
      setLoadError(false);
      setOrderError(false);
      setLockedId(null);
      setKeyboardFocusedId(null);
      void refresh();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "jwt") handleAuthChanged();
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      requestController?.abort();
      window.clearInterval(timer);
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    desiredSymbolsRef.current = symbols;
    reconcileRef.current?.();
    const wanted = new Set(symbols);
    setLivePrices((current) => {
      const retained = new Map(
        [...current].filter(([symbol]) => wanted.has(symbol)),
      );
      return retained.size === current.size ? current : retained;
    });
  }, [symbolsKey, symbols]);

  useEffect(() => {
    let active = true;
    let connection: HubConnection | null = null;
    const subscribedSymbols = new Set<string>();
    let reconcileQueue = Promise.resolve();

    const applyUpdates = (updates: LivePrice[]) => {
      if (!active) return;
      setLivePrices((current) => {
        const next = new Map(current);
        for (const update of updates) {
          const symbol = update.symbol?.trim().toUpperCase();
          if (symbol && Number.isFinite(update.price) && update.price > 0)
            next.set(symbol, update);
        }
        return next;
      });
      setPriceConnectionError(false);
    };

    const reconcile = () => {
      reconcileQueue = reconcileQueue.then(async () => {
        if (!active || connection?.state !== HubConnectionState.Connected) return;
        const wanted = new Set(desiredSymbolsRef.current);
        const removed = [...subscribedSymbols].filter((symbol) => !wanted.has(symbol));
        if (removed.length) {
          await connection.invoke("Unsubscribe", removed);
          removed.forEach((symbol) => subscribedSymbols.delete(symbol));
        }

        const added = [...wanted].filter((symbol) => !subscribedSymbols.has(symbol));
        if (added.length) {
          const snapshot = await connection.invoke<LivePrice[] | null>(
            "Subscribe",
            added,
          );
          added.forEach((symbol) => subscribedSymbols.add(symbol));
          if (snapshot) applyUpdates(snapshot);
        }
      }).catch((error: unknown) => {
        if (!active) return;
        setPriceConnectionError(true);
        console.warn("Unable to update live watchlist subscriptions.", error);
      });
    };
    reconcileRef.current = reconcile;

    const receivePrices = (updates: LivePrice[]) => applyUpdates(updates);
    connection = new HubConnectionBuilder()
      .withUrl(`${process.env.NEXT_PUBLIC_API_BASE_URL}/hubs/live-prices`, {
        accessTokenFactory: getAccessTokenForSignalR,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connection.on("PriceSnapshot", receivePrices);
    connection.on("PriceBatch", receivePrices);
    connection.onreconnected(() => {
      subscribedSymbols.clear();
      reconcile();
    });
    connection.onreconnecting(() => setPriceConnectionError(true));
    const currentConnection = connection;
    let startPromise: Promise<void> | null = null;
    let startTimer: number;
    const startConnection = () => {
      if (!active) return;
      startPromise = currentConnection.start();
      void startPromise.then(reconcile).catch((error: unknown) => {
        if (!active) return;
        setPriceConnectionError(true);
        console.warn("Unable to connect to live watchlist prices.", error);
        startTimer = window.setTimeout(startConnection, CONNECTION_RETRY_MS);
      });
    };
    currentConnection.onclose(() => {
      if (!active) return;
      setPriceConnectionError(true);
      startTimer = window.setTimeout(startConnection, CONNECTION_RETRY_MS);
    });
    startTimer = window.setTimeout(startConnection, 0);

    return () => {
      active = false;
      window.clearTimeout(startTimer);
      reconcileRef.current = null;
      currentConnection.off("PriceSnapshot", receivePrices);
      currentConnection.off("PriceBatch", receivePrices);
      if (startPromise) {
        void startPromise.catch(() => undefined).then(() => currentConnection.stop())
          .catch((error: unknown) => console.warn("Unable to stop live watchlist prices.", error));
      }
    };
  }, []);

  const saveOrder = useCallback(async (nextWatchlists: Watchlist[]) => {
    const previousWatchlists = watchlists;
    if (orderSaveInProgress.current || sameWatchlists(previousWatchlists, nextWatchlists))
      return;
    const expectedSubject = accessTokenSubject(localStorage.getItem("jwt") ?? "");
    orderSaveInProgress.current = true;
    setSavingOrder(true);
    setOrderError(false);
    setWatchlists(nextWatchlists);
    try {
      await updatePinnedWatchlistOrder(
        nextWatchlists.map(({ id }) => id),
        expectedSubject ?? undefined,
      );
    } catch (error) {
      const currentSubject = accessTokenSubject(localStorage.getItem("jwt") ?? "");
      if (currentSubject === expectedSubject) {
        setWatchlists(previousWatchlists);
        setOrderError(true);
      }
      console.warn("Unable to save pinned watchlist order.", error);
    } finally {
      orderSaveInProgress.current = false;
      setSavingOrder(false);
    }
  }, [watchlists]);

  const moveWatchlist = useCallback(
    (watchlistId: number, targetIndex: number) => {
      const next = movePinnedWatchlist(watchlists, watchlistId, targetIndex);
      void saveOrder(next);
    },
    [saveOrder, watchlists],
  );

  return (
    <section
      aria-label="Pinned watchlists"
      className="flex min-h-0 flex-col gap-2"
    >
      {loadError && watchlists.length === 0 && (
        <p className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-200" role="alert">
          Pinned watchlists are unavailable. Try again shortly.
        </p>
      )}
      {loadError && watchlists.length > 0 && (
        <p className="sr-only" role="status">Pinned watchlist refresh failed; showing the last loaded data.</p>
      )}
      {orderError && (
        <p className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200" role="alert">
          Watchlist order was not saved. Your previous order has been restored.
        </p>
      )}
      {savingOrder && (
        <p className="sr-only" role="status">Saving pinned watchlist order.</p>
      )}
      {priceConnectionError && (
        <p className="sr-only" role="status">Live watchlist prices are reconnecting.</p>
      )}
      {hiddenCount > 0 && (
        <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100" role="status">
          {hiddenCount} pinned {hiddenCount === 1 ? "watchlist cannot" : "watchlists cannot"} fit here. Unpin a list to display all.
        </p>
      )}
      <div className="flex h-[36rem] max-h-[36rem] min-h-0 flex-col gap-2 overflow-visible">
        {visibleWatchlists.map((watchlist, index) => {
          const { winners, losers, validPriceCount } = rankWatchlistMovers(
            watchlist,
            livePrices,
            MOVERS_PER_DIRECTION,
          );
          const strongestWinner = winners[0];
          const strongestLoser = losers[losers.length - 1];
          const expanded = draggedId === null &&
            (lockedId ?? hoveredId ?? keyboardFocusedId) === watchlist.id;

          return (
            <article
              key={watchlist.id}
              tabIndex={0}
              aria-label={watchlist.name}
              title={visibleWatchlists.length > 1 ? "Drag to reorder; use the move buttons for keyboard reordering." : undefined}
              draggable={!savingOrder && visibleWatchlists.length > 1}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(watchlist.id));
                setDraggedId(watchlist.id);
              }}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                setLockedId((current) => current === watchlist.id ? null : watchlist.id);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                event.preventDefault();
                setLockedId((current) => current === watchlist.id ? null : watchlist.id);
              }}
              onMouseDown={() => setKeyboardFocusedId(null)}
              onFocus={(event) => {
                if ((event.target as HTMLElement).matches(":focus-visible"))
                  setKeyboardFocusedId(watchlist.id);
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                  setKeyboardFocusedId(null);
              }}
              onMouseEnter={() => setHoveredId(watchlist.id)}
              onMouseLeave={() => setHoveredId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedId !== null) moveWatchlist(draggedId, index);
                setDraggedId(null);
              }}
              onDragEnd={() => setDraggedId(null)}
              style={{ minHeight: MIN_COLLAPSED_CARD_HEIGHT_PX }}
              className={`pinned-watchlist-card group relative flex-[1_1_0%] overflow-hidden rounded-2xl border border-sky-200/10 bg-slate-900/60 shadow-xl shadow-slate-950/20 backdrop-blur-sm transition-[width] duration-500 ease-out ${
                expanded ? "z-20 xl:w-[30rem]" : "z-0 xl:w-20"
              } ${visibleWatchlists.length > 1 ? "cursor-grab active:cursor-grabbing" : ""} ${draggedId === watchlist.id ? "opacity-55" : ""}`}
            >
              <div aria-hidden="true" className={`absolute inset-0 flex min-h-0 flex-col items-center justify-between gap-1 py-2 transition-opacity duration-200 ${expanded ? "pointer-events-none opacity-0" : ""}`}>
                <div className="pinned-watchlist-movement flex shrink-0 flex-col items-center gap-1">
                  <span className="max-w-[72px] truncate text-xs font-semibold text-emerald-300">
                    {strongestWinner?.symbol ?? "—"}
                  </span>
                  {strongestWinner && <MovementSignal mover={strongestWinner} compact />}
                </div>
                <span
                  className="min-h-0 overflow-hidden whitespace-nowrap text-xs font-semibold tracking-wider text-slate-400 [text-orientation:upright] [writing-mode:vertical-rl]"
                  title={watchlist.name}
                >
                  {watchlist.name}
                </span>
                <div className="pinned-watchlist-movement flex shrink-0 flex-col items-center gap-1">
                  {strongestLoser && <MovementSignal mover={strongestLoser} compact />}
                  <span className="max-w-[72px] truncate text-xs font-semibold text-rose-300">
                    {strongestLoser?.symbol ?? "—"}
                  </span>
                </div>
              </div>
              <div
                aria-hidden={!expanded}
                inert={!expanded && draggedId !== watchlist.id}
                className={`pinned-watchlist-content absolute inset-0 flex h-full flex-col p-4 transition-opacity duration-200 xl:p-5 ${
                  expanded ? "opacity-100 delay-200" : "pointer-events-none opacity-0"
                }`}
              >
                <header className="pinned-watchlist-header mb-5 flex min-w-0 shrink-0 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-slate-100">
                      {watchlist.name}
                    </h2>
                    <p className="pinned-watchlist-subtitle text-sm text-slate-400">Today&apos;s movement</p>
                  </div>
                  <button
                    type="button"
                    aria-label={lockedId === watchlist.id ? `Unlock ${watchlist.name}` : `Lock ${watchlist.name} open`}
                    aria-pressed={lockedId === watchlist.id}
                    onClick={() => setLockedId((current) => current === watchlist.id ? null : watchlist.id)}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${
                      lockedId === watchlist.id
                        ? "bg-sky-400/20 text-sky-300 hover:bg-sky-400/30"
                        : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    {lockedId === watchlist.id ? <Lock size={17} /> : <Unlock size={17} />}
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${watchlist.name} up`}
                    disabled={index === 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveWatchlist(watchlist.id, index - 1);
                    }}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <MoveUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${watchlist.name} down`}
                    disabled={index === visibleWatchlists.length - 1}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveWatchlist(watchlist.id, index + 1);
                    }}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <MoveDown size={15} />
                  </button>
                </header>
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {winners.length ? (
                      winners.map((mover) => (
                        <MoverRow key={mover.securityId} mover={mover} />
                      ))
                    ) : (
                      <p className="px-2 py-2 text-xs text-slate-500">
                        {!watchlist.watchedSecurities.length ? "No securities in this watchlist." : validPriceCount ? "No advancing securities with live prices." : "Waiting for valid live prices."}
                      </p>
                    )}
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-slate-700/70">
                    <div className="mt-auto">
                    {losers.length ? (
                      losers.map((mover) => (
                        <MoverRow key={mover.securityId} mover={mover} />
                      ))
                    ) : validPriceCount > 0 ? (
                      <p className="px-2 py-2 text-xs text-slate-500">
                        No declining securities with live prices.
                      </p>
                    ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {!loadError && watchlists.length === 0 && (
          <div className="grid min-h-28 place-items-center rounded-2xl border border-dashed border-sky-200/15 bg-slate-900/30 px-5 text-center xl:flex-1">
            <div>
              <RefreshCw size={18} className="mx-auto mb-2 text-sky-300/70" />
              <p className="text-sm text-slate-400">Pin a watchlist to see its movers here.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
