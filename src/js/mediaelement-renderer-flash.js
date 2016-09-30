/**
 * Shim that falls back to Flash if a media type is not supported.
 *
 * Any format not supported natively, including, RTMP, FLV, HLS and M(PEG)-DASH (if browser does not support MSE),
 * will play using Flash.
 */
(((win, doc, mejs, undefined) => {

	/**
	 * Core detector, plugins are added below
	 *
	 */
	mejs.PluginDetector = {

		/**
		 * @type {String}
		 */
		nav: win.navigator,
		/**
		 * @type {String}
		 */
		ua: win.navigator.userAgent.toLowerCase(),
		/**
		 * Cached version numbers
		 * @type {Array}
		 */
		plugins: [],

		/**
		 * Test a plugin version number
		 * @param {String} plugin - In this scenario 'flash' will be tested
		 * @param {Array} v - An array containing the version up to 3 numbers (major, minor, revision)
		 * @return {Boolean}
		 */
		hasPluginVersion(plugin, v) {
			const pv = this.plugins[plugin];
			v[1] = v[1] || 0;
			v[2] = v[2] || 0;
			return (pv[0] > v[0] || (pv[0] == v[0] && pv[1] > v[1]) || (pv[0] == v[0] && pv[1] == v[1] && pv[2] >= v[2]));
		},

		/**
		 * Detect plugin and store its version number
		 *
		 * @see mejs.PluginDetector.detectPlugin
		 * @param {String} p
		 * @param {String} pluginName
		 * @param {String} mimeType
		 * @param {String} activeX
		 * @param {Function} axDetect
		 */
		addPlugin(p, pluginName, mimeType, activeX, axDetect) {
			this.plugins[p] = this.detectPlugin(pluginName, mimeType, activeX, axDetect);
		},

		/**
		 * Obtain version number from the mime-type (all but IE) or ActiveX (IE)
		 *
		 * @param {String} pluginName
		 * @param {String} mimeType
		 * @param {String} activeX
		 * @param {Function} axDetect
		 * @return {int[]}
		 */
		detectPlugin(pluginName, mimeType, activeX, axDetect) {
			let version = [0, 0, 0];
			let description;
			let i;
			let ax;

			// Firefox, Webkit, Opera
			if (typeof(this.nav.plugins) !== 'undefined' && typeof this.nav.plugins[pluginName] === 'object') {
				description = this.nav.plugins[pluginName].description;
				if (description && !(typeof this.nav.mimeTypes != 'undefined' && this.nav.mimeTypes[mimeType] && !this.nav.mimeTypes[mimeType].enabledPlugin)) {
					version = description.replace(pluginName, '').replace(/^\s+/, '').replace(/\sr/gi, '.').split('.');
					for (i = 0; i < version.length; i++) {
						version[i] = parseInt(version[i].match(/\d+/), 10);
					}
				}
				// Internet Explorer / ActiveX
			} else if (typeof(window.ActiveXObject) !== 'undefined') {
				try {
					ax = new ActiveXObject(activeX);
					if (ax) {
						version = axDetect(ax);
					}
				}
				catch (e) {
				}
			}
			return version;
		}
	};

	/**
	 * Add Flash detection
	 *
	 */
	mejs.PluginDetector.addPlugin('flash', 'Shockwave Flash', 'application/x-shockwave-flash', 'ShockwaveFlash.ShockwaveFlash', ax => {
		// adapted from SWFObject
		let version = [];

		let d = ax.GetVariable("$version");
		if (d) {
			d = d.split(" ")[1].split(",");
			version = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)];
		}
		return version;
	});

	const FlashMediaElementRenderer = {

		/**
		 * Create the player instance and add all native events/methods/properties as possible
		 *
		 * @param {MediaElement} mediaElement Instance of mejs.MediaElement already created
		 * @param {Object} options All the player configuration options passed through constructor
		 * @param {Object[]} mediaFiles List of sources with format: {src: url, type: x/y-z}
		 * @return {Object}
		 */
		create(mediaElement, options, mediaFiles) {
			const flash = {};
			let i;
			let il;

			// store main variable
			flash.options = options;
			flash.id = `${mediaElement.id}_${flash.options.prefix}`;
			flash.mediaElement = mediaElement;

			// insert data
			flash.flashState = {};
			flash.flashApi = null;
			flash.flashApiStack = [];

			// mediaElements for get/set
			const props = mejs.html5media.properties;
			for (i = 0, il = props.length; i < il; i++) {

				// wrap in function to retain scope
				((propName => {

					// add to flash state that we will store
					flash.flashState[propName] = null;

					const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

					flash[`get${capName}`] = () => {

						if (flash.flashApi !== null) {

							if (typeof flash.flashApi[`get_${propName}`] !== 'undefined') {
								const value = flash.flashApi[`get_${propName}`](); //t.flashState['_' + propName];

								//console.log('[' + options.prefix + ' get]: ' + propName + ' = ' + value);

								// special case for buffered to conform to HTML5's newest
								if (propName === 'buffered') {
									//console.log('buffered', value);

									return {
										start() {
											return 0;
										},
										end() {
											return value;
										},
										length: 1
									};
								}

								return value;
							} else {
								console.log(`[${options.prefix} MISSING]: ${propName}`);

								return null;
							}
						} else {
							return null;
						}
					};

					flash[`set${capName}`] = value => {
						//console.log('[' + options.prefix + ' set]: ' + propName + ' = ' + value);

						if (propName === 'src') {
							value = mejs.Utils.absolutizeUrl(value);
						}

						// send value to Flash
						if (flash.flashApi !== null && typeof flash.flashApi[`set_${propName}`] != 'undefined') {
							flash.flashApi[`set_${propName}`](value);
						} else {
							// store for after "READY" event fires
							flash.flashApiStack.push({type: 'set', propName, value});
						}

						if (propName === 'src') {
							//	flash.load();
						}
					};

				}))(props[i]);
			}

			// add mediaElements for native methods
			const methods = mejs.html5media.methods;
			methods.push('stop');
			for (i = 0, il = methods.length; i < il; i++) {
				((methodName => {

					// run the method on the native HTMLMediaElement
					flash[methodName] = () => {
						console.log(`[${options.prefix} ${methodName}()]`);

						if (flash.flashApi != null) {
							// send call up to Flash ExternalInterface API
							if (flash.flashApi[`fire_${methodName}`]) {
								flash.flashApi[`fire_${methodName}`]();
							} else {
								console.log('flash', 'missing method', methodName);
							}
						} else {
							// store for after "READY" event fires
							//console.log('-- stacking');
							flash.flashApiStack.push({type: 'call', methodName});
						}
					};

				}))(methods[i]);
			}

			// add a ready method that Flash can call to
			win[`__ready__${flash.id}`] = () => {

				flash.flashReady = true;
				flash.flashApi = document.getElementById(`__${flash.id}`);

				const event = mejs.Utils.createEvent('rendererready', flash);
				mediaElement.dispatchEvent(event);

				// do call stack
				for (let i = 0, il = flash.flashApiStack.length; i < il; i++) {

					const stackItem = flash.flashApiStack[i];

					console.log('- stack', stackItem.type, stackItem);

					if (stackItem.type === 'set') {
						const propName = stackItem.propName;
						const capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

						flash[`set${capName}`](stackItem.value);
					} else if (stackItem.type === 'call') {
						flash[stackItem.methodName]();
					}
				}
			};

			win[`__event__${flash.id}`] = eventName => {

				const event = mejs.Utils.createEvent(eventName, flash);

				// send event from Flash up to the mediaElement
				flash.mediaElement.dispatchEvent(event);
			};

			// insert Flash object
			flash.flashWrapper = document.createElement('div');

			const flashVars = [`uid=${flash.id}`];
			const isVideo = mediaElement.originalNode !== null && mediaElement.originalNode.tagName.toLowerCase() === 'video';
			const flashHeight = (isVideo) ? mediaElement.originalNode.height : 1;
			const flashWidth = (isVideo) ? mediaElement.originalNode.width : 1;

			mediaElement.appendChild(flash.flashWrapper);

			if (isVideo && mediaElement.originalNode !== null) {
				mediaElement.originalNode.style.display = 'none';
			}

			let settings = [];

			if (mejs.Features.isIE) {
				const specialIEContainer = doc.createElement('div');
				flash.flashWrapper.appendChild(specialIEContainer);

				settings = [
					'classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"',
					'codebase="//download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab"',
					`id="__${flash.id}"`,
					`width="${flashWidth}"`,
					`height="${flashHeight}"`
				];

				if (!isVideo) {
					settings.push('style="clip: rect(0 0 0 0); position: absolute;"');
				}

				specialIEContainer.outerHTML =
					`<object ${settings.join(' ')}><param name="movie" value="${flash.options.pluginPath}${flash.options.filename}?x=${new Date()}" /><param name="flashvars" value="${flashVars.join('&amp;')}" /><param name="quality" value="high" /><param name="bgcolor" value="#000000" /><param name="wmode" value="transparent" /><param name="allowScriptAccess" value="always" /><param name="allowFullScreen" value="true" /></object>`;

			} else {

				settings = [
					`id="__${flash.id}"`,
					`name="__${flash.id}"`,
					'play="true"',
					'loop="false"',
					'quality="high"',
					'bgcolor="#000000"',
					'wmode="transparent"',
					'allowScriptAccess="always"',
					'allowFullScreen="true"',
					'type="application/x-shockwave-flash" pluginspage="//www.macromedia.com/go/getflashplayer"',
					`src="${flash.options.pluginPath}${flash.options.filename}"`,
					`flashvars="${flashVars.join('&')}"`,
					`width="${flashWidth}"`,
					`height="${flashHeight}"`
				];

				if (!isVideo) {
					settings.push('style="clip: rect(0 0 0 0); position: absolute;"');
				}

				flash.flashWrapper.innerHTML =
					`<embed ${settings.join(' ')}></embed>`;
			}

			flash.flashNode = flash.flashWrapper.lastChild;

			flash.hide = () => {
				if (isVideo) {
					flash.flashNode.style.position = 'absolute';
					flash.flashNode.style.width = '1px';
					flash.flashNode.style.height = '1px';
					try {
						flash.flashNode.style.clip = 'rect(0 0 0 0);';
					} catch (e) {
					}
				}
			};
			flash.show = () => {
				if (isVideo) {
					flash.flashNode.style.position = '';
					flash.flashNode.style.width = '';
					flash.flashNode.style.height = '';
					try {
						flash.flashNode.style.clip = '';
					} catch (e) {
					}
				}
			};
			flash.setSize = (width, height) => {
				flash.flashNode.style.width = `${width}px`;
				flash.flashNode.style.height = `${height}px`;

				flash.flashApi['fire_setSize'](width, height);
			};


			if (mediaFiles && mediaFiles.length > 0) {

				for (i = 0, il = mediaFiles.length; i < il; i++) {
					if (mejs.Renderers.renderers[options.prefix].canPlayType(mediaFiles[i].type)) {
						console.log('FLASH', 'init, set src', mediaFiles[i].src);
						flash.setSrc(mediaFiles[i].src);
						flash.load();
						break;
					}
				}
			}

			return flash;
		}
	};

	const hasFlash = mejs.PluginDetector.hasPluginVersion('flash', [10, 0, 0]);

	if (hasFlash) {

		/**
		 * Register media type based on URL structure if Flash is detected
		 *
		 */
		mejs.Utils.typeChecks.push(url => {

			url = url.toLowerCase();

			if (url.includes('rtmp')) {
				if (url.includes('.mp3')) {
					return 'audio/rtmp';
				} else {
					return 'video/rtmp';
				}
			} else if (url.includes('.m3u8')) {
				return 'application/x-mpegURL';
			}
			//
			// else if (url.indexOf('.mpd') > -1) {
			//	return 'application/dash+xml';
			// }
			//
			else {
				return null;
			}
		});

		// VIDEO
		const FlashMediaElementVideoRenderer = {
			name: 'flash_video',

			options: {
				prefix: 'flash_video',
				filename: 'mediaelement-flash-video.swf'
			},
			/**
			 * Determine if a specific element type can be played with this render
			 *
			 * @param {String} type
			 * @return {Boolean}
			 */
			canPlayType(type) {
				const supportedMediaTypes = ['video/mp4', 'video/flv', 'video/rtmp', 'audio/rtmp', 'rtmp/mp4', 'audio/mp4'];

				return (hasFlash && supportedMediaTypes.includes(type));
			},

			create: FlashMediaElementRenderer.create

		};
		mejs.Renderers.add(FlashMediaElementVideoRenderer);

		// HLS
		const FlashMediaElementHlsVideoRenderer = {
			name: 'flash_hls',

			options: {
				prefix: 'flash_hls',
				filename: 'mediaelement-flash-video-hls.swf'
			},
			/**
			 * Determine if a specific element type can be played with this render
			 *
			 * @param {String} type
			 * @return {Boolean}
			 */
			canPlayType(type) {
				const supportedMediaTypes = ['audio/hls', 'video/hls', 'application/x-mpegURL', 'vnd.apple.mpegURL'];

				return (supportedMediaTypes.includes(type));
			},

			create: FlashMediaElementRenderer.create
		};
		mejs.Renderers.add(FlashMediaElementHlsVideoRenderer);

		// M(PEG)-DASH
		// For now only native
		// @see http://www.streamingmedia.com/Articles/Editorial/Featured-Articles/The-State-of-MPEG-DASH-2016-110099.aspx
		// var FlashMediaElementMdashVideoRenderer = {
		// 	name: 'flash_mdash',
		//
		// 	options: {
		// 		prefix: 'flash_mdash',
		// 		filename: 'mediaelement-flash-video-mdash.swf'
		// 	},
		// 	/**
		// 	 * Determine if a specific element type can be played with this render
		// 	 *
		// 	 * @param {String} type
		// 	 * @return {Boolean}
		// 	 */
		// 	canPlayType: function(type) {
		// 		var supportedMediaTypes = ['application/dash-xml'];
		//
		// 		return (supportedMediaTypes.indexOf(type) > -1);
		// 	},
		//
		// 	create: FlashMediaElementRenderer.create
		// };
		// mejs.Renderers.add(FlashMediaElementMdashVideoRenderer);

		// AUDIO
		const FlashMediaElementAudioRenderer = {
			name: 'flash_audio',

			options: {
				prefix: 'flash_audio_ogg',
				filename: 'mediaelement-flash-audio.swf'
			},
			/**
			 * Determine if a specific element type can be played with this render
			 *
			 * @param {String} type
			 * @return {Boolean}
			 */
			canPlayType(type) {
				const supportedMediaTypes = ['audio/mp3'];

				return (hasFlash && supportedMediaTypes.includes(type));
			},

			create: FlashMediaElementRenderer.create
		};
		mejs.Renderers.add(FlashMediaElementAudioRenderer);

		// AUDIO - wav
		// var FlashMediaElementAudioWavRenderer = {
		// 	name: 'flash_audio_wav',
		//
		// 	options: {
		// 		prefix: 'flash_audio_wav',
		// 		filename: 'mediaelement-flash-audio-wav.swf'
		// 	},
		// 	/**
		// 	 * Determine if a specific element type can be played with this render
		// 	 *
		// 	 * @param {String} type
		// 	 * @return {Boolean}
		// 	 */
		// 	canPlayType: function(type) {
		// 		var supportedMediaTypes = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/x-pn-wav'];
		//
		// 		return (hasFlash && supportedMediaTypes.indexOf(type) > -1);
		// 	},
		//
		// 	create: FlashMediaElementRenderer.create
		// };
		// mejs.Renderers.add(FlashMediaElementAudioWavRenderer);

		// AUDIO - ogg
		const FlashMediaElementAudioOggRenderer = {
			name: 'flash_audio_ogg',

			options: {
				prefix: 'flash_audio_ogg',
				filename: 'mediaelement-flash-audio-ogg.swf'
			},
			/**
			 * Determine if a specific element type can be played with this render
			 *
			 * @param {String} type
			 * @return {Boolean}
			 */
			canPlayType(type) {
				const supportedMediaTypes = ['audio/ogg', 'audio/oga'];

				return (hasFlash && supportedMediaTypes.includes(type));
			},

			create: FlashMediaElementRenderer.create
		};
		mejs.Renderers.add(FlashMediaElementAudioOggRenderer);

		// Register Flash renderer if Flash was found
		window.FlashMediaElementRenderer = mejs.FlashMediaElementRenderer = FlashMediaElementRenderer;

	} else {

		// Possible errors:
		// 1) Flash is not installed or disabled
		// 2) Flash is not the version required
		const error = (mejs.PluginDetector.plugins['flash'][0] === 0 &&
		mejs.PluginDetector.plugins['flash'][1] === 0 &&
		mejs.PluginDetector.plugins['flash'][2] === 0) ?
			'Make sure you have Flash enabled; otherwise, download the latest version from https://get.adobe.com/flashplayer/' :
			'Current version of Flash is not up-to-date. Download the latest version from https://get.adobe.com/flashplayer/';

		console.error(error);
	}

}))(window, document, window.mejs || {});