import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Package, Sparkles, Truck, Upload } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { product, studio } from "@/lib/catalog";
import { formatCents } from "@/lib/money";

export const Route = createFileRoute("/")({ component: HomePage });

const heroImages = [
  {
    src: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
    alt: "Portrait photography sample print",
    className: "col-span-2 row-span-2",
  },
  {
    src: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=600&q=80",
    alt: "Fashion photography sample",
    className: "col-span-1 row-span-1 mt-8",
  },
  {
    src: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80",
    alt: "Wedding moment sample print",
    className: "col-span-1 row-span-1",
  },
];

const featuredSizes = product.variants.filter((v) =>
  ["5x7", "8x10", "11x14", "16x20"].includes(v.label),
);

function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden bg-background text-foreground">
        <SiteHeader />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-6 md:px-10 lg:grid-cols-2 lg:items-center lg:gap-16 lg:pb-28 lg:pt-10">
          <div>
            <p className="label-mono text-muted-foreground">Professional photographic prints</p>
            <h1 className="mt-6 max-w-xl font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.9] tracking-[-.045em]">
              Your photos, <span className="italic">beautifully</span> printed.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
              Upload your images, choose an archival lustre size, and order prints shipped to you or
              ready for studio pickup  crafted to last.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/print"
                className="inline-flex items-center gap-3 rounded-full bg-foreground px-7 py-4 font-sans text-xs uppercase tracking-[.2em] text-primary-foreground transition hover:bg-primary hover:text-white"
              >
                Start your order
                <ArrowRight size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="label-mono text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                How it works
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 grid-rows-2 gap-3 md:gap-4">
            {heroImages.map((img) => (
              <div
                key={img.src}
                className={`overflow-hidden rounded-2xl bg-foreground/5 ring-1 ring-foreground/10 ${img.className}`}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  loading="eager"
                  className="h-full min-h-[140px] w-full object-cover md:min-h-[200px]"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-b bg-background px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="label-mono text-primary">Simple process</p>
          <h2 className="mt-4 max-w-lg font-display text-5xl tracking-tight md:text-6xl">
            Three steps to print
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <Step
              icon={<Upload className="text-primary" />}
              step="01"
              title="Upload"
              body="Add your photos from phone or desktop. We keep previews on your device until you checkout."
            />
            <Step
              icon={<Sparkles className="text-primary" />}
              step="02"
              title="Choose product and size"
              body="Pick from professional print sizes  from 4×6 keepsakes to large 20×30 wall pieces."
            />
            <Step
              icon={<Package className="text-primary" />}
              step="03"
              title="Order"
              body="Ship to your door or collect free from our studio when your prints are ready."
            />
          </div>
          <div className="mt-12 text-center md:mt-16">
            <Link
              to="/print"
              className="label-mono inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-card px-6 py-4 transition hover:border-primary hover:bg-accent"
            >
              Upload photos
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-muted/50 px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h2 className="font-display text-5xl tracking-tight md:text-6xl">
                Popular print sizes
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Full size list available when you configure your print.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {featuredSizes.map((v) => (
              <div
                key={v.label}
                className="rounded-2xl border bg-card p-6 transition hover:border-primary/30 hover:shadow-sm"
              >
                <p className="font-display text-4xl">{v.label.replace("x", "×")}</p>
                <p className="mt-2 text-sm text-muted-foreground">Lustre photographic print</p>
                <p className="mt-4 font-mono text-sm">{formatCents(v.priceCents)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
          <div className="overflow-hidden rounded-3xl bg-muted">
            <img
              src="/images/made-to-keep-print.jpg"
              alt="Hands holding a fine photographic print"
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
          </div>
          <div>
            <p className="label-mono text-primary">Made to keep</p>
            <h2 className="mt-4 font-display text-5xl leading-tight tracking-tight md:text-6xl">
              Lab-quality prints, without the complexity
            </h2>
            <ul className="mt-8 space-y-4 text-sm leading-7 text-muted-foreground">
              <li className="flex gap-3">
                <Truck className="mt-0.5 shrink-0 text-primary" size={18} />
                Standard and expedited shipping, or free pickup at {studio.name}.
              </li>
              <li className="flex gap-3">
                <Sparkles className="mt-0.5 shrink-0 text-primary" size={18} />
                Color-accurate lustre finish suited to portraits, events, and everyday memories.
              </li>
              <li className="flex gap-3">
                <Package className="mt-0.5 shrink-0 text-primary" size={18} />
                Each order ties your file to the exact size you selected  ready for production.
              </li>
            </ul>
            <Link
              to="/print"
              className="mt-10 inline-flex items-center gap-3 rounded-full bg-foreground px-7 py-4 font-sans text-xs uppercase tracking-[.2em] text-primary-foreground transition hover:bg-primary"
            >
              Order prints now
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t bg-[#3C3933] px-5 py-16 text-primary-foreground md:px-10 md:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-4xl md:text-5xl">Ready when you are.</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/60">
              Upload your photos in minutes. No account required to start.
            </p>
          </div>
          <Link
            to="/print"
            className="inline-flex shrink-0 items-center gap-3 rounded-full bg-white px-8 py-4 font-sans text-xs uppercase tracking-[.2em] text-foreground"
          >
            Start your order
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="flex flex-col gap-3 border-t bg-background px-5 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-10">
        <span>© 2026 Dynasty Pix</span>
        <div className="flex items-center gap-4">
          <a
            href={studio.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Dynasty Pix on Instagram"
            className="transition-colors hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          </a>
          <a
            href={studio.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Dynasty Pix on Facebook"
            className="transition-colors hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.266h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
            </svg>
          </a>
        </div>
      </footer>
    </main>
  );
}

function Step({
  icon,
  step,
  title,
  body,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-3xl border bg-card p-8">
      <div className="flex items-center justify-between">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-accent">{icon}</div>
        <span className="font-mono text-xs text-muted-foreground">{step}</span>
      </div>
      <h3 className="mt-6 font-display text-3xl">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
    </article>
  );
}
