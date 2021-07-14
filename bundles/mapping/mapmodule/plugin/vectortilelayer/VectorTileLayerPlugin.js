import olSourceVectorTile from 'ol/source/VectorTile';
import olLayerVectorTile from 'ol/layer/VectorTile';
import olFormatMVT from 'ol/format/MVT';
import TileGrid from 'ol/tilegrid/TileGrid';
import { createDefaultStyle } from 'ol/style/Style';

import { VectorTileModelBuilder } from './VectorTileModelBuilder';
import { styleGenerator } from './styleGenerator';
import mapboxStyleFunction from 'ol-mapbox-style/dist/stylefunction';
import { LAYER_ID, LAYER_TYPE } from '../../domain/constants';
import { getZoomLevelHelper } from '../../util/scale';

const AbstractMapLayerPlugin = Oskari.clazz.get('Oskari.mapping.mapmodule.AbstractMapLayerPlugin');
const LayerComposingModel = Oskari.clazz.get('Oskari.mapframework.domain.LayerComposingModel');

/**
 * @class Oskari.mapframework.mapmodule.VectorTileLayerPlugin
 * Provides functionality to draw vector tile layers on the map
 */
class VectorTileLayerPlugin extends AbstractMapLayerPlugin {
    constructor (config) {
        super(config);
        this.__name = 'VectorTileLayerPlugin';
        this._clazz = 'Oskari.mapframework.mapmodule.VectorTileLayerPlugin';
        this.layertype = 'vectortile';
    }

    /**
     * @private @method _initImpl
     * Interface method for the module protocol.
     */
    _initImpl () {
        // register domain builder
        const mapLayerService = this.getSandbox().getService('Oskari.mapframework.service.MapLayerService');
        if (mapLayerService) {
            const composingModel = new LayerComposingModel([
                LayerComposingModel.ATTRIBUTIONS,
                LayerComposingModel.CREDENTIALS,
                LayerComposingModel.EXTERNAL_STYLES_JSON,
                LayerComposingModel.HOVER,
                LayerComposingModel.SRS,
                LayerComposingModel.STYLES_JSON,
                LayerComposingModel.TILE_GRID,
                LayerComposingModel.URL
            ], null, [LayerComposingModel.NAME]); // common field name is not used in vectortilelayers so it is skipped on LayerComposingModel

            mapLayerService.registerLayerModel(this.layertype + 'layer', this._getLayerModelClass(), composingModel);
            mapLayerService.registerLayerModelBuilder(this.layertype + 'layer', this._getModelBuilder());
        }
        this.getSandbox().getService('Oskari.mapframework.service.VectorFeatureService').registerLayerType(this.layertype, this);
    }

    /**
     * @private @method _getLayerModelClass
     * Returns class to be used as mapLayerService layer model
     */
    _getLayerModelClass () {
        return 'Oskari.mapframework.mapmodule.VectorTileLayer';
    }

    /**
     * @private @method _getModelBuilder
     * Returns object to be used as mapLayerService layer model builder
     */
    _getModelBuilder () {
        return new VectorTileModelBuilder();
    }

    /**
     * @private @method _createPluginEventHandlers
     * Called by superclass to create event handlers
     */
    _createPluginEventHandlers () {
        return {
            AfterChangeMapLayerStyleEvent (event) {
                const oskariLayer = event.getMapLayer();
                this._updateLayerStyle(oskariLayer);
            }
        };
    }

    /**
     * @private @method _updateLayerStyle
     * @param {Oskari.mapframework.mapmodule.VectorTileLayer} oskariLayer
     */
    _updateLayerStyle (oskariLayer) {
        const olLayers = this.getOLMapLayers(oskariLayer);

        if (olLayers && olLayers.length > 0) {
            olLayers[0].setStyle(this._getLayerCurrentStyleFunction(oskariLayer));
        }
    }

    /**
     * @private @method _getLayerCurrentStyleFunction
     * Returns OL style corresponding to layer currently selected style
     * @param {Oskari.mapframework.domain.AbstractLayer} layer
     * @return {ol/style/Style}
     */
    _getLayerCurrentStyleFunction (layer) {
        const externalStyleDef = layer.getCurrentExternalStyleDef();
        const olLayers = this.getOLMapLayers(layer.getId());
        if (externalStyleDef && olLayers.length !== 0) {
            const sourceLayerIds = externalStyleDef.layers.filter(cur => !!cur.source).map(cur => cur.id);
            return mapboxStyleFunction(olLayers[0], externalStyleDef, sourceLayerIds);
        }
        const styleDef = layer.getCurrentStyleDef();
        const factory = this.mapModule.getStyle.bind(this.mapModule);
        return styleDef ? styleGenerator(factory, styleDef) : this._createDefaultStyle();
    }

    /**
     * @private @method _createDefaultStyle
     * Creates OL style or style function for default style
     * @return {ol/style/Style}
     */
    _createDefaultStyle () {
        return createDefaultStyle;
    }

