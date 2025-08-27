import { A, useParams } from "@solidjs/router";
import { Layout } from "../components/layout";
import { createResource, createSignal, For, Show, createEffect } from "solid-js";
import { LinkIcon, BackButton } from "../components/utils";
import { Flag } from "../components/flag";
import { info } from "../api/info";
import { getStats } from "../api/utils";
import { regionName, getName, timeToString, difficultyName } from "../api/gameutils";
import { Icon } from "../components/icons";

function Rank(props) {
  return (
    <div class="flex flex-row justify-center">
      <div style={{background: { 1: "#ffc300", 2: "#ced4da", 3: "#b36a5e" }[props.rank] || 'none'}} class="w-6 h-6 rounded-full">
        <div class="-translate-y-[0.1em]">
          {props.rank}
        </div>
      </div>
    </div>
  )
}

export default function App(props) {
  const params = useParams();
  const uname = params.uname;

  const [ type, setType ] = createSignal(params.game);
  const [ data ] = createResource(uname, getStats);

  createEffect(() => {
    if (data()) {
      console.log(data())
    }
  })

  return (
    <Layout>
      <div class="flex flex-col gap-3">
        <div>
          <BackButton/>
          <div class="text-3xl">user <b class="inline flex flex-row gap-1 items-center"><Show when={!data.error && data()}><Flag iso={data().user.iso}/> </Show>{uname}</b></div>
        </div>

        {/* <GameSelector setter={setType} defaulttype={type()}/> */}

        <Show when={data.error}>
          <div class="font-bold text-red-500">
            {data.error.message}
          </div>
        </Show>

        <Show when={data.loading}>
          <div>Loading stats...</div>
        </Show>

        <Show when={!data.error && data()}>
          <table class="rounded-md text-lg overflow-hidden text-center">
            <tbody>
              <tr class="bg-b text-white uppercase font-bold">
                <td>region</td>
                <td>type</td>
                <td>rank</td>
                <td>games</td>
                <td>best time</td>
                <td>date</td>
                <td></td>
              </tr>
              <For each={Object.entries(data().games)}>{([ region, gamesR ], i) => 
                <For each={Object.entries(gamesR)}>{([ type, gamesT ], j) =>
                  <For each={Object.entries(gamesT)}>{([ difficulty, gamesD ], k) =>
                    <tr class={"bg-white/" + (i() % 2 == 1 ? "20" : "10")}>
                      <Show when={j() == 0 && k() == 0}>
                        <td class="font-bold" rowspan={(Object.keys(gamesR).map(type => Object.keys(gamesR[type]).length)).reduce((partialSum, a) => partialSum + a, 0)}>
                          <Flag iso={region}/>
                          <span> {regionName(region)}</span>
                        </td>
                      </Show>
                      <td>
                        <div class="flex flex-row justify-center gap-1 items-center">
                          <span class="font-bold">{getName(info[region].disp[type])}</span>
                          <Show when={difficulty != "x"}>
                            <Icon type="arrow-right" size={1}/>
                            <span>{difficultyName(type, difficulty)}</span>
                          </Show>
                        </div>
                      </td>
                      <td class="font-bold text-center"><Rank rank={gamesD.rank}/></td>
                      <td>{gamesD.ngames}</td>
                      <td>{timeToString(gamesD.time)}</td>
                      <td>{new Date(gamesD.date).toLocaleDateString()}</td>
                      <td>
                        <div class="flex flex-row justify-center items-center gap-2">
                          <LinkIcon href={"/play/" + type + difficulty + region} type="play"/>
                          <LinkIcon href={"/leaderboards/" + type + difficulty + region} type="ranking-star"/>
                        </div>
                      </td>
                    </tr>
                  }</For>
                }</For>
              }</For>
            </tbody>
          </table>
        </Show>
      </div>
    </Layout>
  )
}