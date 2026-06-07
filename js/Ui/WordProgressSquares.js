/**
 * Emotional progress squares — chaos → shape visual layer.
 * Isolated from gameplay; only reads word.sureCount and word.id.
 */

const SQUARE_PX = 12;
const GAP_PX = 11;
const MIN_CENTER_DIST = SQUARE_PX + GAP_PX;

/** Final-shape catalog — ids map to samplers in _normalizedShapePoints */
const SHAPE_POOL_TINY = ["dot", "line"];
const SHAPE_POOL_SMALL = [
  "triangle",
  "orbit",
  "curve",
  "diamond",
  "vee",
  "arc",
  "bow",
  "cross",
  "crescent",
  "wave",
  "zigzag",
  "petal4",
  "loop",
  "kite",
  "pinwheel",
  "rose3",
  "cardioid",
  "astroid",
  "hourglass",
  "trident",
];
const SHAPE_POOL_MEDIUM = [
  "flower",
  "orbit",
  "star",
  "hex",
  "heart",
  "infinity",
  "wave",
  "diamond",
  "spiral",
  "constellation",
  "mandala",
  "wing",
  "clover",
  "gear",
  "snowflake",
  "butterfly",
  "fish",
  "bird",
  "comet",
  "galaxy",
  "burst",
  "crown",
  "lightning",
  "scribble",
  "phyllotaxis",
  "lissajous",
  "epicycloid",
  "hypotrochoid",
  "superellipse",
  "lemniscate",
  "rose5",
  "rose7",
  "doubleRing",
  "helix",
  "cascade",
  "cloud",
  "flame",
  "shield",
  "nova",
  "petal6",
  "pentagon",
  "octagon",
  "horseshoe",
  "omega",
  "bridge",
  "ripple",
  "stagger",
];
const SHAPE_POOL_LARGE = [
  ...new Set([
    ...SHAPE_POOL_MEDIUM,
    "doubleHelix",
    "fractalBranch",
    "radialBloom",
    "asymmetricWing",
    "creature",
    "constellation2",
    "orbit3d",
    "waveField",
    "starburst",
    "lotus",
    "sunwheel",
    "dragonPath",
    "abstractGlyph",
    "tessellation",
    "voronoiRing",
    "fibonacciArc",
    "lunarPhase",
    "eclipse",
    "meteorShower",
    "nebula",
    "coral",
    "fern",
    "crystal",
    "prism",
    "molecule",
    "circuit",
    "glyphSpiral",
    "woven",
    "braid",
    "harp",
    "echo",
    "pulseRing",
  ]),
];

export class WordProgressSquares {
  constructor(game, onSquareClick) {
    this.game = game;
    this.onSquareClick = onSquareClick;
    this._chaoticEl = null;
    this._previousMastered = new Set();
    this._hasRenderedOnce = false;
    this._lastComboKey = null;
    this._transitioning = new Set();
    /** @type {Map<string, { leftPx: number, topPx: number, maxDriftPx: number }>} */
    this._chaoticLayout = new Map();
    this._layoutSessionSeed = null;
    /** @type {number|null} last resolved container width for relayout */
    this._lastLayoutAreaWidth = null;
  }

  /**
   * True width of the progress strip (works while root is display:none).
   */
  _resolveAreaWidth(root) {
    const chaotic = this._chaoticEl;
    if (chaotic) {
      const cw = chaotic.clientWidth || chaotic.offsetWidth;
      if (cw > 0) return cw;
    }
    if (root) {
      const rw = root.clientWidth || root.offsetWidth;
      if (rw > 0) return rw;
      const parent = root.parentElement;
      if (parent) {
        const pw = parent.clientWidth || parent.offsetWidth;
        if (pw > 0) {
          const styles = getComputedStyle(parent);
          const padX =
            (parseFloat(styles.paddingLeft) || 0) +
            (parseFloat(styles.paddingRight) || 0);
          return Math.max(100, pw - padX);
        }
      }
    }
    return 300;
  }

  _invalidateLayoutIfWidthChanged(areaW) {
    if (
      this._lastLayoutAreaWidth != null &&
      Math.abs(areaW - this._lastLayoutAreaWidth) > 28
    ) {
      this._chaoticLayout.clear();
    }
    this._lastLayoutAreaWidth = areaW;
  }

  _isShapeBlockedEntry(p) {
    return String(p.id ?? "").startsWith("__shape_");
  }

  _storageKey(suffix) {
    return `langgame_${suffix}_${this.game.dataSetName}_${this.game.currentNiveau}_${this.game.currentMode}`;
  }

  _getRoot() {
    return document.getElementById("wordProgressSquares");
  }

  _ensureSections(root) {
    if (root.querySelector(".wps-chaotic-area")) {
      this._chaoticEl = root.querySelector(".wps-chaotic-area");
      root.querySelector(".wps-organized-area")?.remove();
      return;
    }

    root.classList.add("wps-root");
    root.innerHTML = "";
    root.classList.remove("flex", "flex-wrap", "gap-1", "justify-center");

    this._chaoticEl = document.createElement("div");
    this._chaoticEl.className = "wps-chaotic-area";
    root.appendChild(this._chaoticEl);
  }

