export type GmailAccount = "primary" | "secondary";
export function gmailAccount(value: unknown): GmailAccount {
  if (value === undefined || value === null || value === "primary") return "primary";
  if (value === "secondary") return "secondary";
  throw new Error("Compte Gmail invalide.");
}
