import { isValid } from '@tma.js/init-data-node';

export function validateInitData(initDataRaw: string): boolean {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  try {
    return isValid(initDataRaw, token, { expiresIn: 3600 });
  } catch {
    return false;
  }
}

export function parseUserFromInitData(initDataRaw: string) {
  const params = new URLSearchParams(initDataRaw);
  const userStr = params.get('user');
  return userStr ? JSON.parse(userStr) : null;
}