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
  horizontalReach: number,
  verticalDistance: number,
) {
  if (!points.length) return "";

  let path = "";
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const left =
      index === 0
        ? PLOT.left
        : (points[index - 1].x + point.x) / 2;
    const right =
      index === points.length - 1
        ? PLOT.right
        : (point.x + points[index + 1].x) / 2;
    const top = Math.max(PLOT.top, point.y - verticalDistance);
    const bottom = Math.min(PLOT.bottom, point.y + verticalDistance);
    path += `M ${left} ${top} H ${right} V ${bottom} H ${left} Z `;

    if (horizontalReach > 0) {
      const bandLeft = Math.max(PLOT.left, point.x - horizontalReach);
      const bandRight = Math.min(PLOT.right, point.x + horizontalReach);
      path += `M ${bandLeft} ${top} H ${bandRight} V ${bottom} H ${bandLeft} Z `;
    }
  }
  return path.trim();
}

export function fullPlotHoverPath() {
  return `M ${PLOT.left} ${PLOT.top} H ${PLOT.right} V ${PLOT.bottom} H ${PLOT.left} Z`;
}

export function findHoveredPlotIndex(
  points: { x: number; y: number }[],
  plotX: number,
  plotY: number,
  horizontalReach: number,
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

  const withinVerticalBand = (point: { x: number; y: number }) =>
    plotY >= Math.max(PLOT.top, point.y - verticalDistance) &&
    plotY <= Math.min(PLOT.bottom, point.y + verticalDistance);

  for (
    let index = Math.max(0, nearestIndex - 1);
    index <= Math.min(points.length - 1, nearestIndex + 1);
    index++
  ) {
    const point = points[index];
    const left =
      index === 0
        ? PLOT.left
        : (points[index - 1].x + point.x) / 2;
    const right =
      index === points.length - 1
        ? PLOT.right
        : (point.x + points[index + 1].x) / 2;
    if (plotX >= left && plotX <= right && withinVerticalBand(point))
      return nearestIndex;
  }

  if (horizontalReach > 0) {
    low = 0;
    high = points.length - 1;
    let firstBandIndex = points.length;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (points[mid].x + horizontalReach < plotX) low = mid + 1;
      else {
        firstBandIndex = mid;
        high = mid - 1;
      }
    }
    for (
      let index = firstBandIndex;
      index < points.length &&
      points[index].x - horizontalReach <= plotX;
      index++
    ) {
      if (withinVerticalBand(points[index])) return nearestIndex;
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
