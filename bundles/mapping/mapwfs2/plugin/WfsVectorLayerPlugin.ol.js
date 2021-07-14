import { VectorLayerHandler } from './WfsVectorLayerPlugin/impl/VectorLayerHandler.ol';
import { MvtLayerHandler } from './WfsVectorLayerPlugin/impl/MvtLayerHandler.ol';
import { ReqEventHandler } from './WfsVectorLayerPlugin/ReqEventHandler';

import { styleGenerator, DEFAULT_STYLES } from './WfsVectorLayerPlugin/util/style';
import { LAYER_ID, RENDER_MODE_MVT, RENDER_MODE_VECTOR, LAYER_TYPE, LAYER_HOVER } from '../../mapmodule/domain/constants';
import { UserStyleService } from '../service/UserStyleService';

const AbstractMapLayerPlugin = Oskari.clazz.get('Oskari.mapping.mapmodule.AbstractMapLayerPlugin');
const LayerComposingModel = Oskari.clazz.get('Oskari.mapframework.domain.LayerComposingModel');
const VisualizationForm = Oskari.clazz.get('Oskari.userinterface.component.VisualizationForm');
const WFSLayerService = Oskari.clazz.get('Oskari.mapframework.bundle.mapwfs2.service.WFSLayerService');
const WfsLayerModelBuilder = Oskari.clazz.get('Oskari.mapframework.bundle.mapwfs2.domain.WfsLayerModelBuilder');

export class WfsVectorLayerPlugin extends AbstractMapLayerPlugin {
    constructor (config) {
        super();
        this._config = config;
        this.__name = 'WfsVectorLayerPlugin';
        this._clazz = 'Oskari.wfs.WfsVectorLayerPlugin';
        this.renderMode = config.renderMode || RENDER_MODE_VECTOR;
        this.visualizationForm = null;
        this.oskariStyleSupport = true;
        this.layertype = 'wfs';
        this.layertypes = new Set([this.layertype]);
        this.vectorLayerHandler = new VectorLayerHandler(this);
        this.mvtLayerHandler = new MvtLayerHandler(this);
        this.layerHandlersByLayerId = {};
        this.userStyleService = new UserStyleService();
        Oskari.getSandbox().registerService(this.userStyleService);
    }

    /* ---- AbstractMapModulePlugin functions ---- */

    getLayerTypeSelector () {
        return 'wfslayer';
    }

    /**
     * Registers layer type to be handled by this layer plugin.
     *
     * @param {String} layertype for ex. "MYPLACES"
     * @param {String} modelClass layer model class name
     * @param {Object} modelBuilder layer model builder instance
     * @param {Object} eventHandlers
     */
    registerLayerType (layertype, modelClass, modelBuilder, eventHandlers) {
        if (this.layertypes.has(layertype) || !this.mapLayerService || !this.vectorFeatureService) {
            return;
        }
        this.layertypes.add(layertype);
        this.getMapModule().setLayerPlugin(layertype, this);
        this.mapLayerService.registerLayerModel(layertype, modelClass);
        this.mapLayerService.registerLayerModelBuilder(layertype, modelBuilder);
        this.vectorFeatureService.registerLayerType(layertype, this);
        this._registerEventHandlers(eventHandlers);
    }

    _registerEventHandlers (eventHandlers) {
        if (!eventHandlers) {
            return;
        }
        Object.keys(eventHandlers).forEach(eventName => {
            if (typeof this._eventHandlers[eventName] !== 'undefined') {
                this._log.warn('Wfs plugin tried to register multiple handlers for event: ' + eventName);
                return;
            }
            this._eventHandlers[eventName] = eventHandlers[eventName];
            this.getSandbox().registerForEventByName(this, eventName);
        });
    }

