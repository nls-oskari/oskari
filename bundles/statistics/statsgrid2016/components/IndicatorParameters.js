Oskari.clazz.define('Oskari.statistics.statsgrid.IndicatorParameters', function (locale, sandbox) {
    this.locale = locale;
    this.sb = sandbox;
    this.service = sandbox.getService('Oskari.statistics.statsgrid.StatisticsService');
    this.spinner = Oskari.clazz.create('Oskari.userinterface.component.ProgressSpinner');
    this.paramHandler = Oskari.clazz.create('Oskari.statistics.statsgrid.IndicatorParameterHandler', this.service, this.locale);
    this._values = {};
    this._selections = [];
    this.parentElement = null;
    this.regionsetRestrictions = null;

    Oskari.makeObservable(this);
    var me = this;
    var errorService = this.service.getErrorService();

    this.paramHandler.on('Data.Loaded', function (data) {
        me.spinner.stop();
        if (Object.keys(data.regionset).length === 0) {
            errorService.show(locale.errors.title, locale.errors.regionsetsIsEmpty);
        }
        me.trigger('indicator.changed', data.regionset.length > 0);
        me._createUi(data.datasrc, data.indicators, data.selectors, data.regionset);
    });
}, {
    __templates: {
        main: _.template('<div class="stats-ind-params"></div>'),
        select: _.template('<div class="parameter margintop"><div class="label" id=${id}>${label}</div><div class="clear"></div></div>'),
        option: _.template('<option value="${id}">${name}</option>')
    },

    /** **** PUBLIC METHODS ******/

    /**
     * @method  @public  clean clean params
     */
    clean: function () {
        if (!this.container) {
            return;
        }
        this.container.remove();
        this.container = null;
        this._selections = [];
    },
    /**
     * @method  @public  attachTo
     * @description pass in the element to which the parameters will be attached to
     */
    attachTo: function (parentElement) {
        this.parentElement = parentElement;
    },
    /**
     * @method  @public indicatorSelected  handle indicator selected
     * @param  {Integer} datasrc indicator datasource
     * @param  {String|String[]} indId    indicator id
     * @param  {Object} elements elements
     * @param  {Boolean} series search series
     */
    indicatorSelected: function (datasrc, indId, regionsetRestriction, series) {
        var me = this;

        this.clean();

        if (!datasrc || !indId || !indId.length || !indId[0]) {
            return;
        }
        if (!this.regionSelector) {
            this.regionSelector = Oskari.clazz.create('Oskari.statistics.statsgrid.RegionsetSelector', me.service, Oskari.getMsg.bind(null, 'StatsGrid'));
        }
        if (!me.spinner.spinning) {
            me.spinner.insertTo(this.parentElement.parent());
            me.spinner.start();
        }
        this.regionsetRestrictions = (regionsetRestriction || []).map(function (iter) {
            return Number(iter);
        });
        this.searchSeries = series;
        // get the data to create ui with
        me.paramHandler.getData(datasrc, indId);
    },
    _createUi: function (datasrc, indId, selections, regionsets) {
        var me = this;
        var locale = me.locale;
        var panelLoc = locale.panels.newSearch;

        var cont = jQuery(this.__templates.main());
        this.parentElement.append(cont);
        this.container = cont;
        var seriesSelection = null;
        Object.keys(selections).forEach(function (selected, index) {
            var placeholderText = (panelLoc.selectionValues[selected] && panelLoc.selectionValues[selected].placeholder) ? panelLoc.selectionValues[selected].placeholder : panelLoc.defaultPlaceholder;
            var label = (locale.parameters[selected]) ? locale.parameters[selected] : selected.id;
            var options = {
                placeholder_text: placeholderText
            };

            var dropdown;
            if (me.searchSeries && selections[selected].time) {
                // create time span select
                var spanSelect = Oskari.clazz.create(
                    'Oskari.statistics.statsgrid.SpanSelect',
                    locale,
                    selected,
                    label,
                    selections[selected].values,
                    options);
                cont.append(spanSelect.getElement());
                me._selections.push(spanSelect);
                seriesSelection = selected;
            } else {
                if (selections[selected].time) {
                    options.multi = true;
                }
                var tempSelect = jQuery(me.__templates.select({id: selected, label: label}));
                var select = Oskari.clazz.create('Oskari.userinterface.component.SelectList', selected);
                dropdown = selections !== null ? select.create(selections[selected].values, options) : select.create(selections, options);
                dropdown.css({width: '205px'});
                select.adjustChosen();
                select.selectFirstValue();
                tempSelect.find('.label').append(dropdown);
                cont.append(tempSelect);
                me._selections.push(select);
            }
        });

        var optionsToDisable = regionsets.filter(function (iter) {
            if (me.regionsetRestrictions.length && me.regionsetRestrictions.indexOf(iter) === -1) {
                return iter;
            }
        });
        var regionSelect = me.regionSelector.create(regionsets);
        me.regionSelector.setWidth(205);
        if (regionsets.length === 1) {
            regionSelect.value(regionsets[0]);
        } else {
            // try to select the current regionset as default selection
            regionSelect.value(me.service.getStateService().getRegionset());
        }
        regionSelect.container.addClass('margintop');
        cont.append(regionSelect.container);
        var select = regionSelect.selectInstance;
        if (select) {
            select.disableOptions(optionsToDisable);
            var state = select.getOptions();
            var enabled = state.options.not(':disabled').first();
            select.setValue(enabled.val());
            select.element.trigger('change');
        }

        me._values = {
            ds: datasrc,
            ind: indId,
            regionsetComponent: regionSelect
        };
        if (me.searchSeries && seriesSelection) {
            me._values.seriesId = seriesSelection;
        }

        me.trigger('indicator.changed', regionsets.length > 0);
    },
    getValues: function () {
        var me = this;
        var values = {
            datasource: me._values.ds,
            indicator: me._values.ind,
            regionset: me._values.regionsetComponent.value(),
            selections: {}
        };
        if (me._values.seriesId) {
            values.series = {
                id: me._values.seriesId
            };
        }

        me._selections.forEach(function (select) {
            if (values.series && values.series.id === select.getId()) {
                values.series.values = select.getValue();
                // set value for the series selection parameter
                values.selections[select.getId()] = values.series.values[0];
            } else {
                values.selections[select.getId()] = select.getValue();
            }
        });
        return values;
    }
});
