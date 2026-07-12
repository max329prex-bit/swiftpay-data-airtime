import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Zap, Globe, Server, Key, ShieldCheck, ChevronDown, ChevronUp, Check, Copy, Terminal, Sparkles
} from "lucide-react";

const BASE_URL = "https://tljnhlhzyntotadxoypz.supabase.co/functions/v1";

const STATUS_BADGES: Record<string, string> = {
  GET:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  POST: "bg-purple-500/15 text-purple-400 border-purple-500/25",
};

interface Endpoint {
  method: string;
  path: string;
  title: string;
  description: string;
  auth: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
  response?: object;
  example?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api-balance",
    title: "Check Balance",
    description: "Get your current wallet balance in NGN before making purchases.",
    auth: "x-api-key",
    response: { success: true, balance: 15420, currency: "NGN" },
    example: `curl -H "x-api-key: bp_abc123..." \\\n  ${BASE_URL}/api-balance`,
  },
  {
    method: "GET",
    path: "/api-plans",
    title: "List Data Plans",
    description: "All available data bundles across MTN, Airtel, Glo, and 9mobile. 2% API discount applied automatically.",
    auth: "x-api-key",
    response: { success: true, plans: [{ id: "uuid", name: "1GB - 30 Days", network: "MTN", size: "1GB", validity: "30 Days", price: 280, api_price: 274.4, discount: "2%", provider: "partner", available: true, health_score: 0.95 }] },
    example: `curl -H "x-api-key: bp_abc123..." \\\n  ${BASE_URL}/api-plans`,
  },
  {
    method: "GET",
    path: "/api-services",
    title: "List Services",
    description: "Available electricity providers and cable TV providers with packages.",
    auth: "x-api-key",
    response: { success: true, electricity_providers: [{ name: "Ikeja Electric (IKEDC)", code: "ikeja-electric" }], cable_providers: [{ id: "DSTV", name: "DStv", code: "dstv" }], cable_packages: [{ provider: "dstv", code: "dstv-compact", name: "DStv Compact", price: 9000 }] },
    example: `curl -H "x-api-key: bp_abc123..." \\\n  ${BASE_URL}/api-services`,
  },
  {
    method: "POST",
    path: "/api-verify",
    title: "Verify Customer",
    description: "Verify electricity meter or cable TV smartcard before purchase.",
    auth: "x-api-key",
    params: [
      { name: "type", type: "string", required: true, desc: "'electricity' or 'cable'" },
      { name: "provider_code", type: "string", required: true, desc: "Service code from /api-services" },
      { name: "meter_number", type: "string", required: false, desc: "Meter number (for electricity)" },
      { name: "smartcard", type: "string", required: false, desc: "Smartcard / IUC number (for cable)" },
    ],
    response: { success: true, customer_name: "John Doe", meter_number: "12345678901" },
    example: `curl -X POST \\\n  -H "x-api-key: bp_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"type":"electricity","provider_code":"ikeja-electric","meter_number":"12345678901"}' \\\n  ${BASE_URL}/api-verify`,
  },
  {
    method: "POST",
    path: "/api-purchase",
    title: "Purchase",
    description: "Buy data, airtime, electricity, or cable TV. Routed through the BlitzPay engine. Discounts: 2% on data, 1.5% on airtime.",
    auth: "x-api-key",
    params: [
      { name: "type", type: "string", required: true, desc: "'data' | 'airtime' | 'electricity' | 'cable'" },
      { name: "network", type: "string", required: false, desc: "Network for data/airtime: MTN | AIRTEL | GLO | 9MOBILE" },
      { name: "phone", type: "string", required: false, desc: "Phone number for data/airtime" },
      { name: "package_id", type: "string", required: false, desc: "Plan ID from /api-plans (for data)" },
      { name: "provider_code", type: "string", required: false, desc: "Service code from /api-services (for electricity/cable)" },
      { name: "meter_number", type: "string", required: false, desc: "Meter number (for electricity)" },
      { name: "smartcard", type: "string", required: false, desc: "Smartcard / IUC number (for cable)" },
      { name: "package_code", type: "string", required: false, desc: "Package code from /api-services (for cable)" },
      { name: "amount", type: "number", required: true, desc: "Purchase amount in NGN" },
    ],
    response: { success: true, reference: "SP-XXXX", status: "success", id: "uuid", amount_charged: 98.5, amount_full: 100 },
    example: `curl -X POST \\\n  -H "x-api-key: bp_abc123..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"type":"airtime","network":"MTN","phone":"08012345678","amount":1000}' \\\n  ${BASE_URL}/api-purchase`,
  },
  {
    method: "GET",
    path: "/api-transaction/{reference}",
    title: "Check Transaction",
    description: "Poll to track purchase status. Returns pending \u2192 processing \u2192 successful/failed.",
    auth: "x-api-key",
    response: { success: true, transaction: { id: "uuid", status: "successful", reference: "BP-2026-XXXX", network: "MTN", phone: "08012345678", package_code: "BSP-763", provider_reference: "PARTNER-XXXX", created_at: "2026-07-06T12:00:00Z", updated_at: "2026-07-06T12:00:30Z" } },
    example: `curl -H "x-api-key: bp_abc123..." \\\n  ${BASE_URL}/api-transaction/BP-2026-XXXX`,
  },
];

