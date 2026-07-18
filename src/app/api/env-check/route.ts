import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    url: process.env.COZE_SUPABASE_URL,
    anonKey: process.env.COZE_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.COZE_SUPABASE_SERVICE_ROLE_KEY,
    bucketEndpoint: process.env.COZE_BUCKET_ENDPOINT_URL,
    bucketName: process.env.COZE_BUCKET_NAME,
  });
}
