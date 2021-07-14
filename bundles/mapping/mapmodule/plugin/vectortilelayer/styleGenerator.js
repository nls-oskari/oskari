import olStyleStyle from 'ol/style/Style';
import { filterOptionalStyle, getOptionalStyleFilter } from '../../../mapmodule/oskariStyle/filter';

const invisible = new olStyleStyle();

export function styleGenerator (styleFactory, styleDef) {
    const styleCache = {};
    Object.keys(styleDef).forEach((layerName) => {
        const styles = {};
        const layerStyleDef = styleDef[layerName];
        const featureStyle = layerStyleDef.featureStyle;
        if (featureStyle) {
            styles.base = styleFactory(featureStyle);
        }
        const optionalStyles = layerStyleDef.optionalStyles;
        if (optionalStyles) {
            styles.optional = optionalStyles.map((optionalDef) => {
                const optional = {
                    filter: getOptionalStyleFilter(optionalDef),
                    style: styleFactory(Object.assign({}, featureStyle, optionalDef))
                };
                return optional;
            });
        }
        styleCache[layerName] = styles;
    });
    return feature => {
        var styles = styleCache[feature.get('layer')];
        if (!styles) {
            return invisible;
        }
        if (styles.optional) {
            var found = styles.optional.find(op => filterOptionalStyle(op.filter, feature));
            if (found) {
                return found.style;
            }
        }
        if (styles.base) {
            return styles.base;
        }
        return invisible;
    };
}
