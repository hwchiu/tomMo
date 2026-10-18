import { DeploymentForm } from "@/components/entity-forms";
import { deploymentParams } from "@/lib/static-params";

export function generateStaticParams() {
  return deploymentParams();
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeploymentForm id={id} />;
}
