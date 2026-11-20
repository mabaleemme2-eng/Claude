import fs from 'node:fs';
import path from 'node:path';
import type { PricingConfig } from './pricing.js';

const FILE = path.resolve(process.cwd(), 'data', 'pricing.json');

/** Server-side persistence of the pricing configuration (JSON file). */
export function loadPricing(): PricingConfig | null {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) as PricingConfig; } catch { return null; }
}
export function savePricing(c: PricingConfig) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(c, null, 2));
}
