import { requireAdmin } from "@/lib/admin/requireAdmin";

/**
 * Téléchargement d'un CSV depuis une route `/admin/.../export`. Une route n'est pas protégée par
 * le layout `/admin` : l'appelant est revérifié ici.
 */
export async function adminCsvResponse(build: () => Promise<{ filename: string; csv: string }>): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return new Response("Réservé aux admins.", { status: 403 });
  }
  const { filename, csv } = await build();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
