/**
 * Markers plugin
 *
 * This feature allows you to add Visual Cues in the progress time rail.
 * This plugin also lets you register a custom callback function that will be called every time the play position reaches a marker.
 * Marker position and a reference to the MediaElement Player object is passed to the registered callback function for
 * any post processing. Marker color is configurable.
 */
(($ => {

	// Feature configuration
	$.extend(mejs.MepDefaults, {
		/**
		 * Default marker color
		 * @type {String}
		 */
		markerColor: '#E9BC3D',
		/**
		 * @type {Number[]}
		 */
		markers: [],
		/**
		 * @type {Function}
		 */
		markerCallback() {
		}
	});

	$.extend(MediaElementPlayer.prototype, {
		/**
		 * Feature constructor.
		 *
		 * Always has to be prefixed with `build` and the name that will be used in MepDefaults.features list
		 * @param {MediaElementPlayer} player
		 * @param {$} controls
		 * @param {$} layers
		 * @param {HTMLElement} media
		 */
		buildmarkers(player, controls, layers, media) {
			const t = this; //Prevents successive firing of callbacks
			let i = 0;
			let currentPos = -1;
			let currentMarker = -1;

			let //Track backward seek
				lastPlayPos = -1;

			let lastMarkerCallBack = -1;

			for (i = 0; i < player.options.markers.length; ++i) {
				controls.find('.mejs-time-total').append('<span class="mejs-time-marker"></span>');
			}

			media.addEventListener('durationchange', e => {
				player.setMarkers(controls);
			});
			media.addEventListener('timeupdate', e => {
				currentPos = Math.floor(media.currentTime);
				if (lastPlayPos > currentPos) {
					if (lastMarkerCallBack > currentPos) {
						lastMarkerCallBack = -1;
					}
				} else {
					lastPlayPos = currentPos;
				}

				for (i = 0; i < player.options.markers.length; ++i) {
					currentMarker = Math.floor(player.options.markers[i]);
					if (currentPos === currentMarker && currentMarker !== lastMarkerCallBack) {
						player.options.markerCallback(media, media.currentTime); //Fires the callback function
						lastMarkerCallBack = currentMarker;
					}
				}

			}, false);
		},
		/**
		 * Create markers in the progress bar
		 *
		 * @param {$} controls
		 */
		setMarkers(controls) {
			const t = this;
			let i = 0;
			let left;

			for (i = 0; i < t.options.markers.length; ++i) {
				if (Math.floor(t.options.markers[i]) <= t.media.duration && Math.floor(t.options.markers[i]) >= 0) {
					left = 100 * Math.floor(t.options.markers[i]) / t.media.duration;
					$(controls.find('.mejs-time-marker')[i]).css({
						"width": "1px",
						"left": `${left}%`,
						"background": t.options.markerColor
					});
				}
			}
		}
	});

}))(mejs.$);