// Inspection aid only. Review first, then paste into Chrome DevTools after
// selecting a PUBLIC catalogue grid/card or main product detail element as $0.
// No network, cookies, storage, cart inspection, DOM writes or extension code.
((root) => {
  if (!(root instanceof Element) || root === document.body ||
      root === document.documentElement) {
    throw new Error("Select only a public product grid/card/detail element in Elements first.");
  }
  if (location.origin !== "https://barbora.lv") {
    throw new Error("Run only on the approved Barbora.lv origin.");
  }
  const selector = "[data-product-id], [data-cnstrc-item-id]";
  const read = (includeExamples = false) => {
    const nodes = [...(root.matches(selector) ? [root] : []),
      ...root.querySelectorAll(selector)];
    const bounded = nodes.slice(0, 500);
    const ids = bounded.map((node) => ({
      outer: node.getAttribute("data-product-id"),
      inner: node.getAttribute("data-cnstrc-item-id"),
    }));
    const keys = ids.flatMap(({ outer, inner }) => [outer, inner])
      .filter((value) => value !== null);
    const valid = keys.filter((value) => /^[0-9]{18}$/.test(value));
    return {
      connected: root.isConnected,
      identifierElements: nodes.length,
      inspectedElements: bounded.length,
      truncated: nodes.length > bounded.length,
      uniqueValidSkus: new Set(valid).size,
      malformedKeys: keys.length - valid.length,
      sameElementDisagreements: ids.filter(({ outer, inner }) =>
        outer !== null && inner !== null && outer !== inner).length,
      detailBlocks: Number(root.matches("[data-cnstrc-product-detail]")) +
        root.querySelectorAll("[data-cnstrc-product-detail]").length,
      ...(includeExamples ? { publicTestSkuExamples: [...new Set(valid)].slice(0, 5) } : {}),
    };
  };
  console.info("ABCDE local public-product diagnostic", read(true));
  let timer;
  let previous = JSON.stringify(read());
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const result = read();
      const next = JSON.stringify(result);
      if (next !== previous) {
        console.info("ABCDE aggregate DOM change", result);
        previous = next;
      }
    }, 250);
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["data-product-id", "data-cnstrc-item-id"] });
  setTimeout(() => {
    observer.disconnect();
    clearTimeout(timer);
    console.info("ABCDE diagnostic stopped after 30 seconds", read());
  }, 30000);
})($0);
