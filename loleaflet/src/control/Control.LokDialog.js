/*
 * L.Control.LokDialog used for displaying LOK dialogs
 */

/* global vex $ map */
L.Control.LokDialog = L.Control.extend({

	dialogIdPrefix: 'lokdialog-',

	onAdd: function (map) {
		map.on('dialogpaint', this._onDialogPaint, this);
		map.on('dialogchildpaint', this._onDialogChildPaint, this);
		map.on('dialogchild', this._onDialogChildMsg, this);
		map.on('dialog', this._onDialogMsg, this);
		map.on('opendialog', this._openDialog, this);
	},

	_dialogs: {},

	_isOpen: function(dialogId) {
		return this._dialogs[dialogId] &&
			this._dialogs[dialogId].open &&
			$('#' + dialogId).length > 0;
	},

	_toRawDlgId: function(dialogId) {
		return dialogId.replace(this.dialogIdPrefix, '');
	},

	_sendDialogCommand: function(dialogId, rectangle, child) {
		dialogId = dialogId.replace(this.dialogIdPrefix, '');

		var dialogCmd = 'dialog';
		if (child)
			dialogCmd = 'dialogchild';

		if (rectangle)
			rectangle = rectangle.replace(/ /g, '');

		this._map._socket.sendMessage(dialogCmd + ' ' + dialogId + (rectangle ? ' rectangle=' + rectangle : ''));
	},

	_onDialogMsg: function(e) {
		e.dialogId = this.dialogIdPrefix + e.dialogId;
		if (e.action === 'created') {
			this._width = parseInt(e.size.split(',')[0]);
			this._height = parseInt(e.size.split(',')[1]);
			this._launchDialog(e.dialogId);
			var boundsString = '0,0,' + this._width + ',' + this._height; // no spaces in string
			this._sendDialogCommand(e.dialogId, boundsString);
		} else if (e.action === 'invalidate') {
			// ignore any invalidate callbacks when we have closed the dialog
			if (this._isOpen(e.dialogId)) {
				if (!e.rectangle)
					e.rectangle = '0,0' + this._width + ',' + this._height;
				this._sendDialogCommand(e.dialogId, e.rectangle);
			}
		} else if (e.action === 'cursor_invalidate') {
			if (this._isOpen(e.dialogId) && !!e.rectangle) {
				var rectangle = e.rectangle.split(',');
				var x = parseInt(rectangle[0]);
				var y = parseInt(rectangle[1]);
				var height = parseInt(rectangle[3]);

				$('#' + e.dialogId + '-cursor').css({height: height});
				// set the position of the lokdialog-cursor
				$(this._dialogs[e.dialogId].cursor).css({left: x, top: y});
			}
		} else if (e.action === 'cursor_visible') {
			var visible = e.visible === 'true';
			if (visible)
				$('#' + e.dialogId + '-cursor').css({display: 'block'});
			else
				$('#' + e.dialogId + '-cursor').css({display: 'none'});
		} else if (e.action === 'close') {
			this._onDialogClose(e.dialogId);
		}
	},

	_openDialog: function(e) {
		this._map.sendUnoCommand(e.uno);
	},

	_launchDialogCursor: function(dialogId) {
		this._dialogs[dialogId].cursor = L.DomUtil.create('div', 'leaflet-cursor-container', L.DomUtil.get(dialogId));
		var cursor = L.DomUtil.create('div', 'leaflet-cursor lokdialog-cursor', this._dialogs[dialogId].cursor);
		cursor.id = dialogId + '-cursor';
		L.DomUtil.addClass(cursor, 'blinking-cursor');
	},

	_launchDialog: function(dialogId, width, height) {
		var canvas = '<div class="lokdialog" style="padding: 0px; margin: 0px; overflow: hidden;" id="' + dialogId + '">' +
		    '<canvas class="lokdialog_canvas" tabindex="0" id="' + dialogId + '-canvas" width="' + width + 'px" height="' + height + 'px"></canvas>' +
		    '</div>';
		$(document.body).append(canvas);
		var that = this;
		$('#' + dialogId).dialog({
			width: width,
			title: 'LOK Dialog', // TODO: Get the 'real' dialog title from the backend
			modal: false,
			closeOnEscape: true,
			resizable: false,
			dialogClass: 'lokdialog_container',
			close: function() {
				that._onDialogClose(dialogId);
			}
		});

		this._dialogs[dialogId] = { open: true };

		// don't make 'TAB' focus on this button; we want to cycle focus in the lok dialog with each TAB
		$('.lokdialog_container button.ui-dialog-titlebar-close').attr('tabindex', '-1').blur();

		$('#' + dialogId + '-canvas').on('mousedown', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogMouseEvent('buttondown', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});
		$('#' + dialogId + '-canvas').on('mouseup', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogMouseEvent('buttonup', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});
		$('#' + dialogId + '-canvas').on('keyup keypress keydown', function(e) {
			e.dialogId = dialogId;
			that._handleDialogKeyEvent(e);
		});
		$('#' + dialogId + '-canvas').on('contextmenu', function() {
			return false;
		});

		this._launchDialogCursor(dialogId);
	},

	_postDialogMouseEvent: function(type, dialogid, x, y, count, buttons, modifier) {
		this._map._socket.sendMessage('dialogmouse dialogid=' + this._toRawDlgId(dialogid) +  ' type=' + type +
		                              ' x=' + x + ' y=' + y + ' count=' + count +
		                              ' buttons=' + buttons + ' modifier=' + modifier);
	},

	_postDialogKeyboardEvent: function(type, dialogid, charcode, keycode) {
		this._map._socket.sendMessage('dialogkey dialogid=' + this._toRawDlgId(dialogid) + ' type=' + type +
		                              ' char=' + charcode + ' key=' + keycode);
	},

	_postDialogChildMouseEvent: function(type, dialogid, x, y, count, buttons, modifier) {
		this._map._socket.sendMessage('dialogchildmouse dialogid=' + this._toRawDlgId(dialogid) +  ' type=' + type +
		                              ' x=' + x + ' y=' + y + ' count=' + count +
		                              ' buttons=' + buttons + ' modifier=' + modifier);
	},

	_handleDialogKeyEvent: function(e) {
		this.modifier = 0;
		var shift = e.originalEvent.shiftKey ? this._map['keyboard'].keyModifier.shift : 0;
		var ctrl = e.originalEvent.ctrlKey ? this._map['keyboard'].keyModifier.ctrl : 0;
		var alt = e.originalEvent.altKey ? this._map['keyboard'].keyModifier.alt : 0;
		var cmd = e.originalEvent.metaKey ? this._map['keyboard'].keyModifier.ctrl : 0;
		this.modifier = shift | ctrl | alt | cmd;

		var charCode = e.originalEvent.charCode;
		var keyCode = e.originalEvent.keyCode;
		var unoKeyCode = this._map['keyboard']._toUNOKeyCode(keyCode);

		if (this.modifier) {
			unoKeyCode |= this.modifier;
			if (e.type !== 'keyup') {
				this._postDialogKeyboardEvent('input', e.dialogId, charCode, unoKeyCode);
				return;
			}
		}

		if (e.type === 'keydown' && this._map['keyboard'].handleOnKeyDownKeys[keyCode]) {
			this._postDialogKeyboardEvent('input', e.dialogId, charCode, unoKeyCode);
		}
		else if (e.type === 'keypress' && (!this._map['keyboard'].handleOnKeyDownKeys[keyCode] || charCode !== 0)) {
			if (charCode === keyCode && charCode !== 13) {
				keyCode = 0;
				unoKeyCode = this._map['keyboard']._toUNOKeyCode(keyCode);
			}
			this._postDialogKeyboardEvent('input', e.dialogId, charCode, unoKeyCode);
		}
		else if (e.type === 'keyup') {
			this._postDialogKeyboardEvent('up', e.dialogId, charCode, unoKeyCode);
		}
	},

	_onDialogClose: function(dialogId) {
		$('#' + dialogId).remove();
		this._map.focus();
		delete this._dialogs[dialogId];
	},

	_paintDialog: function(dialogId, title, rectangle, imgData) {
		if (!this._isOpen(dialogId))
			return;

		$('#' + dialogId).dialog('option', 'title', decodeURIComponent(title));
		var img = new Image();
		var canvas = document.getElementById(dialogId + '-canvas');
		var ctx = canvas.getContext('2d');
		img.onload = function() {
			var x = 0;
			var y = 0;
			if (rectangle) {
				rectangle = rectangle.split(',');
				x = parseInt(rectangle[0]);
				y = parseInt(rectangle[1]);
			}

			ctx.drawImage(img, x, y);
		};
		img.src = imgData;
	},

	_isSameSize: function(dialogId, newWidth, newHeight) {
		var ret = false;
		if (this._isOpen(dialogId))
		{
			var oldWidth = $('#' + dialogId + '-canvas').width();
			var oldHeight = $('#' + dialogId + '-canvas').height();
			if (oldWidth == newWidth && oldHeight == newHeight)
				ret = true;
		}

		return ret;
	},

	// Binary dialog msg recvd from core
	_onDialogPaint: function (e) {
		var dialogId = this.dialogIdPrefix + e.id;
		if (!this._isOpen(dialogId))
			return;

		if (!this._isSameSize(dialogId, e.dialogWidth, e.dialogHeight)) {
			var canvas = document.getElementById(dialogId + '-canvas');
			canvas.width = e.dialogWidth;
			canvas.height = e.dialogHeight;

			$('#' + dialogId).dialog('option', 'width', e.dialogWidth);
		}

		this._paintDialog(dialogId, e.title, e.rectangle, e.dialog);
	},

	// Dialog Child Methods

	_onDialogChildPaint: function(e) {
		var dialogId = this.dialogIdPrefix + e.id;
		var img = new Image();
		var canvas = document.getElementById(dialogId + '-floating');
		canvas.width = e.width;
		canvas.height = e.height;
		var ctx = canvas.getContext('2d');
		img.onload = function() {
			ctx.drawImage(img, 0, 0);
		};
		img.src = e.dialog;

		// increase the height of the container,
		// so that if the floating window goes out of the parent,
		// it doesn't get stripped off
		var height = parseInt(canvas.style.top) + canvas.height;
		var currentHeight = parseInt($('#' + dialogId).css('height'));
		if (height > currentHeight)
			$('#' + dialogId).css('height', height + 'px');
	},

	_onDialogChildClose: function(dialogId) {
		$('#' + dialogId + '-floating').remove();
		// remove any extra height allocated for the parent container
		var canvasHeight = document.getElementById(dialogId + '-canvas').height;
		$('#' + dialogId).height(canvasHeight + 'px');
	},

	_isDialogChildUnchanged: function(dialogId, left, top) {
		// get pervious dialog child's specs
		var oldLeft = $('#' + dialogId + '-floating').css('left');
		var oldTop = $('#' + dialogId + '-floating').css('top');
		if (!oldLeft || !oldTop) {
			// no left or top position set earlier; this is first dialog child placement
			return false;
		}

		oldLeft = parseInt(oldLeft);
		oldTop = parseInt(oldTop);
		if (oldLeft !== left || oldTop !== top) {
			// something changed in new dialog child
			return false;
		}

		return true;
	},

	_removeDialogChild: function(dialogId) {
		$('#' + dialogId + '-floating').remove();
	},

	_createDialogChild: function(dialogId, top, left) {
		var floatingCanvas = '<canvas class="lokdialogchild-canvas" id="' + dialogId + '-floating"></canvas>';
		$('#' + dialogId).append(floatingCanvas);
		$('#' + dialogId + '-floating').css({position: 'absolute', left: left, top: top});

		var that = this;
		// attach events
		$('#' + dialogId + '-floating').on('mousedown', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogChildMouseEvent('buttondown', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});

		$('#' + dialogId + '-floating').on('mouseup', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogChildMouseEvent('buttonup', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});

		$('#' + dialogId + '-floating').on('mousemove', function(e) {
			that._postDialogChildMouseEvent('move', dialogId, e.offsetX, e.offsetY, 1, 0, 0);
		});

		$('#' + dialogId + '-floating').on('contextmenu', function() {
			return false;
		});
	},

	_launchDialogChildIfRequired: function(e) {
		var positions = e.position.split(',');
		var left = parseInt(positions[0]);
		var top = parseInt(positions[1]);

		if (e.position === '0, 0' || // FIXME: we get incorrect "0, 0" position for floating windows as first message
		    this._isDialogChildUnchanged(e.dialogId, left, top)) // no need to create the html element; we can just repaint it
			return;

		this._removeDialogChild(e.dialogId);
		this._createDialogChild(e.dialogId, top, left);
	},

	_onDialogChildMsg: function(e) {
		e.dialogId = this.dialogIdPrefix + e.dialogId;
		if (e.action === 'invalidate') {
			if (this._isOpen(e.dialogId))
			{
				this._sendDialogCommand(e.dialogId, false /* no json */, true /* dialog child*/);
				this._launchDialogChildIfRequired(e);
			}
		} else if (e.action === 'close') {
			this._onDialogChildClose(e.dialogId);
		}
	}
});

L.control.lokDialog = function (options) {
	return new L.Control.LokDialog(options);
};