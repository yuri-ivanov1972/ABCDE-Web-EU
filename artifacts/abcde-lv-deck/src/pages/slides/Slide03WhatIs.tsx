export default function Slide03WhatIs() {
  return (
    <div className="w-screen h-screen overflow-hidden relative font-display" style={{ background: "#1d7a45" }}>
      <div className="absolute top-0 left-0 w-full h-full" style={{ background: "linear-gradient(160deg, #1d7a45 0%, #0f3d22 100%)" }} />
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw]" style={{ background: "radial-gradient(circle, rgba(52,168,90,0.15) 0%, transparent 65%)" }} />
      <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: "8vw", paddingRight: "8vw" }}>
        <span className="font-display font-black tracking-widest uppercase" style={{ fontSize: "1.3vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.25em", marginBottom: "2vh" }}>What is ABCDE.lv</span>
        <h2 className="font-display font-black tracking-tight text-white" style={{ fontSize: "4.5vw", lineHeight: 1.05, marginBottom: "5vh", textWrap: "balance" }}>
          A product browser built for<br />smarter grocery decisions.
        </h2>
        <div className="flex" style={{ gap: "3vw" }}>
          <div className="flex flex-col" style={{ flex: 1, padding: "3vh 2vw", background: "rgba(255,255,255,0.08)", borderTop: "0.4vh solid rgba(255,255,255,0.4)" }}>
            <span className="font-display font-black text-white" style={{ fontSize: "3.5vw", lineHeight: 1 }}>5 000+</span>
            <span className="font-display font-black text-white" style={{ fontSize: "1.8vw", marginTop: "1.2vh", marginBottom: "1.5vh" }}>Products</span>
            <span className="font-display font-light" style={{ fontSize: "1.9vw", color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>Rimi and Maxima products with full nutritional data</span>
          </div>
          <div className="flex flex-col" style={{ flex: 1, padding: "3vh 2vw", background: "rgba(255,255,255,0.08)", borderTop: "0.4vh solid rgba(255,255,255,0.4)" }}>
            <span className="font-display font-black text-white" style={{ fontSize: "3.5vw", lineHeight: 1 }}>A – E</span>
            <span className="font-display font-black text-white" style={{ fontSize: "1.8vw", marginTop: "1.2vh", marginBottom: "1.5vh" }}>Nutri-Score</span>
            <span className="font-display font-light" style={{ fontSize: "1.9vw", color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>International nutrition grading on every product card</span>
          </div>
          <div className="flex flex-col" style={{ flex: 1, padding: "3vh 2vw", background: "rgba(255,255,255,0.08)", borderTop: "0.4vh solid rgba(255,255,255,0.4)" }}>
            <span className="font-display font-black text-white" style={{ fontSize: "3.5vw", lineHeight: 1 }}>lv / en</span>
            <span className="font-display font-black text-white" style={{ fontSize: "1.8vw", marginTop: "1.2vh", marginBottom: "1.5vh" }}>Bilingual</span>
            <span className="font-display font-light" style={{ fontSize: "1.9vw", color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>Full Latvian and English interface throughout</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 right-0" style={{ paddingBottom: "4vh", paddingRight: "8vw" }}>
        <span className="font-display" style={{ fontSize: "1.5vw", color: "rgba(255,255,255,0.25)" }}>abcde.lv</span>
      </div>
    </div>
  );
}
