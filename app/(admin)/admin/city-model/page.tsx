import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUserProfile } from "@/features/auth/queries";
import { CityModelAdminUpload } from "@/features/city-model-deliverables/components/CityModelAdminUpload";
import {
  getCityModelAdminBrands,
  getCityModelAdminDistricts,
} from "@/features/city-model-deliverables/queries";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import { DeliverableStatusBadge } from "@/features/review-deliverables/components/DeliverableStatusBadge";

export const metadata: Metadata = {
  title: "City Model | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminCityModelPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireUserProfile("/admin/city-model");
  if (!canViewAdminModulesRole(profile.global_role)) {
    redirect("/home");
  }

  const brands = await getCityModelAdminBrands();
  const resolved = (await searchParams) ?? {};
  const selectedBrandId =
    typeof resolved.brandId === "string" ? resolved.brandId : undefined;
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId);
  const districts = selectedBrand
    ? await getCityModelAdminDistricts(selectedBrand.id)
    : null;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Brand Research · City Model
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            City Model deliverables
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Upload each district&apos;s PDF for a brand. Every upload goes
            straight to the client for review and approval.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {brands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No brands yet.</p>
          ) : (
            brands.map((brand) => (
              <Button
                asChild
                key={brand.id}
                size="sm"
                variant={brand.id === selectedBrandId ? "default" : "outline"}
              >
                <Link href={`/admin/city-model?brandId=${brand.id}`}>
                  {brand.name}
                </Link>
              </Button>
            ))
          )}
        </div>

        {districts && selectedBrand ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {districts.map(({ district, status, fileName }) => (
              <div
                className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-xs"
                key={district.key}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{district.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {district.description}
                    </p>
                  </div>
                  <DeliverableStatusBadge
                    className="shrink-0"
                    status={status}
                  />
                </div>
                {fileName ? (
                  <p className="text-xs text-muted-foreground">
                    Latest: {fileName}
                  </p>
                ) : null}
                <CityModelAdminUpload
                  brandId={selectedBrand.id}
                  districtKey={district.key}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a brand to upload its City Model districts.
          </p>
        )}
      </section>
    </main>
  );
}
