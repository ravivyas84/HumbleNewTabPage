'use strict';

// render a single bookmark node
function render(node, target) {
	if (node.description == 'separator') return;

	var li = document.createElement('li');
	var a = document.createElement('a');

	var url = node.url;
	if (url)
		a.href = url;
	else
		a.tabIndex = 0;

	var text = node.title || node.name || '';
	if (!text && node.title === null) text = node.url || '';
	a.innerText = text;

	if (node.tooltip) a.title = node.tooltip;
	setClass(a, node);

	a.insertBefore(getIcon(node), a.firstChild);

	if (node.action) {
		a.onclick = function(event) {
			return node.action(event);
		};
	} else if (url) {
		var newtab = getConfig('newtab');
		if (newtab == 1) {
			// new foreground tab
			a.target = '_blank';
		} else if (newtab == 2) {
			// new background tab
			a.onclick = function(e) {
				openLink(node, newtab);
				return false;
			};
		}
		// fix opening chrome:// and file:/// urls
		var urlStart = url.substring(0, 6);
		if (urlStart === 'chrome' || urlStart === 'file:/'){
			a.onclick = function(e) {
				openLink(node, newtab || (e.ctrlKey ? 2 : 0));
				return false;
			};
			a.onauxclick = function(e) {
				if (e.button == 1) {
					openLink(node, 2);
					return false;
				}
			}
		}
	} else if (!node.children)
		a.style.pointerEvents = 'none';

	li.appendChild(a);

	// folder
	if (node.children) {
		// render children
		if (a.open || getConfig('remember_open') && localStorage.getItem('open.' + node.id)) {
			setClass(a, node, true);
			a.open = true;
			getChildrenFunction(node)(function(result) {
				renderAll(result, li);
			});
		}

		// click handlers
		addFolderHandlers(node, a);
		enableDragFolder(node, a);

	} else if (node.id == 'apps')
		enableDragFolder(node, a);

	target.appendChild(li);
	return li;
}

// render an array of bookmark nodes
function renderAll(nodes, target, toplevel) {
	var ul = document.createElement('ul');
	for (var i = 0; i < nodes.length; i++) {
		var node = nodes[i];
		// skip extensions and duplicated child folders
		if (toplevel || !coords[node.id])
			render(node, ul);
	}
	if (ul.childNodes.length === 0)
		render({ id: 'empty', title: '< Empty >' }, ul);
	if (toplevel)
		target.appendChild(ul);
	else {
		// wrap child ul for animation
		var wrap = document.createElement('div');
		wrap.appendChild(ul);
		target.appendChild(wrap);
	}
	updateTooltips();
	return ul;
}

// render column with given index
function renderColumn(index, target) {
	var ids = columns[index];
	if (ids.length == 1 && !getConfig('show_root'))
		getChildrenFunction({id: ids[0]})(function(result) {
			renderAll(result, target);
			addColumnHandlers(index, target);
		});
	else if (ids.length > 0) {
		var i = 0;
		var nodes = [];
		// get all nodes for column
		var callback = function(result) {
			for (var j = 0; j < result.length; j++)
				nodes.push(result[j]);
			i++;
			if (i < ids.length)
				getSubTree(ids[i], callback);
			else {
				// render node list
				renderAll(nodes, target, true);
				addColumnHandlers(index, target);
			}
		};
		getSubTree(ids[i], callback);
	}
}

// render all columns to main div
function renderColumns() {
	// clear main div
	var target = document.getElementById('main');
	while (target.hasChildNodes())
		target.removeChild(target.lastChild);

	// render columns
	for (var i = 0; i < columns.length; i++) {
		var column = document.createElement('div');
		column.className = 'column';
		column.style.width = (1 / columns.length) * 100 + '%';

		// enable drag and drop
		enableDragColumn(i, column);

		target.appendChild(column);
		renderColumn(i, column);
	}

	enableDragDrop();
}

// enables click and context menu for given folder
function addFolderHandlers(node, a) {
	// click handler
	a.onclick = function() {
		toggle(node, a, getChildrenFunction(node));
		return false;
	};

	// context menu handler
	var items = getMenuItems(node);

	// column layout items
	if (!getConfig('lock')) {
		items.push(null);// spacer
		items.push({
			label: 'Create new column',
			action: function() {
				addColumn([node.id]);
			}
		});

		if (coords[node.id]) {
			var pos = coords[node.id];
			if (pos.y > 0)
				items.push({
					label: 'Move folder up',
					action: function() {
						addRow(node.id, pos.x, pos.y - 1);
					}
				});
			if (pos.y < columns[pos.x].length - 1)
				items.push({
					label: 'Move folder down',
					action: function() {
						addRow(node.id, pos.x, pos.y + 2);
					}
				});
			if (pos.x > 0)
				items.push({
					label: 'Move folder left',
					action: function() {
						addRow(node.id, pos.x - 1);
					}
				});
			if (pos.x < columns.length - 1)
				items.push({
					label: 'Move folder right',
					action: function() {
						addRow(node.id, pos.x + 1);
					}
				});
			if (root.indexOf(node.id) < 0)
				items.push({
					label: 'Remove folder',
					action: function() {
						removeRow(pos.x, pos.y);
					}
				});
		}
	}

	a.oncontextmenu = function(event) {
		renderMenu(items, event.pageX, event.pageY);
		return false;
	};
}

// enables context menu for given column
function addColumnHandlers(index, ul) {
	var items = [];
	var ids = columns[index];

	// single folder items
	if (ids.length == 1)
		items = getMenuItems({id: ids[0]});

	// column layout items
	if (!getConfig('lock') && columns.length > 1) {
		items.push(null);// spacer
		if (index > 0)
			items.push({
				label: 'Move column left',
				action: function() {
					addColumn(ids, index - 1);
				}
			});
		if (index < columns.length - 1)
			items.push({
				label: 'Move column right',
				action: function() {
					addColumn(ids, index + 2);
				}
			});
		items.push({
			label: 'Remove column',
			action: function() {
				removeColumn(index);
			}
		});
		if (ids.length == 1) {
			if (index > 0)
				items.push({
					label: 'Move folder left',
					action: function() {
						addRow(ids[0], index - 1);
					}
				});
			if (index < columns.length - 1)
				items.push({
					label: 'Move folder right',
					action: function() {
						addRow(ids[0], index + 1);
					}
				});
		}
	}

	if (items.length > 0)
		ul.oncontextmenu = function(event) {
			if (event.target.tagName == 'A' || event.target.parentNode.tagName == 'A')
				return true;
			renderMenu(items, event.pageX, event.pageY);
			return false;
		};
}

// gets context menu items for given node
function getMenuItems(node) {
	var items = [];
		items.push({
			label: 'Open all links in folder',
			action: function() {
				openLinks(node);
			}
		});
	if (node.id == 'closed')
		items.push({
			label: 'Clear browsing data',
			action: function() {
				openLink({ url: 'chrome://settings/clearBrowserData' }, 1);
			}
		});
	if (node.id == 'devices')
		items.push({
			label: 'History',
			action: function() {
				openLink({ url: 'chrome://history' }, 1);
			}
		});
	if (Number(node.id))
		items.push({
			label: 'Edit bookmarks',
			action: function() {
				openLink({ url: 'chrome://bookmarks/?id=' + node.id }, 1);
			}
		});
	return items;
}

// wraps click handler for menu items
function onMenuClick(item) {
	return function() {
		item.action();
		return false;
	};
}

