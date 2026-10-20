import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-[#20284a] bg-gradient-to-br from-[rgba(18,26,51,0.9)] to-[rgba(11,16,38,0.98)] p-8 sm:p-12 shadow-[0_40px_160px_-40px_rgba(79,155,255,0.45)]">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#4f9bff]/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#7c3fff]/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9aa3c0]">Intelligent Commerce</p>
          <h1 className="mt-3 text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white leading-tight">
            Smarter shopping. <span className="bg-gradient-to-r from-[#4f9bff] to-[#7c3fff] bg-clip-text text-transparent">Clearer decisions.</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[#9aa3c0] max-w-2xl">
            Discover products from a trusted catalog, plan around your budget, and complete checkout with verified PayPal Sandbox payments.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/catalog" className="rounded-lg bg-gradient-to-r from-[#4f9bff] to-[#7c3fff] px-6 py-2.5 text-sm text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.995]">Explore Products</Link>
            <Link href="/assistant" className="rounded-lg border border-[#20284a] bg-[#121a33]/80 px-6 py-2.5 text-sm text-white backdrop-blur hover:bg-[#121a33] transition-colors">Try AI Assistant</Link>
          </div>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["Discover","Plan","Approve","Verify"].map((t,i)=>(
          <div key={t} className="rounded-xl border border-[#20284a] bg-[#121a33]/60 p-5 shadow-sm backdrop-blur transition-transform hover:translate-y-[-2px]">
            <div className="text-sm font-medium text-white">{i+1}. {t}</div>
            <p className="mt-1 text-sm text-[#9aa3c0]">{["Browse trusted catalog","Set budget, get recommendations","PayPal Sandbox approval","Server-verified capture"][i]}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