    /**
     * Checks if the layer can be handled by this plugin
     * @method  isLayerSupported
     * @param  {Oskari.mapframework.domain.AbstractLayer} layer
     * @return {Boolean}       true if this plugin handles the type of layers
     */
    isLayerSupported (layer) {
        if (!layer) {
            return false;
        }
        return layer.isLayerOfType(this.layertype);
    }

    /**
     * @method getAttributions
     * @param  {Oskari.mapframework.domain.AbstractLayer} layer
     * @return {Array<String>} layer attributions
     */
    getAttributions (layer) {
        if (!layer) {
            return;
        }
        let { attributions } = layer.getOptions();
        if (!attributions) {
            return;
        }
        if (!Array.isArray(attributions)) {
            attributions = [attributions];
        }
        return attributions.map(obj => {
            if (typeof obj === 'string') {
                return obj;
            }
            const { label, link } = obj;
            return link ? `<a href="${link}">${label}</a>` : label;
        });
    }

    getUrlParams (layer) {
        if (!layer.getParams()) {
            return null;
        }
        const params = layer.getParams();
        return Object.keys(params)
            .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
    }

    /**
     * @method addMapLayerToMap
     * @private
     * Adds a single vector tile layer to this map
     * @param {Oskari.mapframework.domain.VectorTileLayer} layer
     * @param {Boolean} keepLayerOnTop
     * @param {Boolean} isBaseMap
     */
    addMapLayerToMap (layer, keepLayerOnTop, isBaseMap) {
        if (!this.getSandbox().getMap().isLayerSupported(layer)) {
            return;
        }
        let url = layer.getLayerUrl().replace('{epsg}', this.mapModule.getProjection());
        const urlParams = this.getUrlParams(layer);
        if (urlParams) {
            const paramsPrefix = url.includes('?') ? '&' : '?';
            url = url + paramsPrefix + urlParams;
        }
        const sourceOpts = {
            format: new olFormatMVT(),
            url,
            projection: this.getMap().getView().getProjection(), // OL projection object
            attributions: this.getAttributions(layer)
        };
        const tileGrid = layer.getTileGrid();
        if (tileGrid) {
            sourceOpts.tileGrid = new TileGrid(tileGrid);
        }
        // options is used to store tile grid and all sorts of other flags so only get the
        //  declutter option here instead of spreading the object to layer directly
        const { declutter } = layer.getOptions() || {};
        const vectorTileLayer = new olLayerVectorTile({
            opacity: layer.getOpacity() / 100,
            visible: layer.isInScale(this.getMapModule().getMapScale()) && layer.isVisible(),
            renderMode: 'hybrid',
            source: this.createSource(layer, sourceOpts),
            declutter
        });

        const zoomLevelHelper = getZoomLevelHelper(this.getMapModule().getScaleArray());
        // Set min max zoom levels that layer should be visible in
        zoomLevelHelper.setOLZoomLimits(vectorTileLayer, layer.getMinScale(), layer.getMaxScale());

        const vectorFeatureService = this.getSandbox().getService('Oskari.mapframework.service.VectorFeatureService');
        const hoverLayer = vectorFeatureService.createHoverLayer(layer, vectorTileLayer.getSource());
        const olLayers = [vectorTileLayer, hoverLayer];
        olLayers.forEach(olLayer => {
            // Properties id and type are being used in VectorFeatureService.
            // Set oskari properties for vector feature service functionalities.
            const silent = true;
            olLayer.set(LAYER_ID, layer.getId(), silent);
            olLayer.set(LAYER_TYPE, layer.getLayerType(), silent);
            this.mapModule.addLayer(olLayer, !keepLayerOnTop);
        });
        vectorTileLayer.setStyle(this._getLayerCurrentStyleFunction(layer));
        this.setOLMapLayers(layer.getId(), olLayers);
    }

    createSource (layer, options) {
        return new olSourceVectorTile(options);
    }

    /**
     * Called when layer details are updated (for example by the admin functionality)
     * @param {Oskari.mapframework.domain.AbstractLayer} layer new layer details
     */
    _updateLayer (layer) {
        if (!this.isLayerSupported(layer)) {
            return;
        }
        const zoomLevelHelper = getZoomLevelHelper(this.getMapModule().getScaleArray());
        const layersImpls = this.getOLMapLayers(layer.getId()) || [];
        layersImpls.forEach(olLayer => {
            // Update min max Resolutions
            zoomLevelHelper.setOLZoomLimits(olLayer, layer.getMinScale(), layer.getMaxScale());
        });
    }
}

Oskari.clazz.defineES('Oskari.mapframework.mapmodule.VectorTileLayerPlugin',
    VectorTileLayerPlugin,
    {
        /**
         * @property {String[]} protocol array of superclasses as {String}
         * @static
         */
        'protocol': ['Oskari.mapframework.module.Module', 'Oskari.mapframework.ui.module.common.mapmodule.Plugin']
    }
);

export { VectorTileLayerPlugin };
