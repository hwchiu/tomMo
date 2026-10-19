"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, useMock } from "@/api";
import { signIn } from "@/components/shell";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showHint, setShowHint] = useState(useMock);

  useEffect(() => {
    if (useMock) return;
    let alive = true;
    void api.loginConfig().then((body) => {
      if (alive) setShowHint(Boolean(body.showDemoHint));
    }).catch(() => {
      if (alive) setShowHint(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <p className="text-xs font-medium tracking-wide text-accent">Factory coordination</p>
        <h1 className="mt-1 text-2xl font-semibold">登入廠務協調台</h1>
        <p className="mt-1 text-sm text-muted">編輯者可以建立與修改。使用者只能閱讀。</p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const username = String(form.get("username") ?? "").trim();
            const password = String(form.get("password") ?? "");
            setPending(true);
            setError(null);
            void signIn(username, password)
              .then(() => router.replace("/"))
              .catch((caught: unknown) => {
                setError(caught instanceof Error ? caught.message : "登入失敗");
                setPending(false);
              });
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">帳號</span>
            <input name="username" autoComplete="username" className="h-10 w-full rounded-md border border-line px-3" required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">密碼</span>
            <input name="password" type="password" autoComplete="current-password" className="h-10 w-full rounded-md border border-line px-3" required />
          </label>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <button type="submit" disabled={pending} className="h-10 w-full rounded-md bg-accent text-sm font-medium text-white disabled:opacity-50">
            {pending ? "登入中…" : "登入"}
          </button>
        </form>
        {showHint ? (
          <p className="mt-4 text-xs leading-5 text-muted">
            示範帳號：admin（編輯者）、viewer（使用者）。靜態示範只核對帳號，密碼請自行輸入。
          </p>
        ) : null}
      </div>
    </div>
  );
}
