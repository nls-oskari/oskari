import { processFeatureProperties } from './util/props';
import { WFS_ID_KEY, WFS_FTR_ID_KEY } from '../../../mapmodule/domain/constants';
import { filterByAttribute, getFilterAlternativesAsArray } from './util/filter';

export class ReqEventHandler {
    constructor (sandbox) {
        this.sandbox = sandbox;
        this.isClickResponsive = true;
    }

    createEventHandlers (plugin) {
        const me = this;
        const modifySelection = (layer, featureIds, keepPrevious) => {
            plugin.WFSLayerService.setWFSFeaturesSelections(layer.getId(), featureIds, !keepPrevious);
            plugin.notify('WFSFeaturesSelectedEvent', plugin.WFSLayerService.getSelectedFeatureIds(layer.getId()), layer, false);
        };
        const getSelectedLayer = (layerId) => this.sandbox.getMap().getSelectedLayer(layerId);
        return {
            WFSFeaturesSelectedEvent: (event) => {
                plugin.updateLayerStyle(event.getMapLayer());
            },
            MapClickedEvent: (event) => {
                if (!me.isClickResponsive) {
                    return;
                }
                const hits = plugin.getMapModule().getFeaturesAtPixel(event.getMouseX(), event.getMouseY());
                const keepPrevious = event.getParams().ctrlKeyDown;
                const modifySelectionOpts = {};
                const getSelectionOptsForLayer = layer => {
                    let selectionOpts = modifySelectionOpts[layer.getId()];
                    if (!selectionOpts) {
                        selectionOpts = { layer, features: [] };
                        modifySelectionOpts[layer.getId()] = selectionOpts;
                    }
                    return selectionOpts;
                };
                hits.forEach(({ featureProperties, layerId }) => {
                    const layer = getSelectedLayer(layerId);
                    if (!layer || !plugin.isLayerSupported(layer)) {
                        return;
                    }
                    const wfsFeatureId = featureProperties[WFS_ID_KEY];
                    if (keepPrevious) {
                        getSelectionOptsForLayer(layer).features.push(wfsFeatureId);
                    } else {
                        plugin.notify('GetInfoResultEvent', {
                            layerId,
                            features: [processFeatureProperties(featureProperties, true)],
                            lonlat: event.getLonLat()
                        });
                    }
                });
                if (keepPrevious) {
                    Object.values(modifySelectionOpts)
                        .forEach(({ layer, features }) => modifySelection(layer, features, keepPrevious));
                }
            },
            WFSSetFilter: (event) => {
                const keepPrevious = Oskari.ctrlKeyDown();
                const fatureCollection = event.getGeoJson();
                const filterFeature = fatureCollection.features[0];
                if (['Polygon', 'MultiPolygon'].indexOf(filterFeature.geometry.type) >= 0 && typeof filterFeature.properties.area !== 'number') {
                    return;
                }
                var targetLayers;
                if (plugin.WFSLayerService.getAnalysisWFSLayerId()) {
                    targetLayers = [plugin.WFSLayerService.getAnalysisWFSLayerId()];
                } else {
                    if (plugin.WFSLayerService.isSelectFromAllLayers()) {
                        targetLayers = plugin.getAllLayerIds();
                    } else {
                        const layerId = plugin.WFSLayerService.getTopWFSLayer();
                        targetLayers = layerId ? [layerId] : [];
                    }
                }
                targetLayers.forEach(layerId => {
                    const layer = getSelectedLayer(layerId);
                    const propsList = plugin.getPropertiesForIntersectingGeom(filterFeature.geometry, layerId);
                    modifySelection(layer, propsList.map(props => props[WFS_ID_KEY]), keepPrevious);
                });
            },
            WFSSetPropertyFilter: event => {
                if (!event.getFilters() || event.getFilters().filters.length === 0) {
                    return;
                }
                const layerId = event.getLayerId();
                const records = plugin.getLayerFeaturePropertiesInViewport(layerId);
                if (!records || records.length === 0) {
                    return;
                }
                const filteredIds = new Set();
                const alternatives = getFilterAlternativesAsArray(event);
                alternatives.forEach(attributeFilters => {
                    let filteredList = records;
                    attributeFilters.forEach(filter => {
                        filteredList = filterByAttribute(filter, filteredList);
                    });
                    filteredList.forEach(props => filteredIds.add(props[WFS_FTR_ID_KEY]));
                });
                modifySelection(getSelectedLayer(layerId), [...filteredIds], false);
            }
        };
    }

    createRequestHandlers (plugin) {
        return {
            'WfsLayerPlugin.ActivateHighlightRequest': this,
            'ShowOwnStyleRequest': Oskari.clazz.create(
                'Oskari.mapframework.bundle.mapwfs2.request.ShowOwnStyleRequestHandler',
                plugin
            )
        };
    }
    // handle WfsLayerPlugin.ActivateHighlightRequest
    handleRequest (oskariCore, request) {
        this.isClickResponsive = request.isEnabled();
    }
}
