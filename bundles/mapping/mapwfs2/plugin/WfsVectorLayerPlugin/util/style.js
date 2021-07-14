/* eslint-disable new-cap */
import { Style as olStyle, Circle as olCircleStyle, Stroke as olStroke, Fill as olFill, Text as olText } from 'ol/style';
import { filterOptionalStyle, getOptionalStyleFilter } from '../../../../mapmodule/oskariStyle/filter';

const log = Oskari.log('WfsVectorLayerPlugin.util.style');

const defaults = {
    style: {
        fill: {
            color: '#FAEBD7'
        },
        stroke: {
            color: '#000000',
            width: 1,
            area: {
                color: '#000000',
                width: 1
            }
        },
        image: {
            shape: 5,
            size: 3,
            fill: {
                color: '#FAEBD7'
            }
        }
    },
    selected: {
        inherit: true,
        effect: 'auto major',
        stroke: {
            area: {
                effect: 'none',
                color: '#000000',
                width: 4
            },
            width: 3
        }
    },
    hover: {
        inherit: true,
        effect: 'auto minor',
        stroke: {
            area: {
                effect: 'none',
                color: '#000000',
                width: 2
            },
            width: 2
        }
    }
};
export const DEFAULT_STYLES = { ...defaults };
// TODO: move
const applyAlphaToColorable = (colorable, alpha) => {
    if (!colorable || !colorable.getColor()) {
        return;
    }
    if (Array.isArray(colorable.getColor())) {
        const color = [...colorable.getColor()];
        color[3] = alpha;
        colorable.setColor(color);
        return;
    }
    let colorLike = colorable.getColor();
    if (typeof colorLike !== 'string') {
        return;
    }
    if (colorLike.startsWith('rgba')) {
        colorLike = colorLike.substring(0, colorLike.lastIndexOf(','));
        colorLike += `,${alpha})`;
        colorable.setColor(colorLike);
        return;
    } else if (colorLike.startsWith('rgb')) {
        colorLike = colorLike.replace('rgb', 'rgba');
        colorLike = colorLike.substring(0, colorLike.lastIndexOf(')'));
        colorLike += `,${alpha})`;
        colorable.setColor(colorLike);
        return;
    }
    const rgb = Oskari.util.hexToRgb(colorLike);
    if (!rgb) {
        return;
    }
    const { r, g, b } = rgb;
    colorable.setColor(`rgba(${r},${g},${b},${alpha})`);
};

// TODO: move
export const applyOpacity = (olStyle, opacity) => {
    if (!olStyle || isNaN(opacity)) {
        return;
    }
    const alpha = opacity < 1 ? opacity : opacity / 100.0;
    applyAlphaToColorable(olStyle.getFill(), alpha);
    applyAlphaToColorable(olStyle.getStroke(), alpha);
    if (olStyle.getImage()) {
        olStyle.getImage().setOpacity(alpha);
    }
    return olStyle;
};

const _setFeatureLabel = (feature, textStyle, labelProperty) => {
    let prop;
    if (Array.isArray(labelProperty)) {
        prop = labelProperty.find(p => feature.get(p));
    } else {
        prop = labelProperty;
    }
    if (!prop) {
        return;
    }
    textStyle.setText(feature.get(prop));
};
// TODO: move
export const getStyleForGeometry = (geometry, styleTypes) => {
    if (!geometry || !styleTypes) {
        return;
    }
    let style = null;
    let geometries = [];
    switch (geometry.getType ? geometry.getType() : geometry) { // TODO: geometry || type
    case 'LineString':
    case 'MultiLineString':
        style = styleTypes.line || styleTypes; break;
    case 'Polygon':
    case 'MultiPolygon':
        style = styleTypes.area || styleTypes; break;
    case 'Point':
    case 'MultiPoint':
        style = styleTypes.dot || styleTypes; break;
    case 'GeometryCollection':
        if (typeof geometry.getGeometries === 'function') {
            geometries = geometry.getGeometries() || [];
        }
        if (geometries.length > 0) {
            log.debug('Received GeometryCollection. Using first feature to determine feature style.');
            style = getStyleForGeometry(geometries[0], styleTypes);
        } else {
            log.info('Received GeometryCollection without geometries. Feature style cannot be determined.');
        }
        break;
    };
    return style;
};

