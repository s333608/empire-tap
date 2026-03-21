import { NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body?.successful_payment) {
      const payload = JSON.parse(body.successful_payment.invoice_payload || '{}');
      const userId = payload.userId;
      const item = payload.item;

      if (!userId || !item) {
        return new Response('Missing payload data', { status: 400 });
      }

      if (item === 'booster') {
        const supabase = createServerSupabase();

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

    return new Response('OK', { status: 200 });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return new Response('Error', { status: 500 });
  }
}
```

Now push everything:
```
git add .
git commit -m "fix all typescript errors"
git push