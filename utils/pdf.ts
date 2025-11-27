import { jsPDF } from "jspdf";
import { CalculationResult, EarthworkRow } from '../types';

export function generatePDF(data: CalculationResult, singleIndex?: number): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const rows = singleIndex !== undefined ? [data.rows[singleIndex]] : data.rows;

  // A4 Landscape: 297mm x 210mm
  const PAGE_W = 297;
  const PAGE_H = 210;
  const MARGIN = 15;
  const DRAW_W = PAGE_W - (2 * MARGIN);
  const DRAW_H = PAGE_H - (2 * MARGIN) - 30; // Leave space for header/footer
  const CENTER_X = PAGE_W / 2;
  const BASE_Y = PAGE_H / 2 + 20; // Rough visual center for the road

  rows.forEach((row, i) => {
    if (i > 0) doc.addPage();

    // -- Header --
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Cross Section @ Ch: ${row.chainage}`, MARGIN, MARGIN + 5);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`FRL: ${row.fglC.toFixed(3)} | Formation Width: ${row.B}m`, MARGIN, MARGIN + 12);
    
    // -- Geometry Prep (Similar to Visualizer) --
    const { B, fglC, camberDrop, medianWidth, egl15L, eglMedL, eglMedR, egl15R, distL, distR } = row;

    // Helper to get ground level
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

    // Calculate Y range to determine scale
    // Collect all critical Y points
    const yPoints = [fglC, fglC - camberDrop, getG(-15), getG(15), getG(0), getG(-distL), getG(distR)];
    const minY = Math.min(...yPoints);
    const maxY = Math.max(...yPoints);
    const heightDiff = maxY - minY;
    
    // Scale Logic
    // We want to fit roughly 40m horizontal (-20 to +20) and heightDiff + 5m vertical
    const ScaleX = DRAW_W / 40; // Pixels per meter
    const ScaleY = 10; // Fixed vertical exaggeration? Or auto? Let's use auto but limit it.
    
    // Let's use isotropic scaling for CAD-like feel, or slight exaggeration?
    // Standard Cross sections often have same scale H & V.
    // 1:100 scale on paper means 1cm = 1m.
    // On A4 (297mm), we have ~260mm. 40m fits at 1:150 (40m = 26cm). 
    // Let's pick a scale factor k.
    const k = Math.min(DRAW_W / 40, DRAW_H / (heightDiff + 5)); 
    
    // Coordinate Mapper
    // Map Engineering (x,y) to PDF (x,y)
    // Eng X=0 -> PDF X=CENTER_X
    // Eng Y=fglC -> PDF Y=BASE_Y (middle of page)
    // Note: PDF Y grows downwards. Eng Y grows upwards.
    const mapX = (x: number) => CENTER_X + (x * k);
    const mapY = (y: number) => BASE_Y - ((y - fglC) * k); // Reference FRL as center anchor

    // -- DRAWING --

    // Grid / Axis (Optional)
    doc.setDrawColor(200, 200, 200);
    doc.line(mapX(-20), mapY(fglC), mapX(20), mapY(fglC)); // Horizon line at FRL
    doc.line(mapX(0), mapY(fglC)+20, mapX(0), mapY(fglC)-20); // CL

    // 1. EGL Polyline
    doc.setDrawColor(0, 150, 0); // Green
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([2, 1], 0); // Dashed
    
    const drawGround = () => {
        const step = 0.5;
        let start = -18;
        let end = 18;
        let first = true;
        for(let x = start; x <= end; x += step) {
            const y = getG(x);
            const px = mapX(x);
            const py = mapY(y);
            if(first) {
                first = false; 
            } else {
                const prevX = mapX(x - step);
                const prevY = mapY(getG(x - step));
                doc.line(prevX, prevY, px, py);
            }
        }
    };
    drawGround();
    doc.setLineDashPattern([], 0); // Reset solid

    // 2. Road & Slopes
    doc.setDrawColor(0, 0, 255); // Blue
    doc.setLineWidth(0.7);

    // Points
    const pFglC = {x: 0, y: fglC};
    const pFglL = {x: -B/2, y: fglC - camberDrop};
    const pFglR = {x: B/2, y: fglC - camberDrop};
    const pToeL = {x: -distL, y: getG(-distL)};
    const pToeR = {x: distR, y: getG(distR)};

    // Draw Surface
    doc.line(mapX(pFglL.x), mapY(pFglL.y), mapX(pFglC.x), mapY(pFglC.y));
    doc.line(mapX(pFglC.x), mapY(pFglC.y), mapX(pFglR.x), mapY(pFglR.y));

    // Draw Slopes
    doc.setDrawColor(100, 100, 100); // Grey
    doc.line(mapX(pFglL.x), mapY(pFglL.y), mapX(pToeL.x), mapY(pToeL.y));
    doc.line(mapX(pFglR.x), mapY(pFglR.y), mapX(pToeR.x), mapY(pToeR.y));

    // Vertical Lines (Formation)
    doc.setDrawColor(200, 200, 200);
    doc.line(mapX(pFglL.x), mapY(pFglL.y), mapX(pFglL.x), mapY(pFglL.y)+10);
    doc.line(mapX(pFglR.x), mapY(pFglR.y), mapX(pFglR.x), mapY(pFglR.y)+10);

    // -- Dimensions & Labels --
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);

    // Slopes
    doc.text(`1:${row.usedSlope}`, mapX((pFglL.x+pToeL.x)/2), mapY((pFglL.y+pToeL.y)/2) - 2);
    doc.text(`1:${row.usedSlope}`, mapX((pFglR.x+pToeR.x)/2), mapY((pFglR.y+pToeR.y)/2) - 2);

    // Offsets
    doc.text(`L: ${distL.toFixed(2)}m`, mapX(pToeL.x), mapY(pToeL.y) + 5, {align: 'center'});
    doc.text(`R: ${distR.toFixed(2)}m`, mapX(pToeR.x), mapY(pToeR.y) + 5, {align: 'center'});
    
    // Areas Box
    doc.setDrawColor(0);
    doc.setFillColor(245, 245, 245);
    doc.rect(CENTER_X - 20, BASE_Y + 15, 40, 20, 'FD');
    doc.setFontSize(10);
    doc.text(row.type, CENTER_X, BASE_Y + 20, {align: 'center'});
    doc.setFontSize(9);
    doc.setTextColor(200, 0, 0);
    doc.text(`Cut: ${row.areaCut.toFixed(2)}`, CENTER_X, BASE_Y + 25, {align: 'center'});
    doc.setTextColor(0, 150, 0);
    doc.text(`Fill: ${row.areaFill.toFixed(2)}`, CENTER_X, BASE_Y + 30, {align: 'center'});

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Generated by Highway Earthwork Calculator", MARGIN, PAGE_H - 10);
    doc.text(`Page ${i + 1}`, PAGE_W - MARGIN - 10, PAGE_H - 10);
  });

  return doc;
}