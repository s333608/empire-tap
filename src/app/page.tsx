'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

type Upgrades = { multiplier: number; auto_per_sec: number };
type Buildings = { mine: number; blacksmith: number; castle: number };
type Quests = { tap_today: number; earn_today: number; upgrade_today: number; last_reset: string | null };
type UserData = {
  telegram_id: number;
  balance: number;
  upgrades: Upgrades;
  buildings: Buildings;
  quests: Quests;
  xp: number;
  level: number;
  last_sync: string;
};
type FloatLabel = { id: number; x: number; y: number; value: number };

const BUILDING_CONFIG = {
  mine:       { label: '⛏️ Mine',       desc: '+1 Empire/sec',  baseCost: 500,   autoIncome: 1  },
  blacksmith: { label: '🔨 Blacksmith', desc: '+3 Empires/sec', baseCost: 2000,  autoIncome: 3  },
  castle:     { label: '🏰 Castle',     desc: '+10 Empires/sec',baseCost: 10000, autoIncome: 10 },
};

const HERO_TITLES = [
  { min: 1,  title: 'Peasant',   emoji: '🧑‍🌾' },
  { min: 5,  title: 'Squire',    emoji: '🗡️'  },
  { min: 10, title: 'Knight',    emoji: '⚔️'  },
  { min: 20, title: 'Lord',      emoji: '👑'  },
  { min: 35, title: 'Duke',      emoji: '🏰'  },
  { min: 50, title: 'King',      emoji: '👑🏆' },
];

function getHero(level: number) {
  return [...HERO_TITLES].reverse().find(h => level >= h.min) || HERO_TITLES[0];
}

function getBuildingCost(type: keyof Buildings, currentLevel: number): number {
  return Math.floor(BUILDING_CONFIG[type].baseCost * Math.pow(1.5, currentLevel));
}

function calcAutoPerSec(buildings: Buildings): number {
  return (
    buildings.mine       * BUILDING_CONFIG.mine.autoIncome +
    buildings.blacksmith * BUILDING_CONFIG.blacksmith.autoIncome +
    buildings.castle     * BUILDING_CONFIG.castle.autoIncome
  );
}

function calcLevel(xp: number): number {
  return Math.floor(Math.pow(xp / 100, 0.6)) + 1;
}

function xpForNextLevel(level: number): number {
  return Math.floor(Math.pow(level, 1 / 0.6) * 100);
}

type Tab = 'game' | 'buildings' | 'quests';

