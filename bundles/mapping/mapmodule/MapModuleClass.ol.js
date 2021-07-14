
import * as olExtent from 'ol/extent';
import { defaults as olInteractionDefaults } from 'ol/interaction';
import KeyboardPan from 'ol/interaction/KeyboardPan';
import KeyboardZoom from 'ol/interaction/KeyboardZoom';
import { noModifierKeys, targetNotEditable } from 'ol/events/condition';
import Collection from 'ol/Collection';
import olFormatWKT from 'ol/format/WKT';
import olFormatGeoJSON from 'ol/format/GeoJSON';
import olView from 'ol/View';
import { METERS_PER_UNIT as olProjUnitsMETERS_PER_UNIT } from 'ol/proj/Units';
import * as olProjProj4 from 'ol/proj/proj4';
import * as olProj from 'ol/proj';
import { easeOut } from 'ol/easing';
import olMap from 'ol/Map';
import 'ol/ol.css';
import { defaults as olControlDefaults } from 'ol/control';
import * as olSphere from 'ol/sphere';
import * as olGeom from 'ol/geom';
import { fromCircle } from 'ol/geom/Polygon';
import olFeature from 'ol/Feature';
import { OskariImageWMS } from './plugin/wmslayer/OskariImageWMS';
import { getOlStyle } from './oskariStyle/generator.ol';
import { LAYER_ID } from '../mapmodule/domain/constants';
import proj4 from '../../../libraries/Proj4js/proj4js-2.2.1/proj4-src.js';
// import code so it's usable via Oskari global
import './AbstractMapModule';
import './plugin/AbstractMapModulePlugin';
import './plugin/BasicMapModulePlugin';
import './AbstractMapLayerPlugin';

const AbstractMapModule = Oskari.clazz.get('Oskari.mapping.mapmodule.AbstractMapModule');

if (!window.proj4) {
    window.proj4 = proj4;
}
export class MapModule extends AbstractMapModule {
    constructor (id, imageUrl, options, mapDivId) {
        super(id, imageUrl, options, mapDivId);
        this._dpi = 72; //   25.4 / 0.28;  use OL2 dpi so scales are calculated the same way
        this.log = Oskari.log('MapModule');
    }

    /**
     * @method _initImpl
     * Implements Module protocol init method. Creates the OpenLayers Map.
     * @param {Oskari.Sandbox} sandbox
     * @return {OpenLayers.Map}
     */
    _initImpl (sandbox, options, map) {
        // css references use olMap as selectors so we need to add it
        this.getMapEl().addClass('olMap');
        return map;
    }

    /**
     * @method createMap
     * Creates Openlayers 3 map implementation
     * @return {ol/Map}
     */
    createMap () {
        var me = this;
        olProjProj4.register(window.proj4);
        // this is done BEFORE enhancement writes the values to map domain
        // object... so we will move the map to correct location
        // by making a MapMoveRequest in application startup
        var controls = olControlDefaults({
            zoom: false,
            attribution: true,
            attributionOptions: {
                collapsible: false
            },
            rotate: false
        });

        var map = new olMap({
            keyboardEventTarget: document,
            target: this.getMapElementId(),
            controls: controls,
            interactions: this._initInteractions(),
            moveTolerance: 2
        });

        var projection = olProj.get(me.getProjection());
        projection.setExtent(this.__boundsToArray(this.getMaxExtent()));

        const viewOpts = {
            extent: projection.getExtent(),
            projection: projection,
            // actual startup location is set with MapMoveRequest later on
            // still these need to be set to prevent errors
            center: [0, 0],
            zoom: 0,
            resolutions: this.getResolutionArray(),
            constrainResolution: true
        };

        const worldProjections = ['EPSG:3857', 'EPSG:4326'];
        if (!worldProjections.includes(me.getProjection())) {
            // constraint center to extent allowing viewport to extend beyond extent for "local" projections
            viewOpts.constrainOnlyCenter = true;
        }

        map.setView(new olView(viewOpts));

        me._setupMapEvents(map);
        return map;
    }

    /**
     * Creates interactions for map.
     * Fixes keyboard event bubbling from focusable elements.
     */
    _initInteractions () {
        const interactionOptions = {
            altShiftDragRotate: false,
            pinchRotate: false
        };
        const keyboardInteractionOptions = {
            condition: mapBrowserEvent => {
                if (!noModifierKeys(mapBrowserEvent) || !targetNotEditable(mapBrowserEvent)) {
                    return false;
                }
                const { originalEvent } = mapBrowserEvent;
                if (originalEvent && originalEvent.target) {
                    return !['INPUT', 'SELECT', 'TEXTAREA'].includes(originalEvent.target.tagName);
                }
                return true;
            }
        };
        const interactions = olInteractionDefaults(interactionOptions).getArray()
            .map(interaction => {
                if (interaction instanceof KeyboardPan) {
                    return new KeyboardPan(keyboardInteractionOptions);
                }
                if (interaction instanceof KeyboardZoom) {
                    return new KeyboardZoom(keyboardInteractionOptions);
                }
                return interaction;
            });
        return new Collection(interactions, { unique: true });
    }

