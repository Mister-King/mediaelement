/*
 * ContextMenu Plugin
 *
 *
 */

(($ => {

	$.extend(mejs.MepDefaults,
		{
			'contextMenuItems': [
				// demo of a fullscreen option
				{
					render(player) {

						// check for fullscreen plugin
						if (player.enterFullScreen === undefined)
							return null;

						if (player.isFullScreen) {
							return mejs.i18n.t('mejs.fullscreen-off');
						} else {
							return mejs.i18n.t('mejs.fullscreen-on');
						}
					},
					click(player) {
						if (player.isFullScreen) {
							player.exitFullScreen();
						} else {
							player.enterFullScreen();
						}
					}
				},
				// demo of a mute/unmute button
				{
					render(player) {
						if (player.media.muted) {
							return mejs.i18n.t('mejs.unmute');
						} else {
							return mejs.i18n.t('mejs.mute');
						}
					},
					click(player) {
						if (player.media.muted) {
							player.setMuted(false);
						} else {
							player.setMuted(true);
						}
					}
				},
				// separator
				{
					isSeparator: true
				},
				// demo of simple download video
				{
					render(player) {
						return mejs.i18n.t('mejs.download-video');
					},
					click(player) {
						window.location.href = player.media.currentSrc;
					}
				}
			]
		}
	);


	$.extend(MediaElementPlayer.prototype, {
		buildcontextmenu(player, controls, layers, media) {

			// create context menu
			player.contextMenu = $('<div class="mejs-contextmenu"></div>')
			.appendTo($('body'))
			.hide();

			// create events for showing context menu
			player.container.bind('contextmenu', e => {
				if (player.isContextMenuEnabled) {
					e.preventDefault();
					player.renderContextMenu(e.clientX - 1, e.clientY - 1);
					return false;
				}
			});
			player.container.bind('click', () => {
				player.contextMenu.hide();
			});
			player.contextMenu.bind('mouseleave', () => {

				//console.log('context hover out');
				player.startContextMenuTimer();

			});
		},

		cleancontextmenu(player) {
			player.contextMenu.remove();
		},

		isContextMenuEnabled: true,
		enableContextMenu() {
			this.isContextMenuEnabled = true;
		},
		disableContextMenu() {
			this.isContextMenuEnabled = false;
		},

		contextMenuTimeout: null,
		startContextMenuTimer() {
			//console.log('startContextMenuTimer');

			const t = this;

			t.killContextMenuTimer();

			t.contextMenuTimer = setTimeout(() => {
				t.hideContextMenu();
				t.killContextMenuTimer();
			}, 750);
		},
		killContextMenuTimer() {
			let timer = this.contextMenuTimer;

			//console.log('killContextMenuTimer', timer);

			if (timer !== null && timer !== undefined) {
				clearTimeout(timer);
				timer = null;
			}
		},

		hideContextMenu() {
			this.contextMenu.hide();
		},

		renderContextMenu(x, y) {
			// alway re-render the items so that things like "turn fullscreen on" and "turn fullscreen off" are always written correctly
			const t = this;

			let html = '';
			const items = t.options.contextMenuItems;

			for (let i = 0, il = items.length; i < il; i++) {

				if (items[i].isSeparator) {
					html += '<div class="mejs-contextmenu-separator"></div>';
				} else {

					const rendered = items[i].render(t);

					// render can return null if the item doesn't need to be used at the moment
					if (rendered !== null && rendered !== undefined) {
						html += `<div class="mejs-contextmenu-item" data-itemindex="${i}" id="element-${Math.random() * 1000000}">${rendered}</div>`;
					}
				}
			}

			// position and show the context menu
			t.contextMenu
			.empty()
			.append($(html))
			.css({top: y, left: x})
			.show();

			// bind events
			t.contextMenu.find('.mejs-contextmenu-item').each(function () {
				// which one is this?
				const $dom = $(this);

				const itemIndex = parseInt($dom.data('itemindex'), 10);
				const item = t.options.contextMenuItems[itemIndex];

				// bind extra functionality?
				if (typeof item.show != 'undefined')
					item.show($dom, t);

				// bind click action
				$dom.click(() => {
					// perform click action
					if (typeof item.click != 'undefined')
						item.click(t);

					// close
					t.contextMenu.hide();
				});
			});

			// stop the controls from hiding
			setTimeout(() => {
				t.killControlsTimer('rev3');
			}, 100);
		}
	});

}))(mejs.$);