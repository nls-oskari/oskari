import { LAYER_TYPE, LAYER_HOVER, WFS_ID_KEY, FTR_PROPERTY_ID, LAYER_ID, WFS_TYPE, VECTOR_TILE_TYPE, VECTOR_TYPE } from '../domain/constants';
import { getStyleForGeometry } from '../../mapwfs2/plugin/WfsVectorLayerPlugin/util/style'; // TODO
import olOverlay from 'ol/Overlay';
import olLayerVector from 'ol/layer/Vector';
import olLayerVectorTile from 'ol/layer/VectorTile';
import { Vector as olSourceVector } from 'ol/source';

export class HoverHandler {
    constructor (mapmodule) {
        this._mapmodule = mapmodule;
        this.olLayers = {};
        this.state = {};
        this.styleFactory = null;
        this._tooltipContents = {};
        this._tooltipOverlay = null;
        this._defaultStyles = {};
        this._initBindings();
    }

    _initBindings () {
        this._mapmodule.getMap().getViewport().addEventListener('mouseout', evt => {
            this.clearHover();
        }, false);
        this.styleFactory = this._mapmodule.getGeomTypedStyles.bind(this._mapmodule);
    }

    /**
     * @method onMapHover VectorFeatureService handler impl method
     * Handles feature highlighting on map hover.
     *
     * @param { Oskari.mapframework.event.common.MouseHoverEvent } event
     * @param { olRenderFeature } feature
     * @param { olVectorTileLayer } olLayer
     */
    onFeatureHover (event, feature, olLayer) {
        if (!feature || !olLayer) {
            this.clearHover();
            return;
        }
        const layerType = olLayer.get(LAYER_TYPE);
        if (this._featureOrIdEqualsCurrent(feature, layerType)) {
            return;
        }
        this._clearPrevious();
        const layerId = olLayer.get(LAYER_ID);
        this.updateTooltipContent(layerId, feature);

        // Vectorhandler updates vector layers' feature styles but tooltip is handled by hoverhandler
        if (layerType === VECTOR_TYPE) {
            return;
        }
        const layer = this.olLayers[layerId];
        if (!layer) {
            return;
        }
        this.state = {
            feature,
            layer,
            layerType
        };
        if (layerType === VECTOR_TILE_TYPE) {
            this.state.renderFeatureId = feature.get(FTR_PROPERTY_ID);
            layer.changed();
        } else {
            layer.getSource().addFeature(feature);
        }
    }

    onMapHover (event) {
        this._updateTooltipPosition(event);
    }

    createHoverLayer (layer, source) {
        const olLayer = this._getLayer(layer, source);
        olLayer.setOpacity(layer.getOpacity());
        olLayer.setVisible(layer.isVisible());
        olLayer.set(LAYER_HOVER, true, true);
        olLayer.setStyle(this._styleGenerator(layer));
        this.olLayers[layer.getId()] = olLayer;
        this.setTooltipContent(layer);
        return olLayer;
    }

    _getLayer (layer, source) {
        if (layer.getLayerType() === VECTOR_TILE_TYPE) {
            return new olLayerVectorTile({ source });
        }
        return new olLayerVector({ source: new olSourceVector() });
    }

    setTooltipContent (layer) {
        const options = layer.getHoverOptions();
        if (!options || !Array.isArray(options.content)) {
            return;
        }
        this._tooltipContents[layer.getId()] = options.content;
    }

    setDefaultStyle (layerType, styleType, styleDef) {
        const styles = this._defaultStyles[layerType] || {};
        styles[styleType] = styleDef;
        this._defaultStyles[layerType] = styles;
    }

    _styleGenerator (layer) {
        const { featureStyle: layerHoverDef } = layer.getHoverOptions() || {};
        const { featureStyle: defaultFeatureStyle, hover: defaultHoverDef } = this._defaultStyles[layer.getLayerType()] || {};
        let hoverDef = layerHoverDef || defaultHoverDef;
        if (!hoverDef) {
            return null;
        }
        if (hoverDef.inherit === true) {
            let layerStyleDef = layer.getCurrentStyleDef() || {};
            if (!layerStyleDef.featureStyle) {
                // Bypass possible layer definitions
                Object.values(layerStyleDef).find(obj => {
                    if (obj.hasOwnProperty('featureStyle')) {
                        layerStyleDef = obj;
                        return true;
                    }
                });
            }
            hoverDef = jQuery.extend(true, {}, defaultFeatureStyle, layerStyleDef.featureStyle, hoverDef);
        }
        // TODO: if layer contains only one geometry type return olStyle (hoverDef) instead of function
        const olStyles = this.styleFactory(hoverDef);
        if (layer.getLayerType() === VECTOR_TILE_TYPE) {
            return feature => {
                if (this.state.renderFeatureId === feature.get(FTR_PROPERTY_ID)) {
                    return getStyleForGeometry(feature.getType(), olStyles);
                }
            };
        }
        return feature => {
            return getStyleForGeometry(feature.getGeometry(), olStyles);
        };
    }

