import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2, XCircle, AlertCircle, Ban } from 'lucide-react';
import { formatINR, getInitials, getStockColor } from '../utils/formatters.js';
import { api } from '../services/api.js';

export default function OrdersView() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleCancel = async (id) => {
    try {
      await api.cancelOrder(id);
      loadOrders();
    } catch (e) {
      alert(e.message || 'Failed to cancel order');
    }
  };

  return (
    <div className="glass-panel p-6 border border-border space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h2 className="text-lg font-bold text-text flex items-center space-x-2">
            <Clock className="w-5 h-5 text-accent" />
            <span>Simulated Order History</span>
          </h2>
          <p className="text-xs text-text-muted mt-1">Audit log of all market and limit orders executed on the platform.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-text-muted uppercase tracking-wider text-[10px]">
              <th className="pb-3 px-3">Stock</th>
              <th className="pb-3 px-3">Type</th>
              <th className="pb-3 px-3">Qty</th>
              <th className="pb-3 px-3">Order Price</th>
              <th className="pb-3 px-3">Executed Price</th>
              <th className="pb-3 px-3">Total Amount</th>
              <th className="pb-3 px-3">Status</th>
              <th className="pb-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {orders.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-12 text-center text-text-muted">
                  No orders placed yet. Place your first simulated order from the Watchlist or Market tab.
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const logoColor = getStockColor(o.symbol);
                const isExecuted = o.status === 'EXECUTED';
                const isPending = o.status === 'PENDING';
                const isCancelled = o.status === 'CANCELLED';

                return (
                  <tr key={o._id} className="hover:bg-accent/[0.04] transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-text"
                          style={{ backgroundColor: `${logoColor}33`, borderColor: logoColor, borderWidth: '1px' }}
                        >
                          {getInitials(o.symbol)}
                        </div>
                        <span className="font-bold text-text">{o.symbol}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        o.type.includes('BUY') ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'
                      }`}>
                        {o.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-text">{o.quantity}</td>
                    <td className="py-3 px-3 text-text-muted">{formatINR(o.price)}</td>
                    <td className="py-3 px-3 text-text font-medium">
                      {o.executedPrice ? formatINR(o.executedPrice) : '—'}
                    </td>
                    <td className="py-3 px-3 font-bold text-text">{formatINR(o.totalAmount)}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isExecuted ? 'bg-gain/20 text-gain' :
                        isPending ? 'bg-accent/20 text-accent animate-pulse' :
                        'bg-surface text-text-muted'
                      }`}>
                        {isExecuted ? <CheckCircle2 className="w-3 h-3" /> :
                         isPending ? <Clock className="w-3 h-3" /> :
                         <XCircle className="w-3 h-3" />}
                        <span>{o.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {isPending && (
                        <button
                          onClick={() => handleCancel(o._id)}
                          className="px-2.5 py-1 rounded-full bg-loss/20 hover:bg-loss text-loss hover:text-[#0C0A07] font-bold text-[10px] transition-all"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
