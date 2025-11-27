
import React, { useState } from 'react';
import { InputForm } from './components/InputForm';
import { ResultsTable } from './components/ResultsTable';
import { GeminiInsight } from './components/GeminiInsight';
import { Visualizer } from './components/Visualizer';
import { computeEarthwork } from './utils/calculator';
import { InputParams, CalculationResult } from './types';
import { Calculator, Info, Copy } from 'lucide-react';

const App: React.FC = () => {
  const [params, setParams] = useState<InputParams>({
    csvData: '',
    B: 20,
    medianWidth: 4.0, // Default 4m
    camber: 2.5,
    cutSlope: 1,
    fillSlope: 2,
    spacing: undefined
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompute = () => {
    try {
      setError(null);
      const res = computeEarthwork(
        params.csvData,
        params.B,
        params.medianWidth,
        params.camber,
        params.cutSlope,
        params.fillSlope,
        params.spacing
      );
      setResult(res);
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    }
  };

  const handleLoadExample = () => {
    const template = `Chainage, Proposed_FRL, EGL_15m_Left, EGL_Median_LHS, EGL_Median_RHS, EGL_15m_Right
0+000, 100.000, 99.500, 99.800, 99.800, 99.400
0+020, 100.200, 99.600, 99.900, 99.900, 99.500
0+040, 100.400, 99.700, 100.000, 100.000, 99.600
0+060, 100.600, 101.500, 101.200, 101.200, 101.400
0+080, 100.800, 102.000, 101.800, 101.800, 101.900`;

    const p = {
      ...params,
      csvData: template,
      medianWidth: 4.0
    };
    setParams(p);
    setError(null);
    
    // Immediate compute for better UX on load
    setTimeout(() => {
        try {
           const res = computeEarthwork(
            p.csvData, p.B, p.medianWidth, p.camber, p.cutSlope, p.fillSlope
          );
          setResult(res);
        } catch (e) {}
    }, 0);
  };

  const handleReset = () => {
    setParams({
      csvData: '',
      B: 20,
      medianWidth: 4.0,
      camber: 2.5,
      cutSlope: 1,
      fillSlope: 2,
      spacing: undefined
    });
    setResult(null);
    setError(null);
  };

  const copyPrompt = () => {
    const promptText = `Project Data:\nFormation B=${params.B}m, Median=${params.medianWidth}m.\nData:\n${params.csvData}`;
    navigator.clipboard.writeText(promptText);
    alert("Data copied to clipboard for AI analysis!");
  };

  return (
    <div className="min-h-screen pb-12 bg-slate-50/50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-brand-600 p-2 rounded-lg text-white shadow-brand">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Highway Earthwork Pro</h1>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">Multi-Offset Ground Profile Support</p>
            </div>
          </div>
          <button onClick={copyPrompt} title="Copy Data for AI" className="text-slate-400 hover:text-brand-600 transition-colors">
            <Copy className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3 text-indigo-900 text-sm shadow-sm">
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-indigo-600" />
          <p className="leading-relaxed">
            <strong>Update:</strong> Now supports detailed 4-point ground profiles. 
            Use CSV columns: <code className="mx-1 bg-white px-1 py-0.5 rounded border border-indigo-200 text-xs font-mono">Chainage</code>
            <code className="mx-1 bg-white px-1 py-0.5 rounded border border-indigo-200 text-xs font-mono">Proposed_FRL</code>
            <code className="mx-1 bg-white px-1 py-0.5 rounded border border-indigo-200 text-xs font-mono">EGL_15m_Left</code>
            <code className="mx-1 bg-white px-1 py-0.5 rounded border border-indigo-200 text-xs font-mono">EGL_Median_LHS</code>
            ...
          </p>
        </div>

        <section>
          <InputForm 
            params={params} 
            onChange={setParams} 
            onCompute={handleCompute} 
            onLoadExample={handleLoadExample} 
            onReset={handleReset}
          />
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl flex items-center gap-3 animate-pulse shadow-sm">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {result && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ResultsTable data={result} />
                <div className="space-y-8">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 font-bold text-slate-700 flex justify-between items-center bg-slate-50/50">
                            <span>Cross Section Visualizer</span>
                            <span className="text-xs font-normal text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
                                Median: <strong>{params.medianWidth}m</strong>
                            </span>
                        </div>
                        <Visualizer data={result} />
                    </div>
                    <GeminiInsight data={result} />
                </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;
