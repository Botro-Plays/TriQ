/**
 * Returns a privacy-safe display name: "First L." format.
 * Examples: "Juan Dela Cruz" → "Juan D.", "Maria" → "Maria"
 */
export function maskName(fullName: string): string {
  if (!fullName) return 'Unknown';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
