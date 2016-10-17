(((mejs, win, doc, undefined) => {
	/// LIBRARIES

	// Jon Resig's events
	function addEvent(obj, type, fn) {
		if (obj.addEventListener) {
			obj.addEventListener(type, fn, false);
		} else if (obj.attachEvent) {
			obj[`e${type}${fn}`] = fn;
			obj[type + fn] = () => {
				obj[`e${type}${fn}`](window.event);
			};
			obj.attachEvent(`on${type}`, obj[type + fn]);
		}

	}

	function removeEvent(obj, type, fn) {

		if (obj.removeEventListener) {
			obj.removeEventListener(type, fn, false);
		} else if (obj.detachEvent) {
			obj.detachEvent(`on${type}`, obj[type + fn]);
			obj[type + fn] = null;
		}
	}

	function getElementsByClassName(className, node, tag) {
		if (node === undefined || node === null) {
			node = document;
		}
		if (node.getElementsByClassName !== undefined && node.getElementsByClassName !== null) {
			return node.getElementsByClassName(className);
		}
		if (tag === undefined || tag === null) {
			tag = '*';
		}

		const classElements = [];
		let j = 0;
		let teststr;
		const els = node.getElementsByTagName(tag);
		const elsLen = els.length;

		for (i = 0; i < elsLen; i++) {
			if (els[i].className.includes(class_name)) {
				teststr = `,${els[i].className.split(" ").join(",")},`;
				if (teststr.includes(`,${class_name},`)) {
					classElements[j] = els[i];
					j++;
				}
			}
		}
		return classElements;
	}

	function getMousePosition(e) {
		let x = 0;
		let y = 0;

		if (!e) e = window.event;

		if (e.pageX || e.pageY) {
			x = e.pageX;
			y = e.pageY;
		} else if (e.clientX || e.clientY) {
			x = e.clientX + doc.body.scrollLeft + doc.documentElement.scrollLeft;

			y = e.clientY + doc.body.scrollTop + doc.documentElement.scrollTop;
		}

		return {x, y};
	}

	function getNodePosition(obj) {
		let curleft = 0;
		let curtop = 0;

		if (obj.offsetParent) {
			do {
				curleft += obj.offsetLeft;
				curtop += obj.offsetTop;
			} while ((obj = obj.offsetParent));

			return {x: curleft, y: curtop};
		}
	}

	function getStyle(idOrObj, styleProp) {
		const obj = typeof idOrObj === 'string' ? document.getElementById(id) : idOrObj;
		let val;
		if (obj.currentStyle) {
			val = obj.currentStyle[styleProp];
		} else if (window.getComputedStyle) {
			val = document.defaultView.getComputedStyle(obj, null).getPropertyValue(styleProp);
		}
		return val;
	}


	// Fade effect from scriptiny.com
	const fadeEffect = {
		init(id, flag, target) {
			this.elem = doc.getElementById(id);
			clearInterval(this.elem.si);
			this.target = target ? target : flag ? 100 : 0;
			this.flag = flag || -1;
			this.alpha = this.elem.style.opacity ? parseFloat(this.elem.style.opacity) * 100 : 0;
			this.elem.si = setInterval(() => {
				fadeEffect.tween();
			}, 5);
		},
		tween() {
			if (this.alpha == this.target) {
				clearInterval(this.elem.si);
			} else {
				const value = Math.round(this.alpha + ((this.target - this.alpha) * 0.05)) + (1 * this.flag);
				this.elem.style.opacity = value / 100;
				this.elem.style.filter = `alpha(opacity=${value})`;
				this.alpha = value;
			}
		}
	};

	mejs.addEvent = addEvent;
	mejs.removeEvent = removeEvent;
	mejs.getElementsByClassName = getElementsByClassName;

	mejs.id = 1000;

	mejs.MediaElementPlayerSimpleDefaults = {
		playText: mejs.i18n.t('Play'),
		pauseText: mejs.i18n.t('Pause')
	};

	class MediaElementPlayerSimple {
		constructor(idOrObj, options) {
			const original = typeof(idOrObj) === 'string' ? doc.getElementById(idOrObj) : idOrObj;
			const id = original && original.id ? original.id : `mejs_${mejs.id++}`;
			const autoplay = original && original.autoplay !== undefined && original.autoplay === true;
			const tagName = original.tagName.toLowerCase();
			const isVideo = (tagName === 'video' || tagName === 'iframe');
			const container = doc.createElement('div');
			const controls = doc.createElement('div');

			const originalWidth = isVideo ?
				original.offsetWidth > 0 ? original.offsetWidth : parseInt(original.width) :
				350;

			const originalHeight = isVideo ?
				original.offsetHeight > 0 ? original.offsetHeight : parseInt(original.height) :
				50;

			let mediaElement = null;
			const t = this;

			t.id = id;
			t.options = options;
			t.original = original;
			t.isVideo = isVideo;

			// Container
			container.id = `${id}_container`;
			container.className = `mejs-simple-container mejs-simple-${original.tagName.toLowerCase()}`;
			container.style.width = `${originalWidth}px`;
			container.style.height = `${originalHeight}px`;

			// Create SHIM
			original.parentElement.insertBefore(container, original);
			original.removeAttribute('controls');
			controls.style.opacity = 1.0;
			container.appendChild(original);

			mediaElement = new mejs.MediaElement(original, t.options);
			t.mediaElement = mediaElement;

			mediaElement.addEventListener('click', () => {
				if (mediaElement.paused) {
					mediaElement.play();
				} else {
					mediaElement.pause();
				}
			});

			t.container = container;
			t.controls = controls;
			t.options = mejs.Utils.extend(mejs.MediaElementPlayerSimpleDefaults, t.options);

			t.createUI();

			t.createPlayPause(mediaElement, controls);
			t.createCurrentTime(mediaElement, controls);
			t.createProgress(mediaElement, controls);
			t.createDuration(mediaElement, controls);
			t.createMute(mediaElement, controls);
			t.createFullscreen(mediaElement, controls);

			t.resizeControls();

			if (autoplay) {
				mediaElement.play();
			}

			return t;
		}

		createUI() {
			const t = this;
			// original = t.original,
			// originalWidth = isVideo ?
			// 				original.offsetWidth > 0 ? original.offsetWidth : parseInt(original.width) :
			//				350;

			const id = this.id;
			const controls = t.controls;
			const container = t.container;
			const mediaElement = t.mediaElement;
			const isVideo = t.isVideo;
			let isPlaying = false;

			// CONTROLS
			controls.className = 'mejs-simple-controls';
			controls.id = `${id}_controls`;
			container.appendChild(controls);

			if (isVideo) {
				//controls.style.width = (originalWidth - 20) + 'px';
			}

			addEvent(controls, 'mouseover', () => {
				clearControlsTimeout();
			});

			mediaElement.addEventListener('play', () => {
				isPlaying = true;
			});
			mediaElement.addEventListener('playing', () => {
				isPlaying = true;
			});
			mediaElement.addEventListener('pause', () => {
				isPlaying = false;
			});
			mediaElement.addEventListener('ended', () => {
				isPlaying = false;
			});
			mediaElement.addEventListener('seeked', () => {
				isPlaying = true;
			});

			mediaElement.addEventListener('mouseover', () => {
				clearControlsTimeout();
				showControls();
			});

			mediaElement.addEventListener('mouseout', mouseLeave);
			mediaElement.addEventListener('mouseleave', mouseLeave);

			function mouseLeave() {
				if (isVideo && isPlaying) {
					startControlsTimeout();
				}
			}

			let controlsTimeout = null;

			function startControlsTimeout() {
				clearControlsTimeout();

				controlsTimeout = setTimeout(() => {
					hideControls();
				}, 200);
			}

			function clearControlsTimeout() {
				if (controlsTimeout !== null) {
					clearTimeout(controlsTimeout);
					controlsTimeout = null;
				}
			}

			function showControls() {
				//controls.style.display = '';
				fadeEffect.init(`${id}_controls`, 1);
			}

			function hideControls() {
				//controls.style.display = 'none';
				fadeEffect.init(`${id}_controls`, 0);
			}

			addEvent(win, 'resize', () => {
				t.resizeControls();
			});
		}

		resizeControls() {
			const t = this;
			const controls = t.controls;
			let progress = null;
			let combinedControlsWidth = 0;
			const controlsBoundaryWidth = controls.offsetWidth;

			for (let i = 0, il = controls.childNodes.length; i < il; i++) {
				const control = controls.childNodes[i];
				let horizontalSize;

				if (control.className.includes('ui-time-total')) {
					progress = control;

					horizontalSize =
						parseInt(getStyle(control, 'margin-left'), 10) +
						parseInt(getStyle(control, 'margin-right'), 10);

					combinedControlsWidth += horizontalSize;

				} else {
					horizontalSize =
						parseInt(getStyle(control, 'width'), 10) +
						parseInt(getStyle(control, 'margin-left'), 10) +
						parseInt(getStyle(control, 'margin-right'), 10);

					combinedControlsWidth += horizontalSize;
				}
			}

			if (progress !== null && !isNaN(controlsBoundaryWidth) && !isNaN(combinedControlsWidth)) {
				progress.style.width = `${controlsBoundaryWidth - combinedControlsWidth}px`;
			}
		}

		createPlayPause(mediaElement, controls) {
			const t = this;
			const uiPlayBtn = doc.createElement('input');
			const options = t.options;

			uiPlayBtn.className = 'ui-button ui-button-play';
			//uiPlayBtn.disabled = true;
			uiPlayBtn.type = 'button';

			uiPlayBtn.title = options.playText;
			uiPlayBtn.setAttribute('aria-label', options.playText);
			uiPlayBtn.setAttribute('aria-controls', mediaElement.id);
			controls.appendChild(uiPlayBtn);

			addEvent(uiPlayBtn, 'click', () => {
				if (mediaElement.getPaused()) {
					mediaElement.play();
				} else {
					mediaElement.pause();
				}
			});

			// events
			mediaElement.addEventListener('play', () => {
				uiPlayBtn.className = `${uiPlayBtn.className.replace(/\s*ui-button-play\s*/gi, '')} ui-button-pause`;
				uiPlayBtn.title = options.pauseText;
				uiPlayBtn.setAttribute('aria-label', options.pauseText);
			}, false);

			mediaElement.addEventListener('pause', () => {
				uiPlayBtn.className = `${uiPlayBtn.className.replace(/\s*ui-button-pause\s*/gi, '')} ui-button-play`;
				uiPlayBtn.title = options.playText;
				uiPlayBtn.setAttribute('aria-label', options.playText);
			}, false);

			mediaElement.addEventListener('loadstart', () => {
				uiPlayBtn.className = `${uiPlayBtn.className.replace(/\s*ui-button-pause\s*/gi, '')} ui-button-play`;
				uiPlayBtn.title = options.playText;
				uiPlayBtn.setAttribute('aria-label', options.playText);
			});
		}

		createMute(mediaElement, controls) {
			const uiMuteBtn = doc.createElement('input');

			uiMuteBtn.className = 'ui-button ui-button-unmuted';
			//uiMuteBtn.disabled = true;
			uiMuteBtn.type = 'button';
			controls.appendChild(uiMuteBtn);

			addEvent(uiMuteBtn, 'click', () => {

				console.log('mute clicked');
				console.log('--', mediaElement.muted);

				mediaElement.muted = !mediaElement.muted;

			});

			mediaElement.addEventListener('volumechange', () => {
				if (mediaElement.muted) {
					uiMuteBtn.className = `${uiMuteBtn.className.replace(/ui-button-unmuted/gi, '')} ui-button-muted`;
				} else {
					uiMuteBtn.className = `${uiMuteBtn.className.replace(/ui-button-muted/gi, '')} ui-button-unmuted`;
				}
			}, false);
		}

		createCurrentTime(mediaElement, controls) {
			const uiCurrentTime = doc.createElement('span');

			uiCurrentTime.className = 'ui-time';
			uiCurrentTime.innerHTML = '00:00';
			controls.appendChild(uiCurrentTime);

			mediaElement.addEventListener('timeupdate', () => {

				const currentTime = mediaElement.currentTime;
				if (!isNaN(currentTime)) {
					uiCurrentTime.innerHTML = mejs.Utils.secondsToTimeCode(currentTime);
				}
			}, false);

			mediaElement.addEventListener('loadedmetadata', () => {
				uiCurrentTime.innerHTML = mejs.Utils.secondsToTimeCode(0);
			}, false);

		}

		createProgress(mediaElement, controls) {
			const uiTimeBarTotal = doc.createElement('div');
			const uiTimeBarLoaded = doc.createElement('div');
			const uiTimeBarCurrent = doc.createElement('div');

			// time bar!
			uiTimeBarTotal.className = 'ui-time-total';
			controls.appendChild(uiTimeBarTotal);

			uiTimeBarLoaded.className = 'ui-time-loaded';
			uiTimeBarTotal.appendChild(uiTimeBarLoaded);

			uiTimeBarCurrent.className = 'ui-time-current';
			uiTimeBarTotal.appendChild(uiTimeBarCurrent);

			mediaElement.addEventListener('timeupdate', () => {
				const outsideWidth = uiTimeBarTotal.offsetWidth;
				const percent = mediaElement.currentTime / mediaElement.duration;

				uiTimeBarCurrent.style.width = `${outsideWidth * percent}px`;
			});
			mediaElement.addEventListener('loadstart', () => {
				uiTimeBarCurrent.style.width = '0px';
				uiTimeBarLoaded.style.width = '0px';
			});
			mediaElement.addEventListener('loadedmetadata', () => {
				uiTimeBarCurrent.style.width = '0px';
				uiTimeBarLoaded.style.width = '0px';
			});

			mediaElement.addEventListener('progress', () => {
				const buffered = mediaElement.buffered;
				const duration = mediaElement.duration;
				const outsideWidth = uiTimeBarTotal.offsetWidth;
				let percent = 0;

				if (buffered && buffered.length > 0 && buffered.end && duration) {
					// TODO: account for a real array with multiple values (only Firefox 4 has this so far)
					percent = buffered.end(0) / duration;

					uiTimeBarLoaded.style.width = `${outsideWidth * percent}px`;
				}
			});

			addEvent(uiTimeBarTotal, 'click', e => {
				const mousePos = getMousePosition(e);
				const barPos = getNodePosition(uiTimeBarTotal);
				const clickWidth = mousePos.x - barPos.x;
				const width = uiTimeBarTotal.offsetWidth;
				const percentage = clickWidth / width;
				const newTime = percentage * mediaElement.duration;

				mediaElement.currentTime = newTime;
			});
		}

		createDuration(mediaElement, controls) {
			const uiDuration = doc.createElement('span');

			uiDuration.className = 'ui-time';
			uiDuration.innerHTML = '00:00';
			controls.appendChild(uiDuration);

			function setDuration() {
				let duration = mediaElement.duration;
				if (isNaN(duration) || duration == Infinity) {
					duration = 0;
				}
				uiDuration.innerHTML = mejs.Utils.secondsToTimeCode(duration);
			}

			mediaElement.addEventListener('timeupdate', setDuration, false);
			mediaElement.addEventListener('loadedmetadata', setDuration, false);
		}

		createFullscreen(mediaElement, controls) {
			if (!this.isVideo)
				return;

			const t = this;
			const uiFullscreenBtn = doc.createElement('input');
			let isFullscreen = false;
			const container = t.container;
			let oldWidth = container.offsetWidth;
			let oldHeight = container.offsetHeight;

			uiFullscreenBtn.className = 'ui-button ui-button-fullscreen';
			uiFullscreenBtn.type = 'button';
			controls.appendChild(uiFullscreenBtn);

			addEvent(uiFullscreenBtn, 'click', () => {

				console.log('fullscreen btn', isFullscreen);

				if (isFullscreen) {

					if (doc.exitFullscreen) {
						doc.exitFullscreen();
					} else if (doc.cancelFullScreen) {
						doc.cancelFullScreen();
					} else if (doc.webkitCancelFullScreen) {
						doc.webkitCancelFullScreen();
					} else if (doc.mozCancelFullScreen) {
						doc.mozCancelFullScreen();
					} else {
						// full window code for old browsers
					}

				} else {

					// store for later!
					oldWidth = container.offsetWidth;
					oldHeight = container.offsetHeight;

					if (container.requestFullscreen) {
						container.requestFullscreen();
					} else if (container.webkitRequestFullScreen) {
						container.webkitRequestFullScreen();
					} else if (container.mozRequestFullScreen) {
						container.mozRequestFullScreen();
					} else {
						// full window code for old browsers
					}
				}
			});

			// EVENTS
			if (doc.webkitCancelFullScreen) {
				doc.addEventListener('webkitfullscreenchange', e => {
					console.log('fullscreen event', doc.webkitIsFullScreen, e);
					isFullscreen = doc.webkitIsFullScreen;
					adjustForFullscreen();

				});
			} else if (doc.mozCancelFullScreen) {
				doc.addEventListener('mozfullscreenchange', e => {
					console.log('fullscreen event', doc.mozFullScreen, e);
					isFullscreen = doc.mozFullScreen;
					adjustForFullscreen();
				});
			}

			function adjustForFullscreen() {

				if (isFullscreen) {

					uiFullscreenBtn.className = `${uiFullscreenBtn.className.replace(/ui-button-fullscreen/gi, '')} ui-button-exitfullscreen`;

					container.style.width = '100%';
					container.style.height = '100%';

					mediaElement.setSize(container.offsetWidth, container.offsetHeight);
				} else {

					uiFullscreenBtn.className = `${uiFullscreenBtn.className.replace(/ui-button-exitfullscreen/gi, '')} ui-button-fullscreen`;

					container.style.width = `${oldWidth}px`;
					container.style.height = `${oldHeight}px`;

					mediaElement.setSize(oldWidth, oldHeight);
				}

				t.resizeControls();
			}
		}
	}

	win.MediaElementPlayerSimple = mejs.MediaElementPlayerSimple = MediaElementPlayerSimple;

}))(mejs, window, document);