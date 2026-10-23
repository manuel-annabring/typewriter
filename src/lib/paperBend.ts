// Pure paper-bend math, in meters. No three.js here. The sheet is described in its own
// 2D frame: `along` runs up the sheet (bottom edge to top edge), `out` points from the
// platen axis to the sheet's plane. The origin is the tangent point, where the flat sheet
// touches the wrap circle. The shader chunks below are the GLSL twin of `bendPoint`;
// keep the two in sync.

/**
 * How far round the platen the sheet wraps before it runs straight again. Half a turn
 * sends the tail back up behind the platen, parallel to the front of the sheet. A smaller
 * angle would lean it back like a paper table, but there is no table in the model yet.
 */
export const WRAP_ANGLE = Math.PI

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
 * Bends a sheet point at distance `s` from the tangent point. Above the tangent point
 * (s >= 0) the sheet is flat. Below it the sheet wraps round a circle of `radius` whose
 * centre is `radius` behind the tangent point, up to `wrapAngle`; what is left runs
 * straight on along the wrap's last direction. Distances along the sheet are kept, so
 * text drawn on the flat sheet lands at the same arc length on the wrap.
 */
export function bendPoint(s: number, radius: number, wrapAngle: number): BentPoint {
  if (s >= 0) return { along: s, out: 0, normalAlong: 0, normalOut: 1 }
  const phi = Math.min(-s / radius, wrapAngle)
  const sin = Math.sin(phi)
  const cos = Math.cos(phi)
  const tail = -s - phi * radius
  return {
    along: -radius * sin - tail * cos,
    out: -radius + radius * cos - tail * sin,
    normalAlong: -sin,
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
  if (s >= 0.0) {
    bentNormal = vec2(0.0, 1.0);
    return vec2(s, 0.0);
  }
  float phi = min(-s / uPaperRadius, ${WRAP_ANGLE.toFixed(6)});
  float sinPhi = sin(phi);
  float cosPhi = cos(phi);
  float tail = -s - phi * uPaperRadius;
  bentNormal = vec2(-sinPhi, cosPhi);
  return vec2(-uPaperRadius * sinPhi - tail * cosPhi, -uPaperRadius + uPaperRadius * cosPhi - tail * sinPhi);
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
