import { FactoryView } from "@/components/factory-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FactoryView id={id} />;
}
