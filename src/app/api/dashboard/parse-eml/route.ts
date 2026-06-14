import { NextRequest, NextResponse } from 'next/server';
import { parseEml } from '@/lib/eml-parser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await (file as File).text();

    if (!text.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    const result = parseEml(text);
    return NextResponse.json({ result });
  } catch (err: unknown) {
    console.error('[parse-eml]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to parse file' },
      { status: 500 }
    );
  }
}
