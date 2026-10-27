import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Play,
  Save,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FolderOpen,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FanChart } from '../../components/ui/Charts.jsx';
import { Badge } from '../../components/ui/StatTile.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { api } from '../../services/api.js';
import clsx from 'clsx';

export function TestingEnvironmentView() {
  // Scenario inputs
  const [horizonDays, setHorizonDays] = useState(30);
  const [volatilityMultiplier, setVolatilityMultiplier] = useState(1.0);
  const [driftOverride, setDriftOverride] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [shocks, setShocks] = useState([{ day: 5, pct: -0.15 }]);

  // Feasibility thresholds
  const [minTargetProb, setMinTargetProb] = useState(0.40);
  const [maxLossProb, setMaxLossProb] = useState(0.30);
  const [maxDrawdown, setMaxDrawdown] = useState(0.25);

  // Simulation results
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // Saved scenarios
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [scenarioName, setScenarioName] = useState('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  // Load saved scenarios on mount
  const loadSavedScenarios = async () => {
    try {
      const res = await api.getCompanyScenarios();
      if (res) setSavedScenarios(res);
    } catch (err) {
      console.warn('Failed to load scenarios:', err);
    }
  };

  useEffect(() => {
    loadSavedScenarios();
  }, []);

  // Add & remove shock row
  const addShock = () => {
    setShocks((prev) => [...prev, { day: Math.min(horizonDays, (prev[prev.length - 1]?.day || 1) + 5), pct: -0.10 }]);
  };

  const removeShock = (index) => {
    setShocks((prev) => prev.filter((_, i) => i !== index));
  };

  const updateShock = (index, field, value) => {
    setShocks((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  // Run simulation
  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const payload = {
        horizonDays: Number(horizonDays),
        volatilityMultiplier: Number(volatilityMultiplier),
        shocks: shocks.map((s) => ({ day: Number(s.day), pct: Number(s.pct) })),
        nPaths: 3000,
        thresholds: {
          minTargetProb: minTargetProb !== '' ? Number(minTargetProb) : undefined,
          maxLossProb: maxLossProb !== '' ? Number(maxLossProb) : undefined,
          maxDrawdown: maxDrawdown !== '' ? Number(maxDrawdown) : undefined
        }
      };

      if (driftOverride !== '') payload.mu = Number(driftOverride);
      if (targetPrice !== '') payload.targetPrice = Number(targetPrice);

      const res = await api.runCompanySimulate(payload);
      if (res) setResults(res);
    } catch (err) {
      console.warn('Failed to run simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save current scenario
  const handleSaveScenario = async () => {
    if (!scenarioName.trim() || !results) return;
    try {
      const inputs = {
        horizonDays,
        volatilityMultiplier,
        driftOverride,
        targetPrice,
        shocks,
        thresholds: { minTargetProb, maxLossProb, maxDrawdown }
      };

      await api.saveCompanyScenario({
        name: scenarioName.trim(),
        inputs,
        results
      });

      setSaveModalOpen(false);
      setScenarioName('');
      loadSavedScenarios();
    } catch (err) {
      console.warn('Failed to save scenario:', err);
    }
  };

  // Load scenario into form
  const handleLoadScenario = (sc) => {
    if (!sc.inputs) return;
    setHorizonDays(sc.inputs.horizonDays || 30);
    setVolatilityMultiplier(sc.inputs.volatilityMultiplier || 1.0);
    setDriftOverride(sc.inputs.driftOverride ?? '');
    setTargetPrice(sc.inputs.targetPrice ?? '');
    setShocks(sc.inputs.shocks || []);
    if (sc.inputs.thresholds) {
      setMinTargetProb(sc.inputs.thresholds.minTargetProb ?? 0.40);
      setMaxLossProb(sc.inputs.thresholds.maxLossProb ?? 0.30);
      setMaxDrawdown(sc.inputs.thresholds.maxDrawdown ?? 0.25);
    }
    if (sc.results) {
      setResults(sc.results);
    }
  };

  // Delete scenario
  const handleDeleteScenario = async (id, e) => {
    e.stopPropagation();
    try {
      await api.deleteCompanyScenario(id);
      setSavedScenarios((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      console.warn('Failed to delete scenario:', err);
    }
  };

  const sim = results?.simulation;
  const baseline = results?.baseline;
  const feasibility = results?.feasibilityCheck;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <GlassCard className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-plum-glow/20 border border-plum-glow/40 flex items-center justify-center text-plum-glow">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-plum-white tracking-tight">Testing Environment</h1>
                <p className="text-xs text-plum-light/70">
                  Stress-test equity distributions with discrete shock injections, volatility boosts, and feasibility gates
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {results && (
              <Button
                variant="ghost"
                onClick={() => setSaveModalOpen(true)}
                className="flex items-center gap-2 border border-glass-border"
              >
                <Save className="w-4 h-4 text-plum-glow" />
                Save Scenario
              </Button>
            )}

            <Button
              variant="primary"
              onClick={handleRunSimulation}
              disabled={loading}
              className="flex items-center gap-2 shadow-plum-md"
            >
              <Play className={clsx('w-4 h-4', loading && 'animate-spin')} />
              {loading ? 'Simulating (3,000 Paths)...' : 'Run Scenario'}
            </Button>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Scenario Builder Controls */}
        <div className="lg:col-span-5 space-y-6">
          <GlassCard className="p-6 space-y-5">
            <h2 className="text-base font-bold text-plum-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-plum-glow" />
              Scenario Parameters
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-plum-light/70 block mb-1">Horizon (Days)</label>
                <Input
                  type="number"
                  min="5"
                  max="365"
                  value={horizonDays}
                  onChange={(e) => setHorizonDays(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-plum-light/70 block mb-1">Vol Multiplier (xσ)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5.0"
                  value={volatilityMultiplier}
                  onChange={(e) => setVolatilityMultiplier(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-plum-light/70 block mb-1">Drift Override (μ p.a.)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 0.12"
                  value={driftOverride}
                  onChange={(e) => setDriftOverride(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-plum-light/70 block mb-1">Target Price ($)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 150.0"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Shocks Injection List */}
            <div className="space-y-3 pt-2 border-t border-glass-border">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-plum-white">Discrete Shocks Schedule</span>
                <button
                  type="button"
                  onClick={addShock}
                  className="text-xs text-plum-glow hover:text-plum-white flex items-center gap-1 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Shock
                </button>
              </div>

              {shocks.length === 0 ? (
                <p className="text-xs text-plum-light/50 italic">No discrete shocks configured.</p>
              ) : (
                shocks.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-glass-border">
                    <div className="flex-1">
                      <span className="text-[10px] text-plum-light/50 block">Day</span>
                      <input
                        type="number"
                        min="1"
                        max={horizonDays}
                        value={s.day}
                        onChange={(e) => updateShock(idx, 'day', Number(e.target.value))}
                        className="w-full bg-transparent text-xs text-plum-white font-mono outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] text-plum-light/50 block">Shock % (e.g. -0.15)</span>
                      <input
                        type="number"
                        step="0.01"
                        value={s.pct}
                        onChange={(e) => updateShock(idx, 'pct', Number(e.target.value))}
                        className="w-full bg-transparent text-xs text-plum-white font-mono outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeShock(idx)}
                      className="p-1 rounded-lg text-plum-light/60 hover:text-trade-red transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Feasibility Thresholds */}
            <div className="space-y-3 pt-2 border-t border-glass-border">
              <span className="text-xs font-bold text-plum-white block">Feasibility Thresholds</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[10px] text-plum-light/60 block mb-1">Min Target P</span>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={minTargetProb}
                    onChange={(e) => setMinTargetProb(e.target.value)}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-plum-light/60 block mb-1">Max Loss P</span>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={maxLossProb}
                    onChange={(e) => setMaxLossProb(e.target.value)}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-plum-light/60 block mb-1">Max MDD</span>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={maxDrawdown}
                    onChange={(e) => setMaxDrawdown(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Saved Scenarios Card */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-bold text-plum-white flex items-center gap-2 mb-3">
              <FolderOpen className="w-4 h-4 text-plum-glow" />
              Saved Scenarios ({savedScenarios.length})
            </h3>

            {savedScenarios.length === 0 ? (
              <p className="text-xs text-plum-light/50 italic">No saved test scenarios yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {savedScenarios.map((sc) => (
                  <div
                    key={sc._id}
                    onClick={() => handleLoadScenario(sc)}
                    className="p-3 rounded-xl bg-white/5 border border-glass-border hover:border-plum-glow/40 cursor-pointer flex justify-between items-center transition-all group"
                  >
                    <div>
                      <span className="text-xs font-bold text-plum-white block">{sc.name}</span>
                      <span className="text-[10px] text-plum-light/60">
                        {sc.inputs?.horizonDays}D • {sc.inputs?.volatilityMultiplier}x σ • {sc.inputs?.shocks?.length || 0} shocks
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteScenario(sc._id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-plum-light/50 hover:text-trade-red transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right: Simulation FanChart & Feasibility Results */}
        <div className="lg:col-span-7 space-y-6">
          {!results ? (
            <GlassCard className="p-12 text-center flex flex-col items-center justify-center min-h-[460px]">
              <div className="w-16 h-16 rounded-3xl bg-plum-glow/10 border border-plum-glow/20 flex items-center justify-center text-plum-glow mb-4">
                <FlaskConical className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-plum-white">No Simulation Results</h3>
              <p className="text-xs text-plum-light/60 max-w-sm mt-1">
                Configure horizon, discrete shocks, and feasibility gates on the left, then click "Run Scenario".
              </p>
            </GlassCard>
          ) : (
            <>
              {/* Feasibility Conditions Verdict Banner */}
              <GlassCard className="p-5" glow={feasibility?.overallPassed}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {feasibility?.overallPassed ? (
                      <div className="w-10 h-10 rounded-xl bg-trade-green/10 border border-trade-green/30 flex items-center justify-center text-trade-green">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-trade-red/10 border border-trade-red/30 flex items-center justify-center text-trade-red">
                        <XCircle className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-base font-bold text-plum-white">
                        {feasibility?.overallPassed ? 'Scenario Passed Feasibility Criteria' : 'Scenario Breached Feasibility Gates'}
                      </h3>
                      <p className="text-xs text-plum-light/70">
                        {feasibility?.conditions?.length || 0} mathematical criteria checked against Monte Carlo paths
                      </p>
                    </div>
                  </div>

                  <span
                    className={clsx(
                      'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
                      feasibility?.overallPassed ? 'bg-trade-green/20 text-trade-green' : 'bg-trade-red/20 text-trade-red'
                    )}
                  >
                    {feasibility?.overallPassed ? 'FEASIBLE' : 'BREACH'}
                  </span>
                </div>

                {/* Condition Breakdown Badges */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-glass-border">
                  {feasibility?.conditions?.map((c, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-white/5 border border-glass-border">
                      <div className="flex justify-between items-center text-[10px] text-plum-light/60">
                        <span className="uppercase">{c.condition}</span>
                        <span className={c.pass ? 'text-trade-green font-bold' : 'text-trade-red font-bold'}>
                          {c.pass ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <div className="text-sm font-mono font-bold text-plum-white mt-1">
                        {Number(c.value).toFixed(2)}{' '}
                        <span className="text-[10px] text-plum-light/50 font-normal">
                          (limit: {Number(c.threshold).toFixed(2)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* FanChart Overlay */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-plum-white">Scenario Distribution Cone</h3>
                    <p className="text-xs text-plum-light/60 mt-0.5">
                      3,000 Geometric Brownian Motion paths with scheduled shock shifts
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-plum-light/60 block">Start Price</span>
                    <span className="font-mono text-sm font-bold text-plum-white">${sim?.S0?.toFixed(2)}</span>
                  </div>
                </div>

                <FanChart
                  percentiles={sim?.percentiles}
                  targetPrice={targetPrice ? Number(targetPrice) : null}
                  height={280}
                />
              </GlassCard>

              {/* Key Quantitative Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <GlassCard className="p-4">
                  <span className="text-xs text-plum-light/60 block">Expected Return</span>
                  <div
                    className={clsx(
                      'text-lg font-bold font-mono mt-1',
                      (sim?.expectedReturn || 0) >= 0 ? 'text-trade-green' : 'text-trade-red'
                    )}
                  >
                    {(sim?.expectedReturn || 0) >= 0 ? '+' : ''}
                    {((sim?.expectedReturn || 0) * 100).toFixed(2)}%
                  </div>
                  <span className="text-[10px] text-plum-light/50 mt-1 block">Mean terminal return</span>
                </GlassCard>

                <GlassCard className="p-4">
                  <span className="text-xs text-plum-light/60 block">Prob of Loss</span>
                  <div className="text-lg font-bold font-mono text-trade-red mt-1">
                    {((sim?.pLoss || 0) * 100).toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-plum-light/50 mt-1 block">Terminal &lt; S₀</span>
                </GlassCard>

                <GlassCard className="p-4">
                  <span className="text-xs text-plum-light/60 block">Target Hit Prob</span>
                  <div className="text-lg font-bold font-mono text-plum-glow mt-1">
                    {sim?.pTarget != null ? `${((sim.pTarget || 0) * 100).toFixed(1)}%` : 'N/A'}
                  </div>
                  <span className="text-[10px] text-plum-light/50 mt-1 block">Touch / Terminal</span>
                </GlassCard>

                <GlassCard className="p-4">
                  <span className="text-xs text-plum-light/60 block">95% VaR / CVaR</span>
                  <div className="text-lg font-bold font-mono text-plum-white mt-1">
                    ${Number(sim?.var95 || 0).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-plum-light/50 mt-1 block">
                    CVaR: ${Number(sim?.cvar95 || 0).toFixed(2)}
                  </span>
                </GlassCard>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Save Scenario Modal */}
      <Modal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save Simulation Scenario"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-plum-light/70 block mb-1">Scenario Name</label>
            <Input
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g. Q3 Stress Test (-15% Shock)"
            />
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-glass-border text-xs text-plum-light/70">
            Will persist inputs ({horizonDays}D horizon, {shocks.length} shocks) and simulation summary results to your company testing vault.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setSaveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveScenario} disabled={!scenarioName.trim()}>
              Save Scenario
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
