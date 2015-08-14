Oskari.clazz.category('Oskari.mapframework.bundle.publishedstatehandler.PublishedStateHandlerBundleInstance', 'state-methods', {

    /**
     * @method useState
     * @param {Object} savedState
     *      JSON presentation of application state, created with #getCurrentState()
     * method.
     *
     * Sends out Oskari.mapframework.request.common.RemoveMapLayerRequest,
     * Oskari.mapframework.request.common.AddMapLayerRequest,
     * Oskari.mapframework.request.common.ChangeMapLayerOpacityRequest and
     * Oskari.mapframework.request.common.MapMoveRequest to control the
     * application state
     */
    useState: function (state) {
        if (!state) {
            // dont do anything if we dont have a saved state
            return [];
        }
        var components = this.sandbox.getStatefulComponents(),
            loopedComponents = [],
            id;
        for (id in state) {
            if (state.hasOwnProperty(id)) {
                if (components[id] && components[id].setState) {
                    // safety check that we have the component in current config
                    components[id].setState(state[id].state);
                }
                loopedComponents.push(id);
            }
        }
        return loopedComponents;
    },

    /**
     * @method resetState
     * Used to return the application to its original state.
     * Calls resetState-methods for all plugins and returns the application state
     * by
     * calling #useState with config gathered/saved on bundle start.
     *
     * All plugins should handle themselves what this means in the plugins
     * implementation.
     */
    resetState: function () {
        var me = this,
            pluginName;
        me._historyEnabled = false;
        me._historyPrevious = [];
        me._historyNext = [];


        for (pluginName in this._pluginInstances) {
            if (this._pluginInstances.hasOwnProperty(pluginName)) {
                me.sandbox.printDebug('[' + me.getName() + ']' + ' resetting state on ' + pluginName);
                me._pluginInstances[pluginName].resetState();
            }
        }
        // reinit with startup params

        // get initial state from server
        me._currentViewId = this._defaultViewId;
        if (me._startupState) {
            me._resetComponentsWithNoStateData(me.useState(this._startupState));
        } else {
            jQuery.ajax({
                dataType: "json",
                type: "GET",
                // noSavedState=true parameter tells we dont want the state saved in session
                url: me.sandbox.getAjaxUrl() + 'action_route=GetAppSetup&noSavedState=true',
                success: function (data) {
                    if (data && data.configuration) {
                        me._startupState = data.configuration;
                        me._resetComponentsWithNoStateData(me.useState(data.configuration));
                        me._historyEnabled = true;
                    } else {
                        alert('error in getting configuration');
                    }
                },
                error: function () {
                    alert('error loading conf');
                    me._historyEnabled = true;
                },
                complete: function () {
                    me._historyEnabled = true;
                }
            });
        }

        me._historyEnabled = true;
    },
    /**
     * @method _resetComponentsWithNoStateData
     * Used to return the application to its original state.
     * Loops through all the stateful components and calls their setState()
     * with no parameters to reset them. Ignores the components whose IDs are listed in
     * the parameter array.
     * @param {String[]}  loopedComponents
     *      list of component IDs that had state data and should not be resetted
     *
     */
    _resetComponentsWithNoStateData: function (loopedComponents) {
        // loop all stateful components and reset their state they are not in loopedComponents
        var components = this.sandbox.getStatefulComponents(),
            cid,
            found,
            i;
        for (cid in components) {
            if (components.hasOwnProperty(cid)) {
                found = false;
                for (i = 0; i < loopedComponents.length; i += 1) {
                    // FIXME use ===
                    if (cid == loopedComponents[i]) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    // set empty state for resetting state
                    components[cid].setState();
                }
            }
        }
    }


});