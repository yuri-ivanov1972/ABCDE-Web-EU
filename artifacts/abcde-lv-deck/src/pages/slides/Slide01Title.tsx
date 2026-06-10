export default function Slide01Title() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-dark font-display" style={{ background: "#0f3d22" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0f3d22 0%, #1d7a45 60%, #0f3d22 100%)" }} />
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw]" style={{ background: "radial-gradient(circle, rgba(52,168,90,0.18) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 w-[30vw] h-[30vw]" style={{ background: "radial-gradient(circle, rgba(52,168,90,0.12) 0%, transparent 70%)" }} />
      <div className="absolute top-0 left-0 w-full h-full flex flex-col justify-center" style={{ paddingLeft: "8vw", paddingRight: "8vw" }}>
        <div style={{ marginBottom: "2vh" }}>
          <span className="font-display font-black tracking-widest uppercase" style={{ fontSize: "1.4vw", color: "#34a85a", letterSpacing: "0.3em" }}>abcde.lv</span>
        </div>
        <h1 className="font-display font-black tracking-tighter text-white" style={{ fontSize: "8vw", lineHeight: 0.95, textWrap: "balance", marginBottom: "3vh" }}>
          Know what<br />you eat.
        </h1>
        <div style={{ width: "8vw", height: "0.4vh", background: "#34a85a", marginBottom: "3.5vh" }} />
        <p className="font-display font-light" style={{ fontSize: "2.2vw", color: "rgba(255,255,255,0.75)", maxWidth: "50vw", textWrap: "pretty" }}>
          Latvia's food product browser with Nutri-Score ratings across Rimi and Maxima.
        </p>
      </div>
      <div className="absolute bottom-0 right-0 flex flex-col items-end" style={{ paddingBottom: "5vh", paddingRight: "8vw" }}>
        <span className="font-display font-light" style={{ fontSize: "1.5vw", color: "rgba(255,255,255,0.4)" }}>abcde.lv</span>
      </div>
    </div>
  );
}
