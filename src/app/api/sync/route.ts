import { NextResponse } from 'next/server';
import { validateInitData, parseUserFromInitData } from '@/lib/telegram';
import { createServerSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { initData, balance, upgrades } = await request.json();

    if (!validateInitData(initData)) {
      return NextResponse.json({ error: 'Invalid auth' }, { status: 403 });
    }

    const supabase = createServerSupabase();
    const userId = parseUserFromInitData(initData)?.id;

    if (!userId) {
      return NextResponse.json({ error: 'No user ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('users')
      .update({
        balance: Math.floor(balance),
        upgrades,
        last_sync: new Date().toISOString(),
      })
      .eq('telegram_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}