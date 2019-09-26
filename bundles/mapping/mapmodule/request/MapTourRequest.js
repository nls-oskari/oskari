/**
 * @class Oskari.mapframework.request.common.MapTourRequest
 */
Oskari.clazz.define('Oskari.mapframework.request.common.MapTourRequest',
    /**
     * @static @method create called automatically on construction
     *
     * @param {Object[]} locations
     *          List of locations as array of objects.
     *          Contains longitude, latitude and various options
     * @param {Object} options
     *          Object with optional parameters as default
     */
    function (locations, options) {
        this._creator = null;
        this._locations = locations;
        if (typeof options !== 'object') {
            options = {};
        }
        this._options = options;
        this._projectionCode = options.srsName;
        this._animation = options.animation;
        this._zoom = options.zoom;
        this._duration = options.duration;
        this._3dAngles = {
            heading: options.heading,
            pitch: options.pitch,
            roll: options.roll
        };
    }, {
        __name: 'MapTourRequest',

        /**
         * @method getName
         * @return {String} request name
         */
        getName: function () {
            return this.__name;
        },

        /**
         * @method getLocations
         * @return {Object[]} list of locations and optional options
         */
        getLocations: function () {
            return this._locations;
        },

        /**
         * @method getZoom
         * @return {Number/OpenLayers.Bounds/Object} zoomlevel (0-12) or OpenLayers.Bounds or Object with scale property.
         * to zoom to
         */
        getZoom: function () {
            return this._zoom;
        },

        /**
         * @method getSrsName
         * @return {String} _projectionCode SRS projection code
         */
        getSrsName: function () {
            return this._projectionCode;
        },

        /**
         * @method getAnimation
         * @return {String} animation to use on map move.
         */
        getAnimation: function () {
            return this._animation;
        },

        /**
         * @method get3dAngles
         * @return {Object} object with heading pitch and roll for 3d maps
         */
        get3dAngles: function () {
            return this._3dAngles;
        },

        /**
         * @method get3dAngles
         * @return {Object} object with options
         */
        getOptions: function () {
            return this._options;
        }
    }, {
        'protocol': ['Oskari.mapframework.request.Request']
    });