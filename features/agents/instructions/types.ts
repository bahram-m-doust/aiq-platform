export type BrandAgentInstruction = {
  // null agentId == brand-wide default applied to every agent of the brand.
  agentId: string | null;
  instruction: string;
  isEnabled: boolean;
  updatedAt: string | null;
};

// One editable slot in the admin panel: either the brand-wide default or a
// specific agent override, with whatever value is currently stored (if any).
export type BrandAgentInstructionSlot = {
  agentId: string | null;
  agentKey: string | null;
  agentName: string;
  instruction: string;
  isEnabled: boolean;
  updatedAt: string | null;
};

export type BrandInstructionAdminBrand = {
  id: string;
  name: string;
  status: string | null;
};

export type BrandInstructionAdminView = {
  brand: BrandInstructionAdminBrand;
  slots: BrandAgentInstructionSlot[];
};

export type InstructionFormState = {
  status: "idle" | "success" | "error";
  message: string;
};
