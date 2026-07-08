export type BrandAgentInstruction = {
  // null agentId == the single OpenAI-style brand prompt.
  agentId: string | null;
  instruction: string;
  isEnabled: boolean;
  updatedAt: string | null;
};

// One editable prompt slot in the admin panel.
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
