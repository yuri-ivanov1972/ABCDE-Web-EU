export default function Slide01Title() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0f3d22", fontFamily: "inherit" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0f3d22 0%, #1d7a45 60%, #0f3d22 100%)" }} />
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw]" style={{ background: "radial-gradient(circle, rgba(52,168,90,0.18) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 w-[30vw] h-[30vw]" style={{ background: "radial-gradient(circle, rgba(52,168,90,0.12) 0%, transparent 70%)" }} />
      <div className="absolute top-0 left-0 w-full h-full flex flex-col justify-center" style={{ paddingLeft: "8vw", paddingRight: "8vw" }}>
        <div className="flex items-center" style={{ marginBottom: "3vh", gap: "1vw" }}>
          <span className="font-black text-white" style={{ fontSize: "1.3vw", letterSpacing: "0.05em" }}>NUTRI-SCORE</span>
          <div className="flex items-center" style={{ gap: "0.3vw" }}>
            <div className="flex items-center justify-center font-black text-white" style={{ width: "2.4vw", height: "2.4vw", background: "#1d7a45", fontSize: "1.4vw" }}>A</div>
            <div className="flex items-center justify-center font-black text-white" style={{ width: "2.4vw", height: "2.4vw", background: "#5aad6e", fontSize: "1.4vw" }}>B</div>
            <div className="flex items-center justify-center font-black text-white" style={{ width: "2.4vw", height: "2.4vw", background: "#d4a017", fontSize: "1.4vw" }}>C</div>
            <div className="flex items-center justify-center font-black text-white" style={{ width: "2.4vw", height: "2.4vw", background: "#e07b30", fontSize: "1.4vw" }}>D</div>
            <div className="flex items-center justify-center font-black text-white" style={{ width: "2.4vw", height: "2.4vw", background: "#c0392b", fontSize: "1.4vw" }}>E</div>
          </div>
          <span className="font-black text-white" style={{ fontSize: "1.5vw", letterSpacing: "0.12em", marginLeft: "0.5vw" }}>ABCDE.LV</span>
        </div>
        <h1 className="font-black tracking-tighter text-white" style={{ fontSize: "8vw", lineHeight: 0.95, textWrap: "balance", marginBottom: "3vh" }}>
          Know what<br />you eat.
        </h1>
        <div style={{ width: "8vw", height: "0.4vh", background: "#34a85a", marginBottom: "3.5vh" }} />
        <p className="font-light" style={{ fontSize: "2.2vw", color: "rgba(255,255,255,0.75)", maxWidth: "50vw", textWrap: "pretty" }}>
          Latvia's food product browser with Nutri-Score ratings across Rimi and Maxima.
        </p>
      </div>
      <div className="absolute bottom-0 right-0 flex flex-col items-end" style={{ paddingBottom: "5vh", paddingRight: "8vw" }}>
        <span className="font-light" style={{ fontSize: "1.5vw", color: "rgba(255,255,255,0.4)" }}>abcde.lv</span>
      </div>
    </div>
  );
}
