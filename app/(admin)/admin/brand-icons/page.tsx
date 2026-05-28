import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { brandIconPublicUrl } from "@/features/admin/brand-icons/storage";
import { BrandIconRow } from "@/features/admin/brand-icons/components/BrandIconRow";
import { requirePlatformOwner } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Brand icons | Bextudio Admin",
};

export const dynamic = "force-dynamic";

type BrandRow = {
  id: string;
  name: string;
  icon_path: string | null;
};

export default async function AdminBrandIconsPage() {
  await requirePlatformOwner("/admin/brand-icons");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .select("id, name, icon_path")
    .order("name", { ascending: true });

  if (error) throw error;

  const brands = (data ?? []) as BrandRow[];

  return (
    <main className="px-6 py-10">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Platform owner
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              Brand icons
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">
              <ArrowLeftIcon className="size-4" />
              Back to admin
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload brand logos</CardTitle>
            <CardDescription>
              PNG only, max 2 MB. Square logos work best (uploaded icon
              displays at 28&times;28 in the sidebar). Re-uploading overwrites
              the existing icon.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {brands.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No brands found.
              </p>
            ) : (
              brands.map((brand) => (
                <BrandIconRow
                  brandId={brand.id}
                  brandName={brand.name}
                  iconUrl={brandIconPublicUrl(brand.icon_path)}
                  key={brand.id}
                />
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
