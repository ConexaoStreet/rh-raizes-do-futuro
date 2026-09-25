export const PASSWORD_POLICY_MESSAGE =
  "Use 12 ou mais caracteres com maiúscula, minúscula, número e símbolo.";

export function strongPassword(value: string) {
  return (
    value.length >= 12 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}