  _hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  _seededUnit(seed, salt) {
    const x = Math.sin(seed + salt * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  _jitterFromSeed(wordId, salt, min, max) {
    const t = this._seededUnit(this._hashSeed(String(wordId)), salt);
    return min + t * (max - min);
  }

  _newSessionSeed() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  _getSessionSeed(comboKey) {
    const key = `wps_layout_${comboKey}`;
    let seed = sessionStorage.getItem(key);
    if (!seed) {
      seed = this._newSessionSeed();
      sessionStorage.setItem(key, seed);
    }
    return seed;
  }

  _shapePoolForCount(count) {
    if (count <= 1) return SHAPE_POOL_TINY;
    if (count === 2) return ["line", "vee", "arc", "bow"];
    if (count === 3) return ["triangle", "orbit", "vee", "trident", "petal4"];
    if (count <= 6) return SHAPE_POOL_SMALL;
    if (count <= 14) return SHAPE_POOL_MEDIUM;
    return SHAPE_POOL_LARGE;
  }

  _halton(index, base) {
    let f = 1;
    let r = 0;
    let i = index;
    while (i > 0) {
      f /= base;
      r += f * (i % base);
      i = Math.floor(i / base);
    }
    return r;
  }

  _zoneCounts(placed, areaW, areaH, cols, rows, margin, countShapeBlocked = false) {
    const counts = Array(cols * rows).fill(0);
    const cellW = (areaW - margin * 2) / cols;
    const cellH = (areaH - margin * 2) / rows;
    for (const p of placed) {
      if (!countShapeBlocked && this._isShapeBlockedEntry(p)) continue;
      const cx = p.leftPx + SQUARE_PX / 2 - margin;
      const cy = p.topPx + SQUARE_PX / 2 - margin;
      const col = Math.min(
        cols - 1,
        Math.max(0, Math.floor(cx / Math.max(cellW, 1))),
      );
      const row = Math.min(
        rows - 1,
        Math.max(0, Math.floor(cy / Math.max(cellH, 1))),
      );
      counts[row * cols + col]++;
    }
    return { counts, cellW, cellH };
  }

  _minCenterDist(leftPx, topPx, placed) {
    const cx = leftPx + SQUARE_PX / 2;
    const cy = topPx + SQUARE_PX / 2;
    let minD = Infinity;
    for (const p of placed) {
      minD = Math.min(
        minD,
        this._dist(cx, cy, p.leftPx + SQUARE_PX / 2, p.topPx + SQUARE_PX / 2),
      );
    }
    return minD;
  }

  /**
   * Spread candidates across the full container (Halton + zone centers + anchors).
   */
  _horizontalBandCount(areaW, totalSlots) {
    const margin = 6;
    const spanL = Math.max(MIN_CENTER_DIST, areaW - margin * 2 - SQUARE_PX);
    const byWidth = Math.max(2, Math.floor(spanL / MIN_CENTER_DIST));
    return Math.max(2, Math.min(totalSlots, byWidth));
  }

  _columnTargetX(areaW, slotIndex, totalSlots, margin = 6) {
    const maxL = Math.max(margin, areaW - SQUARE_PX - margin);
    const spanL = maxL - margin;
    const hCols = this._horizontalBandCount(areaW, totalSlots);
    const col = slotIndex % hCols;
    const bandW = spanL / hCols;
    const jitter =
      (this._seededUnit(slotIndex * 997 + totalSlots, 77) - 0.5) *
      Math.min(bandW * 0.55, MIN_CENTER_DIST * 0.9);
    return margin + (col + 0.5) * bandW + jitter - SQUARE_PX / 2;
  }

  _horizontalBalanceBonus(leftPx, areaW, placed, margin = 6) {
    const midX = margin + (areaW - margin * 2 - SQUARE_PX) / 2;
    let left = 0;
    let right = 0;
    for (const p of placed) {
      if (this._isShapeBlockedEntry(p)) continue;
      const cx = p.leftPx + SQUARE_PX / 2;
      if (cx < midX) left++;
      else right++;
    }
    const cx = leftPx + SQUARE_PX / 2;
    const onLeft = cx < midX;
    const needLeft = right - left;
    if (needLeft > 0 && onLeft) {
      return Math.min(needLeft, 5) * MIN_CENTER_DIST * 0.55;
    }
    if (needLeft < 0 && !onLeft) {
      return Math.min(-needLeft, 5) * MIN_CENTER_DIST * 0.55;
    }
    return 0;
  }

  _generateSpreadCandidates(areaW, areaH, seed, slotIndex, totalSlots) {
    const margin = 6;
    const maxL = Math.max(margin, areaW - SQUARE_PX - margin);
    const maxT = Math.max(margin, areaH - SQUARE_PX - margin);
    const spanL = maxL - margin;
    const spanT = maxT - margin;
    const out = [];
    const base = seed + slotIndex * 131 + totalSlots * 17;

    const hCols = this._horizontalBandCount(areaW, totalSlots);
    const targetX = this._columnTargetX(areaW, slotIndex, totalSlots, margin);
    const rowBands = Math.max(2, Math.floor(areaH / (MIN_CENTER_DIST * 1.45)));
    for (let r = 0; r < rowBands; r++) {
      const u = (r + 0.5) / rowBands;
      const ty = margin + u * spanT;
      out.push({ leftPx: targetX, topPx: ty, _columnTarget: true });
      const altCol = (slotIndex + 1 + r) % hCols;
      const altX =
        margin +
        (altCol + 0.5) * (spanL / hCols) -
        SQUARE_PX / 2 +
        (this._seededUnit(base, 90 + r) - 0.5) * MIN_CENTER_DIST * 0.5;
      out.push({ leftPx: altX, topPx: ty, _columnTarget: true });
    }

    const anchors = [
      [0.1, 0.12],
      [0.9, 0.12],
      [0.1, 0.88],
      [0.9, 0.88],
      [0.5, 0.1],
      [0.5, 0.9],
      [0.1, 0.5],
      [0.9, 0.5],
      [0.5, 0.5],
      [0.28, 0.28],
      [0.72, 0.28],
      [0.28, 0.72],
      [0.72, 0.72],
    ];
    anchors.forEach(([ax, ay], i) => {
      const jx = (this._seededUnit(base, 40 + i) - 0.5) * 0.08;
      const jy = (this._seededUnit(base, 60 + i) - 0.5) * 0.08;
      out.push({
        leftPx: margin + (ax + jx) * spanL,
        topPx: margin + (ay + jy) * spanT,
      });
    });

    const cols = Math.max(3, Math.floor(areaW / (MIN_CENTER_DIST * 1.65)));
    const rows = Math.max(2, Math.floor(areaH / (MIN_CENTER_DIST * 1.45)));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = (c + 0.5) / cols;
        const u = (r + 0.5) / rows;
        const jx = (this._seededUnit(base, r * cols + c) - 0.5) * 0.72;
        const jy = (this._seededUnit(base, r * cols + c + 200) - 0.5) * 0.72;
        out.push({
          leftPx: margin + (t + jx / cols) * spanL,
          topPx: margin + (u + jy / rows) * spanT,
        });
      }
    }

    for (let i = 0; i < 96; i++) {
      const h1 = this._halton(base + i * 3 + 1, 2);
      const h2 = this._halton(base + i * 5 + 2, 3);
      out.push({
        leftPx: margin + h1 * spanL,
        topPx: margin + h2 * spanT,
      });
    }

    return out;
  }

  /**
   * Farthest-point pick among spread candidates — fills container evenly.
   */
  _findBalancedOpenPosition(placed, areaW, areaH, seed, slotIndex, totalSlots) {
    const margin = 6;
    const cols = Math.max(3, Math.floor(areaW / (MIN_CENTER_DIST * 1.65)));
    const rows = Math.max(2, Math.floor(areaH / (MIN_CENTER_DIST * 1.45)));
    const { counts, cellW, cellH } = this._zoneCounts(
      placed,
      areaW,
      areaH,
      cols,
      rows,
      margin,
      false,
    );
    const minZone = Math.min(...counts, 0);
    const targetCenterX =
      this._columnTargetX(areaW, slotIndex, totalSlots, margin) + SQUARE_PX / 2;
    const maxL = Math.max(margin, areaW - SQUARE_PX - margin);

    const candidates = this._generateSpreadCandidates(
      areaW,
      areaH,
      seed,
      slotIndex,
      totalSlots,
    );

    let best = null;
    let bestScore = -Infinity;

    for (const cand of candidates) {
      const leftPx = Math.max(
        margin,
        Math.min(maxL, cand.leftPx),
      );
      const topPx = Math.max(
        margin,
        Math.min(areaH - SQUARE_PX - margin, cand.topPx),
      );
      if (this._collides(leftPx, topPx, placed)) continue;

      const cx = leftPx + SQUARE_PX / 2 - margin;
      const cy = topPx + SQUARE_PX / 2 - margin;
      const col = Math.min(
        cols - 1,
        Math.max(0, Math.floor(cx / Math.max(cellW, 1))),
      );
      const row = Math.min(
        rows - 1,
        Math.max(0, Math.floor(cy / Math.max(cellH, 1))),
      );
      const zoneCount = counts[row * cols + col];
      const zoneBonus = (minZone - zoneCount + 1) * MIN_CENTER_DIST * 0.55;
      const spread = this._minCenterDist(leftPx, topPx, placed);
      const balanceBonus = this._horizontalBalanceBonus(leftPx, areaW, placed, margin);
      const distToTarget = Math.abs(leftPx + SQUARE_PX / 2 - targetCenterX);
      const columnBonus =
        Math.max(0, MIN_CENTER_DIST * 2.2 - distToTarget) *
        (cand._columnTarget ? 1.15 : 0.85);
      const score = spread + zoneBonus + balanceBonus + columnBonus;

      if (score > bestScore) {
        bestScore = score;
        best = { leftPx, topPx };
      }
    }

    return best;
  }

