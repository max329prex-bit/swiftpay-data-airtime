import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * SplashScreen — shown for exactly 5 seconds on first app load.
 * The Blitz logo rolls (rotates like a wheel) continuously.
 * At 1.2s, "BlitzPay" slides up from nowhere.
 * At 5s, the whole screen fades out and onDone() fires.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [showName, setShowName] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Name appears at 1.2 seconds
    const t1 = setTimeout(() => setShowName(true), 1200);
    // Begin exit fade at 4.4 seconds
    const t2 = setTimeout(() => setExiting(true), 4400);
    // Call onDone at 5 seconds
    const t3 = setTimeout(onDone, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background"
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {/* Glow orb behind the logo */}
      <div
        className="absolute h-64 w-64 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(252 100% 68% / 0.35), transparent 70%)" }}
      />

      {/* Rolling logo icon */}
      <motion.div
        className="relative grid h-28 w-28 place-items-center rounded-[32px] shadow-glow"
        style={{ background: "linear-gradient(135deg, hsl(252 100% 68%), hsl(280 100% 65%), hsl(310 100% 65%))" }}
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.1 }}
      >
        {/* Inner shine overlay */}
        <div className="absolute inset-0 rounded-[32px] opacity-20"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 60%)" }} />
        <Zap
          className="relative h-14 w-14 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
          fill="white"
          strokeWidth={1.5}
        />
      </motion.div>

      {/* BlitzPay name — slides up from below at 1.2s */}
      <div className="mt-8 h-14 flex items-start justify-center overflow-hidden">
        <AnimatePresence>
          {showName && (
            <motion.div
              key="brand"
              initial={{ opacity: 0, y: 48, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-4xl font-black tracking-tight"
            >
              <span className="text-foreground">Blitz</span>
              <span style={{
                background: "linear-gradient(90deg, hsl(252 100% 68%), hsl(310 100% 65%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>Pay</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar at bottom */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, hsl(252 100% 68%), hsl(162 100% 45%))" }}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 4.8, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

/** Inline rolling loader — used for in-app loading states */
export function BoltLoader({ size = 64, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: "linear-gradient(135deg, hsl(252 100% 68%), hsl(280 100% 65%), hsl(310 100% 65%))",
        }}
        className="grid place-items-center shadow-glow"
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.1 }}
      >
        <Zap
          style={{ width: size * 0.5, height: size * 0.5 }}
          className="text-white"
          fill="white"
          strokeWidth={2}
        />
      </motion.div>
      {label && <p className="text-sm text-muted-foreground animate-pulse">{label}</p>}
    </div>
  );
}

export function FullScreenLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
      <BoltLoader size={80} label={label} />
    </div>
  );
}
