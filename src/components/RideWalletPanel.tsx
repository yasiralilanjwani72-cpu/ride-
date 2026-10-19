import React, { useMemo, useState } from 'react';
import { Booking, Ride, WalletTransaction } from '../types';
import { createWalletTransaction } from '../services/firestoreService';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Building2,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  RefreshCw,
  Receipt,
  Sparkles,
} from 'lucide-react';

interface RideWalletPanelProps {
  userUid: string;
  userName: string;
  userRole: 'passenger' | 'driver';
  bookings: Booking[];
  rides: Ride[];
  walletTransactions: WalletTransaction[];
}

function getTimestampMillis(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'object') {
    if ('toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
      return (val as { toMillis: () => number }).toMillis();
    }
    if ('seconds' in val && typeof (val as { seconds: number }).seconds === 'number') {
      return (val as { seconds: number }).seconds * 1000;
    }
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const parsed = new Date(val).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function formatTransactionDate(val: unknown): string {
  const ms = getTimestampMillis(val);
  if (!ms) return 'Just now';
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RideWalletPanel({
  userUid,
  userName,
  userRole,
  bookings,
  walletTransactions,
}: RideWalletPanelProps) {
  // Filter state for Transaction History
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Action Form states (Add Funds for Passenger / Withdraw Earnings or Top-up for Driver)
  const [activeActionTab, setActiveActionTab] = useState<'topup' | 'withdraw' | 'pay_booking'>(
    userRole === 'driver' ? 'withdraw' : 'topup'
  );
  const [amountInput, setAmountInput] = useState<number>(userRole === 'driver' ? 2500 : 2000);
  const [paymentGateway, setPaymentGateway] = useState<string>(
    userRole === 'driver' ? 'RAAST Instant IBFT (HBL / Meezan)' : 'RAAST Instant IBFT'
  );
  const [accountReference, setAccountReference] = useState<string>(
    userRole === 'driver' ? 'PK36MEZN0001234567890102' : '0300-1234567'
  );
  const [selectedBookingToPay, setSelectedBookingToPay] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Scoped transactions for this user & role, plus automatic booking-linked ledger entries if not already recorded
  const mergedLedger = useMemo(() => {
    const roleTransactions = walletTransactions.filter(
      (t) => t.userUid === userUid && t.userRole === userRole
    );

    const syntheticFromBookings: WalletTransaction[] = [];

    if (userRole === 'passenger') {
      bookings
        .filter((b) => b.passengerUid === userUid)
        .forEach((b) => {
          const hasExplicitTx = roleTransactions.some(
            (tx) => tx.referenceId === b.id || tx.referenceId.includes(b.id)
          );
          if (!hasExplicitTx) {
            if (b.paymentStatus === 'paid' || b.status === 'confirmed' || b.status === 'completed') {
              syntheticFromBookings.push({
                id: `bk_debit_${b.id}`,
                userUid,
                userRole: 'passenger',
                type: 'debit',
                category: 'ride_payment',
                amount: b.totalFare,
                title: `Seat Booking Payment (${b.fromCity} → ${b.toCity})`,
                description: `${b.seatsBooked} seat(s) with Captain ${b.driverName} · ${b.departureDate}`,
                paymentMethod: 'Ride Wallet Escrow',
                referenceId: b.id,
                status: 'completed',
                createdAt: b.updatedAt || b.createdAt,
              });
            } else if (b.paymentStatus === 'refunded') {
              syntheticFromBookings.push({
                id: `bk_refund_${b.id}`,
                userUid,
                userRole: 'passenger',
                type: 'credit',
                category: 'refund',
                amount: b.totalFare,
                title: `Automatic Booking Refund (${b.fromCity} → ${b.toCity})`,
                description: `Full refund for ${b.seatsBooked} cancelled/declined seat(s) · ${b.departureDate}`,
                paymentMethod: 'Ride Wallet Instant Refund',
                referenceId: b.id,
                status: 'completed',
                createdAt: b.updatedAt || b.createdAt,
              });
            }
          }
        });
    } else {
      // Driver ledger: confirmed/completed passenger bookings count as driver_earning credits
      bookings
        .filter(
          (b) =>
            b.driverUid === userUid &&
            (b.status === 'confirmed' || b.status === 'accepted' || b.status === 'completed')
        )
        .forEach((b) => {
          const hasExplicitTx = roleTransactions.some(
            (tx) => tx.referenceId === b.id || tx.referenceId.includes(b.id)
          );
          if (!hasExplicitTx) {
            syntheticFromBookings.push({
              id: `drv_earn_${b.id}`,
              userUid,
              userRole: 'driver',
              type: 'credit',
              category: 'driver_earning',
              amount: b.totalFare,
              title: `Captain Route Settlement (${b.fromCity} → ${b.toCity})`,
              description: `Passenger ${b.passengerName} · ${b.seatsBooked} Seat(s) (${b.departureDate})`,
              paymentMethod: 'Ride Connect Escrow Release',
              referenceId: b.id,
              status: b.status === 'completed' ? 'completed' : 'pending',
              createdAt: b.updatedAt || b.createdAt,
            });
          }
        });
    }

    return [...roleTransactions, ...syntheticFromBookings].sort(
      (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt)
    );
  }, [walletTransactions, bookings, userUid, userRole]);

  // Calculate live wallet metrics
  const walletMetrics = useMemo(() => {
    let totalCredits = 0;
    let totalDebits = 0;
    let pendingEscrow = 0;

    mergedLedger.forEach((tx) => {
      if (tx.status === 'failed') return;
      if (tx.status === 'pending') {
        pendingEscrow += tx.amount;
      }
      if (tx.type === 'credit') {
        totalCredits += tx.amount;
      } else {
        totalDebits += tx.amount;
      }
    });

    const currentBalance = Math.max(0, totalCredits - totalDebits);
    return {
      currentBalance,
      totalCredits,
      totalDebits,
      pendingEscrow,
    };
  }, [mergedLedger]);

  // Bookings eligible for manual wallet checkout (Passenger)
  const unpaidPassengerBookings = useMemo(() => {
    if (userRole !== 'passenger') return [];
    return bookings.filter(
      (b) =>
        b.passengerUid === userUid &&
        b.status !== 'rejected' &&
        b.status !== 'cancelled_by_passenger' &&
        b.status !== 'cancelled_by_driver' &&
        !walletTransactions.some((tx) => tx.referenceId === b.id && tx.category === 'ride_payment')
    );
  }, [bookings, userUid, userRole, walletTransactions]);

  const filteredTransactions = useMemo(() => {
    return mergedLedger.filter((tx) => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchDesc = tx.description.toLowerCase().includes(q);
        const matchRef = tx.referenceId.toLowerCase().includes(q);
        const matchMethod = tx.paymentMethod.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchRef && !matchMethod) return false;
      }
      return true;
    });
  }, [mergedLedger, filterType, filterCategory, searchQuery]);

  const handleWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (activeActionTab === 'pay_booking') {
      const targetBooking = bookings.find((b) => b.id === selectedBookingToPay);
      if (!targetBooking) {
        setFeedbackMsg({ type: 'error', text: 'Please select a ride booking to settle.' });
        return;
      }
      if (walletMetrics.currentBalance < targetBooking.totalFare) {
        setFeedbackMsg({
          type: 'error',
          text: `Insufficient Ride Wallet balance (Rs. ${walletMetrics.currentBalance.toLocaleString()}). Please top up at least Rs. ${(
            targetBooking.totalFare - walletMetrics.currentBalance
          ).toLocaleString()} first.`,
        });
        return;
      }

      setSubmitting(true);
      try {
        await createWalletTransaction({
          userUid,
          userRole: 'passenger',
          type: 'debit',
          category: 'ride_payment',
          amount: targetBooking.totalFare,
          title: `Online Ride Fare Settlement (${targetBooking.fromCity} → ${targetBooking.toCity})`,
          description: `Paid ${targetBooking.seatsBooked} seat(s) with Captain ${targetBooking.driverName} (${targetBooking.departureDate})`,
          paymentMethod: 'Ride Wallet Instant Balance',
          referenceId: targetBooking.id,
          status: 'completed',
        });
        setFeedbackMsg({
          type: 'success',
          text: `Rs. ${targetBooking.totalFare.toLocaleString()} settled from your Ride Wallet for ${targetBooking.fromCity} → ${targetBooking.toCity}.`,
        });
        setSelectedBookingToPay('');
      } catch (err) {
        setFeedbackMsg({
          type: 'error',
          text: err instanceof Error ? err.message : 'Payment transaction failed.',
        });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const cleanAmt = Math.round(Number(amountInput) || 0);
    if (cleanAmt < 100 || cleanAmt > 500000) {
      setFeedbackMsg({
        type: 'error',
        text: 'Please enter a valid transaction amount between Rs. 100 and Rs. 500,000.',
      });
      return;
    }

    if (activeActionTab === 'withdraw' && cleanAmt > walletMetrics.currentBalance) {
      setFeedbackMsg({
        type: 'error',
        text: `Withdrawal amount exceeds available Ride Wallet balance (Rs. ${walletMetrics.currentBalance.toLocaleString()}).`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const isTopup = activeActionTab === 'topup';
      const refCode = `${isTopup ? 'TOPUP' : 'PAYOUT'}-${Math.floor(100000 + Math.random() * 900000)}`;

      await createWalletTransaction({
        userUid,
        userRole,
        type: isTopup ? 'credit' : 'debit',
        category: isTopup ? 'topup' : 'withdrawal',
        amount: cleanAmt,
        title: isTopup
          ? `Ride Wallet Top-Up via ${paymentGateway}`
          : `Instant Payout Withdrawal to ${paymentGateway}`,
        description: isTopup
          ? `Added funds to ${userRole === 'driver' ? 'Captain' : 'Passenger'} Ride Wallet (${accountReference || 'Verified Account'})`
          : `Transferred earnings to ${paymentGateway} (${accountReference || 'Verified IBAN/Account'})`,
        paymentMethod: paymentGateway,
        referenceId: refCode,
        status: 'completed',
      });

      setFeedbackMsg({
        type: 'success',
        text: isTopup
          ? `Rs. ${cleanAmt.toLocaleString()} added to your Ride Wallet via ${paymentGateway} (Ref: ${refCode}).`
          : `Rs. ${cleanAmt.toLocaleString()} payout initiated to ${paymentGateway} (Ref: ${refCode}).`,
      });
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not process wallet transaction.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Wallet Balance & Payment Architecture Hero Card */}
      <div className="bg-slate-900 text-white rounded-xl p-6 sm:p-7 border border-slate-800 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 uppercase tracking-wider">
              <Wallet className="w-4 h-4" />
              <span>
                {userRole === 'passenger'
                  ? 'PASSENGER RIDE WALLET & ESCROW LEDGER'
                  : 'CAPTAIN EARNINGS WALLET & PAYOUT LEDGER'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
              Rs. {walletMetrics.currentBalance.toLocaleString()}
              <span className="text-xs font-mono font-normal text-slate-400 ml-2.5">
                PKR Available Balance
              </span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              {userRole === 'passenger'
                ? 'Pre-load funds for instant intercity seat reservations, automatic 48h SLA cancellation refunds, and seamless digital checkout.'
                : 'Track real-time intercity route settlements, passenger escrow releases, and withdraw earnings directly via RAAST IBFT, JazzCash, or EasyPaisa.'}
            </p>
          </div>

          <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-xs font-mono space-y-1 min-w-[220px]">
            <div className="flex items-center justify-between text-slate-400">
              <span>Account Holder</span>
              <span className="text-emerald-400 font-semibold">VERIFIED</span>
            </div>
            <div className="text-sm font-bold text-white truncate font-sans">{userName}</div>
            <div className="text-[11px] text-slate-400">
              ID: <span className="text-slate-300">{userUid.slice(0, 12)}...</span>
            </div>
          </div>
        </div>

        {/* 4 Financial Telemetry Strip Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2 font-mono tabular-nums">
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-lg p-3.5">
            <div className="text-[11px] text-slate-400 font-sans flex items-center justify-between">
              <span>Available Balance</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-white mt-1">
              Rs. {walletMetrics.currentBalance.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5 font-sans">
              Ready for instant settlement
            </div>
          </div>

          <div className="bg-slate-800/70 border border-slate-700/80 rounded-lg p-3.5">
            <div className="text-[11px] text-slate-400 font-sans flex items-center justify-between">
              <span>
                {userRole === 'passenger' ? 'Total Credits & Refunds' : 'Total Route Credits'}
              </span>
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-1">
              +Rs. {walletMetrics.totalCredits.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-sans">
              All-time incoming funds
            </div>
          </div>

          <div className="bg-slate-800/70 border border-slate-700/80 rounded-lg p-3.5">
            <div className="text-[11px] text-slate-400 font-sans flex items-center justify-between">
              <span>
                {userRole === 'passenger' ? 'Total Ride Payments' : 'Total Payout Withdrawals'}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-amber-300 mt-1">
              -Rs. {walletMetrics.totalDebits.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-sans">
              Settled debits &amp; transfers
            </div>
          </div>

          <div className="bg-slate-800/70 border border-slate-700/80 rounded-lg p-3.5">
            <div className="text-[11px] text-slate-400 font-sans flex items-center justify-between">
              <span>Active Ride Escrow</span>
              <Clock className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-lg font-bold text-sky-300 mt-1">
              Rs. {walletMetrics.pendingEscrow.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-sans">
              Released upon trip completion
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Wallet Operations & Payment Foundation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Columns: Add Funds / Withdraw / Settle Booking + Connected Payment Rails */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Online Payment &amp; Wallet Actions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instant Firestore ledger updates for digital top-ups, ride checkout, and bank payouts
                </p>
              </div>
            </div>

            {/* Action Mode Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setActiveActionTab('topup');
                  setPaymentGateway('RAAST Instant IBFT');
                  setFeedbackMsg(null);
                }}
                className={`py-2 px-2.5 rounded-md transition-colors ${
                  activeActionTab === 'topup'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Top Up Wallet
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveActionTab('withdraw');
                  setPaymentGateway('RAAST Instant IBFT (HBL / Meezan)');
                  setFeedbackMsg(null);
                }}
                className={`py-2 px-2.5 rounded-md transition-colors ${
                  activeActionTab === 'withdraw'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ↗ Withdraw Funds
              </button>

              {userRole === 'passenger' ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveActionTab('pay_booking');
                    setFeedbackMsg(null);
                  }}
                  className={`py-2 px-2.5 rounded-md transition-colors ${
                    activeActionTab === 'pay_booking'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✓ Pay Booking
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    setSubmitting(true);
                    setFeedbackMsg(null);
                    try {
                      await createWalletTransaction({
                        userUid,
                        userRole: 'driver',
                        type: 'credit',
                        category: 'promo_bonus',
                        amount: 1000,
                        title: '5-Star Punctuality Captain Bonus',
                        description: 'Zero-cancellation intercity highway reliability incentive',
                        paymentMethod: 'Ride Connect Captain Rewards',
                        referenceId: `BONUS-${Math.floor(1000 + Math.random() * 9000)}`,
                        status: 'completed',
                      });
                      setFeedbackMsg({
                        type: 'success',
                        text: 'Rs. 1,000 Captain Reliability Bonus credited to your Ride Wallet.',
                      });
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting}
                  className="py-2 px-2.5 rounded-md text-emerald-700 hover:bg-white transition-colors"
                >
                  ★ Claim Bonus
                </button>
              )}
            </div>

            <form onSubmit={handleWalletSubmit} className="space-y-4">
              {activeActionTab === 'pay_booking' && userRole === 'passenger' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Ride Booking to Pay with Ride Wallet
                    </label>
                    <select
                      value={selectedBookingToPay}
                      onChange={(e) => setSelectedBookingToPay(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      required
                    >
                      <option value="">-- Choose active booking --</option>
                      {unpaidPassengerBookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.fromCity} → {b.toCity} ({b.seatsBooked} seat · Rs.{' '}
                          {b.totalFare.toLocaleString()}) — {b.departureDate}
                        </option>
                      ))}
                    </select>
                  </div>

                  {unpaidPassengerBookings.length === 0 && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                      All your active ride bookings are already settled in your Ride Wallet ledger.
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !selectedBookingToPay}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {submitting ? 'Processing Instant Wallet Checkout...' : 'Settle Fare from Ride Wallet'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Quick Preset Amount Buttons */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {activeActionTab === 'topup'
                        ? 'Select or Enter Top-Up Amount (PKR)'
                        : 'Select or Enter Payout Amount (PKR)'}
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2.5 font-mono text-xs">
                      {[1000, 2500, 5000, 10000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmountInput(preset)}
                          className={`py-1.5 px-2 rounded-lg border font-semibold transition-colors ${
                            amountInput === preset
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Rs. {preset.toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={100}
                      max={500000}
                      step={50}
                      value={amountInput}
                      onChange={(e) => setAmountInput(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {activeActionTab === 'topup'
                        ? 'Payment Method / Digital Gateway'
                        : 'Destination Bank / Mobile Wallet'}
                    </label>
                    <select
                      value={paymentGateway}
                      onChange={(e) => setPaymentGateway(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="RAAST Instant IBFT">RAAST Instant IBFT (Zero Fee)</option>
                      <option value="Visa / Mastercard 3D-Secure">
                        Visa / Mastercard Debit &amp; Credit Card
                      </option>
                      <option value="JazzCash Mobile Wallet">JazzCash Mobile Account</option>
                      <option value="EasyPaisa Digital Wallet">EasyPaisa Digital Account</option>
                      <option value="Meezan / HBL Direct Bank Transfer">
                        Meezan / HBL Direct IBAN Transfer
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {activeActionTab === 'topup'
                        ? 'Account / Card / Mobile Reference'
                        : 'Recipient IBAN / Mobile Wallet Number'}
                    </label>
                    <input
                      type="text"
                      value={accountReference}
                      onChange={(e) => setAccountReference(e.target.value)}
                      placeholder="e.g. PK36MEZN... or 0300-1234567"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-2.5 px-4 text-white text-xs font-semibold rounded-lg transition-colors ${
                      activeActionTab === 'topup'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-slate-900 hover:bg-slate-800'
                    } disabled:opacity-50`}
                  >
                    {submitting
                      ? 'Recording Transaction on Firestore...'
                      : activeActionTab === 'topup'
                      ? `Add Rs. ${(Number(amountInput) || 0).toLocaleString()} to Ride Wallet`
                      : `Withdraw Rs. ${(Number(amountInput) || 0).toLocaleString()} to Account`}
                  </button>
                </>
              )}

              {feedbackMsg && (
                <div
                  className={`p-3 rounded-lg border text-xs font-medium ${
                    feedbackMsg.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {feedbackMsg.text}
                </div>
              )}
            </form>
          </div>

          {/* Payment Methods & Future Online Gateway Architecture Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Integrated Online Payment Rails
                </h3>
                <p className="text-xs text-slate-500">
                  Pre-configured payment channels supporting instant escrow &amp; automated refunds
                </p>
              </div>
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">RAAST / 1LINK Instant IBFT</div>
                    <div className="text-slate-500">State Bank of Pakistan instant settlement</div>
                  </div>
                </div>
                <span className="font-mono text-[11px] font-semibold text-emerald-700">
                  ACTIVE ✓
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4 text-slate-700 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">JazzCash &amp; EasyPaisa Wallets</div>
                    <div className="text-slate-500">One-tap mobile wallet checkout &amp; payouts</div>
                  </div>
                </div>
                <span className="font-mono text-[11px] font-semibold text-emerald-700">
                  ACTIVE ✓
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-slate-700 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">
                      Visa / Mastercard / Stripe Gateway
                    </div>
                    <div className="text-slate-500">3D-Secure card tokenization ready</div>
                  </div>
                </div>
                <span className="font-mono text-[11px] font-semibold text-slate-600">
                  READY
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 7 Columns: Real-Time Transaction History & Audit Ledger */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-800" />
                <h3 className="text-base font-bold text-slate-900">
                  Transaction History &amp; Settlement Ledger
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete audit trail of wallet top-ups, ride fare settlements, refunds, and captain payouts
              </p>
            </div>

            <div className="text-xs font-mono text-slate-500">
              Showing <strong className="text-slate-900">{filteredTransactions.length}</strong> of{' '}
              {mergedLedger.length} records
            </div>
          </div>

          {/* Search & Category Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search route, reference, or gateway..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'credit' | 'debit')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="all">All Directions</option>
                <option value="credit">Credits (+ Inflow)</option>
                <option value="debit">Debits (- Outflow)</option>
              </select>
            </div>

            <div className="sm:col-span-4">
              <div className="relative">
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="all">All Categories</option>
                  <option value="topup">Wallet Top-Ups</option>
                  <option value="ride_payment">Ride Fare Payments</option>
                  <option value="refund">Booking Refunds</option>
                  <option value="driver_earning">Captain Route Earnings</option>
                  <option value="withdrawal">Bank / Wallet Withdrawals</option>
                  <option value="promo_bonus">Rewards &amp; Bonuses</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transaction List */}
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 rounded-xl">
              <div className="text-sm font-semibold text-slate-900">
                No matching wallet transactions found
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Use the form on the left to add funds, settle a ride booking, or clear your search filters.
              </p>
              {(filterType !== 'all' || filterCategory !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('all');
                    setFilterCategory('all');
                    setSearchQuery('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg mt-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredTransactions.map((tx) => {
                const isCredit = tx.type === 'credit';
                return (
                  <div
                    key={tx.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 -mx-3 px-3 rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                          isCredit
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-slate-100 border-slate-200 text-slate-800'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{tx.title}</span>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {tx.category.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{tx.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                          <span>{formatTransactionDate(tx.createdAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-600">{tx.paymentMethod}</span>
                          <span aria-hidden="true">·</span>
                          <span>Ref: {tx.referenceId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:text-right font-mono tabular-nums shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-1">
                      <div
                        className={`text-sm font-bold ${
                          isCredit ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {isCredit ? '+' : '-'}Rs. {tx.amount.toLocaleString()}
                      </div>
                      <div className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold">
                        {tx.status === 'completed' ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            SETTLED
                          </span>
                        ) : tx.status === 'pending' ? (
                          <span className="text-amber-700 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            IN ESCROW
                          </span>
                        ) : (
                          <span className="text-rose-600">FAILED</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
