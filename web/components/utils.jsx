import { A } from "@solidjs/router";
import { Icon } from "./icons";
import { u } from "./auth";
import { info } from "../data/info";

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

export function is2xx(res) {
  return Math.floor(res.status / 100) == 2;
}

export function RoundButton(props) {
  return (
    <span class="w-fit rounded-md block bg-b text-white px-3 py-1 cursor-pointer" onclick={props.onclick}>{props.text}</span>
  )
}

export function LinkButton(props) {
  // const classes = "w-fit rounded-md px-1 py-0.5 bg-white/10 cursor-pointer";
  const classes = "w-fit underline cursor-pointer";
  const text = props.text || props.children || 'here'
  if (props.href) {
    return <A href={props.href} class={classes}>{text}</A>
  }
  if (props.onclick || props.onClick) {
    return <span onclick={(props.onclick || props.onClick)} class={classes}>{text}</span>
  }
}

export const mds = " · ";

export function AIcon(props) {
  return (
    <A {...props} class="flex items-center gap-1 font-bold"><Icon type={props.type}/>{props.text}</A>
  )
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