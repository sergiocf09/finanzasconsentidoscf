import { BookOpen, Download, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const ebooks = [
  {
    id: "1",
    title: "Ordena tu dinero en 7 días",
    author: "Félix Tamargo",
    cover: "📚",
    progress: 75,
    downloaded: true,
  },
  {
    id: "2",
    title: "El arte de presupuestar",
    author: "Félix Tamargo",
    cover: "📖",
    progress: 30,
    downloaded: true,
  },
  {
    id: "3",
    title: "Deudas: de la angustia a la calma",
    author: "Félix Tamargo",
    cover: "📕",
    progress: 0,
    downloaded: false,
  },
];

export default function Library() {
  return (
    <div className="relative">
      {/* En desarrollo banner */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
        <div className="w-full text-center rotate-[-35deg] bg-muted-foreground/10 py-4 border-y border-muted-foreground/20">
          <span className="text-4xl font-heading font-bold text-muted-foreground/30 tracking-[0.3em] uppercase">En Desarrollo</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Header — sticky */}
        <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-heading font-semibold text-foreground">Mi Biblioteca</h1>
          </div>
        </div>

        {/* Featured Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-foreground/20 text-3xl flex-shrink-0">
              📚
            </div>
            <div className="flex-1">
              <p className="text-sm text-primary-foreground/80 mb-1">Destacado</p>
              <h2 className="text-xl font-heading font-bold mb-2">
                Ordena tu dinero en 7 días
              </h2>
              <p className="text-sm text-primary-foreground/80 mb-4">
                Una guía práctica para tomar el control de tus finanzas personales
                sin estrés ni complicaciones.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Continuar leyendo
              </Button>
            </div>
          </div>
        </div>

        {/* Ebooks Grid */}
        <div className="space-y-3">
          <h2 className="text-lg font-heading font-semibold">Mis ebooks</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ebooks.map((ebook) => (
              <div
                key={ebook.id}
                className="rounded-2xl bg-card border border-border p-5 card-interactive"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex h-16 w-12 items-center justify-center rounded-lg bg-secondary text-3xl flex-shrink-0">
                    {ebook.cover}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground line-clamp-2">
                      {ebook.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ebook.author}
                    </p>
                  </div>
                </div>

                {ebook.progress > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="text-primary font-medium">
                        {ebook.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${ebook.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-2">
                    <BookOpen className="h-4 w-4" />
                    {ebook.progress > 0 ? "Continuar" : "Leer"}
                  </Button>
                  {!ebook.downloaded && (
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Discover More */}
        <div className="rounded-2xl bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 flex-shrink-0">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                Descubre más recursos
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                Explora la colección completa de ebooks y guías de Finanzas con
                Sentido™ para seguir aprendiendo.
              </p>
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Ver biblioteca completa
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
