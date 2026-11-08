# AGENTS Instructions

## Project Context

- **Purpose:** This is the Front-End of a financial analysis platform.
- **Framework:** React
- **Language:** TypeScript
- **Build tool:** Vite
- **Project-specific vocabulary:** "Security" generally refers to a financial security.
A data point generally refers to a point in the daily price history graph, containing Open/Close/High/Low/Average values. 
- **Back-End:** The Back-End is an ASP.NET Core Server outside this repository.
When presented with a Back-End DTO, keep in mind that it will be serialized in camelCase.
When presented with an endpoint, keep in mind that "Async" suffixes are not part of the route.

## User Interface

* UI elements such as buttons should give the user clear visual feedback when hovered, including a subtle glow or highlight.
* Interactive elements should have clear hover, focus, active, and disabled states.
* Use smooth transitions for hover and state changes; avoid abrupt visual changes.
* Maintain consistent spacing, typography, colors, border radii, shadows, and interaction patterns throughout the UI.
* Ensure interactive elements have accessible keyboard focus states.
* Preserve responsive behavior across desktop, tablet, and mobile layouts.

## Components

* Prefer reusable components over duplicating UI patterns where reuse is meaningful.
* Prefer organizing reusable components into classes and files to reduce cognitive complexity.

## Styling

* Generally consider Tailwind CSS.
* Follow the existing design system and visual language before introducing new styles.
* Avoid hard-coded values when an existing project token or variable provides the same value.

## Responsiveness

* Avoid fixed dimensions that can cause overflow or broken layouts.
* Generally organize UI elements such that they avoid obstructing each other.
* Verify that text, buttons, navigation, and content remain usable at smaller viewport sizes.

## Code Quality

* Make the smallest reasonable change needed to complete the task.
* Preserve existing functionality unless the task explicitly requires changing it.
* Keep code readable and maintainable.

## Code Organization

* `src/components/SecurityDetail.tsx`: security page. Owns route params, the security load effect, and the update action; composes the modules below.
* `src/components/security/charts/`: `PriceHistoryChart` (daily prices, log/linear, live-price date), `DividendPayoutChart` (dividend bars). `ChartFrame.tsx` (surface, grid, tick and axis labels), `ChartHover.tsx` (crosshair and hover cards), `ChartSettings.tsx` (settings button and panel) are shared by both.
* `src/components/security/watchlist/`: star toggles, add-to-watchlist menu, create dialog, tracked-duration input. `WatchlistControls.tsx` composes them from the `useSecurityWatchlists` state.
* `src/components/security/details/`: `TypeSpecificDetails` dispatches to `StockDetails`, `EtfDetails`, `CryptoDetails`, `CurrencyPairDetails`. `DetailCard`/`Metric` and `DetailList` (`SplitsCard`) are the shared building blocks.
* `src/components/security/`: `SecurityHeader` (title, badges, watchlist controls, symbol), `BusinessSummary` (expandable text), `PriceSummary` (price, live status, update button), `UpdatingOverlay`.
* `src/hooks/`: `useChartViewport` (zoom, pan, wheel), `useChartPointer` (hover, drag, click), `useLivePrices` (SignalR subscription and unavailable timer), `useSecurityWatchlists` (watchlist loading, star toggles, saves).
* `src/lib/formatting.ts`: number, date, and price formatters, and security type labels. `src/lib/livePrices.ts`: live-price type and merge into daily history. `src/lib/chart/`: `plot.ts` (chart coordinate space and hover anchors) and `timeAxis.ts` (calendar scale, year and month ticks, label collision rules).
* Pure calculations belong in `src/lib`, stateful behavior in `src/hooks`, and markup in components.
