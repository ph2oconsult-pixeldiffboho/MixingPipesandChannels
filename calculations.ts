import { MixingInputs, CalculationResults, ConduitType, ConduitShape, MixerModel, InjectionType, PitchRatio } from './types';

export const calculateMixing = (inputs: MixingInputs): CalculationResults => {
  const { 
    flowRate, dimension, depth = 0.6, conduitType, conduitShape,
    viscosity, density, chemicalDensity, chemicalViscosity,
    chemicalFlow, dilutionWaterFlow, availableLength, targetCoV, targetMixingTime,
    mixerModel, numElements, injectionType, pitchRatio, waterTemperature, chemicalDose
  } = inputs;

  const g = 9.81;
  const waterDensity = 1000;
  const waterViscosity = 0.001;

  // Safeguards for typing state
  const d = Math.max(dimension || 0.001, 0.001);
  const h = Math.max(depth || 0.001, 0.001);
  const Q_m3h = Math.max(flowRate || 1, 1);

  const totalInjLh = (chemicalFlow || 0) + (dilutionWaterFlow || 0);
  const totalInjM3s = totalInjLh / 3600000;
  
  const injDensity = (((chemicalFlow || 0) * (chemicalDensity || 1000)) + ((dilutionWaterFlow || 0) * waterDensity)) / (totalInjLh || 1);
  const injVisc = Math.exp(((chemicalFlow || 0) * Math.log(chemicalViscosity || 1e-6) + (dilutionWaterFlow || 0) * Math.log(waterViscosity || 1e-6)) / (totalInjLh || 1));

  let area = 0;
  let Dh = 0;

  if (conduitType === ConduitType.PIPE) {
    if (conduitShape === ConduitShape.CIRCULAR) {
      area = Math.PI * Math.pow(d / 2, 2);
      Dh = d;
    } else {
      area = d * h;
      Dh = (2 * d * h) / (d + h);
    }
  } else {
    // Open Channel
    area = d * h;
    Dh = (4 * area) / (d + 2 * h); // Wetted perimeter bottom + 2 sides
  }
  
  const velocity = (Q_m3h / 3600) / (area || 1e-6);
  const Re = (density * velocity * Dh) / (viscosity || 1e-6);
  const alpha = (Q_m3h * 1000) / (totalInjLh || 1);

  // Mixer correlations
  let mixerCoV = 1.0;
  let FD = 0.02; 
  let Lm = 0;
  let manufacturerNotes = "Standard BHR quill recommendations.";
  const LD = (availableLength || 1) / Dh;

  switch (mixerModel) {
    case MixerModel.KENICS_KM:
      mixerCoV = (injectionType === InjectionType.SINGLE ? 0.96 : 0.38) * Math.pow(Re, -0.1) * Math.pow(numElements, -1.9);
      FD = 1.8; Lm = numElements * 1.5 * Dh;
      break;
    case MixerModel.HEV:
      mixerCoV = 31.5 * Math.pow(Re, -0.2) * Math.pow(numElements, -1.7);
      FD = 0.6; Lm = numElements * Dh;
      break;
    case MixerModel.STM:
      mixerCoV = 0.29 * Math.pow(Re, -0.2) * Math.pow(numElements, -0.6);
      FD = 4.15; Lm = numElements * 0.8 * Dh;
      break;
    default:
      FD = 0.02; Lm = availableLength;
      mixerCoV = 2 * Math.sqrt(alpha) * Math.exp(-0.75 * Math.sqrt(FD) * LD);
      break;
  }

  mixerCoV = Math.min(1.0, Math.max(0.0001, mixerCoV));
  const headlossM = (FD * Lm * Math.pow(velocity, 2)) / (2 * g * Dh);
  const headlossKpa = (headlossM * density * g) / 1000;
  const gValue = Math.sqrt((headlossKpa * 1000 * (Q_m3h/3600)) / (viscosity * area * Lm || 1e-9));

  const decay = conduitType === ConduitType.PIPE ? 0.75 * Math.sqrt(0.02) : 0.6;
  const tCoV = targetCoV || 0.05;
  const mixingDistanceNeeded = mixerCoV <= tCoV ? Lm : Lm + (Math.log(mixerCoV / tCoV) / (decay || 0.1)) * Dh;

  // Momentum
  const uInj = (totalInjM3s / (injectionType === InjectionType.TWIN ? 2 : 1)) / (Math.PI * Math.pow(0.0125, 2));
  const momentumRatio = Math.sqrt(injDensity / density) * (uInj * 0.025 / (velocity * Dh || 1e-6));

  return {
    velocity, reynoldsNumber: Re, momentumRatio, momentumRegime: momentumRatio < 0.16 ? 'Low' : (momentumRatio > 0.24 ? 'High' : 'Intermediate'),
    mixerCoV, viscosityRatio: injVisc / viscosity, injectedViscosity: injVisc, injectedDensity: injDensity, totalInjectionFlow: totalInjLh,
    isCompliant: mixerCoV <= tCoV, isTimeCompliant: (mixingDistanceNeeded / velocity) <= targetMixingTime,
    mixingDistanceNeeded, mixingTimeNeeded: mixingDistanceNeeded / velocity,
    headloss: headlossKpa, headlossMeters: headlossM, gValue,
    limeSaturationLimit: 1500, dissolvedAtTarget: 100, timeTo95Dissolution: 5, distanceTo95Dissolution: 5,
    suggestedOrificeDiameter: 15, manufacturerNotes, hydraulicDiameter: Dh, wettedArea: area
  };
};