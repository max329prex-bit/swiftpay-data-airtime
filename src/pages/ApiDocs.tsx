import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal, Copy, Check, Zap, Wifi, Wallet, KeyRound,
  ChevronRight, ChevronDown, Shield, Clock, Globe,
  FileText, ArrowRight, ExternalLink, Code2, Package,
  RefreshCw, Search, AlertTriangle, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Endpoint {
  method: string;
  path: string;
  description: string;
  auth: string;
  body?: Record<string, string>;
  response: object;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/v1/balance",
    description: "Check your wallet balance",
    auth: "x-api-key",
    response: {
      success: true,
      balance: 15000.0,
      currency: "NGN"
    }
  },
  {
    method: "GET",
    path: "/api/v1/plans",
    description: "List all available data/airtime plans (with 2% API discount applied)",
    auth: "x-api-key",
    response: {
      success: true,
      plans: [
        {
          id: "plan-uuid",
          name: "MTN 1GB",
          network: "MTN",
          size: "1GB",
          validity: "30 days",
          price: 280.0,
          api_price: 274.4,
          discount: "2%",
          provider: "gsubz",
          available: true
        }
      ]
    }
  },
  {
    method: "POST",
    path: "/api/v1/purchase",
    description: "Purchase data or airtime at 2% discount",
    auth: "x-api-key",
    body: {
      network: "MTN",
      phone: "08031234567",
      package_id: "plan-uuid",
      amount: "274.40"
    },
    response: {
      success: true,
      transaction: {
        id: "tx-uuid",
        reference: "API-1234567890",
        status: "pending",
        network: "MTN",
        phone: "08031234567",
        amount: 274.40,
        provider: "gsubz"
      },
      message: "Purchase is being processed. Check status with /api/v1/transaction/:reference"
    }
  },
  {
    method: "GET",
    path: "/api/v1/transaction/:reference",
    description: "Check transaction status by reference",
    auth: "x-api-key",
    response: {
      success: true,
      transaction: {
        id: "tx-uuid",
        reference: "API-1234567890",
        status: "success",
        network: "MTN",
        phone: "08031234567",
        amount: 274.40,
        provider_reference: "PROV-12345",
        created_at: "2026-07-06T12:00:00Z",
        updated_at: "2026-07-06T12:00:30Z"
      }
    }
  },
  {
    method: "POST",
    path: "/api/v1/keys",
    description: "Generate a new API key (requires \u20a65,000+ wallet balance). Auth via Bearer token.",
    auth: "Bearer <token>",
    body: { name: "Production" },
    response: {
      success: true,
      key: "bp_a1b2c3d4e5f6...",
      prefix: "bp_a1b2c3",
      id: "key-uuid",
      name: "Production",
      warning: "Store this key now. It will never be shown again."
    }
  },
  {
    method: "GET",
    path: "/api/v1/keys",
    description: "List all your API keys (without sensitive data)",
    auth: "Bearer <token>",
    response: {
      success: true,
      keys: [
        {
          id: "key-uuid",
          key_prefix: "bp_a1b2c3",
          name: "Production",
          is_active: true,
          created_at: "2026-07-06T12:00:00Z",
          last_used_at: "2026-07-06T14:30:00Z"
        }
      ]
    }
  }
];

const BASE_URL = "https://blitz.com.ng";

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const roundedClass = label ? 'rounded-b-xl rounded-t-none' : 'rounded-xl';
  return (
    <div className="relative group">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 rounded-t-xl">
          <span className="text-xs font-medium text-zinc-400">{label}</span>
          <button onClick={copy} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <pre className={`bg-zinc-950 border border-zinc-800/50 ${roundedClass} p-4 overflow-x-auto text-sm leading-relaxed`}>
        <code className="text-zinc-300 font-mono">{code}</code>
      </pre>
    </div>
  );
}

