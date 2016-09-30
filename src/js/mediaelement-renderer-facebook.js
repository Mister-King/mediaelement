/**
 * Facebook renderer
 *
 * It creates an <iframe> from a <div> with specific configuration.
 * @see https://developers.facebook.com/docs/plugins/embedded-video-player
 */
(((win, doc, mejs, undefined) => {

	/**
	 * Register Facebook type based on URL structure
	 *
	 */
	mejs.Utils.typeChecks.push(url => {

		url = url.toLowerCase();

		if (url.includes('facebook')) {
			return 'video/facebook';
		} else {
			return null;
		}
	});

	const FacebookRenderer = {
		name: 'facebook',

		options: {
			prefix: 'facebook',
			fbVars: {
				appId: '{your-app-id}',
				xfbml: true,
				version: 'v2.6'
			}
		},

		/**
		 * Determine if a specific element type can be played with this render
		 *
		 * @param {String} type
		 * @return {Boolean}
		 */
		canPlayType(type) {
			const mediaTypes = ['video/facebook', 'video/x-facebook'];

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
			const fbWrapper = {};
			let fbApi = null;
			let fbDiv = null;
			const apiStack = [];
			let paused = true;
			let ended = false;
			let hasStartedPlaying = false;
			const src = '';
			const eventHandler = {};
			let i;
			let il;

			fbWrapper.options = options;
			fbWrapper.id = `${mediaElement.id}_${options.prefix}`;
			fbWrapper.mediaElement = mediaElement;

			// wrappers for get/set
			const props = mejs.html5media.properties;
			for (i = 0, il = props.length; i < il; i++) {

				// wrap in function to retain scope
				((propName => {

					const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

					fbWrapper[`get${capName}`] = () => {

						if (fbApi !== null) {
							const value = null;

							// figure out how to get youtube dta here
							switch (propName) {
								case 'currentTime':
									return fbApi.getCurrentPosition();

								case 'duration':
									return fbApi.getDuration();

								case 'volume':
									return fbApi.getVolume();

								case 'paused':
									return paused;

								case 'ended':
									return ended;

								case 'muted':
									return fbApi.isMuted();

								case 'buffered':
									return {
										start() {
											return 0;
										},
										end() {
											return 0;
										},
										length: 1
									};
								case 'src':
									return src;
							}

							return value;
						} else {
							return null;
						}
					};

					fbWrapper[`set${capName}`] = value => {

						if (fbApi !== null) {

							switch (propName) {

								case 'src':
									const url = typeof value === 'string' ? value : value[0].src;

									// Only way is to destroy instance and all the events fired,
									// and create new one
									fbDiv.parentNode.removeChild(fbDiv);
									createFacebookEmbed(url, options.fbVars);

									// This method reloads video on-demand
									FB.XFBML.parse();

									break;

								case 'currentTime':
									fbApi.seek(value);
									break;

								case 'muted':
									if (value) {
										fbApi.mute();
									} else {
										fbApi.unmute();
									}
									setTimeout(() => {
										mediaElement.dispatchEvent({type: 'volumechange'});
									}, 50);
									break;

								case 'volume':
									fbApi.setVolume(value);
									setTimeout(() => {
										mediaElement.dispatchEvent({type: 'volumechange'});
									}, 50);
									break;

								default:
									console.log(`facebook ${id}`, propName, 'UNSUPPORTED property');
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

					// run the method on the native HTMLMediaElement
					fbWrapper[methodName] = () => {

						if (fbApi !== null) {

							// DO method
							switch (methodName) {
								case 'play':
									return fbApi.play();
								case 'pause':
									return fbApi.pause();
								case 'load':
									return null;

							}

						} else {
							apiStack.push({type: 'call', methodName});
						}
					};

				}))(methods[i]);
			}


			/**
			 * Dispatch a list of events
			 *
			 * @private
			 * @param {Array} events
			 */
			function sendEvents(events) {
				for (let i = 0, il = events.length; i < il; i++) {
					const event = mejs.Utils.createEvent(events[i], fbWrapper);
					mediaElement.dispatchEvent(event);
				}
			}

			/**
			 * Determine if an object contains any elements
			 *
			 * @see http://stackoverflow.com/questions/679915/how-do-i-test-for-an-empty-javascript-object
			 * @param {Object} instance
			 * @return {Boolean}
			 */
			function isEmpty(instance) {
				for (const key in instance) {
					if (instance.hasOwnProperty(key)) {
						return false;
					}
				}

				return true;
			}

			/**
			 * Create a new Facebook player and attach all its events
			 *
			 * This method creates a <div> element that, once the API is available, will generate an <iframe>.
			 * Valid URL format(s):
			 *  - https://www.facebook.com/johndyer/videos/10107816243681884/
			 *
			 * @param {String} url
			 * @param {Object} config
			 */
			function createFacebookEmbed(url, config) {

				fbDiv = doc.createElement('div');
				fbDiv.id = fbWrapper.id;
				fbDiv.className = "fb-video";
				fbDiv.setAttribute("data-href", url);
				fbDiv.setAttribute("data-width", mediaElement.originalNode.width);
				fbDiv.setAttribute("data-allowfullscreen", "true");

				mediaElement.originalNode.parentNode.insertBefore(fbDiv, mediaElement.originalNode);
				mediaElement.originalNode.style.display = 'none';

				/*
				 * Register Facebook API event globally
				 *
				 */
				win['fbAsyncInit'] = () => {

					FB.init(config);

					FB.Event.subscribe('xfbml.ready', msg => {

						console.log("Facebook ready event", msg);

						if (msg.type === 'video') {

							fbApi = msg.instance;

							// remove previous listeners
							const fbEvents = ['startedPlaying', 'paused', 'finishedPlaying', 'startedBuffering', 'finishedBuffering'];
							for (i = 0, il = fbEvents.length; i < il; i++) {
								const event = fbEvents[i];
								const handler = eventHandler[event];
								if (!isEmpty(handler) && typeof handler.removeListener === 'function') {
									handler.removeListener(event);
								}
							}

							// do call stack
							for (var i = 0, il = apiStack.length; i < il; i++) {

								const stackItem = apiStack[i];

								console.log('stack', stackItem.type);

								if (stackItem.type === 'set') {
									const propName = stackItem.propName;
									const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

									fbWrapper[`set${capName}`](stackItem.value);
								} else if (stackItem.type === 'call') {
									fbWrapper[stackItem.methodName]();
								}
							}

							console.log('FB INIT');
							sendEvents(['rendererready', 'ready', 'loadeddata', 'canplay']);

							// Custom Facebook events
							eventHandler.startedPlaying = fbApi.subscribe('startedPlaying', () => {
								console.log('FB EVENT', 'startedPlaying');
								if (!hasStartedPlaying) {
									sendEvents(['loadedmetadata', 'timeupdate']);
									hasStartedPlaying = true;
								}
								paused = false;
								ended = false;
								sendEvents(['play', 'playing', 'timeupdate']);
							});
							eventHandler.paused = fbApi.subscribe('paused', () => {
								console.log('FB EVENT', 'paused');
								paused = true;
								ended = false;
								sendEvents(['paused']);
							});
							eventHandler.finishedPlaying = fbApi.subscribe('finishedPlaying', () => {
								paused = false;
								ended = true;
								sendEvents(['ended']);
							});
							eventHandler.startedBuffering = fbApi.subscribe('startedBuffering', () => {
								sendEvents(['progress', 'timeupdate']);
							});
							eventHandler.finishedBuffering = fbApi.subscribe('finishedBuffering', () => {
								sendEvents(['progress', 'timeupdate']);
							});
						}
					});
				};

				(((d, s, id) => {
					let js;
					const fjs = d.getElementsByTagName(s)[0];
					if (d.getElementById(id)) {
						return;
					}
					js = d.createElement(s);
					js.id = id;
					js.src = 'https://connect.facebook.net/en_US/sdk.js';
					fjs.parentNode.insertBefore(js, fjs);
				})(document, 'script', 'facebook-jssdk'));
			}

			if (mediaFiles.length > 0) {
				createFacebookEmbed(mediaFiles[0].src, options.fbVars);
			}

			fbWrapper.hide = () => {
				fbWrapper.stopInterval();
				fbWrapper.pause();
				if (fbDiv) {
					fbDiv.style.display = 'none';
				}
			};
			fbWrapper.show = () => {
				if (fbDiv) {
					fbDiv.style.display = '';
				}
			};
			fbWrapper.destroy = () => {
				//youTubeApi.destroy();
			};
			fbWrapper.interval = null;

			fbWrapper.startInterval = () => {
				// create timer
				fbWrapper.interval = setInterval(() => {
					const event = mejs.Utils.createEvent('timeupdate', fbWrapper);
					mediaElement.dispatchEvent(event);
				}, 250);
			};
			fbWrapper.stopInterval = () => {
				if (fbWrapper.interval) {
					clearInterval(fbWrapper.interval);
				}
			};

			return fbWrapper;
		}
	};

	mejs.Renderers.add(FacebookRenderer);

}))(window, document, window.mejs || {});