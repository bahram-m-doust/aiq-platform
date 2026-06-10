import type { Metadata } from "next";

import { requirePlatformOwner } from "@/features/auth/queries";
import { ReopenSubmissionButton } from "@/features/questionnaire/components/ReopenSubmissionButton";
import { getIntakeSubmissionsForAdmin } from "@/features/questionnaire/queries";

export const metadata: Metadata = {
  title: "Questionnaire Submissions | Bextudio Platform",
};

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default async function AdminSubmissionsPage() {
  const { user, profile } = await requirePlatformOwner("/admin/submissions");
  const submissions = await getIntakeSubmissionsForAdmin();
  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Brand research · Questionnaires
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Questionnaire Submissions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email}. Download the submitted questions and answers as
            a Word document.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Brand</th>
                <th className="px-4 py-2.5 text-left font-medium">Submitted</th>
                <th className="px-4 py-2.5 text-left font-medium">Export</th>
                <th className="px-4 py-2.5 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr className="border-t border-border" key={submission.snapshotId}>
                  <td className="px-4 py-2.5 font-medium">
                    {submission.brandName}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {formatDate(submission.submittedAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      className="text-[var(--bv-accent)] hover:underline"
                      download
                      href={`/api/questionnaire/${submission.snapshotId}/docx`}
                    >
                      Download Word
                    </a>
                  </td>
                  <td className="px-4 py-2.5">
                    <ReopenSubmissionButton snapshotId={submission.snapshotId} />
                  </td>
                </tr>
              ))}
              {submissions.length === 0 ? (
                <tr className="border-t border-border">
                  <td
                    className="px-4 py-6 text-center text-muted-foreground"
                    colSpan={4}
                  >
                    No submitted questionnaires yet.
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
