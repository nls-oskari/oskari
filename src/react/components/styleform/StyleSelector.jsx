import React from 'react';
import PropTypes from 'prop-types';
import { Select, Message } from 'oskari-ui';
import { Form, Card} from 'antd';
import styled from 'styled-components';

// AntD width settings for grid
const formLayout = {
    labelCol: { span: 24 }, // width of label column in AntD grid settings -> full width = own row inside element
    wrapperCol: { span: 24 } // width of wrapping column in AntD grid settings -> full width = own row inside element
}

const SelectorForm = styled(Form)`
    width: 400px;

    & > .ant-space {
        width: 100%;
    }
`;

export const StyleSelector = (props) => {
    const getSelectedStyle = (selectedStyleName) => props.styleList.find((style) => style.value === selectedStyleName);

    return (
        <SelectorForm>
            <Card>
                <Form.Item label={<Message bundleKey={ props.locSettings.localeKey } messageKey='VisualizationForm.subheaders.name' />} { ...formLayout } name={ 'styleListSelector' }>
                    <Select onChange={ (name) => props.onChange(getSelectedStyle(name)) }>
                        { props.styleList.map((singleOption) => {
                            return (
                                <Select.Option
                                    value={ singleOption.value}
                                    key={ singleOption.value }
                                >
                                    { singleOption.value }
                                </Select.Option>
                            );
                        }) }
                    </Select>
                </Form.Item>
            </Card>
        </SelectorForm>
    );
};

StyleSelector.propTypes = {
    onChange: PropTypes.func.isRequired,
    styleList: PropTypes.array.isRequired,
    locSettings: PropTypes.object.isRequired
};