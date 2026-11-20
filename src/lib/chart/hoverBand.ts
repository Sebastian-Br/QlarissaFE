import { PLOT } from "./plot";

const SAMPLE_COUNT = 241;
const SMOOTHING_RADIUS = 8;

export interface HoverBand {
  top: number[];
  bottom: number[];
}

function sampleX(index: number) {
  return PLOT.left + (index / (SAMPLE_COUNT - 1)) * PLOT.width;
}

function smooth(values: number[]) {
  return values.map((_, index) => {
    const from = Math.max(0, index - SMOOTHING_RADIUS);
    const to = Math.min(values.length - 1, index + SMOOTHING_RADIUS);
    let sum = 0;
    for (let i = from; i <= to; i++) sum += values[i];
    return sum / (to - from + 1);
  });
}

export function createHoverBand(
  pointYAtPlotX: (plotX: number) => number,
  verticalDistance: number,
): HoverBand {
  const top: number[] = [];
  const bottom: number[] = [];
  for (let index = 0; index < SAMPLE_COUNT; index++) {
    const y = pointYAtPlotX(sampleX(index));
    top.push(Math.max(PLOT.top, y - verticalDistance));
    bottom.push(Math.min(PLOT.bottom, y + verticalDistance));
  }
  return { top: smooth(top), bottom: smooth(bottom) };
}

export function hoverBandAt(band: HoverBand, plotX: number) {
  const position = Math.max(
    0,
    Math.min(
      SAMPLE_COUNT - 1,
      ((plotX - PLOT.left) / PLOT.width) * (SAMPLE_COUNT - 1),
    ),
  );
  const low = Math.floor(position);
  const high = Math.min(SAMPLE_COUNT - 1, low + 1);
  const t = position - low;
  const at = (values: number[]) =>
    values[low] + (values[high] - values[low]) * t;
  return { top: at(band.top), bottom: at(band.bottom) };
}

export function hoverBandPath(band: HoverBand) {
  const last = SAMPLE_COUNT - 1;
  const commands: string[] = [];
  for (let index = 0; index <= last; index++)
    commands.push(`${index === 0 ? "M" : "L"} ${sampleX(index)} ${band.top[index]}`);
  for (let index = last; index >= 0; index--)
    commands.push(`L ${sampleX(index)} ${band.bottom[index]}`);
  commands.push("Z");
  return commands.join(" ");
}
