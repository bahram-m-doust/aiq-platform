export type AuthFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export type RegistrationInput = AuthCredentials & {
  fullName?: string;
};

export type GlobalRole =
  | "REGISTERED_USER"
  | "PLATFORM_OWNER"
  | "SUPERVISOR"
  | "INTERNAL_SPECIALIST";

export type UserProfile = {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string | null;
  global_role: GlobalRole;
};

export type UserProfileInsert = {
  auth_user_id: string;
  email: string;
  full_name: string | null;
  global_role: "REGISTERED_USER";
};
