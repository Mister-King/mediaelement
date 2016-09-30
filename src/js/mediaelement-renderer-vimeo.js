/**
 * Vimeo renderer
 *
 * Uses <iframe> approach and uses Vimeo API to manipulate it.
 * All Vimeo calls return a Promise so this renderer accounts for that
 * to update all the necessary values to interact with MediaElement player.
 * Note: IE8 implements ECMAScript 3 that does not allow bare keywords in dot notation;
 * that's why instead of using .catch ['catch'] is being used.
 * @see https://github.com/vimeo/player.js
 *
 */
(((win, doc, mejs, undefined) => {

	/**
	 * Register Vimeo type based on URL structure
	 *
	 */
	mejs.Utils.typeChecks.push(url => {

		url = url.toLowerCase();

		if (url.includes('vimeo')) {
			return 'video/vimeo';
		} else {
			return null;
		}
	});

	const vimeoApi = {

		/**
		 * @type {Boolean}
		 */
		isIframeStarted: false,
		/**
		 * @type {Boolean}
		 */
		isIframeLoaded: false,
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
		 * Load Vimeo API's script on the header of the document
		 *
		 */
		loadIframeApi() {

			if (!this.isIframeStarted) {
				const script = doc.createElement('script');
				const firstScriptTag = doc.getElementsByTagName('script')[0];
				let done = false;

				script.src = 'https://player.vimeo.com/api/player.js';

				// Attach handlers for all browsers
				script.onload = script.onreadystatechange = function () {
					if (!done && (!this.readyState || typeof this.readyState === 'undefined' ||
						this.readyState === "loaded" || this.readyState === "complete")) {
						done = true;
						vimeoApi.iFrameReady();
						script.onload = script.onreadystatechange = null;
					}
				};
				firstScriptTag.parentNode.insertBefore(script, firstScriptTag);
				this.isIframeStarted = true;
			}
		},

		/**
		 * Process queue of Vimeo <iframe> element creation
		 *
		 */
		iFrameReady() {

			this.isLoaded = true;
			this.isIframeLoaded = true;

			while (this.iframeQueue.length > 0) {
				const settings = this.iframeQueue.pop();
				this.createIframe(settings);
			}
		},

		/**
		 * Create a new instance of Vimeo API player and trigger a custom event to initialize it
		 *
		 * @param {Object} settings - an object with settings needed to create <iframe>
		 */
		createIframe(settings) {
			const player = new Vimeo.Player(settings.iframe);
			win[`__ready__${settings.id}`](player);
		},

		/**
		 * Extract numeric value from Vimeo to be loaded through API
		 * Valid URL format(s):
		 *  - https://player.vimeo.com/video/59777392
		 *
		 * @param {String} url - Vimeo full URL to grab the number Id of the source
		 * @return {int}
		 */
		getVimeoId(url) {
			if (url == undefined || url == null) {
				return null;
			}

			const parts = url.split('?');

			url = parts[0];

			return parseInt(url.substring(url.lastIndexOf('/') + 1));
		},

		/**
		 * Generate custom errors for Vimeo based on the API specifications
		 *
		 * @see https://github.com/vimeo/player.js#error
		 * @param {Object} error
		 */
		errorHandler(error) {
			switch (error.name) {
				case 'TypeError':
					// the id was not a number
					break;

				case 'PasswordError':
					// the video is password-protected and the viewer needs to enter the
					// password first
					break;

				case 'PrivacyError':
					// the video is password-protected or private
					break;

				case 'RangeError':
					// the time was less than 0 or greater than the video’s duration
					break;

				case 'InvalidTrackLanguageError':
					// no track was available with the specified language
					break;

				case 'InvalidTrackError':
					// no track was available with the specified language and kind
					break;

				default:
					// some other error occurred
					break;
			}
		}
	};

	/*
	 * Register Vimeo event globally
	 *
	 */
	win['onVimeoPlayerAPIReady'] = () => {
		console.log('onVimeoPlayerAPIReady');
		vimeoApi.iFrameReady();
	};

	const vimeoIframeRenderer = {

		name: 'vimeo_iframe',

		options: {
			prefix: 'vimeo_iframe'
		},
		/**
		 * Determine if a specific element type can be played with this render
		 *
		 * @param {String} type
		 * @return {Boolean}
		 */
		canPlayType(type) {
			const mediaTypes = ['video/vimeo', 'video/x-vimeo'];

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
			// exposed object
			const apiStack = [];

			let vimeoApiReady = false;
			const vimeo = {};
			let vimeoPlayer = null;
			let paused = true;
			const volume = 0;
			let currentTime = 0;
			let bufferedTime = 0;
			let ended = false;
			let duration = 0;
			let url = "";
			let i;
			let il;

			vimeo.options = options;
			vimeo.id = `${mediaElement.id}_${options.prefix}`;
			vimeo.mediaElement = mediaElement;

			// wrappers for get/set
			const props = mejs.html5media.properties;
			for (i = 0, il = props.length; i < il; i++) {

				// wrap in function to retain scope
				((propName => {

					const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

					vimeo[`get${capName}`] = () => {
						if (vimeoPlayer !== null) {
							const value = null;

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

								case 'src':
									return url;

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
							}

							return value;
						} else {
							return null;
						}
					};

					vimeo[`set${capName}`] = value => {

						if (vimeoPlayer !== null) {

							// do something
							switch (propName) {

								case 'src':
									const url = typeof value === 'string' ? value : value[0].src;
									const videoId = vimeoApi.getVimeoId(url);

									vimeoPlayer.loadVideo(videoId).then(() => {
										if (mediaElement.getAttribute('autoplay')) {
											vimeoPlayer.play();
										}

									})['catch'](error => {
										vimeoApi.errorHandler(error);
									});
									break;

								case 'currentTime':
									vimeoPlayer.setCurrentTime(value).then(() => {
										currentTime = value;
										mediaElement.dispatchEvent({type: 'timeupdate'});
									})['catch'](error => {
										vimeoApi.errorHandler(error);
									});
									break;

								case 'volume':
									vimeoPlayer.setVolume(value).then(() => {
										mediaElement.dispatchEvent({type: 'volumechange'});
									})['catch'](error => {
										vimeoApi.errorHandler(error);
									});
									break;

								case 'loop':
									vimeoPlayer.setLoop(value)['catch'](error => {
										vimeoApi.errorHandler(error);
									});
									break;
								default:
									console.log(`vimeo ${id}`, propName, 'UNSUPPORTED property');
							}

						} else {
							// store for after "READY" event fires
							apiStack.push({type: 'set', propName, value});
						}
					}

				}))(props[i]);
			}

			// add wrappers for native methods
			const methods = mejs.html5media.methods;
			for (i = 0, il = methods.length; i < il; i++) {
				((methodName => {

					// run the method on the Soundcloud API
					vimeo[methodName] = () => {

						if (vimeoPlayer !== null) {

							// DO method
							switch (methodName) {
								case 'play':
									return vimeoPlayer.play();
								case 'pause':
									return vimeoPlayer.pause();
								case 'load':
									return null;

							}

						} else {
							apiStack.push({type: 'call', methodName});
						}
					};

				}))(methods[i]);
			}

			// Initial method to register all Vimeo events when initializing <iframe>
			win[`__ready__${vimeo.id}`] = _vimeoPlayer => {
				vimeoApiReady = true;
				mediaElement.vimeoPlayer = vimeoPlayer = _vimeoPlayer;

				console.log('vimeo ready', vimeoPlayer);

				// do call stack
				for (i = 0, il = apiStack.length; i < il; i++) {

					const stackItem = apiStack[i];

					if (stackItem.type === 'set') {
						const propName = stackItem.propName;
						const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

						vimeo[`set${capName}`](stackItem.value);
					} else if (stackItem.type === 'call') {
						vimeo[stackItem.methodName]();
					}
				}

				const vimeoIframe = doc.getElementById(vimeo.id);
				let events;

				// a few more events
				events = ['mouseover', 'mouseout'];
				for (const j in events) {
					const eventName = events[j];
					mejs.addEvent(vimeoIframe, eventName, e => {
						const event = mejs.Utils.createEvent(e.type, vimeo);
						mediaElement.dispatchEvent(event);
					});
				}

				// Vimeo events
				vimeoPlayer.on('loaded', () => {

					vimeoPlayer.getDuration().then(loadProgress => {

						if (duration > 0) {
							bufferedTime = duration * loadProgress;
						}

						const event = mejs.Utils.createEvent('timeupdate', vimeo);
						mediaElement.dispatchEvent(event);

					})['catch'](error => {
						vimeoApi.errorHandler(error);
					});

					vimeoPlayer.getDuration().then(seconds => {

						duration = seconds;

						const event = mejs.Utils.createEvent('loadedmetadata', vimeo);
						mediaElement.dispatchEvent(event);
					})['catch'](error => {
						vimeoApi.errorHandler(error);
					});

					vimeoPlayer.getVideoUrl().then(_url => {
						url = _url;
					});
				});

				vimeoPlayer.on('progress', () => {

					paused = vimeo.mediaElement.getPaused();

					vimeoPlayer.getDuration().then(loadProgress => {

						duration = loadProgress;

						if (duration > 0) {
							bufferedTime = duration * loadProgress;
						}

					})['catch'](error => {
						vimeoApi.errorHandler(error);
					});

					const event = mejs.Utils.createEvent('timeupdate', vimeo);
					mediaElement.dispatchEvent(event);
				});
				vimeoPlayer.on('timeupdate', () => {

					paused = vimeo.mediaElement.getPaused();
					ended = false;

					vimeoPlayer.getCurrentTime().then(seconds => {
						currentTime = seconds;
					});

					const event = mejs.Utils.createEvent('timeupdate', vimeo);
					mediaElement.dispatchEvent(event);

				});
				vimeoPlayer.on('play', () => {
					paused = false;
					ended = false;

					vimeoPlayer.play()['catch'](error => {
						vimeoApi.errorHandler(error);
					});

					event = mejs.Utils.createEvent('play', vimeo);
					mediaElement.dispatchEvent(event);
				});
				vimeoPlayer.on('pause', () => {
					paused = true;
					ended = false;

					vimeoPlayer.pause()['catch'](error => {
						vimeoApi.errorHandler(error);
					});

					event = mejs.Utils.createEvent('pause', vimeo);
					mediaElement.dispatchEvent(event);
				});
				vimeoPlayer.on('ended', () => {
					paused = false;
					ended = true;

					const event = mejs.Utils.createEvent('ended', vimeo);
					mediaElement.dispatchEvent(event);
				});

				// give initial events
				events = ['rendererready', 'loadeddata', 'loadedmetadata', 'canplay'];

				for (i = 0, il = events.length; i < il; i++) {
					var event = mejs.Utils.createEvent(events[i], vimeo);
					mediaElement.dispatchEvent(event);
				}
			};

			const height = mediaElement.originalNode.height;
			const width = mediaElement.originalNode.width;
			const vimeoContainer = doc.createElement('iframe');

			// Create Vimeo <iframe> markup
			vimeoContainer.setAttribute('id', vimeo.id);
			vimeoContainer.setAttribute('width', width);
			vimeoContainer.setAttribute('height', height);
			vimeoContainer.setAttribute('frameBorder', '0');
			vimeoContainer.setAttribute('src', mediaFiles[0].src);
			vimeoContainer.setAttribute('webkitallowfullscreen', '');
			vimeoContainer.setAttribute('mozallowfullscreen', '');
			vimeoContainer.setAttribute('allowfullscreen', '');

			mediaElement.originalNode.parentNode.insertBefore(vimeoContainer, mediaElement.originalNode);
			mediaElement.originalNode.style.display = 'none';

			vimeoApi.enqueueIframe({
				iframe: vimeoContainer,
				id: vimeo.id
			});

			vimeo.hide = () => {
				vimeo.pause();
				if (vimeoPlayer) {
					vimeoContainer.style.display = 'none';
				}
			};
			vimeo.show = () => {
				if (vimeoPlayer) {
					vimeoContainer.style.display = '';
				}
			};

			return vimeo;
		}

	};

	mejs.Renderers.add(vimeoIframeRenderer);

}))(window, document, window.mejs || {});