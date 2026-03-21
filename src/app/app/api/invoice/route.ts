import { NextResponse } from 'next/server';
import { parseUserFromInitData } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const { initData, item } = await request.json();
    const user = parseUserFromInitData(initData);

    if (!user?.id) {
      return NextResponse.json({ error: 'No user' }, { status: 400 });
    }

    const payload = JSON.stringify({ item, userId: user.id });

    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/createInvoiceLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '×2 Booster (1 hour)',
          description: 'Double your earnings for 60 minutes',
          payload,
          provider_token: '',
          currency: 'XTR',
          prices: [{ label: 'Booster', amount: 500 }], // 5 Stars
        }),
      }
    );

    const result = await response.json();
    if (!result.ok) throw new Error(result.description || 'Invoice failed');

    return NextResponse.json({ link: result.result });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}