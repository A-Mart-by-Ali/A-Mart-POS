import React, { useState, useEffect } from 'react';
import {
  CircleDollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  CreditCard,
  RotateCcw,
  DollarSign,
  Receipt
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import {
  getCurrentShift,
  openCashierShift,
  closeCashierShift,
  subscribePosChanges
} from '../services/posService';
import { CashierShift } from '../types/database';

export const ShiftsView: React.FC = () => {
  const [shift, setShift] = useState<CashierShift | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState<number>(5000);
  const [actualCash, setActualCash] = useState<number>(0);

  const loadShift = async () => {
    try {
      const data = await getCurrentShift();
      setShift(data);
      if (data) {
        const expected = data.opening_cash + data.cash_sales - data.total_returns;
        setActualCash(expected);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShift();
    const unsub = subscribePosChanges(loadShift);
    return () => unsub();
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await openCashierShift(Number(openingFloat));
      setIsOpenModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to open shift');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;
    try {
      await closeCashierShift(shift.id, Number(actualCash));
      setIsCloseModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to close shift');
    }
  };

  const expectedCash = shift ? shift.opening_cash + shift.cash_sales - shift.total_returns : 0;
  const discrepancy = actualCash - expectedCash;

  return (
    <div className="space-y-6 pb-10 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CircleDollarSign className="w-6 h-6 text-mart-800" />
            <span>Cashier Shifts & Register Balancing</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit drawer floats, track payment channels, and enforce blind cash reconciliation per shift.
          </p>
        </div>

        <div>
          {shift && shift.status === 'open' ? (
            <button
              onClick={() => setIsCloseModalOpen(true)}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Close Shift & Reconcile</span>
            </button>
          ) : (
            <button
              onClick={() => setIsOpenModalOpen(true)}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-mart-900 text-white hover:bg-mart-800 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Unlock className="w-4 h-4 text-mart-200" />
              <span>Open New Cashier Shift</span>
            </button>
          )}
        </div>
      </div>

      {shift ? (
        <div className="space-y-6">
          
          {/* Shift Status Banner */}
          <div
            className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${
              shift.status === 'open'
                ? 'bg-orange-50/80 border-orange-200 text-orange-950'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  shift.status === 'open' ? 'bg-orange-600 text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                {shift.status === 'open' ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <div className="font-bold text-base">
                  {shift.status === 'open' ? 'Current Register Session: ACTIVE' : 'Register Session: CLOSED'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Opened at: {new Date(shift.opened_at).toLocaleString()}
                  {shift.closed_at && ` | Closed at: ${new Date(shift.closed_at).toLocaleString()}`}
                </div>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                shift.status === 'open' ? 'bg-orange-200 text-orange-950' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {shift.status}
            </span>
          </div>

          {/* Cash Drawer Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Opening Cash Float */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Opening Float</span>
              <div className="text-2xl font-extrabold text-slate-900 font-mono">
                Rs. {shift.opening_cash.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500">Starting cash handed to cashier</p>
            </div>

            {/* Cash Sales */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600">Cash Sales (In)</span>
              <div className="text-2xl font-extrabold text-orange-700 font-mono">
                +Rs. {shift.cash_sales.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500">Collected from cash checkouts</p>
            </div>

            {/* Total Returns */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Refunds Paid (Out)</span>
              <div className="text-2xl font-extrabold text-rose-700 font-mono">
                -Rs. {shift.total_returns.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500">Cash returned to customers</p>
            </div>

            {/* Card Sales */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Card Terminal Sales</span>
              <div className="text-2xl font-extrabold text-blue-700 font-mono">
                Rs. {shift.card_sales.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500">Settled directly via bank merchant POS</p>
            </div>

            {/* Mobile Wallet Sales */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Digital Wallet Sales</span>
              <div className="text-2xl font-extrabold text-purple-700 font-mono">
                Rs. {shift.other_sales.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500">Easypaisa, JazzCash, Nayapay, etc.</p>
            </div>

            {/* Expected Cash in Drawer */}
            <div className="bg-mart-900 rounded-2xl p-5 text-white shadow-sm space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-mart-200">Expected Physical Cash</span>
              <div className="text-2xl font-extrabold font-mono text-white">
                Rs. {expectedCash.toLocaleString()}
              </div>
              <p className="text-[11px] text-mart-200">Float + Cash Sales - Refunds</p>
            </div>

          </div>

          {/* If Closed: Discrepancy report */}
          {shift.status === 'closed' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">
                Shift Reconciliation Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Expected Cash:</span>
                  <strong className="font-mono text-sm">Rs. {shift.expected_cash?.toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Actual Cash Counted:</span>
                  <strong className="font-mono text-sm">Rs. {shift.actual_cash?.toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Variance (Over / Short):</span>
                  <strong
                    className={`font-mono text-sm font-bold ${
                      (shift.cash_difference || 0) >= 0 ? 'text-orange-700' : 'text-rose-700'
                    }`}
                  >
                    {(shift.cash_difference || 0) >= 0 ? `+Rs. ${shift.cash_difference}` : `-Rs. ${Math.abs(shift.cash_difference || 0)}`}
                  </strong>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center">
          <p className="text-slate-500">No shift currently recorded.</p>
        </div>
      )}

      {/* OPEN SHIFT MODAL */}
      <Modal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        size="md"
        icon={<DollarSign className="w-5 h-5 text-mart-900" />}
        title="Open Shift"
      >
        <form onSubmit={handleOpenShift} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Starting Cash (Rs.) *</label>
            <input
              type="number"
              required
              min="0"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm font-bold font-mono focus:ring-2 focus:ring-mart-800 bg-slate-50/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOpenModalOpen(false)}
              className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 font-semibold cursor-pointer hover:bg-slate-50 transition-all text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-mart-900 text-white font-semibold hover:bg-mart-800 cursor-pointer transition-all shadow-sm text-xs hover:shadow-mart"
            >
              Open Register
            </button>
          </div>
        </form>
      </Modal>

      {/* CLOSE SHIFT MODAL */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        size="md"
        icon={<Clock className="w-5 h-5 text-mart-900" />}
        title="Close Shift"
      >
        <form onSubmit={handleCloseShift} className="space-y-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
            <span className="text-slate-500 font-medium">Expected in Drawer:</span>
            <strong className="font-mono text-sm text-slate-900">Rs. {expectedCash.toLocaleString()}</strong>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Cash Counted (Rs.) *</label>
            <input
              type="number"
              required
              min="0"
              value={actualCash}
              onChange={(e) => setActualCash(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm font-bold font-mono focus:ring-2 focus:ring-mart-800 bg-slate-50/50"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
            <span className="text-slate-500 font-medium">Difference:</span>
            <strong
              className={`font-mono text-sm font-bold ${
                discrepancy === 0
                  ? 'text-emerald-700'
                  : discrepancy > 0
                  ? 'text-orange-700'
                  : 'text-rose-700'
              }`}
            >
              {discrepancy === 0 ? 'Balanced (Rs. 0)' : discrepancy > 0 ? `+Rs. ${discrepancy.toLocaleString()} (Extra)` : `-Rs. ${Math.abs(discrepancy).toLocaleString()} (Short)`}
            </strong>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCloseModalOpen(false)}
              className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 font-semibold cursor-pointer hover:bg-slate-50 transition-all text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer transition-all shadow-sm text-xs"
            >
              Close Shift
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
