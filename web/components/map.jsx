////////////////////
///// GEOMETRY /////
////////////////////
const isInBounds = (coord, bnd) => bnd[0] < coord[0] && bnd[2] > coord[0] && bnd[1] < coord[1] && bnd[3] > coord[1];
const onSegment = (p, q, r) => q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) && q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1])
const ori = (p, q, r) => {
  const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  return val > 0 ? 1 : (val == 0 ? 0 : 2);
}
const intersects = (p1, q1, p2, q2) => {
  const o1 = ori(p1, q1, p2);
  const o2 = ori(p1, q1, q2);
  const o3 = ori(p2, q2, p1);
  const o4 = ori(p2, q2, q1);
  return o1 != o2 && o3 != o4               // general case
    || o1 == 0 && onSegment(p1, p2, q1)     // p1, q1 and p2 are collinear and p2 lies on segment p1q1
    || o2 == 0 && onSegment(p1, q2, q1)     // p1, q1 and p2 are collinear and q2 lies on segment p1q1
    || o3 == 0 && onSegment(p2, p1, q2)     // p2, q2 and p1 are collinear and p1 lies on segment p2q2
    || o4 == 0 && onSegment(p2, q1, q2)     // p2, q2 and q1 are collinear and q1 lies on segment p2q2
}
const isInside = (coord, plg) => {
  const extreme = [ 1000000, coord[1] ];
  let count = 0, i = 0;
  do {
    const next = (i+1) % plg.length;
    if (intersects(plg[i], plg[next], coord, extreme)) {
      if (ori(plg[i], coord, plg[next]) == 0) return onSegment(plg[i], coord, plg[next]);
      count++;
    }
    i = next;
  } while (i != 0);
  return count % 2 == 1;
}

/**
 * converts hex to rgb (values between 0 and 1)
 * @param {string} hex 
 * @returns {array[3]}
 */
const hextorgb = hex => {
  const hexa = "0123456789abcdef";
  if (hex.includes("#")) hex = hex.substring(hex.indexOf("#") + 1);
  hex = hex.toLowerCase();
  const hti = h => hexa.indexOf(h[0]) * 16 + hexa.indexOf(h[1]);
  return [
    hti(hex.substring(0, 2)),
    hti(hex.substring(2, 4)),
    hti(hex.substring(4, 6))
  ].map(a => a / 256);
}

/**
 * mix colors ca and cb with percentage p (between 0: ca and 1: cb)
 * @param {array[3]} ca 
 * @param {array[3]} cb 
 * @param {number} p 
 * @returns {array[3]}
 */
const mixcol = (ca, cb, p) => {
  let cc = [];
  for (const i in ca) cc[i] = ca[i] * (1 - p) + cb[i] * p;
  return cc;
}

/**
 * make sure x is between -180 and 180
 * @param {number} x 
 * @returns {number}
 */
const modx = x => ((n, m) => ((n % m) + m) % m) (x + 180, 360) - 180;

class Transition {
  constructor(frames, init) {
    this.from = init;
    this.to = init;
    this.frames = frames;
    this.frame = 0;
    this.update();
  }

  update() {
    // returns true if there is a change
    if (this.frame == this.frames) return false;
    if (this.from == this.to) {
        this.value = this.from;
        return false;
    }
    this.value = this.from + Math.sin(this.frame / this.frames * Math.PI / 2) * (this.to - this.from);
    this.frame = Math.min(this.frames, this.frame + 1);
    return true;
  }

  newTo(nto) {
    this.frame = 0;
    // this.from = this.value;
    this.from = this.to;
    this.to = nto;
  }

  restartTo(nto) {
    this.frame = 0;
    this.value = this.from;
    this.to = nto;
  }

  restartFrom(nfrom) {
    this.frame = 0;
    this.from = nfrom;
    this.to = nfrom;
    this.value = this.from;
  }
}

class Program {
  constructor(gl, vertexsource, fragmentsource) {
    this.u = {}; // uniforms
    this.a = {}; // attribs
    // shaders
    this.vshader = this.load_shader(gl, gl.VERTEX_SHADER, vertexsource);
    this.fshader = this.load_shader(gl, gl.FRAGMENT_SHADER, fragmentsource);
    // program
    this.program = gl.createProgram();
    gl.attachShader(this.program, this.vshader);
    gl.attachShader(this.program, this.fshader);
    // linking
    gl.linkProgram(this.program);
    if (gl.getProgramParameter(this.program, gl.LINK_STATUS)) return;
    console.log(gl.getProgramInfoLog(this.program));
    gl.deleteShader(this.program);
  }

  load_shader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
  }

  uniformlocations(gl, l) {
    for (const u of l) this.u[u] = gl.getUniformLocation(this.program, u)
  }

  attriblocations(gl, l) {
    for (const a of l) this.a[a] = gl.getAttribLocation(this.program, a)
  }

  use(gl) {
    gl.useProgram(this.program);
  }
}

