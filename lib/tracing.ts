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

/** A stroke shorter than this is a tap/dot-poke, not a traced line. */
export const MIN_STROKE_LENGTH = 20;
/** A stroke needs this many samples before it counts toward completion. */
export const MIN_STROKE_MOVES = 6;

/** Length of a polyline in viewBox units. */
export function strokeLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

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

/** Which stroke a point is closest to — used to lock a finger onto one stroke. */
export function nearestStrokeId(
  x: number,
  y: number,
  segments: Segment[] | undefined
): number | undefined {
  if (!segments || segments.length === 0) return undefined;
  let result: number | undefined;
  let nearest = Number.POSITIVE_INFINITY;
  for (const seg of segments) {
    const distance = distanceToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
    if (distance < nearest) {
      nearest = distance;
      result = seg.strokeId;
    }
  }
  return result;
}

/**
 * Like markCoveredSegments, but only colours the stroke the finger is actually
 * on. Without this, two nearby strokes (e.g. the legs of "A" near the apex)
 * would both light up from a single touch. Pass `lockedStrokeId` while the
 * finger stays on one stroke so tight curves cannot jump to a neighbour.
 */
export function markStrokeCoverage(
  x: number,
  y: number,
  segments: Segment[] | undefined,
  tolerance: number,
  covered: Set<number>,
  lockedStrokeId?: number
): number {
  if (!segments || segments.length === 0) return Number.POSITIVE_INFINITY;
  if (lockedStrokeId !== undefined) {
    let shortest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.strokeId !== lockedStrokeId) continue;
      const distance = distanceToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
      if (distance <= tolerance) covered.add(i);
      if (distance < shortest) shortest = distance;
    }
    return shortest;
  }

  const nearestStrokeIdValue = nearestStrokeId(x, y, segments);
  let shortest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (nearestStrokeIdValue !== undefined && seg.strokeId !== nearestStrokeIdValue) continue;
    const distance = distanceToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
    if (distance <= tolerance) covered.add(i);
    if (distance < shortest) shortest = distance;
  }
  return shortest;
}

/** Every guide dot must be reached before the reward unlocks. */
/**
 * Completion guard: every stroke of the character must have been traced, not
 * just enough dots/coverage overall. Short connector strokes (like the crossbar
 * of "A") sit right beside the long legs, so their dots and segments can be
 * reached accidentally without ever drawing them.
 */
export function allStrokesTraced(
  segments: Segment[],
  covered: Set<number>,
  fraction = 0.5
): boolean {
  const ids = [...new Set(segments.map((segment) => segment.strokeId))];
  if (ids.length === 0) return true;

  return ids.every((id) => {
    let total = 0;
    let traced = 0;
    segments.forEach((segment, index) => {
      if (segment.strokeId !== id) return;
      total++;
      if (covered.has(index)) traced++;
    });
    return total === 0 || traced / total >= fraction;
  });
}

export function requiredHits(totalPoints: number): number {
  return totalPoints;
}

/** Spacing used when replaying strokes for completion checks (viewBox units). */
export const ANALYSIS_SAMPLE_SPACING = 6;

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
    // Ignore dot-pokes: a real stroke must travel along the letter.
    const samples = samplePolyline(stroke, ANALYSIS_SAMPLE_SPACING);
    if (samples.length < MIN_STROKE_MOVES || strokeLength(stroke) < MIN_STROKE_LENGTH) {
      continue;
    }

    for (const sample of samples) {
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