    _clearPrevious () {
        const { feature, layer, layerType } = this.state;
        if (feature && layer) {
            if (layerType === VECTOR_TILE_TYPE) {
                delete this.state.renderFeatureId;
                layer.changed();
            } else {
                this.state.layer.getSource().removeFeature(feature);
            }
            this.state = {};
        }
    }

    clearHover () {
        this._clearPrevious();
        this._clearTooltip();
    }

    _featureOrIdEqualsCurrent (feature, layerType) {
        const { feature: current } = this.state;
        if (!current) {
            return false;
        }
        const idProp = WFS_TYPE === layerType ? WFS_ID_KEY : FTR_PROPERTY_ID;
        return current === feature || current.get(idProp) === feature.get(idProp);
    }

    /**
    * @method getTooltipOverlay
    * Get common tooltip overlay.
    *
    * @return {olOverlay}
    */
    getTooltipOverlay () {
        if (!this._tooltipOverlay) {
            const overlayDiv = document.createElement('div');
            overlayDiv.className = 'feature-hover-overlay';
            this._tooltipOverlay = new olOverlay({
                element: overlayDiv,
                offset: [10, -10],
                stopEvent: false
            });
            this._mapmodule.getMap().addOverlay(this._tooltipOverlay);
        }
        return this._tooltipOverlay;
    }

    /**
     * @method _getTooltipContent
     * @param {Number | } contentOptions
     * @param {olFeature | olRenderFeature} feature
     * @return {String} html content for tooltip or null
     */
    _getTooltipContent (layerId, feature) {
        const contentOptions = this._tooltipContents[layerId];
        if (!contentOptions) {
            return null;
        }
        let content = '';
        contentOptions.forEach(function (entry) {
            let key = entry.key;
            if (typeof key === 'undefined' && entry.keyProperty) {
                key = feature.get(entry.keyProperty);
            }
            if (typeof key !== 'undefined') {
                content += '<div>' + key;
                if (entry.valueProperty) {
                    content += ': ';
                    const value = feature.get(entry.valueProperty);
                    if (typeof value !== 'undefined') {
                        content += value;
                    }
                }
                content += '</div>';
            }
        });
        if (content) {
            return content;
        }
        return null;
    }

    /**
     * @method _updateTooltipPosition
     * Updates tooltip overlay's position.
     *
     */
    _updateTooltipPosition (event) {
        const mapWidth = Oskari.getSandbox().getMap().getWidth();
        const tooltip = jQuery(this.getTooltipOverlay().getElement());
        const margin = 20;
        const positioningY = event.getPageY() > (tooltip.outerHeight() || 100) + margin ? 'bottom' : 'top';
        const positioningX = event.getPageX() + (tooltip.outerWidth() || 200) + margin < mapWidth ? 'left' : 'right';
        const positioning = positioningY + '-' + positioningX;
        this.getTooltipOverlay().setPositioning(positioning);
        this.getTooltipOverlay().setPosition([event.getLon(), event.getLat()]);
    }

    /**
     * @method updateTooltipContent
     * Updates tooltip with feature's data or hides it if content is empty.
     *
     * @param {Numbed | String} layerId
     * @param {olFeature | olRenderFeature} feature
     */
    updateTooltipContent (layerId, feature) {
        const tooltip = jQuery(this.getTooltipOverlay().getElement());
        const content = this._getTooltipContent(layerId, feature);
        if (content) {
            tooltip.html(content);
            tooltip.css('display', '');
        } else {
            tooltip.empty();
            tooltip.css('display', 'none');
        }
    }

    /**
     * @method _clearTooltip
     * Clears tooltip's content and hides it.
     */
    _clearTooltip () {
        const tooltip = jQuery(this.getTooltipOverlay().getElement());
        tooltip.empty();
        tooltip.css('display', 'none');
    }
}