///////////////////
///// SHADERS /////
///////////////////
const shdsrc_countries = [
  `#version 300 es

  uniform float uratio;
  uniform float uviewrange;
  uniform float uxoffset;
  uniform vec2  ucenterpoint;
  uniform float ucrad;

  in vec2 acoord;

  void main() {
      vec2 ccoord = vec2(
          (acoord.x - ucenterpoint.x + uxoffset * 360.0),
          (acoord.y - ucenterpoint.y) * uratio
      ) * 2.0 / uviewrange;

      gl_Position = vec4(ccoord, 0, 1);
      gl_PointSize = ucrad * 180.0 / uviewrange;
  }`,

  `#version 300 es
  precision highp float;
  
  uniform vec3 ucol;
  uniform float uopacity;
  uniform vec4 uisland;

  out vec4 color;

  void main() {
      color = vec4(ucol, uopacity);
  }`
]

const shdsrc_circles = [
  `#version 300 es

  uniform float curatio;
  uniform float cuviewrange;
  uniform float cuxoffset;
  uniform vec2  cucenterpoint;

  in vec2 cacoord;
  out vec2 careal;

  void main() {
      vec2 ccoord = vec2(
          (cacoord.x - cucenterpoint.x + cuxoffset * 360.0),
          (cacoord.y - cucenterpoint.y) * curatio
      ) * 2.0 / cuviewrange;

      careal = cacoord;
      gl_Position = vec4(ccoord, 0, 1);
  }`,

  `#version 300 es
  precision highp float;
  
  uniform vec3  cucol;
  uniform float cuopacity;
  uniform vec2  cucenter;
  uniform float cucrad;
  uniform uint  cucity;

  in vec2 careal;
  out vec4 color;

  void main() {
      color = vec4(1);
      vec2 d = careal - cucenter;
      float r = sqrt(dot(d, d)) / cucrad;

      if (r > 1.0) discard;
      
      if (cucity == uint(1)) color = vec4(cucol, cuopacity * (1.0 - pow(r, 20.0)));
      else color = vec4(cucol, cuopacity);
  }`
]

export class Map {
  /**
   * creates the application
   * @param {object} data 
   * @param {object} game 
   * @param {function} onhover 
   * @param {function} onclick 
   */
  constructor(data, game, onhover, onclick) {
	  this.data = data;
    this.canvas = document.getElementById("appcanvas");

    this.onclick = onclick;
    this.onhover = onhover;
    this.game = game;

    this.lasttime = Date.now();
    this.lastsecond = Math.floor(this.lasttime / 1000);

    this.moletteiterations = 6;
    this.molette = new Transition(8, this.moletteiterations / 2);
    this.lastmousepos = [ 0, 0 ];
    this.lastmousemov = [ 0, 0 ];
    this.mousepos     = [ -1, -1 ];
    this.mouseinerty  = [ 0, 0 ];

    this.centerpoint = game.regioncenter 
      ? game.regioncenter 
      : (game.regionlimits 
        ? [ (game.regionlimits[0] + game.regionlimits[2]) / 2, (game.regionlimits[1] + game.regionlimits[3]) / 2 ] 
        : [ 0, 0 ]);

    this.iszooming = false;
    this.ismoving = false;
    this.zoominglockcoords = [ 0, 0 ];
    this.flashcol = 0;
    this.shaketimer = 0;

    this.irad = 2.5;
    this.frad = 1.5;
    this.hoverframes = 12;
    this.hoveredZones =  { current: [ -1, 0 ], previous: [] };
    this.hoveredCities = { current: [ -1, 0 ], previous: [] };
    this.helpZoneId = -1;
    this.helpCityId = -1;

    this.grid_divisions = [ 18, 9 ];

    // colors
    this.colors = {};
    const stl = getComputedStyle(document.documentElement)
    for (const prop of [ "white", "lblue", "dblue", "black", "vermi" ])
      this.colors[prop] = hextorgb(stl.getPropertyValue("--color-" + prop));
    // this.colors = { sea: hextorgb("#11728C"),                                  zone: hextorgb("#C3D19D"), hovering: hextorgb("#ffffff"), border: hextorgb("#ffffff") }

    for (const zone of this.data.zones) {
      zone.color = mixcol(this.colors.black, new Array(3).fill(Math.random()), Math.random() / 3.5);
      let needsline = game.region.length == 3;
      for (const plg of zone.geometry) needsline = needsline && plg.area < 0.3;
      for (const plg of zone.geometry) plg.needsline = needsline;
      // totalarea < (this.game.minareaforborder || 0.09)
    }

    // console.log(this.data)

    // debug infos
    this.fps = [];
    this.efps = document.getElementById("fps");
    this.emousecoords = document.getElementById("mousecoords");

    // events
    window.addEventListener("resize", () =>    this.resize())
    this.canvas.addEventListener("mousewheel", e => this.zoom(e.deltaY));
    this.canvas.addEventListener("DOMMouseScroll", e => this.zoom(e.detail * 20));
    this.canvas.addEventListener("mousedown", e  => this.mousedown(e));
    this.canvas.addEventListener("mouseup", e =>    this.mouseup(e));
    this.canvas.addEventListener("mousemove", e =>  this.mousemove(e));

    this.resize();
    this.calcviewrange();
    if ("beginningviewrange" in game) this.molette.from = this.molette.to = this.molette.value
      = Math.sqrt((game.beginningviewrange - game.viewranges[0]) * Math.pow(this.moletteiterations, 2) / (game.viewranges[1] - game.viewranges[0])) - this.moletteiterations / 2

    this.init_gl();
    this.createGridVBOs();
    this.createGeometryVBO();
    this.createIslandsVBO();
    this.createCitiesVBO();

    this.update();
  }

