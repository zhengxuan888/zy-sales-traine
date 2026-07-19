"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("zy_remember");
    if (saved) {
      try {
        const { email, password } = JSON.parse(saved);
        setEmail(email || "");
        setPassword(password || "");
        setRemember(true);
      } catch {}
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        if (remember) {
          localStorage.setItem("zy_remember", JSON.stringify({ email, password }));
        } else {
          localStorage.removeItem("zy_remember");
        }
        router.push(data.data.role === "admin" ? "/admin" : "/");
      } else {
        setError(data.error || "登录失败");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">ZY销售训练平台</h1>
          <p className="text-[#888899] text-sm">ZY 销售训练器</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-6 space-y-4"
        >
          <div>
            <label className="block text-sm text-[#888899] mb-1.5">账号</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入账号"
              required
              className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#00ff88] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-[#888899] mb-1.5">密码</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                required
                className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-3 py-2.5 pr-10 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#00ff88] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888899] hover:text-white text-sm transition-colors"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-[#00ff88]"
            />
            <span className="text-sm text-[#888899]">记住账号密码</span>
          </label>

          {error && (
            <div className="bg-[#ff4444]/10 border border-[#ff4444]/20 rounded-lg px-3 py-2">
              <p className="text-[#ff4444] text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00ff88] hover:bg-[#00ff88]/90 text-[#0a0a0f] font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="text-center text-[#555] text-xs mt-6">
          仅限管理员和员工使用
        </p>
      </div>
    </div>
  );
}
