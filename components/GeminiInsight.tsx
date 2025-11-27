import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { CalculationResult } from '../types';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

interface GeminiInsightProps {
  data: CalculationResult | null;
}

export const GeminiInsight: React.FC<GeminiInsightProps> = ({ data }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data) return null;

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setAnalysis('');

    try {
      // Validate API Key presence inside the handler to avoid init errors
      if (!process.env.API_KEY) {
        throw new Error("API Key is missing. Please configure process.env.API_KEY.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `
        As a Senior Highway Engineer, analyze the following earthwork data summary for a road project:
        
        Summary:
        - Total Cut: ${data.summary.totalCut.toLocaleString()} m³
        - Total Fill: ${data.summary.totalFill.toLocaleString()} m³
        - Net Balance: ${data.summary.net.toLocaleString()} m³ (positive = excess cut, negative = need fill)
        - Length of section: ${data.rows.length > 0 ? (data.rows[data.rows.length-1].chainage_m - data.rows[0].chainage_m) : 0} m
        
        Please provide a brief executive summary (max 200 words) covering:
        1. The cut/fill balance efficiency.
        2. Recommendations for mass haul (e.g., spoil disposal or borrow pits).
        3. Suggested machinery based on the volume scale (e.g. Scrapers vs Excavators).
        
        Keep it professional, concise, and engineering-focused.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setAnalysis(response.text || "No analysis generated.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate AI insight.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          AI Engineering Insight
        </h3>
        {!analysis && !loading && (
          <button
            onClick={handleAnalyze}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Analyze with Gemini
          </button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-8 text-indigo-600">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-sm font-medium">Generating engineering analysis...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {analysis && (
        <div className="prose prose-sm prose-indigo max-w-none">
          <div className="whitespace-pre-wrap text-slate-700 leading-relaxed bg-white/50 p-4 rounded-lg border border-indigo-50">
            {analysis}
          </div>
          <div className="mt-4 flex justify-end">
             <button
              onClick={handleAnalyze}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium underline decoration-dashed underline-offset-4"
            >
              Regenerate Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
};