// renders a popup menu at given coordinates
function renderMenu(items, x, y) {
	var ul = document.createElement('ul');
	ul.className = 'menu';
	ul.setAttribute('role', 'menu');
	for (var i = 0; i < items.length; i++) {
		var li = document.createElement('li');
		if (items[i]) {
			var a = document.createElement('a');
			a.innerText = items[i].label;
			a.tabIndex = 0;
			a.setAttribute('role', 'menuitem');
			a.onclick = onMenuClick(items[i]);

			li.appendChild(a);
		} else if (i > 0 && i < items.length - 1)
			li.appendChild(document.createElement('hr'));
		else
			continue;

		ul.appendChild(li);
	}
	document.body.appendChild(ul);
	ul.style.left = Math.max(Math.min(x, window.innerWidth + window.scrollX - ul.clientWidth), 0) + 'px';
	ul.style.top = Math.max(Math.min(y, window.innerHeight + window.scrollY - ul.clientHeight), 0) + 'px';
	ul.onmousedown = function(event) {
		event.stopPropagation();
		return true;
	};

	setTimeout(function() {
		document.onclick = function() {
			closeMenu(ul);
			return true;
		};
		document.onmousedown = function() {
			closeMenu(ul);
			return true;
		};
		document.oncontextmenu = function() {
			closeMenu(ul);
			return true;
		};
		document.onkeydown = function(event) {
			if (event.keyCode == 27)
				closeMenu(ul);
			return true;
		};
	}, 20);
	return ul;
}

// removes the given popup menu
function closeMenu(ul) {
	document.body.removeChild(ul);
	document.onclick = null;
	document.onmousedown = null;
	document.oncontextmenu = null;
	document.onkeydown = null;
}

var dragIds;

// enable drag and drop of column
function enableDragColumn(id, column) {
	if (getConfig('lock'))
		return;

	column.draggable = true;

	column.ondragstart = function(event) {
		dragIds = columns[id];
		event.dataTransfer.effectAllowed = 'move';
		this.classList.add('dragstart');
	};
	column.ondragend = function(event) {
		dragIds = null;
		this.classList.remove('dragstart');
		clearDropTarget();
	};
}

var dropTarget;

// enable drag and drop of folder
function enableDragFolder(node, a) {
	if (getConfig('lock'))
		return;

	a.draggable = true;
	a.ondragstart = function(event) {
		dragIds = [node.id];
		event.stopPropagation();
		event.dataTransfer.effectAllowed = 'move copy';
		this.classList.add('dragstart');
	};
	a.ondragend = function(event) {
		dragIds = null;
		this.classList.remove('dragstart');
		clearDropTarget();
	};
}

// init drag and drop handlers
function enableDragDrop() {
	var main = document.getElementById('main');

	if (getConfig('lock')) {
		main.ondragover = null;
		main.ondragleave = null;
		main.ondrop = null;
		return;
	}

	main.ondragover = function(event) {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		// highlight drop target
		var target = getDropTarget(event);
		if (target) {
			clearDropTarget();
			dropTarget = target;
			var bordercss = 'solid 2px ' + getConfig('font_color');
			if (target.tagName == 'LI' || target.tagName == 'UL') {
				if (isAbove(event.pageY, target)) {
					target.style.borderBottom = bordercss;
					target.style.margin = '0 0 -2px 0';
				} else {
					target.style.borderTop = bordercss;
					target.style.margin = '-2px 0 0 0';
				}
			} else if (target.className == 'column') {
				if (event.pageX - target.offsetLeft > target.clientWidth / 2) {
					target.style.borderRight = bordercss;
					target.style.margin = '0';
				} else {
					target.style.borderLeft = bordercss;
					target.style.margin = '0 2px 0 -2px';
				}
			}
		}
		return false;
	};

	main.ondragleave = function(event) {
		clearDropTarget();
	};

	main.ondrop = function(event) {
		event.stopPropagation();

		var target = getDropTarget(event);
		if (!target)
			return false;

		// calculate drop coordinates
		var x = getDropX(target, event);
		var y = getDropY(target, event);

		if (dragIds.length == 1 && y != null)
			addRow(dragIds[0], x, y);
		else {
			if (event.pageX - target.offsetLeft > target.clientWidth / 2)
				x++;
			addColumn(dragIds, x);
		}

		return false;
	};
}

// gets proper drop target element
function getDropTarget(event) {
	if (!dragIds)
		return null;
	var target = event.target;
	if (target && (target.tagName == 'A' || target.parentNode.tagName == 'A') && dragIds.length == 1) {
		// get parent folder until toplevel
		while (target &&
			target.parentNode.parentNode &&
			target.parentNode.parentNode.className != 'column') {
			// target should be LI
			target = target.parentNode;
		}
		// if single-folder column, get the UL
		if (target && target.tagName == 'LI' &&
			columns[getDropX(target, event)].length == 1)
			target = target.parentNode;
		// target should be LI or UL by here...
	} else
		while (target && target.className != 'column')
			target = target.parentNode;// target column

	return target;
}

// gets x coordinate of drop target
function getDropX(target, event) {
	var x = null;
	while (target && target.className != 'column')
		target = target.parentNode;
	if (target) {
		x = 0;
		for (; target.previousSibling; x++)
			target = target.previousSibling;
	}
	return x;
}

// gets y coordinate of drop target
function getDropY(target, event) {
	var y = null;
	if (target.tagName == 'LI') {
		y = 0;
		if (isAbove(event.pageY, target))
			y++;
		for (; target.previousSibling; y++)
			target = target.previousSibling;
	} else if (target.tagName == 'UL') {
		y = 0;
		if (isAbove(event.pageY, target))
			y++;
	}
	return y;
}

// returns true if y position is above target element midpoint
function isAbove(pageY, target) {
	return pageY - window.scrollY - target.getBoundingClientRect().top > target.clientHeight / 2;
}

// clears droptarget styles
function clearDropTarget() {
	if (dropTarget) {
		dropTarget.style.border = null;
		dropTarget.style.margin = null;
	}
	dropTarget = null;
}

var tooltipTimeout = null;
// adds tootlips to truncated text
function updateTooltips() {
	if (tooltipTimeout) clearTimeout(tooltipTimeout);

	tooltipTimeout = setTimeout(function() {
		tooltipTimeout = null;
		var elements = document.querySelectorAll('#main li a');
		for (var i = 0; i < elements.length; i++) {
			var element = elements[i];
			if (element.clientWidth + 1 < element.scrollWidth) {
				element.title = element.title || element.textContent;
			} else if (element.title === element.textContent) {
				element.title = '';
			}
		}
	}, 100);
}

// gets function that returns children of node
function getChildrenFunction(node) {
	switch(node.id) {
		case 'top':
			return function(callback) {
				if (chrome.topSites)
					chrome.topSites.get(function(result) {
						callback(result.slice(0, getConfig('number_top')));
					});
				else
					callback([]);
			};
		case 'recent':
			return function(callback) {
				chrome.bookmarks.getRecent(getConfig('number_recent'), function(result) {
					callback(result);
				});
			};
		case 'closed':
			return function(callback) {
				getClosed(function(result) {
					callback(result);
				});
			};
		case 'devices':
			return function(callback) {
				getDevices(function(result) {
					callback(result);
				});
			};
		default:
			if (node.children)
				return function(callback) {
					callback(node.children);
				};
			else
				return function(callback) {
					chrome.bookmarks.getSubTree(node.id, function(result) {
						if (result)
							callback(result[0].children);
						else {
							// remove missing bookmark locations
							if (coords[node.id])
								removeRow(coords[node.id].x, coords[node.id].y);
						}
					});
				};
	}
}

// gets the subtree for given id
function getSubTree(id, callback) {
	switch(id) {
		case 'top':
			callback([{ title: 'Most visited', id: 'top', children: true}]);
			break;
		case 'apps':
			callback([{ title: 'Apps', id: 'apps', url: 'chrome://apps' }]);
			break;
		case 'recent':
			callback([{ title: 'Recent bookmarks', id: 'recent', children: true }]);
			break;
		case 'closed':
			callback([{ title: 'Recently closed', id: 'closed', children: true }]);
			break;
		case 'devices':
			callback([{ title: 'Other devices', id: 'devices', children: true }]);
			break;
		default:
			chrome.bookmarks.getSubTree(id, function(result) {
				if (result)
					callback(result);
				else {
					// remove missing bookmark locations
					if (coords[id])
						removeRow(coords[id].x, coords[id].y);
				}
			});
	}
}

