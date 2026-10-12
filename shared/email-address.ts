export function validEmailAddress(value: string): boolean {
  const match = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.exec(value);
  return value.length <= 254 && match?.[0] === value;
}
