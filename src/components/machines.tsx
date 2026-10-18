export function MachineText({ lines }: { lines: Array<{ name: string; planned: number }> }) {
  const total = lines.reduce((sum, line) => sum + line.planned, 0);
  const parts = lines.filter((line) => line.planned > 0).map((line) => `${line.name} ${line.planned}`);
  return (
    <span>
      計畫 {total} 台{parts.length > 0 ? `（${parts.join(" · ")}）` : ""}
    </span>
  );
}