// sets css classes for node
function setClass(target, node, isopen) {
	if (node.className)
		target.classList.add(node.className);
	if (node.children) {
		target.classList.add('folder');
		target.setAttribute('aria-expanded', isopen ? 'true' : 'false');
	}
	if (isopen)
		target.classList.add('open');
	else
		target.classList.remove('open');

	switch(node.id) {
		case 'top':
		case 'apps':
		case 'recent':
		case 'closed':
		case 'devices':
		case 'empty':
			target.classList.add(node.id);
	}
}

// gets best icon for a node
function getIcon(node) {
	var url = null,
		url2x = null;
	if (node.icons) {
		var size;
		for (var i in node.icons) {
			var iconInfo = node.icons[i];
			if (iconInfo.url && (!size || (iconInfo.size < size && iconInfo.size > 15))) {
				url = iconInfo.url;
				if (iconInfo.size > 31) url2x = iconInfo.url;
				size = iconInfo.size;
			}
		}
	} else if (node.icon) {
		url = node.icon;
	} else if (node.url) {
		url = `/_favicon/?pageUrl=${encodeURIComponent(node.url)}&size=16`;
		url2x = `/_favicon/?pageUrl=${encodeURIComponent(node.url)}&size=32`;
	}

	// check favicon cache
	if (url && node.url && faviconCache[node.url]) {
		var icon = document.createElement('img');
		icon.className = 'icon';
		icon.src = faviconCache[node.url];
		icon.alt = ' ';
		return icon;
	}

	var icon = document.createElement(url ? 'img' : 'div');
	icon.className = 'icon';
	icon.src = url;
	if (url2x) icon.srcset = url2x + ' 2x';
	icon.alt = ' ';

	// cache favicon on load
	if (url && node.url && !faviconCache[node.url]) {
		icon.addEventListener('load', function() {
			try {
				var canvas = document.createElement('canvas');
				canvas.width = 16;
				canvas.height = 16;
				var ctx = canvas.getContext('2d');
				ctx.drawImage(icon, 0, 0, 16, 16);
				cacheFavicon(node.url, canvas.toDataURL('image/png'));
			} catch(e) {}
		}, { once: true });
	}
	return icon;
}

// toggle folder open state
function toggle(node, a) {
	var isopen = a.open;
	setClass(a, node, !isopen);
	a.open = !isopen;
	if (isopen) {
		// close folder
		localStorage.removeItem('open.' + node.id);
		if (a.nextSibling){
			// auto-close child folders
			if (getConfig('auto_close')) {
				var children = (a.nextSibling.tagName == 'DIV' ? a.nextSibling.firstChild : a.nextSibling).children;
				for (var i=0; i<children.length; i++) {
					var child = children[i].firstChild;
					if (child.open)
						child.onclick();
				}
			}
			// close folder
			animate(node, a, isopen);
		}
	} else {
		// open folder
		localStorage.setItem('open.' + node.id, true);
		// auto-close sibling folders
		if (getConfig('auto_close')) {
			var siblings = a.parentNode.parentNode.children;
			for (var i=0; i<siblings.length; i++) {
				var sibling = siblings[i].firstChild;
				if (sibling != a && sibling.open)
					sibling.onclick();
			}
		}
		// open folder
		if (a.nextSibling)
			animate(node, a, isopen);
		else
			getChildrenFunction(node)(function(result) {
				if (!a.nextSibling && a.open) {
					renderAll(result, a.parentNode);
					animate(node, a, isopen);
				}
			});
	}
}

// smoothly open or close folder
function animate(node, a, isopen) {
	// TODO: fix nested animations
	// wrapper needed for inner height value
	var wrap = a.nextSibling;
	if (a.animationHandle) {
		// clear last animation
		clearTimeout(a.animationHandle);
		a.animationHandle = null;
	} else {
		// start animation
		wrap.style.height = isopen ? wrap.firstChild.clientHeight + 'px' : 0;
		wrap.style.opacity = isopen ? 1 : 0;
	}
	// requestAnimationFrame twice to ensure at least one frame has passed
	requestAnimationFrame(function() {
		requestAnimationFrame(function() {
			if (wrap) {
				wrap.className = 'wrap';
				wrap.style.height = isopen ? 0 : wrap.firstChild.clientHeight + 'px';
				wrap.style.opacity = isopen ? 0 : 1;
				wrap.style.pointerEvents = isopen ? 'none' : null;
			}
		});
	});

	var duration = scale(getConfig('slide'), .2, 1) * 1000;
	a.animationHandle = setTimeout(function() {
		a.animationHandle = null;
		if (isopen)
			a.parentNode.removeChild(wrap);
		else {
			wrap.className = null;
			wrap.removeAttribute('style');
		}
		wrap = null;
	}, duration);
}

// opens immediate children of given node in new tabs
function openLinks(node) {
	chrome.tabs.getCurrent(function(tab) {
		getChildrenFunction(node)(function(result) {
			for (var i = 0; i < result.length; i++)
				openLink(result[i], 2);
		});
	});
}

// opens given node
function openLink(node, newtab) {
	var url = node.url;
	if (url) {
		chrome.tabs.getCurrent(function(tab) {
			if (newtab)
				chrome.tabs.create({url: url, active: (newtab == 1), openerTabId: tab.id});
			else
				chrome.tabs.update(tab.id, {url: url});
		});
	}
}

var columns; // columns[x][y] = id
var root; // root[] = id
var coords; // coords[id] = {x:x, y:y}
var special = ['apps', 'top', 'recent', 'closed', 'devices'];

// ensure root folders are included
function verifyColumns() {
	// default layout
	if (columns.length === 0) {
		columns.push([]);
		columns.push(special.filter(function(a) {
			return getConfig('show_' + a) != false;
		}));
	}

	// find missing root items
	var missing = root.slice(0);
	for (var x = 0; x < columns.length; x++) {
		for (var y = 0; y < columns[x].length; y++) {
			var i = missing.indexOf(columns[x][y]);
			if (i > -1)
				missing.splice(i, 1);
		}
	}

	// add missing root items
	var column = columns[0];
	for (var i = 0; i < missing.length; i++) {
		if (getConfig('show_' + missing[i]) != false)
			column.push(missing[i]);
	}

	// populate coordinate map
	coords = {};
	for (var x = 0; x < columns.length; x++) {
		for (var y = 0; y < columns[x].length; y++) {
			coords[columns[x][y]] = { x: x, y: y};
		}
		if (columns[x].length === 0) {
			columns.splice(x, 1);
			x--;
		}
	}
}

// load columns from storage or default
function loadColumns() {
	columns = [];
	for (var x = 0; ; x++) {
		var row = [];
		for (var y = 0; ; y++) {
			var id = localStorage.getItem('column.' + x + '.' + y);
			if (id) row.push(id); else break;
		}
		if (row.length > 0) columns.push(row); else break;
	}

	if (root) {
		verifyColumns();
		renderColumns();
	} else {
		chrome.bookmarks.getTree(function(result) {
			// init root nodes
			var nodes = result[0].children;
			root = special.slice(0);

			for (var i = 0; i < nodes.length; i++)
				root.push(nodes[i].id);

			verifyColumns();
			renderColumns();
		});
	}
}

