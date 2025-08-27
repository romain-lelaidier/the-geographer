import { A, useParams } from "@solidjs/router";
import { Layout } from "../components/layout";
import { info } from "../api/info";
import { Map } from "../components/map";
import { createStore } from "solid-js/store";
import { createEffect, createResource, createSignal, Match, Show, Switch } from "solid-js";
import { LinkIcon, LinkButton, BackButton } from "../components/utils";
import { Icon } from "../components/icons";
import { u, uSaveGame, uTryLog } from "../api/auth";
import { Flag } from "../components/flag";
import { getGameHighest } from "../api/utils";
import { accuracyToString, timeToString, getName, fetchData, parseParams, populationToString } from "../api/gameutils";

class Timer {
  constructor() {
    [ this.time, this.setTime ] = createSignal(0);
    this.reset();
  }

  update(autoloop = true) {
    const t = Date.now();
    if (autoloop) window.requestAnimationFrame(this.update.bind(this));
    if (!this.on) this.timestopped += t - this.lastupdate;
    this.setTime(t - this.timestopped);
    this.lastupdate = t;
  }

  start() {
    this.update(false);
    this.on = true;
  }

  stop() {
    this.update(false);
    this.on = false;
  }
  
  reset() {
    this.setTime(0);
    this.timestopped = Date.now();
    this.lastupdate = this.timestopped;
    this.on = false;
    this.update();
  }
}

