import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getClient } from '@/lib/db';

let storage: S3Storage | null = null;

function getStorage() {
  if (!storage) {
    storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }
  return storage;
}

// POST /api/cases/upload - 上传案例截图
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const result = formData.get('result') as string; // 'success' | 'failure'
    const buyerType = formData.get('buyerType') as string;
    const tags = formData.get('tags') ? JSON.parse(formData.get('tags') as string) : [];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: '请上传至少一张截图' },
        { status: 400 }
      );
    }

    const s3 = getStorage();
    const screenshotKeys: string[] = [];

    // Upload each file to object storage
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const key = await s3.uploadFile({
        fileContent: buffer,
        fileName: `cases/${Date.now()}_${file.name}`,
        contentType: file.type,
      });
      screenshotKeys.push(key);
    }

    // Save case to database
    const client = getClient();
    const { data: newCase, error } = await client
      .from('cases')
      .insert({
        title: title || '未命名案例',
        description: description || '',
        source: 'user',
        product_type: '',
        difficulty: result === 'success' ? 2 : 3,
        tags: [...tags, result === 'success' ? '成功案例' : '失败案例'],
        conversation_data: { screenshots: screenshotKeys },
        screenshots: screenshotKeys,
        key_moments: [],
        best_responses: [],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        id: newCase.id,
        title: newCase.title,
        screenshotCount: screenshotKeys.length,
        screenshots: screenshotKeys,
      },
    });
  } catch (error) {
    console.error('Upload case error:', error);
    return NextResponse.json(
      { success: false, error: '上传失败' },
      { status: 500 }
    );
  }
}
