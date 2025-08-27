import { post } from "./auth";

export function is2xx(res) {
  return Math.floor(res.status / 100) == 2;
}

function buildRequest(method, responseType, getUrl, getData) {
  return (async (params) => {
    const res = method == 'GET'
      ? await fetch(getUrl(params))
      : await post(getUrl(params), getData(params));
    if (!is2xx(res)) {
      throw await res.text();
    }
    return responseType == 'json'
      ? await res.json()
      : await res.text();
  })
}

export const getGameHighest = buildRequest('GET', 'json', type => '/api/um/gethighest/' + type);
export const getGameLeaderboards = buildRequest('GET', 'json', type => '/api/um/leaderboards/' + type);
export const getStats = buildRequest('GET', 'json', uname => '/api/um/stats/' + uname);
export const getAllPlayers = buildRequest('GET', 'json', () => '/api/um/allplayers');
