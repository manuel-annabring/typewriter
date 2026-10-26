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
export const BAIL_WRAP = (25 * Math.PI) / 180

/**
 * How far round the platen the sheet wraps below the tangent point before it runs
 * straight again. Bail wrap plus this is half a turn, so the tail leaves the platen
 * parallel to the free front part, 2 x radius behind it, and the two never cross. A real
 * tail lies on the paper table; there is no table in the model yet.
 */
export const WRAP_ANGLE = Math.PI - BAIL_WRAP

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

/**
 * Bends a sheet point at distance `s` from the tangent point. The sheet follows a circle
 * of `radius` whose centre is `radius` behind the tangent point: upward to `bailWrap`
 * (the paper bail), downward to `wrapAngle` (round the bottom of the platen). Past either
 * end it runs straight on along the circle's last direction. `psi` is the angle round the
 * circle from the tangent point, positive up and back over the platen. Distances along
 * the sheet are kept, so text drawn on the flat sheet lands at the same arc length.
 */
export function bendPoint(s: number, radius: number, bailWrap: number, wrapAngle: number): BentPoint {
  const psi = Math.min(Math.max(s / radius, -wrapAngle), bailWrap)
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

/** Vertex shader declarations: uniforms and the GLSL twin of `bendPoint`. */
export const BEND_VERTEX_PARS = /* glsl */ `
uniform float uPaperFeed;
uniform vec3 uPaperUp;
uniform vec3 uPaperOut;
uniform vec3 uPaperTangent;
uniform float uPaperRadius;
uniform float uPaperFrontSign;
vec2 paperBendPoint(float s, out vec2 bentNormal) {
  float psi = clamp(s / uPaperRadius, -${WRAP_ANGLE.toFixed(6)}, ${BAIL_WRAP.toFixed(6)});
  float sinPsi = sin(psi);
  float cosPsi = cos(psi);
  float straight = s - psi * uPaperRadius;
  bentNormal = vec2(sinPsi, cosPsi);
  return vec2(uPaperRadius * sinPsi + straight * cosPsi, uPaperRadius * cosPsi - uPaperRadius - straight * sinPsi);
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
