import React from 'react';

export const AboutDeveloper: React.FC = () => {
  return (
    <div className="px-4 md:px-6 pb-6 mt-auto">
      <footer className="w-full bg-white/70 backdrop-blur-md border border-slate-200/80 text-slate-700 py-4 px-6 rounded-2xl shadow-xl relative overflow-hidden">
        {/* Soft elegant top reflection glow */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 relative z-10">
          
          {/* Left Side: Avatar Badge + Identity */}
          <div className="flex items-center space-x-4">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-emerald-500/60 shadow-md flex-shrink-0">
              <img 
                src="/developer-avatar.png" 
                alt="Parthiv Bania" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-900 text-sm tracking-wide">Parthiv Bania</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">B.Tech CSE</span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5 font-medium">React • Node.js • Supabase Postgres System</p>
            </div>
          </div>

          {/* Center: Single line project scope snippet */}
          <div className="hidden lg:block text-slate-500 text-[11px] font-medium tracking-wide max-w-md truncate border-l border-slate-300 pl-4">
            STMS Paradigm: Cloud Row-Level Security & Live Telemetry Telecommunication Engine.
          </div>

          {/* Right Side: Quick Mail Action Button */}
          <div className="flex items-center space-x-4 flex-shrink-0">
            <span className="hidden sm:inline text-[11px] font-mono font-semibold text-slate-500">parthiv448cse@gmail.com</span>
            <a 
              href="mailto:parthiv448cse@gmail.com"
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-700/20 cursor-pointer hover:scale-[1.02]"
            >
              ✉️ Contact Me
            </a>
          </div>

        </div>
      </footer>
    </div>
  );
};
