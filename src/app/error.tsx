"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-8">
      <h1 className="text-lg font-semibold">這個畫面沒有順利畫出來</h1>
      <p className="mt-2 text-sm text-muted">{error.message}</p>
      <button type="button" className="mt-4 rounded-md bg-accent px-3 py-2 text-sm text-white" onClick={reset}>
        再試一次
      </button>
    </div>
  );
}
