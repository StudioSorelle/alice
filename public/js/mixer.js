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

  var PW = 260, PH = 190, HH = 18;
  var pickerH = 200, pickerS = 0.65, pickerV = 0.72;
  var initialized = false, sqDrag = false, hueDrag = false;

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

    // Drop traces < 2 %
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

  // ── Canvas drawing ──
  function hsvToRgb(h, s, v) {
    var i = Math.floor(h / 60) % 6;
    var f = h / 60 - Math.floor(h / 60);
    var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    var sets = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]];
    var c = sets[i];
    return [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)];
  }

  function drawSq() {
    var sq = document.getElementById('sqCanvas');
    if (!sq) return;
    var ctx = sq.getContext('2d');
    var gh = ctx.createLinearGradient(0, 0, PW, 0);
    gh.addColorStop(0, 'rgba(255,255,255,1)');
    gh.addColorStop(1, 'hsl(' + pickerH + ',100%,50%)');
    ctx.fillStyle = gh; ctx.fillRect(0, 0, PW, PH);
    var gv = ctx.createLinearGradient(0, 0, 0, PH);
    gv.addColorStop(0, 'rgba(0,0,0,0)');
    gv.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gv; ctx.fillRect(0, 0, PW, PH);
    // Cursor
    var cx = pickerS * PW, cy = (1 - pickerV) * PH;
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
  }

  function drawHue() {
    var hu = document.getElementById('hueCanvas');
    if (!hu) return;
    var ctx = hu.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, PW, 0);
    for (var i = 0; i <= 12; i++) g.addColorStop(i / 12, 'hsl(' + (i * 30) + ',100%,50%)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, PW, HH);
    // Cursor
    var hx = (pickerH / 360) * PW;
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(hx - 2, 0, 4, HH);
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.strokeRect(hx - 2, 0, 4, HH);
  }

  function getPos(e, el) {
    var r = el.getBoundingClientRect();
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    var cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - r.left, y: cy - r.top };
  }

  function onSq(e) {
    var sq = document.getElementById('sqCanvas');
    var p = getPos(e, sq);
    pickerS = Math.max(0, Math.min(1, p.x / PW));
    pickerV = Math.max(0, Math.min(1, 1 - p.y / PH));
    updateColor();
  }

  function onHue(e) {
    var hu = document.getElementById('hueCanvas');
    var p = getPos(e, hu);
    pickerH = Math.max(0, Math.min(359.9, (p.x / PW) * 360));
    updateColor();
  }

  function updateColor() {
    var rgb = hsvToRgb(pickerH, pickerS, pickerV);
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
      for (var i = 0; i < BASES.length; i++) {
        var pct = Math.round(weights[i] * 100);
        if (pct < 1) continue;
        var isLight = (BASES[i].rgb[0] > 200 && BASES[i].rgb[1] > 180);
        var row = document.createElement('div');
        row.className = 'recipe-bar-row';
        row.innerHTML =
          '<div class="rbd" style="background:' + BASES[i].color + ';' + (isLight ? 'border-color:#bbb' : '') + '"></div>' +
          '<span class="rbn">' + BASES[i].name + '</span>' +
          '<div class="rbt"><div class="rbf" style="width:' + pct + '%;background:' + BASES[i].color + '"></div></div>' +
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

    drawSq(); drawHue();
  }

  // ── Public init — called by app.js when mix view opens ──
  window.initMixer = function () {
    if (initialized) { updateColor(); return; }
    initialized = true;

    var sq = document.getElementById('sqCanvas');
    var hu = document.getElementById('hueCanvas');
    if (!sq || !hu) return;

    sq.addEventListener('mousedown', function (e) { sqDrag = true; onSq(e); });
    sq.addEventListener('touchstart', function (e) { e.preventDefault(); sqDrag = true; onSq(e); }, { passive: false });
    sq.addEventListener('touchmove', function (e) { e.preventDefault(); if (sqDrag) onSq(e); }, { passive: false });
    sq.addEventListener('touchend', function () { sqDrag = false; });

    hu.addEventListener('mousedown', function (e) { hueDrag = true; onHue(e); });
    hu.addEventListener('touchstart', function (e) { e.preventDefault(); hueDrag = true; onHue(e); }, { passive: false });
    hu.addEventListener('touchmove', function (e) { e.preventDefault(); if (hueDrag) onHue(e); }, { passive: false });
    hu.addEventListener('touchend', function () { hueDrag = false; });

    document.addEventListener('mousemove', function (e) {
      if (sqDrag) onSq(e);
      if (hueDrag) onHue(e);
    });
    document.addEventListener('mouseup', function () { sqDrag = false; hueDrag = false; });

    updateColor();
  };
})();
