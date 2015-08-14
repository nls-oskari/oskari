/**
 * @class Oskari.mapframework.sandbox.Sandbox.mapMethods
 *
 * This category class adds map related methods to Oskari sandbox as they were in
 * the class itself.
 */
Oskari.clazz.category('Oskari.mapframework.sandbox.Sandbox', 'map-methods', {
    
    /**
     * @method getMap
     * Returns map domain object
     *
     * @return {Oskari.mapframework.domain.Map}
     */
    getMap : function() {
        return this._core.getMap();
    },

    /** 
     * 
     * @method syncMapState
     * Convenience method to send out a map move request with the values on
     * {Oskari.mapframework.domain.Map} domain object (see #getMap()).
     *
     * @param {Boolean} blnInitialMove (optional)
     * 			If true, will clear the map history after moving. Defaults to false.
     * @param {Oskari.mapframework.ui.module.common.MapModule} mapModule
     * (optional)
     * 			Refreshes the map state so that the added layers are shown correctly
     */
    syncMapState : function(blnInitialMove, mapModule) {
        var mapDomain = this._core.getMap();
        var zoom = mapDomain.getZoom();
        var marker = mapDomain.isMarkerVisible();
        if (blnInitialMove === true && zoom == 12) {
            // workaround, openlayers needs to be nudged a bit to actually draw
            // the map images if we enter at zoomlevel 12
            // so if zoom == 12 -> send a dummy request to get openlayers working
            // correctly
            // TODO: find out why OL needs this
            this._core.processRequest(this._core.getRequestBuilder('MapMoveRequest')(mapDomain.getX(), mapDomain.getY(), 0, false));
        }

        this._core.processRequest(this._core.getRequestBuilder('MapMoveRequest')(mapDomain.getX(), mapDomain.getY(), zoom, marker));
    },

    /**
     * @method generateMapLinkParameters
     * Generates query string for an URL that has the maps state with coordinates, zoom and selected map layers
     * 
     * Options syntax/supported fields:  {
     *     marker : <boolean, default false>,
     *     forceCache : <boolean, default true>,
     *     noSavedState : <boolean, default true>
     * } 
     * 
     * @param {Object} options - overrides default parameter values (optional) 
     * @return {String}
     */
    generateMapLinkParameters : function(options) {
        var mapFullComponent = this.getStatefulComponents()['mapfull'];
        if (!mapFullComponent) {
            return;
        }
        var state = mapFullComponent.getState();
        var link = 'zoomLevel=' + state['zoom'] + '&coord=' + state['east'] + '_' + state['north'] + '&mapLayers=';

        var layers = '';

        for (var i = 0; i < state['selectedLayers'].length; i++) {
            if (!state['selectedLayers'][i].hidden) {
                if (layers != '') {
                    layers += ',';
                }
                layers += state['selectedLayers'][i].id + '+' + state['selectedLayers'][i].opacity
                if (state['selectedLayers'][i].style) {
                    layers += '+' + state['selectedLayers'][i].style;
                } else {
                    layers += '+';
                }
            }
        }
        link += layers;
        if(options) {
            if(options.marker == true) {
                link += '&showMarker=true';
            }
            else {
                link += '&showMarker=false';
            }
            if(options.forceCache == false) {
                link += '&forceCache=false';
            }
            else {
                link += '&forceCache=true';
            }
            if(options.noSavedState == false) {
                link += '&noSavedState=false';
            }
            else {
                link += '&noSavedState=true';
            }
        }
        else {
            link += '&showMarker=false&forceCache=true&noSavedState=true';
        }
        return link;
    }
});
