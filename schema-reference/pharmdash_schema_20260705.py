from typing import List, Optional
from pydantic import BaseModel, HttpUrl
from enum import Enum
import json


class SearchEnginePlatform(str, Enum):
    google = "Google"
    bing = "Bing"
    yahoo = "Yahoo"
    duckduckgo = "DuckDuckGo"
    baidu = "Baidu"

class NameServerInfo(BaseModel):
    name_server: str
    name_server_ip_address: Optional[str] = None
    mx_record: Optional[str] = None
    mx_record_ip_address: Optional[str] = None


class WhoisInfo(BaseModel):
    domain: str
    ip_address: str
    query_date: str
    domain_update_date: str
    domain_create_date: str
    raw_whois_data: dict

    domain_expiry_date: Optional[str] = None
    domain_update_date: Optional[str] = None
    domain_create_date: Optional[str] = None

    registrar_name: Optional[str] = None
    registrar_id: Optional[str] = None
    
    
    registrant_id: Optional[str] = None
    registrant_name: Optional[str] = None
    registrant_org: Optional[str] = None
    registrant_phone: Optional[str] = None
    registrant_email: Optional[str] = None
    registrant_fax: Optional[str] = None
    registrant_street: Optional[str] = None
    registrant_city: Optional[str] = None
    registrant_state: Optional[str] = None
    registrant_postal_code: Optional[str] = None
    registrant_country: Optional[str] = None
    name_servers: Optional[NameServerInfo] = None
    #subject_alternative_names: List[str] = []  # [doamin1.com, domain2.com]
    
    
class ContactType(str, Enum):
    email = "email"
    phone = "phone"
    address = "address"
    fax = "fax"
    support_email = "support_email"
    sales_email = "sales_email"
    billing_email = "billing_email"
    mailing_address = "mailing_address"
    office_address = "office_address"


class ContactSource(str, Enum):
    html = "html"
    whois = "whois"
    social_media = "social_media"
    third_party_service = "third_party_service"
    api = "api"
    other = "other"


class ContactInfoItem(BaseModel):
    contact_type: ContactType
    value: str
    source: Optional[ContactSource] = None


class SocialMediaPlatform(str, Enum):
    facebook = "facebook"
    instagram = "instagram"
    reddit = "reddit"
    twitter = "twitter"
    threads = "threads"
    linkedin = "linkedin"
    tiktok = "tiktok"
    youtube = "youtube"
    tumblr = "tumblr"
    pinterest = "pinterest"
    quora = "quora"
    whatsapp = "whatsapp"
    telegram = "telegram"
    snapchat = "snapchat"
    about_me = "about.me"
    kik = "kik"
    myspace = "myspace"
    venmo = "venmo"

class SocialMediaProfileInfo(BaseModel):
    socialmedia_platform: SocialMediaPlatform
    socialmedia_url: HttpUrl

class PaymentType(str, Enum):
    credit_card = "Credit Card"
    debit_card = "Debit Card"
    gift_card = "Gift Card"
    digital_wallets = "Digital Wallets"
    bank_transfer = "Bank Transfer"
    cash = "Cash"
    check_echeck = "Check or E-check"
    linked_payment_gateway = "Linked payment gateway"
    crypto_token = "Crypto Token"
    crypto_coin = "Crypto Stablecoin"


class PaymentOption(str, Enum):
    visa = "Visa"
    mastercard = "Mastercard"
    discover = "Discover"
    american_express = "American Express"
    amex = "AMEX"
    zelle = "Zelle"
    venmo = "Venmo"
    square = "Square"
    cashapp = "Cash App"
    applepay = "Apple Pay"
    skrill = "Skrill"
    alipay = "Alipay"
    wechatpay = "WeChat Pay"
    googlepay = "Google Pay"
    moneygram = "Moneygram"
    western_union = "Western Union"
    paypal = "PayPal"
    stripe = "Stripe"
    mollie = "Mollie"
    bitcoin = "Bitcoin"
    ethereum = "Ethereum"
    xrp = "XRP"
    usdt = "USDT"
    usdc = "USDC"
    rlusd = "RLUSD"


class PaymentInfoItem(BaseModel):
    type: PaymentType
    account: Optional[str] = None
    paymentoption: Optional[PaymentOption] = None


class CurrencyCode(str, Enum):
    EUR = "EUR"  
    USD = "USD"  
    CNY = "CNY"  
    INR = "INR"  
    BDT = "BDT"  
    Pound = "Pound"  

class ProductInfoItem(BaseModel):
    product_title: str
    product_url: HttpUrl
    
    product_category: Optional[List[str]] = None
    product_name: Optional[str] = None

    in_stock: Optional[bool] = True
    product_sku: Optional[str] = None
    product_description: Optional[str] = None
    rating_value: Optional[float] = None
    review_count: Optional[int] = None

    price_current: Optional[float] = None
    price_old: Optional[float] = None
    currency: Optional[CurrencyCode] = None

    '''
    dosage: Optional[str] = None
    quantity: Optional[str] = None
    high_risk: Optional[bool] = None
    prescription_required: Optional[bool] = None
    '''

class HistoryClickUsItem(BaseModel):
    date: str
    organic_clicks: float
    paid_clicks: float


class SeoInfo(BaseModel):
    history_click_us: List[HistoryClickUsItem] = []


class DomainData(BaseModel):
    domain: str
    platforms: Optional[List[SearchEnginePlatform]] = None
    resources: Optional[str] = None
    is_live: Optional[bool] = None
    captured_time: Optional[int] = None
    last_seen: Optional[int] = None
    #has_disclaimer: Optional[bool] = None
    has_age_verification: Optional[bool] = None
    business_affiliation: Optional[str] = None
    product_label: Optional[List[str]] = None

    address: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    zip_code: Optional[str] = None

    longitude: Optional[float] = None
    latitude: Optional[float] = None

    whois_info: WhoisInfo
    seo_info: SeoInfo

    product_info: List[ProductInfoItem]
    social_media_profile_info: List[SocialMediaProfileInfo]
    contact_info: List[ContactInfoItem]
    payment_info: List[PaymentInfoItem]
    
class FormType(str, Enum):
    post = "Post"
    comment = "Comment"

class SocialMediaData(BaseModel):
    link: HttpUrl
    socialmedia_platform: SocialMediaPlatform
    user_name: str
    user_url: HttpUrl
    form_type: FormType

    text: Optional[str] = None
    create_date: Optional[str] = None
    create_timestamp: Optional[int] = None
    is_live: Optional[bool] = True
    product_name: Optional[list[str]] = None
    contact_info: List[ContactInfoItem]

class DataStat(BaseModel):
    timestamp: int
    signal_num: int
    raw_num: int

class KeywordStat(BaseModel):
    keyword: str
    statistic: DataStat

class SocialMediaSummary(BaseModel):
    product_name: str
    socialmedia_platform: SocialMediaPlatform
    raw_num: Optional[int] = None
    signal_num: Optional[int] = None
    user_num: Optional[int] = None
    
    keyword_summary: Optional[KeywordStat] = None