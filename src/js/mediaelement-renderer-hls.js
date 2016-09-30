/**
 * Native HLS renderer
 *
 * Uses DailyMotion's hls.js, which is a JavaScript library which implements an HTTP Live Streaming client.
 * It relies on HTML5 video and MediaSource Extensions for playback.
 * This renderer integrates new events associated with m3u8 files the same way Flash version of Hls does.
 * @see https://github.com/dailymotion/hls.js
 *
 */
(((win, doc, mejs, undefined) => {

	/**
	 * Register Native HLS type based on URL structure
	 *
	 */
	mejs.Utils.typeChecks.push(url => {

		url = url.toLowerCase();

		if (url.includes('m3u8')) {
			return 'application/x-mpegURL';
		} else {
			return null;
		}
	});

	const NativeHls = {
		/**
		 * @type {Boolean}
		 */
		isMediaStarted: false,
		/**
		 * @type {Boolean}
		 */
		isMediaLoaded: false,
		/**
		 * @type {Array}
		 */
		creationQueue: [],

		/**
		 * Create a queue to prepare the loading of an HLS source
		 * @param {Object} settings - an object with settings needed to load an HLS player instance
		 */
		prepareSettings(settings) {
			if (this.isLoaded) {
				this.createInstance(settings);
			} else {
				this.loadScript();
				this.creationQueue.push(settings);
			}
		},

		/**
		 * Load hls.js script on the header of the document
		 *
		 */
		loadScript() {
			if (!this.isMediaStarted) {
				const script = doc.createElement('script');
				const firstScriptTag = doc.getElementsByTagName('script')[0];
				let done = false;

				script.src = 'https://cdn.jsdelivr.net/hls.js/latest/hls.min.js';

				// Attach handlers for all browsers
				script.onload = script.onreadystatechange = function () {
					if (!done && (!this.readyState || typeof this.readyState === 'undefined' ||
						this.readyState === 'loaded' || this.readyState === 'complete')) {
						done = true;
						NativeHls.mediaReady();
						script.onload = script.onreadystatechange = null;
					}
				};

				firstScriptTag.parentNode.insertBefore(script, firstScriptTag);
				this.isMediaStarted = true;
			}
		},

		/**
		 * Process queue of HLS player creation
		 *
		 */
		mediaReady() {
			this.isLoaded = true;
			this.isMediaLoaded = true;

			while (this.creationQueue.length > 0) {
				const settings = this.creationQueue.pop();
				this.createInstance(settings);
			}
		},

		/**
		 * Create a new instance of HLS player and trigger a custom event to initialize it
		 *
		 * @param {Object} settings - an object with settings needed to instantiate HLS object
		 */
		createInstance(settings) {
			const player = new Hls(settings.options);
			win[`__ready__${settings.id}`](player);
		}
	};

	const HlsNativeRenderer = {
		name: 'native_hls',

		options: {
			prefix: 'native_hls',
			/**
			 * Custom configuration for HLS player
			 *
			 * @see https://github.com/dailymotion/hls.js/blob/master/API.md#user-content-fine-tuning
			 * @type {Object}
			 */
			hls: {
				autoStartLoad: true,
				startPosition: -1,
				capLevelToPlayerSize: false,
				debug: false,
				defaultAudioCodec: undefined,
				maxBufferLength: 30,
				maxMaxBufferLength: 600,
				maxBufferSize: 60 * 1000 * 1000,
				maxBufferHole: 0.5,
				maxSeekHole: 2,
				seekHoleNudgeDuration: 0.01,
				maxFragLookUpTolerance: 0.2,
				liveSyncDurationCount: 3,
				liveMaxLatencyDurationCount: 10,
				enableWorker: true,
				enableSoftwareAES: true,
				manifestLoadingTimeOut: 10000,
				manifestLoadingMaxRetry: 6,
				manifestLoadingRetryDelay: 500,
				manifestLoadingMaxRetryTimeout: 64000,
				levelLoadingTimeOut: 10000,
				levelLoadingMaxRetry: 6,
				levelLoadingRetryDelay: 500,
				levelLoadingMaxRetryTimeout: 64000,
				fragLoadingTimeOut: 20000,
				fragLoadingMaxRetry: 6,
				fragLoadingRetryDelay: 500,
				fragLoadingMaxRetryTimeout: 64000,
				startFragPrefech: false,
				appendErrorMaxRetry: 3,
				// loader: function(){},
				fLoader: undefined,
				pLoader: undefined,
				xhrSetup: undefined,
				fetchSetup: undefined,
				// abrController: function() {},
				// timelineController: function() {},
				enableCEA708Captions: true,
				stretchShortVideoTrack: true,
				forceKeyFrameOnDiscontinuity: true,
				abrEwmaFastLive: 5.0,
				abrEwmaSlowLive: 9.0,
				abrEwmaFastVoD: 4.0,
				abrEwmaSlowVoD: 15.0,
				abrEwmaDefaultEstimate: 500000,
				abrBandWidthFactor: 0.8,
				abrBandWidthUpFactor: 0.7
			}
		},
		/**
		 * Determine if a specific element type can be played with this render
		 *
		 * @param {String} type
		 * @return {Boolean}
		 */
		canPlayType(type) {

			const mediaTypes = ['application/x-mpegURL', 'vnd.apple.mpegURL', 'audio/mpegURL', 'audio/hls', 'video/hls'];
			return mejs.MediaFeatures.hasMse && mediaTypes.includes(type);
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
			let node = null;
			const originalNode = mediaElement.originalNode;
			let i;
			let il;
			const id = `${mediaElement.id}_${options.prefix}`;
			let hlsPlayer;
			const stack = {};

			node = originalNode.cloneNode(true);
			options = mejs.Utils.extend(options, mediaElement.options);

			// WRAPPERS for PROPs
			const props = mejs.html5media.properties;
			for (i = 0, il = props.length; i < il; i++) {

				// wrap in function to retain scope
				((propName => {
					const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

					node[`get${capName}`] = () => {
						if (hlsPlayer !== null) {
							return node[propName];
						} else {
							return null;
						}
					};

					node[`set${capName}`] = value => {
						if (hlsPlayer !== null) {
							node[propName] = value;

							if (propName === 'src') {

								hlsPlayer.detachMedia();
								hlsPlayer.attachMedia(node);

								hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, () => {
									hlsPlayer.loadSource(value);
								});
							}
						} else {
							// store for after "READY" event fires
							stack.push({type: 'set', propName, value});
						}
					};

				}))(props[i]);
			}

			// Initial method to register all HLS events
			win[`__ready__${id}`] = _hlsPlayer => {
				mediaElement.hlsPlayer = hlsPlayer = _hlsPlayer;

				console.log('Native HLS ready', hlsPlayer);

				// do call stack
				for (i = 0, il = stack.length; i < il; i++) {

					const stackItem = stack[i];

					if (stackItem.type === 'set') {
						const propName = stackItem.propName;
						const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

						node[`set${capName}`](stackItem.value);
					} else if (stackItem.type === 'call') {
						node[stackItem.methodName]();
					}
				}

				// BUBBLE EVENTS
				let events = mejs.html5media.events;

				const hlsEvents = Hls.Events;

				events = events.concat(['click', 'mouseover', 'mouseout']);

				for (i = 0, il = events.length; i < il; i++) {
					((eventName => {

						if (eventName === 'loadedmetadata') {

							hlsPlayer.detachMedia();

							const url = node.src;

							hlsPlayer.attachMedia(node);
							hlsPlayer.on(hlsEvents.MEDIA_ATTACHED, () => {
								hlsPlayer.loadSource(url);
							});
						}

						node.addEventListener(eventName, e => {
							// copy event
							const event = doc.createEvent('HTMLEvents');
							event.initEvent(e.type, e.bubbles, e.cancelable);
							event.srcElement = e.srcElement;
							event.target = e.srcElement;

							mediaElement.dispatchEvent(event);
						});

					}))(events[i]);
				}

				/**
				 * Custom HLS events
				 *
				 * These events can be attached to the original node using addEventListener and the name of the event,
				 * not using Hls.Events object
				 * @see https://github.com/dailymotion/hls.js/blob/master/src/events.js
				 * @see https://github.com/dailymotion/hls.js/blob/master/src/errors.js
				 * @see https://github.com/dailymotion/hls.js/blob/master/API.md#runtime-events
				 * @see https://github.com/dailymotion/hls.js/blob/master/API.md#errors
				 */
				for (const eventType in hlsEvents) {

					if (hlsEvents.hasOwnProperty(eventType)) {
						hlsPlayer.on(hlsEvents[eventType], (e, data) => {
							const event = mejs.Utils.createEvent(e, node);
							mediaElement.dispatchEvent(event);

							if (e === 'ERROR') {

								// Destroy instance of player if unknown error found
								if (data.fatal && e === Hls.ErrorTypes.OTHER_ERROR) {
									hlsPlayer.destroy();
								}

								console.error(e, data);
							}
						});
					}
				}
			};

			const filteredAttributes = ['id', 'src', 'style'];
			for (let j = 0, total = originalNode.attributes.length; j < total; j++) {
				const attribute = originalNode.attributes[j];
				if (attribute.specified && !filteredAttributes.includes(attribute.name)) {
					node.setAttribute(attribute.name, attribute.value);
				}
			}

			node.setAttribute('id', id);
			if (mediaFiles && mediaFiles.length > 0) {
				for (i = 0, il = mediaFiles.length; i < il; i++) {
					if (mejs.Renderers.renderers[options.prefix].canPlayType(mediaFiles[i].type)) {
						node.setAttribute('src', mediaFiles[i].src);
						break;
					}
				}
			}
			node.className = '';

			originalNode.parentNode.insertBefore(node, originalNode);
			originalNode.removeAttribute('autoplay');
			originalNode.style.display = 'none';

			NativeHls.prepareSettings({
				options: options.hls,
				id
			});

			// HELPER METHODS
			node.setSize = (width, height) => {
				node.style.width = `${width}px`;
				node.style.height = `${height}px`;

				return node;
			};

			node.hide = () => {
				node.pause();
				node.style.display = 'none';
				return node;
			};

			node.show = () => {
				node.style.display = '';
				return node;
			};

			node.destroy = () => {
				hlsPlayer.destroy();
			};

			const event = mejs.Utils.createEvent('rendererready', node);
			mediaElement.dispatchEvent(event);

			return node;
		}
	};

	mejs.Renderers.add(HlsNativeRenderer);

}))(window, document, window.mejs || {});