    /**
     * Add map event handlers
     * @method @private _setupMapEvents
     */
    _setupMapEvents (map) {
        var me = this;
        var sandbox = me._sandbox;

        map.on('moveend', function (evt) {
            me.notifyMoveEnd();
        });
        map.on('movestart', function (evt) {
            me.notifyStartMove();
        });

        function getElementPath (element) {
            if (!element) {
                return [];
            }

            const path = [];
            while (element.parentNode !== null) {
                path.push(element);
                element = element.parentNode;
            }
            return path;
        }

        function wasInfoBoxClicked (event) {
            // - Chrome supports event.path.
            // - Most others composedPath() https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath
            // - Polyfilled for IE/Edge on src/polyfills.js
            var path = event.path || (event.composedPath && event.composedPath()) || [];
            if (!path.length) {
                // For some reason Firefox returns an empty array and as we _have_ clicked the map there _should_ at least be the map in the path
                // try it again...
                path = getElementPath(event.target) || [];
            }
            const foundInfoBox = path.find(item => (item.className || '').indexOf('olPopup') !== -1);
            return typeof foundInfoBox !== 'undefined';
        }

        map.on('singleclick', function (evt) {
            if (me.getDrawingMode()) {
                return;
            }
            if (wasInfoBoxClicked(evt.originalEvent)) {
                // After OL 6 upgrade:
                // - ol/MapBrowserEventHandler.emulateClick_ receives map click, dispatches it and schedules it to be triggered again after small delay
                // - infobox/OpenlayersPopupPlugin receives the click in _setClickEvent() popupElement.onclick -> closes the popup so it's no longer on map
                // - the delayed event from emulateClick_ triggers and detects that there is no overlay on the spot that was
                //   clicked (since infobox was removed from that spot on the previous step) triggering a new MapClickedEvent and opening another infobox
                return;
            }

            var CtrlPressed = evt.originalEvent.ctrlKey;
            var lonlat = {
                lon: evt.coordinate[0],
                lat: evt.coordinate[1]
            };
            var mapClickedEvent = Oskari.eventBuilder('MapClickedEvent')(lonlat, evt.pixel[0], evt.pixel[1], CtrlPressed);
            sandbox.notifyAll(mapClickedEvent);
        });
        map.on('dblclick', function () {
            if (me.getDrawingMode()) {
                return false;
            }
        });

        map.on('pointermove', function (evt) {
            clearTimeout(this.mouseMoveTimer);
            this.mouseMoveTimer = setTimeout(function () {
                // No mouse move in 1000 ms - mouse move paused
                var hoverEvent = Oskari.eventBuilder('MouseHoverEvent')(
                    evt.coordinate[0],
                    evt.coordinate[1],
                    true,
                    evt.pixel[0],
                    evt.pixel[1],
                    me.getDrawingMode()
                );
                sandbox.notifyAll(hoverEvent);
            }, 1000);
            var hoverEvent = Oskari.eventBuilder('MouseHoverEvent')(
                evt.coordinate[0],
                evt.coordinate[1],
                false,
                evt.pixel[0],
                evt.pixel[1],
                me.getDrawingMode());
            sandbox.notifyAll(hoverEvent);
        });
    }

    _registerVectorFeatureService () {
        const sandbox = this._sandbox;
        let ftrService = sandbox.getService('Oskari.mapframework.service.VectorFeatureService');
        if (!ftrService) {
            ftrService = Oskari.clazz.create('Oskari.mapframework.service.VectorFeatureService', sandbox, this);
            sandbox.registerService(ftrService);
        }
        this.requestHandlers.vectorLayerRequestHandler = Oskari.clazz.create(
            'Oskari.mapframework.bundle.mapmodule.request.VectorLayerRequestHandler',
            sandbox,
            ftrService
        );
        sandbox.requestHandler('VectorLayerRequest', this.requestHandlers.vectorLayerRequestHandler);
    }

    /**
     * @private @method registerRPCFunctionsImpl
     * Register RPC functions
     */
    _registerRPCFunctionsImpl () {
        const sandbox = this._sandbox;
        const me = this;
        const rpcService = sandbox.getService('Oskari.mapframework.bundle.rpc.service.RpcService');

        if (!rpcService) {
            return;
        }

        rpcService.addFunction('getScreenshot', function () {
            return new Promise((resolve, reject) => {
                me.getScreenshot(image => resolve(image));
            });
        });
    }

    _startImpl () {
        this._registerVectorFeatureService();
        this.getMap().render();
        return true;
    }

    /**
     * @override @method getStyle
     * @param styleDef Oskari style definition
     * @param geomType One of 'line', 'dot', 'area' | optional
     * @param requestedStyle layer's or feature's style definition (not overrided with defaults)
     * @return {ol/style/Style}
     **/
    getStyle (styleDef, geomType, requestedStyle) {
        return getOlStyle(this, styleDef, geomType, requestedStyle);
    }

    getGeomTypedStyles (styleDef) {
        const styles = {
            area: this.getStyle(styleDef, 'area'),
            line: this.getStyle(styleDef, 'line'),
            dot: this.getStyle(styleDef, 'dot')
        };
        if (styleDef.text) {
            styles.labelProperty = styleDef.text.labelProperty;
        }
        return styles;
    };

    getDefaultMarkerSize () {
        return this._defaultMarker.size;
    }

    /**
     * @method _getFeaturesAtPixelImpl
     * To get feature properties at given mouse location on screen / div element.
     * @param  {Float} x
     * @param  {Float} y
     * @return {Array} list containing objects with props `properties` and  `layerId`
     */
    _getFeaturesAtPixelImpl (x, y) {
        const hits = [];
        const addHit = (ftr, layer) => {
            hits.push({
                featureProperties: ftr.getProperties(),
                layerId: layer.get(LAYER_ID)
            });
        };
        this.getMap().forEachFeatureAtPixel([x, y], (feature, layer) => {
            // Cluster source
            if (feature && feature.get('features')) {
                feature.get('features').forEach(cur => addHit(cur, layer));
                return;
            }
            addHit(feature, layer);
        });
        return hits;
    }
    _forEachFeatureAtPixelImpl (pixel, callback) {
        this.getMap().forEachFeatureAtPixel(pixel, callback);
    }

