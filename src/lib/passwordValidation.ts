export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Mínimo 8 caracteres");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Al menos una letra mayúscula");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Al menos una letra minúscula");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push("Al menos un símbolo (!@#$%...)");
  }

  return { isValid: errors.length === 0, errors };
}

export const PASSWORD_RULES_TEXT = "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un símbolo.";