    _initImpl () {
        super._initImpl();
        const sandbox = this.getSandbox();
        if (this.getMapModule().getSupports3D() && this.renderMode !== RENDER_MODE_VECTOR) {
            // 3D mapmodule doesn't support MVT
            this._log.warn('Changing WFS render mode (3d only supports GeoJSON). Configuration was for: ' + this.renderMode);
            this.renderMode = RENDER_MODE_VECTOR;
        }
        this.reqEventHandler = new ReqEventHandler(sandbox);
        this.visualizationForm = new VisualizationForm({ name: '' });
        this.WFSLayerService = new WFSLayerService(sandbox);
        this.vectorFeatureService = sandbox.getService('Oskari.mapframework.service.VectorFeatureService');
        this.mapLayerService = sandbox.getService('Oskari.mapframework.service.MapLayerService');

        if (!this.mapLayerService || !this.vectorFeatureService) {
            return;
        }
        const composingModel = new LayerComposingModel([
            LayerComposingModel.CAPABILITIES,
            LayerComposingModel.CLUSTERING_DISTANCE,
            LayerComposingModel.CREDENTIALS,
            LayerComposingModel.HOVER,
            LayerComposingModel.SRS,
            LayerComposingModel.STYLES_JSON,
            LayerComposingModel.URL,
            LayerComposingModel.VERSION,
            LayerComposingModel.WFS_RENDER_MODE
        ], ['1.1.0', '2.0.0', '3.0.0']);

        const layerClass = 'Oskari.mapframework.bundle.mapwfs2.domain.WFSLayer';
        this.mapLayerService.registerLayerModel(this.getLayerTypeSelector(), layerClass, composingModel);
        this.mapLayerService.registerLayerModelBuilder(this.getLayerTypeSelector(), new WfsLayerModelBuilder(sandbox));
        this.vectorFeatureService.registerLayerType(this.layertype, this);
        this.vectorFeatureService.registerDefaultStyles(this.layertype, DEFAULT_STYLES);
        sandbox.registerService(this.WFSLayerService);
    }

    _createPluginEventHandlers () {
        const vectorHandlers = this.vectorLayerHandler.createEventHandlers(this);
        const mvtHandlers = this.mvtLayerHandler.createEventHandlers(this);
        const commonHandlers = this.reqEventHandler.createEventHandlers(this);
        const eventKeys = [...new Set([
            ...Object.keys(vectorHandlers),
            ...Object.keys(mvtHandlers),
            ...Object.keys(commonHandlers)
        ])];
        const handlers = {};
        // Call event handlers in all modules
        eventKeys.forEach(eventName => {
            handlers[eventName] = event => {
                [vectorHandlers, mvtHandlers, commonHandlers].forEach(handlerModule => {
                    if (handlerModule.hasOwnProperty(eventName)) {
                        handlerModule[eventName](event);
                    }
                });
            };
        });
        return handlers;
    }

    _createRequestHandlers () {
        return this.reqEventHandler.createRequestHandlers(this);
    }

    isLayerSupported (layer) {
        if (!layer) {
            return false;
        }
        if (layer.isLayerOfType(this.getLayerTypeSelector())) {
            return true;
        }
        return this.layertypes.has(layer.getLayerType());
    }

    getRenderMode (layer) {
        let renderMode = this.renderMode;
        if (layer.getOptions()) {
            renderMode = layer.getOptions().renderMode || renderMode;
        }
        return renderMode;
    }

    isRenderModeSupported (mode) {
        return mode === RENDER_MODE_MVT || mode === RENDER_MODE_VECTOR;
    }

    /**
     * @method getPropertiesForIntersectingGeom
     * To get feature properties as a list. Returns features that intersect with given geometry.
     *
     * @param {String | Object} geoJsonGeom GeoJson format geometry object. Note: NOT feature, but feature's geometry
     * @param {Oskari.mapframework.bundle.mapwfs2.domain.WFSLayer} layer
     * @return {Array} features' properties as a list
     */
    getPropertiesForIntersectingGeom (geoJsonGeom, layer) {
        const handler = this._getLayerHandler(layer);
        if (!handler) {
            return;
        }
        const olLayer = this.getOLMapLayers(layer)[0];
        return handler.getPropertiesForIntersectingGeom(geoJsonGeom, olLayer);
    }

    getLayerFeaturePropertiesInViewport (layerId) {
        const handler = this._getLayerHandler(layerId);
        if (handler) {
            return handler.getLayerFeaturePropertiesInViewport(layerId);
        }
    }