  init_gl() {
    // initiate webgl
    this.gl = this.canvas.getContext("webgl2");
    if (!this.gl) {
      alert("oups, webgl2 is not supported...");
      window.location.href = "./";
      return;
    }

    // countries
    this.pco = new Program(this.gl, ...shdsrc_countries);
    this.pco.uniformlocations(this.gl, [ "ucol", "ucrad", "uratio", "uopacity", "uxoffset", "uviewrange", "ucenterpoint" ])
    this.pco.attriblocations(this.gl, [ "acoord" ])

    // circles
    this.pci = new Program(this.gl, ...shdsrc_circles);
    this.pci.uniformlocations(this.gl, [ "cucol", "cucrad", "curatio", "cucenter", "cuopacity", "cuxoffset", "cuviewrange", "cucenterpoint", "cucity" ]);
    this.pci.attriblocations(this.gl, [ "cacoord" ]);

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
  }

  createGridVBOs() {
    const grid_verticesx = [];
    for (let i = 0; i <= this.grid_divisions[0]; i++) {
      const x = i * 360 / this.grid_divisions[0] - 180
      grid_verticesx.push(x, 100000, x, -100000)
    }

    const grid_verticesy = [];
    for (let i = 0; i <= this.grid_divisions[1]; i++) {
      const y = Math.asin((i * 180 / this.grid_divisions[1] - 90) / 90) * 90;
      grid_verticesy.push(-100000, y, 100000, y)
    }

    this.grid_vbox = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.grid_vbox);
    const gvaox = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, gvaox);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(grid_verticesx), this.gl.STATIC_DRAW);
    this.gl.vertexAttribPointer(this.pco.a.acoord, 2, this.gl.FLOAT, false, 8, 0);
    this.gl.enableVertexAttribArray(this.pco.a.acoord);

    this.grid_vboy = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.grid_vboy);
    const gvaoy = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, gvaoy);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(grid_verticesy), this.gl.STATIC_DRAW);
    this.gl.vertexAttribPointer(this.pco.a.acoord, 2, this.gl.FLOAT, false, 8, 0);
    this.gl.enableVertexAttribArray(this.pco.a.acoord);
  }

  createGeometryVBO() {
    let vertices = new Float32Array((this.data.zvcount + this.data.lvcount) * 2);
    let indices = new Uint16Array(this.data.zicount + this.data.licount);
    let vi = 0, ii = 0;

    for (const lake of this.data.lakes) {
      for (const c of lake.plg) {
        vertices[vi++] = c[0];
        vertices[vi++] = c[1];
      }
      for (const index of lake.indices) {
        indices[ii++] = index;
	    }
    }
	
    for (const zone of this.data.zones) {
      for (const geometry of zone.geometry) {
        for (const c of geometry.plg) {
          vertices[vi++] = c[0];
          vertices[vi++] = c[1];
        }
        for (const index of geometry.indices) {
          indices[ii++] = index;
		    }
      }
    }

    this.countries_vbo = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.countries_vbo);
    const vao = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vao);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    const ebo = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ebo);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);
    this.gl.vertexAttribPointer(this.pco.a.acoord, 2, this.gl.FLOAT, false, 4 * 2, 0);
    this.gl.enableVertexAttribArray(this.pco.a.acoord);
  }

  createCitiesVBO() {
    const dr = 8; // default radius
    let vertices = [];
    let id = 0;
    const addpoint = p => {
      vertices.push(
        p[0] - dr, p[1] - dr,
        p[0] + dr, p[1] - dr,
        p[0] + dr, p[1] + dr,
        p[0] - dr, p[1] - dr,
        p[0] + dr, p[1] + dr,
        p[0] - dr, p[1] + dr
      )
    }

    for (const city of this.data.cities) {
      city.on = false;
      city.id = id++;
      city.crad = 2 + Math.pow(city.pop, 1/4) / 10;
      //if (!city.pop) { city.crad = 5; };
      if (this.game.region.length == 3) city.crad /= 4;
      if (this.data.craddividor) city.crad /= this.data.craddividor;
      addpoint(city.coords);
    }

    this.points_vbo = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.points_vbo);
    this.points_vao = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.points_vao);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
    this.gl.enableVertexAttribArray(this.pci.a.cacoord);
    this.gl.vertexAttribPointer(this.pci.a.cacoord, 2, this.gl.FLOAT, false, 4 * 2, 0);
  }

  createIslandsVBO() {
    const dr = 8; // default radius
    let vertices = [];
    const addpoint = p => {
      vertices.push(
        p[0] - dr, p[1] - dr,
        p[0] + dr, p[1] - dr,
        p[0] + dr, p[1] + dr,
        p[0] - dr, p[1] - dr,
        p[0] + dr, p[1] + dr,
        p[0] - dr, p[1] + dr
      )
    }

    for (const zone of this.data.zones) if (zone.forced) {
      zone.pointstart = vertices.length / 12;
      addpoint(zone.center);
    }
    for (const zone of this.data.zones) if ("islands" in zone) {
      zone.pointstart = vertices.length / 12;
      for (const island of zone.islands) addpoint(island)
    }

    this.islands_vbo = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.islands_vbo);
    this.islands_vao = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.islands_vao);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
    this.gl.enableVertexAttribArray(this.pci.a.cacoord);
    this.gl.vertexAttribPointer(this.pci.a.cacoord, 2, this.gl.FLOAT, false, 4 * 2, 0);
  }

  calcviewrange() {
    this.viewrange = Math.pow(this.molette.value / this.moletteiterations + 0.5, 2) * (this.game.viewranges[1] - this.game.viewranges[0]) + this.game.viewranges[0]; // width
    // viewrange height is viewrange / width * height
    if (this.viewrange * this.height / this.width > Math.PI * 85) this.viewrange = Math.PI * 85 * this.width / this.height
  }

  beginviewrange(vr) {
    this.molette.restartFrom((Math.sqrt((vr - this.game.viewranges[0]) / (this.game.viewranges[1] - this.game.viewranges[0])) - 0.5) * this.moletteiterations);
  }

  begincenterpoint(cp) {
    this.centerpoint = cp;
    this.updateMovement();
  }

  recenter() {
    // x  
    if (this.game.regionlimits[2] - this.viewrange / 2 < this.game.regionlimits[0] + this.viewrange / 2) this.centerpoint[0] = (this.game.regionlimits[0] + this.game.regionlimits[2]) / 2;
    else this.centerpoint[0] = Math.min(this.game.regionlimits[2] - this.viewrange / 2, Math.max(this.game.regionlimits[0] + this.viewrange / 2, this.centerpoint[0]));
    
    // y
    const miny = Math.asin(this.game.regionlimits[1] / 90) * 90;
    const maxy = Math.asin(this.game.regionlimits[3] / 90) * 90;
    const vrh = this.viewrange / 2 * this.height / this.width;
    if (maxy - vrh < miny + vrh) this.centerpoint[1] = (miny + maxy) / 2;
    else this.centerpoint[1] = Math.min(maxy - vrh, Math.max(miny + vrh, this.centerpoint[1]));
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    if (this.mousepos[0] == -1 && this.mousepos[1] == -1) this.mousepos = [ this.width / 2, this.height / 2 ]
  }

  coordsToCanvas(c) {
    return [
      (modx(c[0] - this.centerpoint[0]) / this.viewrange + 0.5) * this.width,
      ((this.centerpoint[1] - c[1]) / this.viewrange + this.height / this.width * 0.5) * this.width,
    ]
  };

  canvasToCoord(c) {
    return [
      modx((c[0] / this.width - 0.5) * this.viewrange + this.centerpoint[0]),
      this.centerpoint[1] - (c[1] / this.width - this.height / this.width * 0.5) * this.viewrange
    ]
  }

  getZoneHoveringState(id) {
    if (id == this.hoveredZones.current[0]) return this.hoveredZones.current[1] / this.hoverframes;
    for (const hc of this.hoveredZones.previous) if (id == hc[0]) return hc[1] / this.hoverframes;
    return -1;
  }

  getCityHoveringState(id) {
    if (id == this.hoveredCities.current[0]) return this.hoveredCities.current[1] / this.hoverframes;
    for (const hc of this.hoveredCities.previous) if (id == hc[0]) return hc[1] / this.hoverframes;
    return -1;
  }

  drawAll() {
    const offset = this.shaketimer == 0 ? 0 : Math.asin(-this.shaketimer / this.shaketimeanim) * Math.sin(this.shaketimer / 30) * this.viewrange / 100;
    const cp = [ this.centerpoint[0] + offset, this.centerpoint[1] ];
    const minx = cp[0] - this.viewrange / 2;
    const miny = cp[1] - this.viewrange / 2 * this.height / this.width;
    const maxx = cp[0] + this.viewrange / 2;
    const maxy = cp[1] + this.viewrange / 2 * this.height / this.width;
    const isOnScreen = (bnd, xoffset = 0) => bnd[0] + xoffset * 360 < maxx && bnd[2] + xoffset * 360 > minx && bnd[1] < maxy && bnd[3] > miny;

    // draw twice cuz the earth is a cylinder
    const beginning = cp[0] - this.viewrange / 2 < -180 ? -1 : 0;
    const end = cp[0] + this.viewrange / 2 > 180 ? 2 : 1;

    this.gl.viewport(0, 0, this.width, this.height);
    this.gl.clearColor(...this.colors.lblue, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // basic uniforms
    this.pci.use(this.gl);
    this.gl.uniform1f(this.pci.u.curatio, this.width / this.height);
    this.gl.uniform1f(this.pci.u.cuviewrange, this.viewrange);
    this.gl.uniform2f(this.pci.u.cucenterpoint, cp[0], cp[1]);

    this.pco.use(this.gl);
    this.gl.uniform1f(this.pco.u.uratio, this.width / this.height);
    this.gl.uniform1f(this.pco.u.uviewrange, this.viewrange);
    this.gl.uniform2f(this.pco.u.ucenterpoint, cp[0], cp[1]);

    // drawing grid
    this.gl.uniform1f(this.pco.u.uopacity, 1);
    this.gl.uniform3f(this.pco.u.ucol, ...mixcol(this.colors.lblue, this.colors.black, 0.1));
    this.gl.bindVertexArray(this.grid_vbox);
    for (let a = beginning; a < end; a++) {
      this.gl.uniform1f(this.pco.u.uxoffset, a);
      this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.grid_divisions[0] * 2 + 1);
    }
    this.gl.bindVertexArray(this.grid_vboy);
    this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.grid_divisions[1] * 2 + 1);

    // islands: round shape above the sea and under the other countries
    if (!"bde".includes(this.game.type)) {
      this.pci.use(this.gl);
      this.gl.bindVertexArray(this.islands_vbo);
      this.gl.uniform1f(this.pci.u.cuopacity, 1);
      this.gl.uniform1ui(this.pci.u.cucity, 0);
      const di = id => {
        if (id == -1) return;
        const zone = this.data.zones[id];
        if (!("islands" in zone)) return;
        const hs = this.getZoneHoveringState(zone.info.id);
        if (hs != -1) {
          this.gl.uniform3f(this.pci.u.cucol, ...mixcol(this.colors.lblue, this.colors.white, 0.2 * hs))
          for (let i = 0; i < zone.islands.length; i++) {
            this.gl.uniform1f(this.pci.u.cucrad, this.irad * (0.5 + hs / 2) * (zone.islands[i].length == 3 ? zone.islands[i][2] : 1));
            this.gl.uniform2f(this.pci.u.cucenter, zone.islands[i][0], zone.islands[i][1]);
            this.gl.drawArrays(this.gl.TRIANGLES, (zone.pointstart + i) * 6, 6);
          }
        }
      }
      for (let a = beginning; a < end; a++) {
        this.gl.uniform1f(this.pci.u.cuxoffset, a);
        for (const c of this.hoveredZones.previous) di(c[0]);
        di(this.hoveredZones.current[0])
      }
    }

    // drawing countries
    this.pco.use(this.gl);
    this.gl.bindVertexArray(this.countries_vbo);
    const drawzone = zone => {
      let hs = this.getZoneHoveringState(zone.info.id);
      if (hs != -1 && this.hoveredZones.current[0] == zone.info.id) hs = 1;
      for (const geometry of zone.geometry) for (let a = beginning; a < end; a++) {
        if (isOnScreen(geometry.bnd, a)) {
          this.gl.uniform1f(this.pco.u.uxoffset, a);

          // inside
          this.gl.uniform1f(this.pco.u.uopacity, 1);
          let zonecol = hs == -1 || !zone.on ? zone.color : mixcol(zone.color, this.colors.vermi, Math.sin(Math.PI / 2 * hs) * ("acf".includes(this.game.type) ? 1 : 0.2));
          if (this.helpZoneId == zone.info.id) zonecol = mixcol(zonecol, [ 0, 1, 0 ], 0.3 + 0.3 * Math.sin(this.now / 200));
          this.gl.uniform3f(this.pco.u.ucol, ...mixcol(this.colors.lblue, zonecol, !zone.on || zone.neighbor ? 0.2 : 1));
          this.gl.drawElements(this.gl.TRIANGLES, geometry.indices.length, this.gl.UNSIGNED_SHORT, geometry.indexstart*2);

          // outline
          let color;
          if (geometry.needsline && zone.on) {
            this.gl.uniform1f(this.pco.u.uopacity, 1);
            color = hs != -1 ? mixcol(this.colors.black, this.colors.white, hs) : this.colors.black
          } else {
            this.gl.uniform1f(this.pco.u.uopacity, 0.1);
            color = hs == -1 || !zone.on ? this.colors.white : this.colors.vermi
          }

          this.gl.uniform3f(this.pco.u.ucol, ...(this.helpZoneId == zone.info.id ? mixcol(color, [ 0, 1, 0 ], 0.3 + 0.3 * Math.sin(this.now / 200)) : color))
          this.gl.drawArrays(this.gl.LINE_STRIP, geometry.vertexstart, geometry.plg.length);
        }
      }
    }
    for (const zone of this.data.zones) if (!zone.enclave && zone.hs != 1 && !zone.hovered) { drawzone(zone);  }
    for (const zone of this.data.zones) if (zone.hovered) drawzone(zone);
    for (const zone of this.data.zones) if ( zone.enclave && zone.hs != 1 && !zone.hovered) drawzone(zone);

    // lakes
    for (const lake of this.data.lakes) {
      for (let a = beginning; a < end; a++) {
        this.gl.uniform1f(this.pco.u.uxoffset, a);

        this.gl.uniform1f(this.pco.u.uopacity, 1);
        this.gl.uniform3f(this.pco.u.ucol, ...this.colors.lblue);
        this.gl.drawElements(this.gl.TRIANGLES, lake.indices.length, this.gl.UNSIGNED_SHORT, lake.indexstart * 2);

        this.gl.uniform1f(this.pco.u.uopacity, 0.1);
        this.gl.uniform3f(this.pco.u.ucol, ...this.colors.white)
        this.gl.drawArrays(this.gl.LINE_STRIP, lake.vertexstart, lake.plg.length);
      }
    }

    // forced countries: round shape above everything else
    this.pci.use(this.gl);
    this.gl.bindVertexArray(this.islands_vbo);
    this.gl.uniform1f(this.pci.u.cuopacity, 0.1);
    const df = id => {
      if (id == -1) return;
      const zone = this.data.zones[id];
      if (!(zone.forced)) return;
      const hs = this.getZoneHoveringState(zone.info.id);
      if (hs != -1) {
        this.gl.uniform3f(this.pci.u.cucol, ...mixcol(zone.color, this.colors.white, 0.5 * hs))
        this.gl.uniform1f(this.pci.u.cucrad, this.irad * (0.5 + hs / 2) * 0.6 * zone.forced);
        this.gl.uniform2f(this.pci.u.cucenter, zone.center[0], zone.center[1]);
        this.gl.drawArrays(this.gl.TRIANGLES, zone.pointstart * 6, 6);
      }
    }
    for (let a = beginning; a < end; a++) {
      this.gl.uniform1f(this.pci.u.cuxoffset, a);
      for (const c of this.hoveredZones.previous) df(c[0]);
      df(this.hoveredZones.current[0])
    }

    // cities
    // this.gl.uniform1ui(this.pci.u.cucity, 1);
    const scale = Math.pow(this.viewrange / 1000000, 0.7) * 150;
    if (this.game.mode == "e" || "bde".includes(this.game.type)) {
      this.gl.bindVertexArray(this.points_vbo);
      for (let a = beginning; a < end; a++) {
        this.gl.uniform1f(this.pci.u.cuxoffset, a);
        for (const city of this.data.cities) if (city.on) {
          const helpMultiplier = this.helpCityId == city.id ? 0.5 + 0.5 * Math.sin(this.now / 200) : 0;
          let hs = this.getCityHoveringState(city.id);
          const rad = city.crad * (hs == -1 ? 1 : 1 + 0.5 * Math.sin(Math.PI / 2 * hs)) * (1 + 0.7 * helpMultiplier);
          if (isOnScreen([ city.coords[0] - rad, city.coords[1] - rad, city.coords[0] + rad, city.coords[1] + rad ], a)) {
            if (hs == -1 && city.id == this.hoveredCities.current[0]) hs = 1;
            let citycol = hs == -1 || this.game.mode == "e" ? this.colors.white : mixcol(this.colors.white, this.colors.vermi, Math.sin(Math.PI / 2 * hs));
            if (helpMultiplier != 0) citycol = mixcol(citycol, [ 0, 1, 0 ], (0.5 + 0.5 * helpMultiplier));
            this.gl.uniform1f(this.pci.u.cuopacity, hs == -1 ? 0.5 : 0.5 * (1 + Math.sin(Math.PI / 2 * hs)));
            this.gl.uniform3f(this.pci.u.cucol, ...citycol);
            this.gl.uniform1f(this.pci.u.cucrad, rad * scale);
            this.gl.uniform2f(this.pci.u.cucenter, city.coords[0], city.coords[1])
            this.gl.drawArrays(this.gl.TRIANGLES, city.id * 6, 6);
          }
        }
      }
    }
    this.gl.uniform1ui(this.pci.u.cucity, 0);
  }

  findHoveredZone(coord) {

    if ("bde".includes(this.game.type) && this.hoveredCities.current[0] != -1) {
      for (const zone of this.data.zones) if (zone.info.id == this.data.cities[this.hoveredCities.current[0]].zid) return zone.info.id;
    }

    let distances = [];
    for (const zone of this.data.zones) if (zone.forced && zone.on && !zone.neighbor) {
      if (coord[0] > zone.center[0] - this.frad * zone.forced && coord[0] < zone.center[0] + this.frad * zone.forced) {
        const d = Math.hypot(coord[0] - zone.center[0], coord[1] - zone.center[1]);
        if (d < this.frad * zone.forced) distances.push([ zone.info.id, d ])
      }
    }
    distances.sort((a, b) => a[1] < b[1] ? -1 : 1);
    if (distances.length > 0) return distances[0][0];

    const insideazone = zone => {
      if (zone.geometry != null && zone.on && !zone.neighbor)
        for (const geometry of zone.geometry)
          if (isInBounds(coord, geometry.bnd) && isInside(coord, geometry.plg)) return zone.info.id;
      return -1;
    }
    let i;
    for (const zone of this.data.zones) if ( zone.enclave) { if ((i = insideazone(zone)) > -1) return i; }
    for (const zone of this.data.zones) if (!zone.enclave) { if ((i = insideazone(zone)) > -1) return i; }

    distances = [];
    for (const zone of this.data.zones) if (zone.on && "islands" in zone) for (const island of zone.islands) {
      if (coord[0] > island[0] - this.irad * (island.length == 3 ? island[2] : 1) && coord[0] < island[0] + this.irad * (island.length == 3 ? island[2] : 1)) {
        const d = Math.hypot(coord[0] - island[0], coord[1] - island[1]);
        if (d < this.irad * (island.length == 3 ? island[2] : 1)) distances.push([ zone.info.id, d ])
      }
    }
    distances.sort((a, b) => a[1] < b[1] ? -1 : 1);
    if (distances.length > 0 && distances[0][1] < this.irad) return distances[0][0];
    
    for (const zone of this.data.zones) if ("clickzones" in zone && zone.on) {
      for (const clickzone of zone.clickzones) if (isInside(coord, clickzone)) {
        return zone.info.id;
      }
	  }

    return -1;
  }

  findHoveredCity(coord) {
    let distances = [];
    const bd = 5;
    const isInBounds = c => coord[0] > c[0] - bd && coord[0] < c[0] + bd && coord[1] > c[1] - bd && coord[1] < c[1] + bd;
    for (const city of this.data.cities) if (city.on && isInBounds(city.coords)) distances.push([ city.id, Math.hypot(coord[0] - city.coords[0], coord[1] - city.coords[1]) ]);
    distances = distances.sort((a, b) => a[1] > b[1] ? 1 : -1);
    if (distances.length != 0 && distances[0][1] <= bd) return distances[0][0];
    return -1;
  }

  updateMovement() {
    if (this.isaclick) return;

    const centerpointbefore = [this.centerpoint[0], this.centerpoint[1]];
    this.iszooming = this.molette.update() && this.molette.value + 0.05 < this.moletteiterations / 2;
    this.calcviewrange();
    if (this.iszooming) {
      this.centerpoint[0] = this.zoominglockcoords[0] - (this.mousepos[0] / this.width - 0.5) * this.viewrange;
      this.centerpoint[1] = this.zoominglockcoords[1] + (this.mousepos[1] / this.width - this.height / this.width * 0.5) * this.viewrange;
    } else {
      if (this.mouseisdown) {
        this.centerpoint[0] = modx(this.centerpoint[0] - this.lastmousemov[0] * this.viewrange / this.width);
        this.centerpoint[1] += this.lastmousemov[1] * this.viewrange / this.width;
      } else {
        this.mouseinerty[0] /= 1.1;
        this.mouseinerty[1] /= 1.1;
        this.centerpoint[0] = modx(this.centerpoint[0] - this.mouseinerty[0] * this.viewrange / this.width);
        this.centerpoint[1] += this.mouseinerty[1] * this.viewrange / this.width;
      }
    }
    this.lastmousemov = [ 0, 0 ]
    this.recenter();
    if (this.mouseisdown && !(centerpointbefore[0] == this.centerpoint[0] && centerpointbefore[1] == this.centerpoint[1])) this.ismoving = true;
  }

  shake(time) {
    this.shaketimeanim = time;
    this.shaketimer = time;
  }

  update(now) {
    // console.log(this.centerpoint)
    this.now = now;
    const delta = now - this.lasttime;
    const second = Math.floor(now / 1000);
    this.fps.push(1000 / delta);
    if (second != this.lastsecond) {
      // new second
      let mfps = 0;
      for (const fps of this.fps) mfps += fps;
      this.efps.textContent = `FPS: ${Math.round(mfps / this.fps.length)}`
      this.fps = [];
      this.lastsecond = second;
    }

    this.lasttime = now;
    this.shaketimer = Math.max(0, this.shaketimer - delta) | 0;

    this.updateMovement();
    this.canvas.style.cursor = this.ismoving ? "move" : "default"

    this.hoveredZones.current[1] = Math.min(this.hoveredZones.current[1] + delta * 6 / 100, this.hoverframes);
    this.hoveredCities.current[1] = Math.min(this.hoveredCities.current[1] + delta * 6 / 100, this.hoverframes);
    for (const hci in this.hoveredZones.previous) {
      if ((this.hoveredZones.previous[hci][1] -= delta * 6 / 100) <= 0)
        this.hoveredZones.previous.splice(hci, 1);
    }
    for (const hci in this.hoveredCities.previous) {
      if ((this.hoveredCities.previous[hci][1] -= delta * 6 / 100) <= 0)
        this.hoveredCities.previous.splice(hci, 1);
    }

    const mousecoords = this.canvasToCoord(this.mousepos);
    this.emousecoords.textContent = `LON: ${Math.round(mousecoords[0] * 10) / 10}, LAT: ${Math.round(Math.sin(mousecoords[1] / 90) * 90 * 10) / 10}`;

    for (const zone of this.data.zones) {
      zone.hs = this.getZoneHoveringState(zone.info.id);
      zone.hovered = this.hoveredZones.current[0] == zone.info.id;
    }

    this.flashcol /= 1.1;
    this.drawAll();

    window.requestAnimationFrame(this.update.bind(this));
  }

  hover() {
    // cities
    const lhc = this.hoveredCities.current[0];
    let hoveredc = this.findHoveredCity(this.canvasToCoord(this.mousepos));
    if (hoveredc > -1 && !this.data.cities[hoveredc].on) hoveredc = -1;
    if (lhc != hoveredc) {
      this.hoveredCities.previous.push([ lhc, this.hoverframes ]);
      this.hoveredCities.current = [ hoveredc, 0 ];
      this.onhover("c", false, lhc);
      this.onhover("c", true, hoveredc);
    }

    // zones
    const lhz = this.hoveredZones.current[0];
    let hoveredz = this.findHoveredZone(this.canvasToCoord(this.mousepos));
    if (hoveredz == -1 && "ct".includes(this.game.type) && this.hoveredCities.current[0] != -1) for (const zone of this.data.zones) if (zone.info.id == this.data.cities[this.hoveredCities.current[0]].zid) hoveredz = zone.info.id;
    // if (hoveredz == -1 && "ct".includes(this.game.type) && this.hoveredCities.current[0] != -1)

    if (hoveredz > -1 && !this.data.zones[hoveredz].on) hoveredz = -1;
    if (lhz != hoveredz) {
      this.hoveredZones.previous.push([ lhz, this.hoverframes ]);
      this.hoveredZones.current = [ hoveredz, 0 ];
      this.onhover("z", false, lhz);
      this.onhover("z", true, hoveredz);
    }
  }

  zoom(e) {
    this.molette.newTo(Math.max(-this.moletteiterations / 2, Math.min(this.moletteiterations / 2, this.molette.to + e / 100)));
    this.zoominglockcoords = this.canvasToCoord(this.mousepos);
  }

  mousedown(e) {
    this.mouseisdown = true;
    this.isaclick = true;
    this.mouseclickpos = [ e.clientX, e.clientY ];
  }

  mouseup(e) {
    this.mouseisdown = false;
    this.ismoving = false;
    this.mouseinerty = this.lastmousemov;
    if (this.isaclick) {
      if (this.hoveredZones.current[0]  != -1) this.onclick("z", this.hoveredZones.current[0]);
      if (this.hoveredCities.current[0] != -1) this.onclick("c", this.hoveredCities.current[0]);
      this.hover();
    }
    this.isaclick = false;
  }

  mousemove(e) {
    this.lastmousemov[0] += e.clientX - this.mousepos[0];
    this.lastmousemov[1] += e.clientY - this.mousepos[1];
    this.mousepos = [ e.clientX, e.clientY ];
    if (this.mouseisdown && Math.hypot(this.mousepos[0] - this.mouseclickpos[0], this.mousepos[1] - this.mouseclickpos[1]) > 2)
      this.isaclick = false;
    this.hover();
    this.lastmousepos = this.mousepos;
  }
}
