import { is2xx } from "../components/utils";
import { Decompresser } from "./decompresser";
import { info } from "./info";

export function parseParams(urlp) {
  // bad url
  if (urlp.length < 4) {
    urlp = "ehwor";
  }

  const params = { urlp };

  // default region limits (no limits)
  params.regionlimits = [ -36000, 36000, -90, 90 ];
  // default viewrange (full world view)
  params.viewranges = [ 5, 360 ];

  // region (default: world). stored by iso
  params.region = "wor";
  const wantedregion = urlp.substring(2);
  if (wantedregion in info && "disp" in info[wantedregion]) params.region = wantedregion;

  // type (default: a)
  params.type = Object.keys(info[params.region].disp)[0];
  const wantedtype = urlp[0];
  if (wantedtype in info[params.region].disp) params.type = wantedtype;

  // real type: zones / cities
  params.rtype = "bde".includes(params.type) ? "c" : "z";

  // difficulty: easy / medium / hard (default: hard)
  params.difficulty = params.region.length == 3
    ? ("emha".includes(urlp[1]) ? urlp[1] : "h")
    : ("emhx".includes(urlp[1]) ? urlp[1] : "h")

  params.onu = params.region.length == 3 && urlp[1] != "h";

  return params;
}

export async function fetchData(params) {
  const file = params.region.length >= 3
    ? (params.onu ? 'world_onu' : 'world')
    : {
        a: "d", b: "d",
        c: "s", d: "s",
        e: "e", f: "f"
      } [ params.type ] + params.region;
  const res = await fetch(`/api/data/${file}`);
  if (is2xx(res)) {
    const buffer = await res.arrayBuffer();
    return new Decompresser(buffer).decompress();
  } else {
    throw await res.text();
  }
}