import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Telegram sends successful_payment when Stars payment completes
    if (body?.successful_payment) {
      const payload = JSON.parse(body.successful_payment.invoice_payload || '{}');
      const userId = payload.userId;
      const item = payload.item;

      if (!userId || !item) {
        return new Response('Missing payload data', { status: 400 });
      }

      if (item === 'booster') {
        const supabase = createServerSupabase();

        // Give ×2 multiplier (you can add expiration logic later)
        const { error } = await supabase
          .from('users')
          .update({
            upgrades: { multiplier: 2, auto_per_sec: 0 }
          })
          .eq('telegram_id', userId);

        if (error) throw error;

        console.log(`Booster granted to user ${userId}`);
      }
    }

    // Telegram requires 200 OK response for webhook
    return new Response('OK', { status: 200 });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return new Response('Error', { status: 500 });
  }
}