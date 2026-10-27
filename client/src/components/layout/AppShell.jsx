import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Sidebar } from './Sidebar.jsx';
import { Header } from './Header.jsx';
import { PillTabs } from '../ui/PillTabs.jsx';
import { SearchCommandBar } from '../ui/SearchCommandBar.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { api } from '../../services/api.js';

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Quick trade modal state from search bar command
  const [cmdTradeModalOpen, setCmdTradeModalOpen] = useState(false);
  const [cmdTradePayload, setCmdTradePayload] = useState(null);
  const [tradeStatus, setTradeStatus] = useState(null);

  const stocks = useSelector((state) => state.market.stocks);
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();

  const isCompany = user?.role === 'COMPANY';

  // Customer top tabs
  const customerTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'targets', label: 'Targets & Probability' },
    { id: 'analytics', label: 'Analytics' }
  ];

  // Company top tabs
  const companyTabs = [
    { id: 'overview', label: 'Stock Overview' },
    { id: 'shareholders', label: 'Shareholders' },
    { id: 'monte-carlo', label: 'Testing & Scenarios' }
  ];

  const currentTabs = isCompany ? companyTabs : customerTabs;

  // Handle command bar action
  const handleExecuteCommand = async (command) => {
    if (command.type === 'COMMAND_TRADE') {
      const stock = stocks.find((s) => s.symbol === command.symbol);
      const targetStockId = stock?.stockId || stock?._id || stock?.id || stock?.symbol || command.symbol;
      setCmdTradePayload({
        stockId: targetStockId,
        symbol: command.symbol,
        action: command.action,
        quantity: command.quantity,
        price: stock?.currentPrice || stock?.price || 100
      });
      setCmdTradeModalOpen(true);
    } else if (command.type === 'COMMAND_ALERT') {
      const stock = stocks.find((s) => s.symbol === command.symbol);
      if (stock) {
        try {
          const targetStockId = stock.stockId || stock._id || stock.id || stock.symbol;
          await api.createAlert({
            stockId: targetStockId,
            type: command.direction === 'ABOVE' ? 'PRICE_ABOVE' : 'PRICE_BELOW',
            threshold: command.price,
            cooldownTicks: 390
          });
          alert(`Alert created for ${command.symbol} ${command.direction} $${command.price}`);
        } catch (err) {
          alert(`Failed to create alert: ${err.message}`);
        }
      }
    }
  };

  const handleConfirmTrade = async () => {
    if (!cmdTradePayload) return;
    try {
      setTradeStatus('Executing...');
      if (cmdTradePayload.action === 'BUY') {
        await api.buyStock({
          stockId: cmdTradePayload.stockId,
          quantity: cmdTradePayload.quantity
        });
      } else {
        await api.sellStock({
          stockId: cmdTradePayload.stockId,
          quantity: cmdTradePayload.quantity
        });
      }
      setTradeStatus('Trade executed successfully!');
      setTimeout(() => {
        setCmdTradeModalOpen(false);
        setTradeStatus(null);
      }, 1000);
    } catch (err) {
      setTradeStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      {/* Main Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header & Search Bar Bar */}
        <div className="p-6 pb-2 shrink-0">
          <Header onOpenSettings={() => setSettingsOpen(true)} />

          {/* Top Pill Tabs Row + Command Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-border">
            <PillTabs
              tabs={currentTabs}
              activeTab={activeTab}
              onChange={(tab) => {
                setActiveTab(tab);
                if (tab === 'targets') navigate('/analysis');
                else if (tab === 'watchlist') navigate('/market');
                else if (tab === 'overview') navigate(isCompany ? '/company' : '/dashboard');
              }}
            />

            <SearchCommandBar
              stocks={stocks}
              onSelectStock={(s) => navigate(`/stock/${s.symbol || s._id}`)}
              onExecuteCommand={handleExecuteCommand}
            />
          </div>
        </div>

        {/* Scrollable View Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Outlet context={{ activeTab }} />
        </div>
      </main>

      {/* Quick Trade Confirmation Modal */}
      <Modal
        isOpen={cmdTradeModalOpen}
        onClose={() => setCmdTradeModalOpen(false)}
        title={`Confirm ${cmdTradePayload?.action} Order`}
        subtitle={`${cmdTradePayload?.quantity} shares of ${cmdTradePayload?.symbol}`}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-16 bg-surface border border-border text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-text-muted">Estimated Price:</span>
              <span className="font-semibold text-text">₹{cmdTradePayload?.price?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Order Value:</span>
              <span className="font-semibold text-text">
                ₹{((cmdTradePayload?.quantity || 0) * (cmdTradePayload?.price || 0)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Fee (0.05%):</span>
              <span className="font-semibold text-text">
                ₹{((cmdTradePayload?.quantity || 0) * (cmdTradePayload?.price || 0) * 0.0005).toFixed(2)}
              </span>
            </div>
          </div>

          {tradeStatus && (
            <p className="text-xs text-center text-accent font-medium">{tradeStatus}</p>
          )}

          <div className="flex space-x-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setCmdTradeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleConfirmTrade}>
              Confirm {cmdTradePayload?.action}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Settings & Simulation Controls"
        subtitle="Configure simulation environment and user preferences"
      >
        <div className="space-y-4 text-xs">
          <Input label="Display Name" defaultValue={user?.name || ''} readOnly />
          <Input label="Email Address" defaultValue={user?.email || ''} readOnly />
          <Input label="Role" defaultValue={user?.role || 'CUSTOMER'} readOnly />
          <div className="pt-2">
            <Button variant="primary" className="w-full" onClick={() => setSettingsOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AppShell;
