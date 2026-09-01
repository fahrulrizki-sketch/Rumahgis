#!/usr/bin/env node
import { loadProductBank } from './affiliate.mjs';

const bankPath = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
try {
  const bank = await loadProductBank(bankPath);
  console.log(JSON.stringify({ valid: true, products: bank.products.length }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
  process.exit(1);
}
