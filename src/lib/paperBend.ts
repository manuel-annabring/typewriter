// Pure paper-bend math, in meters. No three.js here. The sheet is described in its own
// 2D frame: `along` runs up the sheet (bottom edge to top edge), `out` points from the
// platen axis to the sheet's plane. The origin is the tangent point, where the flat sheet
// touches the wrap circle. The shader chunks below are the GLSL twin of `bendPoint`;
// keep the two in sync.

/**
 * How far above the tangent point the paper bail holds the sheet against the platen,
 * as an angle round the platen axis. The sheet hugs the platen up to the bail and leaves
 * it there, so the free, typed part leans back by this much more than the flat sheet.
 */
export const BAIL_WRAP = (30 * Math.PI) / 180

/**
 * Angle of the sheet's tail above horizontal, measured in the machine's side view: the
 * slope of the paper table it rests on (`PaperTable` in the model). It has
 * to be flatter than the free front part leans (90 degrees minus the sheet lean minus the
 * bail wrap, about 52 degrees), so the tail and the front move apart and never cross.
 */
export const TAIL_ANGLE = (35 * Math.PI) / 180

/**
 * How far round the platen the sheet wraps below the tangent point so its tail leaves at
 * `tailAngle` above horizontal. `sheetLean` is how far the flat sheet leans back from
 * vertical (measured from the model at mount). A wrap of half a turn would send the tail
 * up parallel to the flat sheet; every degree less lays it back by a degree.
 */
export function wrapAngleFor(sheetLean: number, tailAngle: number): number {
  return Math.PI / 2 + sheetLean + tailAngle
}

/**
 * How far the top edge of the free, typed part droops back under its own weight when
 * DROOP_REFERENCE_LENGTH of paper stands free above the bail (about the last row). The
 * droop grows with the cube of the free length, so it is barely there at row 0.
 */
export const DROOP_AT_REFERENCE = (25 * Math.PI) / 180
export const DROOP_REFERENCE_LENGTH = 0.25
/** Droop per cubic meter of free length: the constant in `droopAngle`. */
export const DROOP_RATE = DROOP_AT_REFERENCE / DROOP_REFERENCE_LENGTH ** 3
/**
 * Steps of the midpoint sum that follows the drooping free part. The GLSL twin uses the
 * same count, so both give the same shape.
 */
export const DROOP_STEPS = 24

/** How much of the ink shows through on the back of the sheet (0 = plain paper). */
export const BACK_INK = 0.12

export interface BentPoint {
  along: number
  out: number
  /** Unit normal of the bent sheet, pointing away from the platen axis on the wrap. */
  normalAlong: number
  normalOut: number
}

/**
 * Signed distance along the sheet from the tangent point to a sheet point, after the
 * sheet has been fed by `feed` (positive feeds the sheet up). `alongRest` and
 * `tangentAlong` are measured along the sheet's up axis from the same origin.
 */
export function alongFromTangent(alongRest: number, feed: number, tangentAlong: number): number {
  return alongRest + feed - tangentAlong
}

/** The shape of the bent sheet. Lengths in meters, angles in radians. */
export interface BendShape {
  radius: number
  /** How far the sheet follows the platen above the tangent point (the paper bail). */
  bailWrap: number
  /** How far the sheet follows the platen below the tangent point. */
  wrapAngle: number
  /** Droop per cubic meter of free length (DROOP_RATE; 0 keeps the free part straight). */
  droopRate: number
  /** How much of the sheet stands free above the bail (top edge minus the bail point). */
  freeLength: number
}

/**
 * Extra lean, on top of the bail wrap, at distance `u` above the bail. The free part is a
 * strip clamped at the bail and bent back by its own weight: the bending at a point grows
 * with the square of the paper above it, so the lean is
 * droopRate x (freeLength^3 - (freeLength - u)^3). At the top edge it is
 * droopRate x freeLength^3.
 */
export function droopAngle(u: number, freeLength: number, droopRate: number): number {
  return droopRate * (freeLength ** 3 - Math.max(freeLength - u, 0) ** 3)
}

/**
 * Bends a sheet point at distance `s` from the tangent point. The sheet follows a circle
 * of `radius` whose centre is `radius` behind the tangent point: upward to `bailWrap`
 * (the paper bail), downward to `wrapAngle` (round the bottom of the platen). `psi` is
 * the angle round the circle from the tangent point, positive up and back over the
 * platen. Below the wrap the tail runs straight on. Above the bail the free part leans
 * back by `droopAngle` more, and its shape is the sum of DROOP_STEPS short straight
 * pieces (midpoint rule). Distances along the sheet are kept, so text drawn on the flat
 * sheet lands at the same arc length.
 */
