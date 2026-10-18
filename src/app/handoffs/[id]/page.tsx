import { HandoffDetail } from "@/components/handoff-views";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HandoffDetail id={id} />;
}
