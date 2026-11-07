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