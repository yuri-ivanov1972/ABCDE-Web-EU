export default function Slide04NutriScore() {
  return (
    <div className="w-screen h-screen overflow-hidden relative font-display" style={{ background: "#f7faf7" }}>
      <div className="absolute top-0 left-0 h-full" style={{ width: "0.6vw", background: "#1d7a45" }} />
      <div className="absolute inset-0 flex" style={{ paddingLeft: "8vw", paddingRight: "8vw", paddingTop: "7vh", paddingBottom: "7vh" }}>
        <div className="flex flex-col justify-center" style={{ flex: "0 0 42%" }}>
          <span className="font-display font-black tracking-widest uppercase" style={{ fontSize: "1.3vw", color: "#1d7a45", letterSpacing: "0.25em", marginBottom: "2vh" }}>Nutri-Score</span>
          <h2 className="font-display font-black tracking-tight" style={{ fontSize: "4.8vw", lineHeight: 1.0, color: "#0f3d22", textWrap: "balance", marginBottom: "3vh" }}>
            One letter.<br />Clear choice.
          </h2>
          <div style={{ width: "5vw", height: "0.35vh", background: "#34a85a", marginBottom: "3vh" }} />
          <p className="font-display font-light" style={{ fontSize: "2vw", color: "#1a2e1f", lineHeight: 1.5, textWrap: "pretty" }}>
            The Nutri-Score system grades each product from A to E based on nutritional quality — energy, saturated fat, sugars, salt, protein, fibre, and fruit content.
          </p>
          <p className="font-display font-light" style={{ fontSize: "2vw", color: "#5a7060", marginTop: "2vh", lineHeight: 1.5 }}>
            ABCDE.lv calculates and displays the grade for every product so shoppers can compare at a glance.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center" style={{ flex: "0 0 58%", gap: "1.4vh", paddingLeft: "4vw" }}>
          <div className="flex items-center" style={{ gap: "2vw", width: "100%" }}>
            <div className="flex items-center justify-center font-display font-black text-white" style={{ width: "7vw", height: "7vw", background: "#1d7a45", fontSize: "3.8vw", flexShrink: 0 }}>A</div>
            <div className="flex flex-col">
              <span className="font-display font-bold" style={{ fontSize: "2vw", color: "#0f3d22" }}>Excellent nutritional quality</span>
              <span className="font-display font-light" style={{ fontSize: "1.7vw", color: "#5a7060" }}>Whole grains, fresh produce, lean proteins</span>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: "2vw", width: "100%" }}>
            <div className="flex items-center justify-center font-display font-black text-white" style={{ width: "7vw", height: "7vw", background: "#5aad6e", fontSize: "3.8vw", flexShrink: 0 }}>B</div>
            <div className="flex flex-col">
              <span className="font-display font-bold" style={{ fontSize: "2vw", color: "#0f3d22" }}>Good nutritional quality</span>
              <span className="font-display font-light" style={{ fontSize: "1.7vw", color: "#5a7060" }}>Balanced everyday products</span>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: "2vw", width: "100%" }}>
            <div className="flex items-center justify-center font-display font-black text-white" style={{ width: "7vw", height: "7vw", background: "#d4a017", fontSize: "3.8vw", flexShrink: 0 }}>C</div>
            <div className="flex flex-col">
              <span className="font-display font-bold" style={{ fontSize: "2vw", color: "#0f3d22" }}>Moderate nutritional quality</span>
              <span className="font-display font-light" style={{ fontSize: "1.7vw", color: "#5a7060" }}>Fine in moderation</span>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: "2vw", width: "100%" }}>
            <div className="flex items-center justify-center font-display font-black text-white" style={{ width: "7vw", height: "7vw", background: "#e07b30", fontSize: "3.8vw", flexShrink: 0 }}>D</div>
            <div className="flex flex-col">
              <span className="font-display font-bold" style={{ fontSize: "2vw", color: "#0f3d22" }}>Poor nutritional quality</span>
              <span className="font-display font-light" style={{ fontSize: "1.7vw", color: "#5a7060" }}>High in fat, sugar, or salt</span>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: "2vw", width: "100%" }}>
            <div className="flex items-center justify-center font-display font-black text-white" style={{ width: "7vw", height: "7vw", background: "#c0392b", fontSize: "3.8vw", flexShrink: 0 }}>E</div>
            <div className="flex flex-col">
              <span className="font-display font-bold" style={{ fontSize: "2vw", color: "#0f3d22" }}>Very poor nutritional quality</span>
              <span className="font-display font-light" style={{ fontSize: "1.7vw", color: "#5a7060" }}>Limit consumption</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 right-0" style={{ paddingBottom: "4vh", paddingRight: "8vw" }}>
        <span className="font-display" style={{ fontSize: "1.5vw", color: "rgba(29,122,69,0.3)" }}>abcde.lv</span>
      </div>
    </div>
  );
}
