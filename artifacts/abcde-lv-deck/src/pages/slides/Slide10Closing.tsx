export default function Slide10Closing() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0f3d22" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0f3d22 0%, #1d7a45 60%, #0f3d22 100%)" }} />
      <div className="absolute top-0 left-0 w-[40vw] h-[40vw]" style={{ background: "radial-gradient(circle, rgba(52,168,90,0.15) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 right-0 w-[35vw] h-[35vw]" style={{ background: "radial-gradient(circle, rgba(52,168,90,0.12) 0%, transparent 70%)" }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingLeft: "8vw", paddingRight: "8vw" }}>
        <div className="flex items-center justify-center" style={{ marginBottom: "3.5vh", gap: "0.8vw" }}>
          <span className="font-black text-white" style={{ fontSize: "1.4vw", letterSpacing: "0.05em" }}>NUTRI-SCORE</span>
          <div className="flex items-center" style={{ gap: "0.35vw" }}>
            <div className="flex items-center justify-center font-black text-white" style={{ width: "2.8vw", height: "2.8vw", background: "#1d7a45", fontSize: "1.6vw" }}>A</div>
            <div className="flex items-center justify-center font-black text-white" style={{ width: "2.8vw", height: "2.8vw", background: "#5aad6e", fontSize: "1.6vw" }}>B</div>
            <div className="flex items-center justify-center font-black text-white" style={{ width: "2.8vw", height: "2.8vw", background: "#d4a017", fontSize: "1.6vw" }}>C</div>
            <div className="flex items-center justify-center font-black text-white" style={{ width: "2.8vw", height: "2.8vw", background: "#e07b30", fontSize: "1.6vw" }}>D</div>
            <div className="flex items-center justify-center font-black text-white" style={{ width: "2.8vw", height: "2.8vw", background: "#c0392b", fontSize: "1.6vw" }}>E</div>
          </div>
        </div>
        <h2 className="font-black tracking-tight text-white text-center" style={{ fontSize: "7vw", lineHeight: 0.95, textWrap: "balance", marginBottom: "3vh" }}>
          Know what<br />you eat.
        </h2>
        <div style={{ width: "8vw", height: "0.4vh", background: "#34a85a", marginBottom: "3.5vh" }} />
        <p className="font-light text-center" style={{ fontSize: "2.2vw", color: "rgba(255,255,255,0.65)", maxWidth: "50vw", textWrap: "pretty", lineHeight: 1.5 }}>
          5 000+ products. Two stores. One Nutri-Score grade per product.
        </p>
        <div style={{ marginTop: "4vh" }}>
          <a
            href="https://abcde.lv"
            target="_blank"
            rel="noopener noreferrer"
            className="font-black"
            style={{ fontSize: "2.4vw", color: "#34a85a", textDecoration: "underline", textUnderlineOffset: "0.3em" }}
          >
            abcde.lv
          </a>
        </div>
      </div>
    </div>
  );
}
