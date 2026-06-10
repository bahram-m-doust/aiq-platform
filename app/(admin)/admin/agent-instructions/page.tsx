import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requirePlatformOwner } from "@/features/auth/queries";
import { BrandInstructionForm } from "@/features/agents/instructions/components/BrandInstructionForm";
import {
  getBrandInstructionAdminBrands,
  listBrandInstructionSlots,
} from "@/features/agents/instructions/queries";

export const metadata: Metadata = {
  title: "Agent Instructions | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function AdminAgentInstructionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, profile } = await requirePlatformOwner("/admin/agent-instructions");

  const resolved = (await searchParams) ?? {};
  const brandIdParam = resolved.brandId;
  const selectedBrandId =
    typeof brandIdParam === "string" ? brandIdParam : undefined;

  const brands = await getBrandInstructionAdminBrands();
  const selectedBrand = selectedBrandId
    ? brands.find((brand) => brand.id === selectedBrandId)
    : undefined;
  const slots = selectedBrand
    ? await listBrandInstructionSlots(selectedBrand.id)
    : [];
  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Brand agent configuration
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Agent Instructions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email} | {profile.global_role}
          </p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Set the brand-wide system instruction and per-agent overrides. The
            instruction is layered between the agent role and the safety guard —
            it shapes voice and behavior but cannot override brand isolation or
            safety rules.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {brands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No brands found.</p>
          ) : (
            brands.map((brand) => {
              const isActive = brand.id === selectedBrandId;
              return (
                <Button
                  asChild
                  key={brand.id}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                >
                  <Link href={`/admin/agent-instructions?brandId=${brand.id}`}>
                    {brand.name}
                  </Link>
                </Button>
              );
            })
          )}
        </div>

        {selectedBrand ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{selectedBrand.name}</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {slots.map((slot) => (
                <BrandInstructionForm
                  brandId={selectedBrand.id}
                  key={slot.agentId ?? "brand-wide"}
                  slot={slot}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a brand to edit its agent instructions.
          </p>
        )}

        
      </section>
    </main>
  );
}
