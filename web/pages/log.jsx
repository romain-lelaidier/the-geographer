import { MetaProvider, Title } from "@solidjs/meta";
import { createSignal, Show } from "solid-js";
import { u, uSaveParams, uTryLog, uTrySignup, uVerify } from "../api/auth"
import { BackButton, LinkButton } from "../components/utils";
import { A, useNavigate, useParams } from "@solidjs/router";
import { Layout } from "../components/layout";
import { Icon } from "../components/icons";
import { FlagSelector } from "../components/flag";

function Field(props) {
  return (
    <div class="block relative">
      <input
        type={props.type} placeholder=" " value={props.sig[0]()} onInput={(e) => props.sig[1](e.target.value)}
        class="w-full border rounded-md px-3 py-2 text-xl outline-none focus:[&+span]:-top-[0.75em] focus:[&+span]:text-sm not-placeholder-shown:[&+span]:-top-[0.75em] not-placeholder-shown:[&+span]:text-sm"/>
      <span class="bg-white block absolute top-2 left-2 px-1 transition-all duration-300 ease text-xl pointer-events-none">{props.title}</span>
    </div>
  )
}

function Wrapper(props) {
  return (
    <Layout floating={true}>

      <MetaProvider>
        <Title>The Geographer - {props.title}</Title>
      </MetaProvider>

      <div class="flex flex-col gap-3 px-3">
        <div>
          <BackButton/>
          <h2 class="text-2xl font-bold">{props.title}</h2>
        </div>
        {props.children}
      </div>

    </Layout>
  );
}

export function Login(props) {

  const navigate = useNavigate();

  const [ uname, setUname ] = createSignal('');
  const [ upassword, setUpassword ] = createSignal('');
  const [ error, setError ] = createSignal(null);

  const onsubmit = async (e) => {
    e.preventDefault();
    if (uname().length == 0) return setError("Username is empty");
    if (upassword().length == 0) return setError("Password is empty");
    uTryLog(uname(), upassword()).then(logged => {
      if (logged) navigate('/');
    }).catch(setError)
  }

  return (
    <Wrapper title="Log in">
      <form onSubmit={onsubmit} class="flex-grow flex flex-col gap-3">
        <Field type="text" title="username or email" sig={[uname, setUname]}/>
        <Field type="password" title="password" sig={[upassword, setUpassword]}/>
        <input type="submit" value="Log in" class="block w-full bg-b text-white px-3 py-2 rounded-md text-xl font-bold"></input>
        <Show when={error()}><span class="text-red-700 px-3 italic">{error()}</span></Show>
      </form>
      <div>new here ? <LinkButton href="/signup">create an account</LinkButton></div>
    </Wrapper>
  );
}

export function Signup(props) {

  const navigate = useNavigate();

  const [ uname, setUname ] = createSignal('');
  const [ uemail, setUemail ] = createSignal('');
  const [ upassword, setUpassword ] = createSignal('');
  const [ uvpassword, setUvpassword ] = createSignal('');
  const [ error, setError ] = createSignal(null);

  const [ success, setSuccess ] = createSignal(false);

  uTryLog().then(logged => {
    if (logged) navigate('/');
  })

  const onsubmit = async (e) => {
    e.preventDefault();
    if (uname().length == 0) return setError("Username is empty");
    if (upassword().length == 0) return setError("Password is empty");
    if (uvpassword().length == 0) return setError("Verification password is empty");
    if (upassword() != uvpassword()) return setError("Passwords do not match")

    uTrySignup(uname(), uemail(), upassword()).then(() => {
      setSuccess(true)
    }).catch(setError);
  }

  return (
    <Wrapper title="Sign up">
      <Show when={success()}
        fallback={
          <>
          <form onSubmit={onsubmit} class="flex-grow flex flex-col gap-3">
            <Field type="text" title="username" sig={[uname, setUname]}/>
            <Field type="email" title="email" sig={[uemail, setUemail]}/>
            <Field type="password" title="password" sig={[upassword, setUpassword]}/>
            <Field type="password" title="verify password" sig={[uvpassword, setUvpassword]}/>
            <input type="submit" value="Sign up" class="block w-full bg-b text-white px-3 py-2 rounded-md text-xl font-bold"></input>
            <Show when={error()}><span class="text-red-700 px-3 italic">{error()}</span></Show>
          </form>
          <div>already registered ? <LinkButton href="/login">log in here</LinkButton></div>
          </>
        }
      >
        <div>A verification email was sent to your adress. Please verify your account before logging ! You may need to check your spam inbox.</div>
      </Show>
    </Wrapper>
  );
}

export function Verify(props) {
  const navigate = useNavigate();
  const params = useParams();
  const token = params.token;
  
  const [ error, setError ] = createSignal(null);

  uVerify(token).then(() => {
    navigate('/')
  }).catch(setError)

  return (
    <Wrapper title="Verify email">
      <Show when={error()}><span class="text-red-700 italic">{error()}</span></Show>
    </Wrapper>
  )
}

export function Settings(props) {
  const navigate = useNavigate();
  const [ error, setError ] = createSignal(null);

  const [ iso, setIso ] = createSignal(null);
  const [ lng, setLng ] = createSignal(null);
  const [ prj, setPrj ] = createSignal(null);

  uTryLog().then(() => {
    setIso(u.params.iso);
    setLng(u.params.lng);
    setPrj(u.params.prj);
  })

  function submit() {
    uSaveParams({ iso: iso(), lng: lng(), prj: prj() }).then(() => {
      navigate('/')
    }).catch(setError)
  }

  return (
    <Wrapper title="Account settings">
      <Show when={u.connected} fallback={<div><div>You are not connected.</div><div>Please <LinkButton href="/login">log in</LinkButton> or <LinkButton href="/signup">register</LinkButton>.</div></div>}>
        <div>
          <div class="text-sm">username</div>
          <div class="font-bold text-xl">{u.name}</div>
        </div>
        <div>
          <div class="text-sm">email</div>
          <div class="font-bold text-xl">{u.email}</div>
        </div>
        <div class="flex flex-row gap-4 items-center">
          <div class="text-xl">flag</div>
          <FlagSelector iso={iso()} setter={setIso}/>
        </div>
        <div class="text-2xl font-bold">Preferences</div>
        <div class="flex flex-row items-center gap-2">
          <div class="text-xl">language</div>
          <select name="l" value={lng()} onInput={(e) => { setLng(e.target.value) }} class="bg-b text-white rounded-sm py-1 px-2 text-xl">
            <option value="en">english</option>
            <option value="na">native (endonyms)</option>
            <option value="fr">français</option>
          </select>
        </div>
        <div class="flex flex-row items-center gap-2">
          <div class="text-xl">cartographic projection</div>
          <select name="l" value={prj()} onInput={(e) => { setPrj(e.target.value) }} class="bg-b text-white rounded-sm py-1 px-2 text-xl">
            <option value="nat">natural</option>
            <option value="mct">mercator</option>
            <option value="wgs">lon-lat</option>
            <option value="str">stereographic</option>
          </select>
        </div>
        <Show when={error()}><span class="text-red-700 italic">{error()}</span></Show>
        <input type="submit" value="Save" onClick={submit} class="block w-full bg-b text-white px-3 py-2 rounded-md text-xl font-bold"></input>
      </Show>
    </Wrapper>
  )
}