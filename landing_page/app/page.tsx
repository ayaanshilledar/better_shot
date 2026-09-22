import React from "react";
import Feature from "./components/feature";
import Footer from "./components/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#101216] text-[#ffffff] font-sans antialiased selection:bg-white selection:text-black flex flex-col justify-between relative overflow-hidden">
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[260px] bg-white/[0.04] blur-[130px] pointer-events-none -z-10" />

      {/* Navigation */}
      <header className="w-full px-6 sm:px-10 py-6 flex items-center justify-start">
        <span className="text-sm font-semibold tracking-tight text-white">
          BetterShot
        </span>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-8 pt-0 pb-20 flex flex-col items-center text-center">
        <h1 className="text-3xl sm:text-5xl font-light tracking-tight text-white max-w-2xl leading-tight">
          Screen capture and recording for Windows.
        </h1>

        <div className="mt-8 flex items-center gap-3">
          <a
            href="https://github.com/ayaanshilledar/better_shot/releases/latest"
            className="px-5 py-2.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-light tracking-wide transition-colors shadow-sm"
          >
            Download for Windows
          </a>
          <a
            href="https://github.com/ayaanshilledar/better_shot"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-lg bg-[#181a20] hover:bg-[#20232b] text-zinc-300 text-xs font-light border border-[#282c37] transition-colors"
          >
            View Source
          </a>
        </div>

        {/* Product Screenshot Device Mockup Placeholder */}
        <div className="mt-14 w-full max-w-6xl mx-auto relative">
          {/* Ambient Corner Glows */}
          <div className="absolute -top-12 -right-10 w-[500px] h-[500px] bg-white/[0.03] blur-[150px] pointer-events-none -z-10" />
          <div className="absolute -top-12 -left-10 w-[500px] h-[500px] bg-white/[0.03] blur-[150px] pointer-events-none -z-10" />

          {/* Outer Monitor / Laptop Screen Bezel */}
          <div className="w-full rounded-2xl sm:rounded-3xl bg-[#14161d] p-2.5 sm:p-4 border border-[#262a35] shadow-[0_25px_80px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
            {/* Screen Content Container (aspect-16/10) */}
            <div className="relative aspect-[16/10] w-full rounded-xl sm:rounded-2xl overflow-hidden bg-[#0c0d12] border border-[#1e222c]">
              
              {/* 
                ============================================================
                PRODUCT SCREENSHOT IMAGE:
                Drop your image in landing_page/public/ (e.g. screenshot.png)
                and uncomment the <img> tag below:
                ============================================================
              */}
              {/* <img 
                src="/screenshot.png" 
                alt="BetterShot Product Screenshot" 
                className="w-full h-full object-cover object-top" 
              /> */}

              {/* Placeholder view until image is added */}
              <div className="w-full h-full flex flex-col items-center justify-between p-6 sm:p-10 select-none relative">
                {/* Subtle screen background grid & glow */}
                <div className="absolute inset-0 bg-[radial-gradient(#252a36_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[340px] bg-white/[0.02] blur-[120px] pointer-events-none" />

                {/* Placeholder Content Area */}
                <div className="relative z-10 flex flex-col items-center mt-6 sm:mt-10 max-w-md">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mb-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <circle cx="12" cy="13" r="3" strokeWidth="2" />
                  </svg>
                </div>
                <h2 className="text-lg sm:text-2xl font-medium tracking-tight text-white">
                  Your screen. Ready to share.
                </h2>
                <p className="mt-1 text-xs text-zinc-500 font-light">
                  Product screenshot showcase placeholder
                </p>
              </div>

              {/* BetterShot Floating Control Pill Mockup */}
              <div className="relative z-10 mb-2 sm:mb-4 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-[#1b1e26]/90 backdrop-blur-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center gap-2 sm:gap-3">
                {/* Area / Crop Mode */}
                <button type="button" className="p-1.5 sm:p-2 rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4" />
                  </svg>
                </button>

                {/* Window Mode */}
                <button type="button" className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path strokeLinecap="round" d="M3 9h18" />
                  </svg>
                </button>

                {/* Fullscreen Mode */}
                <button type="button" className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path strokeLinecap="round" d="M8 21h8m-4-4v4" />
                  </svg>
                </button>

                {/* Divider */}
                <div className="w-px h-5 bg-white/10 mx-0.5 sm:mx-1" />

                {/* Microphone Toggle */}
                <button type="button" className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2m7 9v3m-4 0h8" />
                  </svg>
                </button>

                {/* Camera Toggle */}
                <button type="button" className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>

                {/* Record Button */}
                <button type="button" className="ml-1 sm:ml-2 pl-3 pr-4 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2 transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  Record
                </button>
              </div>

            </div>
          </div>
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
