import { NextResponse, NextRequest } from 'next/server';
import { validateInitData, parseUserFromInitData } from '@/lib/telegram';
import { createServerSupabase } from '@/lib/supabase';

function calculateLevel(xp: number): number {
  return Math.floor(Math.pow(xp / 100, 0.6)) + 1;
}

export async function POST(request: NextRequest) {
  try {
    const { initData, balance, upgrades, buildings, quests, xp } = await request.json();

    if (!validateInitData(initData)) {
      return NextResponse.json({ error: 'Invalid auth' }, { status: 403 });
    }

    const supabase = createServerSupabase();
    const userId = parseUserFromInitData(initData)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'No user ID' }, { status: 400 });
    }

    const level = calculateLevel(xp || 0);

    const { error } = await supabase
      .from('users')
      .update({
        balance: Math.floor(balance),
        upgrades,
        buildings: buildings || { mine: 0, blacksmith: 0, castle: 0 },
        quests: quests || {},
        xp: xp || 0,
        level,
        last_sync: new Date().toISOString(),
      })
      .eq('telegram_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true, level });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}