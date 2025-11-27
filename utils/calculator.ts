
import { EarthworkRow, CalculationResult } from '../types';

// Helper to clean and parse a number
const pNum = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return NaN;
  const cleaned = String(val).replace(/,/g, '').trim();
  return parseFloat(cleaned);
};

// Chainage string parser
function chainageToMeters(token: string): number {
  token = token.toString().trim();
  const m = token.match(/^(\d+)\+(\d{1,3})$/);
  if (m) {
    return parseInt(m[1], 10) * 1000 + parseInt(m[2].padStart(3, '0'), 10);
  }
  const plain = token.replace(/m$/i, '').replace(/[, ]/g, '');
  const num = Number(plain);
  if (!isNaN(num)) return Math.round(num);
  return NaN;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

interface Point { x: number; y: number; }

// Line Intersection
function getIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
  
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return null; // Parallel

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: x1 + ua * (x2 - x1),
      y: y1 + ua * (y2 - y1)
    };
  }
  return null;
}

// Get Ground Level at specific offset X
// UPDATED: Now extends FLAT (constant level) beyond the defined range
function getInterpolatedEGL(x: number, groundProfile: Point[]): number {
    // Extrapolate Flat if outside bounds
    if (x <= groundProfile[0].x) {
        return groundProfile[0].y;
    }
    if (x >= groundProfile[groundProfile.length-1].x) {
        return groundProfile[groundProfile.length-1].y;
    }

    // Interpolate
    for(let i=0; i<groundProfile.length-1; i++) {
        const p1 = groundProfile[i];
        const p2 = groundProfile[i+1];
        if (x >= p1.x && x <= p2.x) {
             const t = (x - p1.x) / (p2.x - p1.x);
             return p1.y + t * (p2.y - p1.y);
        }
    }
    return groundProfile[0].y; // Fallback
}


