"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pagination } from "@/components/pagination";

interface UserStat {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  totalTrainings: number;
  avgScore: number;
  topWeaknesses: string[];
  lastTraining: string | null;
}

interface TeamStats {
  totalUsers: number;
  totalTrainings: number;
  avgScore: number;
  highScore: number;
  activeUsers: number;
  topWeaknesses: Array<{ name: string; count: number }>;
  trend: Array<{ date: string; score: number; count: number }>;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserStat[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);

  // Create employee form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [creating, setCreating] = useState(false);

  // Action feedback
  const [actionMsg, setActionMsg] = useState("");
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  async function fetchData() {
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch(`/api/admin/users?page=${currentPage}&limit=${pageSize}`),
        fetch("/api/admin/stats"),
      ]);

      if (usersRes.status === 401 || statsRes.status === 401) {
        router.push("/login");
        return;
      }

      const usersData = await usersRes.json();
      const statsData = await statsRes.json();

      if (usersData.success) {
        setUsers(usersData.data || []);
        setTotalPages(usersData.pagination?.totalPages || 1);
      }
      if (statsData.success) {
        setStats(statsData.data);
      }
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!newName || !newEmail || !newPassword) {
      setCreateError("请填写所有字段");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setCreateSuccess(`员工 "${newName}" 创建成功！`);
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setShowCreateForm(false);
        fetchData();
        setTimeout(() => setCreateSuccess(""), 3000);
      } else {
        setCreateError(data.error || "创建失败");
      }
    } catch {
      setCreateError("网络错误");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    setActionUserId(userId);
    setActionMsg("");

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();

      if (data.success) {
        setActionMsg(data.message);
        fetchData();
        setTimeout(() => setActionMsg(""), 3000);
      } else {
        setActionMsg(data.error || "操作失败");
      }
    } catch {
      setActionMsg("网络错误");
    } finally {
      setActionUserId(null);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return "text-[#00ff88]";
    if (score >= 40) return "text-[#ffaa00]";
    return "text-[#ff4444]";
  };

  const weaknessLabel = (w: string) => {
    const labels: Record<string, string> = {
      greeting: "Greeting",
      productInfo: "Product Info",
      trustBuilding: "Trust Build",
      language: "Language",
      logistics: "Logistics",
      closing: "Closing",
      negotiation: "Negotiation",
      conversation: "Conversation",
      language_tone: "Tone",
      conciseness: "Length",
      trust_sequence: "Order",
      meetup_handling: "Meetup",
      payment_handling: "Payment",
      product_info: "Product Info",
      honesty: "Honesty",
    };
    return labels[w] || w;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#888899]">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">👑 管理后台</h1>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[#888899] hover:text-white text-sm">
              ← 训练首页
            </Link>
            <button
              onClick={handleLogout}
              className="text-[#ff4444] hover:text-[#ff6666] text-sm transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>

        {/* Action Feedback */}
        {actionMsg && (
          <div className="mb-4 bg-[#00ff88]/10 border border-[#00ff88]/20 rounded-lg px-4 py-2">
            <p className="text-[#00ff88] text-sm">{actionMsg}</p>
          </div>
        )}
        {createSuccess && (
          <div className="mb-4 bg-[#00ff88]/10 border border-[#00ff88]/20 rounded-lg px-4 py-2">
            <p className="text-[#00ff88] text-sm">{createSuccess}</p>
          </div>
        )}

        {/* Team Overview Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
              <div className="text-2xl font-bold text-white font-mono">{stats.totalUsers}</div>
              <div className="text-xs text-[#888899]">员工总数</div>
            </div>
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
              <div className="text-2xl font-bold text-white font-mono">{stats.totalTrainings}</div>
              <div className="text-xs text-[#888899]">训练总次数</div>
            </div>
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
              <div className={`text-2xl font-bold font-mono ${scoreColor(stats.avgScore)}`}>{stats.avgScore}</div>
              <div className="text-xs text-[#888899]">团队平均分</div>
            </div>
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
              <div className="text-2xl font-bold text-[#00ff88] font-mono">{stats.activeUsers}</div>
              <div className="text-xs text-[#888899]">7日活跃</div>
            </div>
          </div>
        )}

        {/* Team Weaknesses */}
        {stats && stats.topWeaknesses.length > 0 && (
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-6">
            <h2 className="text-sm font-semibold text-white mb-3">团队薄弱环节</h2>
            <div className="flex flex-wrap gap-2">
              {stats.topWeaknesses.map((w, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-[#ff4444]/10 border border-[#ff4444]/20 rounded-lg">
                  <span className="text-sm text-[#ff4444] font-medium">{weaknessLabel(w.name)}</span>
                  <span className="text-xs text-[#888899]">{w.count}次</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score Trend */}
        {stats && stats.trend.some((d) => d.count > 0) && (
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-6">
            <h2 className="text-sm font-semibold text-white mb-3">近14天分数趋势</h2>
            <div className="flex items-end gap-1 h-20">
              {stats.trend.map((point, i) => {
                const height = point.count > 0 ? Math.max(10, (point.score / 110) * 100) : 5;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className={`w-full rounded-t transition-all ${point.count > 0 ? "bg-[#00ff88]/60" : "bg-[#1e1e2e]"}`}
                      style={{ height: `${height}%` }}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#1e1e2e] border border-[#2e2e3e] rounded px-2 py-1 text-xs text-white whitespace-nowrap z-10">
                      {point.date.slice(5)}: {point.count > 0 ? `${point.score}分 (${point.count}次)` : "无训练"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Create Employee Button & Form */}
        <div className="mb-4">
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full bg-[#00ff88] hover:bg-[#00ff88]/90 text-[#0a0a0f] font-semibold py-2.5 rounded-xl transition-colors"
            >
              + 创建员工账号
            </button>
          ) : (
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">创建新员工</h2>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateError("");
                  }}
                  className="text-[#888899] hover:text-white text-sm"
                >
                  ✕ 取消
                </button>
              </div>
              <form onSubmit={handleCreateEmployee} className="space-y-3">
                <div>
                  <label className="block text-xs text-[#888899] mb-1">姓名</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="员工姓名"
                    className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#00ff88] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#888899] mb-1">邮箱</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="employee@company.com"
                    className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#00ff88] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#888899] mb-1">密码（至少6位）</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="设置初始密码"
                    className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#00ff88] transition-colors"
                  />
                </div>
                {createError && (
                  <div className="bg-[#ff4444]/10 border border-[#ff4444]/20 rounded-lg px-3 py-2">
                    <p className="text-[#ff4444] text-sm">{createError}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-[#00ff88] hover:bg-[#00ff88]/90 text-[#0a0a0f] font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {creating ? "创建中..." : "确认创建"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Employee List */}
        {users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#888899]">暂无员工，点击上方按钮创建。</p>
          </div>
        ) : (
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] overflow-hidden">
            <h2 className="text-sm font-semibold text-white px-4 pt-4 pb-2">员工列表</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#888899]">姓名</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#888899]">训练次数</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#888899]">平均分</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#888899]">状态</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#888899]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-[#1e1e2e]/50 hover:bg-[#1e1e2e]/30">
                      <td className="px-4 py-3">
                        <div className="text-white text-sm font-medium">{user.name}</div>
                        <div className="text-[#888899] text-xs">{user.email}</div>
                        {user.topWeaknesses.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.topWeaknesses.map((w, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-[#ff4444]/10 border border-[#ff4444]/20 rounded text-[#ff4444] text-[10px]">
                                {weaknessLabel(w)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-white text-sm font-mono">{user.totalTrainings}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-mono font-bold ${user.totalTrainings > 0 ? scoreColor(user.avgScore) : "text-[#888899]"}`}>
                          {user.totalTrainings > 0 ? user.avgScore : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {user.status === "active" ? (
                          <span className="inline-block px-2 py-0.5 bg-[#00ff88]/10 border border-[#00ff88]/20 rounded text-[#00ff88] text-xs">正常</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-[#ff4444]/10 border border-[#ff4444]/20 rounded text-[#ff4444] text-xs">已停用</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleStatus(user.id, user.status)}
                          disabled={actionUserId === user.id}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                            user.status === "active"
                              ? "bg-[#ff4444]/10 border border-[#ff4444]/20 text-[#ff4444] hover:bg-[#ff4444]/20"
                              : "bg-[#00ff88]/10 border border-[#00ff88]/20 text-[#00ff88] hover:bg-[#00ff88]/20"
                          }`}
                        >
                          {actionUserId === user.id ? "处理中..." : user.status === "active" ? "停用" : "启用"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-4 pb-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
