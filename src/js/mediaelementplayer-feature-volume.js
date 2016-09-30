/**
 * Volume button
 *
 * This feature enables the displaying of a Volume button in the control bar, and also contains logic to manipulate its
 * events, such as sliding up/down (or left/right, if vertical), muting/unmuting media, etc.
 */
(($ => {

	// Feature configuration
	$.extend(mejs.MepDefaults, {
		/**
		 * @type {String}
		 */
		muteText: mejs.i18n.t('mejs.mute-toggle'),
		/**
		 * @type {String}
		 */
		allyVolumeControlText: mejs.i18n.t('mejs.volume-help-text'),
		/**
		 * @type {Boolean}
		 */
		hideVolumeOnTouchDevices: true,
		/**
		 * @type {String}
		 */
		audioVolume: 'horizontal',
		/**
		 * @type {String}
		 */
		videoVolume: 'vertical'
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
		 * @public
		 */
		buildvolume(player, controls, layers, media) {
			// Android and iOS don't support volume controls
			if ((mejs.MediaFeatures.isAndroid || mejs.MediaFeatures.isiOS) && this.options.hideVolumeOnTouchDevices)
				return;

			const t = this;
			const mode = (t.isVideo) ? t.options.videoVolume : t.options.audioVolume;

			const mute = (mode === 'horizontal') ?

				// horizontal version
				$(`<div class="mejs-button mejs-volume-button mejs-mute"><button type="button" aria-controls="${t.id}" title="${t.options.muteText}" aria-label="${t.options.muteText}"></button></div><a href="javascript:void(0);" class="mejs-horizontal-volume-slider"><span class="mejs-offscreen">${t.options.allyVolumeControlText}</span><div class="mejs-horizontal-volume-total"></div><div class="mejs-horizontal-volume-current"></div><div class="mejs-horizontal-volume-handle"></div></a>`
				)
				.appendTo(controls) :

				// vertical version
				$(`<div class="mejs-button mejs-volume-button mejs-mute"><button type="button" aria-controls="${t.id}" title="${t.options.muteText}" aria-label="${t.options.muteText}"></button><a href="javascript:void(0);" class="mejs-volume-slider"><span class="mejs-offscreen">${t.options.allyVolumeControlText}</span><div class="mejs-volume-total"></div><div class="mejs-volume-current"></div><div class="mejs-volume-handle"></div></a></div>`)
				.appendTo(controls);

			const volumeSlider = t.container.find('.mejs-volume-slider, .mejs-horizontal-volume-slider');
			const volumeTotal = t.container.find('.mejs-volume-total, .mejs-horizontal-volume-total');
			const volumeCurrent = t.container.find('.mejs-volume-current, .mejs-horizontal-volume-current');
			const volumeHandle = t.container.find('.mejs-volume-handle, .mejs-horizontal-volume-handle');

			const /**
			 * @private
			 * @param {Number} volume
			 * @param {Boolean} secondTry
			 */
			positionVolumeHandle = (volume, secondTry) => {

				if (!volumeSlider.is(':visible') && typeof secondTry === 'undefined') {
					volumeSlider.show();
					positionVolumeHandle(volume, true);
					volumeSlider.hide();
					return;
				}

				// correct to 0-1
				volume = Math.max(0, volume);
				volume = Math.min(volume, 1);

				// adjust mute button style
				if (volume === 0) {
					mute.removeClass('mejs-mute').addClass('mejs-unmute');
					mute.children('button').attr('title', mejs.i18n.t('mejs.unmute')).attr('aria-label', mejs.i18n.t('mejs.unmute'));
				} else {
					mute.removeClass('mejs-unmute').addClass('mejs-mute');
					mute.children('button').attr('title', mejs.i18n.t('mejs.mute')).attr('aria-label', mejs.i18n.t('mejs.mute'));
				}

				// top/left of full size volume slider background
				const totalPosition = volumeTotal.position();

				// position slider
				if (mode === 'vertical') {
					const // height of the full size volume slider background
						totalHeight = volumeTotal.height();

					const // the new top position based on the current volume
						// 70% volume on 100px height == top:30px
						newTop = totalHeight - (totalHeight * volume);

					// handle
					volumeHandle.css('top', Math.round(totalPosition.top + newTop - (volumeHandle.height() / 2)));

					// show the current visibility
					volumeCurrent.height(totalHeight - newTop);
					volumeCurrent.css('top', totalPosition.top + newTop);
				} else {
					const // height of the full size volume slider background
						totalWidth = volumeTotal.width();

					const // the new left position based on the current volume
						newLeft = totalWidth * volume;

					// handle
					volumeHandle.css('left', Math.round(totalPosition.left + newLeft - (volumeHandle.width() / 2)));

					// resize the current part of the volume bar
					volumeCurrent.width(Math.round(newLeft));
				}
			};

			const /**
			 * @private
			 */
			handleVolumeMove = () => {
				let volume = null;
				const totalOffset = volumeTotal.offset();

				// calculate the new volume based on the most recent position
				if (mode === 'vertical') {
					const railHeight = volumeTotal.height();
					const newY = e.pageY - totalOffset.top;

					volume = (railHeight - newY) / railHeight;

					// the controls just hide themselves (usually when mouse moves too far up)
					if (totalOffset.top === 0 || totalOffset.left === 0) {
						return;
					}
				} else {
					const railWidth = volumeTotal.width();
					const newX = e.pageX - totalOffset.left;

					volume = newX / railWidth;
				}

				// ensure the volume isn't outside 0-1
				volume = Math.max(0, volume);
				volume = Math.min(volume, 1);

				// position the slider and handle
				positionVolumeHandle(volume);

				// set the media object (this will trigger the `volumechanged` event)
				if (volume === 0) {
					media.setMuted(true);
				} else {
					media.setMuted(false);
				}
				media.setVolume(volume);
			};

			let mouseIsDown = false;
			let mouseIsOver = false;

			// SLIDER
			mute.hover(() => {
				volumeSlider.show();
				mouseIsOver = true;
			}, () => {
				mouseIsOver = false;

				if (!mouseIsDown && mode === 'vertical') {
					volumeSlider.hide();
				}
			});

			/**
			 * @private
			 */
			const updateVolumeSlider = () => {

				const volume = Math.floor(media.volume * 100);

				volumeSlider.attr({
					'aria-label': mejs.i18n.t('mejs.volume-slider'),
					'aria-valuemin': 0,
					'aria-valuemax': 100,
					'aria-valuenow': volume,
					'aria-valuetext': `${volume}%`,
					'role': 'slider',
					'tabindex': 0
				});

			};

			// Events
			volumeSlider
			.bind('mouseover', () => {
				mouseIsOver = true;
			})
			.bind('mousedown', () => {
				handleVolumeMove();
				t.globalBind('mousemove.vol', () => {
					handleVolumeMove();
				});
				t.globalBind('mouseup.vol', () => {
					mouseIsDown = false;
					t.globalUnbind('.vol');

					if (!mouseIsOver && mode === 'vertical') {
						volumeSlider.hide();
					}
				});
				mouseIsDown = true;

				return false;
			})
			.bind('keydown', e => {
				const keyCode = e.keyCode;
				let volume = media.volume;
				switch (keyCode) {
					case 38: // Up
						volume = Math.min(volume + 0.1, 1);
						break;
					case 40: // Down
						volume = Math.max(0, volume - 0.1);
						break;
					default:
						return true;
				}

				mouseIsDown = false;
				positionVolumeHandle(volume);
				media.setVolume(volume);
				return false;
			});

			// MUTE button
			mute.find('button').click(() => {
				media.setMuted(!media.muted);
			});

			//Keyboard input
			mute.find('button').bind('focus', () => {
				volumeSlider.show();
			});

			// listen for volume change events from other sources
			media.addEventListener('volumechange', e => {
				if (!mouseIsDown) {
					if (media.muted) {
						positionVolumeHandle(0);
						mute.removeClass('mejs-mute').addClass('mejs-unmute');
					} else {
						positionVolumeHandle(media.volume);
						mute.removeClass('mejs-unmute').addClass('mejs-mute');
					}
				}
				updateVolumeSlider(e);
			}, false);

			// mutes the media and sets the volume icon muted if the initial volume is set to 0
			if (player.options.startVolume === 0) {
				media.setMuted(true);
			}

			// shim gets the startvolume as a parameter, but we have to set it on the native <video> and <audio> elements
			const isNative = t.media.id.match(/(native|html5)/);

			if (isNative) {
				media.setVolume(player.options.startVolume);
			}

			t.container.on('controlsresize', () => {
				if (media.muted) {
					positionVolumeHandle(0);
					mute.removeClass('mejs-mute').addClass('mejs-unmute');
				} else {
					positionVolumeHandle(media.volume);
					mute.removeClass('mejs-unmute').addClass('mejs-mute');
				}
			});
		}
	});

}))(mejs.$);
