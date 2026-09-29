"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({
  children,
  delay = 0,
  className,
  y = 24,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 1, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Counter({
  to,
  suffix = "",
  className,
}: {
  to: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    const duration = 1500;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, reduce]);

  return (
    <span ref={ref} className={className}>
      {(reduce ? to : val).toLocaleString("vi-VN")}
      {suffix}
    </span>
  );
}

export function SectionHeader({
  badge,
  badgeIcon,
  title,
  desc,
  light = false,
}: {
  badge: string;
  badgeIcon?: ReactNode;
  title: string;
  desc?: string;
  light?: boolean;
}) {
  return (
    <Reveal className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
      <span
        className={`pixel-border-sm inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs font-extrabold uppercase tracking-widest ${
          light
            ? "bg-sun text-[#5a4300]"
            : "bg-secondary text-secondary-foreground"
        }`}
      >
        {badgeIcon}
        {badge}
      </span>
      <h2
        className={`mt-4 text-3xl font-extrabold md:text-4xl lg:text-[2.75rem] lg:leading-tight ${
          light ? "text-white" : "text-foreground"
        }`}
      >
        {title}
      </h2>
      {desc && (
        <p
          className={`mt-3 text-base font-semibold md:text-lg ${
            light ? "text-white/85" : "text-muted-foreground"
          }`}
        >
          {desc}
        </p>
      )}
    </Reveal>
  );
}
