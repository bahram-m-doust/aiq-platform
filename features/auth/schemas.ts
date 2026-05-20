import type {
  AuthCredentials,
  AuthFormState,
  RegistrationInput,
} from "@/features/auth/types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const initialAuthFormState: AuthFormState = {
  status: "idle",
  message: "",
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function validateEmail(email: string) {
  return emailPattern.test(email);
}

export function validateLoginFormData(formData: FormData) {
  const credentials: AuthCredentials = {
    email: readString(formData, "email").toLowerCase(),
    password: readString(formData, "password"),
  };

  if (!validateEmail(credentials.email)) {
    return { data: null, error: "Enter a valid email address." };
  }

  if (!credentials.password) {
    return { data: null, error: "Enter your password." };
  }

  return { data: credentials, error: null };
}

export function validateRegistrationFormData(formData: FormData) {
  const registration: RegistrationInput = {
    fullName: readString(formData, "fullName") || undefined,
    email: readString(formData, "email").toLowerCase(),
    password: readString(formData, "password"),
  };

  if (!validateEmail(registration.email)) {
    return { data: null, error: "Enter a valid email address." };
  }

  if (registration.password.length < 8) {
    return { data: null, error: "Use a password with at least 8 characters." };
  }

  return { data: registration, error: null };
}
