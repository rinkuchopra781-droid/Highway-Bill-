import React from 'react';
import { CalculationResult } from '../types';
import { generateCSV } from '../utils/calculator';
import { generateDXF } from '../utils/dxf';
import { generatePDF } from '../utils/pdf';
import { Download, FileCode, FileText } from 'lucide-react';

interface ResultsTableProps {
  data: CalculationResult | null;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ data }) => {
  if (!data) return null;

  const handleDownloadCSV = () => {
    const csv = generateCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'earthwork_quantities.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDXF = () => {
    const dxf = generateDXF(data);
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'All_Cross_Sections.dxf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    const doc = generatePDF(data);
    doc.save('Cross_Sections_Report.pdf');
  };

  const { rows, summary } = data;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">Total Cut</span>
          <span className="text-2xl font-bold text-red-700">{summary.totalCut.toLocaleString()} <span className="text-sm font-medium text-red-400">m³</span></span>
        </div>
        <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-green-500 mb-1">Total Fill</span>
          <span className="text-2xl font-bold text-green-700">{summary.totalFill.toLocaleString()} <span className="text-sm font-medium text-green-400">m³</span></span>
        </div>
        <div className="bg-brand-50 border border-brand-100 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600 mb-1">Net (Cut - Fill)</span>
          <span className={`text-2xl font-bold ${summary.net >= 0 ? 'text-brand-700' : 'text-orange-600'}`}>
            {summary.net > 0 ? '+' : ''}{summary.net.toLocaleString()} <span className="text-sm font-medium text-brand-400">m³</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
           <h3 className="text-lg font-bold text-slate-800">Calculation Results</h3>
           <p className="text-xs text-slate-500">Download reports for all sections</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <button
            onClick={handleDownloadPDF}
            className="text-sm flex items-center gap-2 text-white font-medium px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
            title="Download PDF Report for all sections"
            >
            <FileText className="w-4 h-4" />
            Download PDF
            </button>
            <button
            onClick={handleDownloadDXF}
            className="text-sm flex items-center gap-2 text-white font-medium px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
            title="Download AutoCAD DXF file for all sections"
            >
            <FileCode className="w-4 h-4" />
            Download CAD
            </button>
            <button
            onClick={handleDownloadCSV}
            className="text-sm flex items-center gap-2 text-slate-700 font-medium px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-sm"
            >
            <Download className="w-4 h-4" />
            CSV
            </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-xs md:text-sm text-right whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 text-left sticky left-0 bg-slate-50 shadow-sm">Chainage</th>
              <th className="px-3 py-3 text-blue-700">FRL (C)</th>
              <th className="px-3 py-3 bg-emerald-50 text-emerald-800 border-l border-emerald-100" title="At -15m">EGL 15m L</th>
              <th className="px-3 py-3 bg-emerald-50 text-emerald-800" title="At Median Left Edge">EGL Med L</th>
              <th className="px-3 py-3 bg-emerald-50 text-emerald-800" title="At Median Right Edge">EGL Med R</th>
              <th className="px-3 py-3 bg-emerald-50 text-emerald-800 border-r border-emerald-100" title="At +15m">EGL 15m R</th>
              <th className="px-3 py-3">Width</th>
              <th className="px-3 py-3 font-bold text-red-600 bg-red-50/50">Cut Area</th>
              <th className="px-3 py-3 font-bold text-green-600 bg-green-50/50">Fill Area</th>
              <th className="px-3 py-3 bg-slate-100/50">Vol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((r, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 text-left font-mono text-slate-700 sticky left-0 bg-white hover:bg-slate-50">{r.chainage}</td>
                <td className="px-3 py-2 text-blue-600 font-medium">{r.fglC.toFixed(2)}</td>
                <td className="px-3 py-2 bg-emerald-50/30 text-slate-600">{r.egl15L.toFixed(2)}</td>
                <td className="px-3 py-2 bg-emerald-50/30 text-slate-600">{r.eglMedL.toFixed(2)}</td>
                <td className="px-3 py-2 bg-emerald-50/30 text-slate-600">{r.eglMedR.toFixed(2)}</td>
                <td className="px-3 py-2 bg-emerald-50/30 text-slate-600">{r.egl15R.toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-500">{r.bottomWidth.toFixed(2)}</td>
                <td className="px-3 py-2 font-bold text-red-600 bg-red-50/20">{r.areaCut > 0 ? r.areaCut.toFixed(2) : '-'}</td>
                <td className="px-3 py-2 font-bold text-green-600 bg-green-50/20">{r.areaFill > 0 ? r.areaFill.toFixed(2) : '-'}</td>
                <td className="px-3 py-2 font-bold text-slate-800 bg-slate-50/50">
                  {r.segVolume.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};