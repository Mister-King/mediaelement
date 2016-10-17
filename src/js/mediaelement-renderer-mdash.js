/**
 * Native M-Dash renderer
 *
 * Uses dash.js, a reference client implementation for the playback of MPEG DASH via Javascript and compliant browsers.
 * It relies on HTML5 video and MediaSource Extensions for playback.
 * This renderer integrates new events associated with mpd files.
 * @see https://github.com/Dash-Industry-Forum/dash.js
 *
 */
(((win, doc, mejs, undefined) => {

	/**
	 * Register Native M(PEG)-Dash type based on URL structure
	 *
	 */
	mejs.Utils.typeChecks.push(url => {

		url = url.toLowerCase();

		if (url.includes('mpd')) {
			return 'application/dash+xml';
		} else {
			return null;
		}
	});

	const NativeDash = {
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
		 * Load dash.all.min.js script on the header of the document
		 *
		 */
		loadScript() {
			if (!this.isScriptLoaded) {
				const script = doc.createElement('script');
				const firstScriptTag = doc.getElementsByTagName('script')[0];
				let done = false;

				script.src = 'https://cdn.dashjs.org/latest/dash.all.min.js';

				// Attach handlers for all browsers
				script.onload = script.onreadystatechange = function () {
					if (!done && (!this.readyState || this.readyState === undefined ||
						this.readyState === 'loaded' || this.readyState === 'complete')) {
						done = true;
						NativeDash.mediaReady();
						script.onload = script.onreadystatechange = null;
					}
				};

				firstScriptTag.parentNode.insertBefore(script, firstScriptTag);
				this.isScriptLoaded = true;
			}
		},

		/**
		 * Process queue of Dash player creation
		 *
		 */
		mediaReady() {

			this.isLoaded = true;
			this.isScriptLoaded = true;

			while (this.creationQueue.length > 0) {
				const settings = this.creationQueue.pop();
				this.createInstance(settings);
			}
		},

		/**
		 * Create a new instance of Dash player and trigger a custom event to initialize it
		 *
		 * @param {Object} settings - an object with settings needed to instantiate HLS object
		 */
		createInstance(settings) {

			const player = dashjs.MediaPlayer().create();
			win[`__ready__${settings.id}`](player);
		}
	};

	const DashNativeRenderer = {
		name: 'native_mdash',

		options: {
			prefix: 'native_mdash',
			dash: {}
		},
		/**
		 * Determine if a specific element type can be played with this render
		 *
		 * @param {String} type
		 * @return {Boolean}
		 */
		canPlayType(type) {

			const mediaTypes = ['application/dash+xml'];
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
			let dashPlayer;
			const stack = {};

			node = originalNode.cloneNode(true);

			// WRAPPERS for PROPs
			const props = mejs.html5media.properties;

			const assignGettersSetters = propName => {
				const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

				node[`get${capName}`] = () => {
					if (dashPlayer !== null) {
						return node[propName];
					} else {
						return null;
					}
				};

				node[`set${capName}`] = value => {
					if (dashPlayer !== null) {
						if (propName === 'src') {

							dashPlayer.attachSource(value);

							if (node.getAttribute('autoplay')) {
								node.play();
							}
						}

						node[propName] = value;
					} else {
						// store for after "READY" event fires
						stack.push({type: 'set', propName, value});
					}
				};

			};

			for (i = 0, il = props.length; i < il; i++) {
				assignGettersSetters(props[i]);
			}

			// Initial method to register all M-Dash events
			win[`__ready__${id}`] = _dashPlayer => {
				mediaElement.dashPlayer = dashPlayer = _dashPlayer;

				// By default, console log is off
				dashPlayer.getDebug().setLogToBrowserConsole(false);


				console.log('Native M-Dash ready', dashPlayer);

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

				const dashEvents = dashjs.MediaPlayer.events;

				const assignEvents = eventName => {

					if (eventName === 'loadedmetadata') {
						dashPlayer.initialize(node, node.src, false);
					}

					node.addEventListener(eventName, e => {
						// copy event

						const event = doc.createEvent('HTMLEvents');
						event.initEvent(e.type, e.bubbles, e.cancelable);
						event.srcElement = e.srcElement;
						event.target = e.srcElement;

						mediaElement.dispatchEvent(event);
					});

				};

				events = events.concat(['click', 'mouseover', 'mouseout']);

				for (i = 0, il = events.length; i < il; i++) {
					assignEvents(events[i]);
				}

				/**
				 * Custom M(PEG)-DASH events
				 *
				 * These events can be attached to the original node using addEventListener and the name of the event,
				 * not using dashjs.MediaPlayer.events object
				 * @see http://cdn.dashjs.org/latest/jsdoc/MediaPlayerEvents.html
				 */
				const assignMdashEvents = (e, data) => {
					const event = mejs.Utils.createEvent(e, node);
					mediaElement.dispatchEvent(event);

					if (e === 'error') {
						console.error(e, data);
					}
				};
				for (const eventType in dashEvents) {
					if (dashEvents.hasOwnProperty(eventType)) {
						dashPlayer.on(dashEvents[eventType], assignMdashEvents);
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

			NativeDash.prepareSettings({
				options: options.dash,
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

			const event = mejs.Utils.createEvent('rendererready', node);
			mediaElement.dispatchEvent(event);

			return node;
		}
	};

	mejs.Renderers.add(DashNativeRenderer);

}))(window, document, window.mejs || {});