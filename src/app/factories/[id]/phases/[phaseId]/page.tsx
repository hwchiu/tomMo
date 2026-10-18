import { PhaseForm } from "@/components/entity-forms";
import { phaseParams } from "@/lib/static-params";

export function generateStaticParams() {
  return phaseParams();
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string; phaseId: string }> }) {
  const { id, phaseId } = await params;
  return <PhaseForm factoryId={id} phaseId={phaseId} />;
}
