import Link from "next/link";

export default function Home() {
  return (
    <main className="cg-shell flex items-center">
      <section className="cg-card w-full">
        <p className="mb-3 inline-block rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs uppercase tracking-widest text-neutral-700">
          Phase 0
        </p>
        <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
          Creator Growth Platform
        </h1>
        <p className="mt-4 max-w-2xl text-base text-neutral-700 md:text-lg">
          This MVP starts with authentication and a protected dashboard shell. In the next
          steps we will add post uploads and visibility of historical Instagram content.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="cg-button">
            Create Account
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-black/20 px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-black/5"
          >
            Login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-black/20 px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-black/5"
          >
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
