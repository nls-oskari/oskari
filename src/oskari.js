/**
 * @class Oskari
 *
 * A set of methods to support loosely coupled classes and instances for the mapframework
 */
Oskari = (function () {
    var isDebug = false;
    var _markers = [];

    return {
        VERSION : "1.40.0",

        /**
         * @public @method Oskari.setDebugMode
         * @param {boolean} d Debug mode on/off
         */
        setDebugMode: function (d) {
            isDebug = !!d;
        },
        isDebug : function() {
            return isDebug;
        },
        /**
         * @public @static @method Oskari.setMarkers
         * @param {Array} markers markers
         */
        setMarkers: function(markers) {
            _markers = markers || [];
        },
        /**
         * @public @static @method Oskari.getMarkers
         * @return {Array} markers markers
         */
        getMarkers: function() {
            return _markers;
        },

        /**
         * @public @static @method Oskari.getDefaultMarker
         * @return {Object} default marker
         */
        getDefaultMarker: function(){
            return (_markers.length>=3) ? _markers[2] : _markers[0];
        }
    };
}());