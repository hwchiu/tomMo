export const machineTypeNameInvalid = "機種名稱只能使用英文、數字與 - _ . 空格";

const machineTypeNamePattern = /^[A-Za-z][A-Za-z0-9 ._-]{0,31}$/;

export function machineTypeNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "機種名稱必填";
  if (!machineTypeNamePattern.test(trimmed)) return machineTypeNameInvalid;
  return null;
}
