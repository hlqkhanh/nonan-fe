import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type AuthMode = "login" | "signup";

export function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError("");

    if (!email.trim() || !password.trim() || (mode === "signup" && !displayName.trim())) {
      setError("Vui lòng điền đầy đủ thông tin.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password, displayName.trim());
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xác thực.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell relative flex min-h-screen flex-col justify-center px-6 py-10">
      <div className="mx-auto mb-8 grid h-14 w-14 place-items-center rounded-full bg-coral text-2xl font-black text-white">
        S
      </div>
      <h1 className="mb-1 text-center text-xl font-semibold text-mist">ShareBill</h1>
      <p className="mb-8 text-center text-sm text-white/45">Quản lý chi tiêu nhóm dễ dàng</p>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-[10px] bg-white/[0.05] p-1">
        {(["login", "signup"] as AuthMode[]).map((tab) => (
          <button
            key={tab}
            className={`h-10 rounded-[8px] text-sm font-semibold ${mode === tab ? "bg-mist text-ink" : "text-white/56"}`}
            type="button"
            onClick={() => {
              setMode(tab);
              setError("");
            }}
          >
            {tab === "login" ? "Đăng nhập" : "Đăng ký"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {mode === "signup" && (
          <label className="block">
            <span className="mb-1 block text-sm text-white/55">Tên hiển thị</span>
            <input
              className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Tên của bạn"
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-sm text-white/55">Email</span>
          <input
            className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-white/55">Mật khẩu</span>
          <input
            className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
          />
        </label>

        {error && <p className="rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}

        <button
          className="h-12 w-full rounded-full bg-coral font-semibold text-white disabled:opacity-50"
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
      </div>
    </main>
  );
}
