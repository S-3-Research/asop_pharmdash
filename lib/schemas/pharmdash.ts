/**
 * Zod schemas — converted from schema-reference/pharmdash_schema_20260705.py
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
  "support_email",
  "sales_email",
  "billing_email",
  "mailing_address",
  "office_address",
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

export const FormType = z.enum(["Post", "Comment"]);

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

export const ProductInfoItemSchema = z.object({
  product_title: z.string(),
  product_url: httpUrl,

  product_category: z.array(z.string()).nullish(),
  product_name: z.string().nullish(),

  in_stock: z.boolean().nullish().default(true),
  product_sku: z.string().nullish(),
  product_description: z.string().nullish(),
  rating_value: z.number().nullish(),
  review_count: z.number().int().nullish(),

  price_current: z.number().nullish(),
  price_old: z.number().nullish(),
  currency: CurrencyCode.nullish(),
});

export const HistoryClickUsItemSchema = z.object({
  date: z.string(),
  organic_clicks: z.number(),
  paid_clicks: z.number(),
});

export const SeoInfoSchema = z.object({
  history_click_us: z.array(HistoryClickUsItemSchema).default([]),
});

// ---------------------------------------------------------------------------
// Top-level records
// ---------------------------------------------------------------------------

export const DomainDataSchema = z.object({
  domain: z.string(),
  platforms: z.array(SearchEnginePlatform).nullish(),
  resources: z.string().nullish(),
  is_live: z.boolean().nullish(),
  captured_time: z.number().int().nullish(),
  last_seen: z.number().int().nullish(),
  has_age_verification: z.boolean().nullish(),
  business_affiliation: z.string().nullish(),
  product_label: z.array(z.string()).nullish(),

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
});

export const SocialMediaDataSchema = z.object({
  link: httpUrl,
  socialmedia_platform: SocialMediaPlatform,
  user_name: z.string(),
  user_url: httpUrl,
  form_type: FormType,

  text: z.string().nullish(),
  create_date: z.string().nullish(),
  create_timestamp: z.number().int().nullish(),
  is_live: z.boolean().nullish().default(true),
  product_name: z.array(z.string()).nullish(),
  contact_info: z.array(ContactInfoItemSchema),
});

export const DataStatSchema = z.object({
  timestamp: z.number().int(),
  signal_num: z.number().int(),
  raw_num: z.number().int(),
});

export const KeywordStatSchema = z.object({
  keyword: z.string(),
  statistic: DataStatSchema,
});

export const SocialMediaSummarySchema = z.object({
  product_name: z.string(),
  socialmedia_platform: SocialMediaPlatform,
  raw_num: z.number().int().nullish(),
  signal_num: z.number().int().nullish(),
  user_num: z.number().int().nullish(),
  keyword_summary: KeywordStatSchema.nullish(),
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
  social_media_summary: z.array(SocialMediaSummarySchema).default([]),
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
export type HistoryClickUsItem = z.infer<typeof HistoryClickUsItemSchema>;
export type SeoInfo = z.infer<typeof SeoInfoSchema>;
export type DomainData = z.infer<typeof DomainDataSchema>;
export type SocialMediaData = z.infer<typeof SocialMediaDataSchema>;
export type DataStat = z.infer<typeof DataStatSchema>;
export type KeywordStat = z.infer<typeof KeywordStatSchema>;
export type SocialMediaSummary = z.infer<typeof SocialMediaSummarySchema>;
export type PharmDashReleaseData = z.infer<typeof PharmDashReleaseDataSchema>;