export function bendPoint(s: number, shape: BendShape): BentPoint {
  const { radius, bailWrap, wrapAngle, droopRate, freeLength } = shape
  const bailS = radius * bailWrap
  if (s <= bailS) {
    const psi = Math.max(s / radius, -wrapAngle)
    const sin = Math.sin(psi)
    const cos = Math.cos(psi)
    const straight = s - psi * radius
    return {
      along: radius * sin + straight * cos,
      out: radius * cos - radius - straight * sin,
      normalAlong: sin,
      normalOut: cos,
    }
  }
  const u = s - bailS
  const step = u / DROOP_STEPS
  let along = radius * Math.sin(bailWrap)
  let out = radius * Math.cos(bailWrap) - radius
  for (let i = 0; i < DROOP_STEPS; i++) {
    const lean = bailWrap + droopAngle((i + 0.5) * step, freeLength, droopRate)
    along += step * Math.cos(lean)
    out -= step * Math.sin(lean)
  }
  const lean = bailWrap + droopAngle(u, freeLength, droopRate)
  return { along, out, normalAlong: Math.sin(lean), normalOut: Math.cos(lean) }
}

/**
 * Vertex shader declarations: uniforms and the GLSL twin of `bendPoint`. uPaperWrap is
 * its wrapAngle; the free length is uPaperTopRest (the top edge's distance from the
 * tangent point at rest) plus the feed, minus the bail arc.
 */
export const BEND_VERTEX_PARS = /* glsl */ `
uniform float uPaperFeed;
uniform vec3 uPaperUp;
uniform vec3 uPaperOut;
uniform vec3 uPaperTangent;
uniform float uPaperRadius;
uniform float uPaperWrap;
uniform float uPaperTopRest;
uniform float uPaperFrontSign;
const float PAPER_BAIL = ${BAIL_WRAP.toFixed(6)};
const float PAPER_DROOP_RATE = ${DROOP_RATE.toFixed(6)};
const int PAPER_DROOP_STEPS = ${DROOP_STEPS};
float paperDroopAngle(float u, float freeLength) {
  float rest = max(freeLength - u, 0.0);
  return PAPER_DROOP_RATE * (freeLength * freeLength * freeLength - rest * rest * rest);
}
vec2 paperBendPoint(float s, out vec2 bentNormal) {
  float bailS = uPaperRadius * PAPER_BAIL;
  if (s <= bailS) {
    float psi = max(s / uPaperRadius, -uPaperWrap);
    float sinPsi = sin(psi);
    float cosPsi = cos(psi);
    float straight = s - psi * uPaperRadius;
    bentNormal = vec2(sinPsi, cosPsi);
    return vec2(uPaperRadius * sinPsi + straight * cosPsi, uPaperRadius * cosPsi - uPaperRadius - straight * sinPsi);
  }
  float freeLength = max(uPaperTopRest + uPaperFeed - bailS, 0.0);
  float u = s - bailS;
  float stepLength = u / float(PAPER_DROOP_STEPS);
  vec2 bent = vec2(uPaperRadius * sin(PAPER_BAIL), uPaperRadius * cos(PAPER_BAIL) - uPaperRadius);
  for (int i = 0; i < PAPER_DROOP_STEPS; i++) {
    float lean = PAPER_BAIL + paperDroopAngle((float(i) + 0.5) * stepLength, freeLength);
    bent += stepLength * vec2(cos(lean), -sin(lean));
  }
  float lean = PAPER_BAIL + paperDroopAngle(u, freeLength);
  bentNormal = vec2(sin(lean), cos(lean));
  return bent;
}
`


/**
 * Runs after <beginnormal_vertex> (which comes before <begin_vertex>): feeds the vertex
 * along the sheet, bends it and its normal, and leaves the position in `paperBent`.
 * `lateral` keeps the across-sheet (x) offset. The normal keeps the side the mesh's own
 * normal points to (uPaperFrontSign), so lighting and face direction stay as exported.
 */
export const BEND_NORMAL_VERTEX = /* glsl */ `
vec3 paperBent;
{
  vec3 fed = position + uPaperUp * uPaperFeed;
  float s = dot(fed - uPaperTangent, uPaperUp);
  vec3 lateral = fed - uPaperTangent - s * uPaperUp;
  vec2 bentNormal;
  vec2 bent = paperBendPoint(s, bentNormal);
  paperBent = uPaperTangent + lateral + uPaperUp * bent.x + uPaperOut * bent.y;
  objectNormal = uPaperFrontSign * (uPaperUp * bentNormal.x + uPaperOut * bentNormal.y);
}
`

/** Replaces <begin_vertex>. */
export const BEND_BEGIN_VERTEX = /* glsl */ `
vec3 transformed = paperBent;
`

/**
 * Replaces <map_fragment>: same sampling (the texture's colour space is decoded by the
 * sampler as before), but the side facing away from the text shows plain paper with a
 * faint show-through. uPaperFrontSign says which winding is the text side.
 */
export const BEND_MAP_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  bool textSide = gl_FrontFacing == ( uPaperFrontSign > 0.0 );
  if ( ! textSide ) sampledDiffuseColor = mix( vec4( 1.0 ), sampledDiffuseColor, ${BACK_INK.toFixed(3)} );
  diffuseColor *= sampledDiffuseColor;
#endif
`

export const BEND_FRAGMENT_PARS = /* glsl */ `
uniform float uPaperFrontSign;
`
