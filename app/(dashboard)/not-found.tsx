import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">Halaman Tidak Ditemukan</h2>
      <p className="text-muted-foreground">Halaman yang Anda cari tidak ada.</p>
      <Button nativeButton={false} render={<Link href="/dashboard">Kembali ke Dasbor</Link>} />
    </div>
  );
}
