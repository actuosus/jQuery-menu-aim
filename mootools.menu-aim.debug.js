/**
 * Created by actuosus on 8/19/13.
 * @author Arthur Chafonov <actuosus@gmail.com>
 * Port from https://github.com/kamens/jQuery-menu-aim
 * @linkcode https://github.com/actuosus/jQuery-menu-aim
 * @requires MooTools
 * @version 0.1.1
 */

/* globals Class: true, Options: true, Events: true */

;(function () {
    'use strict';

    function noop() {
    }

    this.MenuAim = new Class({

        Implements: [Options, Events],

        options: {
            rowSelector: "> li",
            submenuSelector: "*",
            submenuDirection: "right",
            tolerance: 75,  // bigger = more forgivey when entering submenu
            delay: 300,  // ms delay when user appears to be entering submenu

            enter: noop,
            exit: noop,
            activate: noop,
            deactivate: noop,
            exitMenu: noop
        },

        initialize: function (element, options) {
            this.setOptions(options);
            this.element = document.id(element);
            this.activeRow = null;
            this.mouseLocs = [];
            this.lastDelayLoc = null;
            this.timeoutId = null;

            this.MOUSE_LOCS_TRACKED = 3;  // number of past mouse locations to track

            this._addDebugLayer();

            this.attach();
        },

        destroy: function () {
            this.detach();
        },

        attach: function () {
            this.bounds = {
                elementLeave: this.elementLeave.bind(this),
                documentMouseMove: this.documentMouseMove.bind(this),
                rowEnter: this.rowEnter.bind(this),
                rowLeave: this.rowLeave.bind(this),
                rowClick: this.rowClick.bind(this)
            };
            this.relayedEvents = {};
            this.relayedEvents['mouseenter:relay(' + this.options.rowSelector + ')'] = this.bounds.rowEnter;
            this.relayedEvents['touchstart:relay(' + this.options.rowSelector + ')'] = this.bounds.rowEnter;
            this.relayedEvents['mouseleave:relay(' + this.options.rowSelector + ')'] = this.bounds.rowLeave;
            this.relayedEvents['click:relay(' + this.options.rowSelector + ')'] = this.bounds.rowClick;
            this.element.addEvent('mouseleave', this.bounds.elementLeave);
            this.element.addEvents(this.relayedEvents);
            document.addEvent('mousemove', this.bounds.documentMouseMove.bind(this));
        },

        detach: function () {
            this.element.removeEvent('mouseleave', this.bounds.elementLeave);
            this.element.removeEvents(this.relayedEvents);
            document.removeEvent('mousemove', this.bounds.documentMouseMove);
        },

        /**
         * Keep track of the last few locations of the mouse.
         */
        documentMouseMove: function (e) {
            this.mouseLocs.push({x: e.page.x, y: e.page.y});

            if (this.mouseLocs.length > this.MOUSE_LOCS_TRACKED) {
                this.mouseLocs.shift();
            }
        },

        /**
         * Cancel possible row activations when leaving the menu entirely
         */
        elementLeave: function (e) {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }

            // If exitMenu is supplied and returns true, deactivate the
            // currently active row on menu exit.
            if (this.options.exitMenu(e.target)) {
                if (this.activeRow) {
                    this.options.deactivate(this.activeRow);
                }

                this.activeRow = null;
            }
        },

        /**
         * Trigger a possible row activation whenever entering a new row.
         */
        rowEnter: function (event, row) {
            if (this.timeoutId) {
                // Cancel any previous activation delays
                clearTimeout(this.timeoutId);
            }

            this.options.enter(row);
            this._showDebugLayer();
            this.possiblyActivate(row);
        },

        rowLeave: function (event, row) {
            this.options.exit(row);
        },

        /**
         * Immediately activate a row if the user clicks on it.
         */
        rowClick: function (event, row) {
            this.activateRow(row);
        },

        _addDebugLayer: function () {
            this.debug = {
                canvas: document.createElement('canvas')
            };
            this.debug.ctx = this.debug.canvas.getContext('2d');
            this.debug.canvas.style.position = 'absolute';
            this.debug.canvas.style.backgroundColor = 'rgba(255,0,0,0.2)';
            document.body.appendChild(this.debug.canvas);

            this.debug.canvas.addEvent('mouseleave', this._debugLayerMouseLeave.bind(this));
            this.debug.canvas.addEvent('mousemove', this._debugLayerMouseMove.bind(this));
        },

        _debugLayerMouseMove: function (e) {
            var treeWalker = document.createTreeWalker(
                this.element,
                NodeFilter.SHOW_ELEMENT,
                { acceptNode: function (node) {
                    return NodeFilter.FILTER_ACCEPT;
                } },
                false
            );

            var coordinates, found;
            while (treeWalker.nextNode()) {
                coordinates = treeWalker.currentNode.getCoordinates();
                if (coordinates.left <= e.page.x && coordinates.left + coordinates.width >= e.page.x) {
                    if (coordinates.top <= e.page.y && coordinates.top + coordinates.height >= e.page.y) {
                        found = treeWalker.currentNode;
                        if (found && found.match(this.options.rowSelector)) {
                            this.bounds.rowEnter(null, found);
                        }
                    }
                }
            }
        },

        _debugLayerMouseLeave: function () {
            this._hideDebugLayer();
        },

        _drawDebugLayer: function (loc, offset, upperRight, lowerRight, upperLeft, lowerLeft, delay) {
            var debug = this.debug;
            var canvas = debug.canvas;
            var ctx = canvas.ctx;
            var blockWidth = offset.width;
            var blockHeight = lowerRight.y - upperRight.y;
            canvas.style.left = upperLeft.x + 'px';
            canvas.style.top = offset.top - this.options.tolerance + 'px';
            canvas.style.zIndex = 10000;
            canvas.width = blockWidth;
            canvas.height = blockHeight;

            ctx.clearRect(0, 0, blockWidth, blockHeight);
            // Triangle
            var triangleOpacity = 0.3 + delay / 1000;
            ctx.beginPath();
            ctx.moveTo(loc.x - upperLeft.x, loc.y - upperLeft.y);
            if (this.options.submenuDirection === 'left') {
                ctx.lineTo(upperRight.x - upperLeft.x, upperRight.y - upperLeft.y);
                ctx.lineTo(lowerRight.x - upperLeft.x, lowerRight.y - upperLeft.y);
            } else if (this.options.submenuDirection === 'below') {
                ctx.lineTo(0, lowerRight.y - upperRight.y);
                ctx.lineTo(upperRight.x - upperLeft.x, lowerRight.y - upperRight.y);
            } else if (this.options.submenuDirection === 'above') {
                ctx.lineTo(0, 0);
                ctx.lineTo(upperRight.x - upperLeft.x, 0);
            } else {
                ctx.lineTo(upperRight.x - upperLeft.x, upperRight.y - upperLeft.y);
                ctx.lineTo(lowerRight.x - upperLeft.x, lowerRight.y - upperLeft.y);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 0, 200, ' + triangleOpacity + ')';
            ctx.fill();

            var radius = 5;
            ctx.beginPath();
            ctx.arc(loc.x - upperLeft.x, loc.y - upperLeft.y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = 'rgba(20, 255, 20, 0.5)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#003300';
            ctx.stroke();
        },

        _showDebugLayer: function () {
            this.debug.canvas.style.display = 'block';
        },

        _hideDebugLayer: function () {
            this.debug.canvas.style.display = 'none';
        },

        /**
         * Return the amount of time that should be used as a delay before the
         * currently hovered row is activated.
         *
         * Returns 0 if the activation should happen immediately. Otherwise,
         * returns the number of milliseconds that should be delayed before
         * checking again to see if the row should be activated.
         */
        activationDelay: function () {
            if (!this.activeRow || !this.activeRow.match(this.options.submenuSelector)) {
                // If there is no other submenu row already active, then
                // go ahead and activate immediately.
                return 0;
            }

            var offset = this.element.getCoordinates(),
                upperLeft = {
                    x: offset.left,
                    y: offset.top - this.options.tolerance
                },
                upperRight = {
                    x: offset.left + offset.width,
                    y: upperLeft.y
                },
                lowerLeft = {
                    x: offset.left,
                    y: offset.top + offset.height + this.options.tolerance
                },
                lowerRight = {
                    x: offset.left + offset.width,
                    y: lowerLeft.y
                },
                loc = this.mouseLocs[this.mouseLocs.length - 1],
                prevLoc = this.mouseLocs[0];

            if (!loc) {
                return 0;
            }

            if (!prevLoc) {
                prevLoc = loc;
            }

            this._drawDebugLayer(loc, offset, upperRight, lowerRight, upperLeft, lowerLeft, 0);


            if (prevLoc.x < offset.left || prevLoc.x > lowerRight.x ||
                prevLoc.y < offset.top || prevLoc.y > lowerRight.y) {
                // If the previous mouse location was outside of the entire
                // menu's bounds, immediately activate.
                return 0;
            }

            if (this.lastDelayLoc &&
                loc.x === this.lastDelayLoc.x && loc.y === this.lastDelayLoc.y) {
                // If the mouse hasn't moved since the last time we checked
                // for activation status, immediately activate.
                return 0;
            }

            // Detect if the user is moving towards the currently activated
            // submenu.
            //
            // If the mouse is heading relatively clearly towards
            // the submenu's content, we should wait and give the user more
            // time before activating a new row. If the mouse is heading
            // elsewhere, we can immediately activate a new row.
            //
            // We detect this by calculating the slope formed between the
            // current mouse location and the upper/lower right points of
            // the menu. We do the same for the previous mouse location.
            // If the current mouse location's slopes are
            // increasing/decreasing appropriately compared to the
            // previous's, we know the user is moving toward the submenu.
            //
            // Note that since the y-axis increases as the cursor moves
            // down the screen, we are looking for the slope between the
            // cursor and the upper right corner to decrease over time, not
            // increase (somewhat counterintuitively).
            function slope(a, b) {
                return (b.y - a.y) / (b.x - a.x);
            }

            var decreasingCorner = upperRight,
                increasingCorner = lowerRight;

            // Our expectations for decreasing or increasing slope values
            // depends on which direction the submenu opens relative to the
            // main menu. By default, if the menu opens on the right, we
            // expect the slope between the cursor and the upper right
            // corner to decrease over time, as explained above. If the
            // submenu opens in a different direction, we change our slope
            // expectations.
            if (this.options.submenuDirection === "left") {
                decreasingCorner = lowerLeft;
                increasingCorner = upperLeft;
            } else if (this.options.submenuDirection === "below") {
                decreasingCorner = lowerRight;
                increasingCorner = lowerLeft;
            } else if (this.options.submenuDirection === "above") {
                decreasingCorner = upperLeft;
                increasingCorner = upperRight;
            }

            var decreasingSlope = slope(loc, decreasingCorner),
                increasingSlope = slope(loc, increasingCorner),
                prevDecreasingSlope = slope(prevLoc, decreasingCorner),
                prevIncreasingSlope = slope(prevLoc, increasingCorner);

            if (decreasingSlope < prevDecreasingSlope &&
                increasingSlope > prevIncreasingSlope) {
                // Mouse is moving from previous location towards the
                // currently activated submenu. Delay before activating a
                // new menu row, because user may be moving into submenu.
                this.lastDelayLoc = loc;
                this._drawDebugLayer(loc, offset, upperRight, lowerRight, upperLeft, lowerLeft, this.options.delay);
                return this.options.delay;
            }

            this.lastDelayLoc = null;
            return 0;
        },

        /**
         * Possibly activate a menu row. If mouse movement indicates that we
         * shouldn't activate yet because user may be trying to enter
         * a submenu's content, then delay and check again later.
         */
        possiblyActivate: function (row) {
            var delay = this.activationDelay();
            var _this = this;

            if (delay) {
                this.timeoutId = setTimeout(function () {
                    _this.possiblyActivate(row);
                }, delay);
            } else {
                this.activateRow(row);
            }
        },

        /**
         * Activate a menu row.
         */
        activateRow: function (row) {
            if (row === this.activeRow) {
                return;
            }
            if (this.activeRow) {
                this.options.deactivate(this.activeRow);
            }

            this.options.activate(row);
            this.activeRow = row;
        }
    });
})();