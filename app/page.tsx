export default function Home() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto flex min-h-svh w-full max-w-5xl flex-col justify-center px-6 py-16">
        <div className="max-w-2xl">
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Epic 00
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
            Bextudio Platform
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
            The MVP foundation is ready for the next scoped product epic.
          </p>
        </div>
      </section>
    </main>
  );
}
