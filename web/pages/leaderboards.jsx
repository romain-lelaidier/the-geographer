import { A, useParams } from "@solidjs/router";
import { GameSelector } from "../components/gameselector";
import { Layout } from "../components/layout";
import { createResource, createSignal, For, Show } from "solid-js";
import { getGameLeaderboards } from "../components/auth";
import { accuracyToString, timeToString, User } from "../components/utils";
import { Flag } from "../components/flag";
import { Icon } from "../components/icons";

export default function App(props) {
  const params = useParams();

  const [ type, setType ] = createSignal(params.game);
  const [ data ] = createResource(type, getGameLeaderboards);

  return (
    <Layout>
      <div class="flex flex-col gap-3">
        <div>
          <A href="/" class="uppercase flex flex-row gap-1 items-center"><Icon type="arrow-left" size={1}/><span class="pt-[0.8]">Home</span></A>
          <div class="font-bold text-3xl">Leaderboards</div>
        </div>
        <GameSelector setter={setType} defaulttype={type()}/>

        <Show when={data.loading}>
          <div>Loading leaderboard...</div>
        </Show>

        <Show when={data()}>
          <table class="rounded-md text-lg overflow-hidden text-center">
            <tbody>
              <tr class="bg-b text-white uppercase font-bold">
                <td></td>
                <td>player</td>
                <td>time</td>
                <td>accuracy</td>
                <td>date</td>
              </tr>
              <Show when={data().length > 0}
                fallback={<tr class={"bg-white/" + (data().length % 2 == 0 ? 20 : 10)}>
                  <td class="text-base" colspan="4">
                    no one has played this mode. <A class="font-bold" href={"/play/" + type()}>be the first to do it now !</A>
                  </td>
                </tr>}
              >
                <For each={data()}>{(entry, i) => 
                  <tr class={"[&>td]:px-1 bg-white/" + (i() % 2 == 0 ? 20 : 10)}>
                    <td>{i()+1}</td>
                    <td><User user={{iso: entry.iso, name: entry.uname}}/></td>
                    <td>{timeToString(entry.time)}</td>
                    <td>{accuracyToString(entry.accuracy)}</td>
                    <td>{new Date(entry.date).toLocaleDateString()}</td>
                  </tr>
                }</For>
                <tr class={"bg-white/" + (data().length % 2 == 0 ? 20 : 10)}>
                  <td class="text-base" colspan="5">
                    <A class="underline" href={"/play/" + type()}>beat the highscore yourself !</A>
                  </td>
                </tr>
              </Show>
            </tbody>
          </table>
        </Show>
      </div>
    </Layout>
  )
}