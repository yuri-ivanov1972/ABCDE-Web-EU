export default function Slide07Scanner() {
  return (
    <div className="w-screen h-screen overflow-hidden relative font-display" style={{ background: "#0f3d22" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0f3d22 0%, #1a5c30 60%, #0f3d22 100%)" }} />
      <div className="absolute top-0 right-0 w-[45vw] h-full flex items-center justify-center" style={{ paddingRight: "6vw" }}>
        <div className="flex flex-col items-center justify-center" style={{ width: "30vw", height: "30vw", border: "0.4vh solid rgba(52,168,90,0.4)", position: "relative" }}>
          <div className="absolute top-0 left-0 w-[4vw] h-[4vw]" style={{ borderTop: "0.5vh solid #34a85a", borderLeft: "0.5vh solid #34a85a" }} />
          <div className="absolute top-0 right-0 w-[4vw] h-[4vw]" style={{ borderTop: "0.5vh solid #34a85a", borderRight: "0.5vh solid #34a85a" }} />
          <div className="absolute bottom-0 left-0 w-[4vw] h-[4vw]" style={{ borderBottom: "0.5vh solid #34a85a", borderLeft: "0.5vh solid #34a85a" }} />
          <div className="absolute bottom-0 right-0 w-[4vw] h-[4vw]" style={{ borderBottom: "0.5vh solid #34a85a", borderRight: "0.5vh solid #34a85a" }} />
          <div style={{ width: "80%", height: "0.3vh", background: "rgba(52,168,90,0.6)" }} />
          <div className="flex flex-col items-center" style={{ marginTop: "3vh" }}>
            <span className="font-display font-black" style={{ fontSize: "2.2vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.2em" }}>BARCODE</span>
            <span className="font-display font-light" style={{ fontSize: "1.6vw", color: "rgba(255,255,255,0.3)", marginTop: "0.8vh" }}>scan in store</span>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: "8vw", paddingRight: "52vw" }}>
        <span className="font-display font-black tracking-widest uppercase" style={{ fontSize: "1.3vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.25em", marginBottom: "2vh" }}>Scanner</span>
        <h2 className="font-display font-black tracking-tight text-white" style={{ fontSize: "5.5vw", lineHeight: 0.95, marginBottom: "3.5vh", textWrap: "balance" }}>
          Scan a barcode.<br />Get the score.
        </h2>
        <div style={{ width: "5vw", height: "0.35vh", background: "#34a85a", marginBottom: "3.5vh" }} />
        <p className="font-display font-light" style={{ fontSize: "2.1vw", color: "rgba(255,255,255,0.75)", lineHeight: 1.5, textWrap: "pretty" }}>
          Point your camera at any product barcode in the store. ABCDE.lv instantly retrieves the Nutri-Score and full nutritional breakdown.
        </p>
        <p className="font-display font-light" style={{ fontSize: "2.1vw", color: "rgba(255,255,255,0.55)", lineHeight: 1.5, marginTop: "2vh", textWrap: "pretty" }}>
          Works directly in the browser — no app download required.
        </p>
      </div>
      <div className="absolute bottom-0 right-0" style={{ paddingBottom: "4vh", paddingRight: "8vw" }}>
        <span className="font-display" style={{ fontSize: "1.5vw", color: "rgba(255,255,255,0.2)" }}>abcde.lv</span>
      </div>
    </div>
  );
}
