/**
 * Business-rule validation for PharmDash release payloads.
 *
 * This runs AFTER Zod schema validation (types/required/enums/nesting) and
 * checks cross-record rules that Zod cannot express on its own:
 *  - duplicate IDs within a collection
 *  - referential integrity between collections
 *  - basic data-quality checks
 */

import type { PharmDashReleaseData } from "@/lib/schemas/pharmdash";

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export interface ValidationReport {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
}

export function runBusinessValidation(data: PharmDashReleaseData): ValidationReport {
  const issues: ValidationIssue[] = [];

  // --- Duplicate domain check -------------------------------------------------
  const domainSeen = new Map<string, number>();
  data.domains.forEach((record, index) => {
    const count = domainSeen.get(record.domain) ?? 0;
    domainSeen.set(record.domain, count + 1);
    if (count === 1) {
      issues.push({
        level: "error",
        code: "duplicate_domain",
        message: `Duplicate domain "${record.domain}" appears more than once in domains[]`,
        path: `domains[${index}].domain`,
      });
    }
  });

  // --- Duplicate product_url within the same domain's product_info -----------
  data.domains.forEach((record, domainIndex) => {
    const seenUrls = new Set<string>();
    record.product_info.forEach((product, productIndex) => {
      if (seenUrls.has(product.product_url)) {
        issues.push({
          level: "warning",
          code: "duplicate_product_url",
          message: `Duplicate product_url "${product.product_url}" within domain "${record.domain}"`,
          path: `domains[${domainIndex}].product_info[${productIndex}].product_url`,
        });
      }
      seenUrls.add(product.product_url);
    });
  });

  // --- Referential integrity: social_media product_name should reference ------
  // --- product names seen somewhere in domains[].product_info ----------------
  const knownProductNames = new Set(
    data.domains.flatMap((record) =>
      record.product_info.map((p) => p.product_name).filter((name): name is string => Boolean(name)),
    ),
  );

  data.social_media.forEach((record, index) => {
    (record.product_name ?? []).forEach((name) => {
      if (!knownProductNames.has(name)) {
        issues.push({
          level: "warning",
          code: "unknown_product_reference",
          message: `social_media[${index}] references product_name "${name}" not found in any domain's product_info`,
          path: `social_media[${index}].product_name`,
        });
      }
    });
  });

  // --- Data quality: whois query_date should be a parseable date --------------
  data.domains.forEach((record, index) => {
    if (Number.isNaN(Date.parse(record.whois_info.query_date))) {
      issues.push({
        level: "error",
        code: "invalid_date",
        message: `whois_info.query_date "${record.whois_info.query_date}" is not a valid date`,
        path: `domains[${index}].whois_info.query_date`,
      });
    }
  });

  // --- Data quality: rating_value should be within a sane 0-5 range ----------
  data.domains.forEach((domainRecord, domainIndex) => {
    domainRecord.product_info.forEach((product, productIndex) => {
      if (
        product.rating_value != null &&
        (product.rating_value < 0 || product.rating_value > 5)
      ) {
        issues.push({
          level: "warning",
          code: "rating_out_of_range",
          message: `rating_value ${product.rating_value} is outside the expected 0-5 range`,
          path: `domains[${domainIndex}].product_info[${productIndex}].rating_value`,
        });
      }
    });
  });

  const errorCount = issues.filter((i) => i.level === "error").length;
  const warningCount = issues.filter((i) => i.level === "warning").length;

  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    issues,
  };
}