export function computeEarthwork(
  csvData: string,
  B: number,
  medianWidth: number,
  camber: number,
  cutSlope: number,
  fillSlope: number,
  fixedSpacing?: number
): CalculationResult {
  
  // 1. Parse CSV
  const lines = csvData.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) throw new Error("Please enter data with a header row.");

  const headers = lines[0].split(/[,\t]+/).map(h => h.trim().toLowerCase());
  
  // Robust Column Mapping
  const colMap: {[key: string]: number} = {};
  headers.forEach((h, i) => {
    if (h.includes('chain')) colMap['ch'] = i;
    else if (h.includes('prop') || h.includes('frl') || h.includes('fgl')) colMap['fgl'] = i;
    // Specific multi-offsets
    else if (h.includes('15m_left') || h === 'l15' || h.includes('egl_15m_l')) colMap['l15'] = i;
    else if (h.includes('median_lhs') || h.includes('med_l')) colMap['med_l'] = i;
    else if (h.includes('median_rhs') || h.includes('med_r')) colMap['med_r'] = i;
    else if (h.includes('15m_right') || h === 'r15' || h.includes('egl_15m_r')) colMap['r15'] = i;
    // Fallback
    else if (h === 'egl' || h.includes('ground')) colMap['egl_generic'] = i;
  });

  if (colMap['ch'] === undefined) throw new Error("Missing 'Chainage' column.");
  if (colMap['fgl'] === undefined) throw new Error("Missing 'Proposed_FRL' column.");

  const rows: EarthworkRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,\t]+/).map(s => s.trim());
    if (cols.length < 2) continue;

    const chStr = cols[colMap['ch']];
    const chM = chainageToMeters(chStr);
    const fglC = pNum(cols[colMap['fgl']]);

    if (isNaN(chM) || isNaN(fglC)) continue;

    // Logic to determine EGL points
    let egl15L, eglMedL, eglMedR, egl15R;

    if (colMap['l15'] !== undefined && colMap['med_l'] !== undefined && colMap['med_r'] !== undefined && colMap['r15'] !== undefined) {
        // We have specific columns
        egl15L = pNum(cols[colMap['l15']]);
        eglMedL = pNum(cols[colMap['med_l']]);
        eglMedR = pNum(cols[colMap['med_r']]);
        egl15R = pNum(cols[colMap['r15']]);
    } else if (colMap['egl_generic'] !== undefined) {
        // Fallback to flat ground
        const val = pNum(cols[colMap['egl_generic']]);
        egl15L = val; eglMedL = val; eglMedR = val; egl15R = val;
    } else {
        // Fallback 2: Try position based if cols exist
        if (cols.length >= 6 && !isNaN(pNum(cols[2])) && !isNaN(pNum(cols[5]))) {
           egl15L = pNum(cols[2]);
           eglMedL = pNum(cols[3]);
           eglMedR = pNum(cols[4]);
           egl15R = pNum(cols[5]);
        } else {
             // Absolute fallback
             egl15L = fglC; eglMedL = fglC; eglMedR = fglC; egl15R = fglC;
        }
    }

    // Sanitize NaNs
    if (isNaN(egl15L)) egl15L = fglC;
    if (isNaN(eglMedL)) eglMedL = egl15L;
    if (isNaN(eglMedR)) eglMedR = eglMedL;
    if (isNaN(egl15R)) egl15R = eglMedR;

    // Define Ground Profile Points based on dynamic median width
    const halfMed = medianWidth / 2;
    
    // Create sorted profile points. 
    // We assume 15m is further out than median. 
    const groundPts: Point[] = [
        { x: -15, y: egl15L },
        { x: -halfMed, y: eglMedL },
        { x: halfMed, y: eglMedR },
        { x: 15, y: egl15R }
    ];

    // If median width is very large (>30m), x coords might be weird order (-15 then -20). Sort them.
    groundPts.sort((a,b) => a.x - b.x);

    // Calculate Formation Geometry
    const camberDrop = (B / 2) * (camber / 100);
    const fglL_edge = fglC - camberDrop;
    const fglR_edge = fglC - camberDrop;

    // Road Edge Points
    const pRoadL = { x: -B/2, y: fglL_edge };
    const pRoadR = { x: B/2, y: fglR_edge };

    // Find Ground Y at Edge X to determine slope direction (Cut vs Fill)
    const gL_at_edge = getInterpolatedEGL(-B/2, groundPts);
    const gR_at_edge = getInterpolatedEGL(B/2, groundPts);

    const hL_internal = gL_at_edge - fglL_edge; // +ve if Ground > Road (Cut)
    const hR_internal = gR_at_edge - fglR_edge; // +ve if Ground > Road (Cut)

    // Decide Slope M (Horizontal : 1 Vertical)
    const isCutL = hL_internal > 0;
    const isCutR = hR_internal > 0;
    const slopeL = isCutL ? cutSlope : fillSlope;
    const slopeR = isCutR ? cutSlope : fillSlope;

    // Gradient dy/dx
    // Cut Left: x goes left (-), y goes up (+). dy/dx = -1/M
    // Fill Left: x goes left (-), y goes down (-). dy/dx = 1/M
    const gradL = isCutL ? -1/slopeL : 1/slopeL;
    // Cut Right: x goes right (+), y goes up (+). dy/dx = 1/M
    // Fill Right: x goes right (+), y goes down (-). dy/dx = -1/M
    const gradR = isCutR ? 1/slopeR : -1/slopeR;

    // --- Find Toes via Intersection ---
    // Extend the ground profile infinitely left and right FLAT (Constant Y)
    const extendedGround = [
        { x: -1000, y: groundPts[0].y }, // Flat extension
        ...groundPts,
        { x: 1000, y: groundPts[3].y }   // Flat extension
    ];

    let toeL: Point = { x: -B/2, y: gL_at_edge }; 
    let toeR: Point = { x: B/2, y: gR_at_edge };

    // Find intersection Left
    // Cast ray from pRoadL to x = -1000
    for (let j=0; j<extendedGround.length-1; j++) {
        const rayStart = pRoadL;
        const rayEnd = { x: pRoadL.x - 1000, y: pRoadL.y + gradL * (-1000) };
        const pt = getIntersection(rayStart, rayEnd, extendedGround[j], extendedGround[j+1]);
        if (pt && pt.x <= -B/2 + 0.001) {
            toeL = pt;
            break; 
        }
    }

    // Find intersection Right
    for (let j=0; j<extendedGround.length-1; j++) {
        const rayStart = pRoadR;
        const rayEnd = { x: pRoadR.x + 1000, y: pRoadR.y + gradR * (1000) };
        const pt = getIntersection(rayStart, rayEnd, extendedGround[j], extendedGround[j+1]);
        if (pt && pt.x >= B/2 - 0.001) {
            toeR = pt;
            break;
        }
    }

    // --- Calculate Area (Detailed Polygon) ---
    // Using Strip Method (Riemann Sum) for robust Cut/Fill separation on irregular ground
    
    let areaCut = 0;
    let areaFill = 0;
    
    // Critical X coordinates for integration
    const criticalX = new Set<number>([
        -B/2, 0, B/2, // Road changes
        toeL.x, toeR.x, // Toes
        ...groundPts.map(p => p.x) // Ground break points
    ]);
    
    const sortedX = Array.from(criticalX)
        .sort((a,b) => a-b)
        .filter(x => x >= toeL.x - 0.001 && x <= toeR.x + 0.001); // Filter within toes

    for (let k=0; k<sortedX.length-1; k++) {
        const x1 = sortedX[k];
        const x2 = sortedX[k+1];
        if (Math.abs(x2 - x1) < 0.001) continue;
        
        const mid = (x1+x2)/2;
        
        // Road Y at mid
        let roadY = 0;
        if (mid < -B/2) {
            roadY = fglL_edge + gradL * (mid - (-B/2));
        } else if (mid > B/2) {
            roadY = fglR_edge + gradR * (mid - B/2);
        } else {
            // Formation (Camber)
            roadY = fglC - (Math.abs(mid) / (B/2)) * camberDrop;
        }

        const groundY = getInterpolatedEGL(mid, groundPts);
        const h = roadY - groundY; // +ve Fill (Road above Ground), -ve Cut
        const w = x2 - x1;
        
        // We use Math.abs(h) * w for area. 
        if (h > 0) areaFill += h * w;
        else areaCut += Math.abs(h) * w;
    }

    // Determine dominating type
    let type: 'Cut' | 'Fill' | 'Mixed' | 'Level' = 'Level';
    if (areaCut > 0.01 && areaFill < 0.01) type = 'Cut';
    else if (areaFill > 0.01 && areaCut < 0.01) type = 'Fill';
    else if (areaCut > 0.01 && areaFill > 0.01) type = 'Mixed';

    const totalArea = areaCut + areaFill;

    rows.push({
      chainage: chStr,
      chainage_m: chM,
      fglC: round3(fglC),
      egl15L: round3(egl15L),
      eglMedL: round3(eglMedL),
      eglMedR: round3(eglMedR),
      egl15R: round3(egl15R),
      camberDrop: round3(camberDrop),
      hL: round3(fglL_edge - gL_at_edge), 
      hR: round3(fglR_edge - gR_at_edge),
      type,
      B: round3(B),
      medianWidth: round3(medianWidth),
      usedSlope: (isCutL ? cutSlope : fillSlope), 
      distL: round3(Math.abs(toeL.x - (-B/2))),
      distR: round3(Math.abs(toeR.x - (B/2))),
      bottomWidth: round3(toeR.x - toeL.x),
      area: round3(totalArea),
      areaCut: round3(areaCut),
      areaFill: round3(areaFill),
      spacing: null,
      segVolume: 0 // Calc in next pass
    });
  }

  // 2. Volume Calculation (Avg End Area)
  let totalCut = 0;
  let totalFill = 0;

  for (let i = 0; i < rows.length - 1; i++) {
    let L: number;
    if (fixedSpacing !== undefined && fixedSpacing > 0 && !isNaN(fixedSpacing)) {
      L = fixedSpacing;
    } else {
      L = Math.abs(rows[i + 1].chainage_m - rows[i].chainage_m);
    }
    rows[i].spacing = round3(L);

    const A1 = rows[i].area;
    const A2 = rows[i + 1].area;
    const V = round3(((A1 + A2) / 2) * L);
    rows[i].segVolume = V;

    if (rows[i].type === 'Cut') totalCut += V;
    else if (rows[i].type === 'Fill') totalFill += V;
    else {
        // For Mixed, calculate volume split based on area ratio? 
        // Or simpler: just use dominant logic or pure net.
        // Standard practice: if mixed, keep volume mixed or split based on areas.
        // Here we do a simplified volume split based on Area ratio for accuracy
        const rCut = rows[i].areaCut / (rows[i].area || 1);
        const rFill = rows[i].areaFill / (rows[i].area || 1);
        
        totalCut += V * rCut;
        totalFill += V * rFill;
    }
  }

  return {
    rows,
    summary: {
      totalCut: round3(totalCut),
      totalFill: round3(totalFill),
      net: round3(totalCut - totalFill)
    }
  };
}