  _pickRandomShape(count) {
    const pool = this._shapePoolForCount(count);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _getSessionShape(comboKey, count) {
    const key = `wps_shape_${comboKey}`;
    const pool = this._shapePoolForCount(count);
    let shape = sessionStorage.getItem(key);
    if (!shape || !pool.includes(shape)) {
      shape = this._pickRandomShape(count);
      sessionStorage.setItem(key, shape);
    }
    return shape;
  }

  _resetSessionLayout(comboKey, count) {
    sessionStorage.setItem(`wps_layout_${comboKey}`, this._newSessionSeed());
    sessionStorage.setItem(`wps_shape_${comboKey}`, this._pickRandomShape(count));
    this._chaoticLayout.clear();
    this._layoutSessionSeed = null;
  }

  _isNarrow() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 640px)").matches
    );
  }

  _areaHeightForLayout(activeCount, totalCount) {
    const narrow = this._isNarrow();
    const base = narrow ? 28 : 36;
    const cap = narrow ? 100 : 148;
    const step = narrow ? 6 : 8;
    const floor = narrow ? 40 : 52;
    const shapeSpan =
      totalCount <= 1
        ? 22
        : MIN_CENTER_DIST * (1.85 + Math.sqrt(totalCount) * 0.82);
    const activePart =
      activeCount > 0 ? Math.max(floor, Math.min(cap, base + activeCount * step)) : 0;

    if (totalCount === 0) return floor;
    if (activeCount === 0) return Math.max(floor, shapeSpan + 8);
    return Math.max(activePart, activePart * 0.38 + shapeSpan + 8);
  }

  _distributeOnPath(count, vertices) {
    if (count <= 0) return [];
    const segments = [];
    let totalLen = 0;
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i];
      const b = vertices[(i + 1) % vertices.length];
      const len = Math.hypot(b.nx - a.nx, b.ny - a.ny) || 0.001;
      segments.push({ a, b, len, start: totalLen });
      totalLen += len;
    }
    const result = [];
    for (let i = 0; i < count; i++) {
      let d = ((i + 0.5) / count) * totalLen;
      if (d >= totalLen) d -= totalLen;
      let seg = segments[0];
      for (const s of segments) {
        if (d >= s.start && d < s.start + s.len) {
          seg = s;
          break;
        }
      }
      const local = (d - seg.start) / seg.len;
      result.push({
        nx: seg.a.nx + (seg.b.nx - seg.a.nx) * local,
        ny: seg.a.ny + (seg.b.ny - seg.a.ny) * local,
      });
    }
    return result;
  }

  /**
   * Evenly space points along a smooth parametric curve (arc-length sampling).
   */
  _sampleArcCurve(count, fn, closed = true) {
    if (count <= 0) return [];
    const steps = Math.max(96, count * 10);
    const dense = [];
    for (let i = 0; i <= steps; i++) {
      dense.push(fn(i / steps));
    }
    const lengths = [0];
    for (let i = 1; i < dense.length; i++) {
      lengths.push(
        lengths[i - 1] +
          Math.hypot(
            dense[i].nx - dense[i - 1].nx,
            dense[i].ny - dense[i - 1].ny,
          ),
      );
    }
    if (closed) {
      const closing =
        Math.hypot(
          dense[0].nx - dense[dense.length - 1].nx,
          dense[0].ny - dense[dense.length - 1].ny,
        ) || 0.001;
      lengths.push(lengths[lengths.length - 1] + closing);
      dense.push({ ...dense[0] });
    }
    const total = lengths[lengths.length - 1] || 0.001;
    const result = [];
    for (let i = 0; i < count; i++) {
      let target = ((i + 0.5) / count) * total;
      if (target >= total) target -= total;
      let idx = 0;
      while (idx < lengths.length - 1 && lengths[idx + 1] < target) idx++;
      const segLen = Math.max(lengths[idx + 1] - lengths[idx], 0.0001);
      const local = (target - lengths[idx]) / segLen;
      const a = dense[idx];
      const b = dense[Math.min(idx + 1, dense.length - 1)];
      result.push({
        nx: a.nx + (b.nx - a.nx) * local,
        ny: a.ny + (b.ny - a.ny) * local,
      });
    }
    return result;
  }

  _sampleOrbit(count) {
    if (count <= 3) {
      return this._distributeOnPath(count, [
        { nx: 0, ny: -0.72 },
        { nx: 0.64, ny: 0.42 },
        { nx: -0.64, ny: 0.42 },
      ]);
    }
    const rings = count <= 6 ? 2 : 3;
    const pts = [];
    let remaining = count;
    for (let ring = 1; ring <= rings; ring++) {
      const onRing =
        ring === rings ? remaining : Math.max(1, Math.round(count / (rings + 0.4)));
      remaining -= onRing;
      const r = (ring / rings) * 0.78;
      for (let i = 0; i < onRing; i++) {
        const angle = (i / onRing) * Math.PI * 2 - Math.PI / 2 + ring * 0.18;
        pts.push({ nx: r * Math.cos(angle), ny: r * Math.sin(angle) });
      }
    }
    return pts.slice(0, count);
  }

  _sampleFlower(count) {
    const petals = count <= 8 ? 5 : count <= 16 ? 6 : 8;
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.22 + 0.58 * Math.abs(Math.cos((petals * theta) / 2));
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
  }

  _sampleMandala(count, comboKey) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const phase = this._seededUnit(this._hashSeed(comboKey), 88) * Math.PI * 2;
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const r = 0.14 + 0.78 * Math.pow(t, 0.62);
      const angle = phase + i * golden;
      pts.push({ nx: r * Math.cos(angle), ny: r * Math.sin(angle) });
    }
    return pts;
  }

  _sampleHex(count) {
    const verts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      verts.push({ nx: Math.cos(a), ny: Math.sin(a) });
    }
    if (count <= 6) return this._distributeOnPath(count, verts);
    const outer = Math.max(6, Math.ceil(count * 0.58));
    const inner = count - outer;
    const outerPts = this._distributeOnPath(outer, verts);
    const innerPts = this._sampleArcCurve(Math.max(0, inner), (t) => {
      const theta = t * Math.PI * 2;
      const r = 0.4;
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
    return [...outerPts, ...innerPts];
  }

  _sampleInfinity(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2;
      const denom = 1 + Math.sin(theta) ** 2;
      const scale = 0.72 / denom;
      return {
        nx: scale * Math.cos(theta),
        ny: scale * Math.sin(theta) * Math.cos(theta),
      };
    });
  }

  _sampleWing(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r =
        0.52 +
        0.28 * Math.cos(2 * theta) +
        0.14 * Math.sin(3 * theta);
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) * 0.82 };
    });
  }

  _sampleHeart(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2;
      const sx = 16 * Math.pow(Math.sin(theta), 3);
      const sy = -(
        13 * Math.cos(theta) -
        5 * Math.cos(2 * theta) -
        2 * Math.cos(3 * theta) -
        Math.cos(4 * theta)
      );
      return { nx: sx / 17, ny: sy / 17 };
    });
  }

  _sampleStarPath(count) {
    const points = count <= 10 ? 5 : 7;
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.38 + 0.52 * Math.abs(Math.cos((points * theta) / 2));
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
  }

  _sampleWave(count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0.5 : i / (count - 1);
      pts.push({
        nx: -0.88 + t * 1.76,
        ny: 0.38 * Math.sin(t * Math.PI * 2),
      });
    }
    return pts;
  }

  _sampleSpiral(count) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const r = 0.12 + 0.82 * Math.pow(t, 0.72);
      const angle = i * golden - Math.PI / 2;
      pts.push({ nx: r * Math.cos(angle), ny: r * Math.sin(angle) });
    }
    return pts;
  }

  _sampleCurve(count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0.5 : i / (count - 1);
      pts.push({
        nx: -0.75 + t * 1.5,
        ny: -0.55 * Math.sin(t * Math.PI),
      });
    }
    return pts;
  }

  _sampleConstellation(count, comboKey) {
    const seed = this._hashSeed(comboKey);
    const rings = Math.min(4, Math.max(2, Math.round(Math.sqrt(count / 4))));
    const pts = [];
    let assigned = 0;
    for (let ring = 1; ring <= rings; ring++) {
      const onRing =
        ring === rings
          ? count - assigned
          : Math.max(1, Math.round((count * ring) / ((rings * (rings + 1)) / 2)));
      assigned += onRing;
      const r = (ring / rings) * 0.76;
      const twist = (ring - 1) * 0.22 + this._seededUnit(seed, ring) * 0.35;
      for (let i = 0; i < onRing; i++) {
        const angle = (i / onRing) * Math.PI * 2 - Math.PI / 2 + twist;
        pts.push({ nx: r * Math.cos(angle), ny: r * Math.sin(angle) });
      }
    }
    return pts.slice(0, count);
  }

  _shapeSeed(comboKey, salt = 0) {
    return this._hashSeed(`${comboKey}:${salt}`);
  }

  _sampleRose(count, petals, comboKey = "") {
    const k = petals + (comboKey ? this._seededUnit(this._shapeSeed(comboKey, 1), 0) * 0.35 : 0);
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.18 + 0.64 * Math.abs(Math.cos((k * theta) / 2));
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
  }

  _sampleRegularPolygon(count, sides) {
    const verts = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      verts.push({ nx: Math.cos(a) * 0.82, ny: Math.sin(a) * 0.82 });
    }
    return this._distributeOnPath(count, verts);
  }

  _sampleSuperellipse(count, n, comboKey = "") {
    const exp = n + (comboKey ? this._seededUnit(this._shapeSeed(comboKey, 2), 0) * 0.8 : 0);
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const c = Math.abs(Math.cos(theta)) ** (2 / exp);
      const s = Math.abs(Math.sin(theta)) ** (2 / exp);
      const r = 0.82 / Math.max(c + s, 0.08);
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
  }

  _sampleLissajous(count, comboKey) {
    const seed = this._shapeSeed(comboKey, 3);
    const a = 2 + Math.floor(this._seededUnit(seed, 0) * 4);
    const b = 2 + Math.floor(this._seededUnit(seed, 1) * 4);
    const delta = this._seededUnit(seed, 2) * Math.PI;
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2;
      return {
        nx: 0.82 * Math.sin(a * theta + delta),
        ny: 0.82 * Math.sin(b * theta),
      };
    }, false);
  }

  _sampleEpicycloid(count, comboKey, variant = 0) {
    const seed = this._shapeSeed(comboKey, 4 + variant);
    const R = 0.55 + this._seededUnit(seed, 0) * 0.2;
    const r = 0.15 + this._seededUnit(seed, 1) * 0.25;
    const d = r * (0.8 + this._seededUnit(seed, 2) * 0.6);
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 * (2 + Math.floor(this._seededUnit(seed, 3) * 2));
      const k = (R + r) / r;
      return {
        nx: (R + r) * Math.cos(theta) - d * Math.cos(k * theta),
        ny: (R + r) * Math.sin(theta) - d * Math.sin(k * theta),
      };
    });
  }

  _sampleHypotrochoid(count, comboKey) {
    const seed = this._shapeSeed(comboKey, 8);
    const R = 0.7;
    const r = 0.22 + this._seededUnit(seed, 0) * 0.18;
    const d = r * (1.2 + this._seededUnit(seed, 1));
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 * 3;
      const k = (R - r) / r;
      return {
        nx: (R - r) * Math.cos(theta) + d * Math.cos(k * theta),
        ny: (R - r) * Math.sin(theta) - d * Math.sin(k * theta),
      };
    });
  }

  _sampleGear(count, comboKey) {
    const teeth = 6 + Math.floor(this._seededUnit(this._shapeSeed(comboKey, 5), 0) * 6);
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.42 + 0.38 * (0.55 + 0.45 * Math.cos(teeth * theta));
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
  }

  _sampleZigzag(count) {
    const pts = [];
    const segs = Math.max(2, Math.ceil(count / 2));
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const seg = Math.floor(t * segs);
      const ny = seg % 2 === 0 ? -0.55 : 0.55;
      pts.push({ nx: -0.85 + t * 1.7, ny });
    }
    return pts;
  }

  _sampleVee(count) {
    return this._distributeOnPath(count, [
      { nx: -0.75, ny: 0.55 },
      { nx: 0, ny: -0.82 },
      { nx: 0.75, ny: 0.55 },
    ]);
  }

  _sampleArc(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = Math.PI + t * Math.PI;
      return { nx: 0.82 * Math.cos(theta), ny: 0.82 * Math.sin(theta) * 0.7 };
    }, false);
  }

  _sampleBow(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI;
      return { nx: -0.82 + t * 1.64, ny: 0.65 * Math.sin(theta) };
    }, false);
  }

  _sampleCross(count) {
    const arm = [
      { nx: 0, ny: -0.82 },
      { nx: 0, ny: 0.82 },
      { nx: -0.82, ny: 0 },
      { nx: 0.82, ny: 0 },
    ];
    return this._distributeOnPath(count, arm);
  }

  _sampleCrescent(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.72 + 0.12 * Math.cos(theta);
      return { nx: r * Math.cos(theta) * 0.9, ny: r * Math.sin(theta) };
    });
  }

  _sampleButterfly(count, comboKey) {
    const seed = this._shapeSeed(comboKey, 6);
    const skew = 0.85 + this._seededUnit(seed, 0) * 0.2;
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = Math.exp(Math.cos(theta)) - 2 * Math.cos(4 * theta);
      const scale = 0.22 / Math.max(Math.abs(r), 0.35);
      return { nx: scale * r * Math.sin(theta), ny: scale * r * Math.cos(theta) * skew };
    });
  }

  _sampleFish(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.35 + 0.45 * Math.abs(Math.sin(theta)) + 0.12 * Math.cos(2 * theta);
      return { nx: r * Math.cos(theta) * 1.1, ny: r * Math.sin(theta) * 0.75 };
    });
  }

  _sampleBird(count, comboKey) {
    const flip = this._seededUnit(this._shapeSeed(comboKey, 7), 0) > 0.5 ? 1 : -1;
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r =
        0.5 +
        0.32 * Math.cos(theta) +
        0.18 * Math.sin(2 * theta) * flip;
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) * 0.85 };
    });
  }

  _sampleComet(count) {
    const head = Math.max(1, Math.round(count * 0.2));
    const pts = [];
    for (let i = 0; i < head; i++) {
      const a = (i / head) * Math.PI * 2;
      pts.push({ nx: 0.35 * Math.cos(a), ny: 0.35 * Math.sin(a) });
    }
    const tail = count - head;
    for (let i = 0; i < tail; i++) {
      const t = tail <= 1 ? 0.5 : i / (tail - 1);
      pts.push({ nx: -0.85 + t * 0.55, ny: (t - 0.5) * 0.35 });
    }
    return pts.slice(0, count);
  }

  _sampleGalaxy(count, comboKey) {
    const arms = 2 + Math.floor(this._seededUnit(this._shapeSeed(comboKey, 9), 0) * 3);
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const angle = t * Math.PI * 4 * arms - Math.PI / 2;
      const r = 0.1 + 0.78 * Math.pow(t, 0.55);
      pts.push({ nx: r * Math.cos(angle), ny: r * Math.sin(angle) * 0.88 });
    }
    return pts;
  }

  _sampleBurst(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.25 + 0.6 * Math.abs(Math.sin((count <= 8 ? 4 : 6) * theta));
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
  }

  _sampleLightning(count) {
    const verts = [
      { nx: -0.2, ny: -0.82 },
      { nx: 0.35, ny: -0.15 },
      { nx: -0.05, ny: -0.1 },
      { nx: 0.45, ny: 0.82 },
      { nx: -0.35, ny: 0.1 },
      { nx: 0.05, ny: 0.05 },
    ];
    return this._distributeOnPath(count, verts);
  }

  _sampleScribble(count, comboKey) {
    const seed = this._shapeSeed(comboKey, 10);
    const freq = 3 + Math.floor(this._seededUnit(seed, 0) * 5);
    const amp = 0.15 + this._seededUnit(seed, 1) * 0.12;
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.62 + amp * Math.sin(freq * theta + this._seededUnit(seed, 2) * 6);
      const wobble = amp * 0.6 * Math.cos(freq * 2 * theta);
      return {
        nx: r * Math.cos(theta) + wobble,
        ny: r * Math.sin(theta) * (0.9 + this._seededUnit(seed, 3) * 0.15),
      };
    });
  }

  _samplePhyllotaxis(count, comboKey) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const phase = this._seededUnit(this._shapeSeed(comboKey, 11), 0) * Math.PI * 2;
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const r = 0.12 + 0.8 * Math.sqrt(t);
      const angle = phase + i * golden;
      pts.push({ nx: r * Math.cos(angle), ny: r * Math.sin(angle) });
    }
    return pts;
  }

  _sampleDoubleRing(count) {
    const outer = Math.ceil(count * 0.55);
    const inner = count - outer;
    const outerPts = this._sampleArcCurve(outer, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      return { nx: 0.82 * Math.cos(theta), ny: 0.82 * Math.sin(theta) };
    });
    const innerPts = this._sampleArcCurve(Math.max(0, inner), (t) => {
      const theta = t * Math.PI * 2;
      const r = 0.38;
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
    return [...outerPts, ...innerPts];
  }

  _sampleHelix2d(count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const angle = t * Math.PI * 6 - Math.PI / 2;
      pts.push({
        nx: 0.78 * Math.cos(angle) * (0.55 + 0.45 * t),
        ny: (t - 0.5) * 1.5,
      });
    }
    return pts;
  }

  _sampleCascade(count) {
    const cols = Math.max(2, Math.ceil(Math.sqrt(count)));
    const pts = [];
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const nx = -0.82 + (col / Math.max(1, cols - 1)) * 1.64;
      const ny = -0.7 + (row / Math.max(1, Math.ceil(count / cols) - 1)) * 1.4;
      pts.push({ nx, ny });
    }
    return pts;
  }

  _sampleCloud(count, comboKey) {
    const lobes = 4 + Math.floor(this._seededUnit(this._shapeSeed(comboKey, 12), 0) * 4);
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.48 + 0.34 * Math.cos(lobes * theta);
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) * 0.82 };
    });
  }

  _sampleFlame(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.35 + 0.5 * Math.abs(Math.sin(theta)) * (1 - 0.35 * Math.cos(theta));
      return { nx: r * Math.cos(theta) * 0.75, ny: -Math.abs(r * Math.sin(theta)) };
    });
  }

  _sampleCreature(count, comboKey) {
    const seed = this._shapeSeed(comboKey, 13);
    const body = Math.ceil(count * 0.55);
    const pts = this._sampleArcCurve(body, (t) => {
      const theta = t * Math.PI * 2;
      const r = 0.42 + 0.12 * Math.sin(3 * theta);
      return { nx: r * Math.cos(theta) - 0.1, ny: r * Math.sin(theta) * 0.7 };
    });
    const extra = count - body;
    for (let i = 0; i < extra; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const t = (i + 1) / (extra + 1);
      pts.push({
        nx: side * (0.55 + t * 0.3),
        ny: -0.35 + t * 0.7 + this._seededUnit(seed, i) * 0.15,
      });
    }
    return pts.slice(0, count);
  }

  _sampleStaggeredGrid(count) {
    const cols = Math.max(2, Math.ceil(Math.sqrt(count * 1.4)));
    const rows = Math.ceil(count / cols);
    const pts = [];
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const nx = -0.82 + (col / Math.max(1, cols - 1)) * 1.64;
      const ny = -0.78 + (row / Math.max(1, rows - 1)) * 1.56;
      const shift = row % 2 === 0 ? 0 : 0.08;
      pts.push({ nx: nx + shift, ny });
    }
    return pts;
  }

  _sampleRadialBloom(count, comboKey) {
    const rays = 5 + Math.floor(this._seededUnit(this._shapeSeed(comboKey, 14), 0) * 8);
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.2 + 0.65 * Math.abs(Math.sin((rays * theta) / 2));
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
  }

  _sampleAbstractGlyph(count, comboKey) {
    const seed = this._shapeSeed(comboKey, 15);
    const a = 2 + Math.floor(this._seededUnit(seed, 0) * 3);
    const b = 3 + Math.floor(this._seededUnit(seed, 1) * 4);
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r =
        0.4 +
        0.35 * Math.abs(Math.sin(a * theta)) +
        0.12 * Math.cos(b * theta + this._seededUnit(seed, 2) * 4);
      const asym = 0.88 + this._seededUnit(seed, 3) * 0.2;
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) * asym };
    });
  }

  _sampleCardioid(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2;
      const r = 0.5 * (1 - Math.cos(theta));
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
  }

  _sampleAstroid(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2;
      const r = 0.82 * Math.pow(Math.abs(Math.cos(theta)), 0.66);
      const s = 0.82 * Math.pow(Math.abs(Math.sin(theta)), 0.66);
      return { nx: r * Math.sign(Math.cos(theta)), ny: s * Math.sign(Math.sin(theta)) };
    });
  }

  _sampleLemniscate(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2;
      const scale = 0.82 / (1 + Math.sin(theta) ** 2);
      return {
        nx: scale * Math.cos(theta),
        ny: scale * Math.sin(theta) * Math.cos(theta),
      };
    });
  }

  _sampleClover(count) {
    return this._sampleRose(count, 4, "");
  }

  _sampleSnowflake(count) {
    return this._sampleRose(count, 6, "");
  }

  _sampleNova(count, comboKey) {
    const spikes = 8 + Math.floor(this._seededUnit(this._shapeSeed(comboKey, 16), 0) * 10);
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.15 + 0.7 * Math.pow(Math.abs(Math.cos((spikes * theta) / 2)), 0.65);
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
  }

  _samplePetal(count, petals) {
    return this._sampleRose(count, petals, "");
  }

  _sampleLoop(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2;
      const r = 0.55 + 0.25 * Math.cos(2 * theta);
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) * 0.75 };
    });
  }

  _sampleKite(count) {
    return this._distributeOnPath(count, [
      { nx: 0, ny: -0.82 },
      { nx: 0.55, ny: 0 },
      { nx: 0, ny: 0.82 },
      { nx: -0.55, ny: 0 },
    ]);
  }

  _samplePinwheel(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 * 2 - Math.PI / 2;
      const r = 0.2 + 0.62 * (t % 0.5 < 0.25 ? 1 : 0.55);
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
  }

  _sampleHourglass(count) {
    return this._distributeOnPath(count, [
      { nx: -0.72, ny: -0.72 },
      { nx: 0.72, ny: -0.72 },
      { nx: 0, ny: 0 },
      { nx: -0.72, ny: 0.72 },
      { nx: 0.72, ny: 0.72 },
    ]);
  }

  _sampleTrident(count) {
    return this._distributeOnPath(count, [
      { nx: 0, ny: -0.82 },
      { nx: -0.55, ny: 0.82 },
      { nx: 0.55, ny: 0.82 },
    ]);
  }

  _sampleBridge(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI;
      return { nx: -0.82 + t * 1.64, ny: -0.55 * Math.sin(theta) };
    }, false);
  }

  _sampleRipple(count) {
    const rings = Math.min(4, Math.max(2, Math.round(Math.sqrt(count))));
    const pts = [];
    let left = count;
    for (let ring = 1; ring <= rings; ring++) {
      const onRing = ring === rings ? left : Math.max(1, Math.round(count / (rings * 1.2)));
      left -= onRing;
      const r = (ring / rings) * 0.78;
      for (let i = 0; i < onRing; i++) {
        const angle = (i / onRing) * Math.PI * 2 - Math.PI / 2;
        pts.push({ nx: r * Math.cos(angle), ny: r * Math.sin(angle) });
      }
    }
    return pts.slice(0, count);
  }

  _sampleCircleFallback(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      return { nx: 0.82 * Math.cos(theta), ny: 0.82 * Math.sin(theta) };
    });
  }

  _normalizedShapePoints(shape, count, comboKey = "") {
    if (count <= 0) return [];
    if (count === 1 || shape === "dot") return [{ nx: 0, ny: 0 }];
    if (shape === "line" || (count === 2 && shape !== "vee")) {
      return [
        { nx: -0.55, ny: 0 },
        { nx: 0.55, ny: 0 },
      ].slice(0, count);
    }

    const samplers = {
      curve: () => this._sampleCurve(count),
      orbit: () => this._sampleOrbit(count),
      flower: () => this._sampleFlower(count),
      mandala: () => this._sampleMandala(count, comboKey),
      hex: () => this._sampleHex(count),
      infinity: () => this._sampleInfinity(count),
      wing: () => this._sampleWing(count),
      triangle: () =>
        this._distributeOnPath(count, [
          { nx: 0, ny: -0.82 },
          { nx: 0.78, ny: 0.62 },
          { nx: -0.78, ny: 0.62 },
        ]),
      wave: () => this._sampleWave(count),
      spiral: () => this._sampleSpiral(count),
      constellation: () => this._sampleConstellation(count, comboKey),
      constellation2: () => this._sampleConstellation(count, comboKey + "2"),
      heart: () => this._sampleHeart(count),
      star: () => this._sampleStarPath(count),
      diamond: () =>
        this._sampleArcCurve(count, (t) => {
          const theta = t * Math.PI * 2 - Math.PI / 2;
          const r = 0.78 / (Math.abs(Math.cos(theta)) + Math.abs(Math.sin(theta)));
          return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
        }),
      vee: () => this._sampleVee(count),
      arc: () => this._sampleArc(count),
      bow: () => this._sampleBow(count),
      cross: () => this._sampleCross(count),
      crescent: () => this._sampleCrescent(count),
      zigzag: () => this._sampleZigzag(count),
      petal4: () => this._samplePetal(count, 4),
      petal6: () => this._samplePetal(count, 6),
      loop: () => this._sampleLoop(count),
      kite: () => this._sampleKite(count),
      pinwheel: () => this._samplePinwheel(count),
      rose3: () => this._sampleRose(count, 3, comboKey),
      rose5: () => this._sampleRose(count, 5, comboKey),
      rose7: () => this._sampleRose(count, 7, comboKey),
      cardioid: () => this._sampleCardioid(count),
      astroid: () => this._sampleAstroid(count),
      hourglass: () => this._sampleHourglass(count),
      trident: () => this._sampleTrident(count),
      clover: () => this._sampleClover(count),
      gear: () => this._sampleGear(count, comboKey),
      snowflake: () => this._sampleSnowflake(count),
      butterfly: () => this._sampleButterfly(count, comboKey),
      fish: () => this._sampleFish(count),
      bird: () => this._sampleBird(count, comboKey),
      comet: () => this._sampleComet(count),
      galaxy: () => this._sampleGalaxy(count, comboKey),
      burst: () => this._sampleBurst(count),
      lightning: () => this._sampleLightning(count),
      scribble: () => this._sampleScribble(count, comboKey),
      phyllotaxis: () => this._samplePhyllotaxis(count, comboKey),
      lissajous: () => this._sampleLissajous(count, comboKey),
      epicycloid: () => this._sampleEpicycloid(count, comboKey, 0),
      hypotrochoid: () => this._sampleHypotrochoid(count, comboKey),
      superellipse: () => this._sampleSuperellipse(count, 2.2, comboKey),
      lemniscate: () => this._sampleLemniscate(count),
      doubleRing: () => this._sampleDoubleRing(count),
      helix: () => this._sampleHelix2d(count),
      cascade: () => this._sampleCascade(count),
      cloud: () => this._sampleCloud(count, comboKey),
      flame: () => this._sampleFlame(count),
      nova: () => this._sampleNova(count, comboKey),
      pentagon: () => this._sampleRegularPolygon(count, 5),
      octagon: () => this._sampleRegularPolygon(count, 8),
      horseshoe: () => this._sampleArc(count),
      omega: () => this._sampleArcCurve(count, (t) => {
        const theta = t * Math.PI * 2;
        const r = 0.55 + 0.25 * Math.cos(theta);
        return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) - 0.2 };
      }),
      bridge: () => this._sampleBridge(count),
      ripple: () => this._sampleRipple(count),
      stagger: () => this._sampleStaggeredGrid(count),
      doubleHelix: () => this._sampleHelix2d(count),
      fractalBranch: () => this._sampleLightning(count),
      radialBloom: () => this._sampleRadialBloom(count, comboKey),
      asymmetricWing: () => this._sampleBird(count, comboKey),
      creature: () => this._sampleCreature(count, comboKey),
      orbit3d: () => this._sampleOrbit(count),
      waveField: () => this._sampleWave(count),
      starburst: () => this._sampleBurst(count),
      lotus: () => this._sampleFlower(count),
      sunwheel: () => this._sampleGear(count, comboKey),
      dragonPath: () => this._sampleZigzag(count),
      abstractGlyph: () => this._sampleAbstractGlyph(count, comboKey),
      tessellation: () => this._sampleStaggeredGrid(count),
      voronoiRing: () => this._sampleRipple(count),
      fibonacciArc: () => this._samplePhyllotaxis(count, comboKey),
      lunarPhase: () => this._sampleCrescent(count),
      eclipse: () => this._sampleDoubleRing(count),
      meteorShower: () => this._sampleComet(count),
      nebula: () => this._sampleCloud(count, comboKey),
      coral: () => this._sampleScribble(count, comboKey + "coral"),
      fern: () => this._sampleCascade(count),
      crystal: () => this._sampleDiamondLike(count),
      prism: () => this._sampleRegularPolygon(count, 6),
      molecule: () => this._sampleOrbit(count),
      circuit: () => this._sampleZigzag(count),
      glyphSpiral: () => this._sampleSpiral(count),
      woven: () => this._sampleLissajous(count, comboKey + "woven"),
      braid: () => this._sampleHelix2d(count),
      harp: () => this._sampleWave(count),
      echo: () => this._sampleRipple(count),
      pulseRing: () => this._sampleDoubleRing(count),
      crown: () => this._sampleBurst(count),
      shield: () => this._sampleKite(count),
    };

    if (samplers[shape]) return samplers[shape]();
    return this._sampleCircleFallback(count);
  }

  _sampleDiamondLike(count) {
    return this._sampleArcCurve(count, (t) => {
      const theta = t * Math.PI * 2 - Math.PI / 2;
      const r = 0.78 / (Math.abs(Math.cos(theta)) + Math.abs(Math.sin(theta)));
      return { nx: r * Math.cos(theta), ny: r * Math.sin(theta) };
    });
  }

  _computeShapeLayout(count, areaW, areaH, comboKey) {
    if (count <= 0) return [];

    const pad = 7;
    const usableW = Math.max(40, areaW - pad * 2 - SQUARE_PX);
    const usableH = Math.max(28, areaH - pad * 2 - SQUARE_PX);
    const cx = areaW / 2;
    const cy = areaH / 2;

    const shape = this._getSessionShape(comboKey, count);
    const norm = this._normalizedShapePoints(shape, count, comboKey);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of norm) {
      minX = Math.min(minX, p.nx);
      maxX = Math.max(maxX, p.nx);
      minY = Math.min(minY, p.ny);
      maxY = Math.max(maxY, p.ny);
    }
    const bw = Math.max(maxX - minX, 0.01);
    const bh = Math.max(maxY - minY, 0.01);
    const scale = Math.min(usableW / bw, usableH / bh) * 0.96;
    const midNx = (minX + maxX) / 2;
    const midNy = (minY + maxY) / 2;
    const margin = 4;

    return norm.map((p) => ({
      leftPx: Math.max(
        margin,
        Math.min(
          areaW - SQUARE_PX - margin,
          cx + (p.nx - midNx) * scale - SQUARE_PX / 2,
        ),
      ),
      topPx: Math.max(
        margin,
        Math.min(
          areaH - SQUARE_PX - margin,
          cy + (p.ny - midNy) * scale - SQUARE_PX / 2,
        ),
      ),
    }));
  }

  _shapeBottomExtent(positions) {
    if (!positions.length) return 0;
    return Math.max(...positions.map((p) => p.topPx + SQUARE_PX));
  }

  _dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  _collides(leftPx, topPx, placed) {
    const cx = leftPx + SQUARE_PX / 2;
    const cy = topPx + SQUARE_PX / 2;
    for (const p of placed) {
      const ox = p.leftPx + SQUARE_PX / 2;
      const oy = p.topPx + SQUARE_PX / 2;
      if (this._dist(cx, cy, ox, oy) < MIN_CENTER_DIST) return true;
    }
    return false;
  }

  _gridFallback(index, count, areaW, areaH, slotIndex = index) {
    const margin = 6;
    const maxL = areaW - SQUARE_PX - margin;
    const maxT = areaH - SQUARE_PX - margin;
    const hCols = this._horizontalBandCount(areaW, count);
    const col = slotIndex % hCols;
    const row = Math.floor(slotIndex / hCols);
    const rows = Math.max(1, Math.ceil(count / hCols));
    const bandW = (maxL - margin) / hCols;
    const bandH = (maxT - margin) / rows;
    const jitterX = ((index * 5) % 7) - 3;
    const jitterY = ((index * 3) % 5) - 2;
    return {
      leftPx: Math.min(
        maxL,
        Math.max(margin, margin + (col + 0.5) * bandW - bandW / 2 + jitterX),
      ),
      topPx: Math.min(
        maxT,
        Math.max(margin, margin + (row + 0.5) * bandH - bandH / 2 + jitterY),
      ),
    };
  }

  _computeMaxDrift(leftPx, topPx, placed, selfId) {
    const cx = leftPx + SQUARE_PX / 2;
    const cy = topPx + SQUARE_PX / 2;
    let minDist = Infinity;

    for (const p of placed) {
      if (p.id === selfId) continue;
      const ox = p.leftPx + SQUARE_PX / 2;
      const oy = p.topPx + SQUARE_PX / 2;
      minDist = Math.min(minDist, this._dist(cx, cy, ox, oy));
    }

    if (!Number.isFinite(minDist)) return 11;
    const safe = (minDist - SQUARE_PX) / 2 - 2;
    return Math.max(4, Math.min(12, safe));
  }

  _syncChaoticLayout(
    activeWords,
    comboKey,
    forceNewLayout,
    blocked,
    areaH,
    wordCount,
  ) {
    if (forceNewLayout) {
      this._resetSessionLayout(comboKey, wordCount);
    }

    const sessionSeed = this._getSessionSeed(comboKey);
    if (this._layoutSessionSeed !== sessionSeed) {
      this._chaoticLayout.clear();
      this._layoutSessionSeed = sessionSeed;
    }

    const activeIds = new Set(
      activeWords.map((w) => String(w.id ?? w.word)),
    );

    for (const id of [...this._chaoticLayout.keys()]) {
      if (!activeIds.has(id)) this._chaoticLayout.delete(id);
    }

    const root = this._getRoot();
    const areaW = this._resolveAreaWidth(root);
    this._invalidateLayoutIfWidthChanged(areaW);

    const placed = blocked.map((p, i) => ({
      id: `__shape_${i}`,
      leftPx: p.leftPx,
      topPx: p.topPx,
    }));

    for (const [id, pos] of this._chaoticLayout) {
      placed.push({ id, leftPx: pos.leftPx, topPx: pos.topPx });
    }

    const hCols = this._horizontalBandCount(areaW, activeWords.length);
    const shuffled = [...activeWords]
      .map((word, i) => ({ word, i }))
      .sort((a, b) => {
        const colA = a.i % hCols;
        const colB = b.i % hCols;
        if (colA !== colB) return colA - colB;
        const sa = this._hashSeed(`${sessionSeed}-${a.word.id ?? a.word.word}`);
        const sb = this._hashSeed(`${sessionSeed}-${b.word.id ?? b.word.word}`);
        return sa - sb;
      })
      .map((entry) => entry.word);

    const totalActive = activeWords.length;
    let slotIndex = 0;

    for (const word of shuffled) {
      const id = String(word.id ?? word.word);
      if (this._chaoticLayout.has(id)) continue;

      const seed = this._hashSeed(`${sessionSeed}-${id}`);
      let spot = this._findBalancedOpenPosition(
        placed,
        areaW,
        areaH,
        seed,
        slotIndex,
        totalActive,
      );
      slotIndex++;

      if (!spot) {
        spot = this._gridFallback(
          placed.length,
          totalActive,
          areaW,
          areaH,
          slotIndex,
        );
        let nudge = 0;
        while (this._collides(spot.leftPx, spot.topPx, placed) && nudge < 24) {
          spot.leftPx = Math.min(
            areaW - SQUARE_PX - 4,
            spot.leftPx + (nudge % 2 === 0 ? 3 : -3),
          );
          spot.topPx = Math.min(
            areaH - SQUARE_PX - 4,
            spot.topPx + (nudge % 3 === 0 ? 3 : -2),
          );
          nudge++;
        }
      }

      const entry = {
        leftPx: spot.leftPx,
        topPx: spot.topPx,
        maxDriftPx: 0,
      };
      placed.push({ id, ...entry });
      this._chaoticLayout.set(id, entry);
    }

    for (const [id, entry] of this._chaoticLayout) {
      entry.maxDriftPx = this._computeMaxDrift(
        entry.leftPx,
        entry.topPx,
        placed,
        id,
      );
    }

    return { areaW, areaH };
  }

  getVisualState(sureCount) {
    if (sureCount >= 2) return "mastered";
    if (sureCount === 1) return "learning";
    if (sureCount === 0) return "neutral";
    if (sureCount === -1) return "warning";
    if (sureCount === -2) return "tense-2";
    return "tense-deep";
  }

  getSquareColor(sureCount) {
    if (sureCount === 0) return "rgba(156, 163, 175, 0.42)";
    if (sureCount === 1) return "#86efac";
    if (sureCount >= 2) return "#4ade80";
    if (sureCount === -1) return "#fde68a";
    if (sureCount === -2) return "#fdba74";
    const depth = Math.min(Math.abs(sureCount) - 2, 4);
    const t = depth / 4;
    const r = Math.round(251 + (220 - 251) * t);
    const g = Math.round(113 + (50 - 113) * t);
    const b = Math.round(60 + (50 - 60) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  _driftAmplitudeScale(visualState, sureCount) {
    if (visualState === "learning") return 0.92;
    if (visualState === "mastered") return 0.32;
    if (visualState === "warning") return 1.22;
    if (visualState === "tense-2") return 1.28;
    if (visualState === "tense-deep") {
      return 1.32 + Math.min(0.14, Math.abs(sureCount) * 0.025);
    }
    return 1.12;
  }

  _driftDurationScale(visualState, sureCount) {
    if (visualState === "learning") return 1.05;
    if (visualState === "mastered") return 1.45;
    if (visualState === "warning") return 0.78;
    if (visualState.startsWith("tense")) {
      return 0.72 - Math.min(0.12, Math.max(0, Math.abs(sureCount) - 2) * 0.035);
    }
    return 0.88;
  }

  _applyMotionVars(el, wordId, visualState, sureCount, maxDriftPx = 11) {
    const amp = this._driftAmplitudeScale(visualState, sureCount);
    const durScale = this._driftDurationScale(visualState, sureCount);
    const cap = maxDriftPx * amp;

    const baseDrift = this._jitterFromSeed(wordId, 3, 11, 17) * durScale;
    const basePulse = this._jitterFromSeed(wordId, 4, 2.4, 5.2);

    const rawDxA = this._jitterFromSeed(wordId, 5, 8, 18) * amp;
    const rawDyA = this._jitterFromSeed(wordId, 6, 7, 16) * amp;
    const rawDxB = this._jitterFromSeed(wordId, 7, -17, -6) * amp;
    const rawDyB = this._jitterFromSeed(wordId, 8, 6, 17) * amp;

    const clamp = (v) => Math.max(-cap, Math.min(cap, v));

    const animDelay = this._jitterFromSeed(wordId, 9, 0, 10).toFixed(2);
    const pulseDelay = this._jitterFromSeed(wordId, 10, 0, 7).toFixed(2);
    const pulseDurOffset = this._jitterFromSeed(wordId, 11, -0.7, 1.1).toFixed(
      2,
    );

    el.style.setProperty("--wps-drift-dur", `${baseDrift.toFixed(1)}s`);
    el.style.setProperty(
      "--wps-pulse-dur",
      `${(basePulse + parseFloat(pulseDurOffset)).toFixed(1)}s`,
    );
    el.style.setProperty("--wps-dx-a", `${clamp(rawDxA).toFixed(1)}px`);
    el.style.setProperty("--wps-dy-a", `${clamp(rawDyA).toFixed(1)}px`);
    el.style.setProperty("--wps-dx-b", `${clamp(rawDxB).toFixed(1)}px`);
    el.style.setProperty("--wps-dy-b", `${clamp(rawDyB).toFixed(1)}px`);
    el.style.setProperty("--wps-anim-delay", `${animDelay}s`);
    el.style.setProperty("--wps-pulse-delay", `${pulseDelay}s`);
  }

  _applyEnsembleMotion(el, comboKey) {
    const seed = this._hashSeed(comboKey);
    const dur = 24 + this._seededUnit(seed, 20) * 10;
    const dx = 1.8 + this._seededUnit(seed, 21) * 1.6;
    const dy = 1.2 + this._seededUnit(seed, 22) * 1.4;
    el.style.setProperty("--wps-ensemble-dur", `${dur.toFixed(1)}s`);
    el.style.setProperty("--wps-ensemble-dx", `${dx.toFixed(2)}px`);
    el.style.setProperty("--wps-ensemble-dy", `${(-dy).toFixed(2)}px`);
  }

  _clearEnsembleMotion(el) {
    el.style.removeProperty("--wps-ensemble-dur");
    el.style.removeProperty("--wps-ensemble-dx");
    el.style.removeProperty("--wps-ensemble-dy");
  }

  _applySettledMotionVars(el, wordId, living = false, memberIndex = 0, memberTotal = 1) {
    if (living) {
      const phase = memberTotal > 0 ? memberIndex / memberTotal : 0;
      el.style.setProperty("--wps-member-phase", phase.toFixed(4));
      el.style.setProperty(
        "--wps-pulse-dur",
        `${(5.8 + (memberIndex % 7) * 0.12).toFixed(1)}s`,
      );
      el.style.setProperty("--wps-dx-a", "0px");
      el.style.setProperty("--wps-dy-a", "0px");
      el.style.setProperty("--wps-dx-b", "0px");
      el.style.setProperty("--wps-dy-b", "0px");
      el.style.setProperty("--wps-op-min", "0.66");
      el.style.setProperty("--wps-op-max", "1");
      el.style.setProperty("--wps-br-min", "0.94");
      el.style.setProperty("--wps-br-max", "1.08");
      el.style.setProperty(
        "--wps-pulse-delay",
        `${(-phase * 6).toFixed(2)}s`,
      );
      return;
    }

    const micro = this._jitterFromSeed(wordId, 12, 1.2, 2.6);
    const driftBase = 30;
    el.style.setProperty("--wps-drift-dur", `${(driftBase + micro).toFixed(1)}s`);
    el.style.setProperty(
      "--wps-pulse-dur",
      `${this._jitterFromSeed(wordId, 13, 7.5, 10.5).toFixed(1)}s`,
    );
    el.style.setProperty("--wps-dx-a", `${micro.toFixed(1)}px`);
    el.style.setProperty("--wps-dy-a", `${(micro * 0.75).toFixed(1)}px`);
    el.style.setProperty("--wps-dx-b", `${(-micro * 0.9).toFixed(1)}px`);
    el.style.setProperty("--wps-dy-b", `${(micro * 0.95).toFixed(1)}px`);
    el.style.setProperty("--wps-op-min", "0.7");
    el.style.setProperty("--wps-op-max", "0.96");
    el.style.setProperty("--wps-br-min", "0.95");
    el.style.setProperty("--wps-br-max", "1.06");
    el.style.setProperty(
      "--wps-anim-delay",
      `${this._jitterFromSeed(wordId, 14, 0, 6).toFixed(2)}s`,
    );
    el.style.setProperty(
      "--wps-pulse-delay",
      `${this._jitterFromSeed(wordId, 15, 0, 5).toFixed(2)}s`,
    );
  }

  _animateMasteryTransition(word, fromEl, targetPos) {
    const id = String(word.id ?? word.word);
    if (this._transitioning.has(id)) return;

    this._transitioning.add(id);
    this._chaoticLayout.delete(id);

    const fromRect = fromEl.getBoundingClientRect();
    fromEl.remove();

    const placeholder = document.createElement("div");
    placeholder.className =
      "wps-square wps-square--settled wps-state-mastered wps-transition-placeholder";
    placeholder.dataset.wordId = id;
    placeholder.style.left = `${targetPos.leftPx}px`;
    placeholder.style.top = `${targetPos.topPx}px`;
    this._chaoticEl.appendChild(placeholder);

    const toRect = placeholder.getBoundingClientRect();

    const flyer = document.createElement("div");
    flyer.className = "wps-square wps-square--traveling wps-state-mastered";
    flyer.style.backgroundColor = this.getSquareColor(2);
    flyer.style.width = `${fromRect.width}px`;
    flyer.style.height = `${fromRect.height}px`;
    flyer.style.transform = `translate3d(${fromRect.left}px, ${fromRect.top}px, 0)`;
    document.body.appendChild(flyer);

    const dx =
      toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2);
    const dy =
      toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2);
    const scale = Math.min(
      1.12,
      Math.max(0.88, toRect.width / Math.max(fromRect.width, 1)),
    );

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      flyer.remove();
      placeholder.remove();
      this._transitioning.delete(id);
      this._createOrUpdateSquare(word, {
        settled: true,
        position: targetPos,
        living: false,
      });
    };

    const run = () => {
      flyer.classList.add("wps-square--traveling-active");
      flyer.style.transform = `translate3d(${fromRect.left + dx}px, ${fromRect.top + dy}px, 0) scale(${scale})`;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    requestAnimationFrame(() => requestAnimationFrame(run));

    flyer.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 1400);
  }

  _createOrUpdateSquare(
    word,
    {
      settled = false,
      position = null,
      living = false,
      memberIndex = 0,
      memberTotal = 1,
    } = {},
  ) {
    const sureCount = word.sureCount || 0;
    const visualState = this.getVisualState(sureCount);
    const stateClass = `wps-state-${visualState}`;
    const id = String(word.id ?? word.word);

    let el = this._chaoticEl.querySelector(`[data-word-id="${CSS.escape(id)}"]`);

    if (!el) {
      el = document.createElement("div");
      el.dataset.wordId = id;
      el.className = "wps-square";
      el.addEventListener("click", () => this.onSquareClick(word));
      this._chaoticEl.appendChild(el);
    }

    const modeClass = settled ? "wps-square--settled" : "wps-square--chaotic";
    const livingClass = settled && living ? "wps-square--living" : "";
    el.className = `wps-square ${modeClass} ${livingClass} ${stateClass}`.trim();
    el.style.backgroundColor = this.getSquareColor(sureCount);

    if (settled && position) {
      el.style.left = `${position.leftPx}px`;
      el.style.top = `${position.topPx}px`;
      this._applySettledMotionVars(el, id, living, memberIndex, memberTotal);
    } else {
      const layoutEntry = this._chaoticLayout.get(id);
      const maxDrift = layoutEntry?.maxDriftPx ?? 11;
      this._applyMotionVars(el, id, visualState, sureCount, maxDrift);
      if (layoutEntry) {
        el.style.left = `${layoutEntry.leftPx}px`;
        el.style.top = `${layoutEntry.topPx}px`;
      } else {
        el.style.left = "";
        el.style.top = "";
      }
    }

    return el;
  }

  render(levelWords) {
    const root = this._getRoot();
    if (!root) return;

    this._ensureSections(root);

    const comboKey = this._storageKey("combo");
    const comboChanged = this._lastComboKey !== comboKey;
    if (comboChanged) {
      this._lastComboKey = comboKey;
      this._previousMastered = new Set();
      this._hasRenderedOnce = false;
      this._transitioning.clear();
    }

    const allSorted = [...levelWords].sort((a, b) =>
      String(a.id ?? a.word).localeCompare(String(b.id ?? b.word), undefined, {
        numeric: true,
      }),
    );
    const indexById = new Map(
      allSorted.map((w, i) => [String(w.id ?? w.word), i]),
    );

    const active = [];
    const mastered = [];

    levelWords.forEach((word) => {
      if ((word.sureCount || 0) >= 2) mastered.push(word);
      else active.push(word);
    });

    mastered.sort((a, b) =>
      String(a.id ?? a.word).localeCompare(String(b.id ?? b.word), undefined, {
        numeric: true,
      }),
    );

    const sortedMasteredIds = mastered.map((w) => String(w.id ?? w.word));

    const progressReset =
      this._hasRenderedOnce &&
      this._previousMastered.size > 0 &&
      mastered.length === 0;
    const forceNewLayout = comboChanged || progressReset;

    const areaW = this._resolveAreaWidth(root);
    this._invalidateLayoutIfWidthChanged(areaW);

    let areaH = this._areaHeightForLayout(active.length, allSorted.length);
    let shapePositions = this._computeShapeLayout(
      allSorted.length,
      areaW,
      areaH,
      comboKey,
    );
    const shapeBottom = this._shapeBottomExtent(shapePositions);
    if (shapeBottom + 6 > areaH) {
      areaH = shapeBottom + 8;
      shapePositions = this._computeShapeLayout(
        allSorted.length,
        areaW,
        areaH,
        comboKey,
      );
    }

    const blocked = mastered
      .map((w) => {
        const idx = indexById.get(String(w.id ?? w.word));
        return idx !== undefined ? shapePositions[idx] : null;
      })
      .filter(Boolean);

    const shapeComplete =
      allSorted.length > 0 &&
      active.length === 0 &&
      mastered.length === allSorted.length;

    this._chaoticEl.classList.toggle("wps-chaotic-area--living", shapeComplete);
    if (shapeComplete) {
      this._applyEnsembleMotion(this._chaoticEl, comboKey);
    } else {
      this._clearEnsembleMotion(this._chaoticEl);
    }

    this._syncChaoticLayout(
      active,
      comboKey,
      forceNewLayout,
      blocked,
      areaH,
      allSorted.length,
    );

    const nextMastered = new Set(sortedMasteredIds);
    const newlyMastered = new Set();
    if (this._hasRenderedOnce) {
      nextMastered.forEach((id) => {
        if (!this._previousMastered.has(id)) newlyMastered.add(id);
      });
    }
    this._previousMastered = nextMastered;
    this._hasRenderedOnce = true;

    const keepIds = new Set();

    active.forEach((word) => {
      const id = String(word.id ?? word.word);
      keepIds.add(id);
      this._createOrUpdateSquare(word, { settled: false });
    });

    newlyMastered.forEach((id) => {
      const chaoticEl = this._chaoticEl.querySelector(
        `[data-word-id="${CSS.escape(id)}"]`,
      );
      const word = mastered.find((w) => String(w.id ?? w.word) === id);
      const idx = indexById.get(id);
      const targetPos =
        idx !== undefined ? shapePositions[idx] : null;
      if (chaoticEl && word && targetPos) {
        this._animateMasteryTransition(word, chaoticEl, targetPos);
      }
    });

    mastered.forEach((word, memberIndex) => {
      const id = String(word.id ?? word.word);
      keepIds.add(id);
      if (this._transitioning.has(id)) return;
      const idx = indexById.get(id);
      const position =
        idx !== undefined ? shapePositions[idx] : null;
      if (position) {
        this._createOrUpdateSquare(word, {
          settled: true,
          position,
          living: shapeComplete,
          memberIndex,
          memberTotal: mastered.length,
        });
      }
    });

    this._transitioning.forEach((id) => keepIds.add(id));
    this._pruneOrphans(this._chaoticEl, keepIds);

    this._chaoticEl.style.minHeight =
      allSorted.length > 0 ? `${areaH}px` : "";
  }

  _pruneOrphans(container, keepIds) {
    container.querySelectorAll("[data-word-id]").forEach((el) => {
      if (!keepIds.has(el.dataset.wordId)) el.remove();
    });
  }
}