const AUTH_ENDPOINT: Endpoint = {
  method: "POST",
  path: "/api-keys",
  title: "Generate API Key",
  description: "Create a new API key. Requires wallet balance \u2265 \u20a65,000. Store the key immediately \u2014 it is shown only once.",
  auth: "Bearer <supabase_jwt>",
  params: [{ name: "name", type: "string", required: false, desc: "Label for the key (e.g. \"Production\")" }],
  response: { success: true, key: "bp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", prefix: "bp_xxxxxx", id: "uuid", name: "Production", warning: "Store this key now. It will never be shown again." },
  example: `curl -X POST \\\n  -H "Authorization: Bearer <your_jwt>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Production"}' \\\n  ${BASE_URL}/api-keys`,
};

export default function ApiDocs() {
  const navigate = useNavigate();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background" style={{ backgroundImage: "var(--gradient-aurora)", backgroundAttachment: "fixed" }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-40 glass border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5">
          <button onClick={() => navigate(-1)} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Zap className="h-4 w-4 text-white" fill="white" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Blitz<span className="text-gradient">Pay</span> API
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight mb-3">
            Developer <span className="text-gradient">API</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
            Integrate data bundles, airtime, and utility payments directly into your app.
            JSON-only, key-based auth, 2% discount on data and 1.5% on airtime.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            <span className="glass px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-400" /> JSON REST API
            </span>
            <span className="glass px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-purple-400" /> x-api-key Auth
            </span>
            <span className="glass px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Discounts
            </span>
          </div>
        </motion.div>

        {/* Quick Start */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-strong rounded-2xl p-5 mb-10 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="h-5 w-5 text-purple-400" />
            <h3 className="font-display text-base font-bold">Quick Start</h3>
          </div>
          <ol className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold shrink-0">1</span>
              <span>Get an API key from Settings &rarr; Developer (requires &nbsp;&#8358;5,000 wallet balance)</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold shrink-0">2</span>
              <span>Send <code className="bg-white/5 px-1.5 py-0.5 rounded text-purple-300 font-mono text-xs">x-api-key: bp_yourkey</code> in every request header</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold shrink-0">3</span>
              <span>All responses are JSON. Check <code className="bg-white/5 px-1.5 py-0.5 rounded text-purple-300 font-mono text-xs">success</code> boolean first.</span>
            </li>
          </ol>
        </motion.div>

        {/* Auth */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-10">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Key className="h-4 w-4 text-white" />
            </span>
            <h2 className="font-display text-xl font-bold tracking-tight">Authentication</h2>
          </div>
          <EndpointCard endpoint={AUTH_ENDPOINT} isOpen={openIdx === 99} onToggle={() => setOpenIdx(openIdx === 99 ? null : 99)} copied={copied} onCopy={copy} />
        </motion.div>

        {/* Endpoints */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2.5 mb-5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Server className="h-4 w-4 text-white" />
            </span>
            <h2 className="font-display text-xl font-bold tracking-tight">Endpoints</h2>
          </div>
          <div className="space-y-4">
            {ENDPOINTS.map((ep, i) => (
              <EndpointCard key={ep.path} endpoint={ep} isOpen={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} copied={copied} onCopy={copy} />
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-muted-foreground pb-8">
          <p>Base URL: <code className="font-mono text-purple-300">{BASE_URL}</code></p>
          <p className="mt-1">All endpoints require <code className="font-mono text-purple-300">x-api-key</code> header except key generation.</p>
        </div>
      </main>
    </div>
  );
}

function EndpointCard({ endpoint, isOpen, onToggle, copied, onCopy }: {
  endpoint: Endpoint; isOpen: boolean; onToggle: () => void; copied: boolean; onCopy: (s: string) => void;
}) {
  return (
    <div className="glass-strong rounded-xl border border-white/10 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors text-left">
        <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${STATUS_BADGES[endpoint.method] || "bg-white/10 text-white border-white/10"}`}>
          {endpoint.method}
        </span>
        <code className="font-mono text-sm text-purple-300">{endpoint.path}</code>
        <span className="ml-auto">
          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/10">
          <p className="text-sm text-muted-foreground leading-relaxed">{endpoint.description}</p>

          {endpoint.auth && (
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-muted-foreground">Auth:</span>
              <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-purple-300">{endpoint.auth}</code>
            </div>
          )}

          {endpoint.params && endpoint.params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Parameters</h4>
              <div className="space-y-2">
                {endpoint.params.map(p => (
                  <div key={p.name} className="flex items-start gap-3 text-sm bg-white/[0.03] rounded-lg px-3 py-2.5">
                    <code className="font-mono text-purple-300 text-xs shrink-0">{p.name}</code>
                    <span className="text-muted-foreground text-xs mt-0.5">{p.type}{p.required ? " &middot; required" : " &middot; optional"}</span>
                    <span className="text-muted-foreground text-xs ml-auto text-right max-w-[60%]">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.response && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Response</h4>
              <pre className="bg-black/40 rounded-lg p-3 text-xs font-mono text-emerald-300 overflow-x-auto border border-white/5">
                {JSON.stringify(endpoint.response, null, 2)}
              </pre>
            </div>
          )}

          {endpoint.example && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">cURL Example</h4>
                <button onClick={() => onCopy(endpoint.example!)} className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="bg-black/40 rounded-lg p-3 text-xs font-mono text-purple-300 overflow-x-auto border border-white/5 whitespace-pre-wrap">
                {endpoint.example}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
