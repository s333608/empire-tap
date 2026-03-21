'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

type Upgrades = { multiplier: number; auto_per_sec: number };
type UserData = { telegram_id: number; balance: number; upgrades: Upgrades; last_sync: string };
type FloatLabel = { id: number; x: number; y: number; value: number };

export default function Home() {
  const [user, setUser]                 = useState<UserData | null>(null);
  const [localBalance, setLocalBalance] = useState(0);
  const [multiplier, setMultiplier]     = useState(1);
  const [autoPerSec, setAutoPerSec]     = useState(0);
  const [energy, setEnergy]             = useState(1000);
  const [floats, setFloats]             = useState<FloatLabel[]>([]);
  const [isBooming, setIsBooming]       = useState(false);
  const [initDataRaw, setInitDataRaw]   = useState('');
  const [error, setError]               = useState('');

  const syncTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const balanceRef = useRef(0);
  const userRef    = useRef<UserData | null>(null);
  const floatId    = useRef(0);

  useEffect(() => { balanceRef.current = localBalance; }, [localBalance]);
  useEffect(() => { userRef.current = user; }, [user]);

  const sync = useCallback(async () => {
    if (!initDataRaw || !userRef.current) return;
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initDataRaw,
          balance:  Math.floor(balanceRef.current),
          upgrades: { multiplier, auto_per_sec: autoPerSec },
        }),
      });
    } catch (e) { console.error('Sync failed', e); }
  }, [initDataRaw, multiplier, autoPerSec]);

  useEffect(() => {
    function boot() {
      const tg = (window as any).Telegram?.WebApp;

      if (!tg) {
        setTimeout(boot, 500);
        return;
      }

      tg.ready();
      tg.expand();

      const raw = tg.initData || '';

      if (!raw) {
        setError('dev');
        return;
      }

      setInitDataRaw(raw);

      fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: raw }),
      })
        .then(res => res.json())
        .then(({ user: u }) => {
          if (!u) { setError('no-user'); return; }
          setUser(u);
          const offlineSec = (Date.now() - new Date(u.last_sync).getTime()) / 1000;
          const offline    = Math.floor(offlineSec * (u.upgrades?.auto_per_sec ?? 0));
          setLocalBalance(u.balance + offline);
          setMultiplier(u.upgrades?.multiplier   ?? 1);
          setAutoPerSec(u.upgrades?.auto_per_sec ?? 0);
        })
        .catch(() => setError('network'));
    }

    boot();

    syncTimer.current = setInterval(() => sync(), 30_000);
    window.addEventListener('blur', sync);
    return () => {
      syncTimer.current && clearInterval(syncTimer.current);
      window.removeEventListener('blur', sync);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoPerSec <= 0) return;
    const iv = setInterval(() => setLocalBalance(p => p + autoPerSec), 1000);
    return () => clearInterval(iv);
  }, [autoPerSec]);

  useEffect(() => {
    const iv = setInterval(() => setEnergy(e => Math.min(1000, e + 1)), 2000);
    return () => clearInterval(iv);
  }, []);

  function tap(e: React.MouseEvent<HTMLDivElement>) {
    if (energy <= 0) return;
    const earned = 1 * multiplier;
    setLocalBalance(p => p + earned);
    setEnergy(p => p - 1);
    setIsBooming(true);
    setTimeout(() => setIsBooming(false), 120);
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const id = floatId.current++;
    setFloats(f => [...f, { id, x: e.clientX - rect.left, y: e.clientY - rect.top, value: earned }]);
    setTimeout(() => setFloats(f => f.filter(l => l.id !== id)), 800);
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
  }

  async function buyBooster() {
    const res = await fetch('/api/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initDataRaw, item: 'booster' }),
    });
    const { link, error: err } = await res.json();
    if (err) { alert('Invoice error: ' + err); return; }
    (window as any).Telegram?.WebApp?.openInvoice(link);
  }

  if (error === 'dev') return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4 p-8">
      <div className="text-5xl">🛠️</div>
      <h1 className="text-2xl font-bold">Dev Mode</h1>
      <p className="text-gray-400 text-center max-w-xs">Open this in Telegram via your bot to play.</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4 p-8">
      <div className="text-5xl">⚠️</div>
      <p className="text-gray-300">Error: {error}. Please reload.</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400">Loading EmpireTap…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center p-6 select-none overflow-hidden">
      <h1 className="text-4xl font-extrabold tracking-tight mt-4 mb-1">
        Empire<span className="text-blue-400">Tap</span>
      </h1>
      <p className="text-gray-500 text-sm mb-6">@{user.telegram_id}</p>

      <div className="text-center mb-8">
        <div className="text-5xl font-mono font-bold tabular-nums">
          {Math.floor(localBalance).toLocaleString()}
        </div>
        <div className="text-gray-500 text-sm mt-1">Empires</div>
      </div>

      <div className="relative w-56 h-56">
        <div
          onClick={tap}
          className={`w-full h-full rounded-full bg-gradient-to-br from-blue-600 to-purple-700
            flex items-center justify-center text-6xl cursor-pointer shadow-2xl
            transition-transform duration-75
            ${energy <= 0 ? 'opacity-40 cursor-not-allowed' : 'active:scale-90'}
            ${isBooming ? 'scale-95' : 'scale-100'}`}
        >
          👆
        </div>
        {floats.map(f => (
          <div key={f.id} className="absolute pointer-events-none text-yellow-300 font-bold text-xl"
            style={{ left: f.x, top: f.y, transform: 'translate(-50%, -100%)', animation: 'floatUp 0.8s ease-out forwards' }}>
            +{f.value}
          </div>
        ))}
      </div>

      <div className="w-full max-w-xs mt-8">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>⚡ Energy</span><span>{energy} / 1000</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3">
          <div className="bg-blue-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${(energy / 1000) * 100}%` }} />
        </div>
      </div>

      <div className="mt-6 flex gap-6 text-center text-sm text-gray-400">
        <div><div className="text-white font-bold text-lg">{multiplier}x</div><div>Multiplier</div></div>
        <div><div className="text-white font-bold text-lg">{autoPerSec}/s</div><div>Auto-earn</div></div>
      </div>

      <div className="mt-10 w-full max-w-xs">
        <p className="text-gray-500 text-xs uppercase tracking-widest mb-3 text-center">Shop</p>
        <button onClick={buyBooster}
          className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-lg py-4 rounded-2xl transition-colors">
          ⭐ ×2 Booster — 5 Stars
        </button>
        <p className="text-gray-600 text-xs text-center mt-2">Doubles earnings for 1 hour</p>
      </div>

      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translate(-50%, -100%) translateY(0); }
          100% { opacity: 0; transform: translate(-50%, -100%) translateY(-60px); }
        }
      `}</style>
    </div>
  );
}