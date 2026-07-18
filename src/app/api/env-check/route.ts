import { NextResponse } from 'next/server';

export async function GET() {
  const envKeys = Object.keys(process.env).sort();
  const relevant = envKeys.filter(k => 
    !k.startsWith('npm_') && 
    !k.startsWith('PATH') && 
    !k.startsWith('NODE_') &&
    k !== '_' &&
    !k.startsWith('_')
  );
  const result: Record<string, string | undefined> = {};
  for (const k of relevant) {
    const v = process.env[k];
    if (v && v.length > 200) {
      result[k] = v.substring(0, 100) + '...[TRUNCATED]...' + v.substring(v.length - 50);
    } else {
      result[k] = v;
    }
  }
  return NextResponse.json(result);
}
