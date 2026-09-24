import React from "react";
import Feature from "./components/feature";
import Footer from "./components/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#181818] text-[#ffffff] font-sans antialiased selection:bg-white selection:text-black flex flex-col justify-between relative overflow-hidden">
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[260px] bg-white/[0.04] blur-[130px] pointer-events-none -z-10" />

      {/* Navigation */}
      <header className="w-full px-6 sm:px-10 py-6 flex items-center justify-start gap-1.5">
        <img
          src="/Logo.png"
          alt="Velo Logo"
          className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
        />
        <span className="text-lg sm:text-xl font-bold tracking-tight text-white">
          Velo
        </span>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-8 pt-0 pb-20 flex flex-col items-center text-center">
        <h1 className="text-3xl sm:text-5xl font-light tracking-tight text-white max-w-2xl leading-tight">
          Screen capture and recording for <span className="font-offbit tracking-wide text-white">Windows</span>.
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
