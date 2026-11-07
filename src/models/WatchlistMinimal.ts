export interface WatchlistMinimal {
  Id: number;
  Name: string;
  IsPrimary: boolean;
  IsSecondary: boolean;
  IsPinned: boolean;
  PinPosition: number;
  TrackedChangeDurationTradingDays: number;
}
