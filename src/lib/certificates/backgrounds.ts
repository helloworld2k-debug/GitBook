import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CertificateTemplate } from "@/lib/certificates/templates";

const fallbackPixel = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

export function getCertificateTemplateBackgroundDataUri(template: CertificateTemplate) {
  if (!template.backgroundUrl) {
    return null;
  }

  const filePath = join(process.cwd(), "public", template.backgroundUrl);

  try {
    return `data:image/webp;base64,${readFileSync(filePath).toString("base64")}`;
  } catch {
    return fallbackPixel;
  }
}
