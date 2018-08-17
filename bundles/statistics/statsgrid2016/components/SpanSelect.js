Oskari.clazz.define('Oskari.statistics.statsgrid.SpanSelect', function (locale, id, label, values, options) {
    this.locale = locale;
    this.element = null;
    this.id = id;
    this.label = label;
    this.values = this._sort(values);
    this.options = options;
    this.selections = {
        from: null,
        to: null
    };
    this._createUI();
}, {
    __templates: {
        main: _.template('<div class="parameter margintop"><div class="clear"></div></div>'),
        select: _.template('<div class="label">${label}</div>')
    },
    getId: function () {
        return this.id;
    },
    getElement: function () {
        return this.element;
    },
    _sort: function (values) {
        if (!Array.isArray(values)) {
            values = [values];
        }
        return values.sort(this._sortDesc);
    },
    _sortDesc: function (val1, val2) {
        return val2.id - val1.id;
    },
    _createUI: function () {
        var cont = jQuery(this.__templates.main());
        var lblFrom = this.label + ' ' + this.locale.parameters.from;
        var lblTo = this.label + ' ' + this.locale.parameters.to;
        var tempFrom = jQuery(this.__templates.select({label: lblFrom}));
        var tempTo = jQuery(this.__templates.select({label: lblTo}));

        var from = Oskari.clazz.create('Oskari.userinterface.component.SelectList', this.id + '_from');
        var to = Oskari.clazz.create('Oskari.userinterface.component.SelectList', this.id + '_to');

        var widthDef = {width: '205px'};
        var dropdown = to.create(this.values, this.options);
        dropdown.css(widthDef);
        to.adjustChosen();
        to.selectFirstValue();
        tempTo.append(dropdown);
        tempTo.css(widthDef);
        cont.prepend(tempTo);
        this.selections.to = to;

        dropdown = from.create(this.values, this.options);
        dropdown.css(widthDef);
        from.adjustChosen();
        from.selectLastValue();
        tempFrom.append(dropdown);
        tempFrom.css(widthDef);
        cont.prepend(tempFrom);
        this.selections.from = from;

        this.element = cont;
    },
    getValue: function () {
        var me = this;
        if (me.values) {
            var filtered = me.values.filter(function (option) {
                var value = option.id;
                var ok = true;
                var from = me.selections.from ? me.selections.from.getValue() : false;
                var to = me.selections.to ? me.selections.to.getValue() : false;
                if (from) {
                    ok = from <= value;
                }
                if (ok) {
                    if (to) {
                        ok = to >= value;
                    }
                }
                return ok;
            }).map(function (option) {
                return option.id;
            }).sort(function (a, b) {
                return a - b;
            });
            return filtered;
        }
        return [];
    }

});
