export type NetworkId = "MTN" | "GLO" | "AIRTEL" | "9MOBILE";
export type Network = "MTN" | "AIRTEL" | "GLO" | "9MOBILE";

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

export function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

// ─── Data Plan Interface ───────────────────────────────────────
export interface DataPlan {
  id: string;              // AidaPay package_api_code (sent as `bundle` to vtu-purchase)
  name: string;
  size: string;            // "2.5GB", "10GB", etc.
  validity: string;        // "2 Days", "7 Days", "30 Days"
  sell_price: number;      // What customer pays (₦)
  cost_price: number;      // AidaPay cost (₦)
  profit: number;
  provider_code: string;   // Sent as `provider` to vtu-purchase
  duration: "daily" | "weekly" | "monthly";
  is_blitz_prime: boolean;
  available: boolean;
  coming_soon?: boolean;
  badge?: "most_bought" | "best_value" | "awuf" | "hot";
  success_rate?: number;
}

// ─── Data Plans — AidaPay codes + your sell prices ────────────
export const DATA_PLANS: Record<Network, DataPlan[]> = {

  // ───── MTN (15 plans · 7 Blitz Prime) ─────────────────────
  MTN: [
    // DAILY
    { id: "MTN-1GB-1DAY", name: "1GB – 1 Day", size: "1GB", validity: "1 Day",
      sell_price: 270, cost_price: 260, profit: 10, provider_code: "mtn-sme",
      duration: "daily", is_blitz_prime: true, available: false, coming_soon: true, success_rate: 97 },
    { id: "PK-MTN-NTZS", name: "2GB – 2 Days", size: "2GB", validity: "2 Days",
      sell_price: 790, cost_price: 738, profit: 52, provider_code: "mtn-sme",
      duration: "daily", is_blitz_prime: false, available: true, success_rate: 96 },
    { id: "PK-MTN-XALZ", name: "2.5GB – 2 Days", size: "2.5GB", validity: "2 Days",
      sell_price: 930, cost_price: 880, profit: 50, provider_code: "mtn-sme",
      duration: "daily", is_blitz_prime: true, available: true, badge: "most_bought", success_rate: 96 },
    { id: "PK-MTN-PUZI", name: "3.2GB – 2 Days", size: "3.2GB", validity: "2 Days",
      sell_price: 1040, cost_price: 985, profit: 55, provider_code: "mtn-sme",
      duration: "daily", is_blitz_prime: true, available: true, badge: "hot", success_rate: 95 },
    // WEEKLY
    { id: "PK-MTN-LCEM", name: "1GB + 1GB YouTube", size: "1GB+YT", validity: "7 Days",
      sell_price: 850, cost_price: 785, profit: 65, provider_code: "mtn-sme",
      duration: "weekly", is_blitz_prime: false, available: true, success_rate: 94 },
    { id: "PK-MTN-DT-2GB", name: "2GB – 7 Days", size: "2GB", validity: "7 Days",
      sell_price: 1200, cost_price: 1150, profit: 50, provider_code: "mtn-sme",
      duration: "weekly", is_blitz_prime: false, available: true, success_rate: 95 },
    { id: "PK-MTN-SSQBA", name: "3.5GB – Weekly", size: "3.5GB", validity: "7 Days",
      sell_price: 1578, cost_price: 1478, profit: 100, provider_code: "mtn-sme",
      duration: "weekly", is_blitz_prime: true, available: true, success_rate: 95 },
    { id: "PK-MTN-AWUF-FDDU", name: "6GB – Weekly", size: "6GB", validity: "7 Days",
      sell_price: 2560, cost_price: 2460, profit: 100, provider_code: "mtn-sme",
      duration: "weekly", is_blitz_prime: true, available: true, badge: "best_value", success_rate: 94 },
    // MONTHLY
    { id: "PK-MTN-GOODY-1200MB", name: "1.2GB Social – 30 Days", size: "1.2GB", validity: "30 Days",
      sell_price: 500, cost_price: 443, profit: 57, provider_code: "mtn-sme",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 93 },
    { id: "PK-MTN-XDPW-ACB", name: "7GB + 2GB Night – Monthly", size: "7GB", validity: "30 Days",
      sell_price: 3600, cost_price: 3447, profit: 153, provider_code: "mtn-sme",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 94 },
    { id: "PK-MTN-SEYV", name: "10GB + Calls – Monthly", size: "10GB", validity: "30 Days",
      sell_price: 4583, cost_price: 4433, profit: 150, provider_code: "mtn-sme",
      duration: "monthly", is_blitz_prime: true, available: true, success_rate: 94 },
    { id: "PK-MTN-NVIQ", name: "16.5GB + Calls – Monthly", size: "16.5GB", validity: "30 Days",
      sell_price: 6592, cost_price: 6402, profit: 190, provider_code: "mtn-sme",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 93 },
    { id: "PK-MTN-XDPW-AUB", name: "20GB + Night – Monthly", size: "20GB", validity: "30 Days",
      sell_price: 7587, cost_price: 7387, profit: 200, provider_code: "mtn-sme",
      duration: "monthly", is_blitz_prime: true, available: true, badge: "best_value", success_rate: 93 },
    { id: "PK-MTN-XDWW-ACB", name: "25GB + Night – Monthly", size: "25GB", validity: "30 Days",
      sell_price: 9065, cost_price: 8865, profit: 200, provider_code: "mtn-sme",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 93 },
    { id: "PK-MTN-TBKX", name: "75GB – Monthly", size: "75GB", validity: "30 Days",
      sell_price: 18080, cost_price: 17730, profit: 350, provider_code: "mtn-sme",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 92 },
    // ─── BSPlug MTN (alternative provider — network_id=1) ────
    { id: "BSP-755", name: "1GB – 8 Days", size: "1GB", validity: "8 Days",
      sell_price: 450, cost_price: 410, profit: 40, provider_code: "bsplug-1",
      duration: "weekly", is_blitz_prime: true, available: true, badge: "best_value", success_rate: 93 },
    { id: "BSP-665", name: "2GB – 2 Days", size: "2GB", validity: "2 Days",
      sell_price: 800, cost_price: 740, profit: 60, provider_code: "bsplug-1",
      duration: "daily", is_blitz_prime: false, available: true, success_rate: 91 },
    { id: "BSP-764", name: "5GB – 14 Days", size: "5GB", validity: "14 Days",
      sell_price: 1550, cost_price: 1400, profit: 150, provider_code: "bsplug-1",
      duration: "weekly", is_blitz_prime: true, available: true, badge: "hot", success_rate: 92 },
  ],

  // ───── AIRTEL (12 plans · 6 Blitz Prime) ────────────────────
  AIRTEL: [
    // DAILY
    { id: "PK-AIRTEL-GIFTING-EVTN", name: "230MB – 2 Days", size: "230MB", validity: "2 Days",
      sell_price: 200, cost_price: 198, profit: 2, provider_code: "airtel-sme-cg",
      duration: "daily", is_blitz_prime: true, available: true, badge: "most_bought", success_rate: 93 },
    { id: "PK-AIRTEL-PNDD-1GB-SOCIAL", name: "1GB Social – 3 Days", size: "1GB", validity: "3 Days",
      sell_price: 350, cost_price: 296, profit: 54, provider_code: "airtel-sme-cg",
      duration: "daily", is_blitz_prime: false, available: true, success_rate: 92 },
    { id: "PK-AIRTEL-PNDD-1.5GB-BINGE", name: "2GB – 2 Days", size: "2GB", validity: "2 Days",
      sell_price: 645, cost_price: 595, profit: 50, provider_code: "airtel-sme-cg",
      duration: "daily", is_blitz_prime: true, available: true, badge: "hot", success_rate: 92 },
    { id: "PK-AIRTEL-PNDD-2GB-BINGE", name: "3GB – 2 Days", size: "3GB", validity: "2 Days",
      sell_price: 790, cost_price: 740, profit: 50, provider_code: "airtel-sme-cg",
      duration: "daily", is_blitz_prime: true, available: true, success_rate: 91 },
    { id: "PK-AIRTEL-NMA-3.2GB", name: "3.2GB – 2 Days", size: "3.2GB", validity: "2 Days",
      sell_price: 1050, cost_price: 995, profit: 55, provider_code: "airtel-sme-cg",
      duration: "daily", is_blitz_prime: true, available: true, success_rate: 91 },
    // WEEKLY
    { id: "PK-AIRTEL-PNDD-1.5GB-SOCIAL", name: "1.5GB Social – 7 Days", size: "1.5GB", validity: "7 Days",
      sell_price: 550, cost_price: 495, profit: 55, provider_code: "airtel-sme-cg",
      duration: "weekly", is_blitz_prime: true, available: true, badge: "best_value", success_rate: 92 },
    { id: "PK-AIRTEL-PNDD-1GB-WEEKLY", name: "1GB – Weekly", size: "1GB", validity: "7 Days",
      sell_price: 840, cost_price: 790, profit: 50, provider_code: "airtel-sme-cg",
      duration: "weekly", is_blitz_prime: false, available: true, success_rate: 91 },
    // MONTHLY
    { id: "PK-AIRTEL-PNDD-2GB-GIFTING", name: "2GB – Monthly", size: "2GB", validity: "30 Days",
      sell_price: 1600, cost_price: 1485, profit: 115, provider_code: "airtel-sme-cg",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 91 },
    { id: "PK-AIRTEL-PNDD-3GB-GIFTING", name: "3GB – Monthly", size: "3GB", validity: "30 Days",
      sell_price: 2100, cost_price: 1980, profit: 120, provider_code: "airtel-sme-cg",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 91 },
    { id: "PK-AIRTEL-PNDD-4GB-GIFTING", name: "4GB – Monthly", size: "4GB", validity: "30 Days",
      sell_price: 2600, cost_price: 2470, profit: 130, provider_code: "airtel-sme-cg",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 91 },
    { id: "PK-AIRTEL-PNDD-8GB-GIFTING", name: "8GB – Monthly", size: "8GB", validity: "30 Days",
      sell_price: 3150, cost_price: 2965, profit: 185, provider_code: "airtel-sme-cg",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 91 },
    { id: "PK-AIRTEL-PNDD-10GB-GIFTING", name: "10GB – Monthly", size: "10GB", validity: "30 Days",
      sell_price: 4100, cost_price: 3950, profit: 150, provider_code: "airtel-sme-cg",
      duration: "monthly", is_blitz_prime: true, available: true, success_rate: 90 },
    // ─── BSPlug Airtel (alternative provider — network_id=3) ──
    { id: "BSP-628", name: "1GB – 3 Days", size: "1GB", validity: "3 Days",
      sell_price: 350, cost_price: 300, profit: 50, provider_code: "bsplug-3",
      duration: "daily", is_blitz_prime: false, available: true, badge: "awuf", success_rate: 92 },
    { id: "BSP-624", name: "2GB – 2 Days", size: "2GB", validity: "2 Days",
      sell_price: 650, cost_price: 600, profit: 50, provider_code: "bsplug-3",
      duration: "daily", is_blitz_prime: false, available: true, success_rate: 91 },
    { id: "BSP-570", name: "3GB – 2 Days", size: "3GB", validity: "2 Days",
      sell_price: 950, cost_price: 800, profit: 150, provider_code: "bsplug-3",
      duration: "daily", is_blitz_prime: true, available: true, badge: "hot", success_rate: 91 },
    { id: "BSP-620", name: "5GB – 7 Days", size: "5GB", validity: "7 Days",
      sell_price: 1630, cost_price: 1480, profit: 150, provider_code: "bsplug-3",
      duration: "weekly", is_blitz_prime: true, available: true, success_rate: 90 },
    { id: "BSP-629", name: "10GB – 7 Days", size: "10GB", validity: "7 Days",
      sell_price: 3200, cost_price: 2970, profit: 230, provider_code: "bsplug-3",
      duration: "weekly", is_blitz_prime: false, available: true, badge: "best_value", success_rate: 89 },
  ],

  // ───── GLO (13 plans · 6 Blitz Prime) ───────────────────────
  GLO: [
    // DAILY
    { id: "glo-awuf-data-750mb", name: "750MB AWUF – 1 Day", size: "750MB", validity: "1 Day",
      sell_price: 245, cost_price: 195, profit: 50, provider_code: "gloawufdata",
      duration: "daily", is_blitz_prime: true, available: true, badge: "awuf", success_rate: 90 },
    { id: "PK-GLO-UTYS-CXZ", name: "1GB – 3 Days", size: "1GB", validity: "3 Days",
      sell_price: 300, cost_price: 275, profit: 25, provider_code: "glo-gifting",
      duration: "daily", is_blitz_prime: true, available: true, badge: "most_bought", success_rate: 89 },
    { id: "glo-awuf-data-1.5gb", name: "1.5GB AWUF – 1 Day", size: "1.5GB", validity: "1 Day",
      sell_price: 350, cost_price: 290, profit: 60, provider_code: "gloawufdata",
      duration: "daily", is_blitz_prime: true, available: true, badge: "awuf", success_rate: 90 },
    { id: "glo-awuf-data-2.5gb", name: "2.5GB AWUF – 2 Days", size: "2.5GB", validity: "2 Days",
      sell_price: 550, cost_price: 490, profit: 60, provider_code: "gloawufdata",
      duration: "daily", is_blitz_prime: true, available: true, badge: "awuf", success_rate: 90 },
    // WEEKLY
    { id: "PK-GLO-WGEI-CS", name: "200MB – 14 Days", size: "200MB", validity: "14 Days",
      sell_price: 100, cost_price: 90, profit: 10, provider_code: "glo-gifting",
      duration: "weekly", is_blitz_prime: false, available: true, badge: "most_bought", success_rate: 88 },
    { id: "PK-GLO-UTYS-CAZ", name: "1GB – 7 Days", size: "1GB", validity: "7 Days",
      sell_price: 400, cost_price: 335, profit: 65, provider_code: "glo-gifting",
      duration: "weekly", is_blitz_prime: false, available: true, success_rate: 89 },
    { id: "glo-awuf-data-10gb", name: "10GB AWUF – 7 Days", size: "10GB", validity: "7 Days",
      sell_price: 2050, cost_price: 1950, profit: 100, provider_code: "gloawufdata",
      duration: "weekly", is_blitz_prime: true, available: true, badge: "best_value", success_rate: 89 },
    // MONTHLY
    { id: "PK-GLO-DSEC-CS", name: "500MB – Monthly", size: "500MB", validity: "30 Days",
      sell_price: 280, cost_price: 230, profit: 50, provider_code: "glo-gifting",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 88 },
    { id: "PK-GLO-UTYS-CS", name: "1GB – Monthly", size: "1GB", validity: "30 Days",
      sell_price: 500, cost_price: 440, profit: 60, provider_code: "glo-gifting",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 88 },
    { id: "PK-GLO-ZTOP-CS", name: "2GB – Monthly", size: "2GB", validity: "30 Days",
      sell_price: 950, cost_price: 880, profit: 70, provider_code: "glo-gifting",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 88 },
    { id: "PK-GLO-MAHK-CS", name: "3GB – Monthly", size: "3GB", validity: "30 Days",
      sell_price: 1450, cost_price: 1320, profit: 130, provider_code: "glo-gifting",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 88 },
    { id: "PK-GLO-WSVP-CS", name: "5GB – Monthly", size: "5GB", validity: "30 Days",
      sell_price: 2350, cost_price: 2200, profit: 150, provider_code: "glo-gifting",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 88 },
    { id: "PK-GLO-TPYQ-CS", name: "10GB – Monthly", size: "10GB", validity: "30 Days",
      sell_price: 4600, cost_price: 4400, profit: 200, provider_code: "glo-gifting",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 88 },
    // ─── BSPlug Glo (alternative provider — network_id=2) ────
    { id: "BSP-339", name: "1.5GB – Daily", size: "1.5GB", validity: "1 Day",
      sell_price: 350, cost_price: 288, profit: 62, provider_code: "bsplug-2",
      duration: "daily", is_blitz_prime: false, available: true, badge: "awuf", success_rate: 92 },
    { id: "BSP-340", name: "2.5GB – 2 Days", size: "2.5GB", validity: "2 Days",
      sell_price: 550, cost_price: 480, profit: 70, provider_code: "bsplug-2",
      duration: "daily", is_blitz_prime: false, available: true, success_rate: 91 },
    { id: "BSP-711", name: "3.55GB – 2 Days", size: "3.55GB", validity: "2 Days",
      sell_price: 660, cost_price: 580, profit: 80, provider_code: "bsplug-2",
      duration: "daily", is_blitz_prime: true, available: true, badge: "hot", success_rate: 91 },
    { id: "BSP-713", name: "5.1GB – 2 Days", size: "5.1GB", validity: "2 Days",
      sell_price: 1100, cost_price: 990, profit: 110, provider_code: "bsplug-2",
      duration: "daily", is_blitz_prime: false, available: true, success_rate: 90 },
    { id: "BSP-341", name: "10GB – 7 Days", size: "10GB", validity: "7 Days",
      sell_price: 2100, cost_price: 1950, profit: 150, provider_code: "bsplug-2",
      duration: "weekly", is_blitz_prime: true, available: true, badge: "best_value", success_rate: 90 },
  ],

  // ───── 9MOBILE (4 confirmed AidaPay plans) ─────────────────
  "9MOBILE": [
    { id: "9mobile-awuf-data-500mb", name: "500MB AWUF – 1 Day", size: "500MB", validity: "1 Day",
      sell_price: 280, cost_price: 250, profit: 30, provider_code: "9mobile-awuf-data",
      duration: "daily", is_blitz_prime: true, available: true, badge: "awuf", success_rate: 91 },
    { id: "9mobile-awuf-data-1gb", name: "1GB AWUF – 1 Day", size: "1GB", validity: "1 Day",
      sell_price: 450, cost_price: 420, profit: 30, provider_code: "9mobile-awuf-data",
      duration: "daily", is_blitz_prime: true, available: true, badge: "most_bought", success_rate: 90 },
    { id: "9mobile-awuf-data-2gb", name: "2GB AWUF – 2 Days", size: "2GB", validity: "2 Days",
      sell_price: 800, cost_price: 750, profit: 50, provider_code: "9mobile-awuf-data",
      duration: "daily", is_blitz_prime: false, available: true, success_rate: 89 },
    { id: "9mobile-awuf-data-5gb", name: "5GB AWUF – Monthly", size: "5GB", validity: "30 Days",
      sell_price: 1950, cost_price: 1800, profit: 150, provider_code: "9mobile-awuf-data",
      duration: "monthly", is_blitz_prime: true, available: true, badge: "best_value", success_rate: 90 },
    // ─── BSPlug 9Mobile (alternative provider — network_id=4) ─
    { id: "BSP-231", name: "1GB – Monthly", size: "1GB", validity: "30 Days",
      sell_price: 500, cost_price: 420, profit: 80, provider_code: "bsplug-4",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 91 },
    { id: "BSP-242", name: "2GB – Monthly", size: "2GB", validity: "30 Days",
      sell_price: 960, cost_price: 840, profit: 120, provider_code: "bsplug-4",
      duration: "monthly", is_blitz_prime: true, available: true, badge: "best_value", success_rate: 91 },
    { id: "BSP-238", name: "3GB – Monthly", size: "3GB", validity: "30 Days",
      sell_price: 1420, cost_price: 1260, profit: 160, provider_code: "bsplug-4",
      duration: "monthly", is_blitz_prime: false, available: true, success_rate: 90 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────
export const getPlans = (network: Network, duration?: "daily" | "weekly" | "monthly"): DataPlan[] => {
  const plans = DATA_PLANS[network].filter(p => p.available || p.coming_soon);
  return duration ? plans.filter(p => p.duration === duration) : plans;
};

export const getBlitzPrimePlans = (network: Network, duration?: "daily" | "weekly" | "monthly"): DataPlan[] => {
  const plans = DATA_PLANS[network].filter(p => p.is_blitz_prime);
  return duration ? plans.filter(p => p.duration === duration) : plans;
};

export const getPlanById = (id: string): DataPlan | undefined =>
  (Object.values(DATA_PLANS) as DataPlan[][]).flat().find(p => p.id === id);

// ─── Backwards Compat ─────────────────────────────────────────
export type DataBundle = {
  id: string; name: string; size: string; validity: string;
  buyPrice: number; price: number; package_code: string; provider_code: string;
  available?: boolean; coming_soon?: boolean; is_blitz_prime?: boolean; success_rate?: number;
};

const toBundle = (p: DataPlan): DataBundle => ({
  id: p.id, name: p.name, size: p.size, validity: p.validity,
  buyPrice: p.cost_price, price: p.sell_price,
  package_code: p.id, provider_code: p.provider_code,
  available: p.available, coming_soon: p.coming_soon,
  is_blitz_prime: p.is_blitz_prime, success_rate: p.success_rate,
});

export const DATA_BUNDLES_VTU: Record<NetworkId, DataBundle[]> = {
  MTN: DATA_PLANS.MTN.map(toBundle),
  AIRTEL: DATA_PLANS.AIRTEL.map(toBundle),
  GLO: DATA_PLANS.GLO.map(toBundle),
  "9MOBILE": DATA_PLANS["9MOBILE"].map(toBundle),
};
export const DATA_BUNDLES = DATA_BUNDLES_VTU;

// ─── Other services ───────────────────────────────────────────
export const ELECTRICITY_PROVIDERS = [
  { id: "EKEDC",  name: "Eko Electric (EKEDC)",        location: "Lagos South",              code: "ekedc"  },
  { id: "IKEDC",  name: "Ikeja Electric (IKEDC)",       location: "Lagos North",              code: "ikedc"  },
  { id: "IBEDC",  name: "Ibadan Electric (IBEDC)",      location: "Oyo/Ogun/Osun/Kwara",     code: "ibedc"  },
  { id: "AEDC",   name: "Abuja Electric (AEDC)",        location: "FCT/Niger/Nassarawa/Kogi", code: "aedc"   },
  { id: "KEDCO",  name: "Kano Electric (KEDCO)",        location: "Kano/Jigawa/Katsina",     code: "kedco"  },
  { id: "BEDC",   name: "Benin Electric (BEDC)",        location: "Edo/Delta/Ondo/Ekiti",    code: "bedc"   },
  { id: "PHED",   name: "Port Harcourt Electric (PHED)",location: "Rivers/Bayelsa",          code: "phed"   },
  { id: "JED",    name: "Jos Electric (JED)",           location: "Plateau/Benue/Nasarawa",  code: "jed"    },
  { id: "ENUGU",  name: "Enugu Electric (EEDC)",        location: "Enugu/Ebonyi/Abia/Imo",  code: "eedc"   },
  { id: "KAEDCO", name: "Kaduna Electric (KAEDCO)",     location: "Kaduna/Sokoto/Kebbi",     code: "kaedco" },
];

export const CABLE_PROVIDERS = [
  { id: "DSTV",      name: "DStv",      color: "bg-blue-600",   aidapay_code: "dstv"      },
  { id: "GOTV",      name: "GOtv",      color: "bg-green-600",  aidapay_code: "gotv"      },
  { id: "STARTIMES", name: "StarTimes", color: "bg-orange-500", aidapay_code: "startimes" },
];

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
    { id: "st-nova",    name: "Nova (Daily)",    price: 150,  package_code: "st-nova",    provider_code: "startimes", aidapay_code: "startimes-nova"    },
    { id: "st-smart",   name: "Smart (Monthly)", price: 3800, package_code: "st-smart",   provider_code: "startimes", aidapay_code: "startimes-smart"   },
    { id: "st-classic", name: "Classic (Monthly)",price: 4500, package_code: "st-classic", provider_code: "startimes", aidapay_code: "startimes-classic" },
  ],
};
