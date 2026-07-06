export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatVndInput(amount: number): string {
  return amount > 0 ? new Intl.NumberFormat("vi-VN").format(amount) : "";
}

export function parseVndInput(value: string): number {
  const normalized = value.replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : 0;
}
