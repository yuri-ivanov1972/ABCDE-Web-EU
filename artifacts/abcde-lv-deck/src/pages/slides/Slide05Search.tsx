export default function Slide05Search() {
  return (
    <div className="w-screen h-screen overflow-hidden relative font-display" style={{ background: "#0f3d22" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(150deg, #0f3d22 0%, #1d7a45 100%)" }} />
      <div className="absolute top-0 left-[50vw] w-[50vw] h-full" style={{ background: "linear-gradient(to right, transparent, rgba(52,168,90,0.1))" }} />
      <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: "8vw", paddingRight: "8vw" }}>
        <span className="font-display font-black tracking-widest uppercase" style={{ fontSize: "1.3vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.25em", marginBottom: "2vh" }}>Search & filter</span>
        <h2 className="font-display font-black tracking-tight text-white" style={{ fontSize: "5vw", lineHeight: 1.0, marginBottom: "4vh", textWrap: "balance" }}>
          Find exactly<br />the right product.
        </h2>
        <div style={{ width: "6vw", height: "0.35vh", background: "#34a85a", marginBottom: "4.5vh" }} />
        <div className="flex" style={{ gap: "3vw" }}>
          <div className="flex flex-col" style={{ flex: 1 }}>
            <span className="font-display font-black" style={{ fontSize: "2.4vw", color: "#34a85a", marginBottom: "1.2vh" }}>Category browse</span>
            <span className="font-display font-light" style={{ fontSize: "2vw", color: "rgba(255,255,255,0.75)", lineHeight: 1.45, textWrap: "pretty" }}>Filter products by supermarket category — dairy, meat, snacks, beverages, and more.</span>
          </div>
          <div className="flex flex-col" style={{ flex: 1 }}>
            <span className="font-display font-black" style={{ fontSize: "2.4vw", color: "#34a85a", marginBottom: "1.2vh" }}>Nutrition filters</span>
            <span className="font-display font-light" style={{ fontSize: "2vw", color: "rgba(255,255,255,0.75)", lineHeight: 1.45, textWrap: "pretty" }}>Narrow by Nutri-Score grade, calories, protein, fat, sugar, and salt ranges.</span>
          </div>
          <div className="flex flex-col" style={{ flex: 1 }}>
            <span className="font-display font-black" style={{ fontSize: "2.4vw", color: "#34a85a", marginBottom: "1.2vh" }}>Healthier alternatives</span>
            <span className="font-display font-light" style={{ fontSize: "2vw", color: "rgba(255,255,255,0.75)", lineHeight: 1.45, textWrap: "pretty" }}>Each product page suggests better-scoring alternatives in the same category.</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 right-0" style={{ paddingBottom: "4vh", paddingRight: "8vw" }}>
        <span className="font-display" style={{ fontSize: "1.5vw", color: "rgba(255,255,255,0.25)" }}>abcde.lv</span>
      </div>
    </div>
  );
}
