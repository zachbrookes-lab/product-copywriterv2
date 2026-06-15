import * as XLSX from "xlsx";
import { ProductInput, ProductFeature } from "./types";

/**
 * Expects a workbook with columns: SKU, Product Description, Features, Benefits
 * (one row per feature, same SKU/Product Description repeated)
 */
export function parseProductExcel(data: ArrayBuffer): ProductInput[] {
  const wb = XLSX.read(data, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  });

  const productMap = new Map<string, ProductInput>();

  for (const row of rows) {
    const sku = String(row["SKU"] ?? "").trim();
    const productName = String(row["Product Description"] ?? "").trim();
    const feature = String(row["Features"] ?? "").trim();
    const benefit = String(row["Benefits"] ?? "").trim();

    if (!sku) continue;

    if (!productMap.has(sku)) {
      productMap.set(sku, {
        sku,
        productName,
        features: [],
      });
    }

    if (feature || benefit) {
      const featureEntry: ProductFeature = { feature, benefit };
      productMap.get(sku)!.features.push(featureEntry);
    }
  }

  return Array.from(productMap.values());
}
