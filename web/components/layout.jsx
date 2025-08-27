import { A } from "@solidjs/router";
import { Match, Show, Switch } from "solid-js";
import { u } from "../api/auth";

export function Layout(props) {
  return (
    <>
      <div class="flex-grow overflow-y-scroll flex flex-col bg-d bg-[radial-gradient(#0006_1px,transparent_1px)] [background-size:16px_16px] bg-fixed">
        <Switch>
          <Match when={props.full}>
            <div class="flex flex-col ls:flex-row flex-grow ls:max-h-full ls:overflow-y-scroll">
              {props.children}
            </div>
          </Match>
          <Match when={props.floating}>
            <div class="flex-grow flex flex-col items-center justify-center">
              <div style={{'max-width': '100%'}} class="bg-d p-4 flex flex-col w-112 rounded-md drop-shadow-[0_0px_10px_rgba(0,0,0,0.15)] bg-white">
                {props.children}
              </div>
            </div>
          </Match>
          <Match when={true}>
            <div class={"bg-d p-4 flex flex-col gap-2 flex-grow sm:mx-16 md:mx-32 lg:mx-48 xl:mx-64 2xl:mx-80" + (props.center ? ' justify-center' : '')}>
              {props.children}
            </div>
          </Match>
        </Switch>
      </div>
      <footer class="footer sm:footer-horizontal bg-b text-d flex justify-center flex-wrap [&>*]:px-4 [&>*]:py-0.5">
        <A href="/">Home</A>
        <Show when={u.connected}>
          <A href="/settings">Settings</A>
        </Show>
        <span>MIT License · 2025</span>
        <A href="https://github.com/romain-lelaidier/the-geographer" target="_blank">GitHub</A>
        {/* <A href="/profile">My profile</A> */}
        <A href="/legal">Legal</A>
      </footer>
    </>
  )
}