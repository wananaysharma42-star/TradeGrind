import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Target,
  Activity,
  Calculator,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge, NumberFlash, StockLogo } from '../../components/ui/StatTile.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { ProbabilityGauge, FanChart, Heatmap } from '../../components/ui/Charts.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { api } from '../../services/api.js';
import { formatINR } from '../../utils/formatters.js';

export function ProbabilityAnalysisView() {
  const stocks = useSelector((state) => state.market.stocks);
  const targetsFromRedux = useSelector((state) => state.targets.targets);

  const [selectedStockId, setSelectedStockId] = useState('');
  const [targetPrice, setTargetPrice] = useState(0);
  const [deadlineDays, setDeadlineDays] = useState(15);
  const [mode, setMode] = useState('touch'); // 'touch' | 'terminal'
  const [nPaths, setNPaths] = useState(3000);

  const [analysisResult, setAnalysisResult] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  // What-if sliders state (debounced 200ms)
  const [whatIfTarget, setWhatIfTarget] = useState(0);
  const [whatIfDays, setWhatIfDays] = useState(15);
  const [whatIfGrid, setWhatIfGrid] = useState(null);
  const [whatIfTargetsList, setWhatIfTargetsList] = useState([]);
  const [whatIfDaysList, setWhatIfDaysList] = useState([]);
  const debounceTimer = useRef(null);

  // Active targets list
  const [activeTargets, setActiveTargets] = useState([]);

  // Selected stock object
  const selectedStock = stocks.find((s) => (s._id || s.id || s.symbol) === selectedStockId) || stocks[0];
  const livePrice = selectedStock?.currentPrice || selectedStock?.price || 1000;

  // Default selected stock and dynamic prices initialization
  useEffect(() => {
    if (stocks.length > 0 && !selectedStockId) {
      const first = stocks[0];
      const sId = first._id || first.id || first.symbol;
      const p = first.currentPrice || first.price || 1000;
      const initialTg = Math.round(p * 1.05 * 10) / 10;
      setSelectedStockId(sId);
      setTargetPrice(initialTg);
      setWhatIfTarget(initialTg);
    }
  }, [stocks, selectedStockId]);

  // When selectedStockId changes, update targetPrice to 5% above current price if uninitialized or stock changed
  const prevStockRef = useRef(selectedStockId);
  useEffect(() => {
    if (selectedStock && prevStockRef.current !== selectedStockId) {
      prevStockRef.current = selectedStockId;
      const p = selectedStock.currentPrice || selectedStock.price || 1000;
      const initialTg = Math.round(p * 1.05 * 10) / 10;
      setTargetPrice(initialTg);
      setWhatIfTarget(initialTg);
      runAnalysis(selectedStockId, initialTg, deadlineDays, mode, nPaths);
    }
  }, [selectedStockId]);

  // Load active targets from backend
  useEffect(() => {
    async function loadTargets() {
      try {
        const res = await api.getTargets();
        if (Array.isArray(res)) setActiveTargets(res);
      } catch (err) {
        // ignore
      }
    }
    loadTargets();
  }, [targetsFromRedux]);

  // Run full Monte Carlo analysis core function
  const runAnalysis = async (stockId, tPrice, dDays, pMode, paths) => {
    if (!stockId || !tPrice) return;
    setLoadingAnalysis(true);
    try {
      const res = await api.analyseTarget({
        stockId,
        targetPrice: Number(tPrice),
        deadlineDays: Number(dDays),
        mode: pMode,
        nPaths: Number(paths)
      });
      setAnalysisResult(res);
      setWhatIfTarget(Number(tPrice));
      setWhatIfDays(Number(dDays));
    } catch (err) {
      console.warn(`Analysis failed: ${err.message}`);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleRunAnalysis = () => {
    runAnalysis(selectedStockId, targetPrice, deadlineDays, mode, nPaths);
  };

  // Debounced What-If grid query
  useEffect(() => {
    if (!selectedStockId || !whatIfTarget || whatIfTarget <= 0) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        const baseTarget = Number(whatIfTarget);
        // Proportional increments around the target price
        const tgList = [
          Math.round(baseTarget * 0.92 * 10) / 10,
          Math.round(baseTarget * 0.96 * 10) / 10,
          baseTarget,
          Math.round(baseTarget * 1.04 * 10) / 10,
          Math.round(baseTarget * 1.08 * 10) / 10
        ];
        const dyList = [5, 10, 15, 20, 30];

        const res = await api.whatIfTargets({
          stockId: selectedStockId,
          targets: tgList,
          days: dyList,
          mode
        });

        if (res?.grid) {
          setWhatIfGrid(res.grid);
          setWhatIfTargetsList(tgList);
          setWhatIfDaysList(dyList);
        }
      } catch (err) {
        console.warn('What-If grid calculation failed', err);
      }
    }, 200);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [selectedStockId, whatIfTarget, whatIfDays, mode]);

  // Derived metrics from analysisResult with fallback normalization
  const mcProb = analysisResult?.monteCarloProbability ?? analysisResult?.monteCarlo?.probability ?? 0;
  const cfProb = analysisResult?.closedFormProbability ?? 0;
  const ciLow = analysisResult?.confidenceInterval?.low ?? analysisResult?.monteCarlo?.ciLow ?? 0;
  const ciHigh = analysisResult?.confidenceInterval?.high ?? analysisResult?.monteCarlo?.ciHigh ?? 0;
  const reqReturn = analysisResult?.requiredAnnualReturn ?? 0;
  const expTerm = analysisResult?.expectedTerminalPrice ?? analysisResult?.monteCarlo?.expectedTerminal ?? livePrice;
  const medTerm = analysisResult?.medianTerminalPrice ?? analysisResult?.monteCarlo?.medianTerminal ?? livePrice;
  const percentiles = analysisResult?.percentiles ?? analysisResult?.monteCarlo?.percentiles;

  // Dynamic slider range based on current stock price
  const sliderMin = Math.max(1, Math.round(livePrice * 0.70));
  const sliderMax = Math.round(livePrice * 1.40);
  const sliderStep = Math.max(1, Math.round(livePrice * 0.005));

  const targetColumns = [
    {
      header: 'Stock',
      accessor: 'symbol',
      render: (sym, row) => (
        <div className="flex items-center space-x-2">
          <StockLogo symbol={sym || row.stockId?.symbol || '??'} size="sm" />
          <span className="font-bold text-white">{sym || row.stockId?.symbol}</span>
        </div>
      )
    },
    { header: 'Target Price', accessor: 'targetPrice', render: (p) => formatINR(p) },
    { header: 'Deadline', accessor: 'deadlineDays', render: (d) => `${d} Days` },
    {
      header: 'Mode',
      accessor: 'mode',
      render: (m) => <Badge variant="accent" size="sm">{m}</Badge>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (st) => (
        <Badge
          variant={st === 'HIT' ? 'positive' : st === 'MISSED' ? 'negative' : 'neutral'}
          size="sm"
        >
          {st}
        </Badge>
      )
    },
    {
      header: 'Live Probability',
      accessor: 'currentProbability',
      render: (prob, row) => {
        const val = prob ?? row.lastProbability ?? 0;
        return (
          <span className="font-mono font-bold text-accent">
            {(val * 100).toFixed(1)}%
          </span>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Probability & Target Modeling</h2>
        <p className="text-xs text-muted">Closed-form touch mathematics and Monte Carlo fan chart simulations</p>
      </div>

      {/* Analysis Form & Gauge Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Form */}
        <GlassCard>
          <div className="flex items-center space-x-2 mb-4">
            <Calculator className="w-4 h-4 text-accent" />
            <h4 className="text-sm font-bold text-white">Target Parameters</h4>
          </div>

          <div className="space-y-3 text-xs">
            <Select
              id="analysis-stock"
              label="Select Stock"
              options={stocks.map((s) => ({
                value: s._id || s.id || s.symbol,
                label: `${s.symbol} - ${s.companyName || s.name || ''} (${formatINR(s.currentPrice || s.price)})`
              }))}
              value={selectedStockId}
              onChange={(e) => setSelectedStockId(e.target.value)}
            />

            <Input
              id="analysis-price"
              label="Target Price (₹)"
              type="number"
              step="1"
              value={targetPrice || ''}
              onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
            />

            <Input
              id="analysis-deadline"
              label="Deadline (Trading Days)"
              type="number"
              min="1"
              max="252"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(parseInt(e.target.value, 10) || 1)}
            />

            <Select
              id="analysis-mode"
              label="Probability Mode"
              options={[
                { value: 'touch', label: 'Touch (Crossing threshold at any time)' },
                { value: 'terminal', label: 'Terminal (At or above on deadline day)' }
              ]}
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            />

            <Input
              id="analysis-paths"
              label="Monte Carlo Paths (nPaths)"
              type="number"
              min="500"
              max="10000"
              step="500"
              value={nPaths}
              onChange={(e) => setNPaths(parseInt(e.target.value, 10) || 3000)}
            />

            <div className="pt-2">
              <Button
                variant="primary"
                className="w-full"
                disabled={loadingAnalysis}
                onClick={handleRunAnalysis}
              >
                {loadingAnalysis ? 'Simulating Paths...' : 'Run Monte Carlo Analysis'}
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Right: Results / Probability Gauge & Comparison */}
        <GlassCard className="lg:col-span-2 flex flex-col justify-between" glow>
          {analysisResult ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-base font-bold text-white">Target Probability Estimation</h4>
                  <p className="text-xs text-muted">
                    {analysisResult.symbol || selectedStock?.symbol}: S₀ = {formatINR(analysisResult.currentPrice || livePrice)} → Target = {formatINR(analysisResult.targetPrice || targetPrice)} in {analysisResult.deadlineDays || deadlineDays}d
                  </p>
                </div>
                <Badge variant="accent" size="sm">
                  {(analysisResult.mode || mode).toUpperCase()} MODE
                </Badge>
              </div>

              {/* Gauge and Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4 items-center">
                <div className="p-4 rounded-20 bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  <ProbabilityGauge probability={mcProb} size={150} />
                </div>

                <div className="sm:col-span-2 grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-16 bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-muted">Monte Carlo Hit:</span>
                    <div className="text-lg font-bold text-white font-mono mt-0.5">
                      {(mcProb * 100).toFixed(1)}%
                    </div>
                    <span className="text-[10px] text-muted">
                      95% CI: [{(ciLow * 100).toFixed(1)}%, {(ciHigh * 100).toFixed(1)}%]
                    </span>
                  </div>

                  <div className="p-3.5 rounded-16 bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-muted">Closed-Form Probability:</span>
                    <div className="text-lg font-bold text-accent font-mono mt-0.5">
                      {(cfProb * 100).toFixed(1)}%
                    </div>
                    <span className="text-[10px] text-muted">Exact reflection principle</span>
                  </div>

                  <div className="p-3.5 rounded-16 bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-muted">Required Ann. Return:</span>
                    <div className="text-lg font-bold text-white font-mono mt-0.5">
                      {(reqReturn * 100).toFixed(1)}%
                    </div>
                    <span className="text-[10px] text-muted">To touch target</span>
                  </div>

                  <div className="p-3.5 rounded-16 bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-muted">Expected Terminal:</span>
                    <div className="text-lg font-bold text-white font-mono mt-0.5">
                      {formatINR(expTerm)}
                    </div>
                    <span className="text-[10px] text-muted">Median: {formatINR(medTerm)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-xs text-muted">
              <Sparkles className="w-8 h-8 text-accent mb-2 opacity-50" />
              <p className="font-medium text-white">No Simulation Loaded</p>
              <p className="text-muted mt-1 max-w-xs">
                Configure parameters on the left and click "Run Monte Carlo Analysis" to calculate probability gauge.
              </p>
            </div>
          )}

          {/* Collapsible Methodology Accordion */}
          {analysisResult?.methodology && (
            <div className="border-t border-white/[0.06] pt-3 mt-3">
              <button
                onClick={() => setMethodologyOpen(!methodologyOpen)}
                className="w-full flex items-center justify-between text-xs text-accent font-semibold hover:text-accent-deep transition-colors"
              >
                <span>How This Was Calculated (Methodology & Mathematical Formulas)</span>
                {methodologyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {methodologyOpen && (
                <div className="mt-3 p-4 rounded-16 bg-white/[0.02] border border-white/[0.06] text-xs text-muted space-y-2">
                  <div className="flex justify-between">
                    <span>Sample Window:</span>
                    <span className="text-white font-mono">{analysisResult.methodology.window}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Drift Formula:</span>
                    <span className="text-white font-mono">{analysisResult.methodology.formulas?.drift}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volatility Estimator:</span>
                    <span className="text-white font-mono">{analysisResult.methodology.formulas?.volatility}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Simulation Paths:</span>
                    <span className="text-white font-mono">{analysisResult.methodology.paramsUsed?.nPaths} iterations</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Fan Chart Projection */}
      {percentiles && (
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-bold text-white">Monte Carlo Fan Chart Projection</h4>
              <p className="text-xs text-muted">Percentile uncertainty bands (5th, 25th, 50th, 75th, 95th) with target reference line</p>
            </div>
            <Badge variant="accent" size="sm">
              TARGET: {formatINR(analysisResult?.targetPrice || targetPrice)}
            </Badge>
          </div>
          <FanChart percentiles={percentiles} targetPrice={analysisResult?.targetPrice || targetPrice} />
        </GlassCard>
      )}

      {/* WHAT-IF Sliders & Heatmap Grid (< 300ms) */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-accent" />
              <h4 className="text-base font-bold text-white">What-If Dynamic Probability Grid</h4>
            </div>
            <p className="text-xs text-muted">Sub-300ms closed-form sensitivity matrix across prices and horizons</p>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <div>
              <span className="text-muted mr-2">Target: {formatINR(whatIfTarget)}</span>
              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={sliderStep}
                value={whatIfTarget || livePrice}
                onChange={(e) => setWhatIfTarget(parseFloat(e.target.value) || livePrice)}
                className="accent-accent cursor-pointer h-1.5"
              />
            </div>
          </div>
        </div>

        {whatIfGrid ? (
          <Heatmap grid={whatIfGrid} targets={whatIfTargetsList} days={whatIfDaysList} />
        ) : (
          <div className="py-6 text-center text-xs text-muted">Calculating what-if sensitivity grid...</div>
        )}
      </GlassCard>

      {/* Active Targets Live List */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Target className="w-4 h-4 text-accent" />
            <h4 className="text-base font-bold text-white">My Active Targets</h4>
          </div>
          <Badge variant="neutral" size="sm">{activeTargets.length} Tracked</Badge>
        </div>

        <DataTable
          columns={targetColumns}
          data={activeTargets}
          emptyMessage="No active targets registered. Use the simulator above to set your first target."
        />
      </GlassCard>
    </div>
  );
}

export default ProbabilityAnalysisView;
