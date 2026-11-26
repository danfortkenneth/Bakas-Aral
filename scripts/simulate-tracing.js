/**
 * Reproducible tracing-rule simulation for QA.
 *
 * Run: node scripts/simulate-tracing.js
 *
 * Transpiles the geometry/math modules in memory (no build step) and checks:
 *   - child-like jittered traces complete all 36 characters
 *   - isolated dot taps never complete a character
 *   - every stroke must be traced before completion
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const root = process.cwd();
const outDir = path.join(os.tmpdir(), 'bakas-qa');
fs.mkdirSync(outDir, { recursive: true });

function transpile(rel) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const dest = path.join(outDir, rel.replace(/[\\/]/g, '__').replace(/\.ts$/, '.js'));
  fs.writeFileSync(dest, js);
  return dest;
}

const dataPath = transpile('constants/traceableData.ts');
const tracingPath = transpile('lib/tracing.ts');
const { TRACEABLE_DATA } = require(dataPath);
const {
  analyseStrokes,
  allStrokesTraced,
  ENDPOINT_TOLERANCE,
  REQUIRED_COVERAGE,
  TRACE_TOLERANCE,
  MIN_MOVES,
} = require(tracingPath);

function perfectStrokes(char) {
  const ids = [...new Set(char.segments.map((s) => s.strokeId))];
  return ids.map((id) => {
    const segs = char.segments.filter((s) => s.strokeId === id);
    return segs
      .map((s) => ({ x: s.x1, y: s.y1 }))
      .concat([{ x: segs[segs.length - 1].x2, y: segs[segs.length - 1].y2 }]);
  });
}

function simulate(strokes, char) {
  const analysis = analyseStrokes(
    strokes,
    char.points,
    char.segments,
    TRACE_TOLERANCE,
    ENDPOINT_TOLERANCE
  );
  return {
    analysis,
    done:
      analysis.hits.length === char.points.length &&
      analysis.covered.size / char.segments.length >= REQUIRED_COVERAGE &&
      analysis.moves >= MIN_MOVES &&
      allStrokesTraced(char.segments, analysis.fillCovered),
  };
}

const profiles = [
  ['careful', 10, 0],
  ['normal', 20, 25],
  ['sloppy', 30, 40],
  ['very sloppy', 40, 50],
];

for (const [label, jitter, shortBy] of profiles) {
  const failures = [];
  for (const [name, char] of Object.entries(TRACEABLE_DATA)) {
    const strokes = perfectStrokes(char).map((stroke) => {
      let total = 0;
      for (let i = 1; i < stroke.length; i++) {
        total += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
      }
      const limit = total - shortBy;
      let walked = 0;
      const kept = [stroke[0]];
      for (let i = 1; i < stroke.length; i++) {
        walked += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
        if (walked > limit) break;
        kept.push({
          x: stroke[i].x + (Math.random() - 0.5) * 2 * jitter,
          y: stroke[i].y + (Math.random() - 0.5) * 2 * jitter,
        });
      }
      if (shortBy > 0) {
        const end = stroke[stroke.length - 1];
        kept.push({
          x: end.x + (Math.random() - 0.5) * 2 * jitter,
          y: end.y + (Math.random() - 0.5) * 2 * jitter,
        });
      }
      return kept;
    });
    if (!simulate(strokes, char).done) failures.push(name);
  }
  console.log(
    `${label.padEnd(12)}: ${failures.length ? 'FAIL ' + failures.join(', ') : 'ALL 36 PASS'}`
  );
}

// Dot-poke cheat: one isolated tap per checkpoint must never complete a letter.
let cheats = 0;
for (const char of Object.values(TRACEABLE_DATA)) {
  const taps = char.points.map((p) => [{ x: p.x, y: p.y }]);
  if (simulate(taps, char).done) cheats++;
}
console.log(`dot taps     : ${cheats}/36 completed (expected 0)`);

// Stroke gate: tracing only the long legs of A must not finish (crossbar missing).
const a = TRACEABLE_DATA.A;
const legsOnly = perfectStrokes(a).filter((_, index) => index !== 2);
console.log(
  `A legs only : ${simulate(legsOnly, a).done ? 'FINISHED (bad)' : 'blocked (expected)'}`
);
