import type { Metadata } from "next";

import { IntakeBuilderWorkspace } from "@/features/admin/questionnaire-builder/components/IntakeBuilderWorkspace";
import {
  getIntakeBuilderData,
  isMissingIntakeBuilderMigrationError,
} from "@/features/admin/questionnaire-builder/queries";
import { requirePlatformOwner } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Questionnaire Builder | Bextudio Admin",
};

export const dynamic = "force-dynamic";

function IntakeBuilderMigrationNotice() {
  return (
    <div className="space-y-4 rounded-lg border border-destructive/40 bg-card p-4 text-sm leading-6">
      <div>
        <h2 className="text-lg font-semibold text-destructive">
          Questionnaire Builder migration is required
        </h2>
        <p className="mt-2 text-muted-foreground">
          The application code is ready, but the database does not yet have the
          intake builder columns. Run the migration below in Supabase SQL Editor,
          then refresh this page.
        </p>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs text-muted-foreground">
        supabase/migrations/0007_intake_builder_status.sql
      </pre>
      <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs text-muted-foreground">
{`alter table public.question_sections
  add column if not exists is_active boolean not null default true;

alter table public.question_sections
  add column if not exists updated_at timestamptz default now();

alter table public.questions
  add column if not exists is_active boolean not null default true;

alter table public.questions
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_question_sections_active_order
  on public.question_sections(is_active, order_index);

create index if not exists idx_questions_section_active_order
  on public.questions(section_id, is_active, order_index);`}
      </pre>
    </div>
  );
}

export default async function AdminIntakeBuilderPage() {
  const { user, profile } = await requirePlatformOwner("/admin/questionnaire-builder");
  let data = null;
  let needsMigration = false;

  try {
    data = await getIntakeBuilderData();
  } catch (error) {
    if (!isMissingIntakeBuilderMigrationError(error)) {
      throw error;
    }

    needsMigration = true;
  }

  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Platform owner
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              Strategic Questionnaire Builder
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Signed in as {email}
            </p>
          </div>
          
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
          Manage the intake question bank for future client sessions. Archive
          hides sections or questions from new intake screens without deleting
          existing answers, locked snapshots, or audit history.
        </div>

        {needsMigration || !data ? (
          <IntakeBuilderMigrationNotice />
        ) : (
          <IntakeBuilderWorkspace sections={data.sections} />
        )}
      </section>
    </main>
  );
}
