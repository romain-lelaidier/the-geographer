import { A, useParams } from "@solidjs/router";
import { GameSelector } from "../components/gameselector";
import { Layout } from "../components/layout";
import { createResource, createSignal, For, Show } from "solid-js";
import { getGamePersonal, u } from "../components/auth";
import { accuracyToString, AIcon, timeToString } from "../components/utils";
import { Flag } from "../components/flag";
import { Icon } from "../components/icons";

export default function App(props) {
  const params = useParams();

  const [ type, setType ] = createSignal(params.game);
  const [ data ] = createResource(type, getGamePersonal);

  return (
    <Layout>
      <div class="flex flex-col gap-3">
        <div>
          <A href="/" class="uppercase flex flex-row gap-1 items-center"><Icon type="arrow-left" size={1}/><span class="pt-[0.8]">Home</span></A>
          <div class="font-bold text-3xl">Your stats</div>
        </div>

        <Show when={u.connected} 
          fallback={<div class="flex flex-row gap-1"><AIcon href="/login" type="right-to-bracket" text="Log in"/> or <AIcon href="/signup" type="paw" text="register"/> to save your results.</div>}>
          <GameSelector setter={setType} defaulttype={type()}/>

          <Show when={data.loading}>
            <div>Loading your stats...</div>
          </Show>

          <Show when={data()}>
            <table class="rounded-md text-lg overflow-hidden text-center">
              <tbody>
                <tr class="bg-b text-white uppercase font-bold">
                  <td></td>
                  <td>time</td>
                  <td>accuracy</td>
                  <td>date</td>
                </tr>
                <Show when={data().length > 0}
                  fallback={<tr class={"bg-white/" + (data().length % 2 == 0 ? 20 : 10)}>
                    <td class="text-base" colspan="4">
                      you haven't played this mode. <A class="font-bold" href={"/play/" + type()}>you can do it now !</A>
                    </td>
                  </tr>}
                >
                  <For each={data()}>{(entry, i) => 
                    <tr class={"[&>td]:px-1 bg-white/" + (i() % 2 == 0 ? 20 : 10)}>
                      <td>{i()+1}</td>
                      <td>{timeToString(entry.time)}</td>
                      <td>{accuracyToString(entry.accuracy)}</td>
                      <td>{new Date(entry.date).toLocaleDateString()}</td>
                    </tr>
                  }</For>
                  <tr class={"bg-white/" + (data().length % 2 == 0 ? 20 : 10)}>
                    <td class="text-base" colspan="4">
                      <A class="underline" href={"/play/" + type()}>beat your highscore !</A>
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </Show>
        </Show>
      </div>
    </Layout>
  )
}