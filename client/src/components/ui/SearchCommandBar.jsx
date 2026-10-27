import React, { useState, useEffect, useRef } from 'react';
import { Search, Terminal, ArrowRight, Zap, Bell, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { formatINR } from '../../utils/formatters.js';

/**
 * SearchCommandBar - Deterministic client-side command parser:
 * - "buy <symbol> <quantity>" -> calls onExecuteTrade({ type: 'BUY', symbol, quantity })
 * - "sell <symbol> <quantity>" -> calls onExecuteTrade({ type: 'SELL', symbol, quantity })
 * - "go <view>" -> navigates to view (portfolio, market, analysis, company, alerts)
 * - "alert <symbol> above|below <price>" -> triggers alert creation
 * - Normal text searches stocks
 */
export function SearchCommandBar({
  stocks = [],
  onSelectStock,
  onExecuteCommand,
  className = ''
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [parsedPreview, setParsedPreview] = useState(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse command deterministically
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setParsedPreview(null);
      return;
    }

    const buyMatch = trimmed.match(/^buy\s+([A-Za-z]+)\s+(\d+)$/i);
    if (buyMatch) {
      setParsedPreview({
        type: 'COMMAND_TRADE',
        action: 'BUY',
        symbol: buyMatch[1].toUpperCase(),
        quantity: parseInt(buyMatch[2], 10),
        label: `Execute BUY order: ${buyMatch[2]} shares of ${buyMatch[1].toUpperCase()}`
      });
      return;
    }

    const sellMatch = trimmed.match(/^sell\s+([A-Za-z]+)\s+(\d+)$/i);
    if (sellMatch) {
      setParsedPreview({
        type: 'COMMAND_TRADE',
        action: 'SELL',
        symbol: sellMatch[1].toUpperCase(),
        quantity: parseInt(sellMatch[2], 10),
        label: `Execute SELL order: ${sellMatch[2]} shares of ${sellMatch[1].toUpperCase()}`
      });
      return;
    }

    const navMatch = trimmed.match(/^go\s+([A-Za-z\-]+)$/i);
    if (navMatch) {
      const destination = navMatch[1].toLowerCase();
      setParsedPreview({
        type: 'COMMAND_NAVIGATE',
        destination,
        label: `Navigate to /${destination}`
      });
      return;
    }

    const alertMatch = trimmed.match(/^alert\s+([A-Za-z]+)\s+(above|below)\s+([\d\.]+)$/i);
    if (alertMatch) {
      setParsedPreview({
        type: 'COMMAND_ALERT',
        symbol: alertMatch[1].toUpperCase(),
        direction: alertMatch[2].toUpperCase(),
        price: parseFloat(alertMatch[3]),
        label: `Create Alert: ${alertMatch[1].toUpperCase()} price ${alertMatch[2].toLowerCase()} ₹${alertMatch[3]}`
      });
      return;
    }

    setParsedPreview(null);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (parsedPreview) {
        if (parsedPreview.type === 'COMMAND_NAVIGATE') {
          navigate(`/${parsedPreview.destination}`);
        } else if (onExecuteCommand) {
          onExecuteCommand(parsedPreview);
        }
        setQuery('');
        setIsOpen(false);
      } else if (filteredStocks.length > 0 && onSelectStock) {
        onSelectStock(filteredStocks[0]);
        setQuery('');
        setIsOpen(false);
      }
    }
  };

  const filteredStocks = stocks.filter(
    (s) =>
      s.symbol.toLowerCase().includes(query.toLowerCase()) ||
      (s.name && s.name.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 5);

  return (
    <div ref={containerRef} className={clsx('relative w-full max-w-lg', className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-4 w-4 h-4 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder='Search stocks or type "buy INFY 10", "go portfolio"...'
          className="w-full bg-surface border border-border text-text text-sm rounded-full py-2.5 pl-11 pr-4 backdrop-blur-glass transition-all duration-200 placeholder:text-text-muted/60 focus:outline-none focus:border-accent/60 focus:bg-raised focus:ring-1 focus:ring-accent/30 shadow-inner-glow"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3.5 text-xs text-text-muted hover:text-text"
          >
            Esc
          </button>
        )}
      </div>

      {/* Dropdown Suggestions */}
      {isOpen && (parsedPreview || filteredStocks.length > 0) && (
        <div className="absolute left-0 right-0 mt-2 p-2 bg-raised border border-border rounded-20 backdrop-blur-glass shadow-glass z-50 overflow-hidden">
          {parsedPreview && (
            <div
              onClick={() => {
                if (parsedPreview.type === 'COMMAND_NAVIGATE') {
                  navigate(`/${parsedPreview.destination}`);
                } else if (onExecuteCommand) {
                  onExecuteCommand(parsedPreview);
                }
                setQuery('');
                setIsOpen(false);
              }}
              className="flex items-center space-x-3 p-3 rounded-16 bg-accent/15 border border-accent/30 cursor-pointer hover:bg-accent/25 transition-all text-sm text-accent font-medium mb-1.5"
            >
              <Terminal className="w-4 h-4 text-accent" />
              <span className="flex-1">{parsedPreview.label}</span>
              <span className="text-xs bg-accent/25 px-2 py-0.5 rounded-full text-text font-mono">Press Enter ↵</span>
            </div>
          )}

          {filteredStocks.map((stock) => (
            <div
              key={stock.symbol}
              onClick={() => {
                if (onSelectStock) onSelectStock(stock);
                setQuery('');
                setIsOpen(false);
              }}
              className="flex items-center justify-between p-2.5 rounded-16 hover:bg-accent/[0.06] cursor-pointer transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/35 flex items-center justify-center text-xs font-bold text-accent">
                  {stock.symbol.slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-text">{stock.symbol}</div>
                  <div className="text-xs text-text-muted truncate max-w-[180px]">{stock.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-text">
                  {formatINR(typeof stock.price === 'number' ? stock.price : (stock.currentPrice || 0))}
                </div>
                <div
                  className={clsx(
                    'text-xs font-medium',
                    (stock.changePct ?? stock.dayChangePercent ?? 0) >= 0 ? 'text-gain' : 'text-loss'
                  )}
                >
                  {(stock.changePct ?? stock.dayChangePercent ?? 0) >= 0 ? '+' : ''}
                  {Number(stock.changePct ?? stock.dayChangePercent ?? 0).toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchCommandBar;
