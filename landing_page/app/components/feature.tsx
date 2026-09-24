import React from "react";

export default function Feature() {
  return (
    <section className="w-full mt-28 sm:mt-40 flex flex-col text-left">
      {/* Section Headline */}
      <div className="text-center max-w-4xl mx-auto mb-16 sm:mb-24">
        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-light tracking-tight text-white leading-tight whitespace-normal sm:whitespace-nowrap">
          Capture clearly. Share effortlessly.
        </h2>
      </div>

      {/* Alternating Feature Rows */}
      <div className="flex flex-col gap-24 sm:gap-36">
        {/* Feature Row 1: Left Description, Right Image 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16 items-center">
          <div className="flex flex-col items-start max-w-lg">
            <h3 className="text-2xl sm:text-4xl font-light tracking-tight text-white leading-tight">
              Capture the screen, a window, or any <span className="font-offbit tracking-wide text-white">custom area.</span>
            </h3>
          </div>

          {/* Image 1 Placeholder */}
          <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-[#14161d] border border-[#262a35] flex items-center justify-center select-none">
            {/* 
              Drop image into landing_page/public/ and uncomment:
              <img src="/image-1.png" alt="Feature 1" className="w-full h-full object-cover object-top" />
            */}
            <span className="text-xs font-light text-zinc-600 tracking-widest uppercase">Image 1</span>
          </div>
        </div>

        {/* Feature Row 2 (Inverted): Left Image 2, Right Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16 items-center">
          {/* Image 2 Placeholder */}
          <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-[#14161d] border border-[#262a35] flex items-center justify-center select-none order-2 md:order-1">
            {/* 
              Drop image into landing_page/public/ and uncomment:
              <img src="/image-2.png" alt="Feature 2" className="w-full h-full object-cover object-top" />
            */}
            <span className="text-xs font-light text-zinc-600 tracking-widest uppercase">Image 2</span>
          </div>

          {/* Description */}
          <div className="flex flex-col items-start max-w-lg order-1 md:order-2">
            <h3 className="text-2xl sm:text-4xl font-light tracking-tight text-white leading-tight">
              <span className="font-offbit tracking-wide text-white">Camera bubble</span> overlay with studio audio mixing.
            </h3>
          </div>
        </div>

        {/* Feature Row 3: Left Description, Right Image 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16 items-center">
          <div className="flex flex-col items-start max-w-lg">
            <h3 className="text-2xl sm:text-4xl font-light tracking-tight text-white leading-tight">
              <span className="font-offbit tracking-wide text-white">Trim, inspect</span>, and export with zero friction.
            </h3>
          </div>

          {/* Image 3 Placeholder */}
          <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-[#14161d] border border-[#262a35] flex items-center justify-center select-none">
            {/* 
              Drop image into landing_page/public/ and uncomment:
              <img src="/image-3.png" alt="Feature 3" className="w-full h-full object-cover object-top" />
            */}
            <span className="text-xs font-light text-zinc-600 tracking-widest uppercase">Image 3</span>
          </div>
        </div>
      </div>
    </section>
  );
}
