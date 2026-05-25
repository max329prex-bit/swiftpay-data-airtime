export type NetworkId = "MTN" | "GLO" | "AIRTEL" | "9MOBILE";

export const NETWORKS: { id: NetworkId; name: string; color: string; bg: string; prefixes: string[]; logo: string }[] = [
  { id: "MTN", name: "MTN", color: "text-black", bg: "bg-yellow-400", logo: "MTN",
    prefixes: ["0803","0806","0703","0706","0813","0816","0810","0814","0903","0906","0913","0916"] },
  { id: "AIRTEL", name: "Airtel", color: "text-white", bg: "bg-red-600", logo: "Airtel",
    prefixes: ["0802","0808","0708","0812","0701","0902","0901","0907","0912"] },
  { id: "GLO", name: "Glo", color: "text-white", bg: "bg-green-600", logo: "Glo",
    prefixes: ["0805","0807","0705","0815","0811","0905","0915"] },
  { id: "9MOBILE", name: "9mobile", color: "text-white", bg: "bg-green-500", logo: "9M",
    prefixes: ["0809","0817","0818","0908","0909"] },
];

export function detectNetwork(phone: string): NetworkId | null {
  const p = phone.replace(/\D/g, "").replace(/^234/, "0");
  if (p.length < 4) return null;
  const prefix = p.slice(0, 4);
  return NETWORKS.find(n => n.prefixes.includes(prefix))?.id ?? null;
}

// Real AidaPay pricing — sell prices (what users pay)
// package_code + provider_code are used when calling the vtu-purchase edge function
export type DataBundle = {
  id: string;
  name: string;
  size: string;
  validity: string;
  buyPrice: number;   // AidaPay cost
  price: number;      // Sell price (what customer pays)
  package_code: string;
  provider_code: string;
  available?: boolean;
  coming_soon?: boolean;
  is_blitz_prime?: boolean;
  success_rate?: number;
};

