export enum ConduitType {
  PIPE = 'PIPE',
  CHANNEL = 'CHANNEL'
}

export enum ConduitShape {
  CIRCULAR = 'CIRCULAR',
  RECTANGULAR = 'RECTANGULAR'
}

export enum MixerModel {
  NONE = 'NONE',
  KENICS_KM = 'KENICS_KM',
  HEV = 'HEV',
  SMV = 'SMV',
  STM = 'STM',
  BAFFLES = 'BAFFLES',
  WEIR = 'WEIR'
}

export enum InjectionType {
  SINGLE = 'SINGLE',
  TWIN = 'TWIN'
}

export enum PitchRatio {
  PR_1_125 = '1.125:1',
  PR_1_5 = '1.5:1',
  PR_2_25 = '2.25:1'
}

export interface MixingInputs {
  conduitType: ConduitType;
  conduitShape: ConduitShape;
  mixerModel: MixerModel;
  numElements: number;
  flowRate: number; // m3/h
  dimension: number; // Diameter (m) or Base Width (m)
  depth?: number; // Depth (m) or Height (m)
  availableLength: number; // m
  viscosity: number; // Pa·s (Bulk)
  density: number; // kg/m3 (Bulk)
  chemicalType: string;
  chemicalDose: number; // mg/L
  chemicalFlow: number; // L/h
  chemicalDensity: number; // kg/m3
  chemicalViscosity: number; // Pa·s
  dilutionWaterFlow: number; // L/h
  targetCoV: number;
  targetMixingTime: number; // s
  slurryConcentration?: number; // %
  injectionType: InjectionType;
  pitchRatio: PitchRatio;
  waterTemperature: number; // °C
}

export interface CalculationResults {
  velocity: number;
  reynoldsNumber: number;
  momentumRatio: number; // sqrt(ma/mm)
  momentumRegime: 'Low' | 'Intermediate' | 'High';
  mixerCoV: number;
  isCompliant: boolean;
  isTimeCompliant: boolean;
  mixingDistanceNeeded: number;
  mixingTimeNeeded: number;
  viscosityRatio: number;
  injectedViscosity: number;
  injectedDensity: number;
  totalInjectionFlow: number;
  headloss: number; // kPa
  headlossMeters: number; // m
  gValue: number;
  // Kinetic fields
  limeSaturationLimit: number; // mg/L
  dissolvedAtTarget: number; // %
  timeTo95Dissolution: number; // s
  distanceTo95Dissolution: number; // m
  // Hardware recommendations
  suggestedOrificeDiameter: number; // mm
  manufacturerNotes: string;
  hydraulicDiameter: number;
  wettedArea: number;
}

export interface GuideExtraction {
  manufacturer?: string;
  mixerModels?: string[];
  headlossSpecs?: string;
  performanceCriteria?: string;
  generalNotes?: string;
}