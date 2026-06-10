export default function Slide08TechStack() {
  return (
    <div className="w-screen h-screen overflow-hidden relative font-display" style={{ background: "#f7faf7" }}>
      <div className="absolute top-0 left-0 h-full" style={{ width: "0.6vw", background: "#1d7a45" }} />
      <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: "8vw", paddingRight: "8vw" }}>
        <span className="font-display font-black tracking-widest uppercase" style={{ fontSize: "1.3vw", color: "#1d7a45", letterSpacing: "0.25em", marginBottom: "2vh" }}>Architecture</span>
        <h2 className="font-display font-black tracking-tight" style={{ fontSize: "4.5vw", lineHeight: 1.0, color: "#0f3d22", marginBottom: "4vh", textWrap: "balance" }}>
          Built for scale<br />and fast delivery.
        </h2>
        <div className="flex" style={{ gap: "2.5vw" }}>
          <div className="flex flex-col" style={{ flex: 1, padding: "2.5vh 2vw", borderTop: "0.4vh solid #1d7a45", background: "rgba(29,122,69,0.04)" }}>
            <span className="font-display font-black" style={{ fontSize: "1.8vw", color: "#1d7a45", marginBottom: "1.5vh" }}>Frontend</span>
            <span className="font-display font-bold" style={{ fontSize: "2vw", color: "#0f3d22", marginBottom: "0.6vh" }}>React + Vite</span>
            <span className="font-display font-light" style={{ fontSize: "1.8vw", color: "#5a7060", lineHeight: 1.4 }}>Tailwind v3, Wouter routing, TanStack Query, react-i18next</span>
          </div>
          <div className="flex flex-col" style={{ flex: 1, padding: "2.5vh 2vw", borderTop: "0.4vh solid #1d7a45", background: "rgba(29,122,69,0.04)" }}>
            <span className="font-display font-black" style={{ fontSize: "1.8vw", color: "#1d7a45", marginBottom: "1.5vh" }}>Backend</span>
            <span className="font-display font-bold" style={{ fontSize: "2vw", color: "#0f3d22", marginBottom: "0.6vh" }}>Express 5 + Node 24</span>
            <span className="font-display font-light" style={{ fontSize: "1.8vw", color: "#5a7060", lineHeight: 1.4 }}>TypeScript 5.9, esbuild ESM bundle, SSR meta injection</span>
          </div>
          <div className="flex flex-col" style={{ flex: 1, padding: "2.5vh 2vw", borderTop: "0.4vh solid #1d7a45", background: "rgba(29,122,69,0.04)" }}>
            <span className="font-display font-black" style={{ fontSize: "1.8vw", color: "#1d7a45", marginBottom: "1.5vh" }}>Data</span>
            <span className="font-display font-bold" style={{ fontSize: "2vw", color: "#0f3d22", marginBottom: "0.6vh" }}>PostgreSQL + Drizzle</span>
            <span className="font-display font-light" style={{ fontSize: "1.8vw", color: "#5a7060", lineHeight: 1.4 }}>Three Neon databases: Rimi, Maxima, and local barcode scans</span>
          </div>
          <div className="flex flex-col" style={{ flex: 1, padding: "2.5vh 2vw", borderTop: "0.4vh solid #1d7a45", background: "rgba(29,122,69,0.04)" }}>
            <span className="font-display font-black" style={{ fontSize: "1.8vw", color: "#1d7a45", marginBottom: "1.5vh" }}>Deploy</span>
            <span className="font-display font-bold" style={{ fontSize: "2vw", color: "#0f3d22", marginBottom: "0.6vh" }}>Replit + pnpm</span>
            <span className="font-display font-light" style={{ fontSize: "1.8vw", color: "#5a7060", lineHeight: 1.4 }}>Monorepo workspace, multi-artifact routing, CI typecheck</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 right-0" style={{ paddingBottom: "4vh", paddingRight: "8vw" }}>
        <span className="font-display" style={{ fontSize: "1.5vw", color: "rgba(29,122,69,0.3)" }}>abcde.lv</span>
      </div>
    </div>
  );
}
