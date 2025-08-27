import { u } from "./auth";
import { Decompresser } from "./decompresser";
import { info } from "./info";
import { is2xx } from "./utils";

export function timeAgo(date) {
  if (typeof date == 'object') date = new Date(date);
  const seconds = Math.floor((new Date() - date) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return interval === 1 ? `${interval} ${unit} ago` : `${interval} ${unit}s ago`;
    }
  }

  return 'just now';
}

export function accuracyToString(a) {
  return `${Math.round(a * 10) / 10}%`
}

export function populationToString(p) {
  return p > 1000000 ? `${Math.round(p / 100000) / 10}M` : (p > 1000 ? `${(p - (p % 1000)) / 1000}k` : p)
}

export function timeToString(t) {
  const z = a => { 
      a = a.toString();
      while (a.length < 2) a = "0" + a;
      return a;
  }
  const hours = Math.floor(t / (60 * 60 * 1000));
  const minutes = Math.floor((t % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((t % (60 * 1000)) / 1000);
  const millis  = Math.floor((t % 1000) / 100);
  return `${(hours > 0 ? `${hours}:${z(minutes)}` : minutes)}:${z(seconds)}.${millis}`;
}

export function getName(obj) {
  const preferred = u.params.lng || 'en';
  const available = Object.keys(obj).filter(key => obj[key].length > 0)
  if (available.includes(preferred)) return obj[preferred];
  return obj[available[0]];
}

export function regionName(iso) {
  return getName(info[iso].name).toLocaleLowerCase()
}

export function difficultyName(type, diff) {
  try {
    return getName((type == "e"
      ? {
        e: { fr: "facile (10)",     en: "easy (10)"   },
        m: { fr: "moyen (30)",      en: "medium (30)" },
        h: { fr: "difficile (100)", en: "hard (100)"  },
        a: { fr: "tout", en: "all" },
      }
      : {
        e: { fr: "facile", en: "easy"   },
        m: { fr: "moyen",  en: "medium" },
        h: { fr: "tout",   en: "all"    },
        o: { fr: "tout (onu)", en: "all (un)"}
      }
    ) [ diff ]);
  } catch(err) {
    return null;
  }
}

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
        e: "d", f: "f"
      } [ params.type ] + params.region;
  const res = await fetch(`/api/data/${file}`);
  if (is2xx(res)) {
    const buffer = await res.arrayBuffer();
    return new Decompresser(buffer).decompress();
  } else {
    throw await res.text();
  }
}