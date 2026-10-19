import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Booking, Ride, ChatMessage } from '../types';
import { sendChatMessage, markChatMessagesAsRead } from '../services/firestoreService';
import {
  MessageSquare,
  Send,
  MapPin,
  Clock,
  CheckCheck,
  Sparkles,
  User,
} from 'lucide-react';

interface RideChatPanelProps {
  currentUserUid: string;
  currentUserName: string;
  currentUserRole: 'passenger' | 'driver';
  bookings: Booking[];
  rides: Ride[];
  messages: ChatMessage[];
  initialSelectedBookingId?: string | null;
}

interface ConversationThread {
  threadKey: string;
  rideId: string;
  bookingId: string;
  fromCity: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  pickupLocation: string;
  passengerUid: string;
  passengerName: string;
  driverUid: string;
  driverName: string;
  bookingStatus: string;
  unreadCount: number;
  lastMessageText: string;
  lastMessageTimeMs: number;
}

function getTimestampMs(val: unknown): number {
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

function formatMessageTime(val: unknown): string {
  const ms = getTimestampMs(val);
  if (!ms) return 'Just now';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function RideChatPanel({
  currentUserUid,
  currentUserName,
  currentUserRole,
  bookings,
  rides,
  messages,
  initialSelectedBookingId,
}: RideChatPanelProps) {
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Build active conversation threads from bookings and existing messages
  const threads = useMemo<ConversationThread[]>(() => {
    const map = new Map<string, ConversationThread>();

    // 1. Add threads from bookings involving current user
    bookings.forEach((b) => {
      if (currentUserRole === 'passenger' && b.passengerUid !== currentUserUid) return;
      if (currentUserRole === 'driver' && b.driverUid !== currentUserUid) return;

      const key = `${b.rideId}_${b.passengerUid}_${b.driverUid}`;
      const rideObj = rides.find((r) => r.id === b.rideId);
      const threadMsgs = messages.filter(
        (m) =>
          m.rideId === b.rideId &&
          m.passengerUid === b.passengerUid &&
          m.driverUid === b.driverUid
      );
      const sortedMsgs = threadMsgs
        .slice()
        .sort((x, y) => getTimestampMs(x.createdAt) - getTimestampMs(y.createdAt));
      const lastMsg = sortedMsgs[sortedMsgs.length - 1];
      const unreadCount = threadMsgs.filter(
        (m) => !m.read && m.senderUid !== currentUserUid
      ).length;

      map.set(key, {
        threadKey: key,
        rideId: b.rideId,
        bookingId: b.id,
        fromCity: b.fromCity,
        toCity: b.toCity,
        departureDate: b.departureDate,
        departureTime: b.departureTime,
        pickupLocation: rideObj?.pickupLocation || `${b.fromCity} Intercity Terminal`,
        passengerUid: b.passengerUid,
        passengerName: b.passengerName,
        driverUid: b.driverUid,
        driverName: b.driverName,
        bookingStatus: b.status,
        unreadCount,
        lastMessageText: lastMsg
          ? lastMsg.text
          : `Coordinate pickup for ${b.fromCity} → ${b.toCity}`,
        lastMessageTimeMs: lastMsg
          ? getTimestampMs(lastMsg.createdAt)
          : getTimestampMs(b.createdAt) || Date.now(),
      });
    });

    // 2. Also include any pre-booking ride inquiries from messages
    messages.forEach((m) => {
      if (m.passengerUid !== currentUserUid && m.driverUid !== currentUserUid) return;
      const key = `${m.rideId}_${m.passengerUid}_${m.driverUid}`;
      if (map.has(key)) return;

      const rideObj = rides.find((r) => r.id === m.rideId);
      const threadMsgs = messages.filter(
        (msg) =>
          msg.rideId === m.rideId &&
          msg.passengerUid === m.passengerUid &&
          msg.driverUid === m.driverUid
      );
      const sortedMsgs = threadMsgs
        .slice()
        .sort((x, y) => getTimestampMs(x.createdAt) - getTimestampMs(y.createdAt));
      const lastMsg = sortedMsgs[sortedMsgs.length - 1];
      const unreadCount = threadMsgs.filter(
        (msg) => !msg.read && msg.senderUid !== currentUserUid
      ).length;

      map.set(key, {
        threadKey: key,
        rideId: m.rideId,
        bookingId: m.bookingId || '',
        fromCity: m.fromCity,
        toCity: m.toCity,
        departureDate: rideObj?.departureDate || 'Upcoming',
        departureTime: rideObj?.departureTime || '10:00 AM',
        pickupLocation: rideObj?.pickupLocation || `${m.fromCity} Pickup Point`,
        passengerUid: m.passengerUid,
        passengerName: m.passengerName,
        driverUid: m.driverUid,
        driverName: m.driverName,
        bookingStatus: 'inquiry',
        unreadCount,
        lastMessageText: lastMsg ? lastMsg.text : '',
        lastMessageTimeMs: lastMsg ? getTimestampMs(lastMsg.createdAt) : Date.now(),
      });
    });

    // 3. If a passenger has no bookings or messages yet, provide available upcoming rides so they can message any Captain immediately
    if (map.size === 0 && currentUserRole === 'passenger') {
      rides
        .filter((r) => r.status === 'upcoming' || r.status === 'active')
        .slice(0, 4)
        .forEach((r) => {
          const key = `${r.id}_${currentUserUid}_${r.driverUid}`;
          map.set(key, {
            threadKey: key,
            rideId: r.id,
            bookingId: '',
            fromCity: r.fromCity,
            toCity: r.toCity,
            departureDate: r.departureDate,
            departureTime: r.departureTime,
            pickupLocation: r.pickupLocation,
            passengerUid: currentUserUid,
            passengerName: currentUserName,
            driverUid: r.driverUid,
            driverName: r.driverName,
            bookingStatus: 'pre-booking inquiry',
            unreadCount: 0,
            lastMessageText: `Ask Captain ${r.driverName} about pickup or luggage`,
            lastMessageTimeMs: 0,
          });
        });
    }

    return Array.from(map.values()).sort((a, b) => b.lastMessageTimeMs - a.lastMessageTimeMs);
  }, [bookings, rides, messages, currentUserUid, currentUserName, currentUserRole]);

  // Select initial thread when requested via "Message Captain" / "Message Passenger" button
  useEffect(() => {
    if (initialSelectedBookingId) {
      const matched = threads.find(
        (t) => t.bookingId === initialSelectedBookingId || t.rideId === initialSelectedBookingId
      );
      if (matched) {
        setSelectedThreadKey(matched.threadKey);
        return;
      }
    }
    if (!selectedThreadKey && threads.length > 0) {
      setSelectedThreadKey(threads[0].threadKey);
    }
  }, [initialSelectedBookingId, threads, selectedThreadKey]);

  const activeThread = useMemo(() => {
    if (!selectedThreadKey) return threads[0] || null;
    return threads.find((t) => t.threadKey === selectedThreadKey) || threads[0] || null;
  }, [threads, selectedThreadKey]);

  const activeThreadMessages = useMemo(() => {
    if (!activeThread) return [];
    return messages
      .filter(
        (m) =>
          m.rideId === activeThread.rideId &&
          m.passengerUid === activeThread.passengerUid &&
          m.driverUid === activeThread.driverUid
      )
      .slice()
      .sort((a, b) => getTimestampMs(a.createdAt) - getTimestampMs(b.createdAt));
  }, [messages, activeThread]);

  // Automatically mark unread messages in the active conversation as read
  useEffect(() => {
    if (!activeThread || activeThreadMessages.length === 0) return;
    const unreadInThread = activeThreadMessages.filter(
      (m) => !m.read && m.senderUid !== currentUserUid
    );
    if (unreadInThread.length > 0) {
      markChatMessagesAsRead(unreadInThread, currentUserUid);
    }
  }, [activeThread, activeThreadMessages, currentUserUid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadMessages.length]);

  const handleSend = async (customText?: string) => {
    if (!activeThread) return;
    const textToSend = (customText !== undefined ? customText : draftText).trim();
    if (!textToSend) return;

    setSending(true);
    if (customText === undefined) setDraftText('');

    try {
      await sendChatMessage({
        rideId: activeThread.rideId,
        bookingId: activeThread.bookingId,
        fromCity: activeThread.fromCity,
        toCity: activeThread.toCity,
        passengerUid: activeThread.passengerUid,
        passengerName: activeThread.passengerName,
        driverUid: activeThread.driverUid,
        driverName: activeThread.driverName,
        senderUid: currentUserUid,
        senderName: currentUserName,
        senderRole: currentUserRole,
        text: textToSend,
      });
    } finally {
      setSending(false);
    }
  };

  const quickCoordinationPresets =
    currentUserRole === 'passenger'
      ? [
          "Hi Captain, I'm at the pickup point ready for departure.",
          'Could you confirm the exact pickup landmark and luggage space?',
          'I will arrive at the pickup terminal 10 minutes before departure.',
          'Please share live GPS once you start heading to the pickup point.',
        ]
      : [
          'Hello! Your seat is confirmed. I will arrive at the pickup point on time.',
          'I am 10 minutes away from the pickup terminal. Please be ready.',
          'Live GPS location sharing is now active on your portal.',
          'We are departing shortly from the motorway toll plaza.',
        ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">
              Real-Time Ride Coordination & Pickup Messenger
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct Firestore real-time messaging (`onSnapshot`) between Passengers and Captains to coordinate pickup landmarks, ETA updates, and luggage details.
          </p>
        </div>
        <span className="text-xs font-mono text-emerald-700 font-semibold">
          ● Live Firestore Stream Active
        </span>
      </div>

      {threads.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <MessageSquare className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-sm font-bold text-slate-900">
            No Active Ride Conversations Yet
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {currentUserRole === 'passenger'
              ? 'Book a seat or select an upcoming ride to start coordinating pickup details with your Captain in real time.'
              : 'Once a passenger requests or books a seat on your published rides, their real-time conversation thread will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
          {/* Left Column: Conversation Threads */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/50 divide-y divide-slate-200 max-h-[540px] overflow-y-auto">
            {threads.map((thread) => {
              const isSelected = activeThread?.threadKey === thread.threadKey;
              const counterpartLabel =
                currentUserRole === 'passenger'
                  ? `Captain ${thread.driverName}`
                  : `Passenger ${thread.passengerName}`;

              return (
                <button
                  key={thread.threadKey}
                  type="button"
                  onClick={() => setSelectedThreadKey(thread.threadKey)}
                  className={`w-full text-left p-4 transition-colors space-y-1.5 ${
                    isSelected
                      ? 'bg-white border-l-4 border-l-emerald-600'
                      : 'hover:bg-white/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {counterpartLabel}
                    </span>
                    {thread.unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-600 text-white rounded-full">
                        {thread.unreadCount} new
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-emerald-700">
                    {thread.fromCity} → {thread.toCity}
                  </div>

                  <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                    <span>{thread.departureDate}</span>
                    <span>·</span>
                    <span>{thread.departureTime}</span>
                  </div>

                  <p className="text-xs text-slate-500 truncate pt-0.5">
                    {thread.lastMessageText}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Right Column: Active Real-Time Chat Stream */}
          <div className="lg:col-span-8 flex flex-col justify-between bg-white">
            {activeThread && (
              <>
                {/* Active Thread Subheader */}
                <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-bold text-slate-900">
                        {currentUserRole === 'passenger'
                          ? `Captain ${activeThread.driverName}`
                          : `Passenger ${activeThread.passengerName}`}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-xs font-semibold text-emerald-700">
                        {activeThread.fromCity} → {activeThread.toCity}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                      <span className="inline-flex items-center gap-1 font-sans">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>Pickup: {activeThread.pickupLocation}</span>
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {activeThread.departureDate} | {activeThread.departureTime}
                        </span>
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono uppercase font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                    {activeThread.bookingStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Messages Feed */}
                <div className="p-5 space-y-3 overflow-y-auto max-h-[340px] min-h-[280px] bg-slate-50/40">
                  {activeThreadMessages.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="text-xs font-semibold text-slate-700">
                        Start Coordinating Your Pickup &amp; Ride Details
                      </div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Send a message below or use a 1-click coordination preset to confirm exact pickup timing and landmark details.
                      </p>
                    </div>
                  ) : (
                    activeThreadMessages.map((msg) => {
                      const isMine = msg.senderUid === currentUserUid;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isMine ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-xl px-4 py-2.5 text-xs space-y-1 ${
                              isMine
                                ? 'bg-slate-900 text-white'
                                : 'bg-white border border-slate-200 text-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 font-mono">
                              <span>
                                {msg.senderName} ({msg.senderRole.toUpperCase()})
                              </span>
                              <span>{formatMessageTime(msg.createdAt)}</span>
                            </div>
                            <p className="leading-relaxed text-xs break-words">{msg.text}</p>
                            {isMine && (
                              <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-400 font-mono">
                                <CheckCheck className="w-3 h-3" />
                                <span>{msg.read ? 'Read' : 'Delivered'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Coordination Presets + Message Composer */}
                <div className="p-4 border-t border-slate-200 bg-white space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 mr-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>Quick Pickup Notes:</span>
                    </span>
                    {quickCoordinationPresets.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={sending}
                        onClick={() => handleSend(preset)}
                        className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors text-left truncate max-w-[260px]"
                        title={preset}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      maxLength={500}
                      placeholder={
                        currentUserRole === 'passenger'
                          ? `Message Captain ${activeThread.driverName} about pickup or ETA...`
                          : `Message Passenger ${activeThread.passengerName} about pickup or ride status...`
                      }
                      className="flex-1 px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={!draftText.trim() || sending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sending ? 'Sending...' : 'Send Message'}</span>
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
