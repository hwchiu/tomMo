import { HandoffDetail } from "@/components/handoff-views";
import { handoffParams } from "@/lib/static-params";

export function generateStaticParams() {
  return handoffParams();
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HandoffDetail id={id} />;
}
