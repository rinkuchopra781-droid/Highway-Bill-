
import React, { useState } from 'react';
import { InputParams } from '../types';
import { Download, Play, RotateCcw, Calculator, Upload, X, HelpCircle, Table } from 'lucide-react';

interface InputFormProps {
  params: InputParams;
  onChange: (newParams: InputParams) => void;
  onCompute: () => void;
  onLoadExample: () => void;
  onReset: () => void;
}

export const InputForm: React.FC<InputFormProps> = ({ params, onChange, onCompute, onLoadExample, onReset }) => {
  const [showWidthCalc, setShowWidthCalc] = useState(false);
  const [showCsvHelp, setShowCsvHelp] = useState(false);
  
  const [widthParts, setWidthParts] = useState({
    lanes: 2,
    laneWidth: 3.5,
    shoulder: 1.5
  });

  const handleChange = (field: keyof InputParams, value: string | number) => {
    onChange({ ...params, [field]: value });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handleChange('csvData', text);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const applyCalculatedWidth = () => {
    // Basic calculation for road top width (B)
    const total = (widthParts.lanes * widthParts.laneWidth * 2) + params.medianWidth + (2 * widthParts.shoulder);
    // Usually B in this app context is the total formation width including median
    handleChange('B', total);
    setShowWidthCalc(false);
  };

  const insertTemplate = () => {
    const template = `Chainage, Proposed_FRL, EGL_15m_Left, EGL_Median_LHS, EGL_Median_RHS, EGL_15m_Right
0+000, 100.000, 99.500, 99.800, 99.800, 99.400
0+020, 100.200, 99.600, 99.900, 99.900, 99.500`;
    handleChange('csvData', template);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6 relative">
      
      {/* CSV Help Modal */}
      {showCsvHelp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Table className="w-5 h-5 text-indigo-600" />
                Data Format Guide
              </h3>
              <button onClick={() => setShowCsvHelp(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-4">
              The app processes these columns (case-insensitive):
            </p>

            <ul className="text-xs text-slate-600 list-disc pl-5 mb-4 space-y-1">
                <li><strong>Chainage</strong> (Required)</li>
                <li><strong>Proposed_FRL</strong> (Center Line FRL)</li>
                <li><strong>EGL_15m_Left</strong> (Ground Level at -15m)</li>
                <li><strong>EGL_Median_LHS</strong> (Ground Level at Left Median Edge)</li>
                <li><strong>EGL_Median_RHS</strong> (Ground Level at Right Median Edge)</li>
                <li><strong>EGL_15m_Right</strong> (Ground Level at +15m)</li>
            </ul>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-xs text-slate-700 mb-4 overflow-x-auto">
              <div>Chainage, Proposed_FRL, EGL_15m_Left, EGL_Median_LHS, EGL_Median_RHS, EGL_15m_Right</div>
              <div className="text-slate-500">0+000, 100.000, 99.500, 99.800, 99.800, 99.400</div>
            </div>
            
            <p className="text-xs text-slate-500 italic mb-4">
               *Fallback: If specific EGL columns are missing, it looks for a generic 'EGL' column and assumes flat ground.
            </p>

            <div className="flex justify-end">
              <button 
                onClick={() => setShowCsvHelp(false)} 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Width Calculator Modal */}
      {showWidthCalc && (
        <div className="absolute top-0 right-0 z-20 w-72 m-2 bg-white rounded-lg shadow-xl border border-indigo-100 p-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                <h4 className="text-sm font-bold text-slate-700">Width Calculator</h4>
                <button onClick={() => setShowWidthCalc(false)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-600">Lanes (Per side)</label>
                    <input type="number" className="w-16 p-1 border rounded text-right text-sm" value={widthParts.lanes} onChange={e => setWidthParts({...widthParts, lanes: parseFloat(e.target.value)||0})} />
                </div>
                <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-600">Lane Width (m)</label>
                    <input type="number" step="0.1" className="w-16 p-1 border rounded text-right text-sm" value={widthParts.laneWidth} onChange={e => setWidthParts({...widthParts, laneWidth: parseFloat(e.target.value)||0})} />
                </div>
                <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-600">Shoulder (Per side)</label>
                    <input type="number" step="0.1" className="w-16 p-1 border rounded text-right text-sm" value={widthParts.shoulder} onChange={e => setWidthParts({...widthParts, shoulder: parseFloat(e.target.value)||0})} />
                </div>
                <div className="flex justify-between items-center bg-indigo-50 p-1 rounded">
                    <label className="text-xs text-indigo-700 font-medium">Median (m)</label>
                    <span className="text-xs font-bold text-indigo-700">{params.medianWidth}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 mt-2">
                    <button onClick={applyCalculatedWidth} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2 rounded font-medium">
                        Apply Total Width
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Main CSV Input Area */}
      <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
             <label htmlFor="csvData" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
               <Table className="w-4 h-4 text-indigo-500" />
               Project Data (CSV / Copy-Paste)
             </label>
             <div className="flex gap-2">
                <button onClick={insertTemplate} className="text-xs text-indigo-600 hover:text-indigo-800 underline">
                    Load Template
                </button>
                <label className="cursor-pointer text-xs flex items-center gap-1 text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 px-2 py-1 rounded transition-colors">
                    <Upload className="w-3 h-3" /> Import CSV
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                </label>
                <button onClick={() => setShowCsvHelp(true)} className="text-slate-400 hover:text-indigo-500">
                    <HelpCircle className="w-4 h-4" />
                </button>
             </div>
          </div>
          <textarea
            id="csvData"
            className="flex-1 min-h-[200px] w-full p-3 rounded-lg border border-slate-300 focus:border-brand-500 outline-none text-xs md:text-sm font-mono leading-relaxed whitespace-pre overflow-x-auto"
            placeholder={`Paste data here...\nChainage, Proposed_FRL, EGL_15m_Left, EGL_Median_LHS, EGL_Median_RHS, EGL_15m_Right`}
            value={params.csvData}
            onChange={(e) => handleChange('csvData', e.target.value)}
          />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
        
        {/* Median Width - Realtime Impact */}
        <div className="space-y-1 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
            <label className="text-xs font-bold uppercase text-indigo-600">Median Total Width (m)</label>
            <input 
                type="number" 
                step="0.1" 
                min="0"
                value={params.medianWidth} 
                onChange={(e) => handleChange('medianWidth', parseFloat(e.target.value) || 0)} 
                className="w-full p-2.5 rounded-lg border border-indigo-200 focus:border-indigo-500 text-sm font-semibold text-indigo-900 bg-white shadow-sm" 
            />
            <p className="text-[10px] text-indigo-400">Offsets: ±{(params.medianWidth / 2).toFixed(2)}m</p>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold uppercase text-slate-500">Formation Width (B)</label>
            <button onClick={() => setShowWidthCalc(!showWidthCalc)} className="text-indigo-600" title="Calculate Width"><Calculator className="w-3.5 h-3.5" /></button>
          </div>
          <div className="relative">
             <input type="number" step="0.1" value={params.B} onChange={(e) => handleChange('B', parseFloat(e.target.value))} className="w-full p-2.5 rounded-lg border text-sm" />
             <span className="absolute right-3 top-2.5 text-slate-400 text-sm">m</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Camber (%)</label>
          <div className="relative">
            <input type="number" step="0.1" value={params.camber} onChange={(e) => handleChange('camber', parseFloat(e.target.value))} className="w-full p-2.5 rounded-lg border text-sm" />
            <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Cut Slope (m:1)</label>
          <input type="number" step="0.1" value={params.cutSlope} onChange={(e) => handleChange('cutSlope', parseFloat(e.target.value))} className="w-full p-2.5 rounded-lg border text-sm" />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Fill Slope (m:1)</label>
          <input type="number" step="0.1" value={params.fillSlope} onChange={(e) => handleChange('fillSlope', parseFloat(e.target.value))} className="w-full p-2.5 rounded-lg border text-sm" />
        </div>
        
         <div className="space-y-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Spacing (Optional)</label>
          <input type="number" placeholder="Auto (diff)" value={params.spacing || ''} onChange={(e) => handleChange('spacing', parseFloat(e.target.value))} className="w-full p-2.5 rounded-lg border text-sm" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button onClick={onCompute} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-lg shadow-sm font-medium flex items-center justify-center gap-2">
          <Play className="w-4 h-4 fill-current" /> Compute Results
        </button>
        <button onClick={onLoadExample} className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" /> Load Example
        </button>
        <button onClick={onReset} className="flex-1 bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 border px-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> Reset
        </button>
      </div>
    </div>
  );
};