export function generateCSV(result: CalculationResult): string {
  const hdr = [
    'Chainage','Proposed_FRL','EGL_15m_L','EGL_Med_L','EGL_Med_R','EGL_15m_R',
    'Type','Width_Formation','Width_ToeToToe','Area_Cut_m2','Area_Fill_m2','Spacing_m','Vol_m3'
  ];
  const lines = [hdr.join(',')];
  
  for(const r of result.rows){
    lines.push([
      r.chainage,
      r.fglC.toFixed(3),
      r.egl15L.toFixed(3),
      r.eglMedL.toFixed(3),
      r.eglMedR.toFixed(3),
      r.egl15R.toFixed(3),
      r.type,
      r.B.toFixed(3),
      r.bottomWidth.toFixed(3),
      r.areaCut.toFixed(3),
      r.areaFill.toFixed(3),
      r.spacing !== null ? r.spacing.toFixed(3) : '',
      r.segVolume ? r.segVolume.toFixed(3) : ''
    ].join(','));
  }
  
  lines.push('');
  lines.push(['TotalCut_m3', result.summary.totalCut].join(','));
  lines.push(['TotalFill_m3', result.summary.totalFill].join(','));
  lines.push(['Net_m3', result.summary.net].join(','));
  
  return lines.join('\n');
}