// saves current column configuration to storage
function saveColumns() {
	// clear previous config
	for (var x = 0; ; x++) {
		for (var y = 0; ; y++) {
			var id = localStorage.getItem('column.' + x + '.' + y);
			if (id)
				localStorage.removeItem('column.' + x + '.' + y);
			else
				break;
		}
		if (y === 0)
			break;
	}
	verifyColumns();
	// save new config
	for (var x = 0; x < columns.length; x++) {
		for (var y = 0; y < columns[x].length; y++) {
			localStorage.setItem('column.' + x +'.' + y, columns[x][y]);
		}
	}
	// refresh
	loadColumns();
}

// creates and saves a new column
function addColumn(ids, index) {
	var column = ids.slice(0);
	// remove previous locations
	for (var x = 0; x < columns.length; x++) {
		for (var y = 0; y < columns[x].length; y++ ) {
			if (ids.indexOf(columns[x][y]) > -1) {
				columns[x].splice(y, 1);
				y--;
			}
		}
	}
	// insert new id
	if (index == null)
		index = columns.length;
	columns.splice(Math.min(index, columns.length), 0, column);

	// save
	saveColumns();
}

// removes given column
function removeColumn(index) {
	columns.splice(index, 1);
	saveColumns();
}

// creates and saves a new row
function addRow(id, xpos, ypos) {
	if (ypos == null)
		ypos = columns[xpos].length;

	// remove previous locations
	for (var x = 0; x < columns.length; x++) {
		var i = columns[x].indexOf(id);
		if (i > -1) {
			columns[x].splice(i, 1);
			if (x == xpos && ypos > i)
				ypos--;
		}
		if (columns[x].length === 0) {
			columns.splice(x, 1);
			x--;
			if (xpos > x)
				xpos--;
		}
	}
	// insert new id
	columns[xpos].splice(Math.min(ypos, columns[xpos].length), 0, id);

	// save
	saveColumns();
}

// removes given row
function removeRow(xpos, ypos) {
	columns[xpos].splice(ypos, 1);
	saveColumns();
}

// get recently closed tabs
function getClosed(callback) {
	var maxResults = getConfig('number_closed');
	chrome.sessions.getRecentlyClosed({ maxResults: maxResults }, function(sessions) {
		var nodes = [];
		for (var i = 0; i < sessions.length && i < maxResults; i++) {
			(function(session) {
				if (session.window && session.window.tabs.length == 1)
					session.tab = session.window.tabs[0];

				nodes.push({
					title: session.tab ? session.tab.title : session.window.tabs.length + ' Tabs',
					url: session.tab ? session.tab.url : null,
					className: session.window ? 'window' : null,
					action: function() {
						chrome.sessions.restore(session.window ? session.window.sessionId : session.tab.sessionId, function(session) {
							refreshClosed();
						});
						return false;
					}
				});
			})(sessions[i]);
		}
		callback(nodes);
	});
}

function getDevices(callback) {
	chrome.sessions.getDevices({ maxResults: getConfig('number_closed') }, function(devices) {
		var nodes = [];
		for (var i = 0; i < devices.length; i++) {
			(function(device) {
				var children = [];
				for (var j = 0; j < device.sessions.length; j++) {
					var session = device.sessions[j];
					var tabs = session.window ? session.window.tabs : [session.tab];
					for (var k = 0; k < tabs.length; k++) {
						children.push({
							title: tabs[k].title,
							url: tabs[k].url
						});
					}
				}
				nodes.push({
					id: 'device.' + device.deviceName,
					title: device.deviceName,
					children: children
				});
			})(devices[i]);
		}
		callback(nodes);
	});
}

// refresh recently closed tab lists
function refreshClosed() {
	var targets = [];
	var folders = document.getElementsByClassName('closed');
	for (var i = 0; i < folders.length; i++) {
		var a = folders[i];
		if (a.nextSibling) {
			a.parentNode.removeChild(a.nextSibling);
			targets.push(a.parentNode);
		}
	}
	if (folders.length === 0 && coords['closed']) {
		var target = document.getElementsByClassName('column')[coords['closed'].x];
		target.removeChild(target.firstChild);
		targets.push(target);
	}

	getChildrenFunction({id: 'closed'})(function(result) {
		for (var i = 0; i < targets.length; i++)
			renderAll(result, targets[i]);
	});
}

// options : default values
var config = {
	font: 'Sans-serif',
	font_size: 16,
	font_weight: 400,
	theme: 'Default',
	font_color: '#555555',
	background_color: '#ffffff',
	highlight_color: '#e4f4ff',
	highlight_font_color: '#000000',
	shadow_color: '#57b0ff',
	background_image_file: '',
	background_image: '',
	background_align: 'left top',
	background_repeat: 'repeat',
	background_size: 'auto',
	shadow_blur: 1,
	highlight_round: 1,
	fade: 1,
	spacing: 1,
	width: 1,
	h_pos: 1,
	v_margin: 1,
	slide: 1,
	hide_options: 0,
	lock: 0,
	show_top: 1,
	show_apps: 1,
	show_recent: 1,
	show_closed: 1,
	show_devices: 1,
	show_root: 0,
	newtab: 0,
	remember_open: 1,
	auto_close: 0,
	auto_scale: 1,
	css: '',
	number_top: 10,
	number_closed: 10,
	number_recent: 10,
	show_timezones: 1,
	tz_home: '1',
	tz_1: 'America/New_York',
	tz_label_1: 'New York',
	tz_2: 'Europe/London',
	tz_label_2: 'London',
	tz_3: 'Asia/Kolkata',
	tz_label_3: 'Mumbai',
	tz_4: 'Asia/Tokyo',
	tz_label_4: 'Tokyo',
	show_search: 0
};

// color theme values
var themes = {
	System: {},
	Default: {},
	Classic: {
		font_color: '#000000',
		background_color: '#ffffff',
		highlight_color: '#3399ff',
		highlight_font_color: '#ffffff',
		shadow_color: '#97cbff'
	},
	Dusk: {
		font_color: '#c8b9be',
		background_color: '#56546b',
		highlight_color: '#494d5a',
		highlight_font_color: '#ffd275',
		shadow_color: '#000000'
	},
	Elegant: {
		font_color: '#888888',
		background_color: '#f6f6f6',
		highlight_color: '#ffffff',
		highlight_font_color: '#000000',
		shadow_color: '#aaaaaa'
	},
	Frosty: {
		font_color: '#3e5e82',
		background_color: '#e4eef3',
		highlight_color: '#0080c0',
		highlight_font_color: '#ffffff',
		shadow_color: '#8080ff'
	},
	Hacker: {
		font_color: '#00ff00',
		background_color: '#000000',
		highlight_color: '#00ff00',
		highlight_font_color: '#000000',
		shadow_color: '#ff0000'
	},
	Melon: {
		font_color: '#594526',
		background_color: '#f8ffe1',
		highlight_color: '#ff8000',
		highlight_font_color: '#ffff80',
		shadow_color: '#ff80c0'
	},
	Midnight: {
		font_color: '#bfdfff',
		background_color: '#101827',
		highlight_color: '#000000',
		highlight_font_color: '#80ecff',
		shadow_color: '#0080ff'
	},
	Slate: {
		font_color: '#555555',
		background_color: '#b7babf',
		highlight_color: '#aaaaaa',
		highlight_font_color: '#000000',
		shadow_color: '#2a2a2a'
	},
	Trees: {
		font_color: '#cdd088',
		background_color: '#566157',
		highlight_color: '#4d674b',
		highlight_font_color: '#ffff80',
		shadow_color: '#183010'
	},
	Valentine: {
		font_color: '#895fc2',
		background_color: '#eae1ff',
		highlight_color: '#ffb7f0',
		highlight_font_color: '#f00000',
		shadow_color: '#ffffff'
	},
	Warm: {
		font_color: '#824100',
		background_color: '#ffeedd',
		highlight_color: '#fffae8',
		highlight_font_color: '#800000',
		shadow_color: '#d98764'
	}
};
var theme = {};

