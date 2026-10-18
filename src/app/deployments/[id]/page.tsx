import { DeploymentForm } from "@/components/entity-forms";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeploymentForm id={id} />;
}
