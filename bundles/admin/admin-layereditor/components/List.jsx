import React from 'react';
import PropTypes from 'prop-types';
import AntList from 'antd/lib/list';
import 'antd/lib/list/style/css';

export const List = ({header, footer, dataSource}) => {
    return (
        <AntList
            header={header}
            footer={footer}
            bordered
            dataSource={dataSource}
            renderItem={item => (<AntList.Item>{item}</AntList.Item>)}
        />
    );
};

List.propTypes = {
    header: PropTypes.string,
    footer: PropTypes.string,
    dataSource: PropTypes.array
};