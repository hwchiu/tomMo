import { PlatformEditor } from "@/components/platform-views";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlatformEditor id={id} />;
}