// get config value or default
function getConfig(key) {
	var value = localStorage.getItem('options.' + key);
	if (value != null)
		return typeof config[key] === 'number' ? Number(value) : value;
	else
		return (theme.hasOwnProperty(key) ? theme[key] : config[key]);
}

// set config value
function setConfig(key, value) {
	if (value != null)
		localStorage.setItem('options.' + key, typeof config[key] === 'number' ? Number(value) : value);
	else {
		localStorage.removeItem('options.' + key);
		value = (theme.hasOwnProperty(key) ? theme[key] : config[key]);
	}
	// special case settings
	if (key == 'lock' || key == 'newtab' || key == 'show_root' || key.substring(0,6) == 'number')
		loadColumns();
	else if (key == 'theme') {
		if (value === 'System')
			theme = getSystemTheme();
		else
			theme = themes[value];
		for (var i in config) {
			if (i != key) {
				onChange(i);
				showConfig(i);
			}
		}
	} else if (key === 'show_timezones' || key.substring(0,3) === 'tz_') {
		renderTimezones();
	} else if (key === 'show_search') {
		// toggle only; search bar activated via keyboard shortcut
	} else if (key.substring(0,4) == 'show') {
		var id = key.substring(5);
		if (!value) {
			if (coords[id])
				removeRow(coords[id].x, coords[id].y);
			saveColumns();
		} else {
			saveColumns();
		}
	}
	onChange(key, value);
	return value;
}

// map config keys to styles
var styles = {};

function getStyle(key, value) {
	switch(key) {
		case 'font':
			return '#main a, #timezones, #search_input { font-family: "' + value + '"; }';
		case 'font_size':
			return '#main a { font-size: ' + (value / 10) + 'em; }';
		case 'font_weight':
			return '#main a { font-weight: ' + value + '; }';
		case 'font_color':
			return '#main a, .tz-label, .tz-time { color: ' + value + '; }';
		case 'background_color':
			return 'body { background-color: ' + value + '; }';
		case 'background_image':
			return 'body { background-image: url(' + value + '); }';
		case 'background_image_file':
			return 'body { background-image: url(' + value + '); }';
		case 'background_align':
			return 'body { background-position: ' + value + '; }';
		case 'background_repeat':
			return 'body { background-repeat: ' + value + '; }';
		case 'background_size':
			return 'body { background-size: ' + value + '; }';
		case 'highlight_font_color':
			return '#main a:hover { color: ' + value + '; }';
		case 'highlight_color':
			return '#main a:hover { background-color: ' + value + '; }';
		case 'shadow_color':
			return '#main a:hover { box-shadow: 0 0 ' + scale(getConfig('shadow_blur'), 7, 100) + 'px ' + value + '; }';
		case 'shadow_blur':
			return '#main a:hover { box-shadow: 0 0 ' + scale(value, 7, 100) + 'px ' + getConfig('shadow_color') + '; }';
		case 'highlight_round':
			return '#main a { border-radius: ' + scale(value, .2, 1.5) + 'em; }';
		case 'fade':
			return '#main a { transition-duration: ' + scale(value, .2, 1) + 's; }';
		case 'slide':
			return '.wrap { transition-duration: ' + scale(value, .2, 1) + 's; }';
		case 'spacing':
			return '#main a { line-height: ' + scale(value, 2, 5.6, .8) + '; ' +
							'padding-left: ' + scale(value, .8, 2, .4) + 'em; ' +
							'padding-right: ' + scale(value, .8, 2, .4) + 'em; }';
		case 'width':
			var w = getConfig('auto_scale') ?
				scale(value, 80, 100, 20) + '%' :
				scale(value, 1000, 3000, 400) + 'px';
			return '#main, #timezones, #search_bar { width: ' + w + '; }';
		case 'h_pos':
			var margin = 100 - scale(getConfig('width'), 80, 100, 20);
			return '#main { left: ' + scale(value, 0, margin/2, -margin/2) + '%; }';
		case 'v_margin':
			return '#main { margin-top: ' + (getConfig('auto_scale') ?
				scale(value, 5, 20) + '%' :
				scale(value, 80, 600) + 'px') + '; }';
		case 'hide_options':
			return '#options_button { opacity: 0; }';
		case 'css':
			return value;
		case 'auto_scale':
			return value ? null : '#main, #timezones, #search_bar { margin-top: 80px; width: 1000px; }';
		default:
			return null;
	}
}

// scales input value from [0,1,2] to [min,mid,max]
function scale(value, mid, max, min) {
	min = min || 0;
	return value > 1 ?
		mid + (value - 1) * (max - mid) :
		min + value * (mid - min);
}

// gets rgb representation of hex color
function hexToRgb(hex) {
	hex = /[a-f\d]{6}/i.exec(hex);
	var bigint = parseInt(hex, 16);
	var r = (bigint >> 16) & 255;
	var g = (bigint >> 8) & 255;
	var b = bigint & 255;
	return r + "," + g + "," + b;
}

// apply config value change
function onChange(key, value) {
	if (value == null)
		value = getConfig(key);

	if (value != config[key]) {
		var css = getStyle(key, value);
		if (css) {
			var style;
			if (styles.hasOwnProperty(key))
				style = styles[key];
			else {
				style = document.createElement('style');
				styles[key] = style;
			}
			document.head.appendChild(style);

			// add style rules
			style.innerText = css;
		}
	} else if (styles.hasOwnProperty(key)) {
		// remove rules
		styles[key].parentNode.removeChild(styles[key]);
		delete styles[key];
	}
	// refresh dependent values
	if (key == 'width')
		onChange('h_pos');
	else if (key == 'shadow_blur')
		onChange('shadow_color');
	else if (key == 'auto_scale') {
		onChange('width');
		onChange('v_margin');
	}

	// update options panel
	if (!settingsInitialized)
		return;

	// show/hide default button
	var input = document.getElementById('options_' + key);
	if (input) {
		var isDefault = value == (theme.hasOwnProperty(key) ? theme[key] : config[key]);
		input.reset.style.visibility = (isDefault ? 'hidden' : null);
		if (input.swatch)
			input.swatch.value = value;
	}
}

// loads config settings
function loadSettings() {
	// load theme
	var themeName = getConfig('theme');
	if (themeName === 'System')
		theme = typeof getSystemTheme === 'function' ? getSystemTheme() : {};
	else
		theme = themes[themeName] || {};
	// load settings
	for (var key in config)
		if (key === 'background_image_file')
			setTimeout(function() { onChange('background_image_file'); }, 0);
		else
			onChange(key);
}

// apply config values to input controls
function showConfig(key) {
	var input = document.getElementById('options_' + key);
	if (!input || input.type === 'file')
		return;

	input[input.type === 'checkbox' ? 'checked' : 'value'] = getConfig(key);
}

// initialize config settings
function initConfig(key) {
	var input = document.getElementById('options_' + key);
	if (!input)
		return;

	if (input.type == 'color') {
		input.type = 'text';
		input.className = 'color';
		var swatch = document.createElement('input');
		swatch.type = 'color';
		swatch.value = input.value;
		swatch.oninput = function(event) {
			input.value = this.value;
			return input.onchange(event);
		};
		input.swatch = swatch;
		input.parentNode.appendChild(swatch);
	}
	input.onchange = function(event) {
		if (input.type == 'file') {
			// load file
			if (event.target.files.length == 1) {
				var file = event.target.files[0];
				if (file.size > 2097152) {
					input.value = null;
					alert('Image must be less than 2 MB.');
					return false;
				}
				var reader = new FileReader();
				reader.onload = function(f) {
					if (f.target.result)
						setConfig(key, f.target.result);
				};
				reader.readAsDataURL(file);
			}
		} else
			setConfig(key, input.type == 'checkbox' ? Number(input.checked) : input.value);
	};

	var reset = document.createElement('a');
	reset.className = 'revert';
	reset.title = 'Reset to default';
	reset.tabIndex = 0;
	reset.onclick = function() {
		setConfig(key, null);
		showConfig(key);
		return false;
	};

	input.reset = reset;
	input.parentNode.appendChild(reset);
	showConfig(key);
}

