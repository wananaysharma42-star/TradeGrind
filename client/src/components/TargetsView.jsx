import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Target, Plus, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { formatINR, formatPercent, getInitials, getStockColor } from '../utils/formatters.js';
import { api } from '../services/api.js';
import { setTargets, removeTarget } from '../store/slices/targetSlice.js';

export default function TargetsView({ onOpenNewTarget }) {
  const dispatch = useDispatch();
  const targets = useSelector(state => state.target.targets);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getTargets();
        dispatch(setTargets(data));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dispatch]);

  const handleDelete = async (id) => {
    try {
      await api.deleteTarget(id);
      dispatch(removeTarget(id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="glass-panel p-6 border border-white/10 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Target className="w-5 h-5 text-mauve" />
            <span>Simulated Targets & Price Alerts</span>
          </h2>
          <p className="text-xs text-muted mt-1">
            Real-time deterministic hitting probabilities recalculated every second based on market diffusion.
          </p>
        </div>

        <button
          onClick={onOpenNewTarget}
          className="px-4 py-2 rounded-full bg-gradient-to-r from-mauve-deep to-mauve text-[#0B0709] font-bold text-xs hover:opacity-90 transition-all flex items-center space-x-1.5 shadow-glass-glow"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Target</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {targets.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-muted text-xs">
            No active targets set. Click "New Target" above to define simulated price barriers and track their real-time hitting probability.
          </div>
        ) : (
          targets.map(t => {
            const logoColor = getStockColor(t.symbol);
            const isTriggered = t.status === 'TRIGGERED';
            const isExpired = t.status === 'EXPIRED';
            const probPct = Math.round((t.currentProbability || 0) * 100);

            return (
              <div
                key={t._id || t.id}
                className="p-4 rounded-20 glass-tile border border-white/10 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white"
                        style={{ backgroundColor: `${logoColor}33`, borderColor: logoColor, borderWidth: '1.5px' }}
                      >
                        {getInitials(t.symbol)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{t.symbol}</div>
                        <div className="text-[11px] text-muted">
                          Target: <span className="text-white font-semibold">{formatINR(t.targetPrice)}</span> ({t.direction === 'ABOVE' ? '≥' : '≤'})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isTriggered
                          ? 'bg-tradeGreen/20 text-tradeGreen border border-tradeGreen/30'
                          : isExpired
                          ? 'bg-tradeRed/20 text-tradeRed border border-tradeRed/30'
                          : 'bg-mauve/20 text-mauve border border-mauve/30'
                      }`}>
                        {t.status}
                      </span>
                      <button
                        onClick={() => handleDelete(t._id || t.id)}
                        className="p-1 rounded-full text-muted hover:text-tradeRed transition-colors"
                        title="Delete target"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Probability Bar */}
                  <div className="mt-4 pt-3 border-t border-white/[0.06]">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">Hitting Probability P(Hit):</span>
                      <span className="text-mauve font-bold">{probPct}%</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isTriggered ? 'bg-tradeGreen' : isExpired ? 'bg-tradeRed' : 'bg-gradient-to-r from-mauve-deep to-mauve'
                        }`}
                        style={{ width: `${Math.max(3, probPct)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-muted mt-3 pt-2 border-t border-white/[0.04]">
                  <span>Horizon: {t.remainingDays !== undefined ? `${t.remainingDays} days remaining` : `${t.deadlineDays} days`}</span>
                  <span>Initial P: {Math.round((t.initialProbability || 0) * 100)}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
