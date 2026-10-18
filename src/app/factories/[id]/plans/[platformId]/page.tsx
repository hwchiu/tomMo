import { PlanForm } from "@/components/plan-form";

export default async function Page({ params }: { params: Promise<{ id: string; platformId: string }> }) {
  const { id, platformId } = await params;
  return <PlanForm factoryId={id} platformId={platformId} />;
}
