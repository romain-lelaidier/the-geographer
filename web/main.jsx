import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { MetaProvider, Title } from "@solidjs/meta";

import Home from "./pages/index.jsx";
import Play from "./pages/play.jsx";
import Leaderboards from "./pages/leaderboards.jsx";
import User from "./pages/user.jsx";
import { Login, Signup, Verify, Settings } from "./pages/log.jsx";
import { Layout } from './components/layout';
import { AIcon } from "./components/utils.jsx";
import { uTryLog } from "./components/auth.jsx";

function Page404() {
  return (
    <Layout center={true}>
      <MetaProvider>
        <Title>404 - The Geographer</Title>
      </MetaProvider>

      <div class="uppercase">
        <AIcon href="/" type="arrow-left" size={1} text="The Geographer"/>
      </div>

      <div class="text-xl">
        404 - Not found
      </div>
    </Layout>
  );
}

uTryLog();

render(
  () => (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/verify/:token" component={Verify} />
      <Route path="/settings" component={Settings} />
      <Route path="/play/:game" component={Play} />
      <Route path="/leaderboards/:game" component={Leaderboards} />
      <Route path="/leaderboards" component={Leaderboards} />
      <Route path="/user" component={User} />
      {/* <Route path="/search" component={Home} />
      <Route path="/search/:query" component={Search} />
      <Route path="/artist/:id" component={Artist} />
      <Route path="/legal" component={Legal} />
      <Route path="/player/:id" component={Player} />
      <Route path="/profile" component={Profile} />
      <Route path="/playlist/:pid" component={Playlist} /> */}
      <Route path="*paramName" component={Page404} />
    </Router>
  ),
  document.getElementById("app")
);