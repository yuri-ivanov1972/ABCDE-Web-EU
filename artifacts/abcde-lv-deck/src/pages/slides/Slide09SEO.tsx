export default function Slide09SEO() {
  return (
    <div className="w-screen h-screen overflow-hidden relative font-display" style={{ background: "#1d7a45" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(150deg, #0f3d22 0%, #1d7a45 100%)" }} />
      <div className="absolute bottom-0 right-0 w-[50vw] h-[50vw]" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)" }} />
      <div className="absolute inset-0 flex" style={{ paddingLeft: "8vw", paddingRight: "8vw", paddingTop: "7vh", paddingBottom: "7vh" }}>
        <div className="flex flex-col justify-center" style={{ flex: "0 0 48%", paddingRight: "4vw" }}>
          <span className="font-display font-black tracking-widest uppercase" style={{ fontSize: "1.3vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.25em", marginBottom: "2vh" }}>SEO</span>
          <h2 className="font-display font-black tracking-tight text-white" style={{ fontSize: "4.8vw", lineHeight: 1.0, marginBottom: "3.5vh", textWrap: "balance" }}>
            Every product.<br />Indexed.
          </h2>
          <div style={{ width: "5vw", height: "0.35vh", background: "rgba(255,255,255,0.4)", marginBottom: "3.5vh" }} />
          <p className="font-display font-light" style={{ fontSize: "2vw", color: "rgba(255,255,255,0.75)", lineHeight: 1.5, textWrap: "pretty" }}>
            Server-side meta injection gives each product page a unique title and description. A dynamic sitemap covers all products, with duplicate pages filtered out automatically.
          </p>
        </div>
        <div className="flex flex-col justify-center" style={{ flex: "0 0 52%", gap: "2.5vh" }}>
          <div className="flex items-center" style={{ padding: "2.5vh 2.5vw", background: "rgba(255,255,255,0.08)", gap: "3vw" }}>
            <span className="font-display font-black text-white" style={{ fontSize: "5vw", lineHeight: 1, minWidth: "12vw" }}>SSR</span>
            <span className="font-display font-light" style={{ fontSize: "2vw", color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>Per-page meta tags injected server-side for Google and social previews</span>
          </div>
          <div className="flex items-center" style={{ padding: "2.5vh 2.5vw", background: "rgba(255,255,255,0.08)", gap: "3vw" }}>
            <span className="font-display font-black text-white" style={{ fontSize: "5vw", lineHeight: 1, minWidth: "12vw" }}>XML</span>
            <span className="font-display font-light" style={{ fontSize: "2vw", color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>Sitemap covers 5 000+ product pages, excluding known duplicates via noindex</span>
          </div>
          <div className="flex items-center" style={{ padding: "2.5vh 2.5vw", background: "rgba(255,255,255,0.08)", gap: "3vw" }}>
            <span className="font-display font-black text-white" style={{ fontSize: "5vw", lineHeight: 1, minWidth: "12vw" }}>lv</span>
            <span className="font-display font-light" style={{ fontSize: "2vw", color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>Latvian-language product names and categories for local search visibility</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 right-0" style={{ paddingBottom: "4vh", paddingRight: "8vw" }}>
        <span className="font-display" style={{ fontSize: "1.5vw", color: "rgba(255,255,255,0.2)" }}>abcde.lv</span>
      </div>
    </div>
  );
}
