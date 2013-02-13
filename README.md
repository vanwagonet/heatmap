heatmap
=======

Component for a semi-opaque heatmap drawn with canvas.

```javascript
var Heatmap = require('heatmap'),
	data = [
		{ x:0, y:0, value:75 },
		{ x:5, y:1, value:67 },
		...
	],
	heatmap = new Heatmap(canvas, data);

// new keyword not necessary, pass in options
heatmap = require('heatmap')(canvas, data, {
	maxValue: 100, // default max value in data, the max (hottest) possible value
	radius: 5, // default 0, the inner radius of each point's impact gradient (in css pixels)
	impact: 30, // default min(canvas.width, canvas.height) * .05, the outer radius of each point's impact gradient (in css pixels)
	maxHeat: .8, // default .5, how hot (between 0 and 1) the max value is, higher values make clusters hotter
	color: function(value) { // (value:int 0-255) -> [ red:int 0-255, green:int 0-255, blue:int 0-255, alpha:int 0-255 ]
		var rgb = hsl2rgb(255 - value, .9, .5),
			r = rgba[0], g = rgba[1], b = rgba[2],
			a = .2 + (value / 255 * .8);
		return [ r * 255, g * 255, b * 255, a * 255 ];
	}
});

// update the data set for an existing heatmap
//  only need to pass the the changed points
heatmap.update([ { x:0, y:0, value:78 } ]);
```