var settingsInitialized = false;

// initialize options panel
function initSettings() {
	settingsInitialized = true;

	// options close button
	document.getElementById('options_close_button').onclick = function() {
		showOptions(false);
		return false;
	};

	// options submenu navigation
	var options = document.getElementById('options');
	var nav = document.getElementById('options_nav');
	var index = 0;
	for (var i=0; i<nav.children.length; i++) {
		var a = nav.children[i].firstChild;
		a.onclick = function(e) {
			// clear current style
			nav.children[index].firstChild.classList.remove('current');
			options.getElementsByClassName('section')[index].classList.remove('current');
			// apply new current style
			index = Array.prototype.indexOf.call(nav.children, this.parentNode);
			nav.children[index].firstChild.classList.add('current');
			options.getElementsByClassName('section')[index].classList.add('current');
			// show custom css on advanced tab
			if (index === nav.children.length-1) {
				var allcss = document.getElementById('all_css');
				allcss.value = '';
				for (var key in config) {
					var css = (getStyle(key, getConfig(key)));
					if (css && css.length < 1000 && key != 'css')
						allcss.value += css + '\n';
				}
			}
			// import/export
			if (index === nav.children.length-2) {
				var exports = document.getElementById('options_export');
				var imports = document.getElementById('options_import');
				var replacer = function(key, value) {
					if (key == 'options.background_image_file' || key == 'weather.cache' || key == 'favicon_cache') {
						return undefined;
					}
					return value;
				};
				exports.value = JSON.stringify(localStorage, replacer);
				imports.value = '';
				imports.placeholder = 'Paste exported settings here';
				imports.onchange = function() {
					try {
						var imported = JSON.parse(imports.value);
						for(var key in imported) {
							localStorage.setItem(key, imported[key]);
						}
						imports.value = '';
						imports.placeholder = 'Import successful!';
						exports.value = JSON.stringify(localStorage, replacer);
						loadSettings();
						loadColumns();
					} catch (e) {
						imports.value = '';
						imports.placeholder = 'Import error! Please check if your settings are valid JSON.';
					}
				};
			}
			return false;
		};
	}

	// add options to hide bookmark folders
	chrome.bookmarks.getTree(function(result) {
		var placeholder = document.getElementById('options_show_bookmarks');
		var nodes = result[0].children;
		for (var i = 0; i < nodes.length; i++) {
			var key = 'show_' + nodes[i].id;
			config[key] = 1;

			var span = document.createElement('span');
			span.innerText = nodes[i].title;

			var input = document.createElement('input');
			input.type = 'checkbox';
			input.id = 'options_' + key;

			var label = document.createElement('label');
			label.appendChild(span);
			label.appendChild(input);
			placeholder.appendChild(label);
		}

		// replace text input with system font list
		if (chrome.fontSettings) {
			var input = document.getElementById('options_font');
			var select = document.createElement('select');
			input.parentNode.replaceChild(select, input);
			select.id = input.id;
		}

		// populate timezone selects
		populateTimezoneSelects();

		// show settings
		for (var key in config)
			initConfig(key);

		// auto-fill labels when timezone changes
		bindTimezoneAutoLabel();

		loadSettings();

		// load themes
		var select = document.getElementById('options_theme');
		if (select.childNodes.length === 0) {
			for (var i in themes) {
				var option = document.createElement('option');
				option.value = i;
				option.innerText = i === 'System' ? 'System (auto)' : i;
				if (i == getConfig('theme'))
					option.selected = 'selected';
				select.appendChild(option);
			}
		}

		// load font list
		if (chrome.fontSettings) {
			chrome.fontSettings.getFontList(function(fonts) {
				var select = document.getElementById('options_font');
				if (select.childNodes.length > 0)
					return;

				fonts.unshift({ fontId: 'Sans-serif' });
				for (var i = 0; i < fonts.length; i++) {
					var font = fonts[i].fontId;
					var option = document.createElement('option');
					option.innerText = font;
					if (font == getConfig('font'))
						option.selected = 'selected';
					select.appendChild(option);
				}
			});
		}
	});
}

// show options panel
function showOptions(show) {
	document.getElementById('options').style.display = show ? 'block' : 'none';
	if (show) {
		if (!settingsInitialized)
			initSettings();
		for (var key in config)
			showConfig(key);
	}
}

// ===== Timezone Picker =====
var TZ_COMMON = [
	'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
	'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver',
	'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Sao_Paulo',
	'America/Argentina/Buenos_Aires', 'America/Santiago',
	'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin',
	'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Brussels',
	'Europe/Zurich', 'Europe/Vienna', 'Europe/Stockholm', 'Europe/Oslo',
	'Europe/Copenhagen', 'Europe/Helsinki', 'Europe/Warsaw', 'Europe/Prague',
	'Europe/Budapest', 'Europe/Bucharest', 'Europe/Athens', 'Europe/Istanbul',
	'Europe/Moscow', 'Europe/Kiev',
	'Asia/Dubai', 'Asia/Riyadh', 'Asia/Tehran', 'Asia/Karachi',
	'Asia/Kolkata', 'Asia/Colombo', 'Asia/Dhaka', 'Asia/Bangkok',
	'Asia/Jakarta', 'Asia/Singapore', 'Asia/Kuala_Lumpur',
	'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Taipei', 'Asia/Seoul',
	'Asia/Tokyo', 'Asia/Manila',
	'Australia/Perth', 'Australia/Adelaide', 'Australia/Sydney',
	'Australia/Melbourne', 'Australia/Brisbane',
	'Pacific/Auckland', 'Pacific/Fiji',
	'Africa/Cairo', 'Africa/Lagos', 'Africa/Nairobi',
	'Africa/Johannesburg', 'Africa/Casablanca',
	'UTC'
];

function tzCityName(tz) {
	var parts = tz.split('/');
	var city = parts[parts.length - 1];
	return city.replace(/_/g, ' ');
}

function populateTimezoneSelects() {
	// get all IANA timezones (modern browsers) or fall back to curated list
	var allTz;
	try {
		allTz = Intl.supportedValuesOf('timeZone');
	} catch(e) {
		allTz = TZ_COMMON.slice();
	}

	// group by region
	var regions = {};
	for (var i = 0; i < allTz.length; i++) {
		var tz = allTz[i];
		var slash = tz.indexOf('/');
		var region = slash > -1 ? tz.substring(0, slash) : 'Other';
		if (!regions[region]) regions[region] = [];
		regions[region].push(tz);
	}

	var regionOrder = ['America', 'Europe', 'Asia', 'Africa', 'Australia', 'Pacific', 'Atlantic', 'Indian', 'Antarctica', 'Arctic', 'Other'];

	for (var n = 1; n <= 4; n++) {
		var select = document.getElementById('options_tz_' + n);
		if (!select || select.tagName !== 'SELECT') continue;

		// empty option
		var empty = document.createElement('option');
		empty.value = '';
		empty.textContent = '— Select timezone —';
		select.appendChild(empty);

		// common timezones group first
		var commonGrp = document.createElement('optgroup');
		commonGrp.label = 'Common';
		for (var c = 0; c < TZ_COMMON.length; c++) {
			var opt = document.createElement('option');
			opt.value = TZ_COMMON[c];
			opt.textContent = tzCityName(TZ_COMMON[c]) + '  (' + TZ_COMMON[c] + ')';
			commonGrp.appendChild(opt);
		}
		select.appendChild(commonGrp);

		// all timezones grouped by region
		for (var r = 0; r < regionOrder.length; r++) {
			var rName = regionOrder[r];
			if (!regions[rName]) continue;
			var grp = document.createElement('optgroup');
			grp.label = 'All — ' + rName;
			for (var j = 0; j < regions[rName].length; j++) {
				var tzVal = regions[rName][j];
				var opt2 = document.createElement('option');
				opt2.value = tzVal;
				opt2.textContent = tzCityName(tzVal) + '  (' + tzVal + ')';
				grp.appendChild(opt2);
			}
			select.appendChild(grp);
		}
	}
}