    /**
     * @method addMapLayerToMap Adds wfs layer to map
     * @param {Oskari.mapframework.bundle.mapwfs2.domain.WFSLayer} layer
     * @param {Boolean} keepLayerOnTop
     * @param {Boolean} isBaseMap
     */
    addMapLayerToMap (layer, keepLayerOnTop, isBaseMap) {
        const renderMode = this.getRenderMode(layer);
        if (!this.isRenderModeSupported(renderMode)) {
            return;
        }
        const handler = renderMode === RENDER_MODE_MVT ? this.mvtLayerHandler : this.vectorLayerHandler;
        this.layerHandlersByLayerId[layer.getId()] = handler;
        const added = handler.addMapLayerToMap(layer, keepLayerOnTop, isBaseMap);
        // Set oskari properties for vector feature service functionalities.
        added.forEach(lyr => {
            const silent = true;
            lyr.set(LAYER_ID, layer.getId(), silent);
            lyr.set(LAYER_TYPE, layer.getLayerType(), silent);
            if (layer.isVisible() && !lyr.get(LAYER_HOVER)) {
                // Only set style if visible as it's an expensive operation
                // assumes style will be set on MapLayerVisibilityChangedEvent when layer is made visible
                lyr.setStyle(this.getCurrentStyleFunction(layer, handler));
            }
        });
    }

    /**
     * @method refreshLayersOfType
     * @param {String} layerType
     */
    refreshLayersOfType (layerType) {
        if (!layerType) {
            return;
        }
        this.getSandbox().getMap().getLayers()
            .filter(layer => layer.getLayerType() === layerType)
            .forEach(layer => {
                const handler = this._getLayerHandler(layer);
                if (handler) {
                    handler.refreshLayer(layer);
                }
            });
    }

    /* ---- Impl specific functions ---- */

    /**
     * @method getCustomStyleEditorForm To get editor ui element for custom style.
     * @param {Object} styleWithMetadata
     * @return VisualizationForm's form element
     */
    getCustomStyleEditorForm (styleWithMetadata = {}) {
        const { style, title } = styleWithMetadata;
        if (!style || !title) {
            this.visualizationForm = new VisualizationForm({ name: '' });
        } else {
            this.visualizationForm.setOskariStyleValues(style, title);
        }
        return this.visualizationForm.getForm();
    }

    /**
     * @method applyEditorStyle Applies custom style editor's style to the layer.
     * @param {Oskari.mapframework.bundle.mapwfs2.domain.WFSLayer} layer
     * @param {String} styleName
     */
    applyEditorStyle (layer, styleName) {
        const style = this.visualizationForm.getOskariStyle();
        layer.setCustomStyle(style);
        layer.selectStyle(styleName);
    }

    /**
     * @method findLayerByOLLayer
     * @param {ol/layer/Layer} olLayer OpenLayers layer impl
     * @return {Oskari.mapframework.bundle.mapwfs2.domain.WFSLayer}
     */
    findLayerByOLLayer (olLayer) {
        const layerId = Object.keys(this._layerImplRefs).find(layerId => olLayer === this._layerImplRefs[layerId]);
        return this.getSandbox().getMap().getSelectedLayer(layerId);
    }

    /**
     * @method getAllLayerIds
     * @return {String[]} All layer ids handled by plugin and selected on map
     */
    getAllLayerIds () {
        return Object.keys(this._layerImplRefs);
    }

    /**
     * Helper to access the correct layer handler impl for a layer.
     * @param {AbstractLayer | string | number} layer layer object or id
     */
    _getLayerHandler (layer) {
        if (!layer) {
            return;
        }
        const id = typeof layer === 'object' ? layer.getId() : layer;
        return this.layerHandlersByLayerId[id];
    }

