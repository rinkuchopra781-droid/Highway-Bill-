
import { CalculationResult, EarthworkRow } from '../types';

// Helper to create a DXF Line
const line = (x1: number, y1: number, x2: number, y2: number, layer: string) => {
  return `0\nLINE\n8\n${layer}\n10\n${x1.toFixed(3)}\n20\n${y1.toFixed(3)}\n11\n${x2.toFixed(3)}\n21\n${y2.toFixed(3)}\n`;
};

// Helper to create DXF Text
const text = (x: number, y: number, height: number, value: string, layer: string, align: 'left'|'center'|'right' = 'left') => {
  let str = `0\nTEXT\n8\n${layer}\n10\n${x.toFixed(3)}\n20\n${y.toFixed(3)}\n40\n${height}\n1\n${value}\n`;
  if (align === 'center') {
    str += `72\n1\n11\n${x.toFixed(3)}\n21\n${y.toFixed(3)}\n`;
  } else if (align === 'right') {
    str += `72\n2\n11\n${x.toFixed(3)}\n21\n${y.toFixed(3)}\n`;
  }
  return str;
};

// Helper to create LWPOLYLINE
const polyline = (points: {x: number, y: number}[], layer: string, closed = false) => {
  let str = `0\nLWPOLYLINE\n8\n${layer}\n90\n${points.length}\n70\n${closed ? 1 : 0}\n`;
  points.forEach(p => {
    str += `10\n${p.x.toFixed(3)}\n20\n${p.y.toFixed(3)}\n`;
  });
  return str;
};

