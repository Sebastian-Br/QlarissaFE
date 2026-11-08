import type { SecurityWatchlists } from "@/hooks/useSecurityWatchlists";
import { AddToWatchlistMenu } from "./AddToWatchlistMenu";
import { CreateWatchlistDialog } from "./CreateWatchlistDialog";
import { StarToggle } from "./StarToggle";

export function WatchlistControls({ state }: { state: SecurityWatchlists }) {
  const controlsDisabled = !state.starsReady || state.togglingWatchlistId !== null;

  return (
    <>
      <StarToggle
        label="Star security"
        size={28}
        pressed={state.isStarredLarge}
        onToggle={() =>
          state.primaryWatchlist && state.toggleWatchlist(state.primaryWatchlist)
        }
        watchlist={state.primaryWatchlist}
        disabled={controlsDisabled}
        saving={state.savingWatchlistId !== null}
        onSave={state.saveWatchlist}
        loadError={state.watchlistsFailed}
      />
      <StarToggle
        label="Star security (secondary)"
        size={20}
        pressed={state.isStarredSmall}
        onToggle={() =>
          state.secondaryWatchlist && state.toggleWatchlist(state.secondaryWatchlist)
        }
        watchlist={state.secondaryWatchlist}
        disabled={controlsDisabled}
        saving={state.savingWatchlistId !== null}
        onSave={state.saveWatchlist}
        loadError={state.watchlistsFailed}
      />
      <AddToWatchlistMenu
        watchlists={state.watchlists ?? []}
        watchedIds={state.watchedWatchlistIds ?? []}
        disabled={controlsDisabled}
        onToggle={state.toggleWatchlist}
        onCreate={() => state.setIsCreateWatchlistOpen(true)}
      />
      {state.isCreateWatchlistOpen && (
        <CreateWatchlistDialog
          hasPrimary={!!state.primaryWatchlist}
          hasSecondary={!!state.secondaryWatchlist}
          onClose={() => state.setIsCreateWatchlistOpen(false)}
          onCreated={state.handleWatchlistCreated}
        />
      )}
    </>
  );
}