function shuffle(array) {
  let currentIndex = array.length;
  while (currentIndex != 0) {
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}

function buildQueue(params, data) {
  const queue = [];

  // activate zones
  // init: all zones are off
  for (const zone of data.zones) zone.on = true;

  // choose zones depending on params
  if (params.region.length == 3) {
    // world or continents. depends on difficulty too.
    for (const zone of data.zones) {
      zone.on = false;
      zone.on |= params.difficulty == "h" && (params.region == "wor" || zone.info.rgs.includes(params.region))
      zone.on |= params.difficulty == "m" && data.difficulties[params.region][1].includes(zone.info.iso)
      zone.on |= "em".includes(params.difficulty) && data.difficulties[params.region][0].includes(zone.info.iso)
    }
  }

  // neighbors
  for (const zone of data.zones) if (zone.neighbor) zone.on = false;

  // activate cities
  // init: all cities are off
  for (const city of data.cities) city.on = false;

  // choose cities
  if (params.rtype == "c") {
    let done = 0;
    for (const city of data.cities) {
      if (data.zones[city.zid].on && (
          "bd".includes(params.type) && params.region.length == 3 && city.level == 1
        || "bd".includes(params.type) && params.region.length == 2 && params.difficulty == "x" && city.level != 0 && (city.level <= "bd".indexOf(params.type) + 2 || city.level <= "emh".indexOf(params.difficulty))
        || params.type == "e" && done < { e: 10, m: 30, h: 100 } [ params.difficulty ]
      )) {
        city.on = true;
        done++;
      }
    }
    for (const zone of data.zones) {
      zone.on &= data.cities.some(city => city.on && city.zid == zone.id)
    }
  }

  // fill queue
  if (params.rtype == "z") {
    for (const zone of data.zones) {
      if (zone.on) queue.push(zone.info.id)
    }
  } else if (params.rtype == "c") {
    for (const city of data.cities) {
      if (city.on) queue.push(city.id);
    }
  }

  shuffle(queue);
  return queue;
}

function ZoneOrCity(props) {
  return (
    <div class="h-full flex flex-col justify-center items-center">
      <div class="h-full max-h-11 flex flex-row gap-1 items-center">
        <Show when={props.zc.flag || (info[props.zc.iso] && info[props.zc.iso].flag)}>
          <img class="h-full max-h-9 inline rounded-sm" src={`data:image/webp;base64,${props.zc.flag || info[props.zc.iso].flag}`}></img>
        </Show>
        <span class="mx-1 lowercase font-bold">{getName(props.zc.name)}</span>
      </div>
      <Show when={props.detailed && props.zc.pop}>
        <div class="text-sm -mt-1">{populationToString(props.zc.pop)}</div>
      </Show>
    </div>
  )
}

function WorldRecord(props) {
  return (
    <div class="flex flex-row gap-1">
      <div>world record :</div>
      <div class="font-bold">{props.type == "time" ? timeToString(props.record.time) : accuracyToString(props.record.accuracy)}</div>
      <div>(by <span class="inline flex flex-row gap-2 items-center"><Flag iso={props.record.iso} h={0.9}/> <b> {props.record.uname}</b></span>)</div>
    </div>
  )
}

export default function App(props) {
  const params = parseParams(useParams().game);
  console.log(params);

  const [ data ] = createResource(params, fetchData);
  const timer = new Timer();
  var map;

  const [ g, setG ] = createStore({
    q: [],
    i: -1,
    get current() {
      if (this.i < 0 || this.i >= this.q.length) return null;
      if (params.rtype == "z") {
        return data().zones[this.q[this.i]].info;
      } else {
        return data().cities[this.q[this.i]]
      }
    },
    won: false,
    clicks: {
      good: 0,        // number of good clicks
      total: 0,       // total number of clicks
      latestwrong: 0  // number of errors for the last element to find (counter for help)
    },
  })
  
  // logger (for good and bad answers)
  var loggerTimeout = null;
  const [ logging, setLogging ] = createSignal(false);
  const [ logHTML, setLogHTML ] = createSignal(null);
  function log(html) {
    setLogHTML(html);
    setLogging(true);
    if (loggerTimeout) clearTimeout(loggerTimeout);
    loggerTimeout = setTimeout(() => {
      setLogging(false);
    }, 2000);
  }

  // win
  async function win() {
    if (g.won == true) return;
    timer.stop();
    const time = timer.time() || 1000 + Math.floor(Math.random() * 5000);
    const accuracy = Math.round(1000 * g.clicks.good / g.clicks.total) / 10 || Math.floor(Math.random() * 50 + 50);
    setG("time", time);
    setG("accuracy", accuracy);
    setG("won", true);

    await uTryLog();

    if (u.connected) {
      uSaveGame(params.urlp, time, accuracy).then(res => {
        setG("previousResults", res.previousResults);
        setG("highest", {
          all: {
            time: res.highestTime,
            accuracy: res.highestAccuracy
          },
          personal: {
            time: res.previousResults.sort((a, b) => a.time - b.time)[0],
            accuracy: res.previousResults.sort((a, b) => b.accuracy - a.accuracy)[0],
          }
        })
      })
    } else {
      getGameHighest(params.urlp).then(res => {
        setG("highest", {
          all: {
            time: res.highestTime,
            accuracy: res.highestAccuracy
          }
        })
      })
    }
  }

  function handleClick(rtype, id) {
    if (params.rtype != rtype) {
      // not the good type (ex. city instead of zone, zone instead of city)
      return;
    }

    // start timer on first click
    if (g.clicks.total == 0) timer.start();

    setG("clicks", "total", t => t + 1);

    if (id == g.q[g.i]) {

      // good answer

      // deactivate elements
      if (rtype == "z") {
        data().zones[id].on = false;
      } else if (rtype == "c") {
        data().cities[id].on = false;
        // if all of the cities in the zone have been deactivated, deactivate the zone
        const zone = data().zones[data().cities[id].zid];
        zone.on &= data().cities.some(city => city.on && city.zid == zone.id)
      }

      map.helpZoneId = -1;
      map.helpCityId = -1;
      map.flashcol = .5;

      setG("clicks", "good", g => g + 1)
      setG("clicks", "latestwrong", 0)
      log(<Icon type="circle-check" size={3}/>);
      
      setG("i", i => i + 1);
      if (g.i == g.q.length) win();

    } else {

      // bad answer

      setG("clicks", "latestwrong", lw => lw + 1);
      if (g.clicks.latestwrong > 2) {
        if      (params.rtype == "z") map.helpZoneId = g.q[g.i];
        else if (params.rtype == "c") map.helpCityId = g.q[g.i];
      }

      map.flashcol = -.5;
      map.shake(600);

      timer.timestopped -= 5000;

      log(<div class="flex flex-row gap-1 items-center pr-3">
        <Icon type="circle-xmark" size={3}/>
        <span>{getName({fr: 'Vous avez cliqué sur', en: 'You clicked on'})}</span>
        <div class="h-5">
          <ZoneOrCity zc={params.rtype == 'z' ? data().zones[id].info : data().cities[id]}/>
        </div>
      </div>);
    }
  }

  function handleHover(type, state, id) {}

  function startGame() {
    setG("won", false);
    setG("q", buildQueue(params, data()));
    setG("i", 0);
    setG("clicks", {
      good: 0,
      total: 0,
      latestwrong: 0,
    })
    timer.reset();
  }
  
  createEffect(() => {
    if (data()) {
      if (data().viewranges)   params.viewranges   = data().viewranges;
      if (data().regionlimits) params.regionlimits = data().regionlimits;

      const ctrs = { afr: [ 20, 0 ], asi: [ 100, 25 ], eur: [ 15, 60 ], noa: [ -70, 40 ], oce: [ 160, -20 ], soa: [ -60, -25 ] };
      const vrgs = { afr: 180, asi: 190, eur: 120, noa: 180, oce: 180, soa: 180 };
      if (params.region in ctrs) params.regioncenter = ctrs[params.region];
      if (params.region in vrgs) params.beginningviewrange = vrgs[params.region];

      map = new Map(data(), params, handleHover, handleClick, u.params.prj);

      startGame();
      // win();
    }
  })

  return (
    <Layout full={true}>
      <div class="flex flex-col flex-grow overflow-hidden relative">
        <canvas id="appcanvas" class="flex-grow w-full"></canvas>

        <div style={{top: logging() ? '0' : '-4em'}} class="transition-top duration-300 ease absolute top-0 left-0 w-full flex flex-row justify-center">
          <div class="mt-2 bg-white/50 h-11 rounded-full flex flex-row items-center">
            {logHTML()}
          </div>
        </div>

        {/* <div id="topleft">
          <div id="title"><a href="."><svg class="icon backarrow"></svg>the geographer</a></div>
          <div id="user"><a href="./login">log in</a> to save your stats</div>
          <div id="gamebtns">
            <div id="gamerestart">restart</div>
            <div id="gamechangemode">change</div>
          </div>
        </div> */}

        {/* <div id="language">
          <svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="15" />
            <path d="M1,16 h30"/>
            <path d="M4,7 C10,11 22,11 28,7"/>
            <path d="M4,25 C10,21 22,21 28,25"/>
            <path d="M16,1 C8,10 8,22 16,31"/>
            <path d="M16,1 C24,10 24,22 16,31"/>
          </svg>
          <div id="languagebuttons">
            <span id="language_en" value="na">na</span>
            <span id="language_en" value="en">en</span>
            <span id="language_fr" value="fr">fr</span>
          </div>
        </div> */}

        <div class="pointer-events-none absolute bottom-4 left-0 w-full flex flex-col gap-1 items-center [&>*]:pointer-events-auto">
          <Show when={g.current}>
            <div class="bg-white/50 rounded-md text-sm px-1">{timeToString(timer.time())}</div>
            <div class="p-1 bg-white/50 rounded-md text-2xl">
              <ZoneOrCity zc={g.current} detailed={true} />
            </div>
            <div class="relative overflow-hidden bg-white/50 rounded-lg h-3 w-128 flex flex-row items-center justify-center font-bold" style={{'font-size': '0.7em'}}>
              <div style={{width: `${100 * g.i / g.q.length}%`}} class="transition-width duration-250 ease absolute left-0 rounded-lg h-full bg-vermi z-0"></div>
              <div class="z-1">{g.i} / {g.q.length}</div>
            </div>
          </Show>
        </div>

        <div id="debuginfo" class="hidden absolute bottom-2 left-2 flex flex-col gap-2">
          <span id="fps" class="bg-white/30 px-2 rounded-sm"></span>
          <span id="mousecoords" class="bg-white/30 px-2 rounded-sm"></span>
        </div>

        <Show when={g.won}>
          <div class="absolute w-full h-full bg-lblue/80 z-4 flex items-center justify-center">
            <div class="bg-lblue shadow-md p-2 rounded-md flex flex-col gap-1 min-w-98">
              <BackButton/>
              <div class="font-bold text-2xl">You won !</div>
                <div>
                  <div class="flex flex-row gap-1 text-xl">
                    <div>total time :</div>
                    <div class="font-bold">{timeToString(g.time)}</div>
                  </div>
                  <Show when={g.highest}>
                    <div class="bg-white/20 px-2 rounded-md">
                      <Switch fallback={
                        <>
                          <div class="flex flex-row gap-1">
                            <div>your personal record :</div>
                            <div class="font-bold">{timeToString(g.highest.personal.time.time)}</div>
                            <Show when={g.highest.all.time.uname == u.name}>(world record)</Show>
                          </div>
                          <Show when={g.highest.all.time.uname != u.name}>
                            <WorldRecord type="time" record={g.highest.all.time}/>
                          </Show>
                        </>
                      }>
                        <Match when={!g.highest.all.time || g.time < g.highest.all.time.time}>
                          <div class="text-red-500 font-bold">new world record !</div>
                        </Match>
                        <Match when={!g.highest.personal}>
                          <WorldRecord type="time" record={g.highest.all.time}/>
                        </Match>
                        <Match when={!g.highest.personal.time || g.time < g.highest.personal.time.time}>
                          <div class="text-red-500 font-bold">new personal record !</div>
                          <WorldRecord type="time" record={g.highest.all.time}/>
                        </Match>
                      </Switch>
                    </div>
                  </Show>
                </div>
                <div>
                  <div class="flex flex-row gap-1 text-xl">
                    <div>accuracy :</div>
                    <div class="font-bold">{accuracyToString(g.accuracy)}</div>
                  </div>
                  <Show when={g.highest}>
                    <div class="bg-white/20 px-2 rounded-md">
                      <Switch fallback={
                        <>
                          <div class="flex flex-row gap-1">
                            <div>your personal record :</div>
                            <div class="font-bold">{accuracyToString(g.highest.personal.accuracy.accuracy)}</div>
                            <Show when={g.highest.all.accuracy.uname == u.name}>(world record)</Show>
                          </div>
                          <Show when={g.highest.all.accuracy.uname != u.name}>
                            <WorldRecord type="accuracy" record={g.highest.all.accuracy}/>
                          </Show>
                        </>
                      }>
                        <Match when={!g.highest.all.accuracy || g.accuracy > g.highest.all.accuracy.accuracy}>
                          <div class="text-red-500 font-bold">new world record !</div>
                        </Match>
                        <Match when={!g.highest.personal}>
                          <WorldRecord type="accuracy" record={g.highest.all.accuracy}/>
                        </Match>
                        <Match when={!g.highest.personal.accuracy || g.accuracy > g.highest.personal.accuracy.accuracy}>
                          <div class="text-red-500 font-bold">new personal record !</div>
                          <WorldRecord type="accuracy" record={g.highest.all.accuracy}/>
                        </Match>
                      </Switch>
                    </div>
                  </Show>
              </div>
              <Show when={!u.connected}>
                <div class="flex flex-row gap-1"><LinkIcon href="/login" type="right-to-bracket" text="Log in"/> or <LinkIcon href="/signup" type="paw" text="register"/> to save your results.</div>
              </Show>
              <div>
                View the leaderboards <LinkButton href={"/leaderboards/" + params.urlp}/>.
              </div>
              <div>
                <div class="px-2 py-1 bg-b rounded-sm text-white text-center font-bold cursor-pointer" onClick={() => startGame()}>Play again</div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </Layout>
  )
}