export function generateDXF(data: CalculationResult, singleRowIndex?: number): string {
  // DXF Header
  let dxf = `0\nSECTION\n2\nHEADER\n0\nENDSEC\n`;
  
  // Tables (Layers)
  dxf += `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n`;
  // Layer: CS_ROAD
  dxf += `0\nLAYER\n2\nCS_ROAD\n70\n0\n62\n4\n6\nCONTINUOUS\n`; // Cyan
  // Layer: CS_EGL
  dxf += `0\nLAYER\n2\nCS_EGL\n70\n0\n62\n3\n6\nDASHDOT\n`; // Green
  // Layer: CS_TEXT
  dxf += `0\nLAYER\n2\nCS_TEXT\n70\n0\n62\n2\n6\nCONTINUOUS\n`; // Yellow
  dxf += `0\nENDTAB\n0\nENDSEC\n`;

  // Entities
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  const rowsToDraw = singleRowIndex !== undefined 
    ? [data.rows[singleRowIndex]] 
    : data.rows;

  // Vertical spacing between sections in CAD (Model Space)
  const Y_SPACING = 30;

  rowsToDraw.forEach((row, i) => {
    // Offset for stacking sections vertically (In CAD Y is Up, so we subtract to stack downwards or add to stack up)
    // Let's stack them horizontally or vertically. Vertically with gap.
    const OriginY = i * Y_SPACING; 
    const OriginX = 0;

    const { B, fglC, camberDrop, medianWidth, egl15L, eglMedL, eglMedR, egl15R, usedSlope, hL, hR, distL, distR } = row;

    // --- Geometry Calculation (Replicated from Visualizer/Calculator logic) ---
    
    // Road Points relative to Center (0,0 is CL at FRL height roughly)
    // We will use real world elevations for Y, but local offsets for X centered at 0
    
    // Road Edges
    const pFglC = { x: 0, y: fglC };
    const pFglL = { x: -B/2, y: fglC - camberDrop };
    const pFglR = { x: B/2, y: fglC - camberDrop };

    // Toes
    // Note: hL = (Road - Ground). If hL > 0 (Cut), Ground is above Road. 
    // Wait, hL in types.ts was defined as height diff. Let's rely on calculated distL/distR and slope.
    
    // Re-calculating Toe Y based on slope to be precise for drawing lines
    // Left side
    const isCutL = row.hL > 0; // Simplified check from types
    const slopeSignL = isCutL ? 1 : -1; // Cut goes Up, Fill goes Down
    const yToeL = pFglL.y + (slopeSignL * (distL - (B/2))) / usedSlope;
    // However, simpler is just finding intersection with ground.
    // Let's rely on Calculator's `distL` which is horizontal distance from center.
    
    // Let's reconstruct Toe Points from distL/distR.
    // Slope = 1:M (1 Vertical, M Horizontal) -> dy = dx / M
    const dxL = distL - (B/2);
    // Determine direction of Y based on type. 
    // Actually, we don't need to re-calculate perfectly if we have the EGL points, 
    // but connecting the line requires knowing if it goes up or down.
    // Let's use the EGL logic for the toe Y.
    
    // Helper to interpolate EGL for Toe Y
    const groundPts = [
        {x: -15, y: egl15L},
        {x: -medianWidth/2, y: eglMedL},
        {x: medianWidth/2, y: eglMedR},
        {x: 15, y: egl15R}
    ].sort((a,b) => a.x - b.x);

    const getG = (x: number) => {
        if(x <= groundPts[0].x) return groundPts[0].y;
        if(x >= groundPts[3].x) return groundPts[3].y;
        for(let k=0; k<3; k++){
             if(x >= groundPts[k].x && x <= groundPts[k+1].x){
                 const t = (x - groundPts[k].x)/(groundPts[k+1].x - groundPts[k].x);
                 return groundPts[k].y + t*(groundPts[k+1].y - groundPts[k].y);
             }
        }
        return groundPts[0].y;
    };

    const pToeL = { x: -distL, y: getG(-distL) };
    const pToeR = { x: distR, y: getG(distR) };

    // --- DRAWING ENTITIES ---

    // 1. Center Line (Phantom)
    dxf += line(0, OriginY + fglC - 5, 0, OriginY + fglC + 5, 'CS_TEXT');
    
    // 2. Road Surface
    dxf += line(pFglL.x, OriginY + pFglL.y, pFglC.x, OriginY + pFglC.y, 'CS_ROAD');
    dxf += line(pFglC.x, OriginY + pFglC.y, pFglR.x, OriginY + pFglR.y, 'CS_ROAD');
    
    // 3. Slopes (Road Edge to Toe)
    dxf += line(pFglL.x, OriginY + pFglL.y, pToeL.x, OriginY + pToeL.y, 'CS_ROAD');
    dxf += line(pFglR.x, OriginY + pFglR.y, pToeR.x, OriginY + pToeR.y, 'CS_ROAD');

    // 4. Vertical Drops (Formation Width markers)
    dxf += line(pFglL.x, OriginY + pFglL.y, pFglL.x, OriginY + pFglL.y - 1, 'CS_TEXT');
    dxf += line(pFglR.x, OriginY + pFglR.y, pFglR.x, OriginY + pFglR.y - 1, 'CS_TEXT');

    // 5. EGL Polyline (Extended)
    const eglPoints = [
        { x: -Math.max(16, distL + 1), y: getG(-Math.max(16, distL + 1)) }, // Ext left
        ...groundPts,
        { x: Math.max(16, distR + 1), y: getG(Math.max(16, distR + 1)) }  // Ext right
    ];
    
    const eglDxfPoints = eglPoints.map(p => ({ x: p.x, y: OriginY + p.y }));
    dxf += polyline(eglDxfPoints, 'CS_EGL');

    // 6. Text Labels
    // Chainage Title
    dxf += text(0, OriginY + fglC + 4, 1.5, `CH: ${row.chainage}`, 'CS_TEXT', 'center');
    
    // FRL
    dxf += text(0, OriginY + fglC + 0.5, 0.5, `FRL: ${fglC.toFixed(3)}`, 'CS_TEXT', 'center');

    // Areas
    dxf += text(0, OriginY + fglC - 3, 0.8, `Cut: ${row.areaCut.toFixed(2)}m2`, 'CS_TEXT', 'center');
    dxf += text(0, OriginY + fglC - 4.2, 0.8, `Fill: ${row.areaFill.toFixed(2)}m2`, 'CS_TEXT', 'center');

    // Slope Labels
    dxf += text((pFglL.x + pToeL.x)/2, OriginY + (pFglL.y + pToeL.y)/2 + 0.5, 0.4, `1:${usedSlope}`, 'CS_TEXT', 'center');
    dxf += text((pFglR.x + pToeR.x)/2, OriginY + (pFglR.y + pToeR.y)/2 + 0.5, 0.4, `1:${usedSlope}`, 'CS_TEXT', 'center');
    
    // Datum / Base Line
    dxf += line(-15, OriginY + fglC - 10, 15, OriginY + fglC - 10, 'CS_TEXT');
    dxf += text(0, OriginY + fglC - 11, 0.5, `Datum: ${(fglC - 10).toFixed(0)}`, 'CS_TEXT', 'center');

  });

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
}
