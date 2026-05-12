import { MangaDetailsView } from "@/components/manga/manga-details";

export default async function MangaPage({
  params,
}: {
  params: Promise<{ sourceId: string; mangaId: string }>;
}) {
  const { sourceId, mangaId } = await params;
  return (
    <MangaDetailsView
      sourceId={decodeURIComponent(sourceId)}
      mangaId={decodeURIComponent(mangaId)}
    />
  );
}
