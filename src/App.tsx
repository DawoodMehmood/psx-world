import { WorldCanvas } from './world/scene/WorldCanvas';
import { useEffect } from 'react';
import { InfoPanel, OverrideBanner } from './ui/InfoPanel';
import { useSimStore } from './store/useSimStore';
import { useWorldStore } from './store/useWorldStore';
import { LabelLayer } from './ui/LabelLayer';
import { DemoBar, Playback } from './ui/DemoBar';
import { Legend, LegendButton } from './ui/Legend';
import { DistrictPanel } from './ui/DistrictPanel';

export default function App() {
  const focus = useSimStore((s) => s.scenario.focus);
  // Open on the scenario's star company so the demo has a subject.
  useEffect(() => {
    if (focus) useWorldStore.getState().select(focus);
  }, [focus]);
  return (
    <div className="app">
      <WorldCanvas />
      <LabelLayer />
      <header className="panel brand">
        <div className="logo">PSX World</div>
        <span className="badge">Simulated data</span>
      </header>
      <LegendButton />
      <Legend />
      <InfoPanel />
      <DistrictPanel />
      <OverrideBanner />
      <DemoBar />
      <Playback />
      <div className="hint">Drag to pan · scroll or pinch to zoom · click a company or a district park</div>
    </div>
  );
}
