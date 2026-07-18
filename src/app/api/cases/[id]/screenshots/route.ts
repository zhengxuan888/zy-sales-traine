import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

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

// GET /api/cases/[id]/screenshots - 获取案例截图的签名URL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const s3 = getStorage();

    // Get case from database to retrieve screenshot keys
    const { getClient } = await import('@/lib/db');
    const client = getClient();
    const { data: caseData, error } = await client
      .from('cases')
      .select('screenshots, conversation_data')
      .eq('id', id)
      .single();

    if (error || !caseData) {
      return NextResponse.json(
        { success: false, error: '案例不存在' },
        { status: 404 }
      );
    }

    // Get screenshot keys from either screenshots field or conversation_data
    let screenshotKeys: string[] = [];
    if (caseData.screenshots && Array.isArray(caseData.screenshots)) {
      screenshotKeys = caseData.screenshots;
    } else if (caseData.conversation_data?.screenshots) {
      screenshotKeys = caseData.conversation_data.screenshots;
    }

    // Generate presigned URLs for each screenshot
    const urls: string[] = [];
    for (const key of screenshotKeys) {
      try {
        const url = await s3.generatePresignedUrl({
          key,
          expireTime: 3600, // 1 hour
        });
        urls.push(url);
      } catch (e) {
        console.error('Failed to generate presigned URL for key:', key, e);
      }
    }

    return NextResponse.json({
      success: true,
      data: { urls },
    });
  } catch (error) {
    console.error('Get screenshots error:', error);
    return NextResponse.json(
      { success: false, error: '获取截图失败' },
      { status: 500 }
    );
  }
}
