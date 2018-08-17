/**
 * @class Oskari.mapframework.mapmodule.ControlsPlugin
 *
 * Adds mouse and keyboard controls to the map and adds tools controls
 * for zoombox and measurement (line/area). Also adds request handling for
 * ToolSelectionRequest, EnableMapKeyboardMovementRequest, DisableMapKeyboardMovementRequest,
 * EnableMapMouseMovementRequest and DisableMapMouseMovementRequest.
 * Overrides OpenLayers keyboard/mouse controls with PorttiKeyboard and PorttiMouse.
 *
 */
Oskari.clazz.define(
    'Oskari.mapframework.mapmodule.ControlsPlugin',
    /**
     * @static @method create called automatically on construction
     *
     *
     */
    function () {
        this._clazz = 'Oskari.mapframework.mapmodule.ControlsPlugin';
        this._name = 'ControlsPlugin';
        this.removedInteractions = [];
        this.addedInteractions = [];
    }, {
        /**
         * @public @method hasUI
         * This plugin doesn't have a UI, BUT it is controllable in publisher so it is added to map
         * when publisher starts -> always return true to NOT get second navControl on map when publisher starts
         * FIXME this is clearly a hack
         *
         * @return {Boolean} true
         */
        hasUI: function () {
            return true;
        },
        _startPluginImpl: function () {
            this._createMapInteractions();
        },
        _stopPluginImpl: function () {
            this._clearLifetimeInteractions();
        },
        _createEventHandlers: function () {
            return {
                'DrawingEvent': function (event) {
                    if (event.getId() !== 'measureline' && event.getId() !== 'measurearea') {
                        // this isn't about measurements, stop processing it
                        return;
                    }

                    var me = this;
                    var measureValue;
                    var data = event.getData();
                    var finished = event.getIsFinished();
                    var geoJson = event.getGeoJson();
                    var geomMimeType = 'application/json';

                    if (data.showMeasureOnMap) {
                        return;
                    }

                    // FIXME! Does StopDrawingRequest need to send drawingEvent?
                    if (finished) {
                        return;
                    }

                    if (data.shape === 'LineString') {
                        measureValue = data.lenght;
                    } else if (data.shape === 'Polygon') {
                        measureValue = data.area;
                    }
                    var reqBuilder = me.getSandbox().getRequestBuilder('ShowMapMeasurementRequest');
                    if (reqBuilder) {
                        me.getSandbox().request(me, reqBuilder(measureValue, finished, geoJson, geomMimeType));
                    }
                },
                'Toolbar.ToolSelectedEvent': function (event) {
                    if (event._toolId !== 'zoombox') {
                        this._clearLifetimeInteractions();
                    }
                },
                'Publisher2.ToolEnabledChangedEvent': function (event) {
                    if (event.getTool().getTool().id === this._clazz) {
                        if (!event._tool.isEnabled()) {
                            this.disableDragPan();
                        } else {
                            this._clearLifetimeInteractions();
                        }
                    }
                }
            };
        },

        _createRequestHandlers: function () {
            var me = this;
            var mapMovementHandler = Oskari.clazz.create('Oskari.mapframework.bundle.mapmodule.request.MapMovementControlsRequestHandler', me.getMapModule());
            return {
                'ToolSelectionRequest': Oskari.clazz.create(
                    'Oskari.mapframework.mapmodule.ToolSelectionHandler',
                    me.getSandbox(),
                    me
                ),
                'EnableMapKeyboardMovementRequest': mapMovementHandler,
                'DisableMapKeyboardMovementRequest': mapMovementHandler,
                'EnableMapMouseMovementRequest': mapMovementHandler,
                'DisableMapMouseMovementRequest': mapMovementHandler
            };
        },
        _clearLifetimeInteractions: function () {
            var me = this;
            this.addedInteractions.forEach(function (interaction) {
                me.getMap().removeInteraction(interaction);
            });
            this.removedInteractions.forEach(function (interaction) {
                me.getMap().addInteraction(interaction);
            });
            this.removedInteractions = [];
            this.addedInteractions = [];
        },
        disableDragPan: function () {
            var me = this;
            var disable = me.getMap().getInteractions().getArray().filter(function (interaction) {
                if (interaction instanceof ol.interaction.DragZoom) {
                    return interaction;
                }
                if (interaction instanceof ol.interaction.DragPan) {
                    return interaction;
                }
            });
            disable.forEach(function (toDisable) {
                me.getMap().removeInteraction(toDisable);
                me.removedInteractions.push(toDisable);
            });
        },
        mouseDragZoomInteraction: function () {
            var boxzoom = this.getMap().getInteractions().forEach(function (interaction) {
                if (interaction instanceof ol.interaction.DragZoom) {
                    return interaction;
                }
            });
            if (!boxzoom) {
                boxzoom = new ol.interaction.DragZoom({
                    condition: function (mapBrowserEvent) {
                        return ol.events.condition.mouseOnly(mapBrowserEvent);
                    }
                });
            }
            this.getMap().addInteraction(boxzoom);
        },
        /**
         * @private @method _createMapControls
         * Constructs/initializes necessary controls for the map. After this they can be added to the map
         * with _addMapControls().
         *
         */
        _createMapInteractions: function () {
            var me = this;
            var conf = me.getConfig();
            var mouseInteractionRemove = [];
            var kbInteractionRemove = [];
            var interactions = me.getMap().getInteractions();

            // Map movement/keyboard control
            if (conf.keyboardControls === false) {
                interactions.forEach(function (interaction) {
                    if (interaction instanceof ol.interaction.KeyboardPan || interaction instanceof ol.interaction.KeyboardZoom) {
                        kbInteractionRemove.push(interaction);
                    }
                });
                kbInteractionRemove.forEach(function (interaction) {
                    me.getMap().removeInteraction(interaction);
                });
            }

            // mouse control
            if (conf.mouseControls === false) {
                interactions.forEach(function (interaction) {
                    if (interaction instanceof ol.interaction.DragPan || interaction instanceof ol.interaction.MouseWheelZoom || interaction instanceof ol.interaction.DoubleClickZoom || interaction instanceof ol.interaction.DragZoom) {
                        mouseInteractionRemove.push(interaction);
                    }
                });
                mouseInteractionRemove.forEach(function (interaction) {
                    me.getMap().removeInteraction(interaction);
                });
            }
        }
    }, {
        extend: ['Oskari.mapping.mapmodule.plugin.AbstractMapModulePlugin'],
        /**
         * @static @property {string[]} protocol array of superclasses
         */
        protocol: [
            'Oskari.mapframework.module.Module',
            'Oskari.mapframework.ui.module.common.mapmodule.Plugin'
        ]
    });