function bindTimezoneAutoLabel() {
	for (var n = 1; n <= 4; n++) {
		(function(idx) {
			var select = document.getElementById('options_tz_' + idx);
			var labelInput = document.getElementById('options_tz_label_' + idx);
			if (!select || !labelInput) return;

			select.addEventListener('change', function() {
				// auto-fill label if it's empty or was previously auto-filled
				var current = labelInput.value.trim();
				var wasAuto = !current || labelInput.getAttribute('data-auto') === '1';
				if (wasAuto && select.value) {
					var city = tzCityName(select.value);
					labelInput.value = city;
					labelInput.setAttribute('data-auto', '1');
					setConfig('tz_label_' + idx, city);
				}
			});
			labelInput.addEventListener('input', function() {
				// user is manually editing, stop auto-filling
				labelInput.setAttribute('data-auto', '0');
			});
		})(n);
	}
}

// ===== Timezone Widget (card layout) =====
var tzOffsetMinutes = 0;
var tzInterval = null;
var tzCards = []; // { tz, timeEl, periodEl, dayEl, utcEl, offsetBadge }

function tzGetFullInfo(tz, offsetMinutes) {
	var now = new Date();
	now.setMinutes(now.getMinutes() + offsetMinutes);
	try {
		var parts24 = new Intl.DateTimeFormat('en-US', {
			timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
		}).formatToParts(now);
		var h = 0, m = 0, s = 0;
		for (var i = 0; i < parts24.length; i++) {
			if (parts24[i].type === 'hour') h = parseInt(parts24[i].value, 10);
			if (parts24[i].type === 'minute') m = parseInt(parts24[i].value, 10);
			if (parts24[i].type === 'second') s = parseInt(parts24[i].value, 10);
		}
		if (h === 24) h = 0;

		var dayFmt = new Intl.DateTimeFormat('en-US', {
			timeZone: tz, weekday: 'long', month: 'short', day: 'numeric'
		});

		// UTC offset
		var utcOffsetMin = tzGetUtcOffset(tz, now);
		var sign = utcOffsetMin >= 0 ? '+' : '-';
		var absOff = Math.abs(utcOffsetMin);
		var offH = Math.floor(absOff / 60);
		var offM = absOff % 60;
		var utcStr = 'UTC ' + sign + offH + (offM ? ':' + (offM < 10 ? '0' : '') + offM : '');

		// period — more granular for smooth visual transitions
		var period, periodEmoji, isDay;
		if (h >= 6 && h < 18) {
			isDay = true; period = 'Day'; periodEmoji = '\u2600\uFE0F';
		} else {
			isDay = false; period = 'Night'; periodEmoji = '\uD83C\uDF19';
		}

		var pad = function(n) { return n < 10 ? '0' + n : '' + n; };

		return {
			time: pad(h) + ':' + pad(m) + ':' + pad(s),
			date: dayFmt.format(now),
			utc: utcStr,
			period: period,
			periodEmoji: periodEmoji,
			isDay: isDay
		};
	} catch(e) {
		return { time: '--:--:--', date: '', utc: '', period: '', periodEmoji: '', isDay: true };
	}
}

function tzGetUtcOffset(tz, date) {
	try {
		var parts = new Intl.DateTimeFormat('en-US', {
			timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
			year: 'numeric', month: '2-digit', day: '2-digit'
		}).formatToParts(date);
		var h = 0, m = 0, Y = 0, M = 0, D = 0;
		for (var i = 0; i < parts.length; i++) {
			if (parts[i].type === 'hour') h = parseInt(parts[i].value, 10);
			if (parts[i].type === 'minute') m = parseInt(parts[i].value, 10);
			if (parts[i].type === 'year') Y = parseInt(parts[i].value, 10);
			if (parts[i].type === 'month') M = parseInt(parts[i].value, 10);
			if (parts[i].type === 'day') D = parseInt(parts[i].value, 10);
		}
		if (h === 24) h = 0;
		var local = ((Y * 400 + M * 32 + D) * 1440) + h * 60 + m;
		var uH = date.getUTCHours(), uM = date.getUTCMinutes();
		var uY = date.getUTCFullYear(), uMo = date.getUTCMonth() + 1, uD = date.getUTCDate();
		var utc = ((uY * 400 + uMo * 32 + uD) * 1440) + uH * 60 + uM;
		return local - utc;
	} catch(e) { return 0; }
}

function tzFormatOffset(minutes) {
	var sign = minutes >= 0 ? '+' : '-';
	var abs = Math.abs(minutes);
	var h = Math.floor(abs / 60);
	var m = abs % 60;
	return sign + h + 'h' + (m ? ' ' + m + 'm' : '');
}

function tzUpdateAll() {
	var resetEl = document.querySelector('.tz-reset');
	var offsetBadge = document.querySelector('.tz-offset-badge');
	if (resetEl) {
		if (tzOffsetMinutes !== 0) resetEl.classList.add('visible');
		else resetEl.classList.remove('visible');
	}
	if (offsetBadge) {
		if (tzOffsetMinutes !== 0) {
			offsetBadge.classList.add('visible');
			offsetBadge.textContent = tzFormatOffset(tzOffsetMinutes) + ' from now';
		} else {
			offsetBadge.classList.remove('visible');
		}
	}
	for (var j = 0; j < tzCards.length; j++) {
		var info = tzGetFullInfo(tzCards[j].tz, tzOffsetMinutes);
		tzCards[j].timeEl.textContent = info.time;
		tzCards[j].periodEl.textContent = info.period + ' ' + info.periodEmoji;
		tzCards[j].dateEl.textContent = info.date;
		tzCards[j].utcEl.textContent = info.utc;
		// toggle day/night theme on card
		var c = tzCards[j].card;
		if (info.isDay) {
			c.classList.add('tz-card-day');
			c.classList.remove('tz-card-night');
		} else {
			c.classList.add('tz-card-night');
			c.classList.remove('tz-card-day');
		}
	}
}

