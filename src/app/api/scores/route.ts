import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: true,
        data: { totalSessions: 0, avgScore: 0, weaknessRanking: [], recentTrend: [], latestHealthReport: null },
      });
    }

    const client = getClient();

    // Get training stats
    const { data: trainings, error } = await client
      .from('training_history')
      .select('final_score, rule_score, ai_score, bonus_score, started_at, weaknesses, status')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false });
    if (error) throw error;

    const completed = trainings || [];
    const totalSessions = completed.length;
    const avgScore = totalSessions > 0
      ? Math.round(completed.reduce((sum: number, t: { final_score: number }) => sum + (t.final_score || 0), 0) / totalSessions)
      : 0;

    // Calculate weakness frequency
    const weaknessCount: Record<string, number> = {};
    for (const t of completed) {
      const weaknesses = t.weaknesses as string[] | null;
      if (weaknesses) {
        for (const w of weaknesses) {
          weaknessCount[w] = (weaknessCount[w] || 0) + 1;
        }
      }
    }
    const topWeaknesses = Object.entries(weaknessCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    // Trend data (last 10 sessions)
    const trend = completed.slice(0, 10).reverse().map((t: { final_score: number; started_at: string }) => ({
      score: t.final_score || 0,
      date: t.started_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalSessions,
        avgScore,
        topWeaknesses,
        trend,
        highScore: completed.length > 0 ? Math.max(...completed.map((t: { final_score: number }) => t.final_score || 0)) : 0,
      },
    });
  } catch (error) {
    console.error('Failed to fetch scores:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
