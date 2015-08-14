define([
	"oskari",
	"jquery",
	"bundles/framework/bundle/layerselection2/instance",
	"./Flyout",
	"bundles/framework/bundle/layerselection2/Tile",
	"css!resources/framework/bundle/layerselection2/css/style.css",
	"bundles/framework/bundle/layerselection2/locale/fi",
	"bundles/framework/bundle/layerselection2/locale/sv",
	"bundles/framework/bundle/layerselection2/locale/en",
	"bundles/framework/bundle/layerselection2/locale/cs",
	"bundles/framework/bundle/layerselection2/locale/de",
	"bundles/framework/bundle/layerselection2/locale/es"
], function(Oskari,jQuery) {
    return Oskari.bundleCls("layerselection2").category({create: function () {
		var me = this;
		var inst = Oskari.clazz.create("Oskari.mapframework.bundle.layerselection2.LayerSelectionBundleInstance");

		return inst;

	},update: function (manager, bundle, bi, info) {

	}})
});