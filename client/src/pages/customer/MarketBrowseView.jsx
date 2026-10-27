import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  ArrowUpDown,
  TrendingUp,
  Bookmark,
  BookmarkCheck,
  ShoppingCart,
  Eye
} from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { Badge, NumberFlash, StockLogo } from '../../components/ui/StatTile.jsx';
import { Sparkline } from '../../components/ui/Charts.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { api } from '../../services/api.js';
import { formatINR } from '../../utils/formatters.js';
import clsx from 'clsx';

export function MarketBrowseView() {
  const stocks = useSelector((state) => state.market.stocks);
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();

  // Search and Filter states
  const [query, setQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [selectedVolBucket, setSelectedVolBucket] = useState('ALL'); // 'LOW' | 'MED' | 'HIGH'
  const [selectedFilter, setSelectedFilter] = useState('ALL'); // 'ALL' | 'GAINERS' | 'LOSERS'
  const [sortBy, setSortBy] = useState('volume'); // 'volume' | 'price' | 'change'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  // Watchlist state
  const [watchlistIds, setWatchlistIds] = useState(new Set());

  // Quick Trade Modal
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [activeStock, setActiveStock] = useState(null);
  const [tradeAction, setTradeAction] = useState('BUY');
  const [quantity, setQuantity] = useState(10);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeMessage, setTradeMessage] = useState(null);

  // Load Watchlist IDs
  useEffect(() => {
    async function loadWatchlist() {
      try {
        const res = await api.getWatchlist();
        if (Array.isArray(res)) {
          const ids = new Set(res.map((item) => String(item.stockId?._id || item.stockId || item._id)));
          setWatchlistIds(ids);
        }
      } catch (err) {
        // ignore
      }
    }
    loadWatchlist();
  }, []);

  const handleToggleWatchlist = async (stock, e) => {
    e.stopPropagation();
    const id = String(stock._id || stock.stockId);
    try {
      if (watchlistIds.has(id)) {
        await api.removeFromWatchlist(id);
        setWatchlistIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await api.addToWatchlist(id);
        setWatchlistIds((prev) => new Set(prev).add(id));
      }
    } catch (err) {
      alert(`Watchlist update failed: ${err.message}`);
    }
  };

  const handleOpenTrade = (stock, action, e) => {
    e.stopPropagation();
    setActiveStock(stock);
    setTradeAction(action);
    setQuantity(10);
    setTradeMessage(null);
    setTradeModalOpen(true);
  };

  const handleExecuteTrade = async () => {
    if (!activeStock || quantity <= 0) return;
    setTradeLoading(true);
    setTradeMessage(null);

    try {
      const targetStockId = activeStock.stockId || activeStock._id || activeStock.id || activeStock.symbol;
      if (tradeAction === 'BUY') {
        await api.buyStock({ stockId: targetStockId, quantity: Number(quantity) });
      } else {
        await api.sellStock({ stockId: targetStockId, quantity: Number(quantity) });
      }
      setTradeMessage('Order successfully executed!');
      setTimeout(() => {
        setTradeModalOpen(false);
        setTradeMessage(null);
      }, 1000);
    } catch (err) {
      setTradeMessage(`Error: ${err.message}`);
    } finally {
      setTradeLoading(false);
    }
  };

  // Extract unique sectors
  const sectors = ['ALL', ...new Set(stocks.map((s) => s.sector || 'General'))];

  // Filter and sort stocks
  let filtered = stocks.filter((s) => {
    const q = query.toLowerCase().trim();
    const matchesQuery = !q || s.symbol.toLowerCase().includes(q) || (s.name && s.name.toLowerCase().includes(q));
    const matchesSector = selectedSector === 'ALL' || s.sector === selectedSector;

    let matchesVol = true;
    const vol = s.sigma || 0.20;
    if (selectedVolBucket === 'LOW') matchesVol = vol < 0.20;
    if (selectedVolBucket === 'MED') matchesVol = vol >= 0.20 && vol <= 0.35;
    if (selectedVolBucket === 'HIGH') matchesVol = vol > 0.35;

    const chg = s.dayChangePercent ?? s.changePct ?? 0;
    let matchesChg = true;
    if (selectedFilter === 'GAINERS') matchesChg = chg > 0;
    if (selectedFilter === 'LOSERS') matchesChg = chg < 0;

    return matchesQuery && matchesSector && matchesVol && matchesChg;
  });

  // Sort
  filtered.sort((a, b) => {
    if (sortBy === 'price') return (b.currentPrice ?? b.price) - (a.currentPrice ?? a.price);
    if (sortBy === 'change') return (b.dayChangePercent ?? b.changePct ?? 0) - (a.dayChangePercent ?? a.changePct ?? 0);
    return (b.volume || 0) - (a.volume || 0);
  });

  const livePrice = activeStock?.currentPrice || activeStock?.price || 100;
  const orderTotal = livePrice * Number(quantity || 0);
  const fee = orderTotal * 0.0005;

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Controls */}
      <GlassCard>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Market Universe</h2>
            <p className="text-xs text-muted">Continuous GBM trading feeds & real-time execution</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'table' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              Table
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
            >
              Cards
            </Button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Input
            placeholder="Search symbol or name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-muted" />}
          />

          <Select
            label=""
            options={sectors.map((s) => ({ value: s, label: s === 'ALL' ? 'All Sectors' : s }))}
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
          />

          <Select
            label=""
            options={[
              { value: 'ALL', label: 'All Volatility' },
              { value: 'LOW', label: 'Low (< 20%)' },
              { value: 'MED', label: 'Medium (20% - 35%)' },
              { value: 'HIGH', label: 'High (> 35%)' }
            ]}
            value={selectedVolBucket}
            onChange={(e) => setSelectedVolBucket(e.target.value)}
          />

          <Select
            label=""
            options={[
              { value: 'ALL', label: 'All Movers' },
              { value: 'GAINERS', label: 'Top Gainers' },
              { value: 'LOSERS', label: 'Top Losers' }
            ]}
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
          />

          <Select
            label=""
            options={[
              { value: 'volume', label: 'Sort by Volume' },
              { value: 'price', label: 'Sort by Price' },
              { value: 'change', label: 'Sort by % Change' }
            ]}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          />
        </div>
      </GlassCard>

      {/* Table View */}
      {viewMode === 'table' ? (
        <GlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.03] text-muted uppercase font-medium">
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Sector</th>
                  <th className="py-3 px-4 text-right">Live Price</th>
                  <th className="py-3 px-4 text-right">24h Change</th>
                  <th className="py-3 px-4 text-center">Trend</th>
                  <th className="py-3 px-4 text-right">Volume</th>
                  <th className="py-3 px-4 text-right">Volatility</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((stock) => {
                  const sId = String(stock._id || stock.id);
                  const isUp = (stock.dayChangePercent ?? stock.changePct ?? 0) >= 0;
                  const isWatchlisted = watchlistIds.has(sId);

                  return (
                    <tr
                      key={stock.symbol}
                      onClick={() => navigate(`/customer/stock/${stock._id || stock.symbol}`)}
                      className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <StockLogo symbol={stock.symbol} size="sm" />
                          <div>
                            <div className="font-bold text-white text-sm">{stock.symbol}</div>
                            <div className="text-[10px] text-muted truncate max-w-[140px]">{stock.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-muted">{stock.sector || 'General'}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-white">
                        <NumberFlash
                          value={stock.currentPrice ?? stock.price ?? 100}
                          formatter={(p) => formatINR(p)}
                        />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Badge variant={isUp ? 'positive' : 'negative'} size="sm">
                          {isUp ? '+' : ''}{Number(stock.dayChangePercent ?? stock.changePct ?? 0).toFixed(2)}%
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex justify-center">
                          <Sparkline
                            data={stock.sparkline || [100, 101, 102, 100, 103]}
                            isPositive={isUp}
                            width={75}
                            height={28}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-muted font-mono">
                        {Number(stock.volume || 100000).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-white">
                        {((stock.sigma || 0.20) * 100).toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={(e) => handleToggleWatchlist(stock, e)}
                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-muted hover:text-accent transition-colors"
                            title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
                          >
                            {isWatchlisted ? (
                              <BookmarkCheck className="w-4 h-4 text-accent" />
                            ) : (
                              <Bookmark className="w-4 h-4" />
                            )}
                          </button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => handleOpenTrade(stock, 'BUY', e)}
                          >
                            Trade
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((stock) => {
            const sId = String(stock._id || stock.id);
            const isUp = (stock.dayChangePercent ?? stock.changePct ?? 0) >= 0;
            const isWatchlisted = watchlistIds.has(sId);

            return (
              <GlassCard
                key={stock.symbol}
                hoverEffect
                onClick={() => navigate(`/customer/stock/${stock._id || stock.symbol}`)}
                className="cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <StockLogo symbol={stock.symbol} size="md" />
                      <div>
                        <h4 className="text-sm font-bold text-white">{stock.symbol}</h4>
                        <span className="text-[10px] text-muted">{stock.sector}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleToggleWatchlist(stock, e)}
                      className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-muted hover:text-accent"
                    >
                      {isWatchlisted ? (
                        <BookmarkCheck className="w-4 h-4 text-accent" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="my-2">
                    <div className="text-xl font-bold text-white font-mono">
                      <NumberFlash
                        value={stock.currentPrice ?? stock.price ?? 100}
                        formatter={(p) => formatINR(p)}
                      />
                    </div>
                    <div className="mt-1">
                      <Badge variant={isUp ? 'positive' : 'negative'} size="sm">
                        {isUp ? '+' : ''}{Number(stock.dayChangePercent ?? stock.changePct ?? 0).toFixed(2)}%
                      </Badge>
                    </div>
                  </div>

                  <div className="my-3 flex justify-center">
                    <Sparkline
                      data={stock.sparkline || [100, 102, 101, 103, 102, 104]}
                      isPositive={isUp}
                      width={180}
                      height={36}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[11px] text-muted">
                    Vol: {((stock.sigma || 0.20) * 100).toFixed(0)}%
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => handleOpenTrade(stock, 'BUY', e)}
                  >
                    Trade
                  </Button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Trade Modal */}
      <Modal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        title={`Execute Trade: ${activeStock?.symbol}`}
        subtitle={`Live Price: $${livePrice.toFixed(2)}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
            <button
              onClick={() => setTradeAction('BUY')}
              className={clsx(
                'py-1.5 text-xs font-semibold rounded-full transition-all',
                tradeAction === 'BUY'
                  ? 'bg-gain/20 text-gain border border-gain/40 shadow-sm'
                  : 'text-muted hover:text-white'
              )}
            >
              Buy
            </button>
            <button
              onClick={() => setTradeAction('SELL')}
              className={clsx(
                'py-1.5 text-xs font-semibold rounded-full transition-all',
                tradeAction === 'SELL'
                  ? 'bg-loss/20 text-loss border border-loss/40 shadow-sm'
                  : 'text-muted hover:text-white'
              )}
            >
              Sell
            </button>
          </div>

          <Input
            id="trade-shares"
            label="Quantity (Shares)"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />

          <div className="p-3.5 rounded-16 bg-white/[0.03] border border-white/[0.06] space-y-1.5 text-xs">
            <div className="flex justify-between text-muted">
              <span>Gross Order Value:</span>
              <span className="font-semibold text-white">${orderTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Trading Fee (0.05%):</span>
              <span className="font-semibold text-white">${fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted border-t border-white/[0.06] pt-1.5">
              <span>Total Capital Required:</span>
              <span className="font-bold text-accent">${(orderTotal + fee).toFixed(2)}</span>
            </div>
          </div>

          {tradeMessage && (
            <p className="text-xs text-center font-medium text-accent">{tradeMessage}</p>
          )}

          <div className="flex space-x-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setTradeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={tradeLoading}
              onClick={handleExecuteTrade}
            >
              {tradeLoading ? 'Processing...' : `Confirm ${tradeAction}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default MarketBrowseView;
