import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, Select, Tooltip } from 'oskari-ui'
import { Form, Card, Space, Input, Row } from 'antd';
import styled from 'styled-components';
import { createGlobalStyle } from 'styled-components';

import 'antd/es/form/style/index.js';
import 'antd/es/card/style/index.js';
import 'antd/es/space/style/index.js';
import 'antd/es/input/style/index.js';
import 'antd/es/tooltip/style/index.js';

const { TextArea } = Input;

// If the form is shown on popup the Select dropdown opens behind popup without this
// FIXME: this will probably not work with modal popups (dropdown might be over the modal overlay)
const zIndexValue = 99998;

const GlobalStyle = createGlobalStyle`
    body {
        .ant-tooltip {
            z-index: 999999;
        }
    }
`;

const StyledFormItem = styled(Form.Item)`
    display:flex;
    flex-wrap: wrap;
    margin-bottom: 0;

    .ant-form-item-label {
        text-align: left;
        width: 100%;

        label {
            color: #6d6d6d;
            font-size: 12px;
            height: 24px;
        }
    }

    input {
        height: 40px;
    }

    .ant-form-item-explain {
        font-size: 12px;

        & > div {
            margin: 5px 0 0; 
        }
    }

`;

const StyledButton = styled(Button)`
    margin: 0 5px;
`;

/**
 * @class GenericForm
 * @calssdesc <GenericForm>
 * @memberof module:oskari-ui
 * @see {@link module:oskari-ui/util.LocaleProvider|LocaleProvider}
 * @param {Object} props - { formSettings, fields }
 *
 * @example <caption>Basic usage</caption>
 * <GenericForm props={{ ...exampleProps }}/>
 */

/**
 * Generate generic Oskari UI form
 * 
 * @param {Object} props props        - object containing all form settings
 * @param {Object} props.formSettings - object containing settings for the form
 * @param {Array} props.fields        - array of objects containing all single fields
 *
 */

export class GenericForm extends React.Component {
    constructor (props) {
        super(props);

        this.state = {
            disabledButtons: this.props.formSettings.disabledButtons
        };
    }

    /**
     * @method _createFormItems
     * @private
     * 
     * Crate single form items
     * 
     * @param {Object} fields - array containing all fields
     * @returns {React.Component} 
     */
    _createFormItems (fields, formSettings) {
        return fields.map((field) => {
            return (
                <StyledFormItem
                    key={ field.name }
                    name={ field.type !== 'buttongroup' ? field.name : '' }
                    label={ formSettings.showLabels ? field.label : '' }
                    rules={ field.rules }
                    initialValue={ this._getFieldInitialValue(field) }
                >
                    { this._createInputComponent( field ) }
                </StyledFormItem>
            );
        });
    }


    /**
     * @method _createInputComponent
     * @private
     * Wraps single field into Tooltip if it is wanted to be shown
     * 
     * @param {Object} field - all necessary information about field needed to render it
     * 
     * @returns {React.Component} - input wrapped into Tooltip or not 
     */
    _createInputComponent (field) {
        if (field.showTooltip) {
            return (
                <Tooltip
                    title={ field.placeholder }
                    placement={ 'topLeft' }
                    trigger={ ['focus'] }
                >
                    { this._createFormInput( field ) }
                </Tooltip>
            );
        } else {
            return this._createFormInput( field );
        }
    }

    /**
     * @method _createFormInput
     * @private
     * Create single Form.Item content with provided field properties
     * 
     * @param {Object} field              - object containing information for single field
     * @param {String} field.type         - field type as string {text / textarea / info / dropdown}
     * @param {String} field.placeholder  - placeholder text for the current field
     * @param {String|Number} field.value - value for current field used in info card / drowdown / submit button
     * 
     * @returns {Component} React component for the provided field
     */
    _createFormInput (field) {
        if (!field) {
            return null;
        }
    
        const fieldKey = field.name + '_' + field.type + '_field';
    
        switch(field.type) {
            case 'text':
                return (
                    <Input
                        key={ fieldKey }
                        className={ field.optionalClass }
                        placeholder={ field.placeholder }
                        maxLength={ field.maxLength }
                    />
                );
            case 'textarea':
                return (
                    <TextArea
                        key={ fieldKey }
                        className={ field.optionalClass }
                        placeholder={ field.placeholder }
                    />
                );
            case 'info':
                return (
                    <Card
                        key={ fieldKey }
                        className={ field.optionalClass }
                    >
                        { field.value }
                    </Card>
                );
            case 'dropdown':
                return (
                    <Select
                        key={ fieldKey }
                        className={ field.optionalClass }
                        placeholder={ field.placeholder }
                        dropdownStyle={{ zIndex: zIndexValue }}

                    >
                        { field.value.map((singleOption) => {
                            return (
                                <Select.Option
                                    value={ singleOption.value || singleOption }
                                    key={ singleOption.label || singleOption.value || singleOption }
                                >
                                    { singleOption.label || singleOption.name || singleOption.value || singleOption }
                                </Select.Option>
                            );
                        }) }
                    </Select>
                );
            case 'button':
                return (
                    <Button
                        key={ fieldKey }
                        className={ field.optionalClass }
                        type={ field.style }
                        htmlType={ field.buttonType }
                        onClick={ field.onClick }
                        block={ (field.buttonType === 'submit' || field.buttonType === 'button') }>
                        { field.value }
                    </Button>
                );
            case 'buttongroup':
                return ( 
                <Row justify={ 'center' }>
                    <Space>
                        { field.buttons.map((singleItem) => {
                            return (
                                <StyledButton
                                    className={ singleItem.optionalClass }
                                    key={ singleItem.name }
                                    type={ singleItem.style }
                                    disabled={ this.props.formSettings.disabledButtons }
                                    htmlType={ singleItem.buttonType }
                                    onClick={ singleItem.onClick }>
                                    { singleItem.value }
                                </StyledButton>
                            );
                        }) }
                    </Space>
                </Row>
                );
            default:
                return null;
        }
    }

    /**
     * @method _getFieldInitialValue
     * @private
     * 
     * Get initial value for each field
     * 
     * @param {Object} currentField - current field to find value from
     * 
     * @return {String} fieldValue - return initial value for current field
     */
    _getFieldInitialValue (currentField) {
        if (currentField.type === 'dropdown') {
            const currentValue = typeof currentField.value.find(option => option.isDefault) !== 'undefined' ? currentField.value.find(option => option.isDefault).value : null;
            return currentValue;
        } else {
            return currentField.value;
        }         
    }
    
    render ()  {
        return (
            <Form
                onFinishFailed={ this.props.formSettings.onFinishFailed }
                onFinish={ this.props.formSettings.onFinish }
            >
                <GlobalStyle />
                <Space direction="vertical">
                    { this._createFormItems( this.props.fields, this.props.formSettings) }
                </Space>     
            </Form>
        );
    }
};

GenericForm.propTypes = {
    formName: PropTypes.string,
    fields: PropTypes.arrayOf(
        PropTypes.shape({
            type: PropTypes.string.isRequired,
            label: PropTypes.string,
            name: PropTypes.string.isRequired,
            placeholder: PropTypes.string,
            required: PropTypes.bool,
            value: PropTypes.any,
            validator: PropTypes.func,
            rules: PropTypes.array
        })
    )
};
