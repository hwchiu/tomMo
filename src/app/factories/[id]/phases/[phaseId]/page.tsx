import { PhaseForm } from "@/components/entity-forms";

export default async function Page({ params }: { params: Promise<{ id: string; phaseId: string }> }) {
  const { id, phaseId } = await params;
  return <PhaseForm factoryId={id} phaseId={phaseId} />;
}
