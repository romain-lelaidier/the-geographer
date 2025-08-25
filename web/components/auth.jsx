import { createEffect, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { is2xx } from "./utils";
import { parseParams } from "../data/utils";

const [ token, setToken ] = createSignal(localStorage.getItem("token"));
createEffect(() => {
  localStorage.setItem("token", token());
})

export const [ u, setU ] = createStore({
  connected: false,
  name: null,
  email: null,
  params: {},
});

export const uLogOut = async () => {
  setToken(null);
  setU("name", null);
  setU("email", null);
  setU("params", {});
  setU("connected", false);
}

export async function post(url, json) {
  const params = {
    method: 'POST',
    body: JSON.stringify(json),
    headers: { "Content-type": "application/json" },
  }
  if (token() != 'null') params.headers.authorization = token();
  return await fetch(url, params);
}

async function logFromRes(res) {
  if (!is2xx(res)) {
    uLogOut();
    throw await res.text();
  }
  const json = await res.json();
  if ('token' in json) {
    setToken(json.token);
    setU("name", json.name);
    setU("email", json.email);
    setU("params", json.params);
    setU("connected", true);
  } else {
    uLogOut();
    throw await res.text();
  }
}

export const uTryLog = async (username, password) => {

  if (u.connected) return true;

  if (username && password) {
    const res = await post('/api/um/login', { username, password });
    await logFromRes(res);
    return true;
  } else if (token()) {
    // try to relog (probably restarting a session)
    const res = await post('/api/um/relog');
    await logFromRes(res);
    return true;
  }

  return false;

}

export const uTrySignup = async (username, email, password) => {
  const res = await post('/api/um/signup', { username, email, password });
  if (!is2xx(res)) {
    throw await res.text();
  }
}

export const uVerify = async (token) => {
  const res = await post('/api/um/verify', { token });
  if (!is2xx(res)) {
    throw await res.text();
  }
  await logFromRes(res);
}

export const uSaveParams = async (params) => {
  const res = await post('/api/um/changeparams', { params });
  if (!is2xx(res)) {
    throw await res.text();
  }
  setU("params", await res.json())
}

export const uSaveGame = async (type, time, accuracy) => {
  const res = await post('/api/um/savegame', { type, time, accuracy });
  if (!is2xx(res)) {
    throw await res.text();
  }
  return await res.json();
}

export const getGameHighest = async (type) => {
  const res = await fetch('/api/um/gethighest/' + type);
  if (!is2xx(res)) {
    throw await res.text();
  }
  return await res.json();
}

export const getGameLeaderboards = async (type) => {
  const res = await fetch('/api/um/leaderboards/' + type);
  if (!is2xx(res)) {
    throw await res.text();
  }
  return await res.json();
}

export const getStats = async (uname) => {
  // await uTryLog();
  // const res = await post('/api/um/stats', { type });
  const res = await fetch('/api/um/stats/' + uname);
  if (!is2xx(res)) {
    throw await res.text();
  }
  return await res.json();
}