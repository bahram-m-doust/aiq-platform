"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionCreateForm } from "@/features/admin/questionnaire-builder/components/IntakeBuilderCreateForms";
import { SectionEditor } from "@/features/admin/questionnaire-builder/components/IntakeBuilderSectionEditor";
import type { IntakeBuilderSection } from "@/features/admin/questionnaire-builder/types";

export function IntakeBuilderWorkspace({
  sections,
}: {
  sections: IntakeBuilderSection[];
}) {
  return (
    <div className="space-y-6">
      <SectionCreateForm />
      <Card>
        <CardHeader>
          <CardTitle>Question bank</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {sections.length === 0 ? (
            <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              No intake sections are configured yet.
            </p>
          ) : (
            sections.map((section) => (
              <SectionEditor key={section.id} section={section} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
