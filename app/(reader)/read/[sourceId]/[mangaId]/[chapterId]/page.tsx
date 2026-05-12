import { Reader } from "@/components/reader/reader";

export default async function ReadPage({
  params,
}: {
  params: Promise<{ sourceId: string; mangaId: string; chapterId: string }>;
}) {
  const { sourceId, mangaId, chapterId } = await params;
  return (
    <Reader
      sourceId={decodeURIComponent(sourceId)}
      mangaId={decodeURIComponent(mangaId)}
      chapterId={decodeURIComponent(chapterId)}
    />
  );
}
