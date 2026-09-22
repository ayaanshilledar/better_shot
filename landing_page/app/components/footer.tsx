import React from "react";

// Easily customize your footer links, URLs, and labels here:
export interface FooterLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export const FOOTER_LINKS: FooterLink[] = [
  {
    label: "GitHub",
    href: "https://github.com/ayaanshilledar/better_shot",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        />
      </svg>
    ),
  },
  {
    label: "Releases",
    href: "https://github.com/ayaanshilledar/better_shot/releases",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
  },
  {
    label: "Issues",
    href: "https://github.com/ayaanshilledar/better_shot/issues",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="w-full border-t border-[#222630] pt-16 sm:pt-24 pb-8 sm:pb-12 relative overflow-hidden bg-[#0d0e12]">
      {/* Ambient bottom glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[260px] bg-white/[0.02] blur-[150px] pointer-events-none -z-10" />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 relative z-10 flex flex-col justify-between">
        
        {/* Top Section: Brand Summary & Social Buttons (Border removed) */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-10">
          
          {/* Brand Summary */}
          <div className="flex flex-col items-start max-w-sm">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-base font-semibold tracking-tight text-white">
                BetterShot
              </span>
              <span className="text-[10px] uppercase font-bold text-zinc-400 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.04]">
                v1.0 Windows
              </span>
            </div>
            <p className="text-xs font-light text-zinc-400 leading-relaxed">
              macOS-inspired screen capture and recording engineered for Windows.
            </p>
          </div>

          {/* Socials & Action Buttons with Bold Typography and Premium Hover */}
          <div className="flex flex-wrap items-center gap-3">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white text-zinc-200 hover:text-black border border-white/10 hover:border-white text-xs font-semibold tracking-wide transition-all duration-200 shadow-sm"
              >
                {link.icon && (
                  <span className="text-zinc-400 group-hover:text-black transition-colors">
                    {link.icon}
                  </span>
                )}
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Bottom Sub-row: Author */}
        <div className="pt-4 pb-8 flex items-center justify-end text-xs font-light text-zinc-500">
          <div className="flex items-center gap-1.5 font-normal">
            <span>Built by</span>
            <a
              href="https://github.com/ayaanshilledar"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-300 hover:text-white font-semibold transition-colors underline underline-offset-4 decoration-zinc-700 hover:decoration-white"
            >
              Ayaan Shilledar
            </a>
          </div>
        </div>

        {/* Creative Bold Typography Watermark */}
        <div className="w-full pt-2 pb-2 flex justify-center select-none overflow-hidden">
          <h1 className="text-[13vw] font-bold tracking-tighter uppercase leading-none text-transparent bg-clip-text bg-gradient-to-b from-white/15 via-white/5 to-transparent text-center scale-y-110">
            BetterShot
          </h1>
        </div>

      </div>
    </footer>
  );
}
