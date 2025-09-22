export class Decompresser {

  constructor(buffer) {
    this.buffer = buffer;
    this.index = 0;
    this.max_int16 = 32768**2;
    this.text_decoder = new TextDecoder();
  }

  // reads the next length elements of buffer, interpreting them as type with unit size
  // (counted in number of bytes)
  readAs(length, unit_size) {
    let r = this.buffer.slice(this.index, this.index + length * unit_size);
    this.index += length * unit_size;
    return r;
  }

  readAsCoordinates(number) {
    let array = new Int32Array(this.readAs(number*2, 4))
    
    let coords = [];
    for (let i = 0; i < number; i++) {
      coords.push([
        720 * array[2*i]   / this.max_int16,
        720 * array[2*i+1] / this.max_int16
      ]);
    }
  
    return coords;
  }

  readAsString(length) {
    let uint8array = new Uint8Array(this.readAs(length, 1));
    return this.text_decoder.decode(uint8array);
  }

  readString() {
    let length = new Uint16Array(this.readAs(1, 2))[0];
    return this.readAsString(length);
  }

  readAsDots(number) {
    let array = new Int32Array(this.readAs(number*3, 4));
    let dots = [];
    for (let i = 0; i < number; i++) {
      dots.push([
        //array[3*i],array[3*i+1],array[3*i+2]
        720 * array[3*i]   / this.max_int16,
        720 * array[3*i+1] / this.max_int16,
        720 * array[3*i+2] / this.max_int16
      ])
    }
    return dots;
  }

  readUint8()  { return new  Uint8Array(this.readAs(1, 1))[0] }
  readUint16() { return new Uint16Array(this.readAs(1, 2))[0] }
  readUint32() { return new Uint32Array(this.readAs(1, 4))[0] }

  readAsIndices(indices_length, delta_index, byte_length) {
    let data = this.readAs(indices_length, byte_length);
    let indices = byte_length == 1
      ? new Uint8Array(data)
      : (byte_length == 2
        ? new Uint16Array(data)
        : new Uint32Array(data))
    return new Uint32Array(indices).map(x => x + delta_index)
  }

  decompress() {
    let obj = {};
    
    const entete = new Uint32Array(this.readAs(7, 4));
    obj.zvcount = entete[0];
    obj.zicount = entete[1];
    obj.lvcount = entete[2];
    obj.licount = entete[3];

    const zones_count = entete[4];
    const lakes_count = entete[5];
    const cities_count = entete[6];
    
    let region = this.readAsCoordinates(3);
    obj.regionlimits = region[0].concat(region[1]);
    obj.viewranges = region[2];

    // world view
    if (obj.regionlimits[0] == 0 && obj.regionlimits[2] == 0) {
      obj.regionlimits = [ -360, -90, 360, 90 ]
      obj.viewranges = [ 5, 360 ]
    }

    obj.zones = [];

    for (let zi = 0; zi < zones_count; zi++) {

      let zone = { id: zi };
      
      const z1 = new Uint16Array(this.readAs(8, 2))
      zone.info = { id: z1[0] };
      const geometry_length   = z1[1];
      const clickzones_length = z1[2];
      const islands_length    = z1[3];
      if (z1[4] > 0) zone.forced = z1[4] / 32768;
      zone.enclave = z1[5]
      const rgs_length = z1[6];
      zone.neighbor = z1[7] == 1;
      
      zone.center = this.readAsCoordinates(1)[0];

      zone.info.iso = this.readString();
      zone.info.name = {
        na: this.readString(),
        en: this.readString(),
        fr: this.readString()
      }

      zone.info.flag = this.readString();

      zone.geometry = [];

      zone.info.rgs = [];
      for (let rgsi = 0; rgsi < rgs_length; rgsi++) {
        zone.info.rgs.push(this.readString());
      }
      
      for (let gi = 0; gi < geometry_length; gi++) {

        let geometry = {};
        
        const g1 = new Uint32Array(this.readAs(4, 6));
        geometry.vertexstart = g1[0];
        const vertices_length = g1[1];
        geometry.indexstart = g1[2];
        const indices_length = g1[3];
        const delta_index = g1[4];
        const byte_length = g1[5];

        const bnd = this.readAsCoordinates(2);
        geometry.bnd = bnd[0].concat(bnd[1])

        geometry.area = new Float32Array(this.readAs(1, 4))[0];

        geometry.plg = this.readAsCoordinates(vertices_length);
        geometry.indices = this.readAsIndices(indices_length, delta_index, byte_length);

        zone.geometry.push(geometry)
    
      }

      let clickzones = [];

      for (let czi = 0; czi < clickzones_length; czi++) {

        const clickzone_length = new Uint16Array(this.readAs(1, 2))[0];
        clickzones.push(this.readAsCoordinates(clickzone_length));
    
      }

      if (clickzones_length > 0) zone.clickzones = clickzones;

      if (islands_length > 0) {
        zone.islands = this.readAsDots(islands_length).map(x => x.slice(0,2));
      }
      
      obj.zones.push(zone);
      
    }

    obj.lakes = [];
    obj.cities = [];

    for (let li = 0; li < lakes_count; li++) {

      let lake = {};
      
      const g1 = new Uint16Array(this.readAs(6, 2))
      lake.vertexstart = g1[0];
      const vertices_length = g1[1];
      lake.indexstart = g1[2];
      const indices_length = g1[3];
      const delta_index = g1[4];
      const byte_length = g1[5];

      const bnd = this.readAsCoordinates(2);
      lake.bnd = bnd;

      lake.area = new Float32Array(this.readAs(1, 4))[0];
      lake.plg = this.readAsCoordinates(vertices_length);
      lake.indices = this.readAsIndices(indices_length, delta_index, byte_length);

      obj.lakes.push(lake);
      
    }

    const difficulties = this.readString();
    if (difficulties.length > 0) {
      obj.difficulties = JSON.parse(difficulties)
    }

    obj.cities = [];

    for (let ci = 0; ci < cities_count; ci++) {
      let city = {};
      city.pop = this.readUint32()
      city.level = this.readUint8();
      city.zid = this.readUint16()
      city.coords = this.readAsCoordinates(1)[0];
      city.name = {
        na: this.readString(),
        en: this.readString(),
        fr: this.readString(),
      };
      obj.cities.push(city)
    }

    return obj;
  }
}