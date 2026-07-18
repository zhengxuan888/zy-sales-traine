import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const client = getClient();

    // Get all users with pagination
    const { data: users, error: usersError, count } = await client
      .from('users')
      .select('id, name, email, role, status, created_at', { count: 'exact' })
      .neq('role', 'boss')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (usersError) throw usersError;

    // Get all completed training sessions for stats
    const { data: trainings } = await client
      .from('training_history')
      .select('user_id, final_score, rule_score, ai_score, bonus_score, weaknesses, status, started_at')
      .eq('status', 'completed');

    // Build stats per user
    const userStats = (users || []).map((user: { id: string; name: string; email: string; role: string; status: string; created_at: string }) => {
      const userTrainings = (trainings || []).filter(
        (t: { user_id: string }) => t.user_id === user.id
      );

      const totalTrainings = userTrainings.length;
      const avgScore = totalTrainings > 0
        ? Math.round(userTrainings.reduce((sum: number, t: { final_score: number }) => sum + (t.final_score || 0), 0) / totalTrainings)
        : 0;

      // Calculate top weaknesses
      const weaknessCount: Record<string, number> = {};
      for (const t of userTrainings) {
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
        .map(([name]) => name);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        totalTrainings,
        avgScore,
        topWeaknesses,
        lastTraining: userTrainings.length > 0 ? userTrainings[0].started_at : null,
      };
    });

    return NextResponse.json({ 
      success: true, 
      data: userStats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch admin users:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: '姓名、邮箱和密码都是必填项' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: '密码至少需要6个字符' },
        { status: 400 }
      );
    }

    const client = getClient();

    // Check if email already exists
    const { data: existing } = await client
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: '该邮箱已被注册' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Create new employee
    const { data: newUser, error } = await client
      .from('users')
      .insert({
        name,
        email,
        password: hashedPassword,
        role: 'employee',
        status: 'active',
      })
      .select('id, name, email, role, status, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: newUser,
      message: '员工账号创建成功',
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '创建失败' },
      { status: 500 }
    );
  }
}
