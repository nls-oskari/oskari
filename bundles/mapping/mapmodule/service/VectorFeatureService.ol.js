import olFormatGeoJSON from 'ol/format/GeoJSON';
import olFeature from 'ol/Feature';
import olRenderFeature from 'ol/render/Feature';
import { fromExtent } from 'ol/geom/Polygon';
import { HoverHandler } from './HoverHandler';
import {
    LAYER_ID, LAYER_TYPE, FTR_PROPERTY_ID, VECTOR_TYPE,
    SERVICE_HOVER, SERVICE_CLICK, SERVICE_LAYER_REQUEST
} from '../domain/constants';

/**
 * @class Oskari.mapframework.service.VectorFeatureService
 *
 * Handles map click and hover on VectorFeatures.
 * Handles layer configuration requests.
 */
Oskari.clazz.defineES('Oskari.mapframework.service.VectorFeatureService',
    class VectorFeatureService {
        constructor (sandbox, mapmodule) {
            this.__name = 'VectorFeatureService';
            this.__qname = 'Oskari.mapframework.service.VectorFeatureService';
            this._log = Oskari.log('VectorFeatureService');
            this._sandbox = sandbox;
            this._map = mapmodule.getMap();
            this._mapmodule = mapmodule;
            this._featureFormatter = new olFormatGeoJSON();
            this.layerTypeHandlers = {};
            this.defaultHandlers = {};
            this.hoverHandler = new HoverHandler(mapmodule);
            this._throttledHoverFeature = Oskari.util.throttle(this._hoverFeature.bind(this), 100);
            this._registerEventHandlers();
        }

        /**
         * @method _registerEventHandlers
         * Registers as handler for click and hover events.
         */
        _registerEventHandlers () {
            this._sandbox.registerForEventByName(this, 'MouseHoverEvent');
            this._sandbox.registerForEventByName(this, 'MapClickedEvent');
        }

        /**
         * @method getQName
         * @return {String} fully qualified name for service
         */
        getQName () {
            return this.__qname;
        }

        /**
         * @method getName
         * @return {String} service name
         */
        getName () {
            return this.__name;
        }

        /**
         * @method getSandbox
         * @return {Oskari.Sandbox}
         */
        getSandbox () {
            return this._sandbox;
        }

        /**
         * @method registerLayerType
         *
         * Registers layer type so layers of the type receive click and hover events and layer requests.
         * Performs common tasks on events. For ex. displaying tooltip and dispatching feature click events.
         *
         * @param { String} layerType
         * @param {Object} handlerImpl Object that contains handler functions onMapClicked, onMapHover or onLayerRequest | optional
         * @param {Array<String>} defaultHandlerDef Array of handler types ("click", "hover", "layerRequest")
         *  to be used as default handlers | optional
         */
        registerLayerType (layerType, handlerImpl, defaultHandlerDef) {
            if (!layerType) {
                return;
            }
            let layerTypeHandlers = this.layerTypeHandlers[layerType];
            if (!layerTypeHandlers) {
                layerTypeHandlers = {};
                this.layerTypeHandlers[layerType] = layerTypeHandlers;
            }
            if (handlerImpl) {
                if (typeof handlerImpl.onMapClicked === 'function') {
                    layerTypeHandlers[SERVICE_CLICK] = handlerImpl.onMapClicked.bind(handlerImpl);
                }
                if (typeof handlerImpl.onMapHover === 'function') {
                    layerTypeHandlers[SERVICE_HOVER] = handlerImpl.onMapHover.bind(handlerImpl);
                }
                if (typeof handlerImpl.onLayerRequest === 'function') {
                    layerTypeHandlers[SERVICE_LAYER_REQUEST] = handlerImpl.onLayerRequest.bind(handlerImpl);
                }
                if (Array.isArray(defaultHandlerDef)) {
                    defaultHandlerDef.forEach(handlerType => {
                        this.defaultHandlers[handlerType] = layerTypeHandlers[handlerType];
                    });
                }
            }
        }

        registerDefaultStyles (layerType, styles = {}) {
            if (!layerType) {
                return;
            }
            const { style, hover } = styles;
            if (style) {
                this.hoverHandler.setDefaultStyle(layerType, 'featureStyle', style);
            }
            if (hover) {
                this.hoverHandler.setDefaultStyle(layerType, 'hover', hover);
            }
        }

        /**
         * @method _getRegisteredHandler
         * @param {String} layerType
         * @param {String} handlerType
         * @returns Registered handler function for layer type or null
         */
        _getRegisteredHandler (layerType, handlerType) {
            if (layerType && handlerType) {
                const layerTypeHandlers = this.layerTypeHandlers[layerType];
                const handler = layerTypeHandlers ? layerTypeHandlers[handlerType] : null;
                if (typeof handler === 'function') {
                    return handler;
                }
            }
        }

        /**
         * @method _getDefaultHandler
         * @param {String} handlerType
         * @returns Default handler function for handlerType or null
         */
        _getDefaultHandler (handlerType) {
            if (handlerType) {
                const handler = this.defaultHandlers[handlerType];
                if (typeof handler === 'function') {
                    return handler;
                }
            }
        }

        /**
         * @method handleVectorLayerRequest
         * Passes the request to a proper layer handler
         *
         * @param {Oskari.mapframework.bundle.mapmodule.request.VectorLayerRequest} request
         */
        handleVectorLayerRequest (request) {
            const layerId = request.getOptions().layerId;
            const defaultHandler = this._getDefaultHandler(SERVICE_LAYER_REQUEST);
            if (!layerId) {
                if (defaultHandler) {
                    defaultHandler(request);
                }
                return;
            }
            const mapLayerService = this.getSandbox().getService('Oskari.mapframework.service.MapLayerService');
            if (mapLayerService) {
                const layer = mapLayerService.findMapLayer(layerId);
                const handler = layer ? this._getRegisteredHandler(layer.getLayerType(), SERVICE_LAYER_REQUEST) : defaultHandler;
                if (handler) {
                    handler(request, layer);
                }
            }
        }

        /**
         * @method _onlyRegisteredTypesFilter
         * Filter function to filter only registered layer types
         * @param {olLayer} layer
         * @return {boolean} true if layer's type is registered.
         */
        _onlyRegisteredTypesFilter (layer) {
            const layerType = layer.get(LAYER_TYPE);
            return layerType && !!this.layerTypeHandlers[layerType];
        }

        /**
         * @method _getTopmostFeatureAndLayer
         * @param {Oskari.mapframework.event.common.MouseHoverEvent} event
         * @return {Object} Object containing the topmost feature and it's layer on the mouse location.
         * An empty object if features were not found.
         */
        _getTopmostFeatureAndLayer (event) {
            const pixel = [event.getPageX(), event.getPageY()];
            const featureHitCb = (feature, layer) => ({ feature, layer });
            let ftrAndLyr;
            try {
                ftrAndLyr = this._map.forEachFeatureAtPixel(pixel, featureHitCb, {
                    layerFilter: layer => this._onlyRegisteredTypesFilter(layer)
                });
            } catch (ex) {
                if (ex.message === `Cannot read property 'forEachFeatureAtCoordinate' of undefined`) {
                    this._log.debug('Could not find features at hover location. Omitted ol renderer error:\n', ex);
                } else {
                    throw ex;
                }
            }
            return ftrAndLyr || {};
        }

        /**
         * @method _onMapHover
         * Finds the topmost feature from the layers controlled by the service and handles hover tooltip for the feature.
         *
         * @param {Oskari.mapframework.event.common.MouseHoverEvent} event
         */
        _onMapHover (event) {
            // don't hover while drawing
            if (event.isDrawing()) {
                return;
            }
            if (this._sandbox.getMap().isMoving()) {
                return;
            }
            this.hoverHandler.onMapHover(event);
            this._throttledHoverFeature(event);
        }

        _hoverFeature (event) {
            let { feature, layer } = this._getTopmostFeatureAndLayer(event);

            if (feature && layer) {
                if (feature && feature.get('features')) {
                    // Cluster source
                    if (feature.get('features').length > 1) {
                        return;
                    }
                    // Single feature
                    feature = feature.get('features')[0];
                }
            }
            // Vectorhandler updates vector layers' feature styles but tooltip is handled by hoverhandler
            const vectorHandler = this._getRegisteredHandler(VECTOR_TYPE, SERVICE_HOVER);
            vectorHandler(event, feature, layer);
            this.hoverHandler.onFeatureHover(event, feature, layer);
        }

        createHoverLayer (layer, source) {
            return this.hoverHandler.createHoverLayer(layer, source);
        }

        setVectorLayerHoverTooltip (layer) {
            this.hoverHandler.setTooltipContent(layer);
        }

        /**
         * @method _getGeojson
         *
         * Returns geojson for feature.
         * If the feature is read-only (olRenderFeature), creates a geojson of the feature's extent.
         *
         * @param {olFeature | olRenderFeature} feature
         * @return geojson
         */
        _getGeojson (feature) {
            if (feature instanceof olRenderFeature) {
                const polygon = fromExtent(feature.getExtent());
                const ftr = new olFeature(polygon);
                ftr.setProperties(feature.getProperties());
                return this._featureFormatter.writeFeaturesObject([ftr]);
            } else {
                return this._featureFormatter.writeFeaturesObject([feature]);
            }
        }

        /**
         *  @method _onMapClicked
         * Find features from the layers controlled by the service and handle clicks for all those features.
         * Calls registered click handlers.
         *
         * @param {Oskari.mapframework.bundle.mapmodule.event.MapClickedEvent} event
         */
        _onMapClicked (event) {
            const me = this;
            let clickHits = [];
            this._mapmodule.forEachFeatureAtPixel([event.getMouseX(), event.getMouseY()], (feature, layer) => {
                if (!layer) {
                    return;
                }
                if (feature.get('features')) {
                    // Cluster source
                    if (feature.get('features').length > 1) {
                        return;
                    }
                    // Single feature
                    feature = feature.get('features')[0];
                }
                const layerType = layer.get(LAYER_TYPE);
                const isRegisteredLayerType = layerType && me.layerTypeHandlers[layerType];
                if (isRegisteredLayerType) {
                    const handler = me._getRegisteredHandler(layerType, SERVICE_CLICK);
                    if (handler) {
                        handler(event, feature, layer);
                    }
                    clickHits.push({ feature, layer });
                }
            });
            if (clickHits.length > 0) {
                const clickEvent = Oskari.eventBuilder('FeatureEvent')().setOpClick();
                clickHits.forEach(obj => {
                    const { feature, layer } = obj;
                    const geojson = me._getGeojson(feature, layer);
                    const propertyId = feature.get(FTR_PROPERTY_ID);
                    const layerId = layer.get(LAYER_ID);
                    clickEvent.addFeature(propertyId, geojson, layerId);
                });
                me.getSandbox().notifyAll(clickEvent);
            }
        }
        /**
         * @public @method onEvent
         * Event is handled forwarded to correct #eventHandlers if found or
         * discarded* if not.
         *
         * @param {Oskari.mapframework.event.Event} event a Oskari event object
         */
        onEvent (event) {
            switch (event.getName()) {
            case 'MouseHoverEvent':
                this._onMapHover(event); break;
            case 'MapClickedEvent':
                this._onMapClicked(event); break;
            }
        }
    }
    , {
        /**
         * @property {String[]} protocol array of superclasses as {String}
         * @static
         */
        'protocol': ['Oskari.mapframework.service.Service']
    }
);