export default function Home() {
  const [user, setUser]                 = useState<UserData | null>(null);
  const [localBalance, setLocalBalance] = useState(0);
  const [xp, setXp]                     = useState(0);
  const [level, setLevel]               = useState(1);
  const [buildings, setBuildings]       = useState<Buildings>({ mine: 0, blacksmith: 0, castle: 0 });
  const [quests, setQuests]             = useState<Quests>({ tap_today: 0, earn_today: 0, upgrade_today: 0, last_reset: null });
  const [energy, setEnergy]             = useState(1000);
  const [floats, setFloats]             = useState<FloatLabel[]>([]);
  const [isBooming, setIsBooming]       = useState(false);
  const [initDataRaw, setInitDataRaw]   = useState('');
  const [error, setError]               = useState('');
  const [tab, setTab]                   = useState<Tab>('game');
  const [levelUpMsg, setLevelUpMsg]     = useState('');

  const syncTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const balanceRef = useRef(0);
  const userRef    = useRef<UserData | null>(null);
  const floatId    = useRef(0);
  const prevLevel  = useRef(1);

  useEffect(() => { balanceRef.current = localBalance; }, [localBalance]);
  useEffect(() => { userRef.current = user; }, [user]);

  const autoPerSec = calcAutoPerSec(buildings);
  const multiplier = 1;

  const sync = useCallback(async () => {
    if (!initDataRaw || !userRef.current) return;
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initDataRaw,
          balance:  Math.floor(balanceRef.current),
          upgrades: { multiplier: 1, auto_per_sec: calcAutoPerSec(buildings) },
          buildings,
          quests,
          xp,
        }),
      });
    } catch (e) { console.error('Sync failed', e); }
  }, [initDataRaw, buildings, quests, xp]);

  useEffect(() => {
    function boot() {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg) { setTimeout(boot, 500); return; }

      tg.ready();
      tg.expand();

      const raw = tg.initData || '';
      if (!raw) { setError('dev'); return; }

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

          const b = u.buildings || { mine: 0, blacksmith: 0, castle: 0 };
          const autos = calcAutoPerSec(b);
          const offlineSec = (Date.now() - new Date(u.last_sync).getTime()) / 1000;
          const offline = Math.floor(offlineSec * autos);

          setLocalBalance(u.balance + offline);
          setBuildings(b);
          setXp(u.xp || 0);
          setLevel(u.level || 1);
          prevLevel.current = u.level || 1;
          setQuests(u.quests || { tap_today: 0, earn_today: 0, upgrade_today: 0, last_reset: null });
          setEnergy(1000);
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

  // Auto earn
  useEffect(() => {
    if (autoPerSec <= 0) return;
    const iv = setInterval(() => {
      setLocalBalance(p => p + autoPerSec);
      setXp(p => {
        const newXp = p + 1;
        const newLevel = calcLevel(newXp);
        if (newLevel > prevLevel.current) {
          prevLevel.current = newLevel;
          setLevel(newLevel);
          const hero = getHero(newLevel);
          setLevelUpMsg(`🎉 Level ${newLevel} — ${hero.title}!`);
          setTimeout(() => setLevelUpMsg(''), 3000);
        }
        return newXp;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [autoPerSec]);

  // Energy regen
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

    // XP + level check
    setXp(p => {
      const newXp = p + 1;
      const newLevel = calcLevel(newXp);
      if (newLevel > prevLevel.current) {
        prevLevel.current = newLevel;
        setLevel(newLevel);
        const hero = getHero(newLevel);
        setLevelUpMsg(`🎉 Level ${newLevel} — ${hero.title}!`);
        setTimeout(() => setLevelUpMsg(''), 3000);
      }
      return newXp;
    });

    // Quest progress
    setQuests(q => ({ ...q, tap_today: q.tap_today + 1, earn_today: q.earn_today + earned }));

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const id = floatId.current++;
    setFloats(f => [...f, { id, x: e.clientX - rect.left, y: e.clientY - rect.top, value: earned }]);
    setTimeout(() => setFloats(f => f.filter(l => l.id !== id)), 800);
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
  }

  function buyBuilding(type: keyof Buildings) {
    const cost = getBuildingCost(type, buildings[type]);
    if (localBalance < cost) return;
    setLocalBalance(p => p - cost);
    setBuildings(b => ({ ...b, [type]: b[type] + 1 }));
    setQuests(q => ({ ...q, upgrade_today: q.upgrade_today + 1 }));
    setXp(p => p + 50);
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
      <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-yellow-200">Loading your Kingdom…</p>
    </div>
  );

  const hero = getHero(level);
  const nextLevelXp = xpForNextLevel(level);
  const xpProgress = Math.min((xp / nextLevelXp) * 100, 100);

  const QUESTS = [
    { label: '⚔️ Tap 500 times',      current: quests.tap_today,     target: 500,   reward: 1000 },
    { label: '💰 Earn 10,000 Empires', current: quests.earn_today,    target: 10000, reward: 2000 },
    { label: '🏗️ Upgrade a building',  current: quests.upgrade_today, target: 1,     reward: 500  },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col">

      {/* Level up notification */}
      {levelUpMsg && (
        <div className="fixed top-4 left-0 right-0 flex justify-center z-50">
          <div className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-2xl shadow-2xl text-lg animate-bounce">
            {levelUpMsg}
          </div>
        </div>
      )}

      {/* Hero header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="text-3xl">{hero.emoji}</div>
          <div>
            <div className="font-bold text-sm">{hero.title}</div>
            <div className="text-xs text-gray-400">Level {level}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-yellow-400 font-bold text-lg">{Math.floor(localBalance).toLocaleString()}</div>
          <div className="text-xs text-gray-400">Empires</div>
        </div>
      </div>

      {/* XP bar */}
      <div className="px-4 mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>XP {xp.toLocaleString()}</span>
          <span>Next level: {nextLevelXp.toLocaleString()}</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div className="bg-yellow-400 h-2 rounded-full transition-all duration-500"
            style={{ width: `${xpProgress}%` }} />
        </div>
      </div>

      {/* Auto earn rate */}
      <div className="text-center text-xs text-gray-500 mb-2">
        ⚡ {autoPerSec}/sec auto-earn
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 mx-4">
        {(['game', 'buildings', 'quests'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-bold capitalize transition-colors
              ${tab === t ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'}`}>
            {t === 'game' ? '⚔️ Kingdom' : t === 'buildings' ? '🏗️ Build' : '📜 Quests'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* GAME TAB */}
        {tab === 'game' && (
          <div className="flex flex-col items-center p-6">
            <div className="relative w-52 h-52 mb-6">
              <div onClick={tap}
                className={`w-full h-full rounded-full flex items-center justify-center text-7xl
                  cursor-pointer shadow-2xl transition-transform duration-75 select-none
                  bg-gradient-to-br from-yellow-600 via-yellow-500 to-orange-600
                  ${energy <= 0 ? 'opacity-40' : 'active:scale-90'}
                  ${isBooming ? 'scale-95' : 'scale-100'}`}>
                🏰
              </div>
              {floats.map(f => (
                <div key={f.id} className="absolute pointer-events-none text-yellow-300 font-bold text-xl"
                  style={{ left: f.x, top: f.y, transform: 'translate(-50%,-100%)', animation: 'floatUp 0.8s ease-out forwards' }}>
                  +{f.value}
                </div>
              ))}
            </div>

            {/* Energy */}
            <div className="w-full max-w-xs mb-6">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>⚡ Energy</span><span>{energy}/1000</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(energy / 1000) * 100}%` }} />
              </div>
            </div>

            {/* Shop */}
            <button onClick={buyBooster}
              className="w-full max-w-xs bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-lg py-4 rounded-2xl">
              ⭐ ×2 Booster — 5 Stars
            </button>
          </div>
        )}

        {/* BUILDINGS TAB */}
        {tab === 'buildings' && (
          <div className="p-4 flex flex-col gap-3">
            {(Object.keys(BUILDING_CONFIG) as (keyof Buildings)[]).map(type => {
              const cfg  = BUILDING_CONFIG[type];
              const lvl  = buildings[type];
              const cost = getBuildingCost(type, lvl);
              const canAfford = localBalance >= cost;
              return (
                <div key={type} className="bg-gray-800 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold">{cfg.label} <span className="text-yellow-400">Lv{lvl}</span></div>
                    <div className="text-xs text-gray-400">{cfg.desc}</div>
                    <div className="text-xs text-yellow-300 mt-1">Cost: {cost.toLocaleString()} Empires</div>
                  </div>
                  <button onClick={() => buyBuilding(type)}
                    disabled={!canAfford}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors
                      ${canAfford ? 'bg-yellow-400 text-black hover:bg-yellow-300' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                    {canAfford ? 'Build' : '🔒'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* QUESTS TAB */}
        {tab === 'quests' && (
          <div className="p-4 flex flex-col gap-3">
            <p className="text-xs text-gray-500 text-center mb-2">Daily quests reset every 24 hours</p>
            {QUESTS.map((q, i) => {
              const done = q.current >= q.target;
              const pct  = Math.min((q.current / q.target) * 100, 100);
              return (
                <div key={i} className={`rounded-2xl p-4 ${done ? 'bg-green-900' : 'bg-gray-800'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-sm">{q.label}</div>
                    {done && <span className="text-green-400 text-xs font-bold">✅ Done!</span>}
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                    <div className={`h-2 rounded-full transition-all ${done ? 'bg-green-400' : 'bg-yellow-400'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{Math.min(q.current, q.target).toLocaleString()} / {q.target.toLocaleString()}</span>
                    <span>🎁 {q.reward.toLocaleString()} Empires</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translate(-50%,-100%) translateY(0); }
          100% { opacity: 0; transform: translate(-50%,-100%) translateY(-60px); }
        }
      `}</style>
    </div>
  );
}