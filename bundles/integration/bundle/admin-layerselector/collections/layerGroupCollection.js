
(function() {
    define(['_bundle/models/layerModel'],function(LayerModel) {
        return Backbone.Collection.extend({

            // Reference to this collection's model.
            model : LayerModel,

            initialize: function(title) {
                this.name = title; 
//                this.layers = [];
                this.searchIndex = {};

            },

            /**
             * @method setId 
             * @param {String} value
             */
            setTitle : function(value) {
                this.name = value;
            },
            /**
             * @method getTitle 
             * @return {String}
             */
            getTitle : function() {
                return this.name;
            },
            /**
             * @method addLayer 
             * @param {LayerModel} layer
             */
            addLayer : function(layerModel) {
                this.add(layerModel, {silent: true});
                this.searchIndex[layerModel.getId()] = this._getSearchIndex(layerModel);
            },
            /**
             * @method getLayers 
             * @return {Layer[]}
             */
            getLayers : function() {
                return this.models;
            },
            removeLayers : function() {
                this.models = [];
            },
            _getSearchIndex : function(layerModel) {
                var val = layerModel.getName() +  ' ' + 
                    layerModel.getInspireName() +  ' ' +
                    layerModel.getOrganizationName();
                // TODO: maybe filter out undefined texts
                return val.toLowerCase();
            },
            matchesKeyword : function(layerId, keyword) {
                var searchableIndex = this.searchIndex[layerId];
                return searchableIndex.indexOf(keyword.toLowerCase()) != -1;
            }

        });
        
    });
}).call(this);


