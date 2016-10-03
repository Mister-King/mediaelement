/**
 * YouTube renderer
 *
 * Uses <iframe> approach and uses YouTube API to manipulate it.
 * Note: IE6-7 don't have postMessage so don't support <iframe> API, and IE8 doesn't fire the onReady event,
 * so it doesn't work - not sure if Google problem or not.
 * @see https://developers.google.com/youtube/iframe_api_reference
 */
(((win, doc, mejs, undefined) => {

	/**
	 * Register YouTube type based on URL structure
	 *
	 */
	mejs.Utils.typeChecks.push(url => {

		url = url.toLowerCase();

		if (url.includes('youtube') || url.includes('youtu.be')) {
			return 'video/youtube';
		} else {
			return null;
		}
	});

	const YouTubeApi = {
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
		 * Load YouTube API's script on the header of the document
		 *
		 */
		loadIframeApi() {
			if (!this.isIframeStarted) {
				const tag = document.createElement('script');
				tag.src = 'https://www.youtube.com/player_api';
				const firstScriptTag = document.getElementsByTagName('script')[0];
				firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
				this.isIframeStarted = true;
			}
		},

		/**
		 * Process queue of YouTube <iframe> element creation
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
		 * Create a new instance of YouTube API player and trigger a custom event to initialize it
		 *
		 * @param {Object} settings - an object with settings needed to create <iframe>
		 */
		createIframe(settings) {

			console.log('creating iframe', settings);

			return new YT.Player(settings.containerId, settings);
		},

		/**
		 * Extract ID from YouTube's URL to be loaded through API
		 * Valid URL format(s):
		 * - http://www.youtube.com/watch?feature=player_embedded&v=yyWWXSwtPP0
		 * - http://www.youtube.com/v/VIDEO_ID?version=3
		 * - http://youtu.be/Djd6tPrxc08
		 *
		 * @param {String} url
		 * @return {string}
		 */
		getYouTubeId(url) {

			let youTubeId = "";

			if (url.indexOf('?') > 0) {
				// assuming: http://www.youtube.com/watch?feature=player_embedded&v=yyWWXSwtPP0
				youTubeId = YouTubeApi.getYouTubeIdFromParam(url);

				// if it's http://www.youtube.com/v/VIDEO_ID?version=3
				if (youTubeId === '') {
					youTubeId = YouTubeApi.getYouTubeIdFromUrl(url);
				}
			} else {
				youTubeId = YouTubeApi.getYouTubeIdFromUrl(url);
			}

			return youTubeId;
		},

		/**
		 * Get ID from URL with format: http://www.youtube.com/watch?feature=player_embedded&v=yyWWXSwtPP0
		 *
		 * @param {String} url
		 * @returns {string}
		 */
		getYouTubeIdFromParam(url) {
			let youTubeId = '';
			const parts = url.split('?');
			const parameters = parts[1].split('&');

			for (let i = 0, il = parameters.length; i < il; i++) {
				const paramParts = parameters[i].split('=');
				if (paramParts[0] === 'v') {
					youTubeId = paramParts[1];
					break;
				}
			}

			return youTubeId;
		},

		/**
		 * Get ID from URL with formats
		 *  - http://www.youtube.com/v/VIDEO_ID?version=3
		 *  - http://youtu.be/Djd6tPrxc08
		 * @param {String} url
		 * @return {?String}
		 */
		getYouTubeIdFromUrl(url) {

			if (url == undefined || url == null) {
				return null;
			}

			const parts = url.split('?');

			url = parts[0];

			return url.substring(url.lastIndexOf('/') + 1);
		}
	};

	/*
	 * Register YouTube API event globally
	 *
	 */
	win['onYouTubePlayerAPIReady'] = () => {
		console.log('onYouTubePlayerAPIReady');
		YouTubeApi.iFrameReady();
	};

	const YouTubeIframeRenderer = {
		name: 'youtube_iframe',

		options: {
			prefix: 'youtube_iframe'
		},

		/**
		 * Determine if a specific element type can be played with this render
		 *
		 * @param {String} type
		 * @return {Boolean}
		 */
		canPlayType(type) {
			const mediaTypes = ['video/youtube', 'video/x-youtube'];

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
			const youtube = {};
			youtube.options = options;
			youtube.id = `${mediaElement.id}_${options.prefix}`;
			youtube.mediaElement = mediaElement;

			// API objects
			const apiStack = [];

			let youTubeApi = null;
			let youTubeApiReady = false;
			let paused = true;
			let ended = false;
			let youTubeIframe = null;
			let i;
			let il;

			// wrappers for get/set
			const props = mejs.html5media.properties;
			for (i = 0, il = props.length; i < il; i++) {

				// wrap in function to retain scope
				((propName => {

					// add to flash state that we will store

					const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

					youtube[`get${capName}`] = () => {
						if (youTubeApi !== null) {
							const value = null;

							// figure out how to get youtube dta here
							switch (propName) {
								case 'currentTime':
									return youTubeApi.getCurrentTime();

								case 'duration':
									return youTubeApi.getDuration();

								case 'volume':
									return youTubeApi.getVolume();

								case 'paused':
									console.log('YT paused', youTubeState);

									return paused;

								case 'ended':
									return ended;

								case 'muted':
									return youTubeApi.isMuted(); // ?

								case 'buffered':
									const percentLoaded = youTubeApi.getVideoLoadedFraction();
									const duration = youTubeApi.getDuration();
									return {
										start() {
											return 0;
										},
										end() {
											return percentLoaded * duration;
										},
										length: 1
									};
								case 'src':
									return youTubeApi.getVideoUrl();
							}

							return value;
						} else {
							return null;
						}
					};

					youtube[`set${capName}`] = value => {
						//console.log('[' + options.prefix + ' set]: ' + propName + ' = ' + value, t.flashApi);

						if (youTubeApi !== null) {

							// do something
							switch (propName) {

								case 'src':
									const url = typeof value === 'string' ? value : value[0].src;
									const videoId = YouTubeApi.getYouTubeId(url);

									if (mediaElement.getAttribute('autoplay')) {
										youTubeApi.loadVideoById(videoId);
									} else {
										youTubeApi.cueVideoById(videoId);
									}
									break;

								case 'currentTime':
									youTubeApi.seekTo(value);
									break;

								case 'muted':
									if (value) {
										youTubeApi.mute(); // ?
									} else {
										youTubeApi.unMute(); // ?
									}
									setTimeout(() => {

										const event = mejs.Utils.createEvent('volumechange', youtube);
										mediaElement.dispatchEvent(event);
									}, 50);
									break;

								case 'volume':
									youTubeApi.setVolume(value);
									const event = mejs.Utils.createEvent('volumechange', youtube);
									mediaElement.dispatchEvent(event);
									break;

								default:
									console.log(`youtube ${id}`, propName, 'UNSUPPORTED property');
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
					youtube[methodName] = () => {
						console.log(`[${options.prefix} ${methodName}()]`);

						if (youTubeApi !== null) {

							// DO method
							switch (methodName) {
								case 'play':
									return youTubeApi.playVideo();
								case 'pause':
									return youTubeApi.pauseVideo();
								case 'load':
									return null;

							}

						} else {
							apiStack.push({type: 'call', methodName});
						}
					};

				}))(methods[i]);
			}

			// CREATE YouTube
			const youtubeContainer = doc.createElement('div');
			youtubeContainer.id = youtube.id;
			mediaElement.originalNode.parentNode.insertBefore(youtubeContainer, mediaElement.originalNode);
			mediaElement.originalNode.style.display = 'none';

			const height = mediaElement.originalNode.height;
			const width = mediaElement.originalNode.width;
			const videoId = YouTubeApi.getYouTubeId(mediaFiles[0].src);

			const youtubeSettings = {
				id: youtube.id,
				containerId: youtubeContainer.id,
				videoId,
				height,
				width,
				playerVars: {
					controls: 0,
					rel: 0,
					disablekb: 1,
					showinfo: 0,
					modestbranding: 0,
					html5: 1,
					playsinline: 1
				},
				origin: location.host,
				events: {
					onReady(e) {

						youTubeApiReady = true;
						mediaElement.youTubeApi = youTubeApi = e.target;
						mediaElement.youTubeState = youTubeState = {
							paused: true,
							ended: false
						};

						// do call stack
						for (i = 0, il = apiStack.length; i < il; i++) {

							const stackItem = apiStack[i];

							console.log('stack', stackItem.type);

							if (stackItem.type === 'set') {
								const propName = stackItem.propName, capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

								youtube[`set${capName}`](stackItem.value);
							} else if (stackItem.type === 'call') {
								youtube[stackItem.methodName]();
							}
						}

						// a few more events
						youTubeIframe = youTubeApi.getIframe();

						console.log('iframe', youTubeIframe);

						const events = ['mouseover', 'mouseout'];

						for (const j in events) {
							const eventName = events[j];
							mejs.addEvent(youTubeIframe, eventName, e => {

								console.log('youtube iframe', e.type);

								const event = mejs.Utils.createEvent(e.type, youtube);

								mediaElement.dispatchEvent(event);
							});
						}

						// send init events
						const initEvents = ['rendererready', 'loadeddata', 'loadedmetadata', 'canplay'];

						for (i = 0, il = initEvents.length; i < il; i++) {
							const event = mejs.Utils.createEvent(initEvents[i], youtube);
							mediaElement.dispatchEvent(event);
						}
					},
					onStateChange(e) {

						// translate events
						let events = [];

						switch (e.data) {
							case -1: // not started
								events = ['loadedmetadata'];
								paused = true;
								ended = false;
								break;

							case 0: // YT.PlayerState.ENDED
								events = ['ended'];
								paused = false;
								ended = true;

								youtube.stopInterval();
								break;

							case 1:	// YT.PlayerState.PLAYING
								events = ['play', 'playing'];
								paused = false;
								ended = false;

								youtube.startInterval();

								break;

							case 2: // YT.PlayerState.PAUSED
								events = ['pause'];
								paused = true;
								ended = false;

								youtube.stopInterval();
								break;

							case 3: // YT.PlayerState.BUFFERING
								events = ['progress'];
								paused = false;
								ended = false;

								break;
							case 5: // YT.PlayerState.CUED
								events = ['loadeddata', 'loadedmetadata', 'canplay'];
								paused = true;
								ended = false;

								break;
						}

						// send events up
						for (let i = 0, il = events.length; i < il; i++) {
							const event = mejs.Utils.createEvent(events[i], youtube);
							mediaElement.dispatchEvent(event);
						}

					}
				}
			};

			// send it off for async loading and creation
			YouTubeApi.enqueueIframe(youtubeSettings);

			youtube.onEvent = (eventName, player, _youTubeState) => {
				console.log('yt event', eventName);
				if (_youTubeState != null) {
					mediaElement.youTubeState = youTubeState = _youTubeState;
				}

			};

			youtube.setSize = (width, height) => {
				youTubeApi.setSize(width, height);
			};
			youtube.hide = () => {
				youtube.stopInterval();
				youtube.pause();
				if (youTubeIframe) {
					youTubeIframe.style.display = 'none';
				}
			};
			youtube.show = () => {
				if (youTubeIframe) {
					youTubeIframe.style.display = '';
				}
			};
			youtube.destroy = () => {
				youTubeApi.destroy();
			};
			youtube.interval = null;

			youtube.startInterval = () => {
				// create timer
				youtube.interval = setInterval(() => {

					const event = mejs.Utils.createEvent('timeupdate', youtube);
					mediaElement.dispatchEvent(event);

				}, 250);
			};
			youtube.stopInterval = () => {
				if (youtube.interval) {
					clearInterval(youtube.interval);
				}
			};

			return youtube;
		}
	};

	if (window.postMessage && typeof window.addEventListener) {
		mejs.Renderers.add(YouTubeIframeRenderer);
	}

}))(window, document, window.mejs || {});