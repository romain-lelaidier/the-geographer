////////////////////
///// GEOMETRY /////
////////////////////
Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};
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
  #define M_PI 3.1415926535897932384626433832795

  uniform float uratio;
  uniform float uviewrange;
  uniform float uxoffset;
  uniform vec2  ucenterpoint;
  uniform float ucrad;
  uniform int uprojection;

  in vec2 acoord;

  vec2 project(vec2 coord) {

    vec2 ll = coord * M_PI / 180.0;
    vec2 ll0 = ucenterpoint * M_PI / 180.0;

    if (uprojection == 1) {
      return vec2(
        coord[0],
        sign(ll[1]) * log(tan(M_PI / 4.0 + clamp(abs(ll[1]), 0.0, M_PI / 2.0 - 0.05) / 2.0)) * 180.0 / M_PI
      );
    } else if (uprojection == 2) {
      return vec2(
        coord[0],
        (1.0 + sqrt(2.0)) * tan(ll[1] / 2.0) * 180.0 / M_PI
      );
    } else if (uprojection == 3) {
      return vec2(
        coord[0],
        asin(coord[1] / 90.0) * 90.0
      );
    } else if (uprojection == 4) {
      return vec2(
        (coord[0] - ucenterpoint[0]) * cos(ll[1]),
        coord[1]
      );
    } else if (uprojection == 5) {
      float alpha = 1.0 + cos(ll[1] - ll0[1]) + cos(ll0[1]) * cos(ll[1]) * (cos(ll[0] - ll0[0]) - 1.0);
      return 50.0 * sqrt(2.0 / alpha) * vec2(
        cos(ll[1]) * sin(ll[0] - ll0[0]),
        sin(ll[1] - ll0[1]) - sin(ll0[1]) * cos(ll[1]) * (cos(ll[0] - ll0[0]) - 1.0)
      );
    }
    return coord;
  }

  void main() {
    vec2 projected = project(acoord + vec2(uxoffset * 360.0, 0.0));
    
    if (uprojection != 4 && uprojection != 5) {
      projected = projected - ucenterpoint;
    }

    vec2 ccoord = vec2(
      projected[0],
      projected[1] * uratio
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
      (cacoord[0] - cucenterpoint[0] + cuxoffset * 360.0),
      (cacoord[1] - cucenterpoint[1]) * curatio
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

const projections = {
  wgs: 0,   // WGS84
  mct: 1,   // MERCATOR
  str: 2,   // STEREOGRAPHIC
  nat: 3,   // NATURAL
  sin: 4,   // SINUSOIDAL
  lmb: 5    // LAMBERT
}

export class Map {
  /**
   * creates the application
   * @param {object} data 
   * @param {object} game 
   * @param {function} onhover 
   * @param {function} onclick 
   */
  constructor(data, game, onhover, onclick, projection = "mct") {
	  this.data = data;
    this.game = game;
    this.onhover = onhover;
    this.onclick = onclick;

    this.canvas = document.getElementById("appcanvas");

    this.lasttime = Date.now();
    this.lastsecond = Math.floor(this.lasttime / 1000);

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
    this.grid = {
      divsize: 10,  // size of a division
      divsubdiv: 3  // number of subdivisions (graphical quality of grid)
    }
    this.determineGridSettings();

    // colors
    this.colors = {};
    const stl = getComputedStyle(document.documentElement)
    for (const prop of [ "white", "lblue", "dblue", "black", "vermi" ])
      this.colors[prop] = hextorgb(stl.getPropertyValue("--color-" + prop));

    for (const zone of this.data.zones) {
      zone.color = mixcol(this.colors.black, new Array(3).fill(Math.random()), Math.random() / 3.5);
      let needsline = game.region.length == 3;
      for (const plg of zone.geometry) needsline = needsline && plg.area < 0.3;
      for (const plg of zone.geometry) plg.needsline = needsline;
    }

    // debug infos
    this.fps = [];
    this.efps = document.getElementById("fps");
    this.emousecoords = document.getElementById("mousecoords");

    // camera
    this.cam = {
      prj: projection,
      cp: game.regioncenter || (game.regionlimits 
        ? [ (game.regionlimits[0] + game.regionlimits[2]) / 2, (game.regionlimits[1] + game.regionlimits[3]) / 2 ] 
        : [ 0, 0 ]),
      vr: 0
    }
    this.cam.cp = this.project(...this.cam.cp);

    this.resize();

    // movement
    this.mv = {
      moletteiterations: 6,
      molette: new Transition(8, 6 / 2),
      lastmousemov: [ 0, 0 ],
      mousepos: [ this.width / 2, this.height / 2 ],
      mouseinertia: [ 0, 0 ],
      iszooming: false,
      ismoving: false,
      zoominglockcoords: [ 0, 0 ]
    };

    if ("beginningviewrange" in game) {
      this.mv.molette.from = this.mv.molette.to = this.mv.molette.value
      = Math.sqrt((game.beginningviewrange - game.viewranges[0]) * Math.pow(this.mv.moletteiterations, 2) / (game.viewranges[1] - game.viewranges[0])) - this.mv.moletteiterations / 2
    }

    this.calcviewrange();

    this.init_gl();
    this.createGridVBOs();
    this.createGeometryVBO();
    this.createIslandsVBO();
    this.createCitiesVBO();

    this.update();

    // events
    window.addEventListener("resize", () =>    this.resize())
    this.canvas.addEventListener("mousewheel", e => this.zoom(e.deltaY));
    this.canvas.addEventListener("DOMMouseScroll", e => this.zoom(e.detail * 20));
    this.canvas.addEventListener("mousedown", e  => this.mousedown(e));
    this.canvas.addEventListener("mouseup", e =>    this.mouseup(e));
    this.canvas.addEventListener("mousemove", e =>  this.mousemove(e));
  }


  project(lon, lat) {
    const λ = lon * Math.PI / 180;
    const φ = lat * Math.PI / 180;

    const λ0 = this.cam.cp[0] * Math.PI / 180;
    const φ0 = this.cam.cp[1] * Math.PI / 180;

    if (this.cam.prj == "nat") {
      return [ lon, Math.asin(lat / 90) * 90 ];
    } if (this.cam.prj == "mct") {
      return [ lon, Math.sign(φ) * Math.log(Math.tan(Math.PI / 4 + (Math.abs(φ)).clamp(0, Math.PI / 2 - 0.05) / 2)) * 180 / Math.PI ];
    } else if (this.cam.prj == "str") {
      return [ lon, (1 + Math.sqrt(2)) * Math.tan(φ / 2) * 180 / Math.PI ];
    } else if (this.cam.prj == "sin") {
      return [ (lon - this.cam.cp[0]) * Math.cos(φ), lat ]
    } else if (this.cam.prj == "lmb") {
      const alpha = 1 + Math.cos(φ - φ0) + Math.cos(φ0) * Math.cos(φ) * (Math.cos(λ - λ0) - 1);
      return [
        50 * Math.sqrt(2 / alpha) * (Math.cos(φ) * Math.sin(λ - λ0)),
        50 * Math.sqrt(2 / alpha) * (Math.sin(φ - φ0) - Math.sin(φ0) * Math.cos(φ) * (Math.cos(λ - λ0) - 1))
      ];
    }
    return [ lon, lat ];
  }

  projectInv(a, b) {
    if (this.cam.prj == "nat") {
      return [ a, Math.sin(b / 90) * 90 ];
    } if (this.cam.prj == "mct") {
      const φ = (Math.atan(Math.exp(b * Math.PI / 180)) - Math.PI / 4) * 2
      return [ a, φ * 180 / Math.PI ];
    } else if (this.cam.prj == "str") {
      return [ a, Math.atan(b * Math.PI / (180 * (1 + Math.sqrt(2)))) * 2 * 180 / Math.PI ]
    } else if (this.cam.prj == "sin") {
      const φ = b * Math.PI / 180;
      return [ a / Math.cos(φ) + this.cam.cp[0], b ]
    }
    return [ a, b ]
  }

  canvasToCoord(c) {
    const x = c[0] || c[0];
    const y = c[1] || c[1];
    if (this.cam.prj != "sin" && this.cam.prj != "lmb") {
      return this.projectInv(
        modx((x / this.width - 0.5) * this.cam.vr + this.cam.cp[0]),
        this.cam.cp[1] - (y / this.width - this.height / this.width * 0.5) * this.cam.vr
      )
    }
    return this.projectInv(
      modx((x / this.width - 0.5) * this.cam.vr),
      -(y / this.width - this.height / this.width * 0.5) * this.cam.vr
    )
  }

  coordToCanvas(c) {
    const [ x, y ] = this.project(...c);
    return [
      (x / this.cam.vr + 0.5) * this.width,
      - (y / this.cam.vr + this.height / this.width * 0.5) * this.width
    ]
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
    this.pco.uniformlocations(this.gl, [ "ucol", "ucrad", "uratio", "uopacity", "uxoffset", "uviewrange", "ucenterpoint", "uprojection" ])
    this.pco.attriblocations(this.gl, [ "acoord" ])

    // circles
    this.pci = new Program(this.gl, ...shdsrc_circles);
    this.pci.uniformlocations(this.gl, [ "cucol", "cucrad", "curatio", "cucenter", "cuopacity", "cuxoffset", "cuviewrange", "cucenterpoint", "cucity" ]);
    this.pci.attriblocations(this.gl, [ "cacoord" ]);

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
  }

  determineGridSettings() {
    var xmax = 0, xiter = 0;
    while (xmax + this.grid.divsize <= 180) {
      xmax += this.grid.divsize;
      xiter += 1;
    }
    var ymax = 0, yiter = 0;
    while (ymax + this.grid.divsize <= 90) {
      ymax += this.grid.divsize;
      yiter += 1;
    }
    this.grid.raysmin = [ -xmax, -ymax ]
    this.grid.rays = [ xiter * 2 + 1, yiter * 2 + 1 ]
    this.grid.subrays = [
      (this.grid.rays[1] - 1) * this.grid.divsubdiv + 1,
      (this.grid.rays[0] - 1) * this.grid.divsubdiv + 1,
    ]
  }

  createGridVBOs() {
    const verticalRaysVertices = [];
    for (let xi = 0; xi < this.grid.rays[0]; xi++) {
      const x = this.grid.raysmin[0] + xi * this.grid.divsize;
      for (let yi = 0; yi < this.grid.subrays[0]; yi++) {
        const y = this.grid.raysmin[1] + yi * this.grid.divsize / this.grid.divsubdiv;
        verticalRaysVertices.push(x, y)
      }
    }

    const horizontalRaysVertices = [];
    for (var yi = 0; yi < this.grid.rays[1]; yi++) {
      const y = this.grid.raysmin[1] + yi * this.grid.divsize;
      for (let xi = 0; xi < this.grid.subrays[1]; xi++) {
        const x = this.grid.raysmin[0] + xi * this.grid.divsize / this.grid.divsubdiv;
        horizontalRaysVertices.push(x, y)
      }
    }

    this.vgridVBO = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vgridVBO);
    const vgridVAO = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vgridVAO);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(verticalRaysVertices), this.gl.STATIC_DRAW);
    this.gl.vertexAttribPointer(this.pco.a.acoord, 2, this.gl.FLOAT, false, 8, 0);
    this.gl.enableVertexAttribArray(this.pco.a.acoord);

    this.hgridVBO = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.hgridVBO);
    const hgridVAO = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, hgridVAO);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(horizontalRaysVertices), this.gl.STATIC_DRAW);
    this.gl.vertexAttribPointer(this.pco.a.acoord, 2, this.gl.FLOAT, false, 8, 0);
    this.gl.enableVertexAttribArray(this.pco.a.acoord);
  }

  drawGrid(offsets) {
    this.gl.uniform1f(this.pco.u.uopacity, 1);
    this.gl.uniform3f(this.pco.u.ucol, ...mixcol(this.colors.lblue, this.colors.black, 0.1));
    for (const offset of offsets) {
      this.gl.uniform1f(this.pco.u.uxoffset, offset);
      this.gl.bindVertexArray(this.vgridVBO);
      for (var i = 0; i < this.grid.rays[0]; i++) {
        this.gl.drawArrays(this.gl.LINE_STRIP, i * this.grid.subrays[0], this.grid.subrays[0]);
      }
      this.gl.bindVertexArray(this.hgridVBO);
      for (var i = 0; i < this.grid.rays[1]; i++) {
        this.gl.drawArrays(this.gl.LINE_STRIP, i * this.grid.subrays[1], this.grid.subrays[1]);
      }
    }
  }

  createGeometryVBO() {
    let vertices = new Float32Array((this.data.zvcount + this.data.lvcount) * 2);
    let indices = new Uint16Array(this.data.zicount + this.data.licount);
    let vi = 0, ii = 0;
    var proj;

    const pushGeometry = (geometry) => {
      for (const c of geometry.plg) {
        vertices[vi++] = c[0];
        vertices[vi++] = c[1];
      }
      for (const index of geometry.indices) {
        indices[ii++] = index;
      }
    }

    for (const lake of this.data.lakes) {
      pushGeometry(lake);
    }
	
    for (const zone of this.data.zones) {
      for (const geometry of zone.geometry) {
        pushGeometry(geometry)
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
      const [ x, y ] = this.project(...p);
      vertices.push(
        x - dr, y - dr,
        x + dr, y - dr,
        x + dr, y + dr,
        x - dr, y - dr,
        x + dr, y + dr,
        x - dr, y + dr
      )
    }

    let minPop = Infinity, maxPop = 0;
    for (const city of this.data.cities) {
      city.on = false;
      city.id = id++;
      minPop = Math.min(minPop, city.pop);
      maxPop = Math.max(maxPop, city.pop);
      addpoint(city.coords);
      //if (!city.pop) { city.crad = 5; };
      // if (this.game.region.length == 3) city.crad /= 4;
      // if (this.data.craddividor) city.crad /= this.data.craddividor;
    }
    var transform = pop => Math.pow(pop, 1/4);
    var minpt = transform(minPop), maxpt = transform(maxPop);
    for (const city of this.data.cities) {
      // city.crad = 2 + Math.pow(city.pop, 1/4) / 10;
      city.crad = 0.5 + 1.5 * (transform(city.pop) - minpt) / (maxpt - minpt);
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
      const [ x, y ] = this.project(...p);
      vertices.push(
        x - dr, y - dr,
        x + dr, y - dr,
        x + dr, y + dr,
        x - dr, y - dr,
        x + dr, y + dr,
        x - dr, y + dr
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
    this.cam.vr = (Math.pow(this.mv.molette.value / this.mv.moletteiterations + 0.5, 2) * (this.game.viewranges[1] - this.game.viewranges[0]) + this.game.viewranges[0]);

    // clamping to prevent zoom out
    if (this.cam.prj == "nat") {
      // viewrange height is viewrange / width * height
      if (this.cam.vr * this.height / this.width > Math.PI * 85) this.cam.vr = Math.PI * 85 * this.width / this.height;
    } else {
      const [ _1, maxy ] = this.canvasToCoord([ 0, 0 ])
      const [ _2, miny ] = this.canvasToCoord([ 0, this.height ])
      if (maxy - miny > 180) {
        this.cam.vr *= 180 / (maxy - miny)
      }
    }
  }

  beginviewrange(vr) {
    this.mv.molette.restartFrom((Math.sqrt((vr - this.game.viewranges[0]) / (this.game.viewranges[1] - this.game.viewranges[0])) - 0.5) * this.mv.moletteiterations);
  }

  recenter() {
    // x
    if (this.game.regionlimits[2] - this.cam.vr / 2 < this.game.regionlimits[0] + this.cam.vr / 2) this.cam.cp[0] = (this.game.regionlimits[0] + this.game.regionlimits[2]) / 2;
    else this.cam.cp[0] = Math.min(this.game.regionlimits[2] - this.cam.vr / 2, Math.max(this.game.regionlimits[0] + this.cam.vr / 2, this.cam.cp[0]));

    // y
    const miny = this.project(0, this.game.regionlimits[1])[1];
    const maxy = this.project(0, this.game.regionlimits[3])[1];
    const vrh = this.cam.vr / 2 * this.height / this.width;
    if (maxy - vrh < miny + vrh) this.cam.cp[1] = (miny + maxy) / 2;
    else this.cam.cp[1] = Math.min(maxy - vrh, Math.max(miny + vrh, this.cam.cp[1]));
  }

  resize() {
    this.canvas.width = this.width = this.canvas.clientWidth;
    this.canvas.height = this.height = this.canvas.clientHeight;
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
    const offset = this.shaketimer == 0 ? 0 : Math.asin(-this.shaketimer / this.shaketimeanim) * Math.sin(this.shaketimer / 30) * this.cam.vr / 100;
    const cp = [ this.cam.cp[0] + offset, this.cam.cp[1] ];
    var minx = cp[0] - this.cam.vr / 2;
    var miny = cp[1] - this.cam.vr / 2 * this.height / this.width;
    var maxx = cp[0] + this.cam.vr / 2;
    var maxy = cp[1] + this.cam.vr / 2 * this.height / this.width;
    const isOnScreen = (bnd, xoffset = 0) => {
      const [ x0, y0 ] = this.project(bnd[0], bnd[1]);
      const [ x1, y1 ] = this.project(bnd[2], bnd[3]);
      return x0 + xoffset * 360 < maxx && x1 + xoffset * 360 > minx && y0 < maxy && y1 > miny;
    }

    // draw twice because Earth is a cylinder
    const beginning = cp[0] - this.cam.vr / 2 < -180 ? -1 : 0;
    const end = cp[0] + this.cam.vr / 2 > 180 ? 2 : 1;
    const offsets = [];
    for (let a = beginning; a < end; a++) offsets.push(a);

    this.gl.viewport(0, 0, this.width, this.height);
    this.gl.clearColor(...this.colors.lblue, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // basic uniforms
    this.pci.use(this.gl);
    this.gl.uniform1f(this.pci.u.curatio, this.width / this.height);
    this.gl.uniform1f(this.pci.u.cuviewrange, this.cam.vr);
    this.gl.uniform2f(this.pci.u.cucenterpoint, cp[0], cp[1]);
    
    this.pco.use(this.gl);
    this.gl.uniform1f(this.pco.u.uratio, this.width / this.height);
    this.gl.uniform1f(this.pco.u.uviewrange, this.cam.vr);
    this.gl.uniform2f(this.pco.u.ucenterpoint, cp[0], cp[1]);
    this.gl.uniform1i(this.pco.u.uprojection, projections[this.cam.prj]);

    // drawing grid
    this.drawGrid(offsets);

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
            this.gl.uniform2f(this.pci.u.cucenter, ...this.project(zone.islands[i][0], zone.islands[i][1]));
            this.gl.drawArrays(this.gl.TRIANGLES, (zone.pointstart + i) * 6, 6);
          }
        }
      }
      for (const offset of offsets) {
        this.gl.uniform1f(this.pci.u.cuxoffset, offset);
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
      for (const geometry of zone.geometry) for (const offset of offsets) {
        if (isOnScreen(geometry.bnd, offset)) {
          this.gl.uniform1f(this.pco.u.uxoffset, offset);

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
      for (const offset of offsets) {
        this.gl.uniform1f(this.pco.u.uxoffset, offset);

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
        this.gl.uniform2f(this.pci.u.cucenter, ...this.project(zone.center[0], zone.center[1]));
        this.gl.drawArrays(this.gl.TRIANGLES, zone.pointstart * 6, 6);
      }
    }
    for (const offset of offsets) {
      this.gl.uniform1f(this.pci.u.cuxoffset, offset);
      for (const c of this.hoveredZones.previous) df(c[0]);
      df(this.hoveredZones.current[0])
    }

    // cities
    // this.gl.uniform1ui(this.pci.u.cucity, 1);
    const scale = Math.pow(this.cam.vr / 1000000, 0.7) * 150;
    if (this.game.mode == "e" || "bde".includes(this.game.type)) {
      this.gl.bindVertexArray(this.points_vbo);
      for (const offset of offsets) {
        this.gl.uniform1f(this.pci.u.cuxoffset, offset);
        for (const city of this.data.cities) if (city.on) {
          const helpMultiplier = this.helpCityId == city.id ? 0.5 + 0.5 * Math.sin(this.now / 200) : 0;
          let hs = this.getCityHoveringState(city.id);
          const rad = city.crad * (hs == -1 ? 1 : 1 + 0.5 * Math.sin(Math.PI / 2 * hs)) * (1 + 0.7 * helpMultiplier);
          if (isOnScreen([ city.coords[0] - rad, city.coords[1] - rad, city.coords[0] + rad, city.coords[1] + rad ], offset)) {
            if (hs == -1 && city.id == this.hoveredCities.current[0]) hs = 1;
            let citycol = hs == -1 || this.game.mode == "e" ? this.colors.white : mixcol(this.colors.white, this.colors.vermi, Math.sin(Math.PI / 2 * hs));
            if (helpMultiplier != 0) citycol = mixcol(citycol, [ 0, 1, 0 ], (0.5 + 0.5 * helpMultiplier));
            this.gl.uniform1f(this.pci.u.cuopacity, hs == -1 ? 0.5 : 0.5 * (1 + Math.sin(Math.PI / 2 * hs)));
            this.gl.uniform3f(this.pci.u.cucol, ...citycol);
            this.gl.uniform1f(this.pci.u.cucrad, rad * scale);
            this.gl.uniform2f(this.pci.u.cucenter, ...this.project(city.coords[0], city.coords[1]))
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
      const rad = this.frad * zone.forced;
      if (coord[0] > zone.center[0] - rad && coord[0] < zone.center[0] + rad) {
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

    const centerpointbefore = [this.cam.cp[0], this.cam.cp[1]];
    this.mv.iszooming = this.mv.molette.update() && this.mv.molette.value + 0.05 < this.mv.moletteiterations / 2;
    this.calcviewrange();
    if (this.mv.iszooming) {
      // il faut changer centerpoint de sorte que zoominglockscoords reste la même
      const [ x, y ] = this.project(...this.mv.zoomlockcoords);
      this.cam.cp[0] = x - (this.mv.mousepos[0] / this.width - 0.5) * this.cam.vr;
      this.cam.cp[1] = y + (this.mv.mousepos[1] / this.width - this.height / this.width * 0.5) * this.cam.vr;
    } else {
      if (this.mouseisdown) {
        this.cam.cp[0] = modx(this.cam.cp[0] - this.mv.lastmousemov[0] * this.cam.vr / this.width);
        this.cam.cp[1] += this.mv.lastmousemov[1] * this.cam.vr / this.width;
      } else {
        this.mv.mouseinertia[0] /= 1.1;
        this.mv.mouseinertia[1] /= 1.1;
        this.cam.cp[0] = modx(this.cam.cp[0] - this.mv.mouseinertia[0] * this.cam.vr / this.width);
        this.cam.cp[1] += this.mv.mouseinertia[1] * this.cam.vr / this.width;
      }
    }
    this.mv.lastmousemov = [ 0, 0 ];
    this.recenter();
    if (this.mouseisdown && !(centerpointbefore[0] == this.cam.cp[0] && centerpointbefore[1] == this.cam.cp[1])) this.mv.ismoving = true;
  }

  shake(time) {
    this.shaketimeanim = time;
    this.shaketimer = time;
  }

  update(now) {
    // console.log(this.cam.cp)
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
    this.canvas.style.cursor = this.mv.ismoving ? "move" : "default"

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

    const mousecoords = this.canvasToCoord(this.mv.mousepos);
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
    let hoveredc = this.findHoveredCity(this.canvasToCoord(this.mv.mousepos));
    if (hoveredc > -1 && !this.data.cities[hoveredc].on) hoveredc = -1;
    if (lhc != hoveredc) {
      this.hoveredCities.previous.push([ lhc, this.hoverframes ]);
      this.hoveredCities.current = [ hoveredc, 0 ];
      this.onhover("c", false, lhc);
      this.onhover("c", true, hoveredc);
    }

    // zones
    const lhz = this.hoveredZones.current[0];
    let hoveredz = this.findHoveredZone(this.canvasToCoord(this.mv.mousepos));
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
    this.mv.molette.newTo(Math.max(-this.mv.moletteiterations / 2, Math.min(this.mv.moletteiterations / 2, this.mv.molette.to + e / 100)));
    this.mv.zoomlockcoords = this.canvasToCoord(this.mv.mousepos);
  }

  mousedown(e) {
    this.mouseisdown = true;
    this.isaclick = true;
    this.mouseclickpos = [ e.clientX, e.clientY ];
  }

  mouseup(e) {
    this.mouseisdown = false;
    this.mv.ismoving = false;
    this.mv.mouseinertia = this.mv.lastmousemov;
    if (this.isaclick) {
      if (this.hoveredZones.current[0]  != -1) this.onclick("z", this.hoveredZones.current[0]);
      if (this.hoveredCities.current[0] != -1) this.onclick("c", this.hoveredCities.current[0]);
      this.hover();
    }
    this.isaclick = false;
  }

  mousemove(e) {
    this.mv.lastmousemov[0] += e.clientX - this.mv.mousepos[0];
    this.mv.lastmousemov[1] += e.clientY - this.mv.mousepos[1];
    this.mv.mousepos[0] = e.clientX;
    this.mv.mousepos[1] = e.clientY;
    if (this.mouseisdown && Math.hypot(this.mv.mousepos[1] - this.mouseclickpos[0], this.mv.mousepos[1] - this.mouseclickpos[1]) > 2)
      this.isaclick = false;
    this.hover();
  }
}
