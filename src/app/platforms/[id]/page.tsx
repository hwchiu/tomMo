import { PlatformDetailView } from "@/components/platform-views";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlatformDetailView id={id} />;
}