function Percent(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function EndpointCard({ endpoint, isOpen, onToggle }: { endpoint: Endpoint; isOpen: boolean; onToggle: () => void }) {
  const methodColors: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    POST: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    PUT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    DELETE: "bg-red-500/10 text-red-400 border-red-500/20"
  };

  let curlExample: string;
  if (endpoint.method === "GET" && endpoint.path === "/api/v1/keys") {
    curlExample = `curl -X GET \\\n  ${BASE_URL}${endpoint.path} \\\n  -H "Authorization: Bearer YOUR_AUTH_TOKEN"`;
  } else if (endpoint.method === "POST" && endpoint.path === "/api/v1/keys") {
    curlExample = `curl -X POST \\\n  ${BASE_URL}${endpoint.path} \\\n  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "Production"}'`;
  } else if (endpoint.method === "GET") {
    curlExample = `curl -X GET \\\n  ${BASE_URL}${endpoint.path} \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -H "Content-Type: application/json"`;
  } else {
    curlExample = `curl -X ${endpoint.method} \\\n  ${BASE_URL}${endpoint.path} \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(endpoint.body || {}, null, 2)}'`;
  }

  return (
    <motion.div layout className="border border-zinc-800/60 rounded-xl overflow-hidden bg-zinc-900/40 backdrop-blur-sm">
      <button onClick={onToggle} className="w-full flex items-center gap-4 p-5 text-left hover:bg-zinc-800/30 transition-colors">
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${methodColors[endpoint.method] || "bg-zinc-500/10 text-zinc-400"}`}>
          {endpoint.method}
        </span>
        <code className="text-sm font-mono text-zinc-200 flex-1">{endpoint.path}</code>
        <span className="text-sm text-zinc-500 hidden sm:block">{endpoint.description}</span>
        {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4 border-t border-zinc-800/40 pt-4">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-zinc-500" />
                <span className="text-zinc-400">Auth:</span>
                <code className="text-zinc-300 font-mono bg-zinc-800/50 px-2 py-0.5 rounded">{endpoint.auth}</code>
              </div>
              {endpoint.body && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Request Body</span>
                  <CodeBlock code={JSON.stringify(endpoint.body, null, 2)} label="JSON" />
                </div>
              )}
              <div className="space-y-2">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">cURL Example</span>
                <CodeBlock code={curlExample} label="bash" />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Response</span>
                <CodeBlock code={JSON.stringify(endpoint.response, null, 2)} label="JSON" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ApiDocs() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [search, setSearch] = useState("");
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered = ENDPOINTS.filter(e =>
    e.path.toLowerCase().includes(search.toLowerCase()) ||
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.method.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      <div className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrollY > 50 ? 'bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50' : ''}`}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">BlitzPay API</span>
          </div>
          <a href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5">
            <Globe className="w-4 h-4" /> blitz.com.ng
          </a>
        </div>
      </div>

      <section className="pt-28 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              v1.0 Stable
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
              Developer API
            </h1>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Build VTU purchases directly into your apps. Get 2% off every plan with zero extra fees.
            </p>
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 h-11 rounded-lg font-medium">
                <KeyRound className="w-4 h-4 mr-2" /> Get API Key
              </Button>
              <a href="#endpoints" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm font-medium">
                Explore Endpoints <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-8 px-6 border-y border-zinc-800/50 bg-zinc-900/20">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { icon: Zap, label: "Requests/min", value: "100" },
            { icon: Percent, label: "API Discount", value: "2%" },
            { icon: Wifi, label: "Networks", value: "4" },
            { icon: Clock, label: "Uptime", value: "99.9%" }
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="text-center space-y-1">
              <stat.icon className="w-5 h-5 text-emerald-400 mx-auto" />
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-zinc-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Base URL</h2>
            <CodeBlock code={BASE_URL} />
          </div>
        </div>
      </section>

      <section className="py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Authentication</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              All API requests require an <code className="text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">x-api-key</code> header.
              Generate your key from the BlitzPay dashboard or via the <code className="text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">POST /api/v1/keys</code> endpoint.
            </p>
            <CodeBlock code={`curl -X GET \\\n  ${BASE_URL}/api/v1/balance \\\n  -H "x-api-key: bp_your_api_key_here" \\\n  -H "Content-Type: application/json"`} label="Example" />
          </div>
        </div>
      </section>

      <section id="endpoints" className="py-8 px-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Endpoints</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search endpoints..."
                className="bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 w-56"
              />
            </div>
          </div>
          <div className="space-y-3">
            {filtered.map((ep, i) => (
              <EndpointCard key={ep.path} endpoint={ep} isOpen={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3" />
              No endpoints match your search
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-6 border-t border-zinc-800/50">
        <div className="max-w-5xl mx-auto space-y-4">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Error Codes</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { code: "401", msg: "Invalid or missing API key" },
              { code: "402", msg: "Insufficient wallet balance" },
              { code: "400", msg: "Missing required fields" },
              { code: "404", msg: "Transaction or package not found" },
              { code: "429", msg: "Rate limit exceeded (100/min)" },
              { code: "500", msg: "Internal server error" }
            ].map(err => (
              <div key={err.code} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
                <span className="text-red-400 font-mono font-bold text-sm">{err.code}</span>
                <span className="text-zinc-400 text-sm">{err.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-6 border-t border-zinc-800/50 bg-zinc-900/20">
        <div className="max-w-5xl mx-auto space-y-6">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Pricing</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/50 space-y-3">
              <div className="text-3xl font-extrabold text-white">2%</div>
              <div className="text-sm text-zinc-400">API discount on every plan</div>
            </div>
            <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/50 space-y-3">
              <div className="text-3xl font-extrabold text-white">\u20a65,000</div>
              <div className="text-sm text-zinc-400">Minimum wallet to generate key</div>
            </div>
            <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/50 space-y-3">
              <div className="text-3xl font-extrabold text-white">100/min</div>
              <div className="text-sm text-zinc-400">Rate limit per API key</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-zinc-800/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-zinc-500">
          <span>\u00a9 2026 BlitzPay. All rights reserved.</span>
          <a href="mailto:support@blitz.com.ng" className="hover:text-zinc-300 transition-colors">support@blitz.com.ng</a>
        </div>
      </footer>
    </div>
  );
}