function renderTimezones() {
	var container = document.getElementById('timezones');
	container.innerHTML = '';
	tzCards = [];

	if (!getConfig('show_timezones')) {
		container.classList.remove('visible');
		if (tzInterval) { clearInterval(tzInterval); tzInterval = null; }
		return;
	}
	container.classList.add('visible');
	tzOffsetMinutes = 0;

	var homeIndex = parseInt(getConfig('tz_home'), 10) || 1;

	var cardsRow = document.createElement('div');
	cardsRow.className = 'tz-cards';

	for (var i = 1; i <= 4; i++) {
		var tz = getConfig('tz_' + i);
		var labelText = getConfig('tz_label_' + i);
		if (!tz || !labelText) continue;

		var isHome = (i === homeIndex);

		var card = document.createElement('div');
		card.className = 'tz-card' + (isHome ? ' tz-card-home' : '');

		// scroll hint
		var hint = document.createElement('div');
		hint.className = 'tz-scroll-hint';
		hint.textContent = '\u21C5 scroll';

		// header row: name + UTC
		var header = document.createElement('div');
		header.className = 'tz-card-header';
		var nameEl = document.createElement('span');
		nameEl.className = 'tz-card-name';
		nameEl.textContent = labelText;
		var utcEl = document.createElement('span');
		utcEl.className = 'tz-card-utc';
		header.appendChild(nameEl);
		header.appendChild(utcEl);

		// period
		var periodEl = document.createElement('div');
		periodEl.className = 'tz-card-period';

		// time
		var timeEl = document.createElement('div');
		timeEl.className = 'tz-card-time';

		// date
		var dateEl = document.createElement('div');
		dateEl.className = 'tz-card-date';

		card.appendChild(hint);
		card.appendChild(header);
		card.appendChild(periodEl);
		card.appendChild(timeEl);
		card.appendChild(dateEl);
		cardsRow.appendChild(card);

		tzCards.push({ tz: tz, timeEl: timeEl, periodEl: periodEl, dateEl: dateEl, utcEl: utcEl, card: card });

		// scroll to adjust time — scroll on any card adjusts all
		(function(cardEl) {
			cardEl.addEventListener('wheel', function(e) {
				e.preventDefault();
				var delta = e.deltaY < 0 ? 60 : -60; // scroll up = forward in time
				if (e.shiftKey) delta = delta > 0 ? 15 : -15; // shift = 15 min steps
				tzOffsetMinutes += delta;
				tzUpdateAll();
			}, { passive: false });
		})(card);
	}

	container.appendChild(cardsRow);

	// offset badge (shows how far from "now")
	var offsetBadge = document.createElement('div');
	offsetBadge.className = 'tz-offset-badge';
	container.appendChild(offsetBadge);

	// reset pill
	var resetWrap = document.createElement('div');
	resetWrap.className = 'tz-reset';
	var resetBtn = document.createElement('span');
	resetBtn.className = 'tz-reset-btn';
	resetBtn.textContent = 'Back to now';
	resetBtn.addEventListener('click', function() {
		tzOffsetMinutes = 0;
		tzUpdateAll();
	});
	resetWrap.appendChild(resetBtn);
	container.appendChild(resetWrap);

	tzUpdateAll();

	// tick every second for live seconds display
	if (tzInterval) clearInterval(tzInterval);
	tzInterval = setInterval(function() {
		tzUpdateAll();
	}, 1000);
}

// ===== Search / Filter =====
var searchVisible = false;

function showSearch(show) {
	var bar = document.getElementById('search_bar');
	var input = document.getElementById('search_input');
	searchVisible = show;
	if (show) {
		bar.classList.add('visible');
		input.value = '';
		input.focus();
		clearSearchFilter();
	} else {
		bar.classList.remove('visible');
		input.value = '';
		clearSearchFilter();
	}
}

function clearSearchFilter() {
	var items = document.querySelectorAll('#main li');
	for (var i = 0; i < items.length; i++)
		items[i].classList.remove('search-hidden');
}

function applySearchFilter(query) {
	if (!query) {
		clearSearchFilter();
		return;
	}
	query = query.toLowerCase();
	var items = document.querySelectorAll('#main li');
	for (var i = 0; i < items.length; i++) {
		var a = items[i].querySelector('a');
		if (!a) continue;
		var text = (a.textContent || '').toLowerCase();
		var href = (a.href || '').toLowerCase();
		var isFolder = a.classList.contains('folder');
		// always show folders so their children remain accessible
		if (isFolder) {
			items[i].classList.remove('search-hidden');
		} else if (text.indexOf(query) > -1 || href.indexOf(query) > -1) {
			items[i].classList.remove('search-hidden');
		} else {
			items[i].classList.add('search-hidden');
		}
	}
}

// ===== Dark Mode Auto-Detection (System theme) =====
var darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

function getSystemTheme() {
	return darkModeQuery.matches ? themes['Midnight'] : themes['Default'];
}

function onSystemThemeChange() {
	if (getConfig('theme') === 'System') {
		theme = getSystemTheme();
		for (var key in config) {
			if (key !== 'theme') {
				onChange(key);
				if (settingsInitialized) showConfig(key);
			}
		}
		renderTimezones();
	}
}

darkModeQuery.addEventListener('change', onSystemThemeChange);

// ===== Favicon Caching =====
var faviconCache = {};
var FAVICON_CACHE_KEY = 'favicon_cache';
var FAVICON_CACHE_MAX = 200;

function loadFaviconCache() {
	try {
		var data = localStorage.getItem(FAVICON_CACHE_KEY);
		if (data) faviconCache = JSON.parse(data);
	} catch(e) {
		faviconCache = {};
	}
}

function saveFaviconCache() {
	try {
		// prune if too large
		var keys = Object.keys(faviconCache);
		if (keys.length > FAVICON_CACHE_MAX) {
			var toRemove = keys.slice(0, keys.length - FAVICON_CACHE_MAX);
			for (var i = 0; i < toRemove.length; i++)
				delete faviconCache[toRemove[i]];
		}
		localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(faviconCache));
	} catch(e) {}
}

function cacheFavicon(url, dataUri) {
	if (dataUri && dataUri.length < 10000) {
		faviconCache[url] = dataUri;
		saveFaviconCache();
	}
}

loadFaviconCache();

// ===== Accessibility Helpers =====
function addAriaAttributes() {
	// options button
	var optBtn = document.getElementById('options_button');
	if (optBtn) {
		optBtn.setAttribute('role', 'button');
		optBtn.setAttribute('aria-label', 'Open options');
	}
	// close button
	var closeBtn = document.getElementById('options_close_button');
	if (closeBtn) {
		closeBtn.setAttribute('role', 'button');
		closeBtn.setAttribute('aria-label', 'Close options');
	}
}

// initialize page
loadSettings();
loadColumns();
addAriaAttributes();

// keyboard shortcuts
document.addEventListener('keypress', function(event) {
	if (event.keyCode == 13 && event.target && event.target.onclick && event.target.tagName == 'A') {
		event.target.dispatchEvent(new MouseEvent('click'));
		event.preventDefault();
	}
});
document.addEventListener('mousedown', function(event) {
	document.body.classList.add('hide-focus');
});
document.addEventListener('keydown', function(event) {
	document.body.classList.remove('hide-focus');

	// don't handle shortcuts if typing in an input
	var tag = event.target.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
		// Escape closes search bar
		if (event.keyCode === 27 && searchVisible) {
			showSearch(false);
			event.preventDefault();
		}
		return;
	}

	// "/" to open search
	if (event.key === '/' && getConfig('show_search')) {
		showSearch(true);
		event.preventDefault();
		return;
	}

	// Escape to collapse all open folders or close search
	if (event.keyCode === 27) {
		if (searchVisible) {
			showSearch(false);
		} else {
			var openFolders = document.querySelectorAll('#main a.open');
			for (var i = 0; i < openFolders.length; i++) {
				if (openFolders[i].onclick) openFolders[i].onclick();
			}
		}
		event.preventDefault();
		return;
	}

	// 1-9 to toggle top-level folders
	if (event.key >= '1' && event.key <= '9') {
		var folderIndex = parseInt(event.key, 10) - 1;
		var topFolders = document.querySelectorAll('#main > .column > ul > li > a.folder');
		if (folderIndex < topFolders.length && topFolders[folderIndex].onclick) {
			topFolders[folderIndex].onclick();
			event.preventDefault();
		}
		return;
	}
});

// search bar event handlers
document.getElementById('search_input').addEventListener('input', function() {
	applySearchFilter(this.value);
});
document.getElementById('search_close').addEventListener('click', function() {
	showSearch(false);
});

window.onresize = function(event) {
	updateTooltips();
};

// load options panel
document.getElementById('options_button').onclick = function() {
	showOptions(true);
	return false;
};
if (location.search === '?options')
	showOptions(true);

// render timezone widget
renderTimezones();

// refresh recently closed
if (chrome.sessions)
	chrome.sessions.onChanged.addListener(refreshClosed);
