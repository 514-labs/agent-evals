import type { AssertionContext } from "@dec-bench/eval-core";

export async function top_products_under_200ms(): Promise<boolean> {
  const start = Date.now();
  await fetch("http://localhost:3000/api/top-products");
  return Date.now() - start < 200;
}

export async function funnel_under_200ms(): Promise<boolean> {
  const start = Date.now();
  await fetch("http://localhost:3000/api/funnel");
  return Date.now() - start < 200;
}

export async function hourly_under_200ms(): Promise<boolean> {
  const start = Date.now();
  await fetch("http://localhost:3000/api/hourly");
  return Date.now() - start < 200;
}
