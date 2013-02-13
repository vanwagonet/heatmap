/**
 * Draws a heatmap on a canvas
 *
 * @param {Canvas} canvas - required
 * @param {Array|Object} data - optional, array containing values to draw as heatmap
 *   each entry should be an object of the form { x:Number, y:Number, value:Number }
 * @param {Object} options - optional
 *   maxValue = default max value in data, the max (hottest) possible value
 *   radius - default 0, the inner radius of each point's impact gradient
 *   impact - default Math.min(canvas.width, canvas.height) * .05, the outer radius of each point's impact gradient
 *   maxHeat = default .5, how hot (between 0 and 1) the max value is, higher values make clusters hotter
 *   color - function (value:int 0-255) -> [ red:int 0-255, green:int 0-255, blue:int 0-255, alpha:int 0-255 ]
 * @return {Canvas}
 * @api public
 **/
'use strict';
function heatmap(canvas, data, options) {
	if (!(this instanceof heatmap)) { return new heatmap(canvas, data, options); }
	this.canvas = canvas;
	this.data = [];
	this.data.length = canvas.width * canvas.height; // pre-allocate data value store

	// build out options, including the color function
	this.options = (options = options || {});
	this.maxValue = options.maxValue || 0;
	this.radius = options.radius || 0;
	this.impact = options.impact || Math.max(canvas.width, canvas.height) * .05;
	this.maxHeat = options.maxHeat || .5;
	if (options.color) { this.color = options.color; }

	this.colorCache = [];
	this.colorCache.length = 256; // pre-allocate max number of unique colors;

	this.maskvas = canvas.cloneNode(false); // alpha mask canvas
	this.maskvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

	return this.update(data);
}

heatmap.prototype = {
	update: function(data) { // create mask
		data = this.dataToDelta(data);
		var canvas = this.maskvas, context = canvas.getContext('2d'),
			radius = this.radius, impact = this.impact,
			max = this.maxValue, maxHeat = this.maxHeat,
			grad, offset = Math.max(radius, impact), size = offset * 2,
			d, dd = data.length, datum, x, y;

		for (d = 0; d < dd; ++d) {
			datum = data[d], x = datum.x, y = datum.y;
			context.globalAlpha = (datum.value / max) * maxHeat;
			grad = context.createRadialGradient(x, y, radius, x, y, impact);
			grad.addColorStop(0, 'black');
			grad.addColorStop(1, 'transparent');
			context.fillStyle = grad;
			context.fillRect(x - offset, y - offset, size, size);
		}

		return this.render();
	},

	render: function() { // color pixels from alpha values
		var canvas = this.maskvas, context = canvas.getContext('2d'),
			mask = context.getImageData(0, 0, canvas.width, canvas.height),
			mdata = mask.data, m, mm = mdata.length, value, rgba, colors = this.colorCache,
			badAlpha = this.checkPremultiply(), color = this.color;

		for (m = 0; m < mm; m += 4) {
			value = mdata[m+3];
			if (!colors[value]) {
				rgba = colors[value] = color(value);
				if (badAlpha) {
					rgba[0] *= (rgba[3] / 255);
					rgba[1] *= (rgba[3] / 255);
					rgba[2] *= (rgba[3] / 255);
				}
			}
			rgba = colors[value];
			mdata[m] = rgba[0];
			mdata[m+1] = rgba[1];
			mdata[m+2] = rgba[2];
			mdata[m+3] = rgba[3];
		}

		// put colored pixels into image
		canvas = this.canvas; context = canvas.getContext('2d');
		context.putImageData(mask, 0, 0);
		return this;
	},

	color: function(value) {
		var h = (1 - value / 255) * (270 / 360), // hue
			s = 0.94737, v = 0.95, // saturation, value
			a = 0.1 + (value / 255 * 0.9), // alpha

			r, g, b, // convert to rgb
			i = ~~(h * 6),
			f = h * 6 - i,
			p = v * (1 - s),
			q = v * (1 - f * s),
			t = v * (1 - (1 - f) * s);
		switch (i % 6) {
			case 0: r = v, g = t, b = p; break;
			case 1: r = q, g = v, b = p; break;
			case 2: r = p, g = v, b = t; break;
			case 3: r = p, g = q, b = v; break;
			case 4: r = t, g = p, b = v; break;
			case 5: r = v, g = p, b = q; break;
		}

		return [ r * 255, g * 255, b * 255, a * 255 ];
	},

	checkPremultiply: function check() {
		if ('memo' in check) { return check.memo; }
		var canvas = this.canvas.cloneNode(false);
		canvas.width = canvas.height = 1;
		var context = canvas.getContext('2d'),
			pixel = context.getImageData(0, 0, 1, 1),
			pdata = pixel.data;
		pdata[0] = pdata[1] = pdata[2] = pdata[3] = 64; // rgba(64,64,64,.25)
		context.putImageData(pixel, 0, 0);
		pixel = context.getImageData(0, 0, 1, 1); pdata = pixel.data;
		return check.memo = (pdata[0] > 70 || pdata[0] < 60);
	},

	// calculate the correct value to make up the difference since
	dataToDelta: function(data) {
		data = data || [];
		var max = this.maxValue, pmax = max, delta = [], saved = this.data,
			d, dd = data.length, datum, i, ii, width = this.canvas.width,
			prev, value, reset = false;
		for (d = 0; d < dd; ++d) {
			datum = data[d]; value = datum.value;
			prev = saved[i = datum.y * width + datum.x];
			if ((saved[i] = value) < prev) { reset = true; }
			if (value > max) { max = value; }
			delta[d] = { x:datum.x, y:datum.y, value:value - prev };
		}

		this.maxValue = this.options.maxValue || max; // preserve option, if it was passed in

		if (reset || pmax !== this.maxValue) { // max changed, or subtracted values, redraw everything
			this.maskvas.getContext('2d').clearRect(0, 0, width, this.maskvas.height);
			delta = [];
			for (i = 0, ii = saved.length; i < ii; ++i) {
				if (saved[i]) { delta.push({ x:i % width, y:~~(i / width), value:saved[i] }); }
			}
		}

		return delta;
	}
};

module.exports = heatmap;

