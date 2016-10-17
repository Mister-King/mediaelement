/**
 * Skip back button
 *
 * This feature creates a button to rewind media a specific number of seconds.
 */
(($ => {

	// Feature configuration
	$.extend(mejs.MepDefaults, {
		/**
		 * @type {Number}
		 */
		skipBackInterval: 30,
		/**
		 * @type {String}
		 */
		skipBackText: ''
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
		buildskipback(player, controls, layers, media) {
			const t = this;
			const defaultTitle = mejs.i18n.t('mejs.time-skip-back', t.options.skipBackInterval);
			const skipTitle = t.options.skipBackText ? t.options.skipBackText.replace('%1', t.options.skipBackInterval) : defaultTitle;

			const // create the loop button
				loop =
					$(`<div class="mejs-button mejs-skip-back-button"><button type="button" aria-controls="${t.id}" title="${skipTitle}" aria-label="${skipTitle}">${t.options.skipBackInterval}</button></div>`)
					// append it to the toolbar
					.appendTo(controls)
					// add a click toggle event
					.click(function () {
						if (media.duration) {
							media.setCurrentTime(Math.max(media.currentTime - t.options.skipBackInterval, 0));
							$(this).find('button').blur();
						}
					});
		}
	});

}))(mejs.$);