    /* OL3 specific - check if this can be done in a common way
------------------------------------------------------------------> */
    getInteractionInstance (interactionName) {
        var interactions = this.getMap().getInteractions().getArray();
        var interactionInstance = interactions.filter(function (interaction) {
            return interaction instanceof interactionName;
        })[0];
        return interactionInstance;
    }

    /**
     * Transforms a bounds object with left,top,bottom and right properties
     * to an OL3 array. Returns the parameter as is if those properties don't exist.
     * @param  {Object | Array} bounds bounds object or OL3 array
     * @return {Array}          Ol3 presentation of bounds
     */
    __boundsToArray (bounds) {
        var extent = bounds || [];
        if (!isNaN(bounds.left) && !isNaN(bounds.top) && !isNaN(bounds.right) && !isNaN(bounds.bottom)) {
            extent = [
                bounds.left,
                bounds.bottom,
                bounds.right,
                bounds.top];
        }
        return extent;
    }

    /**
     * Produces an dataurl for PNG-image from the map contents and calls given callback with it.
     * Fails if canvas is "tainted" == contains layers restricting cross-origin use.
     */
    getScreenshot (callback, numOfTries) {
        if (typeof callback !== 'function') {
            return;
        }
        if (typeof numOfTries === 'undefined') {
            numOfTries = 5;
        }
        clearTimeout(this.screenshotTimer);
        var me = this;

        if (this.isLoading()) {
            if (numOfTries < 0) {
                callback('');
                return;
            }
            this.screenshotTimer = setTimeout(function () {
                me.getScreenshot(callback, numOfTries--);
            }, 1000);
            return;
        }

        me.getMap().once('rendercomplete', function () {
            const mapCanvas = document.createElement('canvas');
            const size = me.getMap().getSize();
            mapCanvas.width = size[0];
            mapCanvas.height = size[1];
            const mapContext = mapCanvas.getContext('2d');
            Array.prototype.forEach.call(document.querySelectorAll('.ol-layer canvas'), function (canvas) {
                if (canvas.width > 0) {
                    const opacity = canvas.parentNode.style.opacity;
                    mapContext.globalAlpha = opacity === '' ? 1 : Number(opacity);
                    const transform = canvas.style.transform;
                    // Get the transform parameters from the style's transform matrix
                    const matrix = transform.match(/^matrix\(([^(]*)\)$/)[1].split(',').map(Number);
                    // Apply the transform to the export map context
                    CanvasRenderingContext2D.prototype.setTransform.apply(mapContext, matrix);
                    mapContext.drawImage(canvas, 0, 0);
                }
            });
            callback(mapCanvas.toDataURL());
        });

        try {
            me.getMap().renderSync();
        } catch (err) {
            me.log.warn('Error in screenshot map render sync: ' + err);
            callback('');
        }
    }

    getMeasurementResult (geometry) {
        var olGeometry = this.getOLGeometryFromGeoJSON(geometry);
        var sum = 0;
        if (olGeometry.getType() === 'LineString') {
            return this.getGeomLength(olGeometry);
        } else if (olGeometry.getType() === 'MultiLineString') {
            var lineStrings = olGeometry.getLineStrings();
            for (var i = 0; i < lineStrings.length; i++) {
                sum += this.getGeomLength(lineStrings[i]);
            }
            return sum;
        } else if (olGeometry.getType() === 'Polygon' || olGeometry.getType() === 'MultiPolygon') {
            return this.getGeomArea(olGeometry);
        }
    }

    /**
     * @method getGeomArea
     * -  calculates area of given geometry
     *
     * @param {ol/geom/Geometry} geometry
     * @return {Number} area in square meters
     *
     * http://gis.stackexchange.com/questions/142062/openlayers-3-linestring-getlength-not-returning-expected-value
     * "Bottom line: if your view is 4326 or 3857, don't use getLength()."
     * https://openlayers.org/en/latest/apidoc/module-ol_sphere.html
     */
    getGeomArea (geometry) {
        if (!geometry || (geometry.getType() !== 'Polygon' && geometry.getType() !== 'MultiPolygon')) {
            return 0;
        }
        var sourceProj = this.getMap().getView().getProjection();
        return olSphere.getArea(geometry, { projection: sourceProj });
    }

    /**
     * @method getGeomLength
     * -  calculates length of given geometry
     *
     * @param {ol/geom/Geometry} geometry
     * @return {Number} length in meters
     *
     * http://gis.stackexchange.com/questions/142062/openlayers-3-linestring-getlength-not-returning-expected-value
     * "Bottom line: if your view is 4326 or 3857, don't use getLength()."
     * https://openlayers.org/en/latest/apidoc/module-ol_sphere.html
     */
    getGeomLength (geometry) {
        if (!geometry || geometry.getType() !== 'LineString') {
            return 0;
        }
        var sourceProj = this.getMap().getView().getProjection();
        return olSphere.getLength(geometry, { projection: sourceProj });
    }

    /**
     * Formats the measurement to ui.
     * Returns a string with the measurement and
     * an appropriate unit (m/km or m²/ha/km²)
     * or an empty string for point.
     *
     * @public @method formatMeasurementResult
     *
     * @param  {number} measurement
     * @param  {String} drawMode
     * @return {String}
     *
     */
    // TODO: move to util
    formatMeasurementResult (measurement, drawMode) {
        var result,
            unit,
            decimals;
        if (typeof measurement !== 'number') {
            return;
        }
        const zoomedForAccuracy = this.getResolution() < 1;

        if (drawMode === 'area') {
            // 1 000 000 m² === 1 km²
            if (measurement >= 1000000) {
                result = measurement / 1000000; // (Math.round(measurement) / 1000000);
                decimals = 3;
                unit = ' km²';
            } else if (measurement < 10000) {
                result = measurement;// (Math.round(100 * measurement) / 100);
                decimals = zoomedForAccuracy ? 1 : 0;
                unit = ' m²';
            } else {
                result = measurement / 10000; // (Math.round(100 * measurement) / 100);
                decimals = 2;
                unit = ' ha';
            }
        } else if (drawMode === 'line') {
            // 1 000 m === 1 km
            if (measurement >= 1000) {
                result = measurement / 1000; // (Math.round(measurement) / 1000);
                decimals = 3;
                unit = ' km';
            } else {
                result = measurement; // (Math.round(100 * measurement) / 100);
                decimals = zoomedForAccuracy ? 1 : 0;
                unit = ' m';
            }
        } else {
            return '';
        }
        return result.toFixed(decimals).replace(
            '.',
            Oskari.getDecimalSeparator()
        ) + unit;
    }

    /**
     * @method isLonLatInViewport
     * @param {ol/Coordinate} lonlatArray
     * @param {Number} extendSize (optional) px to expand the viewport size
     * @return {Boolean} true if coordinate is in the viewport
     *
     * Check if given coordinate is in the current viewport
     */
    isLonLatInViewport (lonlatArray, extendSize) {
        // normalize optional param
        extendSize = typeof extendSize === 'number' ? extendSize : 0;
        var mapSize = this.getSize();
        var view = this.getMap().getView();
        var width = mapSize.width + extendSize;
        var height = mapSize.height + extendSize;
        var extent = view.calculateExtent([width, height]);

        return olExtent.containsCoordinate(extent, lonlatArray);
    }
    getLocationGeoJSON (position, addAccuracy) {
        const coord = [position.lon, position.lat];
        const accuracy = position.accuracy;
        var features = [];
        features.push(new olFeature({
            geometry: new olGeom.Point(coord),
            name: 'location'
        }));
        if (accuracy && addAccuracy !== false) {
            features.push(new olFeature({
                geometry: fromCircle(new olGeom.Circle(coord, accuracy), 50),
                name: 'accuracy'
            }));
        }
        return this.getGeoJSONFromFeatures(features);
    }
    getLocationPathGeoJSON (lineCoords) {
        var geom = new olGeom.LineString(lineCoords);
        if (geom) {
            var feature = new olFeature({
                geometry: geom,
                name: 'path'
            });
            return this.getGeoJSONFromFeatures([feature]);
        }
        return null;
    }
    /* <------------- / OL3 specific ----------------------------------- */

    /* Impl specific - found in ol2 AND ol3 modules
------------------------------------------------------------------> */
    getPixelFromCoordinate (lonlat) {
        lonlat = this.normalizeLonLat(lonlat);
        var px = this.getMap().getPixelFromCoordinate([lonlat.lon, lonlat.lat]);
        return {
            x: px[0],
            y: px[1]
        };
    }

    getMapCenter () {
        var center = this.getMap().getView().getCenter();
        return {
            lon: center[0],
            lat: center[1]
        };
    }

    getMapZoom () {
        // Touch devices zoom level (after pinch zoom) may contains decimals
        // for this reason zoom need rounded to nearest integer.
        // Tested with Android pinch zoom.
        return Math.round(this.getMap().getView().getZoom());
    }

    getSize () {
        const [width = 0, height = 0] = this.getMap().getSize() || [];
        return {
            width,
            height
        };
    }

    /**
     * @method zoomToExtent
     * Zooms the map to fit given bounds on the viewport
     * @param {OpenLayers.Bounds} bounds BoundingBox that should be visible on the viewport
     * @param {Boolean} suppressStart true to NOT send an event about the map starting to move
     *  (other components wont know that the map has started moving, only use when chaining moves and
     *     wanting to notify at end of the chain for performance reasons or similar) (optional)
     * @param {Boolean} suppressEnd true to NOT send an event about the map move
     *  (other components wont know that the map has moved, only use when chaining moves and
     *     wanting to notify at end of the chain for performance reasons or similar) (optional)
     * @param {Number} maxZoomLevel restrict to max level so we don't zoom "too close" for point features etc (optional)
     */
    zoomToExtent (bounds, suppressStart, suppressEnd, maxZoomLevel = -1) {
        var extent = this.__boundsToArray(bounds);
        const opts = {};

        if (maxZoomLevel !== -1) {
            // if param is defined enable restriction to prevent "overzooming" for point features etc
            opts.maxZoom = maxZoomLevel;
        }
        this.getMap().getView().fit(extent, opts);
        this.updateDomain();

        // send note about map change
        if (suppressStart !== true) {
            this.notifyStartMove();
        }
        if (suppressEnd !== true) {
            this.notifyMoveEnd();
        }
    }

    /**
     * @method getResolutionForScale
     * Calculate resolution for the scale
     * If scale is not defined return -1
     * @param {Number} scale
     * @return {Number[]} calculated resolution
     */
    getResolutionForScale (scale) {
        if (!scale && scale !== 0) {
            return -1;
        }
        var resIndex = -1;
        var scaleList = this.getScaleArray();
        for (var i = 1; i < scaleList.length; i += 1) {
            if ((scale > scaleList[i]) && (scale <= scaleList[i - 1])) {
                // resolutions are in the same order as scales so just use them
                resIndex = i - 1;
                break;
            }
        }
        // Is scale out of scale ranges
        if (resIndex === -1) {
            resIndex = scale < scaleList[scaleList.length - 1] ? scaleList.length - 1 : 0;
        }
        return this.getResolutionArray()[resIndex];
    }

    /**
     * @method animateTo
     * Animate from current x/y to requested x/y
     * Usable animations: fly/pan/zoomPan
     * @param {Object} lonlat coordinates to move the map to
     * @param {Number} zoom absolute zoomlevel to set the map to
     * @param {String} animation animation name
     * @param {Number}  duration animation duration time
     * @param {Function} done function callback
     * @return {Boolean} success
     */
    _animateTo (lonlat, zoom, animation, duration, done) {
        if (!this.isValidLonLat(lonlat.lon, lonlat.lat)) {
            return false;
        }

        const location = [lonlat.lon, lonlat.lat];
        const view = this.getMap().getView();
        let called = false;
        let parts = animation === 'fly' ? 2 : 1;
        duration = duration || 3000;
        done = typeof (done) === 'function' ? done : (x) => x;

        function callback (complete) {
            --parts;
            if (called) {
                return;
            }
            if (parts === 0 || !complete) {
                called = true;
                // Animation ready, call the next point
                done(complete);
            }
        }

        const flyZoom = view.getZoom();
        switch (animation) {
        case 'pan':
            view.animate({
                center: location,
                duration: duration
            }, callback);
            break;
        case 'fly':
            view.animate({
                center: location,
                duration: duration
            }, callback);
            view.animate({
                zoom: flyZoom - 1,
                duration: duration / 2
            }, {
                zoom: flyZoom,
                duration: duration / 2
            }, callback);
            break;
        case 'zoomPan':
            view.animate({
                center: location,
                zoom: zoom,
                duration: duration,
                easing: easeOut
            }, callback);
            break;
        default:
            view.setCenter(location);
            if (!isNaN(zoom)) {
                view.setZoom(zoom);
            }
            callback(true);
            break;
        }
        return true;
    }

    /**
     * @method centerMap
     * Moves the map to the given position and zoomlevel.
     * @param {Number[] | Object} lonlat coordinates to move the map to
     * @param {Object | Number} zoomLevel absolute zoomlevel to set the map to
     * @param {Boolean} suppressEnd deprecated
     * @param {Object} options options, such as animation and duration
     *     Usable animations: fly/pan/zoomPan
     * @return {Boolean} success
     */
    centerMap (lonlat, zoom, suppressEnd, options = {}) {
        const view = this.getMap().getView();
        const animation = options.animation ? options.animation : '';
        const duration = options.duration ? options.duration : 3000;

        lonlat = this.normalizeLonLat(lonlat);
        if (!this.isValidLonLat(lonlat.lon, lonlat.lat)) {
            return false;
        }

        if (zoom === null || zoom === undefined) {
            zoom = { type: 'zoom', value: this.getMapZoom() };
        } else {
            const { top, bottom, left, right } = zoom.value || zoom;
            if (top && left && bottom && right) {
                const zoomOut = top === bottom && left === right;
                const suppressEvent = zoomOut;
                this.zoomToExtent({ top, bottom, left, right }, suppressEvent, suppressEvent);
                if (zoomOut) {
                    this.zoomToScale(2000);
                }
                view.setCenter([lonlat.lon, lonlat.lat]);
                return true;
            }
        }
        if (!isNaN(zoom)) {
            // backwards compatibility
            zoom = { type: 'zoom', value: zoom };
        }

        const zoomValue = zoom.type === 'scale' ? view.getZoomForResolution(zoom.value) : zoom.value;
        this._animateTo(lonlat, zoomValue, animation, duration);
        return true;
    }

    /**
     * @method tourMap
     * Moves the map from point to point
     * @param {Object[]} coordinates array of coordinates to move the map along
     * @param {Object | Number} zoom absolute zoomlevel to set the map to
     * @param {Object} options options, such as animation and duration
     *     Usable animations: fly/pan/zoomPan
     */
    tourMap (coordinates, zoom, options) {
        const view = this.getMap().getView();
        const me = this;
        const duration = options && options.duration ? options.duration : 3000;
        const delayOption = options && options.delay ? options.delay : 750;
        const animation = options && options.animation ? options.animation : '';

        if (zoom === null || zoom === undefined) {
            zoom = { type: 'zoom', value: this.getMapZoom() };
        }

        const zoomDefault = zoom.type === 'scale' ? view.getZoomForResolution(zoom.value) : zoom.value;
        let index = -1;
        let delay = 0;
        let status = { steps: coordinates.length, step: 0 };

        const next = (more) => {
            me.notifyTourEvent(status, !more);
            if (!more) {
                // if we are done we can stop here
                return;
            }
            // go to the next step
            ++index;
            if (index < coordinates.length) {
                // Check if location has overrides for animation values
                const location = coordinates[index];
                const zoomValue = location.zoom || zoomDefault;
                const animationValue = location.animation || animation;
                const durationValue = location.duration || duration;
                status = { ...status, step: index + 1 };
                setTimeout(function () {
                    me._animateTo(location, zoomValue, animationValue, durationValue, next);
                }, delay);
                // set Delay for next point
                delay = location.delay || delayOption;
            }
        };
        next(true);
    }

    /**
     * Get maps current extent.
     * @method getCurrentExtent
     * @return {Object} current extent
     */
    getCurrentExtent () {
        var ol3 = this.getMap();
        var extent = ol3.getView().calculateExtent(ol3.getSize());
        return {
            left: extent[0],
            bottom: extent[1],
            right: extent[2],
            top: extent[3]
        };
    }

    /**
     * @method  @public getProjectionUnits Get projection units. If projection is not defined then using map projection.
     * @param {String} srs projection srs, if not defined used map srs
     * @return {String} projection units. 'degrees' or 'm'
     */
    getProjectionUnits (srs) {
        var me = this;
        var units = null;
        srs = srs || me.getProjection();

        try {
            var proj = olProj.get(srs);
            units = proj.getUnits(); // return 'degrees' or 'm'
        } catch (err) {
            var log = Oskari.log('Oskari.mapframework.ui.module.common.MapModule');
            log.warn('Cannot get map units for "' + srs + '"-projection!');
        }
        return units;
    }

    /**
     * @method panMapByPixels
     * Pans the map by given amount of pixels.
     * @param {Number} pX amount of pixels to pan on x axis
     * @param {Number} pY amount of pixels to pan on y axis
     * @param {Boolean} suppressStart true to NOT send an event about the map starting to move
     *  (other components wont know that the map has started moving, only use when chaining moves and
     *     wanting to notify at end of the chain for performance reasons or similar) (optional)
     * @param {Boolean} suppressEnd true to NOT send an event about the map move
     *  (other components wont know that the map has moved, only use when chaining moves and
     *     wanting to notify at end of the chain for performance reasons or similar) (optional)
     * @param {Boolean} isDrag true if the user is dragging the map to a new location currently (optional)
     */
    panMapByPixels (pX, pY, suppressStart, suppressEnd, isDrag) {
        var view = this.getMap().getView();
        var centerCoords = view.getCenter();
        var centerPixels = this.getMap().getPixelFromCoordinate(centerCoords);
        var newCenterPixels = [centerPixels[0] + pX, centerPixels[1] + pY];
        var newCenterCoords = this.getMap().getCoordinateFromPixel(newCenterPixels);

        view.animate({
            duration: 100,
            center: newCenterCoords
        });

        this.updateDomain();
        // send note about map change
        if (suppressStart !== true) {
            this.notifyStartMove();
        }
        if (suppressEnd !== true) {
            this.notifyMoveEnd();
        }
    }

    /**
     * @method transformCoordinates
     * Transforms coordinates from srs projection to the targerSRS projection.
     * @param {Object} pLonlat object with lon and lat keys
     * @param {String} srs projection for given lonlat params like "EPSG:4326"
     * @param {String} targetsrs projection to transform to like "EPSG:4326" (optional, defaults to map projection)
     * @return {Object} transformed coordinates as object with lon and lat keys
     */
    transformCoordinates (pLonlat, srs, targetSRS) {
        if (!targetSRS) {
            targetSRS = this.getProjection();
        }
        if (!srs || targetSRS === srs) {
            return pLonlat;
        }
        var isSRSDefined = olProj.get(srs);
        var isTargetSRSDefined = olProj.get(targetSRS);

        if (isSRSDefined && isTargetSRSDefined) {
            var transformed = olProj.transform([pLonlat.lon, pLonlat.lat], srs, targetSRS);
            return {
                lon: transformed[0],
                lat: transformed[1]
            };
        }

        var log = Oskari.log('Oskari.mapframework.ui.module.common.MapModule');
        log.warn('SrsName not supported!');
        throw new Error('SrsName not supported!');
    }

    /**
     * @method orderLayersByZIndex
     * Orders layers by Z-indexes.
     */
    orderLayersByZIndex () {
        this.getMap().getLayers().getArray().sort(function (a, b) {
            return a.getZIndex() - b.getZIndex();
        });
    }

    calculatePixelsInScale (mmMeasures, plotScale) {
        var units = this.getMap().getView().getProjection().getUnits();
        var view = this.getMap().getView();
        var centerCoords = view.getCenter();
        var tempCoords = [];
        var tempPixels;
        var centerPixels = this.getMap().getPixelFromCoordinate(centerCoords);
        var mpu = olProjUnitsMETERS_PER_UNIT[units];
        var scaleCoef = plotScale / 1000;
        var pixels = [];

        for (var i = 0; i < mmMeasures.length; ++i) {
            // mm measure in metres  e.g. in 1:10 000  10 mm  is 100 000 mm (100 m)
            var inMeters = mmMeasures[i] * scaleCoef * mpu;
            // Use coordinates to get pixel size
            tempCoords[0] = centerCoords[0] + inMeters;
            tempCoords[1] = centerCoords[1];
            tempPixels = this.getMap().getPixelFromCoordinate(tempCoords);
            pixels.push(tempPixels[0] - centerPixels[0]);
        }
        return pixels;
    }

    /* Calculate best fix scale based on measures in case of two measures
        * The case of two measures is interpreted as paper size
        * If first measure is shorter than second, then orientation is portrait
        * @param mmMeasures    unit mm
        * return fixScale or MapScale
        */
    calculateFitScale4Measures (mmMeasures) {
        var map = this.getMap();
        var units = map.getView().getProjection().getUnits();
        var mapScale = this._sandbox.getMap().getScale();
        var extent = map.getView().calculateExtent(map.getSize());
        var mpu = olProjUnitsMETERS_PER_UNIT[units];
        var margin = 10.0;
        var scaleCoef = mapScale / 1000;

        if (mmMeasures.length !== 2) {
            return mapScale;
        }

        if (mmMeasures[0] > mmMeasures[1]) {
            // landscape
            // fit width scale
            var view_width = extent[2] - extent[0];
            var paper_width = mmMeasures[0] * scaleCoef * mpu;
            if (paper_width > view_width) {
                return Math.round((view_width / (paper_width + margin)) * mapScale);
            }
        } else {
            // portrait
            var view_height = extent[3] - extent[1];
            var paper_height = mmMeasures[1] * scaleCoef * mpu;
            if (paper_height > view_height) {
                return Math.round((view_height / (paper_height + margin)) * mapScale);
            }
        }

        return mapScale;
    }

    // TODO: check LayersPlugin.ol3 getGeometryCenter
    getCentroidFromGeoJSON (geojson) {
        var olGeometry = this.getOLGeometryFromGeoJSON(geojson);
        var olBounds = olGeometry.getExtent();
        var x = olBounds[0] + (olBounds[2] - olBounds[0]) / 2;
        var y = olBounds[1] + (olBounds[3] - olBounds[1]) / 2;
        return { lon: x, lat: y };
    }

    getClosestPointFromGeoJSON (geojson) {
        // TODO?? getInteriorPoint() for polygon --> placeform, attention text,..
        var olGeometry = this.getOLGeometryFromGeoJSON(geojson);
        var olBounds = olGeometry.getExtent();
        var x = olBounds[0] + (olBounds[2] - olBounds[0]) / 2;
        var y = olBounds[1] + (olBounds[3] - olBounds[1]) / 2;
        var coord = olGeometry.getClosestPoint([x, y]);
        return { lon: coord[0], lat: coord[1] };
    }

    // TODO: check LayersPlugin.ol3 getGeometryBounds
    getBoundsFromGeoJSON (geojson) {
        var olGeometry = this.getOLGeometryFromGeoJSON(geojson);
        var extent = olGeometry.getExtent();
        return { left: extent[0], bottom: extent[1], right: extent[2], top: extent[3] };
    }

    isPointInExtent (extent, x, y) {
        return olExtent.containsXY(extent, x, y);
    }

    getExtentForPointsArray (points) {
        var multiPoint = new olGeom.MultiPoint(points);
        return multiPoint.getExtent();
    }

    /* --------- /Impl specific --------------------------------------> */

    /* Impl specific - PRIVATE
------------------------------------------------------------------> */
    _calculateScalesImpl (resolutions) {
        var units = this.getMap().getView().getProjection().getUnits();
        var mpu = olProjUnitsMETERS_PER_UNIT[units];

        for (var i = 0; i < resolutions.length; ++i) {
            var scale = resolutions[i] * mpu * 39.37 * this._dpi;
            scale = Math.round(scale);

            this._mapScales.push(scale);
        }
    }

    _updateSizeImpl () {
        this.getMap().updateSize();
    }

    _setZoomLevelImpl (newZoomLevel) {
        this.getMap().getView().setZoom(newZoomLevel);
    }

    _setResolutionImpl (newResolution) {
        this.getMap().getView().setResolution(newResolution);
    }

    _getExactResolutionImpl (scale) {
        var units = this.getMap().getView().getProjection().getUnits();
        var dpiTest = jQuery('<div></div>');
        dpiTest.css({
            height: '1in',
            width: '1in',
            position: 'absolute',
            left: '-100%',
            top: '-100%'
        });
        jQuery('body').append(dpiTest);

        var dpi = dpiTest.height();
        dpiTest.remove();
        var mpu = olProjUnitsMETERS_PER_UNIT[units];
        var resolution = scale / (mpu * 39.37 * dpi);
        return resolution;
    }

    /* --------- /Impl specific - PRIVATE ----------------------------> */

    /* Impl specific - found in ol2 AND ol3 modules BUT parameters and/or return value differ!!
------------------------------------------------------------------> */

    /**
     * @param {ol/layer/Layer} layer ol3 specific!
     * @param {Boolean} toBottom if false or missing adds the layer to the top, if true adds it to the bottom of the layer stack
     */
    addLayer (layerImpl, toBottom) {
        if (!layerImpl) {
            return;
        }
        this.getMap().addLayer(layerImpl);
        // check for boolean true instead of truthy value since some calls might send layer name as second parameter/functionality has changed
        if (toBottom === true) {
            this.setLayerIndex(layerImpl, 0);
        }
    }

    /**
     * @param {ol/layer/Layer} layer ol3 specific!
     */
    removeLayer (layerImpl) {
        if (!layerImpl) {
            return;
        }
        this.getMap().removeLayer(layerImpl);
        if (typeof layerImpl.destroy === 'function') {
            layerImpl.destroy();
        }
    }

    /**
     * Brings map layer to top
     * @method bringToTop
     *
     * @param {ol/layer/Layer} layer The new topmost layer
     */
    bringToTop (layer) {
        var map = this.getMap();
        var list = map.getLayers();
        list.remove(layer);
        list.push(layer);
    }

    /**
     * @param {ol/layer/Layer} layer ol3 specific!
     */
    setLayerIndex (layerImpl, index) {
        var layerColl = this.getMap().getLayers();
        var layerIndex = this.getLayerIndex(layerImpl);

        /* find */
        /* remove */
        /* insert at */

        if (index === layerIndex) {

        } else if (index === layerColl.getLength()) {
            /* to top */
            layerColl.removeAt(layerIndex);
            layerColl.insertAt(index, layerImpl);
        } else if (layerIndex < index) {
            /* must adjust change */
            layerColl.removeAt(layerIndex);
            layerColl.insertAt(index - 1, layerImpl);
        } else {
            layerColl.removeAt(layerIndex);
            layerColl.insertAt(index, layerImpl);
        }
    }

    /**
     * @param {ol/layer/Layer} layer ol3 specific!
     */
    getLayerIndex (layerImpl) {
        var layerColl = this.getMap().getLayers();
        var layerArr = layerColl.getArray();

        for (var n = 0; n < layerArr.length; n++) {
            if (layerArr[n] === layerImpl) {
                return n;
            }
        }
        return -1;
    }

    isLayerVisible (layer) {
        if (typeof layer === 'undefined') {
            return false;
        }
        if (Array.isArray(layer)) {
            // getOLMapLayers() returns an array -> check that atleast one of them is visible
            // group layers can have multiple layers with only some visible
            return layer.some(l => this.isLayerVisible(l));
        }
        if (typeof layer === 'object') {
            // probably passed the layer impl directly
            return layer.getVisible();
        }
        // layer is probably id
        const layerImpl = this.getOLMapLayers(layer);
        return this.isLayerVisible(layerImpl);
    }

    /**
     * @param {ol/control/Control} layer ol3 specific!
     */
    _addMapControlImpl (ctl) {
        this.getMap().addControl(ctl);
    }

    /**
     * @param {ol/control/Control} layer ol3 specific!
     */
    _removeMapControlImpl (ctl) {
        this.getMap().removeControl(ctl);
    }

    /**
     * Create a feature from a wkt and calculate a new map viewport to be able to view entire geometry and center to it
     * @param {String} wkt Well known text representation of the geometry
     */
    getViewPortForGeometry (wkt) {
        if (!wkt) {
            return null;
        }
        var me = this;
        var feature = me.getFeatureFromWKT(wkt);
        var centroid;
        var bounds;
        var mapBounds;
        var zoomToBounds = null;

        if (!feature) {
            return;
        }

        if (feature && feature.getGeometry() && feature.getGeometry().getExtent()) {
            var map = me.getMap();
            bounds = feature.getGeometry().getExtent();
            centroid = olExtent.getCenter(bounds);
            mapBounds = map.getView().calculateExtent(map.getSize());

            // if both width and height are < mapbounds', no need to change the bounds. Otherwise use the feature's geometry's bounds.
            if (olExtent.getHeight(bounds) < olExtent.getHeight(mapBounds) && olExtent.getWidth(bounds) < olExtent.getWidth(mapBounds)) {
                zoomToBounds = null;
            } else {
                zoomToBounds = {
                    'top': olExtent.getTopLeft(bounds)[1],
                    'left': olExtent.getTopLeft(bounds)[0],
                    'bottom': olExtent.getBottomRight(bounds)[1],
                    'right': olExtent.getBottomRight(bounds)[0]
                };
            }

            var ret = {
                'x': centroid[0],
                'y': centroid[1],
                'bounds': zoomToBounds
            };

            return ret;
        }

        return null;
    }

    /**
     * @method getFeatureFromWKT
     */
    getFeatureFromWKT (wkt) {
        var wktFormat = new olFormatWKT();
        return wktFormat.readFeature(wkt);
    }

    /**
     * @method getLayerTileUrls
     * @param layerId id of the layer
     * @return {String[]}
     * Get urls of tile layer tiles.
     */
    getLayerTileUrls (layerId) {
        var OLlayers = this.getOLMapLayers(layerId);
        var urls = [];
        var source = OLlayers[0].getSource();
        if (source instanceof OskariImageWMS) {
            urls.push(source.getImageUrl());
        }
        return urls;
    }

    getGeoJSONGeometryFromOL (feature) {
        var geojson = this.getGeoJSONFromFeatures([feature]);
        if (geojson.features & geojson.features.length > 0) {
            return geojson.features[0].geometry;
        }
        return null;
    }
    /**
     * @method getGeoJSONFromFeatures
     * @param {Array] features
     * @return {Object} geojson FeatureCollection
     */
    getGeoJSONFromFeatures (features) {
        var olGeoJSON = new olFormatGeoJSON();
        return olGeoJSON.writeFeaturesObject(features);
    }

    setTime () {
        var log = Oskari.log('Oskari.mapframework.ui.module.common.MapModule');
        log.warn('setTime only available in 3D map');
    }

    getOLGeometryFromGeoJSON (geojson) {
        var olGeoJSON = new olFormatGeoJSON();
        var olGeom;
        var features;
        // DrawTools (allowMultipleDrawing: multiGeom) returns FeatureCollection where features[0] is multigeom
        // TODO: fix to handle common FeatureCollection
        // TODO: FeatureCollection -> readFeatures() -> getGeometry()
        if (geojson.type === 'FeatureCollection') {
            features = geojson.features;
            olGeom = olGeoJSON.readGeometry(JSON.stringify(features[0].geometry));
        } else if (geojson.geometry && geojson.type === 'Feature') {
            olGeom = olGeoJSON.readGeometry(JSON.stringify(geojson.geometry));
        } else if (geojson.type && geojson.coordinates) { // geometry object
            olGeom = olGeoJSON.readGeometry(JSON.stringify(geojson));
        }
        if (olGeom) {
            return olGeom;
        }
        return null;
    }
    /* --------- /Impl specific - PARAM DIFFERENCES  ----------------> */
}
