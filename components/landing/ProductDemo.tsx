"use client"

import { useState } from "react"
import { useT } from "@/app/context/LanguageContext"

type TabId = "dashboard" | "beds" | "reports"

function DashboardMockup({ t }: { t: (key: string) => string }) {
  return (
    <div className="p-5 space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('beds.occupied'), value: "17/24", sub: "70%", accent: "#0F6E56" },
          { label: t('dashboard.revenue'), value: "4 320 MAD", sub: "+12%", accent: "#18C78A" },
          { label: t('dashboard.pendingCheckins'), value: "3", sub: t('common.today'), accent: "#0891b2" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl p-3 border"
            style={{ borderColor: "rgba(15,110,86,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[9px] font-semibold tracking-wide uppercase mb-1.5" style={{ color: "#8AA09C" }}>
              {s.label}
            </p>
            <p className="text-[13px] font-bold leading-none" style={{ color: s.accent }}>
              {s.value}
            </p>
            <p className="text-[9px] mt-1" style={{ color: "#AAC0BC" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Activity feed */}
      <div
        className="bg-white rounded-xl border overflow-hidden"
        style={{ borderColor: "rgba(15,110,86,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(15,110,86,0.06)" }}>
          <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#8AA09C" }}>
            {t('dashboard.activity')}
          </p>
        </div>
        {[
          { icon: "✅", text: "Check-in · Karim B.", time: "14:32", color: "#0F6E56" },
          { icon: "💰", text: "Paiement · 650 MAD cash", time: "14:10", color: "#18C78A" },
          { icon: "🛏", text: "Lit A3 marqué propre", time: "13:55", color: "#8AA09C" },
          { icon: "📋", text: "Sophie M. — check-out", time: "11:02", color: "#8AA09C" },
        ].map((a, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 px-3 py-2 border-b last:border-0"
            style={{ borderColor: "rgba(15,110,86,0.04)" }}
          >
            <span className="text-sm">{a.icon}</span>
            <p className="text-[10px] flex-1 font-medium" style={{ color: "#2A4A45" }}>
              {a.text}
            </p>
            <p className="text-[9px] font-medium" style={{ color: "#AAC0BC" }}>
              {a.time}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function BedsMockup({ t }: { t: (key: string) => string }) {
  const beds = [
    { id: "A1", status: "occupied", guest: "Karim B." },
    { id: "A2", status: "available" },
    { id: "A3", status: "dirty" },
    { id: "A4", status: "occupied", guest: "Sophie M." },
    { id: "A5", status: "occupied", guest: "Lars K." },
    { id: "A6", status: "available" },
    { id: "B1", status: "occupied", guest: "Amina T." },
    { id: "B2", status: "occupied", guest: "David P." },
    { id: "B3", status: "available" },
    { id: "B4", status: "maintenance" },
    { id: "B5", status: "occupied", guest: "Omar B." },
    { id: "B6", status: "occupied", guest: "Emma R." },
    { id: "C1", status: "available" },
    { id: "C2", status: "occupied", guest: "Youssef A." },
    { id: "C3", status: "dirty" },
    { id: "C4", status: "occupied", guest: "Sara M." },
  ]

  const statusConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
    occupied:    { bg: "rgba(24,199,138,0.12)", text: "#0F6E56", border: "rgba(24,199,138,0.3)", label: t('beds.occupied') },
    available:   { bg: "rgba(15,110,86,0.04)", text: "#8AA09C", border: "rgba(15,110,86,0.1)", label: t('beds.available') },
    dirty:       { bg: "rgba(251,191,36,0.1)", text: "#92740D", border: "rgba(251,191,36,0.3)", label: t('beds.dirty') },
    maintenance: { bg: "rgba(239,68,68,0.08)", text: "#B91C1C", border: "rgba(239,68,68,0.2)", label: t('beds.maintenance') },
  }

  return (
    <div className="p-5 space-y-4">
      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        {Object.entries(statusConfig).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded"
              style={{ background: v.bg, border: `1px solid ${v.border}` }}
            />
            <span className="text-[10px] font-medium" style={{ color: "#8AA09C" }}>
              {v.label}
            </span>
          </div>
        ))}
      </div>

      {/* Bed grid */}
      <div className="grid grid-cols-4 gap-2">
        {beds.map((bed) => {
          const cfg = statusConfig[bed.status]
          return (
            <div
              key={bed.id}
              className="rounded-xl p-2.5 text-center cursor-pointer transition-transform hover:scale-105"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
            >
              <p className="text-[11px] font-bold" style={{ color: cfg.text }}>
                {bed.id}
              </p>
              {bed.guest ? (
                <p className="text-[8px] mt-0.5 truncate" style={{ color: cfg.text + "99" }}>
                  {bed.guest.split(" ")[0]}
                </p>
              ) : (
                <p className="text-[8px] mt-0.5" style={{ color: cfg.text + "80" }}>
                  {cfg.label}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReportsMockup({ t }: { t: (key: string) => string }) {
  const bars = [
    { day: "Lun", pct: 65, amount: "3 120" },
    { day: "Mar", pct: 80, amount: "3 840" },
    { day: "Mer", pct: 55, amount: "2 640" },
    { day: "Jeu", pct: 90, amount: "4 320" },
    { day: "Ven", pct: 100, amount: "4 800" },
    { day: "Sam", pct: 95, amount: "4 560" },
    { day: "Dim", pct: 78, amount: "3 744" },
  ]

  return (
    <div className="p-5 space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('reports.occupancyRate'), value: "78%" },
          { label: t('reports.revPAR'), value: "200 MAD" },
          { label: t('reports.avgStay'), value: "2.4" },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-white rounded-xl p-3 text-center border"
            style={{ borderColor: "rgba(15,110,86,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[13px] font-bold leading-none" style={{ color: "#0F6E56" }}>
              {k.value}
            </p>
            <p className="text-[9px] mt-1.5 leading-tight font-medium" style={{ color: "#8AA09C" }}>
              {k.label}
            </p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div
        className="bg-white rounded-xl border p-4"
        style={{ borderColor: "rgba(15,110,86,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#8AA09C" }}>
            {t('dashboard.revenueChart')}
          </p>
          <p className="text-[9px] font-bold" style={{ color: "#0F6E56" }}>
            26 924 MAD
          </p>
        </div>
        <div className="flex items-end gap-1.5 h-20">
          {bars.map((b) => (
            <div key={b.day} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${(b.pct / 100) * 72}px`,
                  background:
                    b.pct >= 90
                      ? "linear-gradient(180deg, #18C78A, #0F6E56)"
                      : b.pct >= 75
                      ? "#18C78A99"
                      : "rgba(15,110,86,0.2)",
                }}
              />
              <p className="text-[8px] font-semibold" style={{ color: "#8AA09C" }}>
                {b.day}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ProductDemo() {
  const t = useT()
  const [active, setActive] = useState<TabId>("dashboard")

  const TABS: { label: string; id: TabId }[] = [
    { label: t('nav.dashboard'), id: "dashboard" },
    { label: t('nav.beds'), id: "beds" },
    { label: t('nav.reports'), id: "reports" },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      {/* Tab bar */}
      <div
        className="flex gap-1 rounded-2xl p-1.5 mb-6 w-fit mx-auto"
        style={{ background: "rgba(15,110,86,0.06)", border: "1px solid rgba(15,110,86,0.08)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className="px-5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
            style={
              active === tab.id
                ? {
                    background: "white",
                    color: "#0F6E56",
                    boxShadow: "0 2px 8px rgba(15,110,86,0.12), 0 1px 2px rgba(0,0,0,0.04)",
                  }
                : { color: "#4A6560" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Demo window */}
      <div
        className="rounded-[20px] overflow-hidden border"
        style={{
          borderColor: "rgba(15,110,86,0.1)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 6px 16px rgba(0,0,0,0.05)",
        }}
      >
        {/* Window chrome */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{
            background: "white",
            borderColor: "rgba(15,110,86,0.07)",
          }}
        >
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div
              className="rounded-lg px-4 py-1 text-[11px] font-medium border"
              style={{ background: "rgba(15,110,86,0.04)", color: "#8AA09C", borderColor: "rgba(15,110,86,0.08)" }}
            >
              hostelpro.ma/dashboard
            </div>
          </div>
        </div>

        {/* Mock layout */}
        <div className="flex" style={{ background: "oklch(0.974 0.004 145)" }}>
          {/* Mini sidebar */}
          <div
            className="w-12 bg-white flex flex-col items-center py-4 gap-3"
            style={{ borderRight: "1px solid rgba(15,110,86,0.07)" }}
          >
            {["🏠", "🛏", "👤", "💰", "📊"].map((icon, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm cursor-pointer transition-colors"
                style={
                  i === (active === "dashboard" ? 0 : active === "beds" ? 1 : 4)
                    ? { background: "rgba(15,110,86,0.1)", color: "#0F6E56" }
                    : { color: "#AAC0BC" }
                }
              >
                {icon}
              </div>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 min-h-[300px]">
            {active === "dashboard" && <DashboardMockup t={t} />}
            {active === "beds" && <BedsMockup t={t} />}
            {active === "reports" && <ReportsMockup t={t} />}
          </div>
        </div>
      </div>
    </div>
  )
}
