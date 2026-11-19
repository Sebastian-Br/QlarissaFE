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
  const last = regions.length - 1;
  const commands = [`M ${regions[0].left} ${regions[0].top}`];
  regions.forEach((region, index) => {
    commands.push(`H ${region.right}`);
    if (index < last) commands.push(`V ${regions[index + 1].top}`);
  });
  commands.push(`V ${regions[last].bottom}`);
  for (let index = last; index >= 0; index--) {
    commands.push(`H ${regions[index].left}`);
    if (index > 0) commands.push(`V ${regions[index - 1].bottom}`);
  }
  commands.push("Z");
  return commands.join(" ");
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
