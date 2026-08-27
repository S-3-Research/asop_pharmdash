/**
 * Zod schemas — converted from schema-reference/pharmdash_schema_20260805.py
 *
 * Source of truth for validating uploaded PharmDash release data.
 * Keep this file in sync with the Pydantic schema whenever the upstream
 * data-generation pipeline changes.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const SearchEnginePlatform = z.enum([
  "Google",
  "Bing",
  "Yahoo",
  "DuckDuckGo",
  "Baidu",
]);

export const ContactType = z.enum([
  "email",
  "phone",
  "address",
  "fax",
  "kik",
  "wickr",
  "whatsapp",
  "wechat",
  "support_email",
  "sales_email",
  "billing_email",
  "mailing_address",
  "office_address",
  "facebook",
  "instagram",
  "reddit",
  "twitter",
  "threads",
  "linkedin",
  "tiktok",
  "youtube",
  "tumblr",
  "pinterest",
  "quora",
  "telegram",
  "snapchat",
  "about.me",
  "myspace",
  "venmo",
  "signal",
  "discord",
]);

export const ContactSource = z.enum([
  "html",
  "whois",
  "social_media",
  "third_party_service",
  "api",
  "other",
]);

export const SocialMediaPlatform = z.enum([
  "facebook",
  "instagram",
  "reddit",
  "twitter",
  "threads",
  "linkedin",
  "tiktok",
  "youtube",
  "tumblr",
  "pinterest",
  "quora",
  "whatsapp",
  "telegram",
  "snapchat",
  "about.me",
  "kik",
  "myspace",
  "venmo",
  "signal",
  "discord",
]);

export const PaymentType = z.enum([
  "Credit Card",
  "Debit Card",
  "Gift Card",
  "Digital Wallets",
  "Bank Transfer",
  "Cash",
  "Check or E-check",
  "Linked payment gateway",
  "Crypto Token",
  "Crypto Stablecoin",
]);

export const PaymentOption = z.enum([
  "Visa",
  "Mastercard",
  "Discover",
  "American Express",
  "AMEX",
  "Zelle",
  "Venmo",
  "Square",
  "Cash App",
  "Apple Pay",
  "Skrill",
  "Alipay",
  "WeChat Pay",
  "Google Pay",
  "Moneygram",
  "Western Union",
  "PayPal",
  "Stripe",
  "Mollie",
  "Bitcoin",
  "Ethereum",
  "XRP",
  "USDT",
  "USDC",
  "RLUSD",
]);

export const CurrencyCode = z.enum(["EUR", "USD", "CNY", "INR", "BDT", "Pound"]);

// NOTE: as of the 2026-07-30 schema these values are lowercase ("post" /
// "comment"), changed from the previous "Post" / "Comment".
export const FormType = z.enum(["post", "comment"]);

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

// Pydantic's HttpUrl -> validated URL string (kept as string, not URL object,
// to match how the rest of the Next.js app / JSON transport expects it).
const httpUrl = z.string().url();

// ---------------------------------------------------------------------------
// Nested objects
// ---------------------------------------------------------------------------

export const NameServerInfoSchema = z.object({
  name_server: z.string(),
  name_server_ip_address: z.string().nullish(),
  mx_record: z.string().nullish(),
  mx_record_ip_address: z.string().nullish(),
});

export const WhoisInfoSchema = z.object({
  domain: z.string(),
  ip_address: z.string(),
  query_date: z.string(),
  // NOTE: domain_update_date / domain_create_date are declared twice in the
  // Pydantic source (once required, once optional) — Pydantic keeps the last
  // definition (the Optional one wins). We follow that same effective
  // behavior here: both fields are optional.
  domain_update_date: z.string().nullish(),
  domain_create_date: z.string().nullish(),
  raw_whois_data: z.record(z.string(), z.unknown()),

  domain_expiry_date: z.string().nullish(),

  registrar_name: z.string().nullish(),
  registrar_id: z.string().nullish(),

  registrant_id: z.string().nullish(),
  registrant_name: z.string().nullish(),
  registrant_org: z.string().nullish(),
  registrant_phone: z.string().nullish(),
  registrant_email: z.string().nullish(),
  registrant_fax: z.string().nullish(),
  registrant_street: z.string().nullish(),
  registrant_city: z.string().nullish(),
  registrant_state: z.string().nullish(),
  registrant_postal_code: z.string().nullish(),
  registrant_country: z.string().nullish(),
  name_servers: NameServerInfoSchema.nullish(),
});

export const ContactInfoItemSchema = z.object({
  contact_type: ContactType,
  value: z.string(),
  source: ContactSource.nullish(),
});

export const SocialMediaProfileInfoSchema = z.object({
  socialmedia_platform: SocialMediaPlatform,
  socialmedia_url: httpUrl,
});

export const PaymentInfoItemSchema = z.object({
  type: PaymentType,
  account: z.string().nullish(),
  paymentoption: PaymentOption.nullish(),
});

// New in the 2026-08-05 schema: social_media[] rows (and, as of
// 2026-08-26, product_info[] rows too) carry their own product_category
// directly (per matched product), rather than relying on a product_name ->
// category lookup derived from domains[].product_info.
// NOTE: as of the 2026-08-26 schema the enum values were renamed:
// "cancer drug" -> "cancer med", "glp-1" -> "glp".
export const ProductCategory = z.enum([
  "cancer med",
  "glp",
]);

export const ProductInfoItemSchema = z.object({
  product_title: z.string(),
  product_url: httpUrl,

  // NOTE: as of the 2026-08-26 schema this is a single category value (was
  // a free-form string array in earlier releases).
  product_category: ProductCategory.nullish(),
  product_name: z.string().nullish(),

  in_stock: z.boolean().nullish().default(true),
  product_sku: z.string().nullish(),
  product_description: z.string().nullish(),
  rating_value: z.number().nullish(),
  review_count: z.number().int().nullish(),

  price_current: z.number().nullish(),
  price_old: z.number().nullish(),
  currency: CurrencyCode.nullish(),

  // New in the 2026-08-25 schema.
  screenshot_path: z.string().nullish(),
});

export const ProductTypeSchema = z.object({
  product_category: ProductCategory.nullish(),
  product_name: z.string().nullish(),
});

export const HistoryClickUsItemSchema = z.object({
  date: z.string(),
  organic_clicks: z.number(),
  paid_clicks: z.number(),
});

export const SeoInfoSchema = z.object({
  history_click_us: z.array(HistoryClickUsItemSchema).default([]),
});

// New in the 2026-08-25 schema.
export const NabpStatus = z.enum(["not verify", "not recommend", "legit"]);
export const FDAStatus = z.enum(["not verify", "warning"]);

// ---------------------------------------------------------------------------
// Top-level records
// ---------------------------------------------------------------------------

export const DomainDataSchema = z.object({
  domain: z.string(),
  // New in the 2026-08-25 schema: Pydantic declares this as a required bool,
  // but older releases predate the field entirely — treat it as optional
  // with a `false` default rather than failing validation on historical
  // release payloads.
  is_example: z.boolean().nullish().default(false),
  platforms: z.array(SearchEnginePlatform).nullish(),
  resources: z.string().nullish(),
  is_live: z.boolean().nullish(),
  captured_time: z.number().int().nullish(),
  last_seen: z.number().int().nullish(),
  has_age_verification: z.boolean().nullish(),
  business_affiliation: z.string().nullish(),
  // NOTE: as of the 2026-08-26 schema this is constrained to ProductCategory
  // values (was a free-form string array in earlier releases).
  product_label: z.array(ProductCategory).nullish(),
  nabp_status: NabpStatus.nullish(),
  fda_status: FDAStatus.nullish(),

  address: z.string().nullish(),
  street: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  country: z.string().nullish(),
  zip_code: z.string().nullish(),

  longitude: z.number().nullish(),
  latitude: z.number().nullish(),

  whois_info: WhoisInfoSchema,
  seo_info: SeoInfoSchema,

  product_info: z.array(ProductInfoItemSchema),
  social_media_profile_info: z.array(SocialMediaProfileInfoSchema),
  contact_info: z.array(ContactInfoItemSchema),
  payment_info: z.array(PaymentInfoItemSchema),

  // New in the 2026-08-25 schema.
  screenshot_path: z.string().nullish(),
});

export const SocialMediaDataSchema = z.object({
  link: httpUrl,
  socialmedia_platform: SocialMediaPlatform,
  user_name: z.string(),
  user_url: httpUrl,
  form_type: FormType,

  confidence_score: z.number(),

  text: z.string().nullish(),
  create_date: z.string().nullish(),
  create_timestamp: z.number().int().nullish(),
  is_live: z.boolean().nullish().default(true),
  product_list: z.array(ProductTypeSchema).nullish(),
  contact_info: z.array(ContactInfoItemSchema),
  // Required by the Pydantic model (no default), but nullable.
  is_trade: z.boolean().nullish(),

  // New in the 2026-08-25 schema.
  num_comments: z.number().int().nullish(),
  num_likes: z.number().int().nullish(),
});

// NOTE: as of the 2026-07-30 schema, the previous `DataStat` +
// `SocialMediaSummary` pair was collapsed into this single flattened model
// (dropped fields: `timestamp`, `user_num`, nested `keyword_summary`).
// NOTE: as of the 2026-08-12 schema, `product_name` was replaced with
// `product_category` — keyword stats now carry a category directly instead
// of a product name, letting rankings/bubbles be filtered by category.
export const KeywordStatSchema = z.object({
  keyword: z.string(),
  product_category: ProductCategory.nullish(),
  socialmedia_platform: SocialMediaPlatform,
  raw_num: z.number().int().nullish(),
  signal_num: z.number().int().nullish(),
});

// ---------------------------------------------------------------------------
// Release-level container
//
// A release payload is expected to bundle the collections above. Adjust the
// shape here once we confirm exactly how the uploaded ZIP/JSON groups these
// records (e.g. separate files per collection vs. one combined document).
// ---------------------------------------------------------------------------

export const PharmDashReleaseDataSchema = z.object({
  domains: z.array(DomainDataSchema).default([]),
  social_media: z.array(SocialMediaDataSchema).default([]),
  keyword_stats: z.array(KeywordStatSchema).default([]),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type NameServerInfo = z.infer<typeof NameServerInfoSchema>;
export type WhoisInfo = z.infer<typeof WhoisInfoSchema>;
export type ContactInfoItem = z.infer<typeof ContactInfoItemSchema>;
export type SocialMediaProfileInfo = z.infer<typeof SocialMediaProfileInfoSchema>;
export type PaymentInfoItem = z.infer<typeof PaymentInfoItemSchema>;
export type ProductInfoItem = z.infer<typeof ProductInfoItemSchema>;
export type ProductType = z.infer<typeof ProductTypeSchema>;
export type NabpStatusType = z.infer<typeof NabpStatus>;
export type FDAStatusType = z.infer<typeof FDAStatus>;
export type HistoryClickUsItem = z.infer<typeof HistoryClickUsItemSchema>;
export type SeoInfo = z.infer<typeof SeoInfoSchema>;
export type DomainData = z.infer<typeof DomainDataSchema>;
export type SocialMediaData = z.infer<typeof SocialMediaDataSchema>;
export type KeywordStat = z.infer<typeof KeywordStatSchema>;
export type PharmDashReleaseData = z.infer<typeof PharmDashReleaseDataSchema>;
