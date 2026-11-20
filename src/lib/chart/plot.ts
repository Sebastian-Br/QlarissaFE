// Chart coordinates are percentages of a 0-100 viewBox; the surface padding is p-3 (12px).
export const PLOT = {
  left: 6,
  right: 97,
  width: 91,
  top: 10,
  bottom: 86,
  height: 76,
};

const SURFACE_PADDING_PX = 12;
const SURFACE_BORDER_PX = 1;
const SURFACE_INSET_PX = SURFACE_PADDING_PX + SURFACE_BORDER_PX;

export function clientToPlotX(box: DOMRect, clientX: number) {
  return Math.max(
    PLOT.left,
    Math.min(
      PLOT.right,
      ((clientX - box.left - SURFACE_INSET_PX) /
        (box.width - SURFACE_INSET_PX * 2)) *
        100,
    ),
  );
}

export function isInsidePlot(box: DOMRect, clientX: number, clientY: number) {
  const plotX =
    ((clientX - box.left - SURFACE_INSET_PX) /
      (box.width - SURFACE_INSET_PX * 2)) *
    100;
  const plotY =
    ((clientY - box.top - SURFACE_INSET_PX) /
      (box.height - SURFACE_INSET_PX * 2)) *
    100;
  return (
    plotX >= PLOT.left &&
    plotX <= PLOT.right &&
    plotY >= PLOT.top &&
    plotY <= PLOT.bottom
  );
}

export function clientToPlotY(box: DOMRect, clientY: number) {
  return Math.max(
    PLOT.top,
    Math.min(
      PLOT.bottom,
      ((clientY - box.top - SURFACE_INSET_PX) /
        (box.height - SURFACE_INSET_PX * 2)) *
        100,
    ),
  );
}

export function hoverAnchor(
  box: Pick<DOMRect, "width" | "height">,
  pointX: number,
  pointY: number,
) {
  return {
    x: SURFACE_PADDING_PX + ((box.width - SURFACE_PADDING_PX * 2) * pointX) / 100,
    y: SURFACE_PADDING_PX + ((box.height - SURFACE_PADDING_PX * 2) * pointY) / 100,
    axisX:
      SURFACE_PADDING_PX +
      ((box.width - SURFACE_PADDING_PX * 2) * PLOT.left) / 100,
    axisY:
      SURFACE_PADDING_PX +
      ((box.height - SURFACE_PADDING_PX * 2) * PLOT.bottom) / 100,
  };
}
