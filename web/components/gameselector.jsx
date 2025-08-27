import { createEffect, createSignal, For } from "solid-js";
import { info } from "../api/info";
import { FlagSelector } from "./flag";
import { difficultyName, getName, parseParams, regionName } from "../api/gameutils";

export function GameSelector(props) {

  // selecting categories: iterating through
  //  iso -> level -> type -> difficulty
  // and checking if category is in the chosen (restricted)
  let categories = [];
  for (const iso of Object.keys(info)) {
    if (info[iso].level < 2 && "disp" in info[iso]) {
      for (const type of Object.keys(info[iso].disp)) {

        const difficulties = type == "e"
          ? "emh"
          : (iso.length == 3 ? "emoh" : "x");

        for (const difficulty of difficulties) {
          const str = type + difficulty + iso;
          if (!props.restricted_categories || props.restricted_categories.includes(str)) {
            categories.push({
              iso, type, difficulty,
              level: info[iso].level
            });
          }
        }

      }
    }
  }

  if (categories.length == 0) return false;

  const categoryTree = {};
  for (const category of categories) {
    if (!(category.iso in categoryTree)) categoryTree[category.iso] = {};
    if (!(category.type in categoryTree[category.iso])) categoryTree[category.iso][category.type] = [];
    categoryTree[category.iso][category.type].push(category.difficulty);
  }

  // sorting categories by region size (world, continent, country)
  categories = categories.sort((a, b) => a.iso == "wor" ? -1 : (a.level > b.level ? 1 : (a.level < b.level ? -1 : a.iso > b.iso)))

  const isoList = [];
  for (const category of categories) {
    if (!isoList.includes(category.iso)) isoList.push(category.iso);
  }

  const [ region, setRegion ] = createSignal('');
  const [ type, setType ] = createSignal('');
  const [ difficulty, setDifficulty ] = createSignal('');

  if (props.defaulttype) {
    const params = parseParams(props.defaulttype);
    setRegion(params.region);
    setType(params.type);
    setDifficulty(params.difficulty);
  } else {
    setRegion(isoList[0]);
  }

  createEffect(() => {
    if (!categoryTree[region()][type()]) {
      setType(Object.keys(categoryTree[region()])[0]);
    }
    if (!categoryTree[region()][type()].includes(difficulty())) {
      var diffs = categoryTree[region()][type()]
      setDifficulty(diffs.includes('h') ? 'h' : diffs[0]);
    }
    props.setter(type() + difficulty() + region());
  })

  return (
    <div class="text-xl font-bold flex flex-col gap-1">
      <div class="flex flex-row gap-2 items-center">
        <span>region</span>
        <FlagSelector iso={region()} setter={setRegion} isos={isoList} title="Select a region">
          <div class="flex flex-row gap-2 bg-b p-1 rounded-sm items-center cursor-pointer">
            <img class="h-6 inline rounded-sm" src={`data:image/webp;base64,${info[region()].flag}`}></img>
            <span class="text-white pr-1 -my-1">{regionName(region())}</span>
          </div>
        </FlagSelector>
      </div>
      <div class="flex flex-row gap-2 items-center">
        <span>type</span>
        <select class="bg-b h-8 text-white px-2 rounded-sm cursor-pointer" value={type()} onInput={(e) => { setType(e.target.value) }}>
          <For each={Object.keys(categoryTree[region()])}>{(t, i) =>
            <option value={t}>{getName(info[region()].disp[t])}</option>
          }</For>
        </select>
      </div>
      <Show when={region() && type() && categoryTree[region()][type()] != null && categoryTree[region()][type()][0] != "x"}>
        <div class="flex flex-row gap-2 items-center">
          <span>difficulty</span>
            <select class="bg-b h-8 text-white px-2 rounded-sm cursor-pointer" value={difficulty()} onInput={(e) => { setDifficulty(e.target.value) }}>
              <For each={categoryTree[region()][type()]}>{(d, i) =>
                <option value={d}>{difficultyName(type(), d)}</option>
              }</For>
            </select>
        </div>
      </Show>
    </div>
  )
}