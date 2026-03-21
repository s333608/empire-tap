import { NextResponse } from 'next/server';
import { validateInitData, parseUserFromInitData } from '@/lib/telegram';
import { createServerSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { initData } = await request.json();

    if (!validateInitData(initData)) {
      return NextResponse.json({ error: 'Invalid auth' }, { status: 403 });
    }

    const user = parseUserFromInitData(initData);
    if (!user?.id) {
      return NextResponse.json({ error: 'No user' }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('users')
      .upsert(
        { telegram_id: user.id, username: user.username || user.first_name },
        { onConflict: 'telegram_id' }
      )
      .select('telegram_id, balance, upgrades, last_sync, referred_by')
      .single();

    if (error) throw error;

    return NextResponse.json({ user: data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}