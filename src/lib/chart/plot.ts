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

function pointToSegmentDistance(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) {
    const offsetX = pointX - startX;
    const offsetY = pointY - startY;
    return Math.sqrt(offsetX * offsetX + offsetY * offsetY);
  }
  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((pointX - startX) * deltaX + (pointY - startY) * deltaY) /
        lengthSquared,
    ),
  );
  const closestX = startX + ratio * deltaX;
  const closestY = startY + ratio * deltaY;
  const offsetX = pointX - closestX;
  const offsetY = pointY - closestY;
  return Math.sqrt(offsetX * offsetX + offsetY * offsetY);
}

export function circleTouchesPlot(
  points: { x: number; y: number }[],
  circleX: number,
  circleY: number,
  radius: number,
  plotWidthScale = 1,
  plotHeightScale = 1,
) {
  if (
    circleX < PLOT.left ||
    circleX > PLOT.right ||
    circleY < PLOT.top ||
    circleY > PLOT.bottom
  )
    return false;

  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index];
    const end = points[index + 1];
    const startPixelX = start.x * plotWidthScale;
    const startPixelY = start.y * plotHeightScale;
    const endPixelX = end.x * plotWidthScale;
    const endPixelY = end.y * plotHeightScale;
    const circlePixelX = circleX * plotWidthScale;
    const circlePixelY = circleY * plotHeightScale;
    const radiusPixels = radius * plotHeightScale;
    if (
      pointToSegmentDistance(
        circlePixelX,
        circlePixelY,
        startPixelX,
        startPixelY,
        endPixelX,
        endPixelY,
      ) <= radiusPixels
    )
      return true;
  }
  return false;
}

export function findHoveredPlotIndex(
  points: { x: number; y: number }[],
  plotX: number,
  plotY: number,
  dynamicRadius: number,
  alwaysHover: boolean,
  plotWidthScale = 1,
  plotHeightScale = 1,
) {
  if (
    plotX < PLOT.left ||
    plotX > PLOT.right ||
    plotY < PLOT.top ||
    plotY > PLOT.bottom
  )
    return -1;

  let nearestIndex = 0;
  let nearestDistance = Math.abs(plotX - points[0].x);
  let low = 0;
  let high = points.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const distance = Math.abs(plotX - points[mid].x);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = mid;
    }
    if (points[mid].x < plotX) low = mid + 1;
    else high = mid - 1;
  }

  if (alwaysHover) return nearestIndex;
  const radius = (PLOT.height * dynamicRadius) / 100;
  return circleTouchesPlot(
    points,
    plotX,
    plotY,
    radius,
    plotWidthScale,
    plotHeightScale,
  )
    ? nearestIndex
    : -1;
}

export function hoverAnchor(
  box: Pick<DOMRect, "width" | "height">,
  pointX: number,
  pointY: number,
) {
  return {
    x: SURFACE_INSET_PX + ((box.width - SURFACE_INSET_PX * 2) * pointX) / 100,
    y: SURFACE_INSET_PX + ((box.height - SURFACE_INSET_PX * 2) * pointY) / 100,
    axisX:
      SURFACE_INSET_PX +
      ((box.width - SURFACE_INSET_PX * 2) * PLOT.left) / 100,
    axisY:
      SURFACE_INSET_PX +
      ((box.height - SURFACE_INSET_PX * 2) * PLOT.bottom) / 100,
  };
}
