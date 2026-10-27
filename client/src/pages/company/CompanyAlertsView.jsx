import React, { useState, useEffect } from 'react';
import {
  Bell,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  History,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { Badge, StockLogo } from '../../components/ui/StatTile.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { api } from '../../services/api.js';
import clsx from 'clsx';

export function CompanyAlertsView() {
  const [stock, setStock] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [alertType, setAlertType] = useState('PCT_CHANGE');
  const [threshold, setThreshold] = useState('5.0');
  const [previewFired, setPreviewFired] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch company stock, alerts and notifications
  const loadAlertsData = async () => {
    try {
      const [home, alertList, notifList] = await Promise.all([
        api.getCompanyHome().catch(() => null),
        api.getAlerts().catch(() => []),
        api.getNotifications().catch(() => [])
      ]);

      if (home?.stock) setStock(home.stock);
      if (Array.isArray(alertList)) setAlerts(alertList);
      const notifsArr = Array.isArray(notifList)
        ? notifList
        : Array.isArray(notifList?.notifications)
          ? notifList.notifications
          : [];
      setNotifications(notifsArr);
    } catch (err) {
      console.warn('Failed to load company alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlertsData();
  }, []);

  // Backtest preview runner (debounced)
  useEffect(() => {
    if (!stock?._id && !stock?.id) return;
    if (!threshold || isNaN(Number(threshold))) return;

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await api.previewAlert({
          stockId: stock._id || stock.id,
          type: alertType,
          threshold: Number(threshold)
        });
        if (res && res.wouldHaveFiredCount !== undefined) {
          setPreviewFired(res.wouldHaveFiredCount);
        }
      } catch (err) {
        console.warn('Preview error:', err);
      } finally {
        setPreviewLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [stock, alertType, threshold]);

  // Create rule
  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!stock) return;

    try {
      const created = await api.createAlert({
        stockId: stock._id || stock.id,
        type: alertType,
        threshold: Number(threshold)
      });
      if (created) {
        setAlerts((prev) => [created, ...prev]);
        setThreshold('');
      }
    } catch (err) {
      console.warn('Failed to create alert:', err);
    }
  };

  // Toggle active
  const handleToggle = async (alert) => {
    try {
      const updated = await api.updateAlert(alert._id, { active: !alert.active });
      if (updated) {
        setAlerts((prev) => prev.map((a) => (a._id === alert._id ? updated : a)));
      }
    } catch (err) {
      console.warn('Failed to toggle alert:', err);
    }
  };

  // Delete rule
  const handleDelete = async (id) => {
    try {
      await api.deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      console.warn('Failed to delete alert:', err);
    }
  };

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.warn('Failed to mark read:', err);
    }
  };

  const notificationColumns = [
    {
      header: 'Event',
      accessor: 'title',
      render: (t, row) => (
        <div className="flex items-start gap-2.5">
          <span
            className={clsx(
              'w-2 h-2 rounded-full mt-1.5 shrink-0',
              row.read ? 'bg-text-muted/30' : 'bg-gain animate-pulse'
            )}
          />
          <div>
            <span className={clsx('text-xs font-semibold block', row.read ? 'text-text-muted' : 'text-text-primary font-bold')}>
              {t}
            </span>
            <span className="text-[11px] text-text-muted">{row.message}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Sim Day / Time',
      accessor: 'simDay',
      render: (d, row) => (
        <span className="text-xs text-text-muted font-mono">
          Day {d || 1} • {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-3xl bg-glass-surface border border-glass-border" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 rounded-3xl bg-glass-surface border border-glass-border" />
          <div className="h-80 rounded-3xl bg-glass-surface border border-glass-border" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <GlassCard className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary tracking-tight">Company Alerts & Telemetry Rules</h1>
                <p className="text-xs text-text-muted">
                  Real-time edge triggers and edge-crossing alerts scoped to {stock?.symbol || 'your equity'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-raised/60 border border-glass-border text-text-muted">
              Stock: {stock?.symbol || 'CMP'}
            </span>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Rule Builder */}
        <div className="lg:col-span-5 space-y-6">
          <GlassCard className="p-6 space-y-5">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Plus className="w-4 h-4 text-accent" />
              Configure Company Trigger Rule
            </h2>

            <form onSubmit={handleCreateAlert} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-muted block mb-1">Alert Condition Type</label>
                <Select value={alertType} onChange={(e) => setAlertType(e.target.value)}>
                  <option value="PCT_CHANGE">Intraday Percentage Shift (|Δ%| &gt;= X%)</option>
                  <option value="PRICE_ABOVE">Price Crosses Above (₹ &gt; X)</option>
                  <option value="PRICE_BELOW">Price Crosses Below (₹ &lt; X)</option>
                  <option value="PROB_BELOW">Target Probability Drops Below (&lt; X)</option>
                  <option value="PROB_ABOVE">Target Probability Rises Above (&gt; X)</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-muted block mb-1">
                  Threshold ({alertType === 'PCT_CHANGE' ? '% Change' : alertType.startsWith('PRICE') ? 'Price in INR (₹)' : 'Probability (0-1)'})
                </label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder={alertType === 'PCT_CHANGE' ? '5.0' : '150.0'}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </div>

              {/* Live Backtest Preview Box */}
              <div className="p-3.5 rounded-xl bg-surface-raised/60 border border-glass-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    30-Day Historical Backtest:
                  </span>
                  {previewLoading ? (
                    <span className="text-text-muted/60 font-mono text-xs">Evaluating...</span>
                  ) : previewFired !== null ? (
                    <span className="font-mono font-bold text-text-primary">
                      Would have fired{' '}
                      <span className="text-accent font-extrabold">{previewFired}</span> times
                    </span>
                  ) : (
                    <span className="text-text-muted/60 text-xs">Enter threshold</span>
                  )}
                </div>
                <span className="text-[10px] text-text-muted/60 mt-1 block">
                  Simulated across the last 30 daily sessions recorded by the market engine
                </span>
              </div>

              <Button type="submit" variant="primary" className="w-full">
                Create Alert Rule
              </Button>
            </form>
          </GlassCard>

          {/* Active Rules List */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-bold text-text-primary mb-4">Active Rules ({alerts.length})</h3>

            {alerts.length === 0 ? (
              <p className="text-xs text-text-muted italic">No alert rules configured yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {alerts.map((a) => (
                  <div
                    key={a._id}
                    className="p-3 rounded-xl bg-surface-raised/50 border border-glass-border flex justify-between items-center"
                  >
                    <div>
                      <span className="text-xs font-bold text-text-primary block font-mono">{a.type}</span>
                      <span className="text-[11px] text-text-muted">
                        Threshold: <span className="text-text-primary font-mono">{a.threshold}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggle(a)}
                        className={clsx('transition-colors', a.active ? 'text-gain' : 'text-text-muted/40')}
                      >
                        {a.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(a._id)}
                        className="text-text-muted hover:text-loss transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right: Notifications History Feed */}
        <div className="lg:col-span-7">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary">Real-Time Notification History</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Live toast alerts and edge-triggered event history log
                </p>
              </div>

              {Array.isArray(notifications) && notifications.some((n) => !n.read) && (
                <Button variant="ghost" onClick={handleMarkAllRead} className="text-xs text-accent">
                  Mark All Read
                </Button>
              )}
            </div>

            <DataTable
              columns={notificationColumns}
              data={Array.isArray(notifications) ? notifications : []}
              emptyMessage="No triggered alerts logged yet. Configure a rule to receive notifications."
            />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
