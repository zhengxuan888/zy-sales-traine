import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET() {
  try {
    const client = getClient();

    // Get total users count (excluding boss)
    const { count: totalUsers } = await client
      .from('users')
      .select('id', { count: 'exact', head: true })
      .neq('role', 'boss');

    // Get all completed training sessions
    const { data: trainings } = await client
      .from('training_history')
      .select('final_score, weaknesses, status, started_at, user_id')
      .eq('status', 'completed');

    const completedTrainings = trainings || [];
    const totalTrainings = completedTrainings.length;
    const avgScore = totalTrainings > 0
      ? Math.round(completedTrainings.reduce((sum, t) => sum + (t.final_score || 0), 0) / totalTrainings)
      : 0;
    const highScore = completedTrainings.length > 0
      ? Math.max(...completedTrainings.map(t => t.final_score || 0))
      : 0;

    // Calculate team-wide weaknesses
    const weaknessCount: Record<string, number> = {};
    for (const t of completedTrainings) {
      const weaknesses = t.weaknesses as string[] | null;
      if (weaknesses) {
        for (const w of weaknesses) {
          weaknessCount[w] = (weaknessCount[w] || 0) + 1;
        }
      }
    }
    const topWeaknesses = Object.entries(weaknessCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Active users (trained in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers = new Set(
      completedTrainings
        .filter(t => new Date(t.started_at) >= sevenDaysAgo)
        .map(t => t.user_id)
    ).size;

    // Trend data (last 14 days)
    const trendMap: Record<string, { total: number; count: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trendMap[key] = { total: 0, count: 0 };
    }
    for (const t of completedTrainings) {
      const key = t.started_at.split('T')[0];
      if (trendMap[key]) {
        trendMap[key].total += (t.final_score || 0);
        trendMap[key].count += 1;
      }
    }
    const trend = Object.entries(trendMap).map(([date, v]) => ({
      date,
      score: v.count > 0 ? Math.round(v.total / v.count) : 0,
      count: v.count,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: totalUsers || 0,
        totalTrainings,
        avgScore,
        highScore,
        activeUsers,
        topWeaknesses,
        trend,
      }
    });
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
