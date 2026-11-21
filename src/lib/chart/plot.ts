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
  verticalDistance: number,
  averagePointsOverride?: { x: number; y: number }[],
) {
  return movingAverageHoverPath(
    points,
    verticalDistance,
    averagePointsOverride,
  );
}

export function movingAverageHoverPath(
  points: ({ x: number; y: number } & { date?: string })[],
  verticalDistance: number,
  averagePointsOverride?: { x: number; y: number }[],
) {
  if (!points.length) return "";
  const averagePoints =
    averagePointsOverride ?? movingAveragePoints(points);
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

  const pathChunks = [`M ${upper[0].x} ${upper[0].y}`];
  for (let index = 1; index < upper.length; index++) {
    pathChunks.push(`L ${upper[index].x} ${upper[index].y}`);
  }
  for (let index = lower.length - 1; index >= 0; index--) {
    pathChunks.push(`L ${lower[index].x} ${lower[index].y}`);
  }
  pathChunks.push("Z");
  return pathChunks.join(" ");
}

export function fullPlotHoverPath() {
  return `M ${PLOT.left} ${PLOT.top} H ${PLOT.right} V ${PLOT.bottom} H ${PLOT.left} Z`;
}

export function movingAveragePoints(
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

export function horizontalLineTouchesHoverSurface(
  points: { x: number; y: number }[],
  lineX: number,
  lineY: number,
  horizontalReach: number,
  verticalDistance: number,
  averagePointsOverride?: { x: number; y: number }[],
) {
  if (
    lineX < PLOT.left ||
    lineX > PLOT.right ||
    lineY < PLOT.top ||
    lineY > PLOT.bottom ||
    horizontalReach <= 0
  )
    return false;

  const averagePoints =
    averagePointsOverride ?? movingAveragePoints(points);
  const lineLeft = Math.max(PLOT.left, lineX - horizontalReach);
  const lineRight = Math.min(PLOT.right, lineX + horizontalReach);

  let low = 0;
  let high = averagePoints.length - 1;
  let firstIndex = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (averagePoints[mid].x < lineLeft) low = mid + 1;
    else {
      firstIndex = mid;
      high = mid - 1;
    }
  }

  for (
    let index = Math.max(0, firstIndex - 1);
    index < averagePoints.length - 1;
    index++
  ) {
    const left = averagePoints[index];
    const right = averagePoints[index + 1];
    if (right.x < lineLeft) continue;
    if (left.x > lineRight) break;

    const overlapLeft = Math.max(lineLeft, left.x);
    const overlapRight = Math.min(lineRight, right.x);
    if (overlapRight < overlapLeft) continue;

    const span = right.x - left.x;
    if (span <= 0) continue;
    const ratioLeft = (overlapLeft - left.x) / span;
    const ratioRight = (overlapRight - left.x) / span;
    const averageLeft = left.y + (right.y - left.y) * ratioLeft;
    const averageRight = left.y + (right.y - left.y) * ratioRight;
    const upperLeft = Math.max(PLOT.top, averageLeft - verticalDistance);
    const upperRight = Math.max(PLOT.top, averageRight - verticalDistance);
    const lowerLeft = Math.min(PLOT.bottom, averageLeft + verticalDistance);
    const lowerRight = Math.min(PLOT.bottom, averageRight + verticalDistance);
    const highestUpper = Math.max(upperLeft, upperRight);
    const lowestLower = Math.min(lowerLeft, lowerRight);
    if (lineY >= highestUpper && lineY <= lowestLower) return true;
  }
  return false;
}

export function findHoveredPlotIndex(
  points: { x: number; y: number }[],
  plotX: number,
  plotY: number,
  horizontalReach: number,
  verticalDistance: number,
  alwaysHover: boolean,
  averagePointsOverride?: { x: number; y: number }[],
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

  const averagePoints =
    averagePointsOverride ?? movingAveragePoints(points);
  if (!averagePoints.length) return -1;

  if (horizontalReach <= 0) {
    let segmentIndex = 0;
    while (
      segmentIndex < averagePoints.length - 1 &&
      averagePoints[segmentIndex + 1].x < plotX
    ) {
      segmentIndex++;
    }
    const left = averagePoints[segmentIndex];
    const right = averagePoints[Math.min(segmentIndex + 1, averagePoints.length - 1)];
    const span = right.x - left.x;
    const ratio = span > 0 ? (plotX - left.x) / span : 0;
    const averageY = left.y + (right.y - left.y) * ratio;
    const upperY = Math.max(PLOT.top, averageY - verticalDistance);
    const lowerY = Math.min(PLOT.bottom, averageY + verticalDistance);
    return plotY >= upperY && plotY <= lowerY ? nearestIndex : -1;
  }

  const lineLeft = Math.max(PLOT.left, plotX - horizontalReach);
  const lineRight = Math.min(PLOT.right, plotX + horizontalReach);

  let firstIndex = 0;
  low = 0;
  high = averagePoints.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (averagePoints[mid].x < lineLeft) low = mid + 1;
    else {
      firstIndex = mid;
      high = mid - 1;
    }
  }

  for (
    let index = Math.max(0, firstIndex - 1);
    index < averagePoints.length - 1;
    index++
  ) {
    const leftPoint = averagePoints[index];
    const rightPoint = averagePoints[index + 1];
    if (leftPoint.x > lineRight) break;

    const overlapLeft = Math.max(lineLeft, leftPoint.x);
    const overlapRight = Math.min(lineRight, rightPoint.x);
    if (overlapRight < overlapLeft) continue;

    const segmentWidth = rightPoint.x - leftPoint.x;
    if (segmentWidth <= 0) continue;

    for (const x of [
      overlapLeft,
      (overlapLeft + overlapRight) / 2,
      overlapRight,
    ]) {
      const ratio = (x - leftPoint.x) / segmentWidth;
      const averageY =
        leftPoint.y + (rightPoint.y - leftPoint.y) * ratio;
      const upperY = Math.max(PLOT.top, averageY - verticalDistance);
      const lowerY = Math.min(PLOT.bottom, averageY + verticalDistance);
      if (plotY >= upperY && plotY <= lowerY) return nearestIndex;
    }
  }
  return -1;
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