export const DATA_BUNDLES_VTU: Record<NetworkId, DataBundle[]> = {
  MTN: [
    // DAILY
    { id: "mtn-1gb-1day", name: "1GB – 1 Day", size: "1GB", validity: "1 Day",
      buyPrice: 260, price: 270, package_code: "MTN-1GB-1DAY", provider_code: "mtn-sme",
      available: false, coming_soon: true, is_blitz_prime: true, success_rate: 97 },
    { id: "PK-MTN-NTZS", name: "2GB – 2 Days", size: "2GB", validity: "2 Days",
      buyPrice: 738, price: 790, package_code: "PK-MTN-NTZS", provider_code: "mtn-sme",
      available: true, is_blitz_prime: false, success_rate: 96 },
    { id: "PK-MTN-XALZ", name: "2.5GB – 2 Days", size: "2.5GB", validity: "2 Days",
      buyPrice: 880, price: 930, package_code: "PK-MTN-XALZ", provider_code: "mtn-sme",
      available: true, is_blitz_prime: true, success_rate: 96 },
    { id: "PK-MTN-PUZI", name: "3.2GB – 2 Days", size: "3.2GB", validity: "2 Days",
      buyPrice: 985, price: 1040, package_code: "PK-MTN-PUZI", provider_code: "mtn-sme",
      available: true, is_blitz_prime: true, success_rate: 95 },
    // WEEKLY
    { id: "PK-MTN-LCEM", name: "1GB + 1GB YouTube", size: "1GB+YT", validity: "7 Days",
      buyPrice: 785, price: 850, package_code: "PK-MTN-LCEM", provider_code: "mtn-sme",
      available: true, is_blitz_prime: false, success_rate: 94 },
    { id: "PK-MTN-DT-2GB", name: "2GB – 7 Days", size: "2GB", validity: "7 Days",
      buyPrice: 1150, price: 1200, package_code: "PK-MTN-DT-2GB", provider_code: "mtn-sme",
      available: true, is_blitz_prime: false, success_rate: 95 },
    { id: "PK-MTN-SSQBA", name: "3.5GB – Weekly", size: "3.5GB", validity: "7 Days",
      buyPrice: 1478, price: 1578, package_code: "PK-MTN-SSQBA", provider_code: "mtn-sme",
      available: true, is_blitz_prime: true, success_rate: 95 },
    { id: "PK-MTN-AWUF-FDDU", name: "6GB – Weekly", size: "6GB", validity: "7 Days",
      buyPrice: 2460, price: 2560, package_code: "PK-MTN-AWUF-FDDU", provider_code: "mtn-sme",
      available: true, is_blitz_prime: true, success_rate: 94 },
    // MONTHLY
    { id: "PK-MTN-GOODY-1200MB", name: "1.2GB Social", size: "1.2GB", validity: "30 Days",
      buyPrice: 443, price: 500, package_code: "PK-MTN-GOODY-1200MB", provider_code: "mtn-sme",
      available: true, is_blitz_prime: false, success_rate: 93 },
    { id: "PK-MTN-XDPW-ACB", name: "7GB + 2GB Night", size: "7GB", validity: "30 Days",
      buyPrice: 3447, price: 3600, package_code: "PK-MTN-XDPW-ACB", provider_code: "mtn-sme",
      available: true, is_blitz_prime: false, success_rate: 94 },
    { id: "PK-MTN-SEYV", name: "10GB + 10min Call", size: "10GB", validity: "30 Days",
      buyPrice: 4433, price: 4583, package_code: "PK-MTN-SEYV", provider_code: "mtn-sme",
      available: true, is_blitz_prime: true, success_rate: 94 },
    { id: "PK-MTN-NVIQ", name: "16.5GB + 25min Call", size: "16.5GB", validity: "30 Days",
      buyPrice: 6402, price: 6592, package_code: "PK-MTN-NVIQ", provider_code: "mtn-sme",
      available: true, is_blitz_prime: false, success_rate: 93 },
    { id: "PK-MTN-XDPW-AUB", name: "20GB + 4GB Night", size: "20GB", validity: "30 Days",
      buyPrice: 7387, price: 7587, package_code: "PK-MTN-XDPW-AUB", provider_code: "mtn-sme",
      available: true, is_blitz_prime: true, success_rate: 93 },
    { id: "PK-MTN-XDWW-ACB", name: "25GB + 4GB Night", size: "25GB", validity: "30 Days",
      buyPrice: 8865, price: 9065, package_code: "PK-MTN-XDWW-ACB", provider_code: "mtn-sme",
      available: true, is_blitz_prime: false, success_rate: 93 },
    { id: "PK-MTN-TBKX", name: "75GB – Monthly", size: "75GB", validity: "30 Days",
      buyPrice: 17730, price: 18080, package_code: "PK-MTN-TBKX", provider_code: "mtn-sme",
      available: true, is_blitz_prime: false, success_rate: 92 },
  ],
  AIRTEL: [
    // DAILY
    { id: "PK-AIRTEL-GIFTING-EVTN", name: "230MB – 2 Days", size: "230MB", validity: "2 Days",
      buyPrice: 198, price: 200, package_code: "PK-AIRTEL-GIFTING-EVTN", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: true, success_rate: 93 },
    { id: "PK-AIRTEL-PNDD-1GB-SOCIAL", name: "1GB Social – 3 Days", size: "1GB", validity: "3 Days",
      buyPrice: 296, price: 350, package_code: "PK-AIRTEL-PNDD-1GB-SOCIAL", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: false, success_rate: 92 },
    { id: "PK-AIRTEL-PNDD-1.5GB-BINGE", name: "2GB – 2 Days", size: "2GB", validity: "2 Days",
      buyPrice: 595, price: 645, package_code: "PK-AIRTEL-PNDD-1.5GB-BINGE", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: true, success_rate: 92 },
    { id: "PK-AIRTEL-PNDD-2GB-BINGE", name: "3GB – 2 Days", size: "3GB", validity: "2 Days",
      buyPrice: 740, price: 790, package_code: "PK-AIRTEL-PNDD-2GB-BINGE", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: true, success_rate: 91 },
    { id: "PK-AIRTEL-NMA-3.2GB", name: "3.2GB – 2 Days", size: "3.2GB", validity: "2 Days",
      buyPrice: 995, price: 1050, package_code: "PK-AIRTEL-NMA-3.2GB", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: true, success_rate: 91 },
    // WEEKLY
    { id: "PK-AIRTEL-PNDD-1.5GB-SOCIAL", name: "1.5GB Social – 7 Days", size: "1.5GB", validity: "7 Days",
      buyPrice: 495, price: 550, package_code: "PK-AIRTEL-PNDD-1.5GB-SOCIAL", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: true, success_rate: 92 },
    { id: "PK-AIRTEL-PNDD-1GB-WEEKLY", name: "1GB – Weekly", size: "1GB", validity: "7 Days",
      buyPrice: 790, price: 840, package_code: "PK-AIRTEL-PNDD-1GB-WEEKLY", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: false, success_rate: 91 },
    // MONTHLY
    { id: "PK-AIRTEL-PNDD-2GB-GIFTING", name: "2GB – Monthly", size: "2GB", validity: "30 Days",
      buyPrice: 1485, price: 1600, package_code: "PK-AIRTEL-PNDD-2GB-GIFTING", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: false, success_rate: 91 },
    { id: "PK-AIRTEL-PNDD-3GB-GIFTING", name: "3GB – Monthly", size: "3GB", validity: "30 Days",
      buyPrice: 1980, price: 2100, package_code: "PK-AIRTEL-PNDD-3GB-GIFTING", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: false, success_rate: 91 },
    { id: "PK-AIRTEL-PNDD-4GB-GIFTING", name: "4GB – Monthly", size: "4GB", validity: "30 Days",
      buyPrice: 2470, price: 2600, package_code: "PK-AIRTEL-PNDD-4GB-GIFTING", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: false, success_rate: 91 },
    { id: "PK-AIRTEL-PNDD-8GB-GIFTING", name: "8GB – Monthly", size: "8GB", validity: "30 Days",
      buyPrice: 2965, price: 3150, package_code: "PK-AIRTEL-PNDD-8GB-GIFTING", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: false, success_rate: 91 },
    { id: "PK-AIRTEL-PNDD-10GB-GIFTING", name: "10GB – Monthly", size: "10GB", validity: "30 Days",
      buyPrice: 3950, price: 4100, package_code: "PK-AIRTEL-PNDD-10GB-GIFTING", provider_code: "airtel-sme-cg",
      available: true, is_blitz_prime: true, success_rate: 90 },
  ],
  GLO: [
    // DAILY
    { id: "glo-awuf-data-750mb", name: "750MB – 1 Day AWUF", size: "750MB", validity: "1 Day",
      buyPrice: 195, price: 245, package_code: "glo-awuf-data-750mb", provider_code: "gloawufdata",
      available: true, is_blitz_prime: true, success_rate: 90 },
    { id: "PK-GLO-UTYS-CXZ", name: "1GB – 3 Days", size: "1GB", validity: "3 Days",
      buyPrice: 275, price: 300, package_code: "PK-GLO-UTYS-CXZ", provider_code: "glo-gifting",
      available: true, is_blitz_prime: true, success_rate: 89 },
    { id: "glo-awuf-data-1.5gb", name: "1.5GB – 1 Day AWUF", size: "1.5GB", validity: "1 Day",
      buyPrice: 290, price: 350, package_code: "glo-awuf-data-1.5gb", provider_code: "gloawufdata",
      available: true, is_blitz_prime: true, success_rate: 90 },
    { id: "glo-awuf-data-2.5gb", name: "2.5GB – 2 Days AWUF", size: "2.5GB", validity: "2 Days",
      buyPrice: 490, price: 550, package_code: "glo-awuf-data-2.5gb", provider_code: "gloawufdata",
      available: true, is_blitz_prime: true, success_rate: 90 },
    // WEEKLY
    { id: "PK-GLO-WGEI-CS", name: "200MB – 14 Days", size: "200MB", validity: "14 Days",
      buyPrice: 90, price: 100, package_code: "PK-GLO-WGEI-CS", provider_code: "glo-gifting",
      available: true, is_blitz_prime: false, success_rate: 88 },
    { id: "PK-GLO-UTYS-CAZ", name: "1GB – 7 Days", size: "1GB", validity: "7 Days",
      buyPrice: 335, price: 400, package_code: "PK-GLO-UTYS-CAZ", provider_code: "glo-gifting",
      available: true, is_blitz_prime: false, success_rate: 89 },
    { id: "glo-awuf-data-10gb", name: "10GB – 7 Days AWUF", size: "10GB", validity: "7 Days",
      buyPrice: 1950, price: 2050, package_code: "glo-awuf-data-10gb", provider_code: "gloawufdata",
      available: true, is_blitz_prime: true, success_rate: 89 },
    // MONTHLY
    { id: "PK-GLO-DSEC-CS", name: "500MB – Monthly", size: "500MB", validity: "30 Days",
      buyPrice: 230, price: 280, package_code: "PK-GLO-DSEC-CS", provider_code: "glo-gifting",
      available: true, is_blitz_prime: false, success_rate: 88 },
    { id: "PK-GLO-UTYS-CS", name: "1GB – Monthly", size: "1GB", validity: "30 Days",
      buyPrice: 440, price: 500, package_code: "PK-GLO-UTYS-CS", provider_code: "glo-gifting",
      available: true, is_blitz_prime: false, success_rate: 88 },
    { id: "PK-GLO-ZTOP-CS", name: "2GB – Monthly", size: "2GB", validity: "30 Days",
      buyPrice: 880, price: 950, package_code: "PK-GLO-ZTOP-CS", provider_code: "glo-gifting",
      available: true, is_blitz_prime: false, success_rate: 88 },
    { id: "PK-GLO-MAHK-CS", name: "3GB – Monthly", size: "3GB", validity: "30 Days",
      buyPrice: 1320, price: 1450, package_code: "PK-GLO-MAHK-CS", provider_code: "glo-gifting",
      available: true, is_blitz_prime: false, success_rate: 88 },
    { id: "PK-GLO-WSVP-CS", name: "5GB – Monthly", size: "5GB", validity: "30 Days",
      buyPrice: 2200, price: 2350, package_code: "PK-GLO-WSVP-CS", provider_code: "glo-gifting",
      available: true, is_blitz_prime: false, success_rate: 88 },
    { id: "PK-GLO-TPYQ-CS", name: "10GB – Monthly", size: "10GB", validity: "30 Days",
      buyPrice: 4400, price: 4600, package_code: "PK-GLO-TPYQ-CS", provider_code: "glo-gifting",
      available: true, is_blitz_prime: false, success_rate: 88 },
  ],
  "9MOBILE": [],
};