const getStyleFunction = styles => {
    const getStyle = (styles, isSelected) => {
        if (!styles) {
            return;
        }
        if (isSelected) {
            return styles.selected || styles.default;
        }
        return styles.default;
    };
    return (feature, resolution, isSelected) => {
        let style = null;
        if (styles.optional) {
            const found = styles.optional.find(op => filterOptionalStyle(op.filter, feature));
            if (found) {
                style = getStyle(found, isSelected);
            }
        }
        if (!style) {
            style = getStyle(styles, isSelected);
        }
        const { labelProperty } = style;
        style = getStyleForGeometry(feature.getGeometry(), style);
        const textStyle = style ? style.getText() : undefined;
        if (labelProperty && textStyle) {
            _setFeatureLabel(feature, textStyle, labelProperty);
        }
        return style;
    };
};

const merge = (...styles) => jQuery.extend(true, {}, ...styles);

let defaultStyleFunction;
const getDefaultStyleFunction = styleFactory => {
    if (defaultStyleFunction) {
        return defaultStyleFunction;
    }
    const styles = {
        default: styleFactory(defaults.style),
        selected: styleFactory(merge(defaults.style, defaults.selected))
    };
    defaultStyleFunction = getStyleFunction(styles);
    return defaultStyleFunction;
};
// featureStyleGenerator, defaultStyleGenerator,...
export const styleGenerator = (styleFactory, layer) => {
    if (!layer) {
        return getDefaultStyleFunction(styleFactory);
    }
    let styleDef = layer.getCurrentStyleDef();
    if (!styleDef) {
        return getDefaultStyleFunction(styleFactory);
    }
    if (!styleDef.featureStyle) {
        // Bypass possible layer definitions
        Object.values(styleDef).find(obj => {
            if (obj.hasOwnProperty('featureStyle')) {
                styleDef = obj;
                return true;
            }
        });
    }
    const { featureStyle, optionalStyles } = styleDef;
    if (!featureStyle && !optionalStyles) {
        return getDefaultStyleFunction(styleFactory);
    }
    const styles = {};
    if (featureStyle) {
        styles.default = styleFactory(featureStyle);
        styles.selected = styleFactory(merge(featureStyle, defaults.selected));
    } else {
        styles.default = styleFactory(defaults.style);
        styles.selected = styleFactory(merge(defaults.style, defaults.selected));
    }
    if (optionalStyles) {
        styles.optional = optionalStyles.map((optionalDef) => {
            const optional = {
                filter: getOptionalStyleFilter(optionalDef),
                default: styleFactory(merge(featureStyle, optionalDef)),
                selected: styleFactory(merge(featureStyle, optionalDef, defaults.selected))
            };
            return optional;
        });
    }
    return getStyleFunction(styles);
};

// Style for cluster circles
const clusterStyleCache = {};
export const clusterStyleFunc = (feature, isSelected) => {
    const size = feature.get('features').length;
    const cacheKey = [`${size} ${isSelected}`];
    let style = clusterStyleCache[cacheKey];
    if (!style) {
        style = new olStyle({
            image: new olCircleStyle({
                radius: size > 9 ? 14 : 12,
                stroke: new olStroke({
                    color: '#fff'
                }),
                fill: new olFill({
                    color: isSelected ? '#005d90' : '#3399CC'
                })
            }),
            text: new olText({
                text: size.toString(),
                font: 'bold 14px sans-serif',
                fill: new olFill({
                    color: '#fff'
                })
            })
        });
        clusterStyleCache[cacheKey] = style;
    }
    return style;
};
export const hiddenStyle = new olStyle({ visibility: 'hidden' });
