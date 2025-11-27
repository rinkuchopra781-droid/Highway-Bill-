import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CalculationResult, EarthworkRow } from '../types';
import { AreaChart, Layers, ChevronLeft, ChevronRight, FileCode, FileText } from 'lucide-react';
import { generateDXF } from '../utils/dxf';
import { generatePDF } from '../utils/pdf';

interface VisualizerProps {
  data: CalculationResult | null;
}

export const Visualizer: React.FC<VisualizerProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'section' | 'masshaul'>('section');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [data]);

  if (!data || data.rows.length === 0) return null;

  const safeIndex = selectedIndex < data.rows.length ? selectedIndex : 0;
  const currentRow = data.rows[safeIndex];

  const handleExportCurrentDXF = () => {
    const dxf = generateDXF(data, safeIndex);
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Section_${currentRow.chainage}.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCurrentPDF = () => {
    const doc = generatePDF(data, safeIndex);
    doc.save(`Section_${currentRow.chainage}.pdf`);
  };

  // Helper to generate coordinates
  const getCoords = (row: EarthworkRow) => {
      const { B, camberDrop, fglC, distL, distR, medianWidth, egl15L, eglMedL, eglMedR, egl15R } = row;
      
      // Road Points relative to Center (x=0)
      const xFglL = -B / 2;
      const xFglR = B / 2;
      const xToeL = xFglL - distL;
      const xToeR = xFglR + distR;
      
      const yFglC = fglC;
      const yFglL = fglC - camberDrop;
      const yFglR = fglC - camberDrop;
      
      // Ground Polyline Points
      // Ensure sorted by X
      const rawGP = [
          { x: -15, y: egl15L },
          { x: -medianWidth/2, y: eglMedL },
          { x: medianWidth/2, y: eglMedR },
          { x: 15, y: egl15R }
      ];
      // Handling simple case where median width might be 0 or small
      if (medianWidth === 0) {
        // prevent duplicate point issues visually
        rawGP[1].x = -0.01; 
        rawGP[2].x = 0.01;
      }
      
      const groundProfile = rawGP.sort((a,b) => a.x - b.x);

      // Interpolation for Toe Y (Using FLAT extension to match Calculator)
      const getG = (x: number) => {
         if(x <= groundProfile[0].x) return groundProfile[0].y; // Flat
         if(x >= groundProfile[3].x) return groundProfile[3].y; // Flat
         
         for(let i=0; i<3; i++){
             if(x >= groundProfile[i].x && x <= groundProfile[i+1].x){
                 const t = (x - groundProfile[i].x)/(groundProfile[i+1].x - groundProfile[i].x);
                 return groundProfile[i].y + t*(groundProfile[i+1].y - groundProfile[i].y);
             }
         }
         return groundProfile[0].y;
      };

      const yToeL = getG(xToeL);
      const yToeR = getG(xToeR);
      const yGroundCenter = getG(0);

      return {
          xFglL, xFglR, xToeL, xToeR,
          yFglC, yFglL, yFglR, yToeL, yToeR,
          groundProfile,
          yGroundCenter
      };
  };

  const renderCrossSection = (row: EarthworkRow) => {
    const coords = getCoords(row);
    const { xFglL, xFglR, xToeL, xToeR, yFglC, yFglL, yFglR, yToeL, yToeR, groundProfile, yGroundCenter } = coords;

    // ViewBox Scaling
    const allX = [xToeL, xToeR, -16, 16];
    const minX = Math.min(...allX) - 2;
    const maxX = Math.max(...allX) + 2;
    const widthX = maxX - minX;

    const allY = [yFglC, yFglL, yFglR, yToeL, yToeR, ...groundProfile.map(p => p.y)];
    const minY = Math.min(...allY) - 2;
    const maxY = Math.max(...allY) + 4;
    const heightY = maxY - minY;

    const W = 800;
    const H = 400;
    const mapX = (x: number) => ((x - minX) / widthX) * W;
    const mapY = (y: number) => H - ((y - minY) / heightY) * H - 20;

    // Points mapped
    const pToeL = { x: mapX(xToeL), y: mapY(yToeL) };
    const pFglL = { x: mapX(xFglL), y: mapY(yFglL) };
    const pFglC = { x: mapX(0), y: mapY(yFglC) };
    const pFglR = { x: mapX(xFglR), y: mapY(yFglR) };
    const pToeR = { x: mapX(xToeR), y: mapY(yToeR) };
    const pGroundC = { x: mapX(0), y: mapY(yGroundCenter) };

    // Ground Polyline (Extended Visuals - FLAT)
    // We extend horizontally from the first and last points
    const gExtL = { x: minX, y: groundProfile[0].y };
    const gExtR = { x: maxX, y: groundProfile[3].y };
    
    // Construct full visual ground line
    let pointsSvg = `${mapX(gExtL.x)},${mapY(gExtL.y)} `;
    groundProfile.forEach(p => pointsSvg += `${mapX(p.x)},${mapY(p.y)} `);
    pointsSvg += `${mapX(gExtR.x)},${mapY(gExtR.y)}`;

    // Fill Polygon: ToeL -> Road -> ToeR -> trace ground back to ToeL
    const groundBetween = groundProfile.filter(p => p.x > xToeL && p.x < xToeR).reverse();
    let polyPoints = `${pToeL.x},${pToeL.y} ${pFglL.x},${pFglL.y} ${pFglC.x},${pFglC.y} ${pFglR.x},${pFglR.y} ${pToeR.x},${pToeR.y} `;
    groundBetween.forEach(p => polyPoints += `${mapX(p.x)},${mapY(p.y)} `);

    const isCut = row.type === 'Cut';
    const isMixed = row.type === 'Mixed';
    const fillColor = isMixed ? '#fcd34d' : (isCut ? '#fca5a5' : '#86efac'); // Yellow for mixed
    const strokeColor = isMixed ? '#d97706' : (isCut ? '#ef4444' : '#22c55e');

    // Calculate midpoint for area text
    const midY = (pFglC.y + pGroundC.y) / 2;
    // Ensure text is not too close to lines if height is small
    const textY = Math.abs(pFglC.y - pGroundC.y) < 30 
        ? (midY - 40) // Move up if too tight
        : midY;
    
    // Text Box content logic
    const boxHeight = isMixed ? 46 : 36;
    const boxY = isMixed ? -23 : -18;

    return (
        <svg width="100%" height="100%" viewBox="0 0 800 400" className="select-none font-sans">
             <defs>
                <marker id={`arrow-${row.chainage}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L6,3 z" fill="#475569" />
                </marker>
            </defs>
            <rect width="800" height="400" fill="#f8fafc" rx="8" />
            
            {/* Ground Line */}
            <polyline points={pointsSvg} fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="6,4" />
            <text x={mapX(14)} y={mapY(groundProfile[3].y) - 8} fill="#059669" fontSize="12" fontWeight="bold">EGL</text>

            {/* Earthwork Shape */}
            <polygon points={polyPoints} fill={fillColor} stroke={strokeColor} strokeWidth="2" fillOpacity="0.5" />

            {/* Center Line */}
            <line x1={mapX(0)} y1={20} x2={mapX(0)} y2={380} stroke="#94a3b8" strokeDasharray="4,4" strokeWidth="1" opacity="0.5" />
            <text x={mapX(0)} y={390} textAnchor="middle" fontSize="10" fill="#94a3b8">CL</text>

            {/* FGL Label */}
            <text x={pFglC.x} y={pFglC.y - 15} textAnchor="middle" fontSize="11" fill="#0f172a" fontWeight="bold">FRL: {row.fglC.toFixed(2)}</text>
            
            {/* EGL Points Dots */}
            {groundProfile.map((p, i) => (
                <g key={i}>
                    <circle cx={mapX(p.x)} cy={mapY(p.y)} r="3" fill="#059669" />
                    <text x={mapX(p.x)} y={mapY(p.y) + 12} textAnchor="middle" fontSize="9" fill="#059669">{p.y.toFixed(2)}</text>
                </g>
            ))}
            
            {/* Median Marker */}
            {row.medianWidth > 0 && (
                <g>
                   <line x1={mapX(-row.medianWidth/2)} y1={50} x2={mapX(row.medianWidth/2)} y2={50} stroke="#6366f1" strokeWidth="1" markerStart={`url(#arrow-${row.chainage})`} markerEnd={`url(#arrow-${row.chainage})`} />
                   <text x={mapX(0)} y={45} textAnchor="middle" fontSize="10" fill="#6366f1">Med: {row.medianWidth}m</text>
                </g>
            )}

            {/* Formation Width */}
            <line x1={pFglL.x} y1={pFglL.y - 40} x2={pFglR.x} y2={pFglR.y - 40} stroke="#475569" strokeWidth="1" markerStart={`url(#arrow-${row.chainage})`} markerEnd={`url(#arrow-${row.chainage})`} />
            <line x1={pFglL.x} y1={pFglL.y} x2={pFglL.x} y2={pFglL.y - 45} stroke="#cbd5e1" strokeWidth="1" />
            <line x1={pFglR.x} y1={pFglR.y} x2={pFglR.x} y2={pFglR.y - 45} stroke="#cbd5e1" strokeWidth="1" />
            <text x={pFglC.x} y={pFglL.y - 50} textAnchor="middle" fontSize="14" fill="#1e293b" fontWeight="600">B = {row.B} m</text>
            
            {/* Slopes */}
            <text x={mapX(xToeL + (xFglL - xToeL)/2)} y={mapY((yToeL+yFglL)/2)} fontSize="10" fill="#64748b" textAnchor="end" dx="-5">1:{row.usedSlope}</text>
            <text x={mapX(xToeR + (xFglR - xToeR)/2)} y={mapY((yToeR+yFglR)/2)} fontSize="10" fill="#64748b" textAnchor="start" dx="5">1:{row.usedSlope}</text>

            {/* Area Text - Centered & Detailed */}
            <g transform={`translate(${mapX(0)}, ${textY})`}>
                <rect x="-70" y={boxY} width="140" height={boxHeight} rx="4" fill="rgba(255,255,255,0.9)" stroke={strokeColor} strokeWidth="1"/>
                <text x="0" y={boxY + 14} textAnchor="middle" fontSize="10" fontWeight="bold" fill={strokeColor} opacity="0.8">{row.type.toUpperCase()}</text>
                
                {isMixed ? (
                  <>
                    <text x="0" y={boxY + 28} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#dc2626">Cut: {row.areaCut.toFixed(2)} m²</text>
                    <text x="0" y={boxY + 40} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#16a34a">Fill: {row.areaFill.toFixed(2)} m²</text>
                  </>
                ) : (
                  <text x="0" y={boxY + 28} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1e293b">
                     {row.area.toFixed(2)} m²
                  </text>
                )}
            </g>
        </svg>
    );
  };

  const massHaulData = useMemo(() => {
    let cumulative = 0;
    const points: { x: number; y: number; label: string; cum: number }[] = [];
    data.rows.forEach(row => {
      // Net logic
      let val = 0;
      if (row.type === 'Cut') val = row.segVolume;
      else if (row.type === 'Fill') val = -row.segVolume;
      else val = (row.hL + row.hR > 0) ? -row.segVolume : row.segVolume; // Approx for mixed

      cumulative += val;
      points.push({ x: row.chainage_m, y: cumulative, label: row.chainage, cum: cumulative });
    });
    return points;
  }, [data]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      <div className="flex border-b border-slate-100 justify-between items-center pr-2">
         <div className="flex">
          <button 
            onClick={() => setActiveTab('section')}
            className={`px-6 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === 'section' ? 'text-indigo-600 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700 border-transparent'}`}
          >
            <Layers className="w-4 h-4" />
            Cross Section
          </button>
          <button 
            onClick={() => setActiveTab('masshaul')}
            className={`px-6 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === 'masshaul' ? 'text-indigo-600 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700 border-transparent'}`}
          >
            <AreaChart className="w-4 h-4" />
            Mass Haul
          </button>
        </div>
        
        {/* Export Buttons for Current Section */}
        {activeTab === 'section' && (
             <div className="flex gap-1">
                <button 
                    onClick={handleExportCurrentPDF}
                    className="text-xs flex items-center gap-1 text-slate-500 hover:text-red-600 font-medium px-2 py-1 rounded transition-colors"
                    title="Export this section to PDF"
                >
                    <FileText className="w-3.5 h-3.5" />
                    PDF
                </button>
                <button 
                    onClick={handleExportCurrentDXF}
                    className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-medium px-2 py-1 rounded transition-colors"
                    title="Export this section to DXF (CAD)"
                >
                    <FileCode className="w-3.5 h-3.5" />
                    CAD
                </button>
            </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col items-center justify-center min-h-[400px]" ref={chartContainerRef}>
        {activeTab === 'section' ? (
          <div className="w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
              <button 
                onClick={() => setSelectedIndex(prev => Math.max(0, prev - 1))}
                disabled={selectedIndex === 0}
                className="p-1 rounded hover:bg-white hover:shadow-sm disabled:opacity-30 text-slate-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                  <div className="font-mono font-bold text-indigo-700 text-lg">{currentRow.chainage}</div>
                  <div className="text-xs text-slate-500 flex gap-2 justify-center">
                      <span>Offsets L: {currentRow.distL.toFixed(2)}m</span>
                      <span>R: {currentRow.distR.toFixed(2)}m</span>
                  </div>
              </div>
              <button 
                onClick={() => setSelectedIndex(prev => Math.min(data.rows.length - 1, prev + 1))}
                disabled={selectedIndex === data.rows.length - 1}
                className="p-1 rounded hover:bg-white hover:shadow-sm disabled:opacity-30 text-slate-600"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 border border-slate-100 rounded-lg bg-white p-2 shadow-inner overflow-hidden relative min-h-[350px]">
                {renderCrossSection(currentRow)}
            </div>
          </div>
        ) : (
           <div className="w-full">
            <h4 className="text-center text-sm font-bold text-slate-700 mb-2">Mass Haul Diagram</h4>
            <div className="border border-slate-100 rounded-lg p-2 h-64 overflow-hidden relative bg-slate-50 flex items-center justify-center">
               {massHaulData.length > 1 ? (
                 <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(massHaulData.length * 50, 400)} 200`} preserveAspectRatio="none">
                    <line x1="0" y1="100" x2="100%" y2="100" stroke="#94a3b8" strokeDasharray="4,4" />
                    <polyline
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="2"
                      points={massHaulData.map((d, i) => {
                          const maxVol = Math.max(...massHaulData.map(p => Math.abs(p.cum))) || 1;
                          const normY = 100 - (d.cum / maxVol * 90);
                          return `${i * (100 / (massHaulData.length - 1))}% ,${normY}`;
                      }).join(' ')}
                    />
                    {massHaulData.map((d, i) => {
                         const maxVol = Math.max(...massHaulData.map(p => Math.abs(p.cum))) || 1;
                         const normY = 100 - (d.cum / maxVol * 90);
                         return <circle key={i} cx={`${i * (100 / (massHaulData.length - 1))}%`} cy={normY} r="3" fill="#4f46e5"><title>{d.label}: {d.cum.toFixed(0)}</title></circle>
                    })}
                 </svg>
               ) : <span className="text-slate-400">Add more data points to view Mass Haul</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};