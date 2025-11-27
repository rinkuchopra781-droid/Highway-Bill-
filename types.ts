
export interface EarthworkRow {
  chainage: string;
  chainage_m: number;
  
  // Levels
  fglC: number; // Center FRL
  
  // Ground Profile Points (The 4 requested offsets)
  egl15L: number;   // At -15m
  eglMedL: number;  // At -Median/2
  eglMedR: number;  // At +Median/2
  egl15R: number;   // At +15m
  
  // Calculation details
  camberDrop: number;
  
  // Toe calculation results
  hL: number; // Height diff at left formation edge
  hR: number; // Height diff at right formation edge
  
  type: 'Cut' | 'Fill' | 'Mixed' | 'Level';
  
  // Dimensions
  B: number; // Formation Width
  medianWidth: number; // The dynamic median width used for this calc
  usedSlope: number; // The M value in 1:M
  
  distL: number; // Horizontal distance from center to toe Left
  distR: number; // Horizontal distance from center to toe Right
  
  bottomWidth: number; // Total width at ground intersection
  
  area: number;     // Total Area
  areaCut: number;  // NEW: Cut portion area
  areaFill: number; // NEW: Fill portion area
  
  spacing: number | null;
  segVolume: number;
}

export interface CalculationSummary {
  totalCut: number;
  totalFill: number;
  net: number;
}

export interface CalculationResult {
  rows: EarthworkRow[];
  summary: CalculationSummary;
}

export interface InputParams {
  csvData: string;    // Unified input for Chainage, FRL, EGLs
  B: number;          // Formation Width
  medianWidth: number; // New: Total width of median
  camber: number;     // Camber %
  cutSlope: number;
  fillSlope: number;
  spacing?: number;
}
