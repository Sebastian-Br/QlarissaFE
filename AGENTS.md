# AGENTS Instructions

## Project Context

- **Purpose:** This is the Front-End of a financial analysis platform. The Back-End is an ASP.NET Core Server.
- **Framework:** React
- **Language:** TypeScript
- **Build tool:** Vite
- **Styling:** Generally consider Tailwind CSS.
- **Project-specific vocabulary:** "Security" generally refers to a financial security. A data point generally refers to a point in the daily price history graph, containing Open/Close/High/Low/Average values. 

## User Interface

* Static UI elements such as buttons should give the user clear visual feedback when hovered, including a subtle glow or highlight.
* Interactive elements should have clear hover, focus, active, and disabled states.
* Use smooth, short transitions for hover and state changes; avoid abrupt visual changes.
* Buttons and other clickable elements should feel responsive and provide immediate visual feedback.
* Maintain consistent spacing, typography, colors, border radii, shadows, and interaction patterns throughout the UI.
* Ensure interactive elements have accessible keyboard focus states.
* Preserve responsive behavior across desktop, tablet, and mobile layouts.

## Components

* Prefer reusable components over duplicating UI patterns where reuse is meaningful.

## Styling

* Follow the existing design system and visual language before introducing new styles.
* Avoid hard-coded values when an existing project token or variable provides the same value.
* Keep animations subtle and purposeful.

## Responsiveness

* Avoid fixed dimensions that can cause overflow or broken layouts.
* Verify that text, buttons, navigation, and content remain usable at smaller viewport sizes.

## Code Quality

* Make the smallest reasonable change needed to complete the task.
* Preserve existing functionality unless the task explicitly requires changing it.
* Keep code readable and maintainable.
