let revision = 0;
const listeners = new Set<() => void>();

export function getRev(): number {
  return revision;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function invalidate(): void {
  revision += 1;
  listeners.forEach((listener) => listener());
}
