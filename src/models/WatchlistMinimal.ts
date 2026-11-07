export interface WatchlistMinimal {
  id: number;
  name: string;
  isPrimary: boolean;
  isSecondary: boolean;
  isPinned: boolean;
  pinPosition: number;
  trackedChangeDurationTradingDays: number;
}
