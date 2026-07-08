// Source of truth: database packages table
// This file keeps ONLY: network identifiers, prefixes, colors, and utilities.
// NO plan data here. Plans are fetched from the get-packages edge function.

export type NetworkId = "MTN" | "GLO" | "AIRTEL" | "9MOBILE";
export type Network   = "MTN" | "AIRTEL" | "GLO" | "9MOBILE";

export const NETWORKS: {
  id: NetworkId;
  name: string;
  color: string;
  bg: string;
  prefixes: string[];
  logo: string;
}[] = [
  {
    id: "MTN", name: "MTN", color: "text-black", bg: "bg-yellow-400", logo: "MTN",
    prefixes: ["0803","0806","0703","0706","0813","0816","0810","0814","0903","0906","0913","0916"],
  },
  {
    id: "AIRTEL", name: "Airtel", color: "text-white", bg: "bg-red-600", logo: "Airtel",
    prefixes: ["0802","0808","0708","0812","0701","0902","0901","0907","0912"],
  },
  {
    id: "GLO", name: "Glo", color: "text-white", bg: "bg-green-600", logo: "Glo",
    prefixes: ["0805","0807","0705","0815","0811","0905","0915"],
  },
  {
    id: "9MOBILE", name: "9mobile", color: "text-white", bg: "bg-green-500", logo: "9M",
    prefixes: ["0809","0817","0818","0908","0909"],
  },
];

/** Detect network from phone prefix */
export function detectNetwork(phone: string): NetworkId | null {
  const p = phone.replace(/\D/g, "").replace(/^234/, "0");
  if (p.length < 4) return null;
  const prefix = p.slice(0, 4);
  return NETWORKS.find(n => n.prefixes.includes(prefix))?.id ?? null;
}

/** Format amount as Nigerian Naira */
export function naira(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0,
  }).format(n);
}

/** Plan interface - matches get-packages edge function response */
export interface DataPlan {
  id: string;
  name: string;
  size: string;
  validity: string;
  sell_price: number;
  provider_code: string;
  package_code: string;
  bp_value: number;
  tier: "stable" | "promo";
  health_score: number;
  is_blitz_prime: boolean;
  available: boolean;
  coming_soon?: boolean;
  success_rate?: number;
  unavailable_reason?: string;
}

/** Nigerian electricity distribution companies (DISCOs)
 *  code = AidaPay provider_code (backend appends -prepaid or -postpaid)
 */
export interface ElectricityProvider {
  name: string;
  code: string;
}

export const ELECTRICITY_PROVIDERS: ElectricityProvider[] = [
  { name: "Ikeja Electric (IKEDC)",          code: "ikedc"    },
  { name: "Eko Electricity (EKEDC)",          code: "ekedc"    },
  { name: "Abuja Electricity (AEDC)",         code: "aedc"     },
  { name: "Port Harcourt Electric (PHEDC)",   code: "phedc"    },
  { name: "Enugu Electricity (EEDC)",         code: "eedc"     },
  { name: "Benin Electricity (BEDC)",         code: "bedc"     },
  { name: "Ibadan Electricity (IBEDC)",       code: "ibedc"    },
  { name: "Kaduna Electricity (KAEDCO)",      code: "kaedco"   },
  { name: "Kano Electricity (KEDCO)",         code: "kedco"    },
  { name: "Jos Electricity (JEDC)",           code: "jos"      },
  { name: "Yola Electricity (YEDC)",          code: "yedc"     },
];

/** Cable TV providers */
export const CABLE_PROVIDERS = [
  { id: "DSTV",      name: "DStv",      color: "bg-blue-600",   aidapay_code: "dstv"      },
  { id: "GOTV",      name: "GOtv",      color: "bg-green-600",  aidapay_code: "gotv"      },
  { id: "STARTIMES", name: "StarTimes", color: "bg-orange-500", aidapay_code: "startimes" },
];

/** Cable TV packages */
export const CABLE_PACKAGES: Record<string, { id: string; name: string; price: number; package_code?: string; provider_code?: string; aidapay_code: string }[]> = {
  DSTV: [
    { id: "dstv-access",       name: "DStv Access",       price: 2000,  package_code: "dstv-access",       provider_code: "dstv", aidapay_code: "dstv-access"       },
    { id: "dstv-compact",      name: "DStv Compact",      price: 9000,  package_code: "dstv-compact",      provider_code: "dstv", aidapay_code: "dstv-compact"      },
    { id: "dstv-compact-plus", name: "DStv Compact Plus", price: 14250, package_code: "dstv-compact-plus", provider_code: "dstv", aidapay_code: "dstv-compact-plus" },
    { id: "dstv-premium",      name: "DStv Premium",      price: 24500, package_code: "dstv-premium",      provider_code: "dstv", aidapay_code: "dstv-premium"      },
  ],
  GOTV: [
    { id: "gotv-smallie", name: "GOtv Smallie", price: 1900,  package_code: "gotv-smallie", provider_code: "gotv", aidapay_code: "gotv-smallie" },
    { id: "gotv-jinja",   name: "GOtv Jinja",   price: 3900,  package_code: "gotv-jinja",   provider_code: "gotv", aidapay_code: "gotv-jinja"   },
    { id: "gotv-jolli",   name: "GOtv Jolli",   price: 5800,  package_code: "gotv-jolli",   provider_code: "gotv", aidapay_code: "gotv-jolli"   },
    { id: "gotv-max",     name: "GOtv Max",     price: 8500,  package_code: "gotv-max",     provider_code: "gotv", aidapay_code: "gotv-max"     },
    { id: "gotv-supa",    name: "GOtv Supa",    price: 11400, package_code: "gotv-supa",    provider_code: "gotv", aidapay_code: "gotv-supa"    },
  ],
  STARTIMES: [
    { id: "st-nova",    name: "Nova (Daily)",      price: 150,  package_code: "st-nova",    provider_code: "startimes", aidapay_code: "startimes-nova"    },
    { id: "st-smart",   name: "Smart (Monthly)",   price: 3800, package_code: "st-smart",   provider_code: "startimes", aidapay_code: "startimes-smart"   },
    { id: "st-classic", name: "Classic (Monthly)", price: 4500, package_code: "st-classic", provider_code: "startimes", aidapay_code: "startimes-classic" },
  ],
};
