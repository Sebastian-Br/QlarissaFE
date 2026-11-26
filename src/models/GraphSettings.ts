export const GraphDataSource = {
  Security: 0,
  DividendPayouts: 1,
} as const;

export type GraphDataSource =
  (typeof GraphDataSource)[keyof typeof GraphDataSource];

export const PlotType = {
  Line: 0,
  Area: 1,
  StackedArea: 2,
  Candlestick: 3,
  Bar: 4,
  Scatter: 5,
  Histogram: 6,
  Density: 7,
  Pie: 8,
  Donut: 9,
  Radar: 10,
  Treemap: 11,
  Sankey: 12,
  Venn: 13,
  Heatmap: 14,
  Workflow: 15,
} as const;

export type PlotType = (typeof PlotType)[keyof typeof PlotType];

export interface Bounds {
  startDate: string | null;
  endDate: string | null;
  start: number | null;
  end: number | null;
}

interface GraphSettingsBase {
  dataSource: GraphDataSource;
  plotType: PlotType;
  bounds: Bounds | null;
}

export interface SecurityGraphSettings extends GraphSettingsBase {
  dataSource: typeof GraphDataSource.Security;
  asTotalReturn: boolean;
}

export interface DividendPayoutGraphSettings extends GraphSettingsBase {
  dataSource: typeof GraphDataSource.DividendPayouts;
  isSynchronizedWithSecurityGraph: boolean;
}

export type GraphSettings =
  | SecurityGraphSettings
  | DividendPayoutGraphSettings;
