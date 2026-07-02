import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Compass, Plus, Trash2, ArrowRight, MapPin } from "lucide-react";
import { listTours, createTour, deleteTour } from "@/lib/api";
import type { TourSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const [tours, setTours] = useState<TourSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      setTours(await listTours());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      const tour = await createTour(name, description);
      navigate(`/admin/${tour.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string, tourName: string) {
    if (!confirm(`Delete tour "${tourName}" and all its scenes? This cannot be undone.`)) return;
    await deleteTour(id);
    await load();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 text-zinc-900 dark:text-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Virtual Tour 360</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Insta360 X3 viewer & editor</p>
            </div>
          </div>
          <Link to="/admin">
            <Button variant="default" size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> New tour
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <section className="mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Your 360° virtual tours</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400 max-w-2xl">
            Upload equirectangular images from your Insta360 X3, link scenes together, and
            share immersive tours with anyone — no GIS background required.
          </p>
        </section>

        {/* Quick-create */}
        <section className="mb-10">
          <Card>
            <CardContent className="p-5">
              <form
                onSubmit={handleCreate}
                className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
              >
                <div className="flex-1">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Tour name
                  </label>
                  <input
                    className="w-full mt-1 px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 25 Smith St Apartment"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Description (optional)
                  </label>
                  <input
                    className="w-full mt-1 px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="2-bedroom apartment, March 2026"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={creating || !name.trim()} className="gap-1.5">
                  <Plus className="w-4 h-4" /> Create tour
                </Button>
              </form>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </CardContent>
          </Card>
        </section>

        {/* Tours list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Tours</h3>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {tours.length} {tours.length === 1 ? "tour" : "tours"}
            </span>
          </div>

          {loading ? (
            <p className="text-zinc-500">Loading…</p>
          ) : tours.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <MapPin className="w-10 h-10 mx-auto text-zinc-400" />
                <p className="mt-3 font-medium">No tours yet</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Create your first tour above, then upload 360° images from your Insta360 X3.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tours.map((t) => (
                <Card key={t.id} className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{t.name}</h4>
                        {t.description && (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5">
                            {t.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        title="Delete tour"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {t.sceneCount} {t.sceneCount === 1 ? "scene" : "scenes"}
                      </span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Link to={`/tour/${t.id}`} className="flex-1">
                        <Button variant="default" size="sm" className="w-full gap-1.5">
                          View <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                      <Link to={`/admin/${t.id}`}>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-zinc-500">
        Built on Zo · Powered by Marzipano 360° viewer
      </footer>
    </div>
  );
}
