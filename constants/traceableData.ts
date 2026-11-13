/**
 * Traceable character geometry for the Bakas tracing game.
 *
 * Coordinate space matches the SVG viewBox used by the tracing screens: 0..400 x 0..600.
 * Each character is described as a list of strokes (polylines / control points).
 * `buildCharacter` converts those strokes into:
 *   - `path`     : SVG path data
 *   - `points`   : hit targets the learner must touch (shown as red dots)
 *   - `segments` : line segments used for "is the finger on the stroke?" checks
 */

export type TracePoint = { x: number; y: number };
export type HitPoint = {
  id: number;
  x: number;
  y: number;
  /** Which stroke this checkpoint belongs to. */
  strokeId: number;
  /** First/last checkpoint of a stroke — children rarely start or stop exactly on the mark. */
  endpoint: boolean;
};
export type TraceSegment = { x1: number; y1: number; x2: number; y2: number };

export type TraceCharacter = {
  path: string;
  points: HitPoint[];
  segments: TraceSegment[];
};

/** Rounds to one decimal so path strings stay short. */
const r = (value: number) => Math.round(value * 10) / 10;

/**
 * Catmull-Rom interpolation through the given control points.
 * Two-point strokes are returned as-is (straight lines).
 */
function smooth(points: TracePoint[], stepsPerSegment = 10): TracePoint[] {
  if (points.length <= 2) return points;

  const padded = [points[0], ...points, points[points.length - 1]];
  const result: TracePoint[] = [];

  for (let i = 0; i < padded.length - 3; i++) {
    const p0 = padded[i];
    const p1 = padded[i + 1];
    const p2 = padded[i + 2];
    const p3 = padded[i + 3];

    for (let step = 0; step < stepsPerSegment; step++) {
      const t = step / stepsPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;

      result.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

/** Total polyline length. */
function strokeLength(stroke: TracePoint[]): number {
  let total = 0;
  for (let i = 1; i < stroke.length; i++) {
    total += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
  }
  return total;
}

/** Returns the point at `distance` along the polyline (clamped to the ends). */
function pointAtDistance(stroke: TracePoint[], distance: number): TracePoint {
  let travelled = 0;
  for (let i = 1; i < stroke.length; i++) {
    const segment = Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
    if (travelled + segment >= distance) {
      const ratio = segment === 0 ? 0 : (distance - travelled) / segment;
      return {
        x: stroke[i - 1].x + (stroke[i].x - stroke[i - 1].x) * ratio,
        y: stroke[i - 1].y + (stroke[i].y - stroke[i - 1].y) * ratio,
      };
    }
    travelled += segment;
  }
  return stroke[stroke.length - 1];
}

/**
 * Spreads hit points evenly along a stroke by arc length.
 * A closed loop (start ~= end) contributes `count - 1` unique points.
 */
function sampleStroke(stroke: TracePoint[]): TracePoint[] {
  const total = strokeLength(stroke);
  if (total < 1) return [stroke[0]];

  const count = Math.min(5, Math.max(2, Math.round(total / 140)));
  const samples: TracePoint[] = [];
  for (let i = 0; i < count; i++) {
    samples.push(pointAtDistance(stroke, (total * i) / (count - 1)));
  }
  return samples;
}

/** Converts stroke definitions into SVG path data + hit points + segments. */
export function buildCharacter(strokes: TracePoint[][]): TraceCharacter {
  const denseStrokes = strokes
    .map((stroke) => smooth(stroke))
    .filter((stroke) => stroke.length > 0);

  const path = denseStrokes
    .map((stroke) => {
      const [first, ...rest] = stroke;
      const move = `M${r(first.x)},${r(first.y)}`;
      const lines = rest.map((point) => `L${r(point.x)},${r(point.y)}`).join(' ');
      return lines ? `${move} ${lines}` : move;
    })
    .join(' ');

  const segments: TraceSegment[] = [];
  for (const stroke of denseStrokes) {
    for (let i = 0; i < stroke.length - 1; i++) {
      segments.push({
        x1: r(stroke[i].x),
        y1: r(stroke[i].y),
        x2: r(stroke[i + 1].x),
        y2: r(stroke[i + 1].y),
      });
    }
  }

  const points: HitPoint[] = [];
  let nextId = 1;

  denseStrokes.forEach((stroke, strokeId) => {
    const samples = sampleStroke(stroke);
    samples.forEach((point, index) => {
      const duplicate = points.some(
        (existing) => Math.hypot(existing.x - point.x, existing.y - point.y) < 22
      );
      if (!duplicate) {
        points.push({
          id: nextId++,
          x: r(point.x),
          y: r(point.y),
          strokeId,
          endpoint: index === 0 || index === samples.length - 1,
        });
      }
    });
  });

  return { path, points, segments };
}

const p = (x: number, y: number): TracePoint => ({ x, y });

// ---------------------------------------------------------------------------
// Letters A–Z
// ---------------------------------------------------------------------------

const LETTER_STROKES: Record<string, TracePoint[][]> = {
  A: [
    [p(200, 100), p(100, 450)],
    [p(200, 100), p(300, 450)],
    [p(145, 320), p(255, 320)],
  ],
  B: [
    [p(150, 100), p(150, 500)],
    [
      p(150, 100), p(245, 115), p(255, 215), p(210, 285),
      p(150, 300), p(215, 320), p(265, 395), p(255, 480), p(150, 500),
    ],
  ],
  C: [
    [
      p(280, 140), p(230, 100), p(170, 100), p(120, 150), p(100, 250),
      p(100, 350), p(120, 450), p(170, 500), p(230, 500), p(280, 460),
    ],
  ],
  D: [
    [p(150, 100), p(150, 500)],
    [
      p(150, 100), p(240, 130), p(290, 250),
      p(290, 350), p(240, 470), p(150, 500),
    ],
  ],
  E: [
    [p(150, 100), p(150, 500)],
    [p(150, 100), p(280, 100)],
    [p(150, 300), p(250, 300)],
    [p(150, 500), p(280, 500)],
  ],
  F: [
    [p(150, 100), p(150, 500)],
    [p(150, 100), p(280, 100)],
    [p(150, 300), p(250, 300)],
  ],
  G: [
    [
      p(280, 140), p(230, 100), p(170, 100), p(120, 150), p(100, 250),
      p(100, 350), p(120, 450), p(170, 500), p(230, 500), p(280, 460), p(280, 360),
    ],
    [p(280, 360), p(210, 360)],
  ],
  H: [
    [p(130, 100), p(130, 500)],
    [p(270, 100), p(270, 500)],
    [p(130, 300), p(270, 300)],
  ],
  I: [
    [p(150, 100), p(250, 100)],
    [p(200, 100), p(200, 500)],
    [p(150, 500), p(250, 500)],
  ],
  J: [
    [
      p(250, 100), p(250, 380), p(240, 450),
      p(200, 495), p(150, 490), p(115, 440), p(105, 400),
    ],
  ],
  K: [
    [p(140, 100), p(140, 500)],
    [p(270, 100), p(140, 300)],
    [p(140, 300), p(285, 500)],
  ],
  L: [
    [p(150, 100), p(150, 500)],
    [p(150, 500), p(280, 500)],
  ],
  M: [
    [p(110, 500), p(110, 100)],
    [p(110, 100), p(200, 340)],
    [p(200, 340), p(290, 100)],
    [p(290, 100), p(290, 500)],
  ],
  N: [
    [p(110, 500), p(110, 100)],
    [p(110, 100), p(290, 500)],
    [p(290, 500), p(290, 100)],
  ],
  O: [
    [
      p(200, 100), p(285, 160), p(300, 300), p(285, 440),
      p(200, 500), p(115, 440), p(100, 300), p(115, 160), p(200, 100),
    ],
  ],
  P: [
    [p(150, 100), p(150, 500)],
    [p(150, 100), p(235, 130), p(245, 220), p(210, 290), p(150, 300)],
  ],
  Q: [
    [
      p(200, 100), p(285, 160), p(300, 300), p(285, 440),
      p(200, 500), p(115, 440), p(100, 300), p(115, 160), p(200, 100),
    ],
    [p(225, 400), p(300, 520)],
  ],
  R: [
    [p(150, 100), p(150, 500)],
    [p(150, 100), p(235, 130), p(245, 220), p(210, 290), p(150, 300)],
    [p(195, 295), p(290, 500)],
  ],
  S: [
    [
      p(280, 140), p(240, 110), p(180, 110), p(140, 145), p(150, 200),
      p(210, 240), p(250, 280), p(255, 330), p(225, 380), p(170, 400),
      p(120, 370), p(105, 330),
    ],
  ],
  T: [
    [p(110, 100), p(290, 100)],
    [p(200, 100), p(200, 500)],
  ],
  U: [
    [p(120, 100), p(120, 380)],
    [p(120, 380), p(150, 465), p(200, 500), p(250, 465), p(280, 380)],
    [p(280, 100), p(280, 380)],
  ],
  V: [
    [p(110, 100), p(200, 500)],
    [p(200, 500), p(290, 100)],
  ],
  W: [
    [p(100, 100), p(140, 500)],
    [p(140, 500), p(200, 250)],
    [p(200, 250), p(260, 500)],
    [p(260, 500), p(300, 100)],
  ],
  X: [
    [p(110, 100), p(290, 500)],
    [p(290, 100), p(110, 500)],
  ],
  Y: [
    [p(110, 100), p(200, 300)],
    [p(290, 100), p(200, 300)],
    [p(200, 300), p(200, 500)],
  ],
  Z: [
    [p(110, 100), p(290, 100)],
    [p(290, 100), p(110, 500)],
    [p(110, 500), p(290, 500)],
  ],
};

// ---------------------------------------------------------------------------
// Numbers 0–9
// ---------------------------------------------------------------------------

const NUMBER_STROKES: Record<string, TracePoint[][]> = {
  '0': [
    [
      p(200, 100), p(275, 160), p(290, 300), p(275, 440),
      p(200, 500), p(125, 440), p(110, 300), p(125, 160), p(200, 100),
    ],
  ],
  '1': [
    [p(150, 180), p(200, 100)],
    [p(200, 100), p(200, 500)],
    [p(140, 500), p(260, 500)],
  ],
  '2': [
    [
      p(110, 160), p(150, 110), p(210, 110), p(260, 150),
      p(265, 210), p(230, 270), p(150, 360), p(110, 470),
    ],
    [p(110, 470), p(110, 500)],
    [p(110, 500), p(290, 500)],
  ],
  '3': [
    [p(110, 130), p(160, 100), p(220, 100), p(270, 140), p(270, 200), p(220, 250), p(170, 260)],
    [p(170, 260), p(220, 270), p(270, 310), p(270, 390), p(230, 470), p(170, 500), p(110, 470)],
  ],
  '4': [
    [p(230, 100), p(110, 380)],
    [p(110, 380), p(300, 380)],
    [p(230, 100), p(230, 500)],
  ],
  '5': [
    [p(270, 100), p(140, 100)],
    [p(140, 100), p(130, 280)],
    [p(130, 280), p(180, 250), p(230, 250), p(275, 290), p(285, 360), p(255, 440), p(195, 500), p(125, 480)],
  ],
  '6': [
    [
      p(250, 110), p(200, 100), p(150, 140), p(120, 220), p(110, 320),
      p(120, 420), p(160, 490), p(210, 500), p(250, 470), p(260, 420),
      p(240, 360), p(200, 330), p(150, 340), p(115, 380),
    ],
  ],
  '7': [
    [p(110, 100), p(290, 100)],
    [p(290, 100), p(180, 500)],
  ],
  '8': [
    [p(200, 100), p(260, 140), p(260, 200), p(200, 250), p(140, 200), p(140, 140), p(200, 100)],
    [p(200, 250), p(270, 300), p(280, 380), p(250, 470), p(200, 500), p(150, 470), p(120, 380), p(130, 300), p(200, 250)],
  ],
  '9': [
    [
      p(150, 490), p(200, 500), p(250, 460), p(280, 380), p(290, 280),
      p(280, 180), p(240, 110), p(190, 100), p(150, 130), p(140, 180),
      p(160, 240), p(200, 270), p(250, 260), p(285, 220),
    ],
  ],
};

export const TRACEABLE_LETTERS = Object.keys(LETTER_STROKES).sort();
export const TRACEABLE_NUMBERS = Object.keys(NUMBER_STROKES).sort();

/** Anchor words shown on the success card (text only — no image/audio assets yet). */
export const ANCHOR_WORDS: Record<string, string> = {
  A: 'Atis',
  B: 'Bahay',
  C: 'Cake',
  D: 'Dagat',
  E: 'Eroplano',
  F: 'Flores',
  G: 'Gatas',
  H: 'Halaman',
  I: 'Ibon',
  J: 'Jacket',
  K: 'Kambing',
  L: 'Langit',
  M: 'Mata',
  N: 'Niyog',
  O: 'Orasan',
  P: 'Pusa',
  Q: 'Quezo',
  R: 'Rosas',
  S: 'Saging',
  T: 'Tao',
  U: 'Ulan',
  V: 'Violin',
  W: 'Watawat',
  X: 'Xylophone',
  Y: 'Yoyo',
  Z: 'Zebra',
  '0': 'Zero',
  '1': 'Isa',
  '2': 'Dalawa',
  '3': 'Tatlo',
  '4': 'Apat',
  '5': 'Lima',
  '6': 'Anim',
  '7': 'Pito',
  '8': 'Walo',
  '9': 'Siyam',
};

export const TRACEABLE_DATA: Record<string, TraceCharacter> = Object.fromEntries(
  [
    ...Object.entries(LETTER_STROKES),
    ...Object.entries(NUMBER_STROKES),
  ].map(([character, strokes]) => [character, buildCharacter(strokes)])
);
