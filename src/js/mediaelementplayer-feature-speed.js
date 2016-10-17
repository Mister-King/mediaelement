/**
 * Speed button
 *
 * This feature creates a button to speed media in different levels.
 */
(($ => {

	// Feature configuration
	$.extend(mejs.MepDefaults, {
		/**
		 * The speeds media can be accelerated
		 *
		 * Supports an array of float values or objects with format
		 * [{name: 'Slow', value: '0.75'}, {name: 'Normal', value: '1.00'}, ...]
		 * @type {{String[]|Object[]}}
		 */
		speeds: ['2.00', '1.50', '1.25', '1.00', '0.75'],
		/**
		 * @type {String}
		 */
		defaultSpeed: '1.00',
		/**
		 * @type {String}
		 */
		speedChar: 'x'

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
		buildspeed(player, controls, layers, media) {
			const t = this;
			const isNative = t.media.id.match(/(native|html5)/);

			if (!isNative) {
				return;
			}

			let speedButton = null;
			let speedSelector = null;
			let playbackSpeed = null;
			let inputId = null;

			const speeds = [];
			let defaultInArray = false;
			for (var i = 0, len = t.options.speeds.length; i < len; i++) {
				const s = t.options.speeds[i];
				if (typeof(s) === 'string') {
					speeds.push({
						name: s + t.options.speedChar,
						value: s
					});
					if (s === t.options.defaultSpeed) {
						defaultInArray = true;
					}
				}
				else {
					speeds.push(s);
					if (s.value === t.options.defaultSpeed) {
						defaultInArray = true;
					}
				}
			}

			if (!defaultInArray) {
				speeds.push({
					name: t.options.defaultSpeed + t.options.speedChar,
					value: t.options.defaultSpeed
				});
			}

			speeds.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));

			const getSpeedNameFromValue = value => {
				for (i = 0, len = speeds.length; i < len; i++) {
					if (speeds[i].value === value) {
						return speeds[i].name;
					}
				}
			};

			let html = `<div class="mejs-button mejs-speed-button"><button type="button">${getSpeedNameFromValue(t.options.defaultSpeed)}</button><div class="mejs-speed-selector"><ul>`;

			for (i = 0, il = speeds.length; i < il; i++) {
				inputId = `${t.id}-speed-${speeds[i].value}`;
				html += `<li><input type="radio" name="speed" value="${speeds[i].value}" id="${inputId}" ${speeds[i].value === t.options.defaultSpeed ? ' checked' : ''} /><label for="${inputId}" ${speeds[i].value === t.options.defaultSpeed ? ' class="mejs-speed-selected"' : ''}>${speeds[i].name}</label></li>`;
			}
			html += '</ul></div></div>';

			speedButton = $(html).appendTo(controls);
			speedSelector = speedButton.find('.mejs-speed-selector');

			playbackSpeed = t.options.defaultSpeed;

			media.addEventListener('loadedmetadata', e => {
				if (playbackSpeed) {
					media.playbackRate = parseFloat(playbackSpeed);
				}
			}, true);

			speedSelector.on('click', 'input[type="radio"]', function () {
				const newSpeed = $(this).attr('value');
				playbackSpeed = newSpeed;
				media.playbackRate = parseFloat(newSpeed);
				speedButton.find('button').html(getSpeedNameFromValue(newSpeed));
				speedButton.find('.mejs-speed-selected').removeClass('mejs-speed-selected');
				speedButton.find('input[type="radio"]:checked').next().addClass('mejs-speed-selected');
			});

			speedButton.one('mouseenter focusin', () => {
				speedSelector
				.height(
					speedButton.find('.mejs-speed-selector ul').outerHeight(true) +
					speedButton.find('.mejs-speed-translations').outerHeight(true))
				.css('top', `${-1 * speedSelector.height()}px`);
			});
		}
	});

}))(mejs.$);
