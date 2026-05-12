import { SourceBrowser } from "@/components/browse/source-browser";

export default async function BrowseSourcePage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  return <SourceBrowser sourceId={decodeURIComponent(sourceId)} />;
}
