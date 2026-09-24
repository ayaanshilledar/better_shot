import React from "react";

export default function Footer() {
  return (
    <footer className="w-full relative overflow-hidden bg-[#2373F4] text-white py-20 sm:py-28 px-6 sm:px-12 md:px-20">
      {/* Center Giant Watermark Logo (Inspired by Reference) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] sm:w-[500px] md:w-[580px] aspect-square pointer-events-none select-none opacity-20 flex items-center justify-center">
        <img
          src="/Logo.png"
          alt=""
          className="w-full h-full object-contain filter brightness-0 invert"
        />
      </div>

      <div className="w-full max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center justify-between">
        {/* Left Section: 3-line Headline with mixed text colors */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-white leading-[1.08] max-w-xl">
            <div>Record clean.</div>
            <div>
              Frame fast. <span className="text-white/60 font-normal">Skip the</span>
            </div>
            <div className="text-white/60 font-normal">busywork.</div>
          </h2>
        </div>

        {/* Right Section: Subtext & Pill Buttons */}
        <div className="lg:col-span-5 flex flex-col items-start lg:items-end text-left lg:text-right gap-6">
          <p className="text-xs sm:text-sm font-normal text-white/90 max-w-xs leading-relaxed">
            Velo combines high-performance screen recording with macOS-inspired studio framing, so you spend less time editing and more time sharing.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="https://github.com/ayaanshilledar/better_shot/releases/latest"
              className="px-6 py-2.5 rounded-full bg-white text-[#2373F4] font-semibold text-xs transition-all hover:bg-white/90 shadow-md"
            >
              Download for Windows
            </a>
            <a
              href="https://github.com/ayaanshilledar/better_shot"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-xs border border-white/30 backdrop-blur-md transition-all"
            >
              View Source
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Minimal Copyright / Author Bar */}
      <div className="w-full max-w-7xl mx-auto mt-16 pt-6 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/70 font-normal relative z-10">
        <div className="flex items-center gap-2">
          <img src="/Logo.png" alt="Velo Logo" className="w-4 h-4 object-contain brightness-0 invert" />
          <span className="font-semibold text-white">Velo</span>
          <span>•</span>
          <span>© {new Date().getFullYear()} Velo. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-1">
          <span>Built by</span>
          <a
            href="https://github.com/ayaanshilledar"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-medium hover:underline transition-colors"
          >
            Ayaan Shilledar
          </a>
        </div>
      </div>
    </footer>
  );
}