// Keep backwards compatibility
export const DATA_BUNDLES = DATA_BUNDLES_VTU;

export function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

export const ELECTRICITY_PROVIDERS = [
  { id: "EKEDC", name: "Eko Electric (EKEDC)", location: "Lagos South" },
  { id: "IKEDC", name: "Ikeja Electric (IKEDC)", location: "Lagos North" },
  { id: "IBEDC", name: "Ibadan Electric (IBEDC)", location: "Oyo/Ogun/Osun/Kwara" },
  { id: "AEDC", name: "Abuja Electric (AEDC)", location: "FCT/Niger/Nassarawa/Kogi" },
  { id: "KEDCO", name: "Kano Electric (KEDCO)", location: "Kano/Jigawa/Katsina" },
  { id: "BEDC", name: "Benin Electric (BEDC)", location: "Edo/Delta/Ondo/Ekiti" },
  { id: "PHED", name: "Port Harcourt Electric (PHED)", location: "Rivers/Bayelsa" },
  { id: "JED", name: "Jos Electric (JED)", location: "Plateau/Benue/Nasarawa" },
  { id: "ENUGU", name: "Enugu Electric (EEDC)", location: "Enugu/Ebonyi/Abia/Imo" },
  { id: "KAEDCO", name: "Kaduna Electric (KAEDCO)", location: "Kaduna/Sokoto/Kebbi" },
];

