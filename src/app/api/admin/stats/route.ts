import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET() {
  try {
    const client = getClient();

    // Get all users with their training stats
    const { data: users, error: userError } = await client
      .from('users')
      .select('id, name, email, role')
      .neq('role', 'boss')
      .order('name');
    if (userError) throw userError;

    const { data: trainings, error: trainingError } = await client
      .from('training_history')
      .select('user_id, final_score, weaknesses, status')
      .eq('status', 'completed');
    if (trainingError) throw trainingError;

    // Aggregate stats per user
    const statsMap: Record<string, { count: number; totalScore: number; weaknesses: Record<string, number> }> = {};
    for (const t of trainings || []) {
      const uid = t.user_id;
      if (!uid) continue;
      if (!statsMap[uid]) statsMap[uid] = { count: 0, totalScore: 0, weaknesses: {} };
      statsMap[uid].count++;
      statsMap[uid].totalScore += (t.final_score || 0);
      const w = t.weaknesses as string[] | null;
      if (w) {
        for (const item of w) {
          statsMap[uid].weaknesses[item] = (statsMap[uid].weaknesses[item] || 0) + 1;
        }
      }
    }

    const userStats = (users || []).map((user: { id: string; name: string; email: string | null }) => {
      const s = statsMap[user.id] || { count: 0, totalScore: 0, weaknesses: {} };
      const avgScore = s.count > 0 ? Math.round(s.totalScore / s.count) : 0;
      const topWeaknesses = Object.entries(s.weaknesses)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name]) => name);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        trainingCount: s.count,
        avgScore,
        topWeaknesses,
      };
    });

    return NextResponse.json({ success: true, data: userStats });
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
