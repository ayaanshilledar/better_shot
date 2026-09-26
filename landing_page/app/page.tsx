"use client";

import React, { useState, useEffect } from "react";
import Feature from "./components/feature";
import Footer from "./components/footer";

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setIsScrolled(scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#181818] text-[#ffffff] font-sans antialiased selection:bg-white selection:text-black flex flex-col justify-between relative overflow-x-hidden">
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[260px] bg-white/[0.04] blur-[130px] pointer-events-none -z-10" />

      {/* Smooth Morphing Apple-Style Glass Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-3 sm:p-4 pointer-events-none">
        <header
          className={`pointer-events-auto transition-all duration-[2000ms] ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-between ${
            isScrolled
              ? "w-auto px-5 py-2.5 rounded-full bg-[#181818]/80 backdrop-blur-xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.6)] gap-4"
              : "w-full max-w-7xl px-4 sm:px-8 py-3 bg-transparent border-transparent border-none shadow-none gap-4"
          }`}
        >
          <div className="flex items-center gap-2 cursor-pointer">
            <img
              src="/Logo.png"
              alt="Velo Logo"
              className={`object-contain transition-all duration-[2000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isScrolled ? "w-6 h-6" : "w-8 h-8 sm:w-9 sm:h-9"
              }`}
            />
            <span
              className={`font-bold tracking-tight text-white transition-all duration-[2000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isScrolled ? "text-sm" : "text-lg sm:text-xl"
              }`}
            >
              Velo
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/ayaanshilledar/better_shot/releases/latest"
              className={`rounded-full bg-white hover:bg-zinc-200 text-slate-950 font-semibold transition-all duration-[2000ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 active:scale-95 shadow-sm whitespace-nowrap block ${
                isScrolled
                  ? "px-3.5 py-1 text-[11px]"
                  : "px-4 py-1.5 text-xs"
              }`}
            >
              Download
            </a>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-8 pt-28 sm:pt-36 pb-20 flex flex-col items-center text-center">
        <h1 className="text-3xl sm:text-5xl font-light tracking-tight text-white max-w-2xl leading-tight">
          Screen capture and recording for <span className="font-offbit tracking-wide text-white">Windows</span>.
        </h1>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/ayaanshilledar/better_shot/releases/latest"
            className="px-6 py-3 rounded-full bg-white hover:bg-zinc-200 text-slate-950 text-xs font-semibold tracking-wide transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <span>Download for Windows</span>
          </a>
          <a
            href="https://github.com/ayaanshilledar/better_shot"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-full bg-white/5 hover:bg-[#2373F4] text-white text-xs font-medium border border-white/15 hover:border-[#2373F4] transition-all duration-300 hover:scale-105 active:scale-95 backdrop-blur-md cursor-pointer flex items-center gap-2"
          >
            <span>View Source</span>
          </a>
        </div>

        {/* Product Screenshot Device Mockup Placeholder */}
        <div className="mt-14 w-full max-w-6xl mx-auto relative">
          {/* Ambient Corner Glows */}
          <div className="absolute -top-12 -right-10 w-[500px] h-[500px] bg-white/[0.03] blur-[150px] pointer-events-none -z-10" />
          <div className="absolute -top-12 -left-10 w-[500px] h-[500px] bg-white/[0.03] blur-[150px] pointer-events-none -z-10" />

          {/* Screen Content Container (Clean without monitor bezel/borders) */}
          <div className="relative aspect-[16/10] w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.8)]">
            <img
              src="/main_bgc.png"
              alt="Velo Product Screenshot"
              className="w-full h-full object-cover object-top"
            />
          </div>
        </div>

        {/* Main Features Section Component */}
        <Feature />
      </main>

      {/* Footer Component */}
      <Footer />
    </div>
  );
}
