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
    <div className="glass-panel p-6 border border-border space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h2 className="text-lg font-bold text-text flex items-center space-x-2">
            <Target className="w-5 h-5 text-accent" />
            <span>Simulated Targets & Price Alerts</span>
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Real-time deterministic hitting probabilities recalculated every second based on market diffusion.
          </p>
        </div>

        <button
          onClick={onOpenNewTarget}
          className="px-4 py-2 rounded-full bg-accent text-[#0C0A07] font-bold text-xs hover:bg-accent/90 transition-all flex items-center space-x-1.5 shadow-glass-glow cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Target</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {targets.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-text-muted text-xs">
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
                className="p-4 rounded-20 glass-tile border border-border flex flex-col justify-between bg-surface/50"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-text"
                        style={{ backgroundColor: `${logoColor}33`, borderColor: logoColor, borderWidth: '1.5px' }}
                      >
                        {getInitials(t.symbol)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-text">{t.symbol}</div>
                        <div className="text-[11px] text-text-muted">
                          Target: <span className="text-text font-semibold">{formatINR(t.targetPrice)}</span> ({t.direction === 'ABOVE' ? '≥' : '≤'})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isTriggered
                          ? 'bg-gain/20 text-gain border border-gain/30'
                          : isExpired
                          ? 'bg-loss/20 text-loss border border-loss/30'
                          : 'bg-accent/20 text-accent border border-accent/30'
                      }`}>
                        {t.status}
                      </span>
                      <button
                        onClick={() => handleDelete(t._id || t.id)}
                        className="p-1 rounded-full text-text-muted hover:text-loss transition-colors"
                        title="Delete target"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Probability Bar */}
                  <div className="mt-4 pt-3 border-t border-border/40">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-muted">Hitting Probability P(Hit):</span>
                      <span className="text-accent font-bold">{probPct}%</span>
                    </div>
                    <div className="w-full bg-border/40 h-2 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isTriggered ? 'bg-gain' : isExpired ? 'bg-loss' : 'bg-gradient-to-r from-accent-deep to-accent'
                        }`}
                        style={{ width: `${Math.max(3, probPct)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-text-muted mt-3 pt-2 border-t border-border/30">
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
