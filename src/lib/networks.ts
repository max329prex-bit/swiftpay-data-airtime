export type NetworkId = "MTN" | "GLO" | "AIRTEL" | "9MOBILE";

export const NETWORKS: { id: NetworkId; name: string; color: string; bg: string; prefixes: string[] }[] = [
  { id: "MTN", name: "MTN", color: "text-black", bg: "bg-[hsl(var(--mtn))]", prefixes: ["0803","0806","0703","0706","0813","0816","0810","0814","0903","0906","0913","0916"] },
  { id: "GLO", name: "Glo", color: "text-white", bg: "bg-[hsl(var(--glo))]", prefixes: ["0805","0807","0705","0815","0811","0905","0915"] },
  { id: "AIRTEL", name: "Airtel", color: "text-white", bg: "bg-[hsl(var(--airtel))]", prefixes: ["0802","0808","0708","0812","0701","0902","0901","0907","0912"] },
  { id: "9MOBILE", name: "9mobile", color: "text-white", bg: "bg-[hsl(var(--nine))]", prefixes: ["0809","0817","0818","0908","0909"] },
];

export function detectNetwork(phone: string): NetworkId | null {
  const p = phone.replace(/\D/g, "").replace(/^234/, "0");
  if (p.length < 4) return null;
  const prefix = p.slice(0, 4);
  return NETWORKS.find(n => n.prefixes.includes(prefix))?.id ?? null;
}

export const DATA_BUNDLES: Record<NetworkId, { id: string; name: string; size: string; validity: string; price: number; tag?: string }[]> = {
  MTN: [
    { id: "mtn-1", name: "Daily Plan", size: "75MB", validity: "1 day", price: 75 },
    { id: "mtn-2", name: "AWUF Daily", size: "200MB", validity: "1 day", price: 200, tag: "Hot" },
    { id: "mtn-3", name: "Weekly Plan", size: "1GB", validity: "7 days", price: 800 },
    { id: "mtn-4", name: "Monthly", size: "2GB", validity: "30 days", price: 1500 },
    { id: "mtn-5", name: "Mega", size: "6GB", validity: "30 days", price: 3000, tag: "Best value" },
    { id: "mtn-6", name: "XtraValue", size: "20GB", validity: "30 days", price: 7500 },
  ],
  GLO: [
    { id: "glo-1", name: "Daily", size: "100MB", validity: "1 day", price: 100 },
    { id: "glo-2", name: "Weekly", size: "1.35GB", validity: "7 days", price: 750 },
    { id: "glo-3", name: "Monthly", size: "5.8GB", validity: "30 days", price: 2500, tag: "Popular" },
    { id: "glo-4", name: "Mega Plan", size: "13.25GB", validity: "30 days", price: 5000 },
  ],
  AIRTEL: [
    { id: "air-1", name: "Daily", size: "100MB", validity: "1 day", price: 100 },
    { id: "air-2", name: "Weekly", size: "1GB", validity: "7 days", price: 800 },
    { id: "air-3", name: "Monthly", size: "3GB", validity: "30 days", price: 1500, tag: "Hot" },
    { id: "air-4", name: "Mega", size: "10GB", validity: "30 days", price: 4000 },
  ],
  "9MOBILE": [
    { id: "9m-1", name: "Daily", size: "100MB", validity: "1 day", price: 100 },
    { id: "9m-2", name: "Weekly", size: "1GB", validity: "7 days", price: 1000 },
    { id: "9m-3", name: "Monthly", size: "4.5GB", validity: "30 days", price: 2000 },
  ],
};

export function naira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}
