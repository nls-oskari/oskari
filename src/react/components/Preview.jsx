import React from 'react';
import PropTypes from 'prop-types';

const previewBaseSvg = (path) => {
    return (
        <svg viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
            <svg viewBox="0 0 80 80" width="120" height="120" x="0" y="0" id="marker">
                { path }
            </svg>
        </svg>
    );
};

const previewSize = '80px';

const previewStyling = {
    border: '1px solid #d9d9d9',
    height: previewSize,
    width: previewSize
}


/**
 * @class Preview
 * @calssdesc <Preview>
 * @memberof module:oskari-ui
 * @see {@link module:oskari-ui/util.LocaleProvider|LocaleProvider}
 * @param {Object} props - { }
 * @param {Function} previewIcon - callback for creating icon
 *
 * @example <caption>Basic usage</caption>
 * <Preview props={{ ...exampleProps }}/>
 */

export class Preview extends React.Component {
    constructor (props) {
        super(props);

        this.ref = React.createRef();
    }

    _combineSvg (path) {
        return(
            previewBaseSvg(path)
        );
    }

    render () {
        return (
            <div style={ previewStyling }>
                { this._combineSvg(this.props.previewIcon) }
            </div>
        );
    }
};