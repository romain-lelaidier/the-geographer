import { MetaProvider, Title } from "@solidjs/meta";
import { useNavigate } from '@solidjs/router';

import { u, uLogOut, uTryLog } from '../components/auth';
import { Layout } from '../components/layout';
import { AIcon, mds } from "../components/utils";
import { createSignal, Show } from "solid-js";
import { Flag } from "../components/flag";
import { GameSelector } from "../components/gameselector";

export default function App() {
  const navigate = useNavigate();

  const [ playblockState, setPlaylblockState ] = createSignal(false);

  const [ game, setGame ] = createSignal(null);

  function startGame() {
    navigate('/play/' + game());
  }

  return (
    <Layout center={true}>
      
      <MetaProvider>
        <Title>The Geographer</Title>
      </MetaProvider>

      <div class="flex flex-col items-center gap-8 text-xl text-center">
        <div class="flex flex-col items-center">
          <div class="text-7xl font-bold uppercase">the geographer</div>
          <div class="text-2xl">discover, explore, and learn about the world.</div>
        </div>

        <Show
          when={u.connected}
          fallback={<div class="flex gap-2"><AIcon href="login" type="right-to-bracket" text="log in"/> or <AIcon href="signup" type="paw" text="register"/></div>}
        >
          <div class="flex flex-col items-center">
            <div>logged as <span class="font-bold"><Flag iso={u.params.iso}/> <span>{u.name}</span></span></div>
            <div class="font-bold flex flex-row gap-2 [&>a]:text-white [&>a]:text-shadow">
              <AIcon href="settings" type="gear" text="settings"/>{mds}
              <AIcon href="user" type="dna" text="statistics"/>{mds}
              <AIcon href="/" type="moon" text="disconnect" onClick={uLogOut}/>
            </div>
          </div>
        </Show>

        <div style={`width: ${playblockState() ? 30 : 10}em`} class="max-w-full bg-white rounded-lg h-34 max-h-34 overflow-hidden flex flex-row items-center justify-center transition-all ease duration-300" onClick={() => setPlaylblockState(true)}>
          <Show when={playblockState() == true} fallback={<div class="flex flex-row gap"><AIcon href="" type="chess-knight" text="play"/></div>}>
            <div class="relative w-full overflow-hidden">
              <div class="text-left p-4 z-0">
                <GameSelector setter={setGame}/>
              </div>
              <div class="absolute right-0 top-0 h-full flex flex-row items-center ">
                {/* separator */}
                <div style={{width: '1px'}} class="h-28 bg-b"></div>
                {/* go button */}
                <div class="flex items-center justify-center w-34 h-full rounded-r-lg bg-white transition-all duration-300 z-2">
                  <span class="w-18 h-18 flex items-center justify-center rounded-full bg-b text-white text-xl font-bold transition-all duration-250 hover:rotate-360 hover:scale-110 hover:shadow-lg hover:text-2xl" onClick={startGame}>GO</span>
                </div>
              </div>
            </div>
          </Show>
        </div>

        <AIcon href="./leaderboards" type="ranking-star" text="leaderboards"/>

      </div>

    </Layout>
  );
}