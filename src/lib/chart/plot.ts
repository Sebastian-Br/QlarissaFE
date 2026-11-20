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

export function hoverTriggerPath(
  points: { x: number; y: number }[],
  _horizontalReach: number,
  verticalDistance: number,
) {
  return movingAverageHoverPath(points, verticalDistance);
}

export function movingAverageHoverPath(
  points: ({ x: number; y: number } & { date?: string })[],
  verticalDistance: number,
) {
  if (!points.length) return "";
  const averagePoints = movingAveragePoints(points);
  if (!averagePoints.length) return "";

  const upper = averagePoints
    .map((point) => ({
      x: point.x,
      y: Math.max(PLOT.top, point.y - verticalDistance),
    }));
  const lower = averagePoints
    .map((point) => ({
      x: point.x,
      y: Math.min(PLOT.bottom, point.y + verticalDistance),
    }));

  let path = `M ${upper[0].x} ${upper[0].y}`;
  for (let index = 1; index < upper.length; index++) {
    path += ` L ${upper[index].x} ${upper[index].y}`;
  }
  for (let index = lower.length - 1; index >= 0; index--) {
    path += ` L ${lower[index].x} ${lower[index].y}`;
  }
  return `${path} Z`;
}

export function fullPlotHoverPath() {
  return `M ${PLOT.left} ${PLOT.top} H ${PLOT.right} V ${PLOT.bottom} H ${PLOT.left} Z`;
}

function movingAveragePoints(
  points: ({ x: number; y: number } & { date?: string })[],
) {
  if (!points.length) return [];

  const averages: { x: number; y: number }[] = [];
  let windowStart = 0;
  let sum = 0;

  for (let index = 0; index < points.length; index++) {
    const currentDate = points[index].date
      ? Date.parse(`${points[index].date!.slice(0, 10)}T00:00:00Z`)
      : index;
    sum += points[index].y;

    while (windowStart < index) {
      const startDate = points[windowStart].date
        ? Date.parse(`${points[windowStart].date!.slice(0, 10)}T00:00:00Z`)
        : windowStart;
      const isOutsideWindow =
        points[index].date && points[windowStart].date
          ? currentDate - startDate > 29 * 86_400_000
          : index - windowStart >= 30;
      if (!isOutsideWindow) break;
      sum -= points[windowStart].y;
      windowStart++;
    }

    averages.push({
      x: points[index].x,
      y: sum / (index - windowStart + 1),
    });
  }
  return averages;
}

export function findHoveredPlotIndex(
  points: { x: number; y: number }[],
  plotX: number,
  plotY: number,
  _horizontalReach: number,
  verticalDistance: number,
  alwaysHover: boolean,
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

  if (alwaysHover) {
    return nearestIndex;
  }

  const averagePoints = movingAveragePoints(points);
  if (!averagePoints.length) return -1;

  let curveIndex = 0;
  while (
    curveIndex < averagePoints.length - 1 &&
    averagePoints[curveIndex + 1].x < plotX
  ) {
    curveIndex++;
  }

  const left = averagePoints[curveIndex];
  const right = averagePoints[Math.min(curveIndex + 1, averagePoints.length - 1)];
  const span = right.x - left.x;
  const ratio = span > 0 ? (plotX - left.x) / span : 0;
  const averageY = left.y + (right.y - left.y) * ratio;
  const upperY = Math.max(PLOT.top, averageY - verticalDistance);
  const lowerY = Math.min(PLOT.bottom, averageY + verticalDistance);

  return plotY >= upperY && plotY <= lowerY ? nearestIndex : -1;
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