export const CABLE_PROVIDERS = [
  { id: "DSTV", name: "DStv", color: "bg-blue-600" },
  { id: "GOTV", name: "GOtv", color: "bg-green-600" },
  { id: "STARTIMES", name: "StarTimes", color: "bg-orange-500" },
];

export const CABLE_PACKAGES: Record<string, { id: string; name: string; price: number; package_code?: string; provider_code?: string }[]> = {
  DSTV: [
    { id: "dstv-access", name: "DStv Access", price: 2000, package_code: "dstv-access", provider_code: "dstv" },
    { id: "dstv-compact", name: "DStv Compact", price: 2000, package_code: "dstv-compact", provider_code: "dstv" },
    { id: "dstv-compact-plus", name: "DStv Compact Plus", price: 30000, package_code: "dstv-compact-plus", provider_code: "dstv" },
    { id: "dstv-premium", name: "DStv Premium", price: 44500, package_code: "dstv-premium", provider_code: "dstv" },
  ],
  GOTV: [
    { id: "gotv-smallie", name: "GOtv Smallie", price: 1900, package_code: "gotv-smallie", provider_code: "gotv" },
    { id: "gotv-jinja", name: "GOtv Jinja", price: 3900, package_code: "gotv-jinja", provider_code: "gotv" },
    { id: "gotv-jolli", name: "GOtv Jolli", price: 5800, package_code: "gotv-jolli", provider_code: "gotv" },
    { id: "gotv-max", name: "GOtv Max", price: 8500, package_code: "gotv-max", provider_code: "gotv" },
    { id: "gotv-supa", name: "GOtv Supa", price: 11400, package_code: "gotv-supa", provider_code: "gotv" },
  ],
  STARTIMES: [
    { id: "st-nova", name: "Nova (Daily)", price: 150, package_code: "st-nova", provider_code: "startimes" },
    { id: "st-smart", name: "Smart (Monthly)", price: 3800, package_code: "st-smart", provider_code: "startimes" },
    { id: "st-classic", name: "Classic (Monthly)", price: 4500, package_code: "st-classic", provider_code: "startimes" },
  ],
};
