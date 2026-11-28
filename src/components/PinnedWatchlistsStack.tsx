"use client";

import {
  History,
  Info,
  Lock,
  RefreshCw,
  Unlock,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
const STACK_MIN_HEIGHT_PX = 576;
const STACK_BOTTOM_MARGIN_PX = 32;
const WARNING_RESERVE_PX = 44;
const CARD_GAP_PX = 8;
const CARD_BORDER_PX = 2;
const DRAG_START_DISTANCE_PX = 6;
const DRAG_SNAP_DURATION_MS = 180;
const CONNECTION_RETRY_MS = 5_000;

function fitCount(heights: (number | undefined)[], availablePx: number): number {
  let used = 0;
  let count = 0;
  for (const height of heights) {
    const next = used + (count > 0 ? CARD_GAP_PX : 0) + (height ?? 0);
    if (count > 0 && next > availablePx) break;
    used = next;
    count += 1;
  }
  return count;
}

function CollapsedFace({
  watchlist,
  winner,
  loser,
  measure = false,
}: {
  watchlist: Watchlist;
  winner?: WatchlistMover;
  loser?: WatchlistMover;
  measure?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={
        measure
          ? "flex w-20 flex-col items-center gap-1 py-2"
          : "pointer-events-none absolute inset-0 flex min-h-0 flex-col items-center justify-between gap-1 py-2"
      }
    >
      <div className="pinned-watchlist-movement flex shrink-0 flex-col items-center gap-1">
        {winner && <MovementSignal mover={winner} compact />}
        <span className="max-w-[72px] truncate text-xs font-semibold text-emerald-300">
          {winner?.symbol ?? "—"}
        </span>
      </div>
      <span
        className={`whitespace-nowrap text-base font-bold tracking-[0.12em] text-slate-200 [text-orientation:upright] [writing-mode:vertical-rl] ${measure ? "" : "min-h-0 overflow-hidden"}`}
      >
        {watchlist.name}
      </span>
      <div className="pinned-watchlist-movement flex shrink-0 flex-col items-center gap-1">
        <span className="max-w-[72px] truncate text-xs font-semibold text-rose-300">
          {loser?.symbol ?? "—"}
        </span>
        {loser && <MovementSignal mover={loser} compact />}
      </div>
    </div>
  );
}

function MoverRow({ mover }: { mover: WatchlistMover }) {
  return (
    <Link
      href={`/security/${mover.securityId}`}
      aria-label={`View ${mover.name} details`}
      onClick={(event) => event.stopPropagation()}
      className="pinned-watchlist-row flex cursor-pointer items-center justify-between gap-4 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-800/50 focus-visible:bg-slate-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 active:bg-slate-800/80"
    >
      <p className="min-w-0 truncate text-base font-medium text-slate-100">{mover.name}</p>
      <div className="flex shrink-0 items-center gap-4 whitespace-nowrap text-right">
        <span className="text-sm text-slate-300">{formatWatchlistPrice(mover.price, mover.currencySymbol)}</span>
        <MovementSignal mover={mover} />
      </div>
    </Link>
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
  const [pendingDragId, setPendingDragId] = useState<number | null>(null);
  const [previewWatchlists, setPreviewWatchlists] = useState<Watchlist[] | null>(null);
  const [stackHeight, setStackHeight] = useState(STACK_MIN_HEIGHT_PX);
  const stackRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [cardHeights, setCardHeights] = useState<Record<number, number>>({});
  const cardRefs = useRef<Map<number, HTMLElement>>(new Map());
  const previousCardPositionsRef = useRef<Map<number, DOMRect>>(new Map());
  const cardAnimationsRef = useRef<Animation[]>([]);
  const pendingDragIdRef = useRef<number | null>(null);
  const pendingDragTimerRef = useRef<number | null>(null);
  const draggedIdRef = useRef<number | null>(null);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragSnapStartRef = useRef<number | null>(null);
  const previewWatchlistsRef = useRef<Watchlist[] | null>(null);
  const pointerGestureRef = useRef<{
    id: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const orderSaveInProgress = useRef(false);
  const desiredSymbolsRef = useRef<string[]>([]);
  const reconcileRef = useRef<(() => void) | null>(null);
  const symbols = useMemo(
    () => getPinnedWatchlistSymbols(watchlists),
    [watchlists],
  );
  const symbolsKey = symbols.join("\u0000");
  const maxVisibleWatchlists = fitCount(
    watchlists.map((item) => cardHeights[item.id]),
    stackHeight,
  );
  const hiddenCount = Math.max(0, watchlists.length - maxVisibleWatchlists);

  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    const next: Record<number, number> = {};
    Array.from(probe.children).forEach((child) => {
      const id = Number((child as HTMLElement).dataset.id);
      next[id] = Math.ceil((child as HTMLElement).offsetHeight) + CARD_BORDER_PX;
    });
    setCardHeights((current) => {
      const keys = Object.keys(next);
      const same = keys.length === Object.keys(current).length &&
        keys.every((key) => current[Number(key)] === next[Number(key)]);
      return same ? current : next;
    });
  }, [watchlists, livePrices]);

  useLayoutEffect(() => {
    const element = stackRef.current;
    if (!element) return;
    const update = () => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      const reserve = hiddenCount > 0 ? WARNING_RESERVE_PX : 0;
      const available = window.innerHeight - top - STACK_BOTTOM_MARGIN_PX - reserve;
      setStackHeight(Math.max(STACK_MIN_HEIGHT_PX, Math.floor(available)));
    };
    update();
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [hiddenCount, orderError, loadError]);

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

  const captureCardPositions = useCallback(() => {
    const positions = new Map<number, DOMRect>();
    cardRefs.current.forEach((element, id) => {
      positions.set(id, element.getBoundingClientRect());
    });
    previousCardPositionsRef.current = positions;
  }, []);

  const clearPendingDrag = useCallback(() => {
    if (pendingDragTimerRef.current !== null) {
      window.clearTimeout(pendingDragTimerRef.current);
      pendingDragTimerRef.current = null;
    }
    pendingDragIdRef.current = null;
    setPendingDragId(null);
  }, []);

  const activateDrag = useCallback(
    (watchlistId: number) => {
      if (pendingDragIdRef.current !== watchlistId) return;
      clearPendingDrag();
      captureCardPositions();
      draggedIdRef.current = watchlistId;
      dragSnapStartRef.current = performance.now();
      previewWatchlistsRef.current = watchlists;
      setPreviewWatchlists(watchlists);
      setDraggedId(watchlistId);
    },
    [captureCardPositions, clearPendingDrag, watchlists],
  );

  const finishDrag = useCallback(
    (save: boolean, targetIndex?: number) => {
      const activeDraggedId = draggedIdRef.current;
      if (activeDraggedId !== null) {
        const element = cardRefs.current.get(activeDraggedId);
        const from = element?.style.transform;
        if (element && from) {
          element.style.transform = "";
          element.animate(
            [{ transform: from }, { transform: "none" }],
            { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
          );
        }
      }
      dragPointerRef.current = null;
      dragSnapStartRef.current = null;
      if (save && activeDraggedId !== null) {
        const base = previewWatchlistsRef.current ?? watchlists;
        const next = targetIndex === undefined
          ? base
          : movePinnedWatchlist(base, activeDraggedId, targetIndex);
        void saveOrder(next);
      }
      clearPendingDrag();
      draggedIdRef.current = null;
      previewWatchlistsRef.current = null;
      pointerGestureRef.current = null;
      setPreviewWatchlists(null);
      setDraggedId(null);
    },
    [clearPendingDrag, saveOrder, watchlists],
  );

  const previewWatchlistMove = useCallback(
    (targetIndex: number) => {
      const activeDraggedId = draggedIdRef.current;
      if (activeDraggedId === null) return;
      const base = previewWatchlistsRef.current ?? watchlists;
      const next = movePinnedWatchlist(base, activeDraggedId, targetIndex);
      if (next === base) return;
      captureCardPositions();
      previewWatchlistsRef.current = next;
      setPreviewWatchlists(next);
    },
    [captureCardPositions, watchlists],
  );

  // Layout-based geometry (offset*) ignores transforms, so slot detection is
  // stable while cards animate or the dragged card is translated.
  const applyDragTransform = useCallback(() => {
    const activeDraggedId = draggedIdRef.current;
    const pointer = dragPointerRef.current;
    if (activeDraggedId === null || pointer === null) return;
    const element = cardRefs.current.get(activeDraggedId);
    const parent = element?.offsetParent as HTMLElement | null;
    if (!element || !parent) return;
    const parentRect = parent.getBoundingClientRect();
    const dx = pointer.x - parentRect.left - parent.clientLeft - (element.offsetLeft + element.offsetWidth / 2);
    const dy = pointer.y - parentRect.top - parent.clientTop - (element.offsetTop + element.offsetHeight / 2);
    let follow = 1;
    if (dragSnapStartRef.current !== null) {
      const progress = Math.min(
        1,
        (performance.now() - dragSnapStartRef.current) / DRAG_SNAP_DURATION_MS,
      );
      follow = 1 - (1 - progress) ** 3;
      if (progress >= 1) dragSnapStartRef.current = null;
    }
    element.style.transform = `translate(${dx * follow}px, ${dy * follow}px) scale(${1 + 0.03 * follow})`;
  }, []);

  useEffect(() => {
    if (draggedId === null) return;
    let frame = 0;
    const tick = () => {
      applyDragTransform();
      if (dragSnapStartRef.current !== null) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [applyDragTransform, draggedId]);

  const moveDragPreview = useCallback(
    (pointerX: number, pointerY: number) => {
      const current = previewWatchlistsRef.current;
      const activeDraggedId = draggedIdRef.current;
      if (current === null || activeDraggedId === null) return;
      dragPointerRef.current = { x: pointerX, y: pointerY };
      applyDragTransform();

      const parent = cardRefs.current.get(activeDraggedId)?.offsetParent as HTMLElement | null;
      if (!parent) return;
      const localY = pointerY - parent.getBoundingClientRect().top - parent.clientTop;

      let nearestIndex = current.findIndex((item) => item.id === activeDraggedId);
      let nearestDistance = Number.POSITIVE_INFINITY;
      current.forEach((watchlist, index) => {
        const element = cardRefs.current.get(watchlist.id);
        if (!element) return;
        const distance = Math.abs(localY - (element.offsetTop + element.offsetHeight / 2));
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      previewWatchlistMove(nearestIndex);
    },
    [applyDragTransform, previewWatchlistMove],
  );

  useLayoutEffect(() => {
    cardAnimationsRef.current.forEach((animation) => animation.cancel());
    cardAnimationsRef.current = [];
    if (draggedId === null || previewWatchlists === null) return;

    applyDragTransform();
    previewWatchlists.forEach((watchlist) => {
      if (watchlist.id === draggedId) return;
      const element = cardRefs.current.get(watchlist.id);
      const previous = previousCardPositionsRef.current.get(watchlist.id);
      if (!element || !previous) return;

      const current = element.getBoundingClientRect();
      const deltaY = previous.top - current.top;
      if (Math.abs(deltaY) < 1) return;

      const animation = element.animate(
        [
          { transform: `translateY(${deltaY}px)` },
          { transform: "translateY(0)" },
        ],
        {
          duration: 500,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        },
      );
      cardAnimationsRef.current.push(animation);
    });
  }, [applyDragTransform, draggedId, previewWatchlists]);

  const displayWatchlists = previewWatchlists ?? watchlists;
  const visibleWatchlists = displayWatchlists.slice(0, maxVisibleWatchlists);

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
      <div
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none invisible fixed left-0 top-0 -z-10"
      >
        {watchlists.map((watchlist) => {
          const { winners, losers } = rankWatchlistMovers(watchlist, livePrices, MOVERS_PER_DIRECTION);
          return (
            <div key={watchlist.id} data-id={watchlist.id}>
              <CollapsedFace
                measure
                watchlist={watchlist}
                winner={winners[0]}
                loser={losers[losers.length - 1]}
              />
            </div>
          );
        })}
      </div>
      <div ref={stackRef} style={{ height: stackHeight }} className="flex min-h-0 flex-col gap-2 overflow-visible">
        {visibleWatchlists.map((watchlist) => {
          const { winners, losers, validPriceCount, hasMissingLivePrices } = rankWatchlistMovers(
            watchlist,
            livePrices,
            MOVERS_PER_DIRECTION,
          );
          const strongestWinner = winners[0];
          const strongestLoser = losers[losers.length - 1];
          const expanded = draggedId === null && pendingDragId === null &&
            (lockedId ?? hoveredId ?? keyboardFocusedId) === watchlist.id;

          return (
            <article
              key={watchlist.id}
              ref={(element) => {
                if (element) cardRefs.current.set(watchlist.id, element);
                else cardRefs.current.delete(watchlist.id);
              }}
              tabIndex={0}
              aria-label={watchlist.name}
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
              onPointerDown={(event) => {
                if (
                  event.button !== 0 ||
                  savingOrder ||
                  lockedId === watchlist.id ||
                  visibleWatchlists.length < 2 ||
                  (event.target as HTMLElement).closest("button, a")
                ) return;
                pointerGestureRef.current = {
                  id: watchlist.id,
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const gesture = pointerGestureRef.current;
                if (!gesture || gesture.id !== watchlist.id || gesture.pointerId !== event.pointerId)
                  return;

                dragPointerRef.current = { x: event.clientX, y: event.clientY };
                if (draggedIdRef.current === watchlist.id) {
                  event.preventDefault();
                  moveDragPreview(event.clientX, event.clientY);
                  return;
                }
                if (pendingDragIdRef.current === watchlist.id) return;

                const distance = Math.hypot(
                  event.clientX - gesture.startX,
                  event.clientY - gesture.startY,
                );
                if (distance < DRAG_START_DISTANCE_PX) return;

                event.preventDefault();
                suppressClickRef.current = true;
                setHoveredId(null);
                setKeyboardFocusedId(null);
                pendingDragIdRef.current = watchlist.id;
                setPendingDragId(watchlist.id);
                pendingDragTimerRef.current = window.setTimeout(
                  () => activateDrag(watchlist.id),
                  250,
                );
              }}
              onPointerUp={(event) => {
                if (pointerGestureRef.current?.pointerId !== event.pointerId) return;
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
                const shouldSave = draggedIdRef.current === watchlist.id;
                finishDrag(shouldSave);
              }}
              onPointerCancel={() => {
                finishDrag(false);
              }}
              onTransitionEnd={(event) => {
                if (event.propertyName === "width")
                  activateDrag(watchlist.id);
              }}
              onClick={(event) => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  event.preventDefault();
                  return;
                }
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
              style={{ minHeight: cardHeights[watchlist.id] }}
              className={`pinned-watchlist-card group relative flex-[1_1_0%] select-none overflow-hidden rounded-2xl border border-sky-200/10 bg-slate-900/60 shadow-xl shadow-slate-950/20 backdrop-blur-sm transition-[width] ease-out ${
                pendingDragId !== null || draggedId !== null ? "duration-200" : "duration-500"
              } ${
                expanded ? "z-20 xl:w-[30rem]" : "z-0 xl:w-20"
              } ${visibleWatchlists.length > 1 && lockedId !== watchlist.id ? "cursor-grab active:cursor-grabbing" : ""} ${draggedId === watchlist.id ? "!z-30 cursor-grabbing shadow-2xl shadow-sky-950/60" : ""}`}
            >
              <div className={`transition-opacity duration-200 ${expanded ? "opacity-0" : ""}`}>
                <CollapsedFace watchlist={watchlist} winner={strongestWinner} loser={strongestLoser} />
              </div>
              <div
                aria-hidden={!expanded}
                inert={!expanded && draggedId !== watchlist.id}
                className={`pinned-watchlist-content absolute inset-0 flex h-full flex-col p-4 transition-opacity duration-200 xl:right-auto xl:w-[30rem] xl:p-5 ${
                  expanded ? "opacity-100 delay-200" : "pointer-events-none opacity-0"
                }`}
              >
                <header className="pinned-watchlist-header mb-5 flex min-w-0 shrink-0 items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <h2 className="min-w-0 truncate text-base font-semibold text-slate-100">
                      {watchlist.name}
                    </h2>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="pinned-watchlist-subtitle inline-flex shrink-0 cursor-help items-center gap-1.5 text-sm text-slate-400 transition-colors duration-200 hover:text-slate-200">
                          <History size={15} aria-hidden="true" />
                          <span className="font-medium">{watchlist.trackedChangeDurationTradingDays}</span>
                          <span className="sr-only">
                            {watchlist.trackedChangeDurationTradingDays === 1 ? "trading day" : "trading days"}
                          </span>
                        </p>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        showArrow={false}
                        className="max-w-72 border border-sky-200/15 bg-slate-800 text-slate-100 shadow-xl"
                      >
                        Tracks changes over {watchlist.trackedChangeDurationTradingDays} trading{" "}
                        {watchlist.trackedChangeDurationTradingDays === 1 ? "day" : "days"}.
                      </TooltipContent>
                    </Tooltip>
                    {hasMissingLivePrices && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Some securities are waiting for live prices"
                            className="shrink-0 cursor-help rounded text-amber-300 transition-colors hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                          >
                            <Info size={16} aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          showArrow={false}
                          className="max-w-72 border border-sky-200/15 bg-slate-800 text-slate-100 shadow-xl"
                        >
                          Some securities are not shown because they have not received a live price update yet.
                        </TooltipContent>
                      </Tooltip>
                    )}
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
                </header>
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="pinned-watchlist-scroll min-h-0 flex-1">
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
                  <div className="pinned-watchlist-scroll flex min-h-0 flex-1 flex-col border-t border-slate-700/70">
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
      {hiddenCount > 0 && (
        <div className="group relative">
          <p
            tabIndex={0}
            role="status"
            className="cursor-default rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 outline-none transition-colors duration-200 hover:bg-amber-400/20 focus-visible:bg-amber-400/20 focus-visible:ring-2 focus-visible:ring-amber-300/50"
          >
            {hiddenCount} pinned {hiddenCount === 1 ? "watchlist cannot" : "watchlists cannot"} fit here. Unpin a list to display all.
          </p>
          <ul className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 max-h-60 w-full overflow-hidden rounded-xl border border-amber-300/30 bg-[#08243d] p-2 text-xs text-slate-200 opacity-0 shadow-xl shadow-slate-950/50 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
            {watchlists.slice(maxVisibleWatchlists).map((item) => (
              <li key={item.id} className="truncate px-2 py-1">{item.name}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
