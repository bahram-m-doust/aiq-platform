import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { requireUserProfile } from "@/features/auth/queries";
import { FuturesResearchDeleteButton } from "@/features/futures-research/components/FuturesResearchDeleteButton";
import { FuturesResearchStorylineUploadForm } from "@/features/futures-research/components/FuturesResearchStorylineUploadForm";
import { FuturesResearchUploadForm } from "@/features/futures-research/components/FuturesResearchUploadForm";
import { getFuturesResearchAdminOverview } from "@/features/futures-research/queries";
import { futuresResearchReportStatusLabels } from "@/features/futures-research/schema";
import { canViewAdminModulesRole } from "@/features/modules/schema";

export const metadata: Metadata = {
  title: "Futures Research | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminFuturesResearchPage() {
  const { profile } = await requireUserProfile("/admin/futures-research");

  if (!canViewAdminModulesRole(profile.global_role)) {
    redirect("/");
  }

  const overview = await getFuturesResearchAdminOverview();
  const brands = overview.map((row) => ({
    id: row.brandId,
    name: row.brandName,
  }));

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-4xl space-y-8">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Brand Research · Step 03
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Futures Research
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload the futures research analysis PDF for a brand. Uploading
            sends it to the client for review; they annotate and approve it to
            complete Brand Research.
          </p>
        </div>

        <FuturesResearchUploadForm brands={brands} />

        <FuturesResearchStorylineUploadForm brands={brands} />

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Brand</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">File</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((row) => (
                <tr className="border-t border-border" key={row.brandId}>
                  <td className="px-4 py-2.5 font-medium">{row.brandName}</td>
                  <td className="px-4 py-2.5">
                    {row.status === "NONE" ? (
                      <span className="text-muted-foreground">Not started</span>
                    ) : (
                      <Badge variant="secondary">
                        {futuresResearchReportStatusLabels[row.status]}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.fileName ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.fileName ? (
                      <FuturesResearchDeleteButton
                        brandId={row.brandId}
                        brandName={row.brandName}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
              {overview.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    className="px-4 py-6 text-center text-muted-foreground"
                    colSpan={4}
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
