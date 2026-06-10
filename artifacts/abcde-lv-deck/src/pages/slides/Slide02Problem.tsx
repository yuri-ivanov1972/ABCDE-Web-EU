export default function Slide02Problem() {
  return (
    <div className="w-screen h-screen overflow-hidden relative font-display" style={{ background: "#f7faf7" }}>
      <div className="absolute top-0 left-0 h-full" style={{ width: "0.6vw", background: "#1d7a45" }} />
      <div className="absolute top-0 right-0 w-[35vw] h-full" style={{ background: "linear-gradient(to left, rgba(29,122,69,0.06), transparent)" }} />
      <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: "8vw", paddingRight: "8vw" }}>
        <span className="font-display font-black tracking-widest uppercase" style={{ fontSize: "1.3vw", color: "#1d7a45", letterSpacing: "0.25em", marginBottom: "2vh" }}>The problem</span>
        <h2 className="font-display font-black tracking-tight" style={{ fontSize: "5.5vw", lineHeight: 1.0, color: "#0f3d22", textWrap: "balance", marginBottom: "4vh" }}>
          Nutrition labels are small,<br />confusing, and easy to miss.
        </h2>
        <div style={{ width: "6vw", height: "0.35vh", background: "#34a85a", marginBottom: "4vh" }} />
        <div className="flex flex-col" style={{ gap: "2vh", maxWidth: "55vw" }}>
          <div className="flex items-start" style={{ gap: "2vw" }}>
            <span className="font-display font-black" style={{ fontSize: "2.2vw", color: "#1d7a45", minWidth: "3vw" }}>01</span>
            <p className="font-display font-light" style={{ fontSize: "2.1vw", color: "#1a2e1f", textWrap: "pretty", lineHeight: 1.4 }}>Shoppers at Rimi and Maxima have no quick way to compare the nutritional quality of products.</p>
          </div>
          <div className="flex items-start" style={{ gap: "2vw" }}>
            <span className="font-display font-black" style={{ fontSize: "2.2vw", color: "#1d7a45", minWidth: "3vw" }}>02</span>
            <p className="font-display font-light" style={{ fontSize: "2.1vw", color: "#1a2e1f", textWrap: "pretty", lineHeight: 1.4 }}>Finding a healthier alternative within a category means reading dozens of fine-print labels.</p>
          </div>
          <div className="flex items-start" style={{ gap: "2vw" }}>
            <span className="font-display font-black" style={{ fontSize: "2.2vw", color: "#1d7a45", minWidth: "3vw" }}>03</span>
            <p className="font-display font-light" style={{ fontSize: "2.1vw", color: "#1a2e1f", textWrap: "pretty", lineHeight: 1.4 }}>No single tool existed that covered both major Latvian supermarkets in one place.</p>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 right-0" style={{ paddingBottom: "4vh", paddingRight: "8vw" }}>
        <span className="font-display" style={{ fontSize: "1.5vw", color: "rgba(29,122,69,0.3)" }}>abcde.lv</span>
      </div>
    </div>
  );
}
