"use client";
import React from "react";
import { Users, Wallet, Heart, Sparkles, TrendingUp, Calendar } from "lucide-react";
import { PcStatCard } from "@/components/ui/PcStatCard";

export function DevWave6Demos() {
  return (
    <section style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Wave 6 — PcStatCard</h2>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#6B6B6B" }}>Default size — 6 tones</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <PcStatCard tone="orange" icon={<Wallet size={18} />} label="이번달 헌금" value="₩12,450,000" sub="지난달 대비" trend={{ direction: "up", text: "8.2%" }} />
          <PcStatCard tone="green"  icon={<Users size={18} />}  label="금주 출석"   value="312명"        sub="출석률 87%"   trend={{ direction: "up", text: "3.1%" }} />
          <PcStatCard tone="pink"   icon={<Heart size={18} />}  label="심방"        value="24건"         sub="이번주" />
          <PcStatCard tone="yellow" icon={<Sparkles size={18} />} label="새가족"     value="5명"          sub="정착 진행중" />
          <PcStatCard tone="blue"   icon={<TrendingUp size={18} />} label="기도제목"  value="18건"         sub="함께 기도합니다" />
          <PcStatCard tone="gray"   icon={<Calendar size={18} />} label="다음 일정"  value="3건"          sub="이번주 예정" />
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#6B6B6B" }}>Compact size</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <PcStatCard size="compact" tone="orange" icon={<Wallet size={16} />} label="헌금" value="1,245만" />
          <PcStatCard size="compact" tone="green"  icon={<Users size={16} />}  label="출석" value="312명" />
          <PcStatCard size="compact" tone="pink"   icon={<Heart size={16} />}  label="심방" value="24건" />
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#6B6B6B" }}>Dense size (no icon)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <PcStatCard size="dense" label="총원"   value="358명" />
          <PcStatCard size="dense" label="출석"   value="312명" />
          <PcStatCard size="dense" label="결석"   value="46명" />
          <PcStatCard size="dense" label="새가족" value="5명" />
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#6B6B6B" }}>Clickable + trend</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <PcStatCard tone="orange" icon={<Wallet size={18} />}    label="수입"   value="₩15,200,000" trend={{ direction: "up",   text: "12%" }} onClick={() => alert("clicked")} />
          <PcStatCard tone="pink"   icon={<TrendingUp size={18} />} label="지출"   value="₩8,900,000"  trend={{ direction: "down", text: "4%" }}  onClick={() => alert("clicked")} />
          <PcStatCard tone="green"  icon={<Sparkles size={18} />}   label="잔액"   value="₩6,300,000"  trend={{ direction: "flat", text: "0%" }}  />
        </div>
      </div>
    </section>
  );
}
