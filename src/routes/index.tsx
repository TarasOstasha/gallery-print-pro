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
      <section className="relative overflow-hidden bg-foreground text-primary-foreground">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 70% 20%, oklch(0.572 0.079 245 / 0.45), transparent 60%)",
          }}
        />
        <SiteHeader dark />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-6 md:px-10 lg:grid-cols-2 lg:items-center lg:gap-16 lg:pb-28 lg:pt-10">
          <div>
            <p className="label-mono text-white/55">Professional photographic prints</p>
            <h1 className="mt-6 max-w-xl font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.9] tracking-[-.045em]">
              Your photos, <span className="italic text-primary-foreground/90">beautifully</span>{" "}
              printed.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/65">
              Upload your images, choose an archival lustre size, and order prints shipped to you or
              ready for studio pickup  crafted to last.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/print"
                className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 font-mono text-xs uppercase tracking-[.2em] text-foreground transition hover:bg-primary hover:text-white"
              >
                Start your order
                <ArrowRight size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="label-mono text-white/55 underline-offset-4 hover:text-white hover:underline"
              >
                How it works
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 grid-rows-2 gap-3 md:gap-4">
            {heroImages.map((img) => (
              <div
                key={img.src}
                className={`overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 ${img.className}`}
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
            Three steps to <span className="italic text-primary">print</span>
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
              title="Choose size"
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
              <p className="label-mono text-primary">Photographic print</p>
              <h2 className="mt-4 font-display text-5xl tracking-tight md:text-6xl">
                Popular sizes
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Archival lustre paper, printed to order. Full size list available when you configure
              your print.
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
              className="mt-10 inline-flex items-center gap-3 rounded-full bg-foreground px-7 py-4 font-mono text-xs uppercase tracking-[.2em] text-primary-foreground transition hover:bg-primary"
            >
              Order prints now
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t bg-foreground px-5 py-16 text-primary-foreground md:px-10 md:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-4xl md:text-5xl">Ready when you are.</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/60">
              Upload your photos in minutes. No account required to start.
            </p>
          </div>
          <Link
            to="/print"
            className="inline-flex shrink-0 items-center gap-3 rounded-full bg-white px-8 py-4 font-mono text-xs uppercase tracking-[.2em] text-foreground"
          >
            Start your order
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="flex flex-col gap-3 border-t bg-background px-5 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-10">
        <span>© 2026 Dynasty Pix</span>
        <span className="label-mono">{studio.cityLine}</span>
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
