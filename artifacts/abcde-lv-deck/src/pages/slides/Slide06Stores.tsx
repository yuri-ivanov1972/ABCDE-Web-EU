import { ShoppingCart, Store, ArrowLeftRight } from "lucide-react";

export default function Slide06Stores() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#f7faf7" }}>
      <div className="absolute top-0 left-0 h-full" style={{ width: "0.6vw", background: "#1d7a45" }} />
      <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: "8vw", paddingRight: "8vw" }}>
        <span className="font-black tracking-widest uppercase" style={{ fontSize: "1.3vw", color: "#1d7a45", letterSpacing: "0.25em", marginBottom: "2vh" }}>Multi-store</span>
        <h2 className="font-black tracking-tight" style={{ fontSize: "4.8vw", lineHeight: 1.0, color: "#0f3d22", marginBottom: "4.5vh", textWrap: "balance" }}>
          Rimi and Maxima,<br />one platform.
        </h2>
        <div className="flex" style={{ gap: "4vw" }}>
          <div className="flex flex-col" style={{ flex: 1, padding: "3.5vh 2.5vw", background: "#0f3d22" }}>
            <div style={{ color: "#34a85a", width: "3vw", height: "3vw", marginBottom: "1.5vh" }}>
              <ShoppingCart style={{ width: "100%", height: "100%", strokeWidth: 1.8 }} />
            </div>
            <span className="font-black text-white" style={{ fontSize: "3vw", marginBottom: "0.8vh" }}>Rimi</span>
            <div style={{ width: "3vw", height: "0.35vh", background: "#34a85a", marginBottom: "2.5vh" }} />
            <span className="font-light" style={{ fontSize: "2vw", color: "rgba(255,255,255,0.8)", lineHeight: 1.5, textWrap: "pretty" }}>Latvia's largest supermarket chain. Thousands of products with nutritional data, category structure, and product images.</span>
          </div>
          <div className="flex flex-col" style={{ flex: 1, padding: "3.5vh 2.5vw", border: "0.25vh solid #1d7a45" }}>
            <div style={{ color: "#1d7a45", width: "3vw", height: "3vw", marginBottom: "1.5vh" }}>
              <Store style={{ width: "100%", height: "100%", strokeWidth: 1.8 }} />
            </div>
            <span className="font-black" style={{ fontSize: "3vw", color: "#0f3d22", marginBottom: "0.8vh" }}>Maxima</span>
            <div style={{ width: "3vw", height: "0.35vh", background: "#34a85a", marginBottom: "2.5vh" }} />
            <span className="font-light" style={{ fontSize: "2vw", color: "#1a2e1f", lineHeight: 1.5, textWrap: "pretty" }}>Second major chain covering Latvia and the Baltic region. Includes Barbora.lv delivery products alongside in-store items.</span>
          </div>
          <div className="flex flex-col justify-between" style={{ flex: 1, padding: "3.5vh 2.5vw", background: "#1d7a45" }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.7)", width: "3vw", height: "3vw", marginBottom: "1.5vh" }}>
                <ArrowLeftRight style={{ width: "100%", height: "100%", strokeWidth: 1.8 }} />
              </div>
              <span className="font-black text-white" style={{ fontSize: "3vw", marginBottom: "0.8vh" }}>Combined</span>
              <div style={{ width: "3vw", height: "0.35vh", background: "rgba(255,255,255,0.5)", marginBottom: "2.5vh" }} />
              <span className="font-light" style={{ fontSize: "2vw", color: "rgba(255,255,255,0.85)", lineHeight: 1.5, textWrap: "pretty" }}>Search, filter, and compare products across both stores in a single interface — no switching tabs.</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 right-0" style={{ paddingBottom: "4vh", paddingRight: "8vw" }}>
        <span className="font-light" style={{ fontSize: "1.5vw", color: "rgba(29,122,69,0.3)" }}>abcde.lv</span>
      </div>
    </div>
  );
}
