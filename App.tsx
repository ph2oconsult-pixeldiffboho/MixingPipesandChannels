import React, { useState, useMemo, useRef, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';
import { Activity, Beaker, Layers, Settings2, Droplets, Waves, Upload, Loader2, Gauge, MapPin, Wind, Zap, FileDown, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { MixingInputs, ConduitType, ConduitShape, MixerModel, InjectionType, PitchRatio } from './types';
import { calculateMixing } from './calculations';
import { getAIRecommendations, extractGuideData } from './services/gemini';

const CHEMICAL_PRESETS = [
  { id: 'ferric', name: 'Ferric Chloride (40%)', density: 1450, viscosity: 0.015 },
  { id: 'alum', name: 'Alum (Aluminium Sulphate)', density: 1320, viscosity: 0.025 },
  { id: 'hypo', name: 'Sodium Hypochlorite (15%)', density: 1210, viscosity: 0.003 },
  { id: 'lime', name: 'Lime Slurry (10%)', density: 1070, viscosity: 0.005 },
  { id: 'custom', name: 'Custom Fluid', density: 1000, viscosity: 0.001 },
];

const MarkdownDisplay: React.FC<{ content: string }> = ({ content }) => (
  <div className="space-y-2">
    {content.split('\n').map((line, idx) => {
      let trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-2" />;
      if (trimmed.startsWith('#')) return <div key={idx} className="text-sm font-bold text-indigo-700 mt-4 uppercase tracking-tighter">{trimmed.replace(/^#+\s*/, '')}</div>;
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) return <div key={idx} className="flex gap-2 pl-2 text-slate-700 text-xs"><ChevronRight size={10} className="mt-1 text-indigo-500 shrink-0" /><span>{trimmed.replace(/^[-*]\s*/, '')}</span></div>;
      return <p key={idx} className="text-slate-700 text-xs leading-relaxed">{trimmed}</p>;
    })}
  </div>
);

const App: React.FC = () => {
  const [inputs, setInputs] = useState<MixingInputs>({
    conduitType: ConduitType.PIPE, conduitShape: ConduitShape.CIRCULAR, mixerModel: MixerModel.NONE, numElements: 4,
    flowRate: 1500, dimension: 0.8, depth: 0.6, availableLength: 10, viscosity: 0.001, density: 1000,
    chemicalType: 'Ferric Chloride', chemicalDose: 1.0, chemicalFlow: 10, chemicalDensity: 1450, chemicalViscosity: 0.015,
    dilutionWaterFlow: 200, targetCoV: 0.05, targetMixingTime: 10.0, injectionType: InjectionType.SINGLE,
    pitchRatio: PitchRatio.PR_1_5, waterTemperature: 15
  });

  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => calculateMixing(inputs), [inputs]);

  const handleInputChange = (field: keyof MixingInputs, value: any) => {
    setInputs(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'conduitType') {
        next.mixerModel = MixerModel.NONE;
        next.conduitShape = value === ConduitType.PIPE ? ConduitShape.CIRCULAR : ConduitShape.RECTANGULAR;
      }
      return next;
    });
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text('FluidMix Engineering Report', 20, 20);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
    doc.text(`Result: CoV ${results.mixerCoV.toFixed(4)}, Headloss ${results.headlossMeters.toFixed(3)} m`, 20, 40);
    const splitText = doc.splitTextToSize(aiAnalysis.replace(/\*/g, ''), 170);
    doc.text(splitText, 20, 50);
    doc.save(`Audit_${Date.now()}.pdf`);
  };

  const chartData = useMemo(() => {
    return Array.from({ length: 21 }, (_, i) => {
      const dist = (i / 20) * (results.mixingDistanceNeeded * 1.5);
      const Dh = results.hydraulicDiameter || 1;
      const cov = 1.0 * Math.exp(-0.1 * (dist / Dh)); // Simplified for visualization
      return { distance: dist.toFixed(1), cov: Math.max(results.mixerCoV, cov) };
    });
  }, [results]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 h-16 sticky top-0 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Waves size={24} /></div>
          <h1 className="text-xl font-bold tracking-tight">FluidMix Pro</h1>
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-shadow shadow-sm">
          {isExtracting ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} className="inline mr-2" />} Sync Reference
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" />
      </header>

      <main className="max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-2 text-indigo-600"><Activity size={16}/> Hydraulics</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={()=>handleInputChange('conduitType', ConduitType.PIPE)} className={`py-2 rounded-lg text-xs font-bold ${inputs.conduitType === ConduitType.PIPE ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>Pipe</button>
              <button onClick={()=>handleInputChange('conduitType', ConduitType.CHANNEL)} className={`py-2 rounded-lg text-xs font-bold ${inputs.conduitType === ConduitType.CHANNEL ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>Channel</button>
            </div>
            <InputGroup label="Flow Rate (m3/h)" value={inputs.flowRate} onChange={(v:number)=>handleInputChange('flowRate', v)} highlight />
            <div className="grid grid-cols-2 gap-3">
              <InputGroup label="Width/Dia (m)" value={inputs.dimension} onChange={(v:number)=>handleInputChange('dimension', v)} />
              {(inputs.conduitType === ConduitType.CHANNEL || inputs.conduitShape === ConduitShape.RECTANGULAR) && (
                <InputGroup label="Depth (m)" value={inputs.depth} onChange={(v:number)=>handleInputChange('depth', v)} />
              )}
            </div>
          </section>

          <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
             <h2 className="font-bold text-sm flex items-center gap-2 text-indigo-600"><Settings2 size={16}/> Mixing Strategy</h2>
             <select value={inputs.mixerModel} onChange={(e)=>handleInputChange('mixerModel', e.target.value)} className="w-full bg-slate-50 border p-2 rounded-lg text-sm font-semibold">
               <option value={MixerModel.NONE}>Natural Mixing</option>
               <option value={MixerModel.KENICS_KM}>Kenics KM</option>
               <option value={MixerModel.HEV}>Chemineer HEV</option>
               <option value={MixerModel.STM}>Statiflo STM</option>
             </select>
             <InputGroup label="Elements (n)" value={inputs.numElements} onChange={(v:number)=>handleInputChange('numElements', v)} />
          </section>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <MetricCard title="Achieved CoV" value={results.mixerCoV.toFixed(4)} sub={results.isCompliant ? 'Target Met' : 'Fail'} color={results.isCompliant ? 'green' : 'amber'} icon={<Layers size={14}/>} />
            <MetricCard title="Velocity" value={`${results.velocity.toFixed(2)} m/s`} sub={`Re: ${results.reynoldsNumber.toLocaleString()}`} color="blue" icon={<Wind size={14}/>} />
            <MetricCard title="Blend Point" value={`${results.mixingDistanceNeeded.toFixed(2)} m`} sub="Critical Distance" color="blue" icon={<MapPin size={14}/>} />
            <MetricCard title="Headloss" value={`${results.headlossMeters.toFixed(3)} m`} sub={`${results.headloss.toFixed(2)} kPa`} color="slate" icon={<Gauge size={14}/>} />
          </div>

          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="distance" tick={{fontSize: 10}} label={{value:'m', position:'insideBottomRight'}} />
                <YAxis domain={[0, 1]} tick={{fontSize: 10}} />
                <Tooltip />
                <ReferenceLine y={inputs.targetCoV} stroke="#f43f5e" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="cov" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.05} />
              </ComposedChart>
            </ResponsiveContainer>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2"><Zap size={18} className="text-amber-400" /><h3 className="font-bold text-sm">AI Engineering Audit</h3></div>
              <div className="flex gap-2">
                {aiAnalysis && <button onClick={handleDownloadPDF} className="p-1.5 bg-indigo-600 rounded-lg hover:bg-indigo-500"><FileDown size={14}/></button>}
                <button onClick={async ()=>{setIsAnalyzing(true); setAiAnalysis(await getAIRecommendations(inputs, results)); setIsAnalyzing(false);}} className="text-xs font-bold bg-white text-slate-900 px-4 py-1.5 rounded-lg active:scale-95 disabled:opacity-50">
                  {isAnalyzing ? <Loader2 className="animate-spin" size={14}/> : 'Run Audit'}
                </button>
              </div>
            </div>
            <div className="p-6 min-h-[180px]">
              {aiAnalysis ? <MarkdownDisplay content={aiAnalysis} /> : <p className="text-center text-slate-400 italic text-sm py-10">Run audit for professional BHR CR 7469 verification.</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

const InputGroup = ({ label, value, onChange, highlight }: any) => {
  const [local, setLocal] = useState(value.toString());
  useEffect(() => { setLocal(value.toString()); }, [value]);
  return (
    <div className="w-full">
      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">{label}</label>
      <input type="text" value={local} onChange={(e)=>{
        setLocal(e.target.value);
        const p = parseFloat(e.target.value);
        if(!isNaN(p)) onChange(p);
      }} className={`w-full border rounded-xl px-3 py-2 text-sm font-semibold outline-none ${highlight ? 'bg-indigo-50 border-indigo-200 focus:ring-2 focus:ring-indigo-400' : 'bg-slate-50 focus:ring-2 focus:ring-indigo-500'}`} />
    </div>
  );
};

const MetricCard = ({ title, value, sub, color, icon }: any) => {
  const styles: any = { green: 'bg-green-50 text-green-700 border-green-100', amber: 'bg-amber-50 text-amber-700 border-amber-100', blue: 'bg-blue-50 text-blue-700 border-blue-100', slate: 'bg-white border-slate-200' };
  return (
    <div className={`p-4 rounded-2xl border shadow-sm ${styles[color]}`}>
      <div className="flex justify-between items-start mb-1"><span className="text-[9px] font-bold uppercase opacity-60">{title}</span>{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[9px] font-bold opacity-60">{sub}</div>
    </div>
  );
};

export default App;