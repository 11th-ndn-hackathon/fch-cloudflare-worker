addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request))
});

async function fetchTestbedNodesJson() {
  const req = new Request("https://ndndemo.arl.wustl.edu/testbed-nodes.json");
  req.cf = {
    cacheEverything: true,
    cacheTtl: 300,
  };
  return Object.values(await fetch(req).then((res) => res.json()));
}

/**
 * @param {[number, number]}
 * @param {[number, number]}
 * @return {[number, number]}
 */
function computeDistance([aLat, aLon], [bLat, bLon]) {
  // https://github.com/Turfjs/turf-distance/blob/a79f9dcc4402e0244fbcd3b7f36d9b361d9032bf/index.js#L53-L60
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  aLat = toRad(aLat);
  bLat = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(aLat) * Math.cos(bLat);
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * @param {Request} req
 */
async function handleRequest(req) {
  const url = new URL(req.url);
  const k = parseInt(url.searchParams.get("k"), 10) || 1;
  const rLat = parseFloat(url.searchParams.get("lat"));
  const rLon = parseFloat(url.searchParams.get("lon"));
  const cap = url.searchParams.get("cap") || "udp"; // capability - UDP/TCP/WSS

  /**
   * @type [[number, number], Array<{ position:[number,number], site:string }>]
   */
  const [cPos, nodes] = await Promise.all([
    !(isNaN(rLat) || isNaN(rLon)) ? [rLat, rLon] :
      [req.cf.latitude, req.cf.longitude],
    fetchTestbedNodesJson(),
  ]);

  switch(cap) {
    case "wss":
      var avail = nodes.filter((n) => n["fch-enabled"] && n["ws-tls"]);
    case "udp":
      var avail = nodes.filter((n) => n["fch-enabled"] && !n["ws-tls"]);
    default:
      // default is udp
      var avail = nodes.filter((n) => n["fch-enabled"] && !n["ws-tls"]);
  }

  avail.sort(({ position: aPos }, { position: bPos }) => {
    return computeDistance(aPos, cPos) - computeDistance(bPos, cPos);
  });

  const ret = avail.slice(0, k).map((n) => new URL(n.site).hostname);
  const res = new Response(`${ret.join()}`);
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS"),
  res.headers.set("Access-Control-Allow-Headers", "Content-Type"),
  res.headers.set("X-FCH-client-pos", `${cPos.join()}`);
  return res;
}

