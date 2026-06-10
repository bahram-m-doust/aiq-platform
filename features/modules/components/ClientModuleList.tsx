import { ModuleBoard } from "@/features/modules/components/ModuleBoard";
import type { ClientModuleWorkspace } from "@/features/modules/types";

export function ClientModuleList({
  workspace,
}: {
  workspace: ClientModuleWorkspace;
}) {
  return (
    <ModuleBoard
      actionLabel="Open review"
      basePath="/modules"
      emptyDescription="Modules will appear here after Supervisor approval for client review."
      emptyTitle="No client-review modules"
      modules={workspace.modules}
    />
  );
}
