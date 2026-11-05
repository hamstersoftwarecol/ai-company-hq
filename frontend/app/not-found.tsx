import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="px-panel flex max-w-md flex-col items-start gap-4 p-6">
        <span className="font-pixel border-2 border-[#3a2f2a] bg-[#f08a24] px-2 py-1.5 text-[10px] text-white">404</span>
        <h1 className="font-pixel text-sm leading-relaxed">ESTA HABITACIÓN NO EXISTE</h1>
        <p className="text-sm text-[#6b5d52]">No hay nada en esta dirección de la oficina.</p>
        <Link href="/" className="px-btn">
          VOLVER A LA OFICINA
        </Link>
      </div>
    </main>
  );
}
