import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { requireUserProfile } from "@/features/auth/queries";
import { AestheticsDeleteButton } from "@/features/aesthetics/components/AestheticsDeleteButton";
import { AestheticsUploadForm } from "@/features/aesthetics/components/AestheticsUploadForm";
import { getAestheticsAdminOverview } from "@/features/aesthetics/queries";
import { aestheticsDeliverableStatusLabels } from "@/features/aesthetics/schema";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import type { AestheticsKind } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Aesthetics | Bextudio Platform",
};

export const dynamic = "force-dynamic";

const kindLabels: Record<AestheticsKind, string> = {
  VISUAL_DIRECTION: "Visual Direction",
  COLOR_TYPE_SYSTEM: "Color & Type System",
  ASSET_LIBRARY: "Asset Library",
};

export default async function AdminAestheticsPage() {
  const { profile } = await requireUserProfile("/admin/aesthetics");

  if (!canViewAdminModulesRole(profile.global_role)) {
    redirect("/home");
  }

  const overview = await getAestheticsAdminOverview();
  const brands = [
    ...new Map(
      overview.map((row) => [row.brandId, { id: row.brandId, name: row.brandName }]),
    ).values(),
  ];

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-4xl space-y-8">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Build Roadmap · Phase 03
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Aesthetics
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload Visual Direction, Color & Type System, and Asset Library PDFs
            for each brand. Each is sent to the client for review independently.
          </p>
        </div>

        <AestheticsUploadForm brands={brands} />

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Brand</th>
                <th className="px-4 py-2.5 text-left font-medium">Deliverable</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">File</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((row) => (
                <tr
                  className="border-t border-border"
                  key={`${row.brandId}::${row.kind}`}
                >
                  <td className="px-4 py-2.5 font-medium">{row.brandName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {kindLabels[row.kind]}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.status === "NONE" ? (
                      <span className="text-muted-foreground">Not started</span>
                    ) : (
                      <Badge variant="secondary">
                        {aestheticsDeliverableStatusLabels[row.status]}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.fileName ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.fileName ? (
                      <AestheticsDeleteButton
                        brandId={row.brandId}
                        brandName={row.brandName}
                        kind={row.kind}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
              {overview.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    className="px-4 py-6 text-center text-muted-foreground"
                    colSpan={5}
                  >
                    No brands yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
