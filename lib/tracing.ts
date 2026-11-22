/**
 * Shared tracing maths for the Bakás game.
 *
 * All coordinates are in the 400×600 viewBox used by the tracing screens.
 */

/** How close the finger must be to the guide line, in viewBox units. */
export const TRACE_TOLERANCE = 55;

/**
 * Endpoint checkpoints (the first/last dot of each stroke) get a wider radius
 * because children rarely start or stop exactly on the mark.
 */
export const ENDPOINT_TOLERANCE = 90;

/** Fraction of the guide line that must actually be traced. */
export const REQUIRED_COVERAGE = 0.7;

/** Minimum number of move samples so a single tap cannot finish a letter. */
export const MIN_MOVES = 8;

export type Point = { x: number; y: number };
export type Segment = { x1: number; y1: number; x2: number; y2: number; strokeId?: number };
export type Dot = Point & { id: number; endpoint?: boolean };

/** How close the finger must be to count a specific checkpoint as reached. */
export function dotTolerance(point: { endpoint?: boolean }): number {
  return point.endpoint ? ENDPOINT_TOLERANCE : TRACE_TOLERANCE;
}

/**
 * Keeps the 400×600 viewBox exactly filling the drawing area.
 * Without this the SVG letterboxes inside a differently shaped container and
 * every touch lands a few centimetres off the real stroke.
 */
export function fitTracingCanvas(maxWidth: number, maxHeight: number) {
  const width = Math.min(maxWidth, (maxHeight * 400) / 600);
  return { width, height: (width * 600) / 400 };
}

/** Shortest distance from a point to a line segment. */
export function distanceToSegment(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x - x1;
  const dy = y - y1;
  const segX = x2 - x1;
  const segY = y2 - y1;
  const lengthSq = segX * segX + segY * segY;

  let t = 0;
  if (lengthSq !== 0) {
    t = (dx * segX + dy * segY) / lengthSq;
    t = Math.max(0, Math.min(1, t));
  }

  const closestX = x1 + t * segX;
  const closestY = y1 + t * segY;
  return Math.hypot(x - closestX, y - closestY);
}

/**
 * Marks every segment the finger is touching and returns the distance to the
 * nearest one. Used for both the "on the line?" check and path coverage.
 */
export function markCoveredSegments(
  x: number,
  y: number,
  segments: Segment[] | undefined,
  tolerance: number,
  covered: Set<number>
): number {
  if (!segments || segments.length === 0) return Number.POSITIVE_INFINITY;

  let shortest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const distance = distanceToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
    if (distance <= tolerance) covered.add(i);
    if (distance < shortest) shortest = distance;
  }
  return shortest;
}

/**
 * Like markCoveredSegments, but only colours the stroke the finger is actually
 * on. Without this, two nearby strokes (e.g. the legs of "A" near the apex)
 * would both light up from a single touch.
 */
export function markStrokeCoverage(
  x: number,
  y: number,
  segments: Segment[] | undefined,
  tolerance: number,
  covered: Set<number>
): number {
  if (!segments || segments.length === 0) return Number.POSITIVE_INFINITY;

  let nearestStrokeId: number | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const seg of segments) {
    const distance = distanceToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestStrokeId = seg.strokeId;
    }
  }

  let shortest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (nearestStrokeId !== undefined && seg.strokeId !== nearestStrokeId) continue;
    const distance = distanceToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
    if (distance <= tolerance) covered.add(i);
    if (distance < shortest) shortest = distance;
  }
  return shortest;
}

/** Every guide dot must be reached before the reward unlocks. */
export function requiredHits(totalPoints: number): number {
  return totalPoints;
}

/** Turns a stroke (list of points) into evenly spaced samples. */
export function samplePolyline(points: Point[], spacing = 4): Point[] {
  if (points.length === 0) return [];

  const samples: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(length / spacing));
    for (let s = 1; s <= steps; s++) {
      samples.push({
        x: a.x + ((b.x - a.x) * s) / steps,
        y: a.y + ((b.y - a.y) * s) / steps,
      });
    }
  }
  return samples;
}

export type TraceAnalysis = {
  hits: number[];
  covered: Set<number>;
  /** Segments from the stroke actually traced — used for the coloured fill. */
  fillCovered: Set<number>;
  moves: number;
  offPath: number;
};

/**
 * Replays the strokes the learner has drawn and recomputes dots, coverage and
 * accuracy. Undo uses this so the game state always matches what is on screen.
 */
export function analyseStrokes(
  strokes: Point[][],
  dots: Dot[],
  segments: Segment[] | undefined,
  tolerance: number,
  endpointTolerance: number
): TraceAnalysis {
  const hits = new Set<number>();
  const covered = new Set<number>();
  const fillCovered = new Set<number>();
  let moves = 0;
  let offPath = 0;

  for (const stroke of strokes) {
    for (const sample of samplePolyline(stroke)) {
      moves++;

      for (const dot of dots) {
        const allowed = dot.endpoint ? endpointTolerance : tolerance;
        if (Math.hypot(sample.x - dot.x, sample.y - dot.y) <= allowed) {
          hits.add(dot.id);
        }
      }

      let nearest = Number.POSITIVE_INFINITY;
      if (segments) {
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const distance = distanceToSegment(sample.x, sample.y, seg.x1, seg.y1, seg.x2, seg.y2);
          if (distance <= tolerance) covered.add(i);
          if (distance < nearest) nearest = distance;
        }
        markStrokeCoverage(sample.x, sample.y, segments, tolerance, fillCovered);
      }
      if (nearest > tolerance) offPath++;
    }
  }

  return { hits: [...hits], covered, fillCovered, moves, offPath };
}
