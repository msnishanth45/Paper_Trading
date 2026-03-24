/**
 * Format number as Indian Rupee currency string
 */
export function formatCurrency(value: number): string {
  if (isNaN(value)) return "₹0.00";
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format number with 2 decimal places and optional sign mapping
 */
export function formatNumber(value: number, withSign: boolean = false): string {
  if (isNaN(value)) return "0.00";
  const formatted = Math.abs(value).toFixed(2);
  if (withSign && value > 0) return `+${formatted}`;
  if (withSign && value < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Get CSS color class based on positive/negative value
 */
export function getPnLColorClass(value: number): string {
  if (value > 0) return "text-green-500";
  if (value < 0) return "text-red-500";
  return "text-gray-400";
}

/**
 * Get background color class based on positive/negative value
 */
export function getPnLBgClass(value: number): string {
  if (value > 0) return "bg-green-500/10 text-green-500 border-green-500/20";
  if (value < 0) return "bg-red-500/10 text-red-500 border-red-500/20";
  return "bg-gray-500/10 text-gray-400 border-gray-500/20";
}
