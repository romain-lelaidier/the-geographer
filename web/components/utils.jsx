import { A, useLocation, useNavigate } from "@solidjs/router";
import { Icon } from "./icons";
import { Flag } from "./flag";
import { Show } from "solid-js";

export const mds = " · ";


export function Link(props) {
  const location = useLocation();
  return <A state={{ previous: location.pathname }} {...props} />;
}

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const backPath = () => (location.state?.previous ? -1 : '/');
  return <button class="uppercase flex flex-row gap-1 items-center cursor-pointer" onClick={() => navigate(backPath())}><Icon type="arrow-left" size={1}/><span class="pt-[0.8]">back</span></button>;
}

export function LinkButton(props) {
  const classes = "w-fit underline cursor-pointer";
  const text = props.text || props.children || 'here'
  if (props.href) {
    return <Link href={props.href} class={classes}>{text}</Link>
  }
  if (props.onclick || props.onClick) {
    return <span onclick={(props.onclick || props.onClick)} class={classes}>{text}</span>
  }
}

export function User(props) {
  return (
    <Link class="inline flex flex-row gap-1" href={"/profile/" + props.user.name}>
      <Show when={props.user.iso}>
        <Flag iso={props.user.iso}/>
        <span> </span>
      </Show>
      <span class="font-bold">{props.user.name}</span>
    </Link>
  )
}

export function LinkIcon(props) {
  return (
    <Link {...props} class="flex items-center gap-1 font-bold"><Icon type={props.type}/>{props.text}</Link>
  )
}