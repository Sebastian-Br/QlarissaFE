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

export function hoverBasePath(
  points: { x: number; y: number }[],
  verticalDistance: number,
) {
  if (!points.length) return "";
  const regions = points.map((point, index) => ({
    left: index === 0 ? PLOT.left : (points[index - 1].x + point.x) / 2,
    right:
      index === points.length - 1
        ? PLOT.right
        : (point.x + points[index + 1].x) / 2,
    top: Math.max(PLOT.top, point.y - verticalDistance),
    bottom: Math.min(PLOT.bottom, point.y + verticalDistance),
  }));
  return regions
    .map(
      (region) =>
        `M ${region.left} ${region.top} H ${region.right} V ${region.bottom} H ${region.left} Z`,
    )
    .join(" ");
}

export function hoverBandPath(
  points: { x: number; y: number }[],
  horizontalReach: number,
  verticalDistance: number,
) {
  return points
    .map((point) => {
      const left = Math.max(PLOT.left, point.x - horizontalReach);
      const right = Math.min(PLOT.right, point.x + horizontalReach);
      const top = Math.max(PLOT.top, point.y - verticalDistance);
      const bottom = Math.min(PLOT.bottom, point.y + verticalDistance);
      return `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`;
    })
    .join(" ");
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

  if (alwaysHover) {
    let closestIndex = 0;
    let closestDistance = Math.abs(plotX - points[0].x);
    for (let index = 1; index < points.length; index++) {
      const distance = Math.abs(plotX - points[index].x);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }
    return closestIndex;
  }

  let isHoverable = false;

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
    const inBaseRegion =
      plotX >= left &&
      plotX <= right &&
      plotY >= top &&
      plotY <= bottom;
    const inEasingBand =
      plotX >= Math.max(PLOT.left, point.x - horizontalReach) &&
      plotX <= Math.min(PLOT.right, point.x + horizontalReach) &&
      plotY >= top &&
      plotY <= bottom;

    if (inBaseRegion || inEasingBand) {
      isHoverable = true;
      break;
    }
  }

  if (!isHoverable) return -1;

  let closestIndex = 0;
  let closestDistance = Math.abs(plotX - points[0].x);
  for (let index = 1; index < points.length; index++) {
    const distance = Math.abs(plotX - points[index].x);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }
  return closestIndex;
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
