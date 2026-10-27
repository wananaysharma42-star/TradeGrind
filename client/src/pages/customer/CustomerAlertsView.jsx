import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Bell,
  Plus,
  Trash2,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
  PlayCircle,
  AlertTriangle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { Badge, StockLogo } from '../../components/ui/StatTile.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { api } from '../../services/api.js';
import { markRead, markAllRead } from '../../store/slices/notificationSlice.js';
import { formatINR } from '../../utils/formatters.js';
import clsx from 'clsx';

export function CustomerAlertsView() {
  const stocks = useSelector((state) => state.market.stocks);
  const user = useSelector((state) => state.auth.user);
  const notifications = useSelector((state) => state.notification.notifications);
  const unreadCount = useSelector((state) => state.notification.unreadCount);
  const dispatch = useDispatch();

  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(true);

  // Rule Builder Form state
  const [stockId, setStockId] = useState('');
  const [type, setType] = useState('PRICE_ABOVE');
  const [threshold, setThreshold] = useState(110);
  const [cooldownTicks, setCooldownTicks] = useState(390);

  // Backtest preview state
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState(null);

  // Set default stockId
  useEffect(() => {
    if (stocks.length > 0 && !stockId) {
      setStockId(stocks[0]._id || stocks[0].id || stocks[0].symbol);
    }
  }, [stocks, stockId]);

  // Load alert rules
  const loadRules = async () => {
    try {
      setLoadingRules(true);
      const res = await api.getAlerts();
      if (Array.isArray(res)) setRules(res);
    } catch (err) {
      console.warn('Failed to load rules', err);
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  // Run backtest preview
  const handleRunPreview = async () => {
    if (!stockId) return;
    setPreviewLoading(true);
    try {
      const res = await api.previewAlert({
        stockId,
        type,
        threshold: Number(threshold),
        cooldownTicks: Number(cooldownTicks)
      });
      setPreviewResult(res);
    } catch (err) {
      alert(`Preview failed: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Create rule
  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!stockId || threshold == null) return;
    setCreateMessage(null);

    try {
      await api.createAlert({
        stockId,
        type,
        threshold: Number(threshold),
        cooldownTicks: Number(cooldownTicks),
        active: true
      });
      setCreateMessage('Alert rule created and loaded into engine!');
      loadRules();
      setTimeout(() => setCreateMessage(null), 2500);
    } catch (err) {
      setCreateMessage(`Error: ${err.message}`);
    }
  };

  // Toggle rule active
  const handleToggleRule = async (rule) => {
    try {
      await api.updateAlert(rule._id, { active: !rule.active });
      loadRules();
    } catch (err) {
      alert(`Toggle failed: ${err.message}`);
    }
  };

  // Delete rule
  const handleDeleteRule = async (id) => {
    try {
      await api.deleteAlert(id);
      loadRules();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const alertRuleColumns = [
    {
      header: 'Stock',
      accessor: 'stockId',
      render: (s) => (
        <div className="flex items-center space-x-2">
          <StockLogo symbol={s?.symbol || '??'} size="sm" />
          <span className="font-bold text-white">{s?.symbol || 'STOCK'}</span>
        </div>
      )
    },
    {
      header: 'Condition Type',
      accessor: 'type',
      render: (t) => <Badge variant="accent" size="sm">{t}</Badge>
    },
    {
      header: 'Threshold',
      accessor: 'threshold',
      render: (th, row) => (
        <span className="font-mono font-semibold text-white">
          {row.type.includes('PCT') || row.type.includes('VOL')
            ? `${th}%`
            : row.type.includes('PROB')
            ? `${(th * 100).toFixed(0)}%`
            : formatINR(th)}
        </span>
      )
    },
    {
      header: 'Cooldown',
      accessor: 'cooldownTicks',
      render: (c) => `${c} Ticks (${Math.round(c / 390)}d)`
    },
    {
      header: 'State',
      accessor: 'active',
      render: (active, row) => (
        <button
          onClick={() => handleToggleRule(row)}
          className={clsx(
            'inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all',
            active
              ? 'bg-gain/15 text-gain border border-gain/30'
              : 'bg-white/5 text-muted border border-white/10'
          )}
        >
          {active ? <ToggleRight className="w-4 h-4 text-gain" /> : <ToggleLeft className="w-4 h-4 text-muted" />}
          <span>{active ? 'Active' : 'Paused'}</span>
        </button>
      )
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (id) => (
        <button
          onClick={() => handleDeleteRule(id)}
          className="p-1.5 rounded-full bg-white/5 hover:bg-loss/20 text-muted hover:text-loss transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Real-Time Alerts & Notification Log</h2>
        <p className="text-xs text-muted">Edge-triggered market conditions, cooldown guards, and historical backtests</p>
      </div>

      {/* Rule Builder & Backtest Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rule Builder Form */}
        <GlassCard>
          <div className="flex items-center space-x-2 mb-4">
            <Bell className="w-4 h-4 text-accent" />
            <h4 className="text-sm font-bold text-white">Create Alert Rule</h4>
          </div>

          <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
            <Select
              id="alert-stock"
              label="Stock"
              options={stocks.map((s) => ({ value: s._id || s.id, label: `${s.symbol} - ${s.name}` }))}
              value={stockId}
              onChange={(e) => setStockId(e.target.value)}
            />

            <Select
              id="alert-type"
              label="Alert Type"
              options={[
                { value: 'PRICE_ABOVE', label: 'Price Above Threshold (Edge Triggered)' },
                { value: 'PRICE_BELOW', label: 'Price Below Threshold (Edge Triggered)' },
                { value: 'PCT_CHANGE', label: 'Day Move Percentage (% Change)' },
                { value: 'PROB_BELOW', label: 'Target Probability Drops Below Threshold' },
                { value: 'VOLATILITY_ABOVE', label: 'Volatility Surpasses Threshold' }
              ]}
              value={type}
              onChange={(e) => setType(e.target.value)}
            />

            <Input
              id="alert-threshold"
              label="Threshold Value ($ or %)"
              type="number"
              step="0.1"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
              required
            />

            <Input
              id="alert-cooldown"
              label="Cooldown Window (Ticks)"
              type="number"
              min="10"
              value={cooldownTicks}
              onChange={(e) => setCooldownTicks(parseInt(e.target.value, 10) || 390)}
            />

            {createMessage && (
              <p className="text-xs text-center text-accent font-medium py-1">{createMessage}</p>
            )}

            <div className="flex space-x-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                disabled={previewLoading}
                onClick={handleRunPreview}
              >
                {previewLoading ? 'Testing...' : 'Backtest Preview'}
              </Button>
              <Button type="submit" variant="primary" className="flex-1">
                Save Rule
              </Button>
            </div>
          </form>
        </GlassCard>

        {/* Backtest Preview Display */}
        <GlassCard className="lg:col-span-2 flex flex-col justify-between" glow>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-base font-bold text-white">Historical Backtest Preview</h4>
                <p className="text-xs text-muted">Evaluates draft rule across the last 30 simulated days of daily candles</p>
              </div>
              <Badge variant="accent" size="sm">PREVIEW</Badge>
            </div>

            {previewResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-20 bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted">Would have fired in last 30 simulated days:</div>
                    <div className="text-2xl font-bold text-white font-mono mt-0.5">
                      {previewResult.triggerCount} Times
                    </div>
                  </div>
                  <Badge variant={previewResult.triggerCount > 0 ? 'positive' : 'neutral'} size="md">
                    {previewResult.totalSimulatedDays} Days Evaluated
                  </Badge>
                </div>

                {previewResult.triggers?.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    <span className="text-[11px] text-muted uppercase font-bold tracking-wider">Trigger Events:</span>
                    {previewResult.triggers.map((trig, idx) => (
                      <div key={idx} className="p-2.5 rounded-14 bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">Day {trig.simDay}</span>
                        <span className="text-muted">High: ${trig.high?.toFixed(2)} • Low: ${trig.low?.toFixed(2)}</span>
                        <span className="font-mono text-accent">${trig.price?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-muted">
                    This condition would not have been crossed during the past 30 days.
                  </div>
                )}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center text-xs text-muted">
                <PlayCircle className="w-8 h-8 text-accent mb-2 opacity-50" />
                <p className="text-white font-medium">No Draft Preview Run</p>
                <p className="text-muted mt-1 max-w-xs">
                  Fill in condition parameters on the left and click "Backtest Preview" to check historical trigger frequency.
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Active Rules List */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-bold text-white">Active Alert Rules</h4>
          <span className="text-xs text-muted font-mono">{rules.length} Rules Registered</span>
        </div>
        <DataTable
          columns={alertRuleColumns}
          data={rules}
          emptyMessage="No alert rules created yet."
        />
      </GlassCard>

      {/* Notification History Log with Read/Unread */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-accent" />
            <h4 className="text-base font-bold text-white">Notification History</h4>
            {unreadCount > 0 && (
              <Badge variant="negative" size="sm">{unreadCount} Unread</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await api.markAllNotificationsRead();
                dispatch(markAllRead());
              }}
            >
              Mark all as read
            </Button>
          )}
        </div>

        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No triggered notifications in history.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                onClick={async () => {
                  if (!n.read) {
                    await api.markNotificationRead(n._id);
                    dispatch(markRead(n._id));
                  }
                }}
                className={clsx(
                  'p-4 rounded-16 border transition-all cursor-pointer flex items-start justify-between',
                  n.read
                    ? 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                    : 'bg-accent/[0.08] border-accent/30 shadow-sm'
                )}
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <h5 className="text-sm font-semibold text-white">{n.title}</h5>
                    {!n.read && <Badge variant="accent" size="sm">NEW</Badge>}
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed">{n.message}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="text-[10px] text-muted flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}

export default CustomerAlertsView;
