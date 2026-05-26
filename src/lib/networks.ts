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

/** Plan interface — matches get-packages edge function response */
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

/** Nigerian electricity distribution companies (DISCOs) — static structural data */
export interface ElectricityProvider {
  name: string;
  code: string;  // AidaPay provider_code prefix (backend appends -prepaid or -postpaid)
}

export const ELECTRICITY_PROVIDERS: ElectricityProvider[] = [
  { name: "Ikeja Electric (IKEDC)",          code: "ikeja-electric"   },
  { name: "Eko Electricity (EKEDC)",          code: "eko-electric"     },
  { name: "Abuja Electricity (AEDC)",         code: "abuja-electric"   },
  { name: "Port Harcourt Electric (PHEDC)",   code: "ph-electric"      },
  { name: "Enugu Electricity (EEDC)",         code: "enugu-electric"   },
  { name: "Benin Electricity (BEDC)",         code: "benin-electric"   },
  { name: "Ibadan Electricity (IBEDC)",       code: "ibadan-electric"  },
  { name: "Kaduna Electricity (KAEDCO)",      code: "kaduna-electric"  },
  { name: "Kano Electricity (KEDCO)",         code: "kano-electric"    },
  { name: "Jos Electricity (JEDC)",           code: "jos-electric"     },
  { name: "Yola Electricity (YEDC)",          code: "yola-electric"    },
];
