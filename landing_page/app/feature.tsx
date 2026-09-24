import React from "react";

export default function Feature() {
  return (
    <section className="w-full mt-28 sm:mt-40 flex flex-col text-left">
      {/* Section Headline */}
      <div className="text-center max-w-2xl mx-auto mb-20 sm:mb-28">

        Features
        <h2 className="text-3xl sm:text-5xl font-light tracking-tight text-white leading-tight">
          Everything you need to capture and share.
        </h2>


      </div>

      {/* Alternating Feature Rows */}
      <div className="flex flex-col gap-24 sm:gap-36">
        {/* Feature Row 1: Left Description, Right Image 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16 items-center">
          <div className="flex flex-col items-start max-w-lg">
            <span className="text-xs uppercase tracking-widest text-zinc-500 font-light mb-2">
              Capture Modes
            </span>
            <h3 className="text-2xl sm:text-4xl font-light tracking-tight text-white leading-tight">
              Capture the screen, a window, or any custom area.
            </h3>
            <p className="mt-4 text-sm sm:text-base font-light text-zinc-400 leading-relaxed">
              Seamlessly toggle between full display recording, application window locking, or freeform cropping with intuitive floating controls.
            </p>
          </div>

          {/* Image 1 Placeholder */}
          <div className="w-full rounded-2xl bg-[#14161d] p-2.5 sm:p-3.5 border border-[#262a35] shadow-[0_20px_60px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
            <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#0c0d12] border border-[#1e222c] flex flex-col items-center justify-center p-6 select-none">
              {/* 
                Drop image into landing_page/public/ and uncomment:
                <img src="/image-1.png" alt="Feature 1" className="w-full h-full object-cover object-top" />
              */}
              <div className="absolute inset-0 bg-[radial-gradient(#252a36_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <span className="text-sm font-light text-zinc-200 tracking-wide">Image 1</span>
                <span className="mt-1 text-xs text-zinc-500 font-light">Product screenshot placeholder</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Row 2 (Inverted): Left Image 2, Right Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16 items-center">
          {/* Image 2 Placeholder */}
          <div className="w-full rounded-2xl bg-[#14161d] p-2.5 sm:p-3.5 border border-[#262a35] shadow-[0_20px_60px_rgba(0,0,0,0.7)] ring-1 ring-white/10 order-2 md:order-1">
            <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#0c0d12] border border-[#1e222c] flex flex-col items-center justify-center p-6 select-none">
              {/* 
                Drop image into landing_page/public/ and uncomment:
                <img src="/image-2.png" alt="Feature 2" className="w-full h-full object-cover object-top" />
              */}
              <div className="absolute inset-0 bg-[radial-gradient(#252a36_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <span className="text-sm font-light text-zinc-200 tracking-wide">Image 2</span>
                <span className="mt-1 text-xs text-zinc-500 font-light">Product screenshot placeholder</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col items-start max-w-lg order-1 md:order-2">
            <span className="text-xs uppercase tracking-widest text-zinc-500 font-light mb-2">
              Studio Audio & Overlay
            </span>
            <h3 className="text-2xl sm:text-4xl font-light tracking-tight text-white leading-tight">
              Camera bubble overlay with studio audio mixing.
            </h3>
            <p className="mt-4 text-sm sm:text-base font-light text-zinc-400 leading-relaxed">
              Engage your viewers with a customizable floating webcam bubble and dual microphone plus system audio capture.
            </p>
          </div>
        </div>

        {/* Feature Row 3: Left Description, Right Image 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16 items-center">
          <div className="flex flex-col items-start max-w-lg">
            <span className="text-xs uppercase tracking-widest text-zinc-500 font-light mb-2">
              Built-in Polishing
            </span>
            <h3 className="text-2xl sm:text-4xl font-light tracking-tight text-white leading-tight">
              Trim, inspect, and export with zero friction.
            </h3>
            <p className="mt-4 text-sm sm:text-base font-light text-zinc-400 leading-relaxed">
              Instantly preview recordings, trim out dead air on the timeline, copy directly to your clipboard, or save in high-fidelity MP4.
            </p>
          </div>

          {/* Image 3 Placeholder */}
          <div className="w-full rounded-2xl bg-[#14161d] p-2.5 sm:p-3.5 border border-[#262a35] shadow-[0_20px_60px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
            <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#0c0d12] border border-[#1e222c] flex flex-col items-center justify-center p-6 select-none">
              {/* 
                Drop image into landing_page/public/ and uncomment:
                <img src="/image-3.png" alt="Feature 3" className="w-full h-full object-cover object-top" />
              */}
              <div className="absolute inset-0 bg-[radial-gradient(#252a36_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <span className="text-sm font-light text-zinc-200 tracking-wide">Image 3</span>
                <span className="mt-1 text-xs text-zinc-500 font-light">Product screenshot placeholder</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
