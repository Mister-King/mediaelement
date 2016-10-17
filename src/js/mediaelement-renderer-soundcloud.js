/**
 * SoundCloud renderer
 *
 * Uses <iframe> approach and uses SoundCloud Widget API to manipulate it.
 * @see https://developers.soundcloud.com/docs/api/html5-widget
 */
(((win, doc, mejs, undefined) => {

	/**
	 * Register SoundCloud type based on URL structure
	 *
	 */
	mejs.Utils.typeChecks.push(url => {

		url = url.toLowerCase();

		if (url.includes('soundcloud.com')) {
			return 'video/soundcloud';
		} else {
			return null;
		}
	});

	const SoundCloudApi = {
		/**
		 * @type {Boolean}
		 */
		isSDKStarted: false,
		/**
		 * @type {Boolean}
		 */
		isSDKLoaded: false,
		/**
		 * @type {Array}
		 */
		iframeQueue: [],

		/**
		 * Create a queue to prepare the creation of <iframe>
		 *
		 * @param {Object} settings - an object with settings needed to create <iframe>
		 */
		enqueueIframe(settings) {

			if (this.isLoaded) {
				this.createIframe(settings);
			} else {
				this.loadIframeApi();
				this.iframeQueue.push(settings);
			}
		},

		/**
		 * Load SoundCloud API's script on the header of the document
		 *
		 */
		loadIframeApi() {
			if (!this.isSDKStarted) {
				// https://developers.soundcloud.com/docs/api/html5-widget#methods
				const head = doc.getElementsByTagName("head")[0] || document.documentElement;

				const script = doc.createElement("script");
				let done = false;

				script.src = 'https://w.soundcloud.com/player/api.js';

				// Attach handlers for all browsers
				script.onload = script.onreadystatechange = function () {
					if (!done && (!this.readyState || this.readyState === "loaded" || this.readyState === "complete")) {
						done = true;
						SoundCloudApi.apiReady();

						// Handle memory leak in IE
						script.onload = script.onreadystatechange = null;
						if (head && script.parentNode) {
							head.removeChild(script);
						}
					}
				};
				head.appendChild(script);
				this.isSDKStarted = true;
			}
		},

		/**
		 * Process queue of SoundCloud <iframe> element creation
		 *
		 */
		apiReady() {

			console.log('Soundcloud API Loaded');

			this.isLoaded = true;
			this.isSDKLoaded = true;

			while (this.iframeQueue.length > 0) {
				const settings = this.iframeQueue.pop();
				this.createIframe(settings);
			}
		},

		/**
		 * Create a new instance of SoundCloud Widget player and trigger a custom event to initialize it
		 *
		 * @param {Object} settings - an object with settings needed to create <iframe>
		 */
		createIframe(settings) {

			//console.log('creating iframe', settings);

			const player = SC.Widget(settings.iframe);
			win[`__ready__${settings.id}`](player);
		}
	};

	const SoundCloudIframeRenderer = {
		name: 'soundcloud_iframe',

		options: {
			prefix: 'soundcloud_iframe'
		},

		/**
		 * Determine if a specific element type can be played with this render
		 *
		 * @param {String} type
		 * @return {Boolean}
		 */
		canPlayType(type) {
			const mediaTypes = ['video/soundcloud', 'video/x-soundcloud'];

			return mediaTypes.includes(type);
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
			const sc = {};

			// store main variable
			sc.options = options;
			sc.id = `${mediaElement.id}_${options.prefix}`;
			sc.mediaElement = mediaElement;

			// create our fake element that allows events and such to work
			// insert data
			const apiStack = [];

			let scPlayerReady = false;
			let scPlayer = null;
			let scIframe = null;
			let currentTime = 0;
			let duration = 0;
			let bufferedTime = 0;
			let paused = true;
			const volume = 0;
			const muted = false;
			let ended = false;
			let i;
			let il;

			// wrappers for get/set
			const props = mejs.html5media.properties;

			const assignGettersSetters = propName => {

				// add to flash state that we will store

				const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

				sc[`get${capName}`] = () => {
					if (scPlayer !== null) {
						const value = null;

						// figure out how to get dm dta here
						switch (propName) {
							case 'currentTime':
								return currentTime;

							case 'duration':
								return duration;

							case 'volume':
								return volume;

							case 'paused':
								return paused;

							case 'ended':
								return ended;

							case 'muted':
								return muted; // ?

							case 'buffered':
								return {
									start() {
										return 0;
									},
									end() {
										return bufferedTime * duration;
									},
									length: 1
								};
							case 'src':
								return (scIframe) ? scIframe.src : '';
						}

						return value;
					} else {
						return null;
					}
				};

				sc[`set${capName}`] = value => {
					//console.log('[' + options.prefix + ' set]: ' + propName + ' = ' + value, t.flashApi);

					if (scPlayer !== null) {

						// do something
						switch (propName) {

							case 'src':
								const url = typeof value === 'string' ? value : value[0].src;

								scPlayer.load(url);
								break;

							case 'currentTime':
								scPlayer.seekTo(value * 1000);
								break;

							case 'muted':
								if (value) {
									scPlayer.setVolume(0); // ?
								} else {
									scPlayer.setVolume(1); // ?
								}
								setTimeout(() => {
									const event = mejs.Utils.createEvent('volumechange', sc);
									mediaElement.dispatchEvent(event);
								}, 50);
								break;

							case 'volume':
								scPlayer.setVolume(value);
								setTimeout(() => {
									const event = mejs.Utils.createEvent('volumechange', sc);
									mediaElement.dispatchEvent(event);
								}, 50);
								break;

							default:
								console.log(`dm ${id}`, propName, 'UNSUPPORTED property');
						}

					} else {
						// store for after "READY" event fires
						apiStack.push({type: 'set', propName, value});
					}
				};

			};

			for (i = 0, il = props.length; i < il; i++) {
				assignGettersSetters(props[i]);
			}

			// add wrappers for native methods
			const methods = mejs.html5media.methods;

			const assignMethods = methodName => {

				// run the method on the Soundcloud API
				sc[methodName] = () => {
					console.log(`[${options.prefix} ${methodName}()]`);

					if (scPlayer !== null) {

						// DO method
						switch (methodName) {
							case 'play':
								return scPlayer.play();
							case 'pause':
								return scPlayer.pause();
							case 'load':
								return null;

						}

					} else {
						apiStack.push({type: 'call', methodName});
					}
				};

			};

			for (i = 0, il = methods.length; i < il; i++) {
				assignMethods(methods[i]);
			}

			// add a ready method that SC can fire
			win[`__ready__${sc.id}`] = _scPlayer => {

				scPlayerReady = true;
				mediaElement.scPlayer = scPlayer = _scPlayer;

				console.log('Soundcloud ready', sc.id, scPlayer);

				// do call stack
				for (i = 0, il = apiStack.length; i < il; i++) {

					const stackItem = apiStack[i];

					console.log('stack', stackItem.type);

					if (stackItem.type === 'set') {
						const propName = stackItem.propName;
						const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

						sc[`set${capName}`](stackItem.value);
					} else if (stackItem.type === 'call') {
						sc[stackItem.methodName]();
					}
				}

				// SoundCloud properties are async, so we don't fire the event until the property callback fires

				scPlayer.bind(SC.Widget.Events.PLAY_PROGRESS, () => {
					paused = false;
					ended = false;

					scPlayer.getPosition(_currentTime => {
						currentTime = _currentTime / 1000;
						const event = mejs.Utils.createEvent('timeupdate', sc);
						mediaElement.dispatchEvent(event);
					});
				});

				scPlayer.bind(SC.Widget.Events.PAUSE, () => {
					paused = true;

					const event = mejs.Utils.createEvent('pause', sc);
					mediaElement.dispatchEvent(event);
				});
				scPlayer.bind(SC.Widget.Events.PLAY, () => {
					paused = false;
					ended = false;

					const event = mejs.Utils.createEvent('play', sc);
					mediaElement.dispatchEvent(event);
				});
				scPlayer.bind(SC.Widget.Events.FINISHED, () => {
					paused = false;
					ended = true;

					const event = mejs.Utils.createEvent('ended', sc);
					mediaElement.dispatchEvent(event);
				});
				scPlayer.bind(SC.Widget.Events.READY, () => {
					scPlayer.getDuration(_duration => {
						duration = _duration / 1000;

						const event = mejs.Utils.createEvent('loadedmetadata', sc);
						mediaElement.dispatchEvent(event);
					});
				});
				scPlayer.bind(SC.Widget.Events.LOAD_PROGRESS, () => {
					scPlayer.getDuration(loadProgress => {
						if (duration > 0) {
							bufferedTime = duration * loadProgress;

							const event = mejs.Utils.createEvent('progress', sc);
							mediaElement.dispatchEvent(event);
						}
					});
					scPlayer.getDuration(_duration => {
						duration = _duration;

						const event = mejs.Utils.createEvent('loadedmetadata', sc);
						mediaElement.dispatchEvent(event);
					});
				});

				// give initial events
				const initEvents = ['rendererready', 'loadeddata', 'loadedmetadata', 'canplay'];

				for (var i = 0, il = initEvents.length; i < il; i++) {
					const event = mejs.Utils.createEvent(initEvents[i], sc);
					mediaElement.dispatchEvent(event);
				}
			};

			// container for API API
			scIframe = doc.createElement('iframe');
			scIframe.id = sc.id;
			scIframe.width = 10;
			scIframe.height = 10;
			scIframe.frameBorder = 0;
			scIframe.style.visibility = 'hidden';
			scIframe.src = mediaFiles[0].src;
			mediaElement.appendChild(scIframe);

			mediaElement.originalNode.style.display = 'none';

			const scSettings = {
				iframe: scIframe,
				id: sc.id
			};

			SoundCloudApi.enqueueIframe(scSettings);

			sc.setSize = (width, height) => {
				// nothing here, audio only
			};
			sc.hide = () => {
				sc.pause();
				if (scIframe) {
					scIframe.style.display = 'none';
				}
			};
			sc.show = () => {
				if (scIframe) {
					scIframe.style.display = '';
				}
			};
			sc.destroy = () => {
				scPlayer.destroy();
			};

			return sc;
		}
	};

	mejs.Renderers.add(SoundCloudIframeRenderer);

}))(window, document, window.mejs || {});