    /**
     * @method getCurrentStyleFunction
     * Returns OL style corresponding to layer currently selected style
     * @param {Oskari.mapframework.bundle.mapwfs2.domain.WFSLayer} layer
     * @return {ol/style/Style}
     */
    getCurrentStyleFunction (layer, handler = this._getLayerHandler(layer)) {
        if (!handler) {
            return;
        }
        const factory = this.mapModule.getGeomTypedStyles.bind(this.mapModule);
        const styleFunction = styleGenerator(factory, layer);
        const selectedIds = new Set(this.WFSLayerService.getSelectedFeatureIds(layer.getId()));
        return handler.getStyleFunction(layer, styleFunction, selectedIds);
    }

    /**
     * @method updateLayerStyle
     * @param {Oskari.mapframework.bundle.mapwfs2.domain.WFSLayer} layer
     */
    updateLayerStyle (layer) {
        if (!this.isLayerSupported(layer)) {
            return;
        }
        const olLayers = this.getOLMapLayers(layer);
        if (!olLayers || olLayers.length === 0) {
            return;
        }
        const style = this.getCurrentStyleFunction(layer);
        olLayers.forEach(lyr => {
            lyr.setStyle(style);
            if (this.renderMode === RENDER_MODE_VECTOR && this.getMapModule().getSupports3D()) {
                // Trigger features changed to synchronize 3D view
                lyr.getSource().getFeatures().forEach(ftr => ftr.changed());
            }
        });
    }

    /**
     * @method updateLayerProperties
     * Requests and sets feature properties
     * @param {Oskari.mapframework.bundle.mapwfs2.domain.WFSLayer} layer wfs layer
     * @param {Array} fields
     */
    updateLayerProperties (layer) {
        if (!layer) {
            return;
        }
        const onSuccess = response => {
            const lang = Oskari.getLang();
            const { types = {}, locale = {}, selection } = response;
            if (Array.isArray(selection)) {
                layer.setPropertyFilter(selection);
            } else if (selection) {
                const selectionArray = selection[lang] || selection.default || [];
                layer.setPropertySelection(selectionArray);
            }
            const labels = locale[lang] || locale.default || {};
            layer.setPropertyLabels(labels);
            layer.setPropertyTypes(types);
            // TODO: event should have only locale object not separate arrays
            this.notify('WFSPropertiesEvent', layer, layer.getLocales(), layer.getFields());
        };
        jQuery.ajax({
            type: 'GET',
            dataType: 'json',
            data: {
                layer_id: layer.getId()
            },
            url: Oskari.urls.getRoute('GetWFSLayerFields'),
            success: onSuccess,
            error: () => {
                this._log.warn('Error getting fields for wfs layer ' + layer.getId());
            }
        });
    }

    notify (eventName, ...args) {
        var builder = Oskari.eventBuilder(eventName);
        if (!builder) {
            return;
        }
        Oskari.getSandbox().notifyAll(builder.apply(null, args));
    }

    saveUserStyle (layer, name) {
        const style = this.visualizationForm.getOskariStyle();
        const layerId = layer.getId();
        let title = this.visualizationForm.getOskariStyleName();
        if (!title) {
            const existing = this.userStyleService.getUserStylesForLayer(layerId);
            title = Oskari.getMsg('MapWfs2', 'own-style') + ' ' + (existing.length + 1);
        }
        const styleWithMetadata = { name, style, title };
        layer.saveUserStyle(styleWithMetadata);
        this.userStyleService.saveUserStyle(layerId, styleWithMetadata);
    }

    /**
     * Called when layer details are updated (for example by the admin functionality)
     * @param {Oskari.mapframework.domain.AbstractLayer} layer new layer details
     */
    _updateLayer (layer) {
        if (!this.isLayerSupported(layer)) {
            return;
        }
        const handler = this._getLayerHandler(layer);
        if (!handler) {
            return;
        }
        const layersImpls = this.getOLMapLayers(layer.getId()) || [];
        layersImpls.forEach(olLayer => {
            handler.applyZoomBounds(layer, olLayer);
        });
    }
};

Oskari.clazz.defineES('Oskari.wfsvector.WfsVectorLayerPlugin', WfsVectorLayerPlugin,
    {
        /**
         * @property {String[]} protocol array of superclasses as {String}
         * @static
         */
        protocol: ['Oskari.mapframework.module.Module', 'Oskari.mapframework.ui.module.common.mapmodule.Plugin']
    }
);
