export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-zinc-50">
      {children}
    </div>
  );
}
