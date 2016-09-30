/**
 * DailyMotion renderer
 *
 * Uses <iframe> approach and uses DailyMotion API to manipulate it.
 * @see https://developer.dailymotion.com/player
 *
 */
(((win, doc, mejs, undefined) => {

	/**
	 * Register DailyMotion type based on URL structure
	 *
	 */
	mejs.Utils.typeChecks.push(url => {

		url = url.toLowerCase();

		if (url.includes('dailymotion.com') || url.includes('dai.ly')) {
			return 'video/dailymotion';
		} else {
			return null;
		}
	});

	const DailyMotionApi = {
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
		 * Load DailyMotion API's script on the header of the document
		 *
		 */
		loadIframeApi() {
			if (!this.isSDKStarted) {
				const e = document.createElement('script');
				e.async = true;
				e.src = 'https://api.dmcdn.net/all.js';
				const s = document.getElementsByTagName('script')[0];
				s.parentNode.insertBefore(e, s);
				this.isSDKStarted = true;
			}
		},

		/**
		 * Process queue of DailyMotion <iframe> element creation
		 *
		 */
		apiReady() {

			this.isLoaded = true;
			this.isSDKLoaded = true;

			while (this.iframeQueue.length > 0) {
				const settings = this.iframeQueue.pop();
				this.createIframe(settings);
			}
		},

		/**
		 * Create a new instance of DailyMotion API player and trigger a custom event to initialize it
		 *
		 * @param {Object} settings - an object with settings needed to create <iframe>
		 */
		createIframe(settings) {

			console.log('creating iframe', settings);

			const //id = settings.id,
				player = DM.player(settings.container, {
					height: '100%', // settings.height,
					width: '100%', //settings.width,
					video: settings.videoId,
					params: {
						chromeless: 1,
						api: 1,
						info: 0,
						logo: 0,
						related: 0
					},
					origin: location.host
				});

			player.addEventListener('apiready', () => {
				console.log('DM api ready');

				win[`__ready__${settings.id}`](player, {paused: true, ended: false});
			});
		},

		/**
		 * Extract ID from DailyMotion's URL to be loaded through API
		 * Valid URL format(s):
		 * - http://www.dailymotion.com/embed/video/x35yawy
		 * - http://dai.ly/x35yawy
		 *
		 * @param {String} url
		 * @return {String}
		 */
		getDailyMotionId(url) {
			const parts = url.split('/');
			const last_part = parts[parts.length - 1];
			const dash_parts = last_part.split('_');

			return dash_parts[0];
		}
	};

	/*
	 * Register DailyMotion event globally
	 *
	 */
	win['dmAsyncInit'] = () => {
		console.log('dmAsyncInit');
		DailyMotionApi.apiReady();
	};

	const DailyMotionIframeRenderer = {
		name: 'dailymotion_iframe',

		options: {
			prefix: 'dailymotion_iframe'
		},

		/**
		 * Determine if a specific element type can be played with this render
		 *
		 * @param {String} type
		 * @return {Boolean}
		 */
		canPlayType(type) {
			const mediaTypes = ['video/dailymotion', 'video/x-dailymotion'];

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
			const dm = {};

			dm.options = options;
			dm.id = `${mediaElement.id}_${options.prefix}`;
			dm.mediaElement = mediaElement;

			const apiStack = [];
			let dmPlayerReady = false;
			let dmPlayer = null;
			let dmIframe = null;
			let i;
			let il;
			let events;

			// wrappers for get/set
			const props = mejs.html5media.properties;
			for (i = 0, il = props.length; i < il; i++) {

				// wrap in function to retain scope
				((propName => {

					// add to flash state that we will store

					const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

					dm[`get${capName}`] = () => {
						if (dmPlayer !== null) {
							const value = null;

							// figure out how to get dm dta here
							switch (propName) {
								case 'currentTime':
									return dmPlayer.currentTime;

								case 'duration':
									return isNaN(dmPlayer.duration) ? 0 : dmPlayer.duration;

								case 'volume':
									return dmPlayer.volume;

								case 'paused':
									return dmPlayer.paused;

								case 'ended':
									return dmPlayer.ended;

								case 'muted':
									return dmPlayer.muted;

								case 'buffered':
									const percentLoaded = dmPlayer.bufferedTime;
									const duration = dmPlayer.duration;
									return {
										start() {
											return 0;
										},
										end() {
											return percentLoaded / duration;
										},
										length: 1
									};
								case 'src':
									return mediaElement.originalNode.getAttribute('src');
							}

							return value;
						} else {
							return null;
						}
					};

					dm[`set${capName}`] = value => {
						//console.log('[' + options.prefix + ' set]: ' + propName + ' = ' + value, t.flashApi);

						if (dmPlayer !== null) {

							switch (propName) {

								case 'src':
									const url = typeof value === 'string' ? value : value[0].src;

									dmPlayer.load(DailyMotionApi.getDailyMotionId(url));
									break;

								case 'currentTime':
									dmPlayer.seek(value);
									break;

								case 'muted':
									if (value) {
										dmPlayer.setMuted(true);
									} else {
										dmPlayer.setMuted(false);
									}
									setTimeout(() => {
										mediaElement.dispatchEvent({type: 'volumechange'});
									}, 50);
									break;

								case 'volume':
									dmPlayer.setVolume(value);
									setTimeout(() => {
										mediaElement.dispatchEvent({type: 'volumechange'});
									}, 50);
									break;

								default:
									console.log(`dm ${id}`, propName, 'UNSUPPORTED property');
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
					dm[methodName] = () => {
						console.log(`[${options.prefix} ${methodName}()]`);

						if (dmPlayer !== null) {

							// DO method
							switch (methodName) {
								case 'play':
									return dmPlayer.play();
								case 'pause':
									return dmPlayer.pause();
								case 'load':
									return null;

							}

						} else {
							apiStack.push({type: 'call', methodName});
						}
					};

				}))(methods[i]);
			}

			// Initial method to register all DailyMotion events when initializing <iframe>
			win[`__ready__${dm.id}`] = _dmPlayer => {

				dmPlayerReady = true;
				mediaElement.dmPlayer = dmPlayer = _dmPlayer;

				console.log('dm ready', dmPlayer);

				// do call stack
				for (i = 0, il = apiStack.length; i < il; i++) {

					const stackItem = apiStack[i];

					console.log('stack', stackItem.type);

					if (stackItem.type === 'set') {
						const propName = stackItem.propName;
						const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

						dm[`set${capName}`](stackItem.value);
					} else if (stackItem.type === 'call') {
						dm[stackItem.methodName]();
					}
				}

				dmIframe = doc.getElementById(dm.id);

				// a few more events
				events = ['mouseover', 'mouseout'];
				for (const j in events) {
					const eventName = events[j];
					mejs.addEvent(dmIframe, eventName, e => {
						const event = mejs.Utils.createEvent(e.type, dm);

						mediaElement.dispatchEvent(event);
					});
				}

				// BUBBLE EVENTS up
				events = mejs.html5media.events;
				events = events.concat(['click', 'mouseover', 'mouseout']);

				for (i = 0, il = events.length; i < il; i++) {
					((eventName => {

						// Deprecated event; not consider it
						if (eventName !== 'ended') {

							dmPlayer.addEventListener(eventName, e => {
								// copy event
								const event = mejs.Utils.createEvent(e.type, dmPlayer);
								mediaElement.dispatchEvent(event);
							});
						}

					}))(events[i]);
				}

				// Custom DailyMotion events
				dmPlayer.addEventListener('video_start', () => {
					let event = mejs.Utils.createEvent('loadedmetadata', dmPlayer);
					mediaElement.dispatchEvent(event);

					event = mejs.Utils.createEvent('timeupdate', dmPlayer);
					mediaElement.dispatchEvent(event);
				});
				dmPlayer.addEventListener('video_end', () => {
					const event = mejs.Utils.createEvent('ended', dmPlayer);
					mediaElement.dispatchEvent(event);
				});
				dmPlayer.addEventListener('progress', () => {
					const event = mejs.Utils.createEvent('timeupdate', dmPlayer);
					mediaElement.dispatchEvent(event);
				});
				dmPlayer.addEventListener('durationchange', () => {
					event = mejs.Utils.createEvent('timeupdate', dmPlayer);
					mediaElement.dispatchEvent(event);
				});


				// give initial events
				const initEvents = ['rendererready', 'loadeddata', 'loadedmetadata', 'canplay'];

				for (var i = 0, il = initEvents.length; i < il; i++) {
					var event = mejs.Utils.createEvent(initEvents[i], dm);
					mediaElement.dispatchEvent(event);
				}
			};

			const dmContainer = doc.createElement('div');
			dmContainer.id = dm.id;
			mediaElement.appendChild(dmContainer);
			if (mediaElement.originalNode) {
				dmContainer.style.width = mediaElement.originalNode.style.width;
				dmContainer.style.height = mediaElement.originalNode.style.height;
			}
			//mediaElement.originalNode.parentNode.insertBefore(dmContainer, mediaElement.originalNode);
			mediaElement.originalNode.style.display = 'none';

			const videoId = DailyMotionApi.getDailyMotionId(mediaFiles[0].src);

			const dmSettings = {
				id: dm.id,
				container: dmContainer,
				videoId
			};

			DailyMotionApi.enqueueIframe(dmSettings);

			dm.hide = () => {
				dm.stopInterval();
				dm.pause();
				if (dmIframe) {
					dmIframe.style.display = 'none';
				}
			};
			dm.show = () => {
				if (dmIframe) {
					dmIframe.style.display = '';
				}
			};
			dm.destroy = () => {
				dmPlayer.destroy();
			};
			dm.interval = null;

			dm.startInterval = () => {
				dm.interval = setInterval(() => {
					DailyMotionApi.sendEvent(dm.id, dmPlayer, 'timeupdate', {
						paused: false,
						ended: false
					});
				}, 250);
			};
			dm.stopInterval = () => {
				if (dm.interval) {
					clearInterval(dm.interval);
				}
			};

			return dm;
		}
	};

	mejs.Renderers.add(DailyMotionIframeRenderer);

}))(window, document, window.mejs || {});