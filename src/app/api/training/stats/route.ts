import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/training/stats
 * Returns aggregate training statistics for the admin dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authUser = await getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    const userId = authUser.role === 'admin' && searchParams.get('userId') ? searchParams.get('userId') : authUser.id;
    const client = getClient();

    // Clean up stale active sessions (>30 min)
    try {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      await client
        .from('training_history')
        .update({ status: 'completed' })
        .eq('status', 'active')
        .lt('started_at', thirtyMinAgo);
    } catch (cleanupErr) {
      console.warn('[Stats] Cleanup failed:', cleanupErr);
    }

    // Build base query
    let query = client.from('training_history').select('*');
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: allSessions, error } = await query.order('started_at', { ascending: false });

    if (error) {
      console.error('[Stats] DB error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch stats' },
        { status: 500 }
      );
    }

    const sessions = allSessions || [];
    const completed = sessions.filter(s => s.status === 'completed' && s.final_score != null);
    const active = sessions.filter(s => s.status === 'active');

    // Calculate averages
    const avgScore = completed.length > 0
      ? Math.round(completed.reduce((sum, s) => sum + (s.final_score || 0), 0) / completed.length)
      : 0;

    const highScore = completed.length > 0
      ? Math.max(...completed.map(s => s.final_score || 0))
      : 0;

    // Weaknesses aggregation
    const weaknessCounts: Record<string, number> = {};
    for (const s of completed) {
      if (s.weaknesses && Array.isArray(s.weaknesses)) {
        for (const w of s.weaknesses) {
          weaknessCounts[w] = (weaknessCounts[w] || 0) + 1;
        }
      }
    }
    const topWeaknesses = Object.entries(weaknessCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Score trend (last 10 completed)
    const trend = completed
      .slice(0, 10)
      .reverse()
      .map(s => ({ score: s.final_score, date: s.completed_at || s.started_at }));

    return NextResponse.json({
      success: true,
      data: {
        totalSessions: sessions.length,
        completedSessions: completed.length,
        activeSessions: active.length,
        avgScore,
        highScore,
        topWeaknesses,
        trend,
      },
    });
  } catch (err) {
    console.error('[Stats] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
