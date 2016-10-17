/**
 * Play/Pause button
 *
 * This feature enables the displaying of a Play button in the control bar, and also contains logic to toggle its state
 * between paused and playing.
 */
(($ => {

	// Feature configuration
	$.extend(mejs.MepDefaults, {
		/**
		 * @type {String}
		 */
		playText: '',
		/**
		 * @type {String}
		 */
		pauseText: ''
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
		buildplaypause(player, controls, layers, media) {
			const t = this;
			const op = t.options;
			const playTitle = op.playText ? op.playText : mejs.i18n.t('mejs.play');
			const pauseTitle = op.pauseText ? op.pauseText : mejs.i18n.t('mejs.pause');

			const play =
				$(`<div class="mejs-button mejs-playpause-button mejs-play" ><button type="button" aria-controls="${t.id}" title="${playTitle}" aria-label="${pauseTitle}"></button></div>`)
				.appendTo(controls)
				.click(e => {
					e.preventDefault();

					if (media.paused) {
						media.play();
					} else {
						media.pause();
					}

					return false;
				});

			const play_btn = play.find('button');


			/**
			 * @private
			 * @param {String} which - token to determine new state of button
			 */
			function togglePlayPause(which) {
				if ('play' === which) {
					play.removeClass('mejs-play').addClass('mejs-pause');
					play_btn.attr({
						'title': pauseTitle,
						'aria-label': pauseTitle
					});
				} else {
					play.removeClass('mejs-pause').addClass('mejs-play');
					play_btn.attr({
						'title': playTitle,
						'aria-label': playTitle
					});
				}
			}

			togglePlayPause('pse');

			media.addEventListener('play', () => {
				togglePlayPause('play');
			}, false);
			media.addEventListener('playing', () => {
				togglePlayPause('play');
			}, false);


			media.addEventListener('pause', () => {
				togglePlayPause('pse');
			}, false);
			media.addEventListener('paused', () => {
				togglePlayPause('pse');
			}, false);
		}
	});

}))(mejs.$);
