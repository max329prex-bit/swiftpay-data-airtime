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

export type DataBundle = { id: string; name: string; size: string; validity: string; buyPrice: number; price: number; };

export const DATA_BUNDLES_VTU: Record<NetworkId, DataBundle[]> = {
  MTN: [
    { id: "mtn-500mb", name: "500MB", size: "500MB", validity: "30 days", buyPrice: 185, price: 230 },
    { id: "mtn-1gb", name: "1GB", size: "1GB", validity: "30 days", buyPrice: 245, price: 280 },
    { id: "mtn-2gb", name: "2GB", size: "2GB", validity: "30 days", buyPrice: 490, price: 540 },
    { id: "mtn-3gb", name: "3GB", size: "3GB", validity: "30 days", buyPrice: 735, price: 800 },
    { id: "mtn-5gb", name: "5GB", size: "5GB", validity: "30 days", buyPrice: 1260, price: 1350 },
    { id: "mtn-8gb", name: "8GB", size: "8GB", validity: "30 days", buyPrice: 2025, price: 2150 },
    { id: "mtn-10gb", name: "10GB", size: "10GB", validity: "30 days", buyPrice: 2550, price: 2700 },
    { id: "mtn-15gb", name: "15GB", size: "15GB", validity: "30 days", buyPrice: 3800, price: 4000 },
    { id: "mtn-20gb", name: "20GB", size: "20GB", validity: "30 days", buyPrice: 5050, price: 5300 },
  ],
  AIRTEL: [
    { id: "airt-75mb", name: "75MB", size: "75MB", validity: "1 day", buyPrice: 485, price: 540 },
    { id: "airt-1gb", name: "1GB", size: "1GB", validity: "30 days", buyPrice: 960, price: 1020 },
    { id: "airt-2gb", name: "2GB", size: "2GB", validity: "30 days", buyPrice: 1150, price: 1220 },
    { id: "airt-3gb", name: "3GB", size: "3GB", validity: "30 days", buyPrice: 1430, price: 1520 },
    { id: "airt-4gb", name: "4GB", size: "4GB", validity: "30 days", buyPrice: 1910, price: 2000 },
    { id: "airt-6gb", name: "6GB", size: "6GB", validity: "30 days", buyPrice: 2385, price: 2500 },
    { id: "airt-8gb", name: "8GB", size: "8GB", validity: "30 days", buyPrice: 2860, price: 3000 },
    { id: "airt-11gb", name: "11GB", size: "11GB", validity: "30 days", buyPrice: 3810, price: 4000 },
  ],
  GLO: [
    { id: "glo_1gb", name: "1GB", size: "1GB", validity: "30 days", buyPrice: 430, price: 490 },
    { id: "glo_2gb", name: "2GB", size: "2GB", validity: "30 days", buyPrice: 860, price: 940 },
    { id: "glo_4gb", name: "4GB", size: "4GB", validity: "30 days", buyPrice: 1300, price: 1400 },
    { id: "glo_5gb", name: "5GB", size: "5GB", validity: "30 days", buyPrice: 1750, price: 1870 },
    { id: "glo_10gb", name: "10GB", size: "10GB", validity: "30 days", buyPrice: 2600, price: 2750 },
    { id: "glo_18gb", name: "18GB", size: "18GB", validity: "30 days", buyPrice: 4300, price: 4550 },
  ],
  "9MOBILE": [
    { id: "9m_500mb", name: "500MB", size: "500MB", validity: "30 days", buyPrice: 460, price: 520 },
    { id: "9m_1gb", name: "1GB", size: "1GB", validity: "30 days", buyPrice: 910, price: 980 },
    { id: "9m_2gb", name: "2GB", size: "2GB", validity: "30 days", buyPrice: 1090, price: 1180 },
    { id: "9m_3gb", name: "3GB", size: "3GB", validity: "30 days", buyPrice: 1360, price: 1470 },
    { id: "9m_4gb", name: "4GB", size: "4GB", validity: "30 days", buyPrice: 1810, price: 1950 },
    { id: "9m_11gb", name: "11GB", size: "11GB", validity: "30 days", buyPrice: 3610, price: 3820 },
  ],
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
  { id: "SHOWMAX", name: "Showmax", color: "bg-purple-600" },
];

export const CABLE_PACKAGES: Record<string, { id: string; name: string; price: number }[]> = {
  DSTV: [
    { id: "dstv-padi", name: "DStv Padi", price: 4400 },
    { id: "dstv-yanga", name: "DStv Yanga", price: 6000 },
    { id: "dstv-confam", name: "DStv Confam", price: 11000 },
    { id: "dstv-compact", name: "DStv Compact", price: 19000 },
    { id: "dstv-compact-plus", name: "DStv Compact Plus", price: 30000 },
    { id: "dstv-premium", name: "DStv Premium", price: 44500 },
  ],
  GOTV: [
    { id: "gotv-smallie", name: "GOtv Smallie", price: 1900 },
    { id: "gotv-jinja", name: "GOtv Jinja", price: 3900 },
    { id: "gotv-jolli", name: "GOtv Jolli", price: 5800 },
    { id: "gotv-max", name: "GOtv Max", price: 8500 },
    { id: "gotv-supa", name: "GOtv Supa", price: 11400 },
    { id: "gotv-supa-plus", name: "GOtv Supa Plus", price: 16800 },
  ],
  STARTIMES: [
    { id: "st-nova", name: "Nova (Daily)", price: 150 },
    { id: "st-basic", name: "Basic (Weekly)", price: 700 },
    { id: "st-smart", name: "Smart (Monthly)", price: 3800 },
    { id: "st-classic", name: "Classic (Monthly)", price: 4500 },
    { id: "st-super", name: "Super (Monthly)", price: 7500 },
  ],
  SHOWMAX: [
    { id: "shx-mobile", name: "Mobile", price: 1600 },
    { id: "shx-entertainment", name: "Entertainment", price: 3200 },
    { id: "shx-premier", name: "Premier", price: 6300 },
  ],
};
