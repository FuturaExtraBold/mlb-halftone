import { useApp } from "../context/AppContext";

const EASE_OPTIONS = [
  "none",
  "power1.out", "power2.out", "power3.out", "power4.out",
  "power1.in",  "power2.in",  "power3.in",  "power4.in",
  "power1.inOut", "power2.inOut", "power4.inOut",
  "back.out", "back.in",
  "bounce.out", "bounce.in",
  "elastic.out", "elastic.in",
  "circ.out", "circ.in",
  "expo.out", "expo.in",
  "sine.out", "sine.in",
];

function Slider({ label, name, min, max, step, decimals = 0 }) {
  const { config, updateConfig } = useApp();
  const value = config[name];
  const display = decimals > 0 ? Number(value).toFixed(decimals) : value;

  return (
    <label className="control-item">
      <span>{label}: {display}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => updateConfig(name, parseFloat(e.target.value))}
      />
    </label>
  );
}

export function ControlBar() {
  const { config, updateConfig } = useApp();

  return (
    <div className="control-bar">
      <label className="control-item control-item--toggle">
        <span>Invert</span>
        <input
          type="checkbox"
          checked={config.invertMode}
          onChange={(e) => updateConfig("invertMode", e.target.checked)}
        />
      </label>

      <div className="control-divider" />

      <Slider label="Grid"    name="gridSize"   min={4}   max={60}  step={2} />
      <Slider label="Max Dot" name="maxDotSize"  min={0}   max={80}  step={1} />
      <Slider label="Min Dot" name="minDotSize"  min={0}   max={80}  step={1} />

      <div className="control-divider" />

      <label className="control-item">
        <span>Color</span>
        <input
          type="color"
          value={config.dotColorHex}
          onChange={(e) => updateConfig("dotColorHex", e.target.value)}
        />
      </label>
      <Slider label="Opacity" name="dotOpacity" min={0} max={1} step={0.01} decimals={2} />

      <div className="control-divider" />

      <Slider label="Bri Min" name="brightnessMin" min={0} max={255} step={1} />
      <Slider label="Bri Max" name="brightnessMax" min={0} max={255} step={1} />

      <div className="control-divider" />

      <Slider label="Duration" name="animationDuration" min={0.1} max={5} step={0.1} decimals={1} />

      <label className="control-item">
        <span>Ease</span>
        <select
          value={config.animationEase}
          onChange={(e) => updateConfig("animationEase", e.target.value)}
        >
          {EASE_OPTIONS.map((ease) => (
            <option key={ease} value={ease}>{ease}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
