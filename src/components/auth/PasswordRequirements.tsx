import { Check, X } from "lucide-react";

interface Props {
  password: string;
}

export function PasswordRequirements({ password }: Props) {
  if (!password) return null;

  const rules = [
    { label: "Mínimo 8 caracteres", valid: password.length >= 8 },
    { label: "Una letra mayúscula", valid: /[A-Z]/.test(password) },
    { label: "Una letra minúscula", valid: /[a-z]/.test(password) },
    { label: "Un símbolo (!@#$%...)", valid: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
  ];

  return (
    <ul className="space-y-1 text-xs">
      {rules.map((rule) => (
        <li key={rule.label} className="flex items-center gap-1.5">
          {rule.valid ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <X className="h-3 w-3 text-destructive" />
          )}
          <span className={rule.valid ? "text-muted-foreground" : "text-destructive"}>
            {rule.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
