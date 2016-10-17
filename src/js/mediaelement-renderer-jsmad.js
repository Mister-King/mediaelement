/**
 * JSMad renderer
 *
 * It expands the original player using JSMad library to decode audio `mp3` media.
 * @see https://github.com/fasterthanlime/jsmad
 */
(((win, doc, mejs, undefined) => {

	const JsMadRenderer = {
		name: 'jsmad',

		options: null,
		/**
		 * Determine if a specific element type can be played with this render
		 *
		 * @param {String} type
		 * @return {Array}
		 */
		canPlayType(type) {
			const doesThisWork = true;
			const supportedMediaTypes = ['audio/mp3'];

			if (doesThisWork) {
				return supportedMediaTypes;
			} else {
				return [];
			}
		},
		/**
		 * Create the player instance and add all native events/methods/properties as possible
		 *
		 * @param {MediaElement} mediaElement Instance of mejs.MediaElement already created
		 * @param {Object} options All the player configuration options passed through constructor
		 * @param {Object[]} mediaFiles List of sources with format: {src: url, type: x/y-z}
		 * @return {Object}
		 */
		create(mediaElement, options, mediaFiles) {
			const jsmad = {};
			let i;
			let il;

			jsmad.id = `${mediaElement.id}_jsmad`;
			jsmad.options = options;
			jsmad.mediaElement = mediaElement;

			// stack to fire when ready
			jsmad.apiStack = [];

			// JSMAD player
			jsmad.jsMad = null;

			jsmad.loadSrc = filename => {

				console.log('create JSMAD', filename);

				new Mad.Player.fromURL( filename, player => {
					//self.usePlayer( player );

					console.log('JS MAD', 'loaded player', player);

					jsmad.jsMad = player;

					jsmad.jsMad.onPlay = () => {
						mediaElement.dispatchEvent('play');
					};
					jsmad.jsMad.onPause = () => {
						mediaElement.dispatchEvent('pause');
					};
					jsmad.jsMad.onProgress = (current, total, preload) => {
						//t.wrapper.dispatchEvent('progress');
						mediaElement.dispatchEvent('timeupdate');

						jsmad.jsMad.currentTime = current;
						jsmad.jsMad.duration = total;
					};

					jsmad.jsMad.createDevice();

					mediaElement.dispatchEvent('ready');

					// do call stack
					for (let i=0, il=t.apiStack.length; i<il; i++) {

						const stackItem = t.apiStack[i];

						console.log('stack', stackItem.type);

						if (stackItem.type === 'set') {
							jsmad[stackItem.propName] = stackItem.value;
						} else if (stackItem.type === 'call') {
							jsmad[stackItem.methodName]();
						}
					}

				});
			};

			// wrappers for get/set
			const props = mejs.html5media.properties;

			const assignGettersSetters = propName => {

				const capName = propName.substring(0,1).toUpperCase() + propName.substring(1);

				jsmad[`get${capName}`] = () => {

					let value = null;

					if (jsmad.jsMad !== null) {
						switch (propName) {
							case 'paused':
								value = !jsmad.jsMad.playing;
								break;
							case 'currentTime':
								value = jsmad.jsMad.currentTime;
								break;
							case 'duration':
								value = jsmad.jsMad.duration;
								break;
							default:
								break;
						}

					}

					console.log(`[JSMAD get]: ${propName}`, jsmad.jsMad, value);

					return value;
				};

				jsmad[`set${capName}`] = value => {

					console.log(`[JSMAD set]: ${propName} = ${value}`);

					if (propName === 'src') {

						jsmad.loadSrc(value);

					} else {

						if (t.jsMad !== null) {
							// do stuff here
							console.log('JSMAD TODO', 'SET', propName);
						} else {
							jsmad.apiStack.push({type: 'set', propName, value});
						}
					}
				};

			};

			for (i=0, il=props.length; i<il; i++) {
				assignGettersSetters(props[i]);
			}

			// add wrappers for native methods
			const methods = mejs.html5media.methods;

			const assignMethods = methodName => {

				// run the method on the native HTMLMediaElement
				jsmad[methodName] = () => {

					console.log(`[JSMAD ${methodName}()]`, jsmad.jsMad);

					if (jsmad.jsMad !== null) {

						switch (methodName) {
							case 'play':
								console.log('[JSMAD setPlaying(true)', jsmad.jsMad);

								jsmad.jsMad.setPlaying(true);
								break;
							case 'pause':
								jsmad.jsMad.setPlaying(false);
								break;

							default:
							case 'load':

								break;
						}
					} else {

						jsmad.apiStack.push({type: 'call', methodName});
					}

				};

			};

			for (i=0, il=methods.length; i<il; i++) {
				assignMethods(methods[i]);
			}

			jsmad.show = () => {};
			jsmad.hide = () => {};

			if (mediaFiles && mediaFiles.length > 0) {
				jsmad.loadSrc(mediaFiles[0].src);
			}

			return jsmad;
		}
	};

	mejs.Renderers.add(JsMadRenderer);

}))(window, document, window.mejs || {});