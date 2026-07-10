(function () {
  // ── Six kit paints (Kubelka-Munk mixing) ──
  var BASES = [
    { name: 'White',      color: '#ffffff', rgb: [255, 255, 255] },
    { name: 'Red',        color: '#d42030', rgb: [212,  32,  48] },
    { name: 'Black',      color: '#12121a', rgb: [ 18,  18,  26] },
    { name: 'Dark Green', color: '#006432', rgb: [  0, 100,  50] },
    { name: 'Dark Blue',  color: '#003296', rgb: [  0,  50, 150] },
    { name: 'Yellow',     color: '#ffd200', rgb: [255, 210,   0] }
  ];

  // ── K-M colour mixing ──
  function toKM(rgb) {
    return [Math.sqrt(rgb[0] / 255), Math.sqrt(rgb[1] / 255), Math.sqrt(rgb[2] / 255)];
  }
  function fromKM(km) {
    return [
      Math.min(255, Math.round(km[0] * km[0] * 255)),
      Math.min(255, Math.round(km[1] * km[1] * 255)),
      Math.min(255, Math.round(km[2] * km[2] * 255))
    ];
  }

  function findMix(targetRgb) {
    var n = BASES.length;
    var target = toKM(targetRgb);
    var bkm = [];
    var i, j;
    for (i = 0; i < n; i++) bkm.push(toKM(BASES[i].rgb));
    var w = [];
    for (i = 0; i < n; i++) w.push(1 / n);
    for (var iter = 0; iter < 400; iter++) {
      var cur = [0, 0, 0], s = 0;
      for (j = 0; j < n; j++) {
        cur[0] += w[j] * bkm[j][0];
        cur[1] += w[j] * bkm[j][1];
        cur[2] += w[j] * bkm[j][2];
      }
      for (j = 0; j < n; j++) {
        var g = 2 * (
          (cur[0] - target[0]) * bkm[j][0] +
          (cur[1] - target[1]) * bkm[j][1] +
          (cur[2] - target[2]) * bkm[j][2]
        );
        w[j] = Math.max(0, w[j] - 0.07 * g);
      }
      for (j = 0; j < n; j++) s += w[j];
      if (s > 0) for (j = 0; j < n; j++) w[j] /= s;
    }
    var s = 0;
    for (i = 0; i < n; i++) { if (w[i] < 0.02) w[i] = 0; else s += w[i]; }
    if (s > 0) for (i = 0; i < n; i++) w[i] /= s;
    return w;
  }

  function applyMix(weights) {
    var bkm = [];
    for (var i = 0; i < BASES.length; i++) bkm.push(toKM(BASES[i].rgb));
    var cur = [0, 0, 0];
    for (var j = 0; j < weights.length; j++) {
      cur[0] += weights[j] * bkm[j][0];
      cur[1] += weights[j] * bkm[j][1];
      cur[2] += weights[j] * bkm[j][2];
    }
    return fromKM(cur);
  }

  function colorDiff(a, b) {
    var dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function toHex(rgb) {
    return '#' +
      ('0' + rgb[0].toString(16)).slice(-2) +
      ('0' + rgb[1].toString(16)).slice(-2) +
      ('0' + rgb[2].toString(16)).slice(-2);
  }
  function rgbStr(rgb) { return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'; }

  function generateText(parts) {
    if (!parts.length) return 'Pick a colour to see your recipe.';
    if (parts.length === 1) return 'Use ' + parts[0].name + ' straight from the tube — no mixing needed.';
    var main = parts[0];
    var rest = parts.slice(1);
    function por(ratio) {
      if (ratio < 1.4) return 'an equal amount of';
      if (ratio < 2.5) return 'about half as much';
      if (ratio < 5)   return 'a small touch of';
      return 'a tiny trace of';
    }
    var t = 'Start with ' + main.name + ' as your base';
    if (rest.length === 1) {
      t += ', then add ' + por(main.w / rest[0].w) + ' ' + rest[0].name + '.';
    } else {
      t += '. Add ';
      for (var i = 0; i < rest.length; i++) {
        t += por(main.w / rest[i].w) + ' ' + rest[i].name;
        if (i < rest.length - 2) t += ', ';
        else if (i === rest.length - 2) t += ', and ';
      }
      t += '.';
    }
    return t;
  }

  // ── Hex wheel ──
  var SQRT3 = Math.sqrt(3);
  var HEX_RINGS = 6;
  var HEX_SIZE = 11;    // circumradius (center to vertex)
  var HEX_CX = 130;     // wheel center x on canvas
  var HEX_CY = 126;     // wheel center y on canvas
  var GRAY_Y = 265;     // grayscale strip y
  var GRAY_N = 9;       // number of grayscale cells

  var hexGrid = [];
  var grayGrid = [];
  var pickerRgb = [212, 150, 80];
  var initialized = false;
  var drag = false;

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r, g, b;
    if      (h < 60)  { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    return [
      Math.min(255, Math.max(0, Math.round((r + m) * 255))),
      Math.min(255, Math.max(0, Math.round((g + m) * 255))),
      Math.min(255, Math.max(0, Math.round((b + m) * 255)))
    ];
  }

  function buildGrids() {
    hexGrid = [];
    for (var q = -HEX_RINGS; q <= HEX_RINGS; q++) {
      var r1 = Math.max(-HEX_RINGS, -q - HEX_RINGS);
      var r2 = Math.min(HEX_RINGS, -q + HEX_RINGS);
      for (var r = r1; r <= r2; r++) {
        var px = HEX_CX + HEX_SIZE * (SQRT3 * q + SQRT3 / 2 * r);
        var py = HEX_CY + HEX_SIZE * (3 / 2 * r);
        var dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
        var rgb;
        if (dist === 0) {
          rgb = [255, 255, 255];
        } else {
          // Angle determines hue; use pixel offset from center
          var angle = Math.atan2(py - HEX_CY, px - HEX_CX);
          var hue = ((angle / (Math.PI * 2) + 1) % 1) * 360;
          var t = dist / HEX_RINGS;
          // Bottom area (positive r) gets darker
          var vert = r / HEX_RINGS;
          var baseLight = 1.0 - t * 0.5;
          var darkening = Math.max(0, vert) * 0.32;
          var light = Math.max(0.05, Math.min(0.98, baseLight - darkening));
          var sat = t;
          rgb = hslToRgb(hue, sat, light);
        }
        hexGrid.push({ q: q, r: r, px: px, py: py, rgb: rgb });
      }
    }

    // Grayscale strip: white → black
    grayGrid = [];
    var totalW = (GRAY_N - 1) * HEX_SIZE * SQRT3;
    var gx0 = HEX_CX - totalW / 2;
    for (var i = 0; i < GRAY_N; i++) {
      var v = Math.round((1 - i / (GRAY_N - 1)) * 255);
      grayGrid.push({ px: gx0 + i * HEX_SIZE * SQRT3, py: GRAY_Y, rgb: [v, v, v] });
    }
  }

  function drawHexCell(ctx, px, py, rgb, selected) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 3 * i - Math.PI / 6;
      var vx = px + (HEX_SIZE - 1.2) * Math.cos(a);
      var vy = py + (HEX_SIZE - 1.2) * Math.sin(a);
      if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawWheel() {
    var cv = document.getElementById('hexCanvas');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);

    hexGrid.forEach(function (cell) {
      var sel = cell.rgb[0] === pickerRgb[0] && cell.rgb[1] === pickerRgb[1] && cell.rgb[2] === pickerRgb[2];
      drawHexCell(ctx, cell.px, cell.py, cell.rgb, sel);
    });

    grayGrid.forEach(function (cell) {
      var sel = cell.rgb[0] === pickerRgb[0] && cell.rgb[1] === pickerRgb[1] && cell.rgb[2] === pickerRgb[2];
      drawHexCell(ctx, cell.px, cell.py, cell.rgb, sel);
    });
  }

  function hexRound(q, r) {
    var s = -q - r;
    var rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
    var dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    return { q: rq, r: rr };
  }

  function pickAtPixel(px, py) {
    // Check grayscale strip first
    for (var i = 0; i < grayGrid.length; i++) {
      var g = grayGrid[i];
      var dx = px - g.px, dy = py - g.py;
      if (dx * dx + dy * dy < HEX_SIZE * HEX_SIZE) return g.rgb;
    }
    // Convert pixel to fractional axial
    var dpx = px - HEX_CX, dpy = py - HEX_CY;
    var fq = (SQRT3 / 3 * dpx - 1 / 3 * dpy) / HEX_SIZE;
    var fr = (2 / 3 * dpy) / HEX_SIZE;
    var c = hexRound(fq, fr);
    var dist = Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r));
    if (dist > HEX_RINGS) return null;
    for (var j = 0; j < hexGrid.length; j++) {
      if (hexGrid[j].q === c.q && hexGrid[j].r === c.r) return hexGrid[j].rgb;
    }
    return null;
  }

  function updateColor(rgb) {
    pickerRgb = rgb;
    var weights = findMix(rgb);
    var achieved = applyMix(weights);
    var diff = colorDiff(rgb, achieved);

    var selColor = document.getElementById('selColor');
    var achColor = document.getElementById('achColor');
    if (selColor) selColor.style.background = rgbStr(rgb);
    if (achColor) achColor.style.background = rgbStr(achieved);

    var selHex = document.getElementById('selHex');
    var achHex = document.getElementById('achHex');
    if (selHex) selHex.textContent = toHex(rgb);
    if (achHex) achHex.textContent = toHex(achieved);

    var chip = document.getElementById('matchChip');
    if (chip) {
      chip.style.display = '';
      if (diff < 28)      { chip.className = 'match-chip great';  chip.textContent = 'Excellent match'; }
      else if (diff < 65) { chip.className = 'match-chip good';   chip.textContent = 'Good approximation'; }
      else                { chip.className = 'match-chip approx'; chip.textContent = 'Closest achievable'; }
    }

    var parts = [];
    for (var i = 0; i < BASES.length; i++) {
      if (weights[i] > 0.01) parts.push({ name: BASES[i].name, color: BASES[i].color, w: weights[i] });
    }
    parts.sort(function (a, b) { return b.w - a.w; });

    var rt = document.getElementById('recipeText');
    if (rt) rt.textContent = generateText(parts);

    var bars = document.getElementById('recipeBars');
    if (bars) {
      bars.innerHTML = '';
      for (var k = 0; k < BASES.length; k++) {
        var pct = Math.round(weights[k] * 100);
        if (pct < 1) continue;
        var isLight = (BASES[k].rgb[0] > 200 && BASES[k].rgb[1] > 180);
        var row = document.createElement('div');
        row.className = 'recipe-bar-row';
        row.innerHTML =
          '<div class="rbd" style="background:' + BASES[k].color + ';' + (isLight ? 'border-color:#bbb' : '') + '"></div>' +
          '<span class="rbn">' + BASES[k].name + '</span>' +
          '<div class="rbt"><div class="rbf" style="width:' + pct + '%;background:' + BASES[k].color + '"></div></div>' +
          '<span class="rbp">' + pct + '%</span>';
        bars.appendChild(row);
      }
    }

    var note = document.getElementById('recipeNote');
    if (note) {
      if (diff > 45) {
        note.textContent = 'Tip: the six kit paints cover warm, earthy, and neutral tones best. Bright cyan, vivid magenta, and pure violet fall outside their mixing range — this is the closest achievable blend.';
        note.style.display = '';
      } else {
        note.style.display = 'none';
      }
    }

    drawWheel();
  }

  window.initMixer = function () {
    if (initialized) { drawWheel(); return; }
    initialized = true;

    var cv = document.getElementById('hexCanvas');
    if (!cv) return;

    buildGrids();

    function getPos(e) {
      var rect = cv.getBoundingClientRect();
      var scaleX = cv.width / rect.width;
      var scaleY = cv.height / rect.height;
      var cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      var cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      return { x: cx * scaleX, y: cy * scaleY };
    }

    function handlePick(e) {
      var pos = getPos(e);
      var rgb = pickAtPixel(pos.x, pos.y);
      if (rgb) updateColor(rgb.slice());
    }

    cv.addEventListener('mousedown', function (e) { drag = true; handlePick(e); });
    cv.addEventListener('touchstart', function (e) { e.preventDefault(); drag = true; handlePick(e); }, { passive: false });
    cv.addEventListener('touchmove', function (e) { e.preventDefault(); if (drag) handlePick(e); }, { passive: false });
    cv.addEventListener('touchend', function () { drag = false; });
    document.addEventListener('mousemove', function (e) { if (drag) handlePick(e); });
    document.addEventListener('mouseup', function () { drag = false; });

    updateColor(pickerRgb.slice());
  };